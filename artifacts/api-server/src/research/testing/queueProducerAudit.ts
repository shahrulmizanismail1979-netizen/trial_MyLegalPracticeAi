import path from "node:path";
import ts from "typescript";

const normalize = (file: string) => file.replaceAll("\\", "/");

/**
 * Conservative, test-only import reachability audit, not a call-graph proof.
 * Following modules (including barrels and dynamic imports) catches HTTP tests
 * whose router/service enqueues without mentioning enqueue in the test itself.
 * Read-only users of a queue-capable module need an explicit reviewed exception.
 */
export function findQueueProducerPaths(sources: ReadonlyMap<string, string>): Map<string, string[]> {
  const files = new Map([...sources].map(([file, source]) => [normalize(file), source]));
  const parsed = new Map([...files].map(([file, source]) =>
    [file, ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)]));
  const resolve = (from: string, specifier: string): string | undefined => {
    if (!specifier.startsWith(".")) return undefined;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
    return [base, `${base}.ts`, `${base}/index.ts`, base.replace(/\.js$/, ".ts")]
      .find(candidate => files.has(candidate));
  };
  const imports = new Map<string, string[]>();
  const sinks = new Set<string>();
  for (const [file, ast] of parsed) {
    const dependencies: string[] = [];
    if (file.endsWith("/research/processing/queue.ts")) sinks.add(file);
    const add = (node: ts.Node | undefined) => {
      if (node && ts.isStringLiteralLike(node)) {
        const target = resolve(file, node.text);
        if (target) dependencies.push(target);
      }
    };
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        const bindings = clause?.namedBindings;
        const onlyTypes = clause?.isTypeOnly || (bindings && ts.isNamedImports(bindings)
          && !clause?.name && bindings.elements.length > 0 && bindings.elements.every(e => e.isTypeOnly));
        if (!onlyTypes) add(node.moduleSpecifier);
        return;
      }
      if (ts.isExportDeclaration(node)) {
        const onlyTypes = node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause)
          && node.exportClause.elements.length > 0 && node.exportClause.elements.every(e => e.isTypeOnly));
        if (!onlyTypes) add(node.moduleSpecifier);
        return;
      }
      if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(node.expression) && node.expression.text === "require")) add(node.arguments[0]);
        // Direct table writes bypassing enqueue must not evade the audit either.
        if (ts.isPropertyAccessExpression(node.expression)
          && ["insert", "update"].includes(node.expression.name.text)
          && node.arguments[0]?.getText(ast).match(/(?:^|\.)researchJobs$/)) sinks.add(file);
      }
      if (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (/\b(?:insert\s+into|update)\s+research_jobs\b/i.test(node.getText(ast))) sinks.add(file);
      }
      ts.forEachChild(node, visit);
    };
    visit(ast);
    imports.set(file, dependencies);
  }

  const result = new Map<string, string[]>();
  for (const [suite, ast] of parsed) {
    if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(suite)) continue;
    const mocked = new Set<string>();
    const mockFunctions = new Set<string>();
    for (const statement of ast.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer
          && ts.isCallExpression(declaration.initializer)
          && declaration.initializer.expression.getText(ast) === "vi.fn") mockFunctions.add(declaration.name.text);
      }
    }
    const isFakeValue = (node: ts.Node): boolean => {
      if (ts.isParenthesizedExpression(node)) return isFakeValue(node.expression);
      if (ts.isObjectLiteralExpression(node)) return node.properties.every(property =>
        ts.isPropertyAssignment(property) ? isFakeValue(property.initializer)
          : ts.isShorthandPropertyAssignment(property) && mockFunctions.has(property.name.text));
      if (ts.isArrayLiteralExpression(node)) return node.elements.every(isFakeValue);
      if (ts.isIdentifier(node)) return mockFunctions.has(node.text) || node.text === "undefined";
      if (ts.isCallExpression(node)) return node.expression.getText(ast) === "vi.fn" && node.arguments.length === 0;
      return ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)
        || [ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind);
    };
    // Only unconditional, hoisted full replacements cut graph edges. Partial
    // mocks (importActual/importOriginal/spreads), automocks and doMock do not.
    for (const statement of ast.statements) {
      if (!ts.isExpressionStatement(statement) || !ts.isCallExpression(statement.expression)) continue;
      const call = statement.expression;
      if (call.expression.getText(ast) !== "vi.mock") continue;
      const [specifier, factory] = call.arguments;
      if (!specifier || !ts.isStringLiteralLike(specifier) || !factory
        || !(ts.isArrowFunction(factory) || ts.isFunctionExpression(factory))
        || factory.parameters.length > 0) continue;
      let unsafe = false;
      const check = (node: ts.Node) => {
        if (ts.isSpreadAssignment(node) || ts.isSpreadElement(node)
          || (ts.isCallExpression(node) && node.expression.getText(ast) !== "vi.fn")) unsafe = true;
        ts.forEachChild(node, check);
      };
      check(factory);
      let body: ts.Node = factory.body;
      if (ts.isBlock(body)) {
        if (body.statements.length !== 1 || !ts.isReturnStatement(body.statements[0])
          || !body.statements[0].expression) continue;
        body = body.statements[0].expression;
      }
      while (ts.isParenthesizedExpression(body)) body = body.expression;
      // Unknown bindings may alias a real db/queue. Only demonstrably fake
      // values earn automatic exemption; more complex mocks fail conservatively.
      if (unsafe || !ts.isObjectLiteralExpression(body) || !isFakeValue(body)) continue;
      mocked.add(specifier.text === "@workspace/db" ? "@workspace/db" : resolve(suite, specifier.text) ?? "");
    }
    // A later unmock/doMock can restore real behavior; do not grant exemptions.
    if (/\bvi\.(?:unmock|doUnmock|doMock)\s*\(/.test(ast.text)) mocked.clear();
    if (mocked.has("@workspace/db")) continue;
    const seen = new Set<string>();
    const walk = (file: string, chain: string[]): string[] | undefined => {
      if (seen.has(file) || mocked.has(file)) return undefined;
      seen.add(file);
      const next = [...chain, file];
      if (sinks.has(file)) return next;
      for (const dependency of imports.get(file) ?? []) {
        const found = walk(dependency, next);
        if (found) return found;
      }
      return undefined;
    };
    const chain = walk(suite, []);
    if (chain) result.set(suite, chain);
  }
  return result;
}