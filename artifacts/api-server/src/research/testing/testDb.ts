import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createPool, createDb } from "@workspace/db";

type Db = ReturnType<typeof createDb>;
type Pool = ReturnType<typeof createPool>;

// Database-isolated test environment: a dedicated Postgres schema is created
// per run, the reproducible research DDL (lib/db/sql/research-schema.sql) is
// applied inside it, and all queries from the returned client resolve there
// via search_path. Tests never touch shared dev data; drop() removes the
// schema entirely.

const DDL_PATH = path.resolve(
  __dirname,
  "../../../../../lib/db/sql/research-schema.sql",
);

const PHASE08_MIGRATION_PATHS = [
  "0010-phase07-isolation.sql",
  "0011-phase07-verified-judgment-spans.sql",
  "0012-phase07-warning-separation.sql",
  "0013-phase07-schema-alignment.sql",
  "0014-phase08-search-ui.sql",
  // The current viewer selects later annotation/bookmark columns too.
  "0016-phase10-ai-analysis.sql",
  "0018-phase11b-workspace.sql",
  // Current ingestion dedup and search backfill join Drive inventory even
  // when no Drive fixtures are present. Keep those joins schema-local.
  "0038-drive-headnotes-tables.sql",
  "0044-research-metadata-unique-key.sql",
].map((fileName) =>
  path.resolve(__dirname, "../../../../../lib/db/sql/migrations", fileName),
);

export interface IsolatedTestDbOptions {
  throughPhase08?: boolean;
}

export interface IsolatedTestDb {
  db: Db;
  pool: Pool;
  schemaName: string;
  drop(): Promise<void>;
}

export async function createIsolatedTestDb(
  options: IsolatedTestDbOptions = {},
): Promise<IsolatedTestDb> {
  const schemaName = `test_research_${randomUUID().replaceAll("-", "")}`;
  const admin = createPool();
  let pool: Pool | undefined;
  let schemaCreated = false;

  try {
    await admin.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;
    pool = createPool({ options: `-c search_path=${schemaName}` });

    const ddl = await readFile(DDL_PATH, "utf8");
    await pool.query(ddl);

    if (options.throughPhase08) {
      for (const migrationPath of PHASE08_MIGRATION_PATHS) {
        const migration = await readFile(migrationPath, "utf8");
        await pool.query(migration);
      }
    }
  } catch (err) {
    if (pool) {
      await pool.end().catch(() => undefined);
    }
    if (schemaCreated) {
      await admin
        .query(`DROP SCHEMA "${schemaName}" CASCADE`)
        .catch(() => undefined);
    }
    await admin.end().catch(() => undefined);
    throw err;
  }

  return {
    db: createDb(pool),
    pool,
    schemaName,
    async drop() {
      await pool.end();
      await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
      await admin.end();
    },
  };
}
