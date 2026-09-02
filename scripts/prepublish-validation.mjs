import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const artifactsDir = join(root, "artifacts");
const artifactKindCatalogPath = join(root, "scripts", "supported-artifact-kinds.json");
const artifactKindSafeguards = {
  api: {},
  design: {},
  "design-system": {},
  mobile: {},
  slides: {},
  video: {},
  web: { requiredServiceEnv: ["PORT", "BASE_PATH"] },
};

export function parseSupportedManifestKinds(text) {
  let kinds;
  try {
    kinds = JSON.parse(text);
  } catch {
    throw new Error("scripts/supported-artifact-kinds.json must contain valid JSON");
  }
  if (
    !Array.isArray(kinds) ||
    kinds.length === 0 ||
    kinds.some((kind) => typeof kind !== "string" || kind.length === 0) ||
    new Set(kinds).size !== kinds.length
  ) {
    throw new Error("Supported manifest-kind list must be non-empty and contain no duplicates");
  }
  return kinds;
}

export function validateArtifactKindSafeguards(
  supportedKinds = parseSupportedManifestKinds(
    readFileSync(artifactKindCatalogPath, "utf8"),
  ),
  safeguards = artifactKindSafeguards,
) {
  const missing = supportedKinds.filter((kind) => safeguards[kind] === undefined);
  const stale = Object.keys(safeguards).filter((kind) => !supportedKinds.includes(kind));
  if (missing.length > 0 || stale.length > 0) {
    const details = [
      missing.length > 0 ? `missing safeguards for: ${missing.join(", ")}` : undefined,
      stale.length > 0 ? `not in the supported catalog: ${stale.join(", ")}` : undefined,
    ].filter(Boolean);
    throw new Error(`Artifact publish safeguards are out of sync (${details.join("; ")})`);
  }
  return safeguards;
}

function stripTomlComment(value) {
  let result = "";
  let inString = false;
  let escaped = false;
  let inComment = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (inComment) {
      if (character === "\n") {
        inComment = false;
        result += character;
      }
      continue;
    }
    if (character === "\\" && inString && !escaped) {
      escaped = true;
      result += character;
      continue;
    }
    if (character === '"' && !escaped) {
      inString = !inString;
    }
    if (character === "#" && !inString) {
      inComment = true;
      continue;
    }
    result += character;
    escaped = false;
  }

  return result;
}

function parseString(value) {
  const match = stripTomlComment(value)
    .trim()
    .match(/^"((?:[^"\\]|\\.)*)"$/);
  return match ? JSON.parse(`"${match[1]}"`) : undefined;
}

function parseStringArray(value) {
  const match = stripTomlComment(value).trim().match(/^\[(.*)\]$/s);
  if (!match) return undefined;

  const items = [];
  let remaining = match[1].trim();

  while (remaining) {
    const item = remaining.match(/^"((?:[^"\\]|\\.)*)"/);
    if (!item) return undefined;

    items.push(JSON.parse(`"${item[1]}"`));
    remaining = remaining.slice(item[0].length).trim();
    if (!remaining) break;
    if (!remaining.startsWith(",")) return undefined;

    remaining = remaining.slice(1).trim();
    if (remaining.startsWith(",")) return undefined;
  }

  return items;
}

function hasCompleteArray(value) {
  const source = stripTomlComment(value);
  if (!source.trim().startsWith("[")) return true;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (const character of source) {
    if (character === "\\" && inString && !escaped) {
      escaped = true;
      continue;
    }
    if (character === '"' && !escaped) {
      inString = !inString;
    } else if (!inString && character === "[") {
      depth += 1;
    } else if (!inString && character === "]") {
      depth -= 1;
    }
    escaped = false;
  }

  return depth === 0;
}

export function parseManifest(filePath) {
  const text = readFileSync(filePath, "utf8");
  let section = "";
  const values = new Map();
  let pendingAssignment;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (pendingAssignment) {
      if (line && !line.startsWith("#")) {
        pendingAssignment.value += `\n${line}`;
      }
      if (hasCompleteArray(pendingAssignment.value)) {
        values.set(pendingAssignment.key, pendingAssignment.value);
        pendingAssignment = undefined;
      }
      continue;
    }

    if (!line || line.startsWith("#") || line.startsWith("[[")) continue;

    const sectionMatch = line.match(/^\[([^\]]+)\]\s*(?:#.*)?$/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }

    const assignment = line.match(/^([A-Za-z][\w-]*)\s*=\s*(.*)$/);
    if (assignment) {
      const key = section ? `${section}.${assignment[1]}` : assignment[1];
      if (!hasCompleteArray(assignment[2])) {
        pendingAssignment = { key, value: assignment[2] };
      } else {
        values.set(key, assignment[2]);
      }
    }
  }

  if (pendingAssignment) {
    values.set(pendingAssignment.key, pendingAssignment.value);
  }

  const serviceEnv = {};
  const buildEnv = {};
  for (const [key, value] of values) {
    if (key.startsWith("services.env.")) {
      serviceEnv[key.slice("services.env.".length)] = parseString(value);
    } else if (key.startsWith("services.production.build.env.")) {
      buildEnv[key.slice("services.production.build.env.".length)] = parseString(value);
    }
  }

  const inlineBuild = values.get("services.production.build");
  const tableBuild = values.get("services.production.build.args");
  const productionBuildDeclared = inlineBuild !== undefined || tableBuild !== undefined;

  if (inlineBuild !== undefined && tableBuild !== undefined) {
    throw new Error(
      `${relative(root, filePath)} declares production build commands in both ` +
        "[services.production] and [services.production.build]",
    );
  }

  const buildValue = inlineBuild ?? tableBuild;
  const build = buildValue === undefined ? undefined : parseStringArray(buildValue);
  if (productionBuildDeclared && (!build || build.length === 0)) {
    throw new Error(
      `${relative(root, filePath)} declares a production build but its command ` +
        "must be a non-empty array of strings",
    );
  }

  return {
    title: parseString(values.get("title") ?? "") ?? relative(root, filePath),
    kind: parseString(values.get("kind") ?? ""),
    build,
    productionBuildDeclared,
    serviceEnv,
    buildEnv,
    env: { ...serviceEnv, ...buildEnv },
  };
}

export function validateArtifact(
  artifact,
  filePath,
  safeguards = validateArtifactKindSafeguards(),
) {
  if (!artifact.productionBuildDeclared) return;

  const recognizedArtifactKinds = Object.keys(safeguards);
  if (safeguards[artifact.kind] === undefined) {
    const receivedKind =
      artifact.kind === undefined ? "missing or malformed" : JSON.stringify(artifact.kind);
    throw new Error(
      `${relative(root, filePath)} must declare a recognized artifact kind for ` +
        `production builds (expected one of: ${recognizedArtifactKinds.join(", ")}; ` +
        `received ${receivedKind})`,
    );
  }

  const requiredServiceEnv = safeguards[artifact.kind].requiredServiceEnv ?? [];
  if (requiredServiceEnv.length > 0) {
    const missing = requiredServiceEnv.filter(
      (key) => !artifact.serviceEnv[key],
    );
    if (missing.length > 0) {
      throw new Error(
        `${relative(root, filePath)} must declare ${missing.join(" and ")} ` +
          "in [services.env]",
      );
    }
  }
}

function run(label, command, env = process.env) {
  console.log(`\n==> ${label}`);
  console.log(`$ ${command.join(" ")}`);
  const result = spawnSync(command[0], command.slice(1), {
    cwd: root,
    env,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
}

export function discoverManifests() {
  return readdirSync(artifactsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(artifactsDir, entry.name, ".replit-artifact", "artifact.toml"))
    .filter((filePath) => {
      try {
        readFileSync(filePath);
        return true;
      } catch {
        return false;
      }
    })
    .sort();
}

export function main() {
  const safeguards = validateArtifactKindSafeguards();
  run("Full workspace typecheck", ["pnpm", "run", "typecheck"]);

  const manifests = discoverManifests();
  for (const filePath of manifests) {
    const artifact = parseManifest(filePath);
    validateArtifact(artifact, filePath, safeguards);
    if (!artifact.build) {
      console.log(`\n==> ${artifact.title}: no production build declared; skipped`);
      continue;
    }

    const shownEnv = Object.entries(artifact.env)
      .map(([key, value]) => `${key}=${value}`)
      .join(" ");
    run(
      `${artifact.title} production build${shownEnv ? ` (${shownEnv})` : ""}`,
      artifact.build,
      { ...process.env, ...artifact.env },
    );
  }

  console.log(`\nPre-publish validation passed (${manifests.length} artifact manifests checked).`);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main();
}