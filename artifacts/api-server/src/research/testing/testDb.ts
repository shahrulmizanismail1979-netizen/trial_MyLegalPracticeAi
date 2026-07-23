import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createPool, createDb } from "@workspace/db";

type Db = ReturnType<typeof createDb>;

// Database-isolated test environment: a dedicated Postgres schema is created
// per run, the reproducible research DDL (lib/db/sql/research-schema.sql) is
// applied inside it, and all queries from the returned client resolve there
// via search_path. Tests never touch shared dev data; drop() removes the
// schema entirely.

const DDL_PATH = path.resolve(
  __dirname,
  "../../../../../lib/db/sql/research-schema.sql",
);

export interface IsolatedTestDb {
  db: Db;
  schemaName: string;
  drop(): Promise<void>;
}

export async function createIsolatedTestDb(): Promise<IsolatedTestDb> {
  const schemaName = `test_research_${randomUUID().replaceAll("-", "")}`;
  const admin = createPool();
  await admin.query(`CREATE SCHEMA "${schemaName}"`);
  const pool = createPool({ options: `-c search_path=${schemaName}` });
  try {
    const ddl = await readFile(DDL_PATH, "utf8");
    await pool.query(ddl);
  } catch (err) {
    await pool.end();
    await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
    await admin.end();
    throw err;
  }
  return {
    db: createDb(pool),
    schemaName,
    async drop() {
      await pool.end();
      await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);
      await admin.end();
    },
  };
}
