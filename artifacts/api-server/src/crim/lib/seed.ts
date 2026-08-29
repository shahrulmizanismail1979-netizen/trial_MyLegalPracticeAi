import { sql } from "drizzle-orm";
import { db, causePapersTable, sampleDocumentsTable } from "@workspace/db";
import { logger } from "../../lib/logger";
import seedData from "./crim-content-seed.json";
import { englishCausePaper, englishSampleDocument } from "./english-content";

// Reference content for the MyCrimAI portal, exported from the development
// database. Each table is only seeded when it is empty, so this is safe to
// run on every boot (production fills itself on first deploy and existing
// data is never touched).
const CONTENT_TABLES = [
  "topics",
  "case_laws",
  "cause_papers",
  "workflows",
  "sample_documents",
  "glossary_terms",
  "costs_fees",
] as const;

async function ensureEnglishContentColumns(): Promise<void> {
  // Keep boot compatibility additive for databases populated before migration
  // 0037 is applied. This must run before any Drizzle query selects the new
  // columns or attempts the conflict-safe English backfill.
  await db.execute(sql`
    ALTER TABLE cause_papers
      ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ms',
      ADD COLUMN IF NOT EXISTS source_id integer,
      ADD COLUMN IF NOT EXISTS stable_key text
  `);
  await db.execute(sql`
    ALTER TABLE sample_documents
      ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ms',
      ADD COLUMN IF NOT EXISTS source_id integer,
      ADD COLUMN IF NOT EXISTS stable_key text
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS cause_papers_stable_key_unique
      ON cause_papers (stable_key)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS cause_papers_language_idx
      ON cause_papers (language)
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS sample_documents_stable_key_unique
      ON sample_documents (stable_key)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS sample_documents_language_idx
      ON sample_documents (language)
  `);
}

export async function seedCrimContent(): Promise<void> {
  await ensureEnglishContentColumns();
  const data = seedData as Record<string, Array<Record<string, unknown>>>;

  for (const table of CONTENT_TABLES) {
    const seedRows = data[table];
    if (!seedRows || seedRows.length === 0) continue;
    // jsonb_populate_recordset supplies null rather than a column default for
    // omitted fields, so explicitly classify first-boot legacy precedents.
    const rows = table === "cause_papers" || table === "sample_documents"
      ? seedRows.map((row) => ({ ...row, language: "ms" }))
      : seedRows;

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

    logger.info({ table, rows: rows.length }, "Seeded MyCrimAI content table");
  }

  // Unlike the first-boot seed above, this is deliberately additive. Stable
  // keys plus ON CONFLICT make it safe on every boot, including databases
  // whose content tables were populated before English variants existed.
  const causePapers = (seedData.cause_papers as Array<any>).map(englishCausePaper);
  const sampleDocuments = (seedData.sample_documents as Array<any>).map(englishSampleDocument);
  await db.insert(causePapersTable).values(causePapers).onConflictDoNothing({
    target: causePapersTable.stableKey,
  });
  await db.insert(sampleDocumentsTable).values(sampleDocuments).onConflictDoNothing({
    target: sampleDocumentsTable.stableKey,
  });
  logger.info(
    { causePapers: causePapers.length, sampleDocuments: sampleDocuments.length },
    "Backfilled MyCrimAI English content",
  );
}
