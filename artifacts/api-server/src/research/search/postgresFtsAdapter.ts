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
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO research_search_index
      (judgment_id, container_id, document_text, processor_version, court, decision_date, language, indexed_at)
    VALUES
      (${opts.judgmentId}, ${opts.containerId}, ${opts.documentText},
       ${opts.processorVersion}, ${opts.court ?? null}, ${opts.decisionDate ?? null},
       ${opts.language ?? null}, now())
    ON CONFLICT (judgment_id) DO UPDATE SET
      document_text     = EXCLUDED.document_text,
      processor_version = EXCLUDED.processor_version,
      court             = EXCLUDED.court,
      decision_date     = EXCLUDED.decision_date,
      language          = EXCLUDED.language,
      indexed_at        = now()
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
