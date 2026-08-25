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
  researchSourcePages,
  researchVerifiedJudgments,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { ftSearch } from "../research/search/postgresFtsAdapter";
import type { PortalAuthIdentity } from "../middlewares/requireAnyPortalAuth";

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
    JOIN research_headnotes rh ON rh.judgment_id = rvj.id
    WHERE rvj.id IN (${sql.raw(placeholders)})
      AND rh.status = 'accepted'
      AND rsc.processing_state = 'SEARCHABLE'
      AND rsc.rights_status IN (
        'OFFICIAL_COURT_SOURCE',
        'PUBLIC_OR_OPEN_LICENCE_SOURCE',
        'USER_OWNED_OR_AUTHORISED'
      )
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
}

/** Enrich a list of judgment IDs with metadata, headnotes, catchwords, snippet. */
async function enrichForSearch(ids: number[]): Promise<SearchResultItem[]> {
  if (ids.length === 0) return [];

  const [metaMaps, headnoteRows, catchwordRows, indexRows] = await Promise.all([
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
      })
      .from(researchSearchIndex)
      .where(inArray(researchSearchIndex.judgmentId, ids)),
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

  return ids.map((id) => {
    const meta = metaMaps.get(id) ?? new Map<string, unknown>();
    const si = indexByJudgment.get(id);
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
        metaStr(meta.get("reportCitation")) ??
        metaStr(meta.get("neutralCitation")),
      caseName: metaStr(meta.get("caseName")),
      court: metaStr(meta.get("court")) ?? si?.court ?? null,
      decisionDate:
        metaStr(meta.get("decisionDate")) ??
        (si?.decisionDate ? si.decisionDate.toISOString() : null),
      parties: metaStr(meta.get("parties")),
      headnotes: (hnByJudgment.get(id) ?? []).map((h) => ({
        number: h.number,
        text: h.text,
        paragraphRef: h.paragraphRef ?? null,
      })),
      catchwords: (cwByJudgment.get(id) ?? []).map((c) => ({
        sortOrder: c.sortOrder,
        catchwordLine: c.catchwordLine,
      })),
      snippet,
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
      WHERE si.${sql.raw(tsCol)} @@ websearch_to_tsquery(${dict}, ${opts.q})
        AND rh.status = 'accepted'
        AND rsc.processing_state = 'SEARCHABLE'
        AND rsc.rights_status IN (
          'OFFICIAL_COURT_SOURCE',
          'PUBLIC_OR_OPEN_LICENCE_SOURCE',
          'USER_OWNED_OR_AUTHORISED'
        )
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
        WHERE si.${sql.raw(tsCol)} @@ websearch_to_tsquery(${dict}, ${opts.q})
          AND rh.status = 'accepted'
          AND rsc.processing_state = 'SEARCHABLE'
          AND rsc.rights_status IN (
            'OFFICIAL_COURT_SOURCE',
            'PUBLIC_OR_OPEN_LICENCE_SOURCE',
            'USER_OWNED_OR_AUTHORISED'
          )
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
      WHERE rh.status = 'accepted'
        AND rsc.processing_state = 'SEARCHABLE'
        AND rsc.rights_status IN (
          'OFFICIAL_COURT_SOURCE',
          'PUBLIC_OR_OPEN_LICENCE_SOURCE',
          'USER_OWNED_OR_AUTHORISED'
        )
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
        WHERE rh.status = 'accepted'
          AND rsc.processing_state = 'SEARCHABLE'
          AND rsc.rights_status IN (
            'OFFICIAL_COURT_SOURCE',
            'PUBLIC_OR_OPEN_LICENCE_SOURCE',
            'USER_OWNED_OR_AUTHORISED'
          )
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

// ── Routes ───────────────────────────────────────────────────────────────────

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500).optional(),
  court: z.string().max(200).optional(),
  practiceArea: z.string().max(50).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["relevance", "date"]).default("relevance"),
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

  let total = 0;
  let judgmentIds: number[] = [];

  if (q) {
    if (sort === "date") {
      // Date-sort path: query the full approved FTS corpus in SQL with date ordering,
      // so results beyond the top-200 relevance window are included correctly.
      const { total: t, ids } = await ftsSearchApprovedByDate({
        q,
        court,
        practiceArea,
        dateFrom:
          dateFromDate && !isNaN(dateFromDate.getTime()) ? dateFromDate : undefined,
        dateTo:
          dateToDate && !isNaN(dateToDate.getTime()) ? dateToDate : undefined,
        limit,
        offset,
        dir,
        dictionary: lang === "ms" ? "simple" : "english",
      });
      total = t;
      judgmentIds = ids;
    } else {
      // Relevance path — over-fetch then rights-filter
      const ftsResults = await ftSearch(q, {
        court,
        practiceArea,
        dateFrom:
          dateFromDate && !isNaN(dateFromDate.getTime()) ? dateFromDate : undefined,
        dateTo:
          dateToDate && !isNaN(dateToDate.getTime()) ? dateToDate : undefined,
        dictionary: lang === "ms" ? "simple" : "english",
        limit: 200, // over-fetch so rights-filter has enough candidates
      });

      if (ftsResults.length > 0) {
        const candidateIds = ftsResults.map((r) => r.judgmentId);
        const approvedSet = new Set(await getApprovedIds(candidateIds));
        const filtered = ftsResults.filter((r) => approvedSet.has(r.judgmentId));
        total = filtered.length;
        judgmentIds = filtered
          .slice(offset, offset + limit)
          .map((r) => r.judgmentId);
      }
    }
  } else {
    // Browse path
    const { total: t, ids } = await browseApproved({
      court,
      practiceArea,
      dateFrom:
        dateFromDate && !isNaN(dateFromDate.getTime()) ? dateFromDate : undefined,
      dateTo:
        dateToDate && !isNaN(dateToDate.getTime()) ? dateToDate : undefined,
      limit,
      offset,
      dir: sort === "date" ? dir : undefined,
    });
    total = t;
    judgmentIds = ids;
  }

  const results = await enrichForSearch(judgmentIds);
  res.json({ total, limit, offset, results });
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
  const approved = await getApprovedIds([id]);
  if (!approved.includes(id)) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const identity = req.portalAuth!;

  // Practice-area gate — a scoped portal can only read cases in its own area
  // (mirrors the search filter; 404 keeps other areas' cases invisible).
  const enforcedArea = PORTAL_PRACTICE_AREA[identity.type];
  if (enforcedArea) {
    const [indexRow] = await db
      .select({ practiceArea: researchSearchIndex.practiceArea })
      .from(researchSearchIndex)
      .where(eq(researchSearchIndex.judgmentId, id))
      .limit(1);
    if (indexRow?.practiceArea !== enforcedArea) {
      res.status(404).json({ error: "Case not found" });
      return;
    }
  }

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

  const [judgmentRows, metaMaps, headnoteRows, catchwordRows] =
    await Promise.all([
      db
        .select()
        .from(researchVerifiedJudgments)
        .where(eq(researchVerifiedJudgments.id, id))
        .limit(1),
      buildMetaMaps([id]),
      db
        .select()
        .from(researchHeadnotes)
        .where(
          and(
            eq(researchHeadnotes.judgmentId, id),
            eq(researchHeadnotes.status, "accepted"),
          ),
        )
        .orderBy(asc(researchHeadnotes.number)),
      db
        .select()
        .from(researchCatchwords)
        .where(
          and(
            eq(researchCatchwords.judgmentId, id),
            eq(researchCatchwords.status, "accepted"),
          ),
        )
        .orderBy(asc(researchCatchwords.sortOrder)),
    ]);

  const judgment = judgmentRows[0];
  if (!judgment) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  const meta = metaMaps.get(id) ?? new Map<string, unknown>();
  const paragraphs = await getJudgmentParagraphs(judgment);

  res.json({
    id,
    citation:
      metaStr(meta.get("reportCitation")) ??
      metaStr(meta.get("neutralCitation")),
    caseName: metaStr(meta.get("caseName")),
    court: metaStr(meta.get("court")),
    decisionDate: metaStr(meta.get("decisionDate")),
    parties: metaStr(meta.get("parties")),
    coram: metaStr(meta.get("coram")),
    advocates: metaStr(meta.get("advocates")),
    judges: metaStr(meta.get("judges")),
    legislation: meta.get("legislation") ?? null,
    casesReferred: meta.get("casesReferred") ?? null,
    headnotes: headnoteRows.map((h) => ({
      number: h.number,
      text: h.text,
      paragraphRef: h.paragraphRef ?? null,
    })),
    catchwords: catchwordRows.map((c) => ({
      sortOrder: c.sortOrder,
      catchwordLine: c.catchwordLine,
    })),
    paragraphs,
    metadata: Object.fromEntries(
      [...meta.entries()].map(([k, v]) => [k, v]),
    ),
  });
});

export default router;
