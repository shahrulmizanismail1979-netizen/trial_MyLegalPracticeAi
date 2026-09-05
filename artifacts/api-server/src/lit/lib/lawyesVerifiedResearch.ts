import {
  db,
  researchCaseMetadata,
  researchPageExtractions,
  researchSourcePages,
} from "@workspace/db";
import { and, desc, inArray, ne, sql } from "drizzle-orm";
import {
  latestRightsJoin,
  liveRightsPredicate,
} from "../../research/editorial/liveRights";

export interface VerifiedAuthorityPassage {
  paragraphRef: string;
  pageNumber: number;
  text: string;
}

export interface VerifiedAuthority {
  judgmentId: number;
  title: string;
  citation: string | null;
  court: string | null;
  decisionDate: string | null;
  sourceUrl: string | null;
  verifiedAt: string;
  rightsStatus: string;
  passages: VerifiedAuthorityPassage[];
}

const STOP_WORDS = new Set([
  "about", "after", "against", "also", "and", "answer", "atau", "based", "before",
  "bagi", "bahawa", "case", "dalam", "dan", "dari", "draft", "for", "from", "issue",
  "kepada", "legal", "matter", "oleh", "pada", "please", "research", "review", "saya",
  "serta", "that", "the", "their", "this", "untuk", "using", "what", "when", "where",
  "which", "with", "write", "yang",
]);

function searchTerms(value: string): string[] {
  return [...new Set(
    value
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{N}][\p{L}\p{N}'-]{2,}/gu) ?? [],
  )].filter((term) => !STOP_WORDS.has(term)).slice(0, 18);
}

function broadQuery(value: string): string {
  return searchTerms(value).map((term) => `"${term.replace(/"/g, "")}"`).join(" OR ");
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function metadataString(map: Map<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = map.get(key);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && value.length) return value.map(String).join(", ");
  }
  return null;
}

function splitParagraphs(
  pages: Array<{ id: number; pageNumber: number }>,
  latestTextByPage: Map<number, string>,
): VerifiedAuthorityPassage[] {
  const passages: VerifiedAuthorityPassage[] = [];
  let fallbackIndex = 0;
  for (const page of [...pages].sort((a, b) => a.pageNumber - b.pageNumber)) {
    const text = latestTextByPage.get(page.id) ?? "";
    for (const chunk of text.split(/(?=\[\d+\])|(?:\n\n+)/g)) {
      const cleaned = chunk.trim();
      if (!cleaned) continue;
      const marker = cleaned.match(/^\[(\d+)\]/);
      passages.push({
        paragraphRef: marker ? `[${marker[1]}]` : `para-${++fallbackIndex}`,
        pageNumber: page.pageNumber,
        text: cleaned,
      });
    }
  }
  return passages;
}

function selectRelevantPassages(
  passages: VerifiedAuthorityPassage[],
  terms: string[],
): VerifiedAuthorityPassage[] {
  const scored = passages.map((passage, ordinal) => {
    const lower = passage.text.toLowerCase();
    const score = terms.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
    return { passage, ordinal, score };
  });
  const matched = scored.filter((item) => item.score > 0);
  const selected = (matched.length ? matched : scored)
    .sort((a, b) => b.score - a.score || a.ordinal - b.ordinal)
    .slice(0, 4)
    .sort((a, b) => a.ordinal - b.ordinal);
  return selected.map(({ passage }) => ({
    ...passage,
    text: passage.text.slice(0, 2_500),
  }));
}

export async function retrieveVerifiedMalaysianAuthorities(input: {
  instruction: string;
  matterType?: string | null;
  court?: string | null;
  limit?: number;
}): Promise<VerifiedAuthority[]> {
  const sourceText = [input.instruction, input.matterType, input.court].filter(Boolean).join(" ");
  const searches = [
    input.instruction.slice(0, 500),
    broadQuery(sourceText),
  ].filter((value, index, all) => value && all.indexOf(value) === index);
  const limit = Math.min(6, Math.max(1, input.limit ?? 4));

  type SearchRow = {
    judgment_id: number;
    container_id: number;
    page_refs: number[] | string;
    original_name: string;
    rights_status: string;
    verified_at: Date | string;
    provenance: Record<string, unknown> | string | null;
  };
  const byJudgment = new Map<number, SearchRow>();

  for (const query of searches) {
    const found = await db.execute(sql`
      SELECT
        rvj.id AS judgment_id,
        rvj.container_id,
        rvj.page_refs,
        rsc.original_name,
        rsc.rights_status,
        rvj.verified_at,
        rsc.provenance
      FROM research_search_index si
      JOIN research_verified_judgments rvj ON rvj.id = si.judgment_id
      JOIN research_source_containers rsc ON rsc.id = rvj.container_id
      ${latestRightsJoin("rvj.container_id")}
      WHERE rsc.processing_state = 'SEARCHABLE'
        ${liveRightsPredicate("display")}
        AND (
          si.document @@ websearch_to_tsquery('english', ${query})
          OR si.document_ms @@ websearch_to_tsquery('simple', ${query})
          OR rsc.original_name ILIKE ${`%${query.slice(0, 200)}%`}
        )
      ORDER BY GREATEST(
        ts_rank_cd(si.document, websearch_to_tsquery('english', ${query})),
        ts_rank_cd(si.document_ms, websearch_to_tsquery('simple', ${query}))
      ) DESC, rvj.verified_at DESC
      LIMIT ${limit}
    `);
    for (const row of found.rows as SearchRow[]) {
      if (!byJudgment.has(Number(row.judgment_id))) {
        byJudgment.set(Number(row.judgment_id), row);
      }
    }
    if (byJudgment.size >= limit) break;
  }

  const rows = [...byJudgment.values()].slice(0, limit);
  if (!rows.length) return [];
  const judgmentIds = rows.map((row) => Number(row.judgment_id));
  const metadataRows = await db
    .select()
    .from(researchCaseMetadata)
    .where(and(
      inArray(researchCaseMetadata.judgmentId, judgmentIds),
      ne(researchCaseMetadata.reviewerStatus, "rejected"),
      ne(researchCaseMetadata.method, "publisher_supplied"),
    ))
    .orderBy(desc(researchCaseMetadata.id));
  const metadata = new Map<number, Map<string, unknown>>();
  for (const row of metadataRows) {
    const judgment = metadata.get(row.judgmentId) ?? new Map<string, unknown>();
    if (!judgment.has(row.fieldName) && row.value !== null) judgment.set(row.fieldName, row.value);
    metadata.set(row.judgmentId, judgment);
  }

  const pageIds = [...new Set(rows.flatMap((row) => {
    const refs = typeof row.page_refs === "string" ? JSON.parse(row.page_refs) : row.page_refs;
    return Array.isArray(refs) ? refs.map(Number).filter(Number.isInteger) : [];
  }))];
  const [pages, extractions] = pageIds.length
    ? await Promise.all([
      db.select({ id: researchSourcePages.id, pageNumber: researchSourcePages.pageNumber })
        .from(researchSourcePages).where(inArray(researchSourcePages.id, pageIds)),
      db.select().from(researchPageExtractions)
        .where(inArray(researchPageExtractions.pageId, pageIds))
        .orderBy(desc(researchPageExtractions.id)),
    ])
    : [[], []];
  const pageById = new Map(pages.map((page) => [page.id, page]));
  const latestTextByPage = new Map<number, string>();
  for (const extraction of extractions) {
    if (!latestTextByPage.has(extraction.pageId) && extraction.rawText) {
      latestTextByPage.set(extraction.pageId, extraction.rawText);
    }
  }
  const terms = searchTerms(sourceText);

  return rows.map((row) => {
    const judgmentId = Number(row.judgment_id);
    const refs = typeof row.page_refs === "string" ? JSON.parse(row.page_refs) : row.page_refs;
    const judgmentPages = (Array.isArray(refs) ? refs : [])
      .map((id) => pageById.get(Number(id)))
      .filter((page): page is { id: number; pageNumber: number } => Boolean(page));
    const meta = metadata.get(judgmentId) ?? new Map<string, unknown>();
    const provenance = typeof row.provenance === "string"
      ? JSON.parse(row.provenance) as Record<string, unknown>
      : row.provenance ?? {};
    return {
      judgmentId,
      title: metadataString(meta, "caseName") ?? row.original_name ?? `Verified judgment ${judgmentId}`,
      citation: metadataString(meta, "reportCitation", "neutralCitation"),
      court: metadataString(meta, "court"),
      decisionDate: metadataString(meta, "decisionDate"),
      sourceUrl: [
        provenance.sourceUrl,
        provenance.source_url,
        provenance.url,
        provenance.originalUrl,
      ].map(safeHttpUrl).find(Boolean) ?? null,
      verifiedAt: new Date(row.verified_at).toISOString(),
      rightsStatus: row.rights_status,
      passages: selectRelevantPassages(
        splitParagraphs(judgmentPages, latestTextByPage),
        terms,
      ),
    };
  }).filter((authority) => authority.passages.length > 0);
}