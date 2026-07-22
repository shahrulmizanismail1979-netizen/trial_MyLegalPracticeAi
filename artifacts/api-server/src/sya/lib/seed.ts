import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";
import seedData from "./sya-content-seed.json";

// Reference content for the MySyariahAI portal, exported from the original
// donor app's database. Each table is only seeded when it is empty, so this
// is safe to run on every boot (production fills itself on first deploy and
// existing data is never touched).
const CONTENT_TABLES = [
  "sya_provisions",
  "sya_case_laws",
  "sya_cause_papers",
  "sya_procedural_workflows",
  "sya_glossary_terms",
  "sya_legislation",
  "sya_quranic_verses",
  "sya_gazetted_fatwas",
  "sya_practice_directions",
] as const;

export async function seedSyaContent(): Promise<void> {
  const data = seedData as Record<string, Array<Record<string, unknown>>>;

  for (const table of CONTENT_TABLES) {
    const rows = data[table];
    if (!rows || rows.length === 0) continue;

    const tableRef = sql.raw(`"${table}"`);
    const existing = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM ${tableRef}`,
    );
    if ((existing.rows[0]?.count ?? 0) > 0) continue;

    await db.execute(sql`
      INSERT INTO ${tableRef}
      SELECT * FROM jsonb_populate_recordset(NULL::${tableRef}, ${JSON.stringify(rows)}::jsonb)
      ON CONFLICT (id) DO NOTHING
    `);

    // Keep the id sequence ahead of the seeded ids so future inserts work.
    await db.execute(sql`
      SELECT setval(
        pg_get_serial_sequence(${table}, 'id'),
        (SELECT COALESCE(MAX(id), 1) FROM ${tableRef})
      )
      WHERE pg_get_serial_sequence(${table}, 'id') IS NOT NULL
    `);

    logger.info({ table, rows: rows.length }, "Seeded MySyariahAI content table");
  }
}
