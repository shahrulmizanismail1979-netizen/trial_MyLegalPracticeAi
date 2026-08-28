/**
 * Portal-accessible Case Law API.
 * Mounted at /api/cases — behind requireAnyPortalAuth.
 *
 * GET /api/cases/search?q=...&court=...&dateFrom=...&dateTo=...&limit=20&offset=0
 *   Full-text search (q) or browse (no q) across approved, headnoted cases.
 *   Returns: id, citation, caseName, court, decisionDate, parties,
 *            headnotes (numbered), catchwords, snippet.
 *
 * GET /api/cases/:id
 *   Full case record: all metadata, all accepted headnotes, all catchwords,
 *   judgment paragraphs. Rate-limited to 200 reads/identity/day.
 *
 * Only cases where:
 *   - Container rights_status ∈ DISPLAY_SAFE_RIGHTS
 *   - Container processing_state = 'SEARCHABLE'
 *   - At least one headnote with status = 'accepted'
 * are returned.
 */

import { Router } from "express";
import { z } from "zod/v4";
import {
  db,
  researchCaseMetadata,
  researchCatchwords,
  researchHeadnotes,
  researchPageExtractions,
  researchSearchIndex,
  researchSourceContainers,
  researchSourcePages,
  researchVerifiedJudgments,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { PortalAuthIdentity } from "../middlewares/requireAnyPortalAuth";
import {
  buildCaseReportExport,
  type CaseReportExportFormat,
  type PublicCaseReport,
} from "../lib/caseReportExport";
import {
  latestRightsJoin,
  liveRightsPredicate,
  type LiveRightsAction,
} from "../research/editorial/liveRights";

const router = Router();

// ── Server-side practice-area scoping ────────────────────────────────────────
// Each portal identity type is locked to its practice area — derived from
// req.portalAuth, never from the client. A caller cannot widen or switch its
// scope by tampering with the practiceArea query parameter.
//   lit  → civil_procedure (MyLitAI + MyLitAI IRAC share lit sessions)
//   crim → criminal, corp → corporate, ccb → banking, accident → accident
//   convey → conveyancing, sya → syariah (empty until matching Drive content
//   is ingested — locked anyway, since client filtering is not authorization)
// Unrestricted: master (admin override) and acad (academy, not a practice
// portal) — these may pass an optional practiceArea filter explicitly.
const PORTAL_PRACTICE_AREA: Partial<Record<PortalAuthIdentity["type"], string>> = {
  lit: "civil_procedure",
  crim: "criminal",
  corp: "corporate",
  ccb: "banking",
  accident: "accident",
  convey: "conveyancing",
  sya: "syariah",
};

/** Resolve the effective practice-area filter for this request. */
function effectivePracticeArea(
  identity: PortalAuthIdentity,
  requested: string | undefined,
): string | undefined {
  const enforced = PORTAL_PRACTICE_AREA[identity.type];
  if (enforced) return enforced; // locked — ignore whatever the client sent
  return requested; // unrestricted identities may filter voluntarily
}

// Rights statuses that allow display to portal subscribers.
const DISPLAY_SAFE_RIGHTS = [
  "OFFICIAL_COURT_SOURCE",
  "PUBLIC_OR_OPEN_LICENCE_SOURCE",
  "USER_OWNED_OR_AUTHORISED",
] as const;

// ── Rate limiter: max 200 case detail reads per identity per calendar day ───
// In-memory — resets on restart; not used for billing so that is acceptable.
const DAILY_LIMIT = 200;
const rateLimitMap = new Map<string, { date: string; count: number }>();

function checkRateLimit(identity: PortalAuthIdentity): {
  allowed: boolean;
  remaining: number;
} {
  if (identity.type === "master") return { allowed: true, remaining: Infinity };
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const key = identity.identityKey;
  const entry = rateLimitMap.get(key);
  if (!entry || entry.date !== today) {
    rateLimitMap.set(key, { date: today, count: 1 });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }
  if (entry.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  entry.count++;
  return { allowed: true, remaining: DAILY_LIMIT - entry.count };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Filter an array of judgment IDs to those that are approved and headnoted. */
async function getApprovedIds(candidateIds: number[]): Promise<number[]> {
  if (candidateIds.length === 0) return [];
  const placeholders = candidateIds.join(",");
  const result = await db.execute(sql`
    SELECT DISTINCT rvj.id
    FROM research_verified_judgments rvj
    JOIN research_source_containers rsc ON rsc.id = rvj.container_id
    JOIN research_lawyes_reports lr ON lr.judgment_id = rvj.id
    ${latestRightsJoin("rvj.container_id")}
    WHERE rvj.id IN (${sql.raw(placeholders)})
      AND lr.state = 'Published'
      AND lr.lawyer_reviewed_at IS NOT NULL
      AND lr.published_at IS NOT NULL
      AND rsc.processing_state = 'SEARCHABLE'
      ${liveRightsPredicate("display")}
  `);
  return (result.rows as Array<{ id: number }>).map((r) => r.id);
}

/** Resolve the "latest value" metadata map for multiple judgments in one query. */
async function buildMetaMaps(
  judgmentIds: number[],
): Promise<Map<number, Map<string, unknown>>> {
  const rows = await db
    .select()
    .from(researchCaseMetadata)
    .where(inArray(researchCaseMetadata.judgmentId, judgmentIds))
    .orderBy(desc(researchCaseMetadata.id)); // newest first

  const maps = new Map<number, Map<string, unknown>>();
  // Iterate newest-first so first write wins (= latest value).
  for (const row of rows) {
    if (!maps.has(row.judgmentId)) maps.set(row.judgmentId, new Map());
    const m = maps.get(row.judgmentId)!;
    if (!m.has(row.fieldName) && row.value !== null) {
      m.set(row.fieldName, row.value);
    }
  }
  return maps;
}

/** Coerce a metadata value to string (handles arrays). */
function metaStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

interface SearchResultItem {
  id: number;
  citation: string | null;
  caseName: string | null;
  court: string | null;
  decisionDate: string | null;
  parties: string | null;
  headnotes: Array<{ number: number; text: string; paragraphRef: string | null }>;
  catchwords: Array<{ sortOrder: number; catchwordLine: string }>;
  snippet: string | null;
  practiceArea: string | null;
  language: string | null;
  reportState: "Published";
  rightsStatus: string;
}

/** Enrich a list of judgment IDs with metadata, headnotes, catchwords, snippet. */
async function enrichForSearch(ids: number[]): Promise<SearchResultItem[]> {
  if (ids.length === 0) return [];
  // Re-check immediately before materialising content.  Search selection and
  // enrichment are separate queries, so this closes a rights-change race.
  ids = await getApprovedIds(ids);
  if (ids.length === 0) return [];

  const idList = ids.join(",");
  const [metaMaps, headnoteRows, catchwordRows, indexRows, reportResult] = await Promise.all([
    buildMetaMaps(ids),
    db
      .select()
      .from(researchHeadnotes)
      .where(
        and(
          inArray(researchHeadnotes.judgmentId, ids),
          eq(researchHeadnotes.status, "accepted"),
        ),
      )
      .orderBy(asc(researchHeadnotes.number)),
    db
      .select()
      .from(researchCatchwords)
      .where(
        and(
          inArray(researchCatchwords.judgmentId, ids),
          eq(researchCatchwords.status, "accepted"),
        ),
      )
      .orderBy(asc(researchCatchwords.sortOrder)),
    db
      .select({
        judgmentId: researchSearchIndex.judgmentId,
        documentText: researchSearchIndex.documentText,
        court: researchSearchIndex.court,
        decisionDate: researchSearchIndex.decisionDate,
        practiceArea: researchSearchIndex.practiceArea,
        language: researchSearchIndex.language,
        containerId: researchSearchIndex.containerId,
      })
      .from(researchSearchIndex)
      .where(inArray(researchSearchIndex.judgmentId, ids)),
    db.execute(sql`
      SELECT judgment_id, title, neutral_citation, report_citation, court,
        decision_date, catchwords, practice_tags, outcome
      FROM research_lawyes_reports
      WHERE judgment_id IN (${sql.raw(idList)}) AND state = 'Published'
        AND lawyer_reviewed_at IS NOT NULL AND published_at IS NOT NULL
    `),
  ]);

  const hnByJudgment = new Map<number, typeof headnoteRows>();
  for (const h of headnoteRows) {
    if (!hnByJudgment.has(h.judgmentId)) hnByJudgment.set(h.judgmentId, []);
    hnByJudgment.get(h.judgmentId)!.push(h);
  }

  const cwByJudgment = new Map<number, typeof catchwordRows>();
  for (const c of catchwordRows) {
    if (!cwByJudgment.has(c.judgmentId)) cwByJudgment.set(c.judgmentId, []);
    cwByJudgment.get(c.judgmentId)!.push(c);
  }

  const indexByJudgment = new Map<number, (typeof indexRows)[number]>();
  for (const si of indexRows) indexByJudgment.set(si.judgmentId, si);
  const reportByJudgment = new Map<number, Record<string, unknown>>();
  for (const row of reportResult.rows) {
    const report = row as Record<string, unknown>;
    reportByJudgment.set(Number(report.judgment_id), report);
  }

  const containerIds = [...new Set(indexRows.map((row) => row.containerId))];
  const containers = containerIds.length
    ? await db
        .select({ id: researchSourceContainers.id, rightsStatus: researchSourceContainers.rightsStatus })
        .from(researchSourceContainers)
        .where(inArray(researchSourceContainers.id, containerIds))
    : [];
  const rightsByContainer = new Map(containers.map((row) => [row.id, row.rightsStatus]));

  return ids.map((id) => {
    const meta = metaMaps.get(id) ?? new Map<string, unknown>();
    const si = indexByJudgment.get(id);
    const report = reportByJudgment.get(id);
    // Put accepted editorial summaries first in the preview. They are
    // appended to the indexed document, but a judicial document can be long
    // enough that a simple first-500-character slice would hide them.
    const acceptedPreview = [
      ...(cwByJudgment.get(id) ?? []).map((c) => c.catchwordLine),
      ...(hnByJudgment.get(id) ?? []).map((h) => h.text),
    ].join("\n");
    const judicialPreview = si?.documentText ?? "";
    const snippetSource = acceptedPreview
      ? `${acceptedPreview}\n\n${judicialPreview}`
      : judicialPreview;
    const snippet = snippetSource
      ? snippetSource.slice(0, 500).trimEnd() + (snippetSource.length > 500 ? "…" : "")
      : null;

    return {
      id,
      citation:
        metaStr(report?.report_citation) ??
        metaStr(report?.neutral_citation) ??
        metaStr(meta.get("reportCitation")) ??
        metaStr(meta.get("neutralCitation")),
      caseName: metaStr(report?.title) ?? metaStr(meta.get("caseName")),
      court: metaStr(report?.court) ?? metaStr(meta.get("court")) ?? si?.court ?? null,
      decisionDate:
        metaStr(report?.decision_date) ??
        metaStr(meta.get("decisionDate")) ??
        (si?.decisionDate ? si.decisionDate.toISOString() : null),
      parties: metaStr(meta.get("parties")),
      headnotes: (hnByJudgment.get(id) ?? []).map((h) => ({
        number: h.number,
        text: h.text,
        paragraphRef: h.paragraphRef ?? null,
      })),
      catchwords: Array.isArray(report?.catchwords)
        ? (report.catchwords as unknown[][]).map((parts, index) => ({ sortOrder: index, catchwordLine: parts.map(String).join(" — ") }))
        : (cwByJudgment.get(id) ?? []).map((c) => ({ sortOrder: c.sortOrder, catchwordLine: c.catchwordLine })),
      snippet,
      practiceArea: si?.practiceArea ?? null,
      language: si?.language ?? null,
      reportState: "Published",
      rightsStatus: si ? (rightsByContainer.get(si.containerId) ?? "UNREVIEWED") : "UNREVIEWED",
    };
  });
}

/**
 * Full-text search with date-ordered results, incorporating all visibility gates.
 * Used when `q` is provided and `sort=date`.
 * Queries the complete approved FTS result set (not capped to 200) and paginates by date.
 */
async function ftsSearchApprovedByDate(opts: {
  q: string;
  court?: string;
  practiceArea?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit: number;
  offset: number;
  dir: "asc" | "desc";
  dictionary: "english" | "simple";
}): Promise<{ total: number; ids: number[] }> {
  const dict = opts.dictionary === "simple" ? "simple" : "english";
  const tsCol = opts.dictionary === "simple" ? "document_ms" : "document";
  const direction = opts.dir === "asc" ? sql`ASC` : sql`DESC`;

  const courtFilter = opts.court
    ? sql`AND si.court ILIKE ${`%${opts.court}%`}`
    : sql``;
  const dateFromFilter = opts.dateFrom
    ? sql`AND si.decision_date >= ${opts.dateFrom}`
    : sql``;
  const dateToFilter = opts.dateTo
    ? sql`AND si.decision_date <= ${opts.dateTo}`
    : sql``;
  const practiceAreaFilter = opts.practiceArea
    ? sql`AND si.practice_area = ${opts.practiceArea}`
    : sql``;

  const [countResult, rowsResult] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(DISTINCT rvj.id)::int AS total
      FROM research_search_index si
      JOIN research_verified_judgments rvj ON rvj.id = si.judgment_id
      JOIN research_source_containers rsc ON rsc.id = rvj.container_id
      JOIN research_headnotes rh ON rh.judgment_id = rvj.id
      ${latestRightsJoin("rvj.container_id")}
      WHERE si.${sql.raw(tsCol)} @@ websearch_to_tsquery(${dict}, ${opts.q})
        AND rh.status = 'accepted'
        AND rsc.processing_state = 'SEARCHABLE'
        ${liveRightsPredicate("display")}
        ${courtFilter}
        ${dateFromFilter}
        ${dateToFilter}
        ${practiceAreaFilter}
    `),
    db.execute(sql`
      SELECT id FROM (
        SELECT DISTINCT ON (rvj.id) rvj.id, si.decision_date
        FROM research_search_index si
        JOIN research_verified_judgments rvj ON rvj.id = si.judgment_id
        JOIN research_source_containers rsc ON rsc.id = rvj.container_id
        JOIN research_headnotes rh ON rh.judgment_id = rvj.id
        ${latestRightsJoin("rvj.container_id")}
        WHERE si.${sql.raw(tsCol)} @@ websearch_to_tsquery(${dict}, ${opts.q})
          AND rh.status = 'accepted'
          AND rsc.processing_state = 'SEARCHABLE'
          ${liveRightsPredicate("display")}
          ${courtFilter}
          ${dateFromFilter}
          ${dateToFilter}
          ${practiceAreaFilter}
        ORDER BY rvj.id, si.decision_date DESC NULLS LAST
      ) sub
      ORDER BY decision_date ${direction} NULLS LAST
      LIMIT ${opts.limit} OFFSET ${opts.offset}
    `),
  ]);

  const total = (countResult.rows[0] as { total: number } | undefined)?.total ?? 0;
  const ids = (rowsResult.rows as Array<{ id: number }>).map((r) => r.id);
  return { total, ids };
}

/**
 * Browse approved+headnoted judgments without FTS.
 * Used when no `q` is provided.
 */
async function browseApproved(opts: {
  court?: string;
  practiceArea?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit: number;
  offset: number;
  dir?: "asc" | "desc";
}): Promise<{ total: number; ids: number[] }> {
  const courtFilter = opts.court
    ? sql`AND si.court ILIKE ${`%${opts.court}%`}`
    : sql``;
  const dateFromFilter = opts.dateFrom
    ? sql`AND si.decision_date >= ${opts.dateFrom}`
    : sql``;
  const dateToFilter = opts.dateTo
    ? sql`AND si.decision_date <= ${opts.dateTo}`
    : sql``;
  const practiceAreaFilter = opts.practiceArea
    ? sql`AND si.practice_area = ${opts.practiceArea}`
    : sql``;

  const direction = opts.dir === "asc" ? sql`ASC` : sql`DESC`;

  const [countResult, rowsResult] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(DISTINCT rvj.id)::int AS total
      FROM research_verified_judgments rvj
      JOIN research_source_containers rsc ON rsc.id = rvj.container_id
      JOIN research_search_index si ON si.judgment_id = rvj.id
      JOIN research_headnotes rh ON rh.judgment_id = rvj.id
      ${latestRightsJoin("rvj.container_id")}
      WHERE rh.status = 'accepted'
        AND rsc.processing_state = 'SEARCHABLE'
        ${liveRightsPredicate("display")}
        ${courtFilter}
        ${dateFromFilter}
        ${dateToFilter}
        ${practiceAreaFilter}
    `),
    db.execute(sql`
      SELECT id FROM (
        SELECT DISTINCT ON (rvj.id) rvj.id, si.decision_date
        FROM research_verified_judgments rvj
        JOIN research_source_containers rsc ON rsc.id = rvj.container_id
        JOIN research_search_index si ON si.judgment_id = rvj.id
        JOIN research_headnotes rh ON rh.judgment_id = rvj.id
        ${latestRightsJoin("rvj.container_id")}
        WHERE rh.status = 'accepted'
          AND rsc.processing_state = 'SEARCHABLE'
          ${liveRightsPredicate("display")}
          ${courtFilter}
          ${dateFromFilter}
          ${dateToFilter}
          ${practiceAreaFilter}
        ORDER BY rvj.id, si.decision_date DESC NULLS LAST
      ) sub
      ORDER BY decision_date ${direction} NULLS LAST
      LIMIT ${opts.limit + opts.offset}
    `),
  ]);

  const total = (countResult.rows[0] as { total: number } | undefined)?.total ?? 0;
  // Apply offset in JS (DISTINCT ON prevents clean OFFSET in SQL here)
  const allIds = (rowsResult.rows as Array<{ id: number }>).map((r) => r.id);
  const ids = allIds.slice(opts.offset, opts.offset + opts.limit);

  return { total, ids };
}

type MetadataFilters = Partial<Record<
  "caseName" | "citation" | "party" | "judge" | "counsel" | "registry" |
  "legislation" | "outcome" | "treatment" | "catchword",
  string
>>;

/** Complete, SQL-paginated subscriber search. Every predicate is applied
 * before pagination and the immutable publication/rights gates are part of
 * the same query, preventing count, facet, or result leakage. */
async function searchPublished(opts: {
  q?: string;
  court?: string;
  practiceArea?: string;
  language?: string;
  dateFrom?: Date;
  dateTo?: Date;
  rights?: typeof DISPLAY_SAFE_RIGHTS[number];
  filters: MetadataFilters;
  limit: number;
  offset: number;
  sort: "relevance" | "date" | "title";
  dir: "asc" | "desc";
  dictionary: "english" | "simple";
  rightsAction?: LiveRightsAction;
}): Promise<{ total: number; ids: number[] }> {
  const tsColumn = opts.dictionary === "simple" ? "document_ms" : "document";
  const dictionary = opts.dictionary;
  const qFilter = opts.q
    ? sql`AND (
        si.${sql.raw(tsColumn)} @@ websearch_to_tsquery(${dictionary}, ${opts.q})
        OR concat_ws(' ', lr.title, lr.neutral_citation, lr.report_citation,
          lr.case_number, lr.court, lr.registry, lr.outcome,
          lr.catchwords::text, lr.practice_tags::text) ILIKE ${`%${opts.q}%`}
      )`
    : sql``;
  const simple = (fragment: ReturnType<typeof sql>) => fragment;
  const courtFilter = opts.court ? simple(sql`AND si.court ILIKE ${`%${opts.court}%`}`) : sql``;
  const areaFilter = opts.practiceArea ? simple(sql`AND si.practice_area = ${opts.practiceArea}`) : sql``;
  const languageFilter = opts.language ? simple(sql`AND si.language ILIKE ${opts.language}`) : sql``;
  const dateFromFilter = opts.dateFrom ? simple(sql`AND si.decision_date >= ${opts.dateFrom}`) : sql``;
  const dateToFilter = opts.dateTo ? simple(sql`AND si.decision_date <= ${opts.dateTo}`) : sql``;
  const rightsFilter = opts.rights ? simple(sql`AND rsc.rights_status = ${opts.rights}`) : sql``;
  const reportFilters = sql.join([
    opts.filters.caseName ? sql`AND lr.title ILIKE ${`%${opts.filters.caseName}%`}` : sql``,
    opts.filters.citation ? sql`AND concat_ws(' ', lr.neutral_citation, lr.report_citation, lr.case_number) ILIKE ${`%${opts.filters.citation}%`}` : sql``,
    opts.filters.judge ? sql`AND lr.coram::text ILIKE ${`%${opts.filters.judge}%`}` : sql``,
    opts.filters.counsel ? sql`AND lr.counsel::text ILIKE ${`%${opts.filters.counsel}%`}` : sql``,
    opts.filters.registry ? sql`AND lr.registry ILIKE ${`%${opts.filters.registry}%`}` : sql``,
    opts.filters.outcome ? sql`AND lr.outcome ILIKE ${`%${opts.filters.outcome}%`}` : sql``,
    opts.filters.catchword ? sql`AND lr.catchwords::text ILIKE ${`%${opts.filters.catchword}%`}` : sql``,
  ], sql` `);

  const metadataField = (fieldNames: string[], value: string | undefined) => value
    ? sql`AND EXISTS (
        SELECT 1 FROM research_case_metadata mf
        WHERE mf.judgment_id = rvj.id
          AND mf.field_name IN (${sql.join(fieldNames.map((field) => sql`${field}`), sql`, `)})
          AND mf.reviewer_status <> 'rejected'
          AND mf.value::text ILIKE ${`%${value}%`}
      )`
    : sql``;
  const metadataFilters = sql.join([
    metadataField(["parties"], opts.filters.party),
    metadataField(["legislation"], opts.filters.legislation),
    metadataField(["judicialTreatment", "treatment", "casesReferred"], opts.filters.treatment),
  ], sql` `);
  const rank = opts.q
    ? sql`ts_rank_cd(si.${sql.raw(tsColumn)}, websearch_to_tsquery(${dictionary}, ${opts.q}))`
    : sql`0`;
  const direction = opts.dir === "asc" ? sql`ASC` : sql`DESC`;
  const order = opts.sort === "title"
    ? sql`case_title ${direction} NULLS LAST, id ASC`
    : opts.sort === "date" || !opts.q
      ? sql`decision_date ${direction} NULLS LAST, id ASC`
      : sql`rank DESC, decision_date DESC NULLS LAST, id ASC`;

  const eligible = sql`
    FROM research_search_index si
    JOIN research_verified_judgments rvj ON rvj.id = si.judgment_id
    JOIN research_source_containers rsc ON rsc.id = rvj.container_id
    JOIN research_lawyes_reports lr ON lr.judgment_id = rvj.id
    ${latestRightsJoin("rvj.container_id")}
    WHERE rsc.processing_state = 'SEARCHABLE'
      ${liveRightsPredicate(opts.rightsAction ?? "display")}
      AND lr.state = 'Published'
      AND lr.lawyer_reviewed_at IS NOT NULL
      AND lr.published_at IS NOT NULL
      ${qFilter} ${courtFilter} ${areaFilter} ${languageFilter}
      ${dateFromFilter} ${dateToFilter} ${rightsFilter}
      ${reportFilters} ${metadataFilters}
  `;

  const [countResult, rowsResult] = await Promise.all([
    db.execute(sql`SELECT COUNT(DISTINCT rvj.id)::int AS total ${eligible}`),
    db.execute(sql`
      SELECT rvj.id AS id, si.decision_date AS decision_date, ${rank} AS rank,
        lr.title AS case_title
      ${eligible}
      ORDER BY ${order}
      LIMIT ${opts.limit} OFFSET ${opts.offset}
    `),
  ]);
  return {
    total: Number((countResult.rows[0] as { total?: number } | undefined)?.total ?? 0),
    ids: (rowsResult.rows as Array<{ id: number }>).map((row) => Number(row.id)),
  };
}

/**
 * Return ordered paragraphs for a judgment (mirrors viewer.ts logic).
 */
async function getJudgmentParagraphs(
  judgment: { pageRefs: number[] },
): Promise<Array<{ paragraphRef: string; pageNumber: number; text: string }>> {
  const pageIds = judgment.pageRefs ?? [];
  if (pageIds.length === 0) return [];

  const [sourcePages, extractions] = await Promise.all([
    db
      .select()
      .from(researchSourcePages)
      .where(inArray(researchSourcePages.id, pageIds)),
    db
      .select()
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, pageIds))
      .orderBy(desc(researchPageExtractions.id)),
  ]);

  const latestByPage = new Map<number, string>();
  for (const ex of extractions) {
    if (!latestByPage.has(ex.pageId) && ex.rawText) {
      latestByPage.set(ex.pageId, ex.rawText);
    }
  }

  const paragraphs: Array<{ paragraphRef: string; pageNumber: number; text: string }> = [];
  const orderedPages = [...sourcePages].sort((a, b) => a.pageNumber - b.pageNumber);
  let paraIndex = 0;

  for (const page of orderedPages) {
    const text = latestByPage.get(page.id) ?? "";
    const chunks = text
      .split(/(?=\[\d+\])|(?:\n\n+)/g)
      .filter((t) => t.trim().length > 0);
    for (const chunk of chunks) {
      const markerMatch = chunk.match(/^\[(\d+)\]/);
      const ref = markerMatch ? `[${markerMatch[1]}]` : `para-${++paraIndex}`;
      paragraphs.push({
        paragraphRef: ref,
        pageNumber: page.pageNumber,
        text: chunk.trim(),
      });
    }
  }

  return paragraphs;
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

async function loadCaseDetail(id: number) {
  const [judgmentRows, metaMaps, headnoteRows, catchwordRows, containerRows, reportRows, reportParagraphRows] =
    await Promise.all([
      db.select().from(researchVerifiedJudgments).where(eq(researchVerifiedJudgments.id, id)).limit(1),
      buildMetaMaps([id]),
      db.select().from(researchHeadnotes).where(and(
        eq(researchHeadnotes.judgmentId, id),
        eq(researchHeadnotes.status, "accepted"),
      )).orderBy(asc(researchHeadnotes.number)),
      db.select().from(researchCatchwords).where(and(
        eq(researchCatchwords.judgmentId, id),
        eq(researchCatchwords.status, "accepted"),
      )).orderBy(asc(researchCatchwords.sortOrder)),
      db.execute(sql`
        SELECT rsc.*
        FROM research_source_containers rsc
        JOIN research_verified_judgments rvj ON rvj.container_id = rsc.id
        WHERE rvj.id = ${id} LIMIT 1
      `),
      db.execute(sql`
        SELECT lr.*, ls.id AS section_id, ls.kind AS section_kind,
          ls.heading AS section_heading, ls.body AS section_body,
          ls.sort_order AS section_sort_order,
          COALESCE(json_agg(json_build_object(
            'text', lp.proposition,
            'pinpoints', COALESCE((
              SELECT json_agg(lpar.paragraph_key ORDER BY lpar.ordinal)
              FROM research_lawyes_proposition_pinpoints lpp
              JOIN research_lawyes_paragraphs lpar ON lpar.id = lpp.paragraph_id
              WHERE lpp.proposition_id = lp.id
            ), '[]'::json)
          )) FILTER (WHERE lp.id IS NOT NULL), '[]'::json) AS propositions
        FROM research_lawyes_reports lr
        LEFT JOIN research_lawyes_sections ls ON ls.report_id = lr.id
        LEFT JOIN research_lawyes_propositions lp ON lp.section_id = ls.id
        WHERE lr.judgment_id = ${id} AND lr.state = 'Published'
          AND lr.lawyer_reviewed_at IS NOT NULL AND lr.published_at IS NOT NULL
        GROUP BY lr.id, ls.id
        ORDER BY ls.sort_order
      `),
      db.execute(sql`
        SELECT lp.paragraph_key, lp.source_page, lp.text
        FROM research_lawyes_paragraphs lp
        JOIN research_lawyes_reports lr ON lr.id = lp.report_id
        WHERE lr.judgment_id = ${id} AND lr.state = 'Published'
        ORDER BY lp.ordinal
      `),
    ]);
  const judgment = judgmentRows[0];
  if (!judgment) return null;
  const meta = metaMaps.get(id) ?? new Map<string, unknown>();
  const container = containerRows.rows[0] as {
    original_name?: string;
    rights_status?: string;
    content_sha256?: string;
    provenance?: Record<string, unknown>;
  } | undefined;
  const publishedReport = reportRows.rows[0] as Record<string, unknown> | undefined;
  if (!publishedReport) return null;
  const sourceProvenance = container?.provenance ?? {};
  const sourceUrl = [
    publishedReport.source_url,
    sourceProvenance.sourceUrl,
    sourceProvenance.source_url,
    sourceProvenance.url,
    sourceProvenance.originalUrl,
  ].map(safeHttpUrl).find(Boolean) ?? null;
  const paragraphs = reportParagraphRows.rows.length
    ? reportParagraphRows.rows.map((row) => {
        const p = row as { paragraph_key: string; source_page: number | null; text: string };
        return { paragraphRef: p.paragraph_key, pageNumber: p.source_page ?? 0, text: p.text };
      })
    : await getJudgmentParagraphs(judgment);
  const stringOrMissing = (...keys: string[]) =>
    keys.map((key) => metaStr(meta.get(key))).find((value) => value) ??
    "Not stated in the published judgment";
  const metaValue = (...keys: string[]) =>
    keys.map((key) => metaStr(meta.get(key))).find((value) => value) ?? null;
  const arrayValue = (...keys: string[]): string[] => {
    for (const key of keys) {
      const value = meta.get(key);
      if (Array.isArray(value)) return value.map(String);
      if (typeof value === "string" && value.trim()) return [value];
    }
    return ["Not stated in the published judgment"];
  };
  const citation = metaStr(publishedReport.report_citation) ?? metaStr(publishedReport.neutral_citation) ?? metaValue("reportCitation", "neutralCitation");
  const caseName = metaStr(publishedReport.title) ?? metaValue("caseName");
  const court = metaStr(publishedReport.court) ?? metaValue("court");
  const decisionDate = metaStr(publishedReport.decision_date) ?? metaValue("decisionDate");
  const verificationDate = new Date(String(publishedReport.source_verified_at ?? judgment.verifiedAt)).toISOString();
  const headnotes = headnoteRows.map((h) => ({
    number: h.number,
    text: h.text,
    paragraphRef: h.paragraphRef ?? null,
  }));
  const editorialSections = reportRows.rows
    .filter((row) => (row as { section_id?: number }).section_id)
    .map((row) => {
      const section = row as {
        section_kind: string;
        section_heading: string;
        section_body: string;
        propositions: Array<{ text: string; pinpoints: string[] }> | string;
      };
      const propositions = typeof section.propositions === "string"
        ? JSON.parse(section.propositions) as Array<{ text: string; pinpoints: string[] }>
        : section.propositions;
      return {
        id: section.section_kind.replace(/_/g, "-"),
        title: section.section_heading,
        content: propositions.length ? propositions.map((item) => item.text) : (section.section_body || "Not stated in the published judgment"),
        pinpoints: propositions.flatMap((item) => item.pinpoints.slice(0, 1)),
      };
    });
  const structuredReport = {
    status: "Published" as const,
    verificationDate,
    revision: Number(publishedReport.current_revision ?? 1),
    sections: editorialSections.length ? editorialSections : [
      { id: "catchwords", title: "Catchwords", content: catchwordRows.length ? catchwordRows.map((c) => c.catchwordLine) : ["Not stated in the published judgment"] },
      { id: "headnote", title: "Original Headnote", content: headnotes.length ? headnotes.map((h) => h.text) : ["Not stated in the published judgment"], pinpoints: headnotes.map((h) => h.paragraphRef ?? "") },
      { id: "facts", title: "Facts", content: arrayValue("facts", "materialFacts"), pinpoints: arrayValue("factsParagraphRefs") },
      { id: "procedural-history", title: "Procedural History", content: arrayValue("proceduralHistory", "proceduralPosture"), pinpoints: arrayValue("proceduralHistoryParagraphRefs") },
      { id: "issues", title: "Issues", content: arrayValue("issues"), pinpoints: arrayValue("issueParagraphRefs") },
      { id: "holdings", title: "Issue-by-issue Holdings", content: arrayValue("holdings"), pinpoints: arrayValue("holdingParagraphRefs") },
      { id: "ratio", title: "Ratio Decidendi", content: arrayValue("ratio"), pinpoints: arrayValue("ratioParagraphRefs") },
      { id: "obiter", title: "Obiter Dicta", content: arrayValue("obiter"), pinpoints: arrayValue("obiterParagraphRefs") },
      { id: "orders", title: "Orders, Relief and Costs", content: arrayValue("orders", "relief", "costs"), pinpoints: arrayValue("ordersParagraphRefs") },
      { id: "legislation", title: "Legislation", content: arrayValue("legislation") },
      { id: "authorities", title: "Authorities and Treatment", content: arrayValue("casesReferred", "authorities", "judicialTreatment") },
      { id: "practice", title: "Practice Tags", content: arrayValue("practiceTags", "practiceArea") },
    ],
  };
  return {
    id,
    citation,
    caseName,
    court,
    registry: stringOrMissing("registry"),
    proceedingNumber: stringOrMissing("proceedingNumber"),
    decisionDate,
    hearingDate: stringOrMissing("hearingDate"),
    parties: stringOrMissing("parties"),
    coram: Array.isArray(publishedReport.coram) && publishedReport.coram.length ? publishedReport.coram.join(", ") : stringOrMissing("coram", "judges"),
    advocates: Array.isArray(publishedReport.counsel) && publishedReport.counsel.length ? publishedReport.counsel.join(", ") : stringOrMissing("advocates", "counsel"),
    judges: Array.isArray(publishedReport.coram) && publishedReport.coram.length ? publishedReport.coram.join(", ") : stringOrMissing("judges", "coram"),
    legislation: meta.get("legislation") ?? null,
    casesReferred: meta.get("casesReferred") ?? null,
    headnotes,
    catchwords: Array.isArray(publishedReport.catchwords) && publishedReport.catchwords.length
      ? (publishedReport.catchwords as unknown[][]).map((parts, index) => ({ sortOrder: index, catchwordLine: parts.map(String).join(" — ") }))
      : catchwordRows.map((c) => ({ sortOrder: c.sortOrder, catchwordLine: c.catchwordLine })),
    paragraphs,
    structuredReport,
    provenance: {
      sourceName: container?.original_name ?? "Verified judgment source",
      sourceUrl,
      checksum: container?.content_sha256 ?? judgment.textChecksum,
      rightsStatus: container?.rights_status ?? "UNREVIEWED",
      verifiedBy: judgment.verifiedBy,
      verifiedAt: verificationDate,
      editorialOwnership: `LAWYes original editorial content · revision ${Number(publishedReport.current_revision ?? 1)}`,
    },
    metadata: Object.fromEntries(meta.entries()),
  };
}

function asPublicReport(detail: NonNullable<Awaited<ReturnType<typeof loadCaseDetail>>>): PublicCaseReport {
  return {
    id: detail.id,
    caseName: detail.caseName ?? `Judgment ${detail.id}`,
    citation: detail.citation ?? `LAWYes ${detail.id}`,
    court: detail.court ?? "Court not stated",
    decisionDate: detail.decisionDate ?? "Decision date not stated",
    reportState: "Published",
    verificationDate: detail.structuredReport.verificationDate,
    rightsStatus: detail.provenance.rightsStatus,
    sourceUrl: detail.provenance.sourceUrl,
    sourceName: detail.provenance.sourceName,
    sections: detail.structuredReport.sections,
    paragraphs: detail.paragraphs,
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500).optional(),
  court: z.string().max(200).optional(),
  practiceArea: z.string().max(50).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  caseName: z.string().max(300).optional(),
  citation: z.string().max(200).optional(),
  party: z.string().max(300).optional(),
  judge: z.string().max(200).optional(),
  counsel: z.string().max(200).optional(),
  registry: z.string().max(200).optional(),
  legislation: z.string().max(300).optional(),
  outcome: z.string().max(200).optional(),
  treatment: z.string().max(200).optional(),
  catchword: z.string().max(200).optional(),
  language: z.string().max(20).optional(),
  rights: z.enum(DISPLAY_SAFE_RIGHTS).optional(),
  reportState: z.enum(["Published"]).default("Published"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["relevance", "date", "title"]).default("relevance"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  lang: z.enum(["en", "ms"]).default("en"),
});

/**
 * GET /api/cases/search
 * Full-text search or browse across approved, headnoted cases.
 */
router.get("/search", async (req, res) => {
  const parsed = SearchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res
      .status(400)
      .json({ error: "Invalid query parameters", detail: z.treeifyError(parsed.error) });
    return;
  }

  const { q, court, dateFrom, dateTo, limit, offset, sort, dir, lang } = parsed.data;
  const practiceArea = effectivePracticeArea(req.portalAuth!, parsed.data.practiceArea);

  const dateFromDate = dateFrom ? new Date(dateFrom) : undefined;
  const dateToDate = dateTo ? new Date(dateTo) : undefined;

  const searched = await searchPublished({
    q,
    court,
    practiceArea,
    language: parsed.data.language,
    dateFrom: dateFromDate && !isNaN(dateFromDate.getTime()) ? dateFromDate : undefined,
    dateTo: dateToDate && !isNaN(dateToDate.getTime()) ? dateToDate : undefined,
    rights: parsed.data.rights,
    filters: {
      caseName: parsed.data.caseName,
      citation: parsed.data.citation,
      party: parsed.data.party,
      judge: parsed.data.judge,
      counsel: parsed.data.counsel,
      registry: parsed.data.registry,
      legislation: parsed.data.legislation,
      outcome: parsed.data.outcome,
      treatment: parsed.data.treatment,
      catchword: parsed.data.catchword,
    },
    limit,
    offset,
    sort,
    dir,
    dictionary: lang === "ms" ? "simple" : "english",
  });
  const total = searched.total;
  const judgmentIds = searched.ids;

  const results = await enrichForSearch(judgmentIds);
  const count = (key: "court" | "practiceArea" | "language" | "rightsStatus") =>
    Object.entries(results.reduce<Record<string, number>>((all, item) => {
      const value = item[key];
      if (value) all[value] = (all[value] ?? 0) + 1;
      return all;
    }, {})).map(([value, resultCount]) => ({ value, count: resultCount }));
  res.json({
    total,
    limit,
    offset,
    results,
    facets: {
      courts: count("court"),
      practiceAreas: count("practiceArea"),
      languages: count("language"),
      rights: count("rightsStatus"),
    },
    publicationGate: "Published",
  });
});

router.get("/search/export.csv", async (req, res) => {
  const parsed = SearchQuerySchema.omit({ limit: true, offset: true }).safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid query parameters", detail: z.treeifyError(parsed.error) });
    return;
  }
  const input = parsed.data;
  const from = input.dateFrom ? new Date(input.dateFrom) : undefined;
  const to = input.dateTo ? new Date(input.dateTo) : undefined;
  const searched = await searchPublished({
    q: input.q,
    court: input.court,
    practiceArea: effectivePracticeArea(req.portalAuth!, input.practiceArea),
    language: input.language,
    dateFrom: from && !isNaN(from.getTime()) ? from : undefined,
    dateTo: to && !isNaN(to.getTime()) ? to : undefined,
    rights: input.rights,
    filters: {
      caseName: input.caseName, citation: input.citation, party: input.party,
      judge: input.judge, counsel: input.counsel, registry: input.registry,
      legislation: input.legislation, outcome: input.outcome,
      treatment: input.treatment, catchword: input.catchword,
    },
    limit: 1_000,
    offset: 0,
    sort: input.sort,
    dir: input.dir,
    dictionary: input.lang === "ms" ? "simple" : "english",
    rightsAction: "export",
  });
  const items = await enrichForSearch(searched.ids);
  const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""').replace(/[\r\n]+/g, " ")}"`;
  const rows = [
    ["LAWYes ID", "Case name", "Citation", "Court", "Decision date", "Practice area", "Language", "Report state", "Rights status", "Catchwords"],
    ...items.map((item) => [
      item.id, item.caseName, item.citation, item.court, item.decisionDate,
      item.practiceArea, item.language, item.reportState, item.rightsStatus,
      item.catchwords.map((word) => word.catchwordLine).join(" | "),
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="LAWYes-judgment-library-results.csv"',
    "X-Export-Result-Count": String(items.length),
    "X-Export-Total-Matches": String(searched.total),
  }).send(csv);
});

router.get("/recent", async (req, res) => {
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 10));
  const searched = await searchPublished({
    practiceArea: effectivePracticeArea(req.portalAuth!, undefined),
    filters: {},
    limit,
    offset: 0,
    sort: "date",
    dir: "desc",
    dictionary: "english",
  });
  res.json({ results: await enrichForSearch(searched.ids) });
});

async function isCaseVisibleTo(id: number, identity: PortalAuthIdentity): Promise<boolean> {
  const approved = await getApprovedIds([id]);
  if (!approved.includes(id)) return false;
  const area = PORTAL_PRACTICE_AREA[identity.type];
  if (!area) return true;
  const [indexRow] = await db.select({ practiceArea: researchSearchIndex.practiceArea })
    .from(researchSearchIndex).where(eq(researchSearchIndex.judgmentId, id)).limit(1);
  return indexRow?.practiceArea === area;
}

router.get("/:id/related", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0 || !(await isCaseVisibleTo(id, req.portalAuth!))) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const [current] = await db.select({
    court: researchSearchIndex.court,
    practiceArea: researchSearchIndex.practiceArea,
  }).from(researchSearchIndex).where(eq(researchSearchIndex.judgmentId, id)).limit(1);
  const searched = await searchPublished({
    court: current?.court ?? undefined,
    practiceArea: effectivePracticeArea(req.portalAuth!, current?.practiceArea ?? undefined),
    filters: {},
    limit: 7,
    offset: 0,
    sort: "date",
    dir: "desc",
    dictionary: "english",
  });
  const relatedIds = searched.ids.filter((candidate) => candidate !== id).slice(0, 6);
  res.json({ basis: "Same court and permitted practice area", results: await enrichForSearch(relatedIds) });
});

const ExportFormatSchema = z.enum(["docx", "pdf", "text", "json", "html", "citation"]);
router.get("/:id/export/:format", async (req, res) => {
  const id = Number(req.params.id);
  const format = ExportFormatSchema.safeParse(req.params.format);
  if (!Number.isInteger(id) || id <= 0 || !format.success) {
    res.status(400).json({ error: "Invalid case id or export format" });
    return;
  }
  if (!(await isCaseVisibleTo(id, req.portalAuth!))) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const detail = await loadCaseDetail(id);
  if (!detail || !DISPLAY_SAFE_RIGHTS.includes(detail.provenance.rightsStatus as typeof DISPLAY_SAFE_RIGHTS[number])) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const isPrint = format.data === "pdf" || format.data === "html";
  const permissionResult = await db.execute(sql`
    SELECT current_rights.export_permitted, current_rights.printing_permitted
    FROM research_lawyes_reports lr
    JOIN research_verified_judgments rvj ON rvj.id = lr.judgment_id
    JOIN research_source_containers rsc ON rsc.id = rvj.container_id
    ${latestRightsJoin("rvj.container_id")}
    WHERE lr.judgment_id = ${id} AND lr.state = 'Published'
      ${liveRightsPredicate(isPrint ? "print" : "export")}
    LIMIT 1
  `);
  const permission = permissionResult.rows[0] as {
    export_permitted?: boolean | null;
    printing_permitted?: boolean | null;
  } | undefined;
  if (!permission) {
    res.status(403).json({ error: "This source's current licence does not permit the requested export." });
    return;
  }
  const exported = await buildCaseReportExport(asPublicReport(detail), format.data as CaseReportExportFormat);
  res.set({
    "Content-Type": exported.contentType,
    "Content-Disposition": `attachment; filename="${exported.filename.replace(/"/g, "")}"`,
    "X-LAWYes-Report-State": "Published",
    "X-LAWYes-Rights-Status": detail.provenance.rightsStatus,
    "X-LAWYes-Verified-At": detail.provenance.verifiedAt,
    "Cache-Control": "private, no-store",
  }).send(exported.buffer);
});

/**
 * GET /api/cases/:id
 * Full case record: metadata, accepted headnotes, accepted catchwords, paragraphs.
 * Rate-limited to 200 reads/identity/day.
 */
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid case id" });
    return;
  }

  // Rights gate — 404 not 403 (don't reveal existence of restricted cases)
  if (!(await isCaseVisibleTo(id, req.portalAuth!))) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const identity = req.portalAuth!;

  // Rate limit (after gate — don't count denied requests)
  const { allowed, remaining } = checkRateLimit(identity);
  if (!allowed) {
    res
      .status(429)
      .set("Retry-After", "86400")
      .json({
        error: "Daily case read limit reached (200/day). Please try again tomorrow.",
      });
    return;
  }
  res.set("X-RateLimit-Remaining", String(remaining));

  const detail = await loadCaseDetail(id);
  if (!detail) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  res.set("Cache-Control", "private, no-store").json(detail);
});

export default router;
