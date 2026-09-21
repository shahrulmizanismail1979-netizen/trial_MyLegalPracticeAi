import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../../../../lib/db/src/schema/research";
import { createIsolatedTestDb, type IsolatedTestDb } from "./testing/testDb";

const tables = Object.values(schema).filter((value) => is(value, PgTable)).map(getTableConfig);

describe("fresh research SQL schema contract", () => {
  let isolated: IsolatedTestDb;
  beforeAll(async () => {
    isolated = await createIsolatedTestDb({ currentResearch: true });
  });
  afterAll(async () => { await isolated?.drop(); });

  it("provides every Drizzle research column and index without public fallback", async () => {
    const searchPath = await isolated.pool.query("SHOW search_path");
    expect(searchPath.rows[0].search_path).toBe(isolated.schemaName);
    const columns = await isolated.pool.query(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = current_schema()
    `);
    const indexes = await isolated.pool.query(`
      SELECT t.relname AS table_name, i.indisunique AS is_unique,
        i.indisprimary AS is_primary, i.indpred IS NOT NULL AS is_partial,
        am.amname AS method,
        ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(attnum, ord)
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
          ORDER BY k.ord) AS columns
      FROM pg_index i JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_class idx ON idx.oid = i.indexrelid
      JOIN pg_am am ON am.oid = idx.relam
      WHERE n.nspname = current_schema() AND i.indisvalid
    `);
    for (const table of tables) {
      for (const column of table.columns) {
        expect(columns.rows, `${table.name}.${column.name}`).toContainEqual({
          table_name: table.name, column_name: column.name,
        });
      }
      // Compare semantic keys: inline UNIQUE constraints have different names
      // from Drizzle uniqueIndex declarations but are valid conflict arbiters.
      const expected = [
        ...table.indexes.map(({ config }) => ({
          columns: config.columns.map((column) => "name" in column ? column.name : undefined),
          unique: config.unique, method: config.method ?? "btree",
        })),
        ...table.uniqueConstraints.map((key) => ({
          columns: key.columns.map((column) => column.name), unique: true, method: "btree",
        })),
        ...table.columns.filter((column) => column.isUnique || column.primary).map((column) => ({
          columns: [column.name], unique: true, method: "btree",
        })),
      ];
      for (const key of expected) {
        expect(indexes.rows.some((index) =>
          index.table_name === table.name && !index.is_partial &&
          (!key.unique || index.is_unique) && index.method === key.method &&
          JSON.stringify(index.columns) === JSON.stringify(key.columns)),
        `${table.name} ${key.unique ? "unique " : ""}${key.method} (${key.columns.join(", ")})`).toBe(true);
      }
    }
  });

  it("retains SQL-only processor idempotency and full-text indexes", async () => {
    const result = await isolated.pool.query(`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = current_schema()
    `);
    const definitions = new Map(result.rows.map((row) => [row.indexname, row.indexdef]));
    expect(definitions.get("research_case_candidates_run_container_startpage_uq"))
      .toMatch(/UNIQUE.*\(run_id, container_id, start_page_id\) WHERE \(start_page_id IS NOT NULL\)/);
    expect(definitions.get("research_search_index_document_gin")).toContain("USING gin (document)");
    expect(definitions.get("research_search_index_document_ms_gin")).toContain("USING gin (document_ms)");
    for (const suffix of ["actor", "event", "created_at"]) {
      expect(definitions.get(`research_audit_events_${suffix}_idx`))
        .toContain(`(${suffix}${suffix === "created_at" ? " DESC" : ""})`);
    }
  });

  it("provides the foreign keys declared by Drizzle within the isolated schema", async () => {
    const { rows } = await isolated.pool.query(`
      SELECT t.relname AS source, target.relname AS target,
        target_ns.nspname AS target_schema,
        ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num, ord)
          JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.num
          ORDER BY k.ord) AS source_columns,
        ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num, ord)
          JOIN pg_attribute a ON a.attrelid = target.oid AND a.attnum = k.num
          ORDER BY k.ord) AS target_columns
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_class target ON target.oid = c.confrelid
      JOIN pg_namespace target_ns ON target_ns.oid = target.relnamespace
      WHERE c.contype = 'f' AND n.nspname = current_schema()
    `);
    for (const table of tables) {
      for (const foreignKey of table.foreignKeys) {
        const reference = foreignKey.reference();
        expect(rows, `${table.name} foreign key`).toContainEqual({
          source: table.name,
          target: getTableConfig(reference.foreignTable).name,
          target_schema: isolated.schemaName,
          source_columns: reference.columns.map((column) => column.name),
          target_columns: reference.foreignColumns.map((column) => column.name),
        });
      }
    }
  });

  it("supports the search processor upsert and preserves data when the migration is reapplied", async () => {
    const { rows: [container] } = await isolated.pool.query(`
      INSERT INTO research_source_containers
        (original_name, source_batch, content_sha256, size_bytes, provenance)
      VALUES ('contract', 'contract', repeat('a', 64), 1, '{}') RETURNING id
    `);
    const { rows: [candidate] } = await isolated.pool.query(
      "INSERT INTO research_case_candidates (container_id) VALUES ($1) RETURNING id", [container.id]);
    const { rows: [judgment] } = await isolated.pool.query(`
      INSERT INTO research_verified_judgments (candidate_id, container_id, text_checksum, verified_by)
      VALUES ($1, $2, repeat('b', 64), 'contract') RETURNING id
    `, [candidate.id, container.id]);
    const upsert = (area: string | null) => isolated.pool.query(`
      INSERT INTO research_search_index
        (judgment_id, container_id, document_text, processor_version, practice_area)
      VALUES ($1, $2, 'contract judgment text', 'contract@1', $3)
      ON CONFLICT (judgment_id) DO UPDATE SET practice_area = EXCLUDED.practice_area
      RETURNING *
    `, [judgment.id, container.id, area]);
    await upsert(null);
    const before = await upsert("civil");
    const migration = await readFile(path.resolve(__dirname,
      "../../../../lib/db/sql/migrations/0045-research-search-practice-area.sql"), "utf8");
    await isolated.pool.query(migration);
    await isolated.pool.query(migration);
    const after = await isolated.pool.query("SELECT * FROM research_search_index");
    expect(after.rows).toEqual(before.rows);
    expect(after.rows[0].document).toBeTruthy();
    expect(after.rows[0].document_ms).toBeTruthy();
  });
});