// PostgreSQL full-text search adapter (Phase 08, ADR 0009 §D4).
// Replaces the postgres-search-stub in adapters.ts.
// Reads from research_search_index (GIN-indexed tsvector columns).

import type { SearchAdapter } from "../adapters";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

export interface FtsSearchOptions {
  /** Maximum number of results to return. Default 20. */
  limit?: number;
  /** Filter by court name (partial match). */
  court?: string;
  /** Decision date lower bound (inclusive). */
  dateFrom?: Date;
  /** Decision date upper bound (inclusive). */
  dateTo?: Date;
  /** "english" (default) | "simple" (for Malay terms). */
  dictionary?: "english" | "simple";
  /** Filter by exact practice area (e.g. "criminal", "banking"). */
  practiceArea?: string;
}

export interface FtsSearchResult {
  id: string;
  score: number;
  /** Judgment id from research_search_index. */
  judgmentId: number;
  /** Container id. */
  containerId: number;
}

/**
 * Full-text search using PostgreSQL websearch_to_tsquery.
 * Supports AND (space-separated), OR (|), NOT (-), phrase ("...").
 */
export async function ftSearch(
  query: string,
  opts: FtsSearchOptions = {},
): Promise<FtsSearchResult[]> {
  const limit = opts.limit ?? 20;
  const dict = opts.dictionary === "simple" ? "simple" : "english";
  const tsCol = dict === "simple" ? "document_ms" : "document";

  try {
    const rows = await db.execute(sql`
      SELECT
        si.id,
        si.judgment_id,
        si.container_id,
        ts_rank_cd(si.${sql.raw(tsCol)}, websearch_to_tsquery(${dict}, ${query})) AS score
      FROM research_search_index si
      WHERE si.${sql.raw(tsCol)} @@ websearch_to_tsquery(${dict}, ${query})
        ${opts.court ? sql`AND si.court ILIKE ${"%" + opts.court + "%"}` : sql``}
        ${opts.dateFrom ? sql`AND si.decision_date >= ${opts.dateFrom}` : sql``}
        ${opts.dateTo ? sql`AND si.decision_date <= ${opts.dateTo}` : sql``}
        ${opts.practiceArea ? sql`AND si.practice_area = ${opts.practiceArea}` : sql``}
      ORDER BY score DESC
      LIMIT ${limit}
    `);

    return (rows.rows as Array<{
      id: number;
      judgment_id: number;
      container_id: number;
      score: string;
    }>).map((r) => ({
      id: String(r.judgment_id),
      score: parseFloat(r.score),
      judgmentId: r.judgment_id,
      containerId: r.container_id,
    }));
  } catch (err) {
    logger.error({ err, query }, "FTS search failed");
    return [];
  }
}

/**
 * Index a single judgment text in research_search_index.
 * Called by the search-index processor — not the adapter interface directly.
 */
export async function indexJudgment(opts: {
  judgmentId: number;
  containerId: number;
  documentText: string;
  processorVersion: string;
  court?: string | null;
  decisionDate?: Date | null;
  language?: string | null;
  practiceArea?: string | null;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO research_search_index
      (judgment_id, container_id, document_text, processor_version, court, decision_date, language, practice_area, indexed_at)
    VALUES
      (${opts.judgmentId}, ${opts.containerId}, ${opts.documentText},
       ${opts.processorVersion}, ${opts.court ?? null}, ${opts.decisionDate ?? null},
       ${opts.language ?? null}, ${opts.practiceArea ?? null}, now())
    ON CONFLICT (judgment_id) DO UPDATE SET
      document_text     = EXCLUDED.document_text,
      processor_version = EXCLUDED.processor_version,
      court             = EXCLUDED.court,
      decision_date     = EXCLUDED.decision_date,
      language          = EXCLUDED.language,
      practice_area     = EXCLUDED.practice_area,
      indexed_at        = now()
  `);
}

/**
 * Ensure the practice_area column/index exist on research_search_index and
 * backfill existing rows from their originating Drive asset's contributor
 * folder. Direct SQL (not drizzle push) per the project's migration pattern;
 * idempotent — safe to run on every boot, including production.
 */
export async function ensurePracticeAreaSchema(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE research_search_index ADD COLUMN IF NOT EXISTS practice_area text
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS research_search_index_practice_area_idx
      ON research_search_index (practice_area)
  `);
  // Backfill: container ← upload batch item ← drive asset → contributor folder.
  // Keep the CASE patterns in sync with practiceAreaForContributorFolder().
  await db.execute(sql`
    UPDATE research_search_index si
    SET practice_area = CASE
      WHEN da.contributor_folder ~* 'civil' THEN 'civil_procedure'
      WHEN da.contributor_folder ~* 'corporate|company' THEN 'corporate'
      WHEN da.contributor_folder ~* 'accident|personal +injur' THEN 'accident'
      WHEN da.contributor_folder ~* 'bank' THEN 'banking'
      WHEN da.contributor_folder ~* 'criminal|crime' THEN 'criminal'
      WHEN da.contributor_folder ~* 'convey' THEN 'conveyancing'
      WHEN da.contributor_folder ~* 'syariah|shariah' THEN 'syariah'
      ELSE NULL END
    FROM research_upload_batch_items bi
    JOIN drive_assets da ON da.source_batch_item_id = bi.id
    WHERE bi.container_id = si.container_id
      AND si.practice_area IS NULL
  `);
}

/**
 * Build the SearchAdapter interface backed by PostgreSQL FTS.
 * The `index(id, text)` method is intentionally a no-op because the search-
 * index processor handles indexing with full provenance.  The adapter's
 * `search` method calls ftSearch for backward compat with any code that
 * calls getAdapters().search.search(query).
 */
export const postgresFtsAdapter: SearchAdapter = {
  name: "postgres-fts",
  async index(_id: string, _text: string): Promise<void> {
    // Indexing is handled by the container.search_index processor, not here.
  },
  async search(query: string): Promise<Array<{ id: string; score: number }>> {
    if (!query.trim()) return [];
    return ftSearch(query);
  },
};
