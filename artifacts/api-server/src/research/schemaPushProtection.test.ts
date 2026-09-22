import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIsolatedTestDb, type IsolatedTestDb } from "./testing/testDb";
import { probeResearchPush } from "../../../../lib/db/sql/researchPushProbe";
import { assertResearchSafeguards } from "./schemaSafeguardBehavior";

const exec = promisify(execFile);
const root = path.resolve(__dirname, "../../../..");

describe("SQL-owned research schema push protection", () => {
  let isolated: IsolatedTestDb;
  beforeAll(async () => {
    isolated = await createIsolatedTestDb({ currentResearch: true });
  });
  afterAll(async () => { await isolated?.drop(); });

  async function catalog() {
    const { rows } = await isolated.pool.query(`
      SELECT 'constraint' AS kind, c.conname AS name,
        c.conrelid::regclass::text AS owner, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = current_schema()
      UNION ALL
      SELECT 'index', indexname, tablename, indexdef FROM pg_indexes
      WHERE schemaname = current_schema()
      UNION ALL
      SELECT 'column', column_name, table_name,
        concat_ws('|', data_type, is_nullable, column_default, is_generated, generation_expression)
      FROM information_schema.columns WHERE table_schema = current_schema()
      ORDER BY kind, owner, name
    `);
    return rows;
  }

  it("proves the unguarded installed push engine would remove SQL-owned safeguards", async () => {
    const before = await catalog();
    const statements = await probeResearchPush(isolated.db, isolated.schemaName);
    const plan = statements.join("\n");
    expect(plan).toMatch(/DROP INDEX.*research_case_candidates_run_container_startpage_uq/);
    for (const name of ["document", "document_ms"]) {
      expect(plan).toContain(`DROP COLUMN "${name}"`);
      expect(plan).toMatch(new RegExp(`DROP INDEX.*research_search_index_${name}_gin`));
    }
    for (const suffix of ["actor", "event", "created_at"]) {
      expect(plan).toMatch(new RegExp(`DROP INDEX.*research_audit_events_${suffix}_idx`));
    }
    expect(plan).toMatch(/DROP CONSTRAINT.*research_workspace_quotations_collection_id/);
    expect(plan).toMatch(/FOREIGN KEY \("collection_id"\).*ON DELETE no action/);
    expect(plan).toContain('DROP CONSTRAINT "research_annotations_kind_check"');
    // Planning only: applying this deliberately destructive plan is forbidden.
    expect(await catalog()).toEqual(before);
  });

  it("blocks ordinary, forced and direct configured pushes without changing the schema", async () => {
    const before = await catalog();
    // Defense in depth: even a future regression in the guard must not aim at
    // shared tables. Invalid endpoint prevents any database connection at all.
    const env = { ...process.env, DATABASE_URL: "postgresql://invalid:invalid@127.0.0.1:1/invalid" };
    for (const script of ["push", "push-force"]) {
      const result = await exec("pnpm", ["--filter", "@workspace/db", "run", script], { cwd: root, env })
        .then(() => ({ blocked: false, output: "" }))
        .catch((error) => ({ blocked: true, output: `${error.stdout}${error.stderr}` }));
      expect(result.blocked).toBe(true);
      expect(result.output).toContain("SCHEMA_PUSH_BLOCKED");
    }
    // Some drizzle-kit versions swallow config errors with a zero exit status;
    // the essential guarantee is that the config rejects before connecting.
    const direct = await exec("pnpm", ["--filter", "@workspace/db", "exec", "drizzle-kit",
      "push", "--force", "--config", "./drizzle.config.ts"], { cwd: root, env })
      .then((result) => `${result.stdout}${result.stderr}`)
      .catch((error) => `${error.stdout}${error.stderr}`);
    expect(direct).toContain("SCHEMA_PUSH_BLOCKED");
    const mergeScript = await readFile(path.join(root, "scripts/post-merge.sh"), "utf8");
    expect(mergeScript).not.toMatch(/^\s*[^#\n]*(?:run push|drizzle-kit push)/m);
    expect(await catalog()).toEqual(before);
  }, 60_000);

  it("preserves the full SQL catalog and behavior through supported additive synchronization", async () => {
    const before = await catalog();
    for (const file of [
      "0008-phase05-candidate-idempotency.sql",
      "0014-phase08-search-ui.sql",
      "0018-phase11b-workspace.sql",
      "0019-phase12a-audit-indexes.sql",
    ]) {
      await isolated.pool.query(await readFile(path.join(root, "lib/db/sql/migrations", file), "utf8"));
    }
    expect(await catalog()).toEqual(before);
    await assertResearchSafeguards(isolated);
  });
});