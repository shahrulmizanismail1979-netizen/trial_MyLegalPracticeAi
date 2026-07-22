import { sql } from "drizzle-orm";
import {
  db,
  litTheoryTopics,
  litWorkflows,
  litLegalForms,
  litLegalCases,
  litCostSchedules,
  litGlossaryTerms,
  litPracticeDirections,
  litBarCouncilRulings,
} from "@workspace/db";
import { logger } from "../../lib/logger";
import seedData from "./lit-content-seed.json";

// Reference library content for the MyLitAI / MyLitAI IRAC portals, recovered
// from the original standalone app's seed (42 theory topics, 32 workflows,
// 65 forms, 158 cases, 6 cost schedules, 183 glossary terms, 6 practice
// directions, 10 Bar Council rulings). Each table is only seeded when it is
// empty, so this is safe to run on every boot — production fills itself on
// first deploy and existing data is never touched.
const TABLES = [
  { key: "theory_topics", table: litTheoryTopics, name: "lit_theory_topics" },
  { key: "workflows", table: litWorkflows, name: "lit_workflows" },
  { key: "legal_forms", table: litLegalForms, name: "lit_legal_forms" },
  { key: "legal_cases", table: litLegalCases, name: "lit_legal_cases" },
  { key: "cost_schedules", table: litCostSchedules, name: "lit_cost_schedules" },
  { key: "glossary_terms", table: litGlossaryTerms, name: "lit_glossary_terms" },
  { key: "practice_directions", table: litPracticeDirections, name: "lit_practice_directions" },
  { key: "bar_council_rulings", table: litBarCouncilRulings, name: "lit_bar_council_rulings" },
] as const;

const CHUNK = 25;

export async function seedLitContent(): Promise<void> {
  const data = seedData as Record<string, Array<Record<string, unknown>>>;

  for (const { key, table, name } of TABLES) {
    const rows = data[key];
    if (!rows || rows.length === 0) continue;

    const tableRef = sql.raw(`"${name}"`);
    const existing = await db.execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM ${tableRef}`,
    );
    if ((existing.rows[0]?.count ?? 0) > 0) continue;

    for (let i = 0; i < rows.length; i += CHUNK) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.insert(table).values(rows.slice(i, i + CHUNK) as any);
    }

    logger.info({ table: name, rows: rows.length }, "Seeded litigation library content table");
  }
}
