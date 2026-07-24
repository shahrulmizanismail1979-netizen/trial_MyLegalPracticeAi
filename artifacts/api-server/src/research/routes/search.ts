// Search API routes (Phase 08, ADR 0009).
// Mounted at /api/research/search via the research router.
// All routes require an authenticated research session and pass through the
// access gate. Isolation is enforced structurally by the search index itself.

import { Router } from "express";
import { z } from "zod/v4";
import { requireResearchRole } from "../auth";
import { checkContainerAccess } from "../domain/gates";
import { EntityNotFoundError } from "../domain/types";
import {
  db,
  researchVerifiedJudgments,
  researchCaseMetadata,
  researchDuplicateLinks,
  researchSearchIndex,
} from "@workspace/db";
import { and, desc, eq, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { ftSearch } from "../search/postgresFtsAdapter";
import { enqueue } from "../processing";
import { SEARCH_INDEX_JOB_KIND, SEARCH_INDEX_VERSION } from "../search/searchIndexProcessor";

const router = Router();

// ── GET /search ───────────────────────────────────────────────────────────
// Full-text search across indexed verified judgments.
// Role: any authenticated research user (guest and above).

const SearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  court: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  lang: z.enum(["en", "ms"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

router.get("/", async (req, res) => {
  const parsed = SearchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }

  const { q, court, dateFrom, dateTo, lang, limit } = parsed.data;

  const dateFromParsed = dateFrom ? new Date(dateFrom) : undefined;
  const dateToParsed = dateTo ? new Date(dateTo) : undefined;

  const results = await ftSearch(q, {
    court,
    dateFrom: dateFromParsed && !isNaN(dateFromParsed.getTime()) ? dateFromParsed : undefined,
    dateTo: dateToParsed && !isNaN(dateToParsed.getTime()) ? dateToParsed : undefined,
    dictionary: lang === "ms" ? "simple" : "english",
    limit,
  });

  // Filter by access: remove results the caller cannot view.
  const role = req.researchRole ?? null;
  const visible = [];
  for (const r of results) {
    const [ji] = await db
      .select({ containerId: researchVerifiedJudgments.containerId })
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.id, r.judgmentId));
    if (!ji) continue;
    try {
      const { decision } = await checkContainerAccess(
        ji.containerId,
        role,
        "search",
        { actor: req.authEmail ?? undefined, audit: false },
      );
      if (decision.allowed) visible.push(r);
    } catch {
      // Container gone — skip silently.
    }
  }

  res.json({ query: q, total: visible.length, results: visible });
});

// ── GET /search/metadata ─────────────────────────────────────────────────
// List all metadata records for a judgment.
// Role: researcher and above.

router.get(
  "/metadata/:judgmentId",
  requireResearchRole("owner", "administrator", "rights_reviewer", "legal_reviewer", "researcher"),
  async (req, res) => {
    const judgmentId = Number(req.params.judgmentId);
    if (!Number.isInteger(judgmentId)) {
      res.status(400).json({ error: "Invalid judgmentId" });
      return;
    }

    const [judgment] = await db
      .select({ containerId: researchVerifiedJudgments.containerId })
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.id, judgmentId));

    if (!judgment) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    try {
      const { decision } = await checkContainerAccess(
        judgment.containerId,
        req.researchRole ?? null,
        "view",
        { actor: req.authEmail ?? undefined, audit: false },
      );
      if (!decision.allowed) {
        res.status(404).json({ error: "Not found" });
        return;
      }
    } catch (err) {
      if (err instanceof EntityNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      throw err;
    }

    const records = await db
      .select()
      .from(researchCaseMetadata)
      .where(eq(researchCaseMetadata.judgmentId, judgmentId))
      .orderBy(researchCaseMetadata.fieldName, desc(researchCaseMetadata.id));

    res.json(records);
  },
);

// ── PATCH /search/metadata/:id ────────────────────────────────────────────
// Approve or reject a metadata field record.
// Role: rights_reviewer and above.

const MetadataPatchSchema = z.object({
  reviewerStatus: z.enum(["approved", "rejected"]),
  note: z.string().optional(),
});

router.patch(
  "/metadata/records/:id",
  requireResearchRole("owner", "administrator", "rights_reviewer"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = MetadataPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const [existing] = await db
      .select()
      .from(researchCaseMetadata)
      .where(eq(researchCaseMetadata.id, id));

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [updated] = await db
      .update(researchCaseMetadata)
      .set({
        reviewerStatus: parsed.data.reviewerStatus,
        reviewerDecidedAt: new Date(),
      })
      .where(eq(researchCaseMetadata.id, id))
      .returning();

    res.json(updated);
  },
);

// ── POST /search/index/:judgmentId ────────────────────────────────────────
// Manually trigger re-indexing of a judgment.
// Role: administrator and owner only.

router.post(
  "/index/:judgmentId",
  requireResearchRole("owner", "administrator"),
  async (req, res) => {
    const judgmentId = Number(req.params.judgmentId);
    if (!Number.isInteger(judgmentId)) {
      res.status(400).json({ error: "Invalid judgmentId" });
      return;
    }

    const [judgment] = await db
      .select()
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.id, judgmentId));

    if (!judgment) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const job = await enqueue(
      SEARCH_INDEX_JOB_KIND,
      `search-index-manual-${judgmentId}-${Date.now()}`,
      { judgmentId, containerId: judgment.containerId },
      {
        actor: req.authEmail ?? `role:${req.researchRole}`,
        processorVersion: SEARCH_INDEX_VERSION,
        provenance: { judgmentId, trigger: "manual" },
      },
    );

    res.status(202).json({ jobId: job?.id ?? null });
  },
);

// ── GET /search/duplicates/:judgmentId ────────────────────────────────────
// List duplicate links for a judgment.

router.get(
  "/duplicates/:judgmentId",
  requireResearchRole("owner", "administrator", "rights_reviewer", "legal_reviewer", "researcher"),
  async (req, res) => {
    const judgmentId = Number(req.params.judgmentId);
    if (!Number.isInteger(judgmentId)) {
      res.status(400).json({ error: "Invalid judgmentId" });
      return;
    }

    const [judgment] = await db
      .select({ containerId: researchVerifiedJudgments.containerId })
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.id, judgmentId));

    if (!judgment) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const links = await db
      .select()
      .from(researchDuplicateLinks)
      .where(
        sql`${researchDuplicateLinks.sourceJudgmentId} = ${judgmentId} OR ${researchDuplicateLinks.targetJudgmentId} = ${judgmentId}`,
      )
      .orderBy(desc(researchDuplicateLinks.id));

    res.json(links);
  },
);

// ── PATCH /search/duplicates/:id ──────────────────────────────────────────
// Confirm or reject a duplicate link.
// Role: rights_reviewer and above.

const DuplicatePatchSchema = z.object({
  reviewerStatus: z.enum(["confirmed", "rejected"]),
  reviewerNote: z.string().optional(),
});

router.patch(
  "/duplicates/links/:id",
  requireResearchRole("owner", "administrator", "rights_reviewer"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const parsed = DuplicatePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const [existing] = await db
      .select()
      .from(researchDuplicateLinks)
      .where(eq(researchDuplicateLinks.id, id));

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [updated] = await db
      .update(researchDuplicateLinks)
      .set({
        reviewerStatus: parsed.data.reviewerStatus,
        reviewerNote: parsed.data.reviewerNote ?? null,
        reviewerDecidedAt: new Date(),
      })
      .where(eq(researchDuplicateLinks.id, id))
      .returning();

    res.json(updated);
  },
);

export default router;
