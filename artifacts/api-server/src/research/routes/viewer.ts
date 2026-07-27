// Judgment viewer routes (Phase 08, ADR 0009 §D5).
// Mounted at /api/research/judgments via the research router.
// All routes require an authenticated research session.
// Annotations and bookmarks are scoped per research_user_id.

import { Router } from "express";
import { z } from "zod/v4";
import { requireResearchRole } from "../auth";
import { checkContainerAccess } from "../domain/gates";
import { EntityNotFoundError } from "../domain/types";
import { emitAuditEvent } from "../domain/audit";
import { AuditAction } from "../domain/auditEvents";
import {
  db,
  researchVerifiedJudgments,
  researchPageSections,
  researchSourcePages,
  researchPageExtractions,
  researchAnnotations,
  researchBookmarks,
  researchSearchIndex,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────

async function resolveJudgmentAccess(
  judgmentId: number,
  role: import("@workspace/db").ResearchRole | null,
  action: import("../domain/access").AccessAction,
  authEmail: string | undefined,
): Promise<{ judgment: import("@workspace/db").ResearchVerifiedJudgment; allowed: boolean }> {
  const [judgment] = await db
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, judgmentId));

  if (!judgment) return { judgment: null as any, allowed: false };

  const { decision } = await checkContainerAccess(
    judgment.containerId,
    role,
    action,
    { actor: authEmail, audit: false },
  );

  return { judgment, allowed: decision.allowed };
}

// ── GET /judgments ────────────────────────────────────────────────────────
// List verified judgments (access-filtered).

router.get("/", async (req, res) => {
  const role = req.researchRole ?? null;
  const allJudgments = await db
    .select()
    .from(researchVerifiedJudgments)
    .orderBy(desc(researchVerifiedJudgments.id))
    .limit(200);

  const visible = [];
  for (const j of allJudgments) {
    try {
      const { decision } = await checkContainerAccess(
        j.containerId,
        role,
        "view",
        { actor: req.authEmail ?? undefined, audit: false },
      );
      if (decision.allowed) visible.push(j);
    } catch {
      // Container gone.
    }
  }

  res.json(visible);
});

// ── GET /judgments/:id ────────────────────────────────────────────────────

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const { judgment, allowed } = await resolveJudgmentAccess(
      id,
      req.researchRole ?? null,
      "view",
      req.authEmail ?? undefined,
    );
    if (!judgment || !allowed) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // Audit: document accessed (fire-and-forget; must not carry judgment text).
    void emitAuditEvent({
      entityType: "judgment",
      entityId: id,
      event: AuditAction.DOCUMENT_ACCESSED,
      actor: req.authEmail ?? `role:${req.researchRole ?? "unknown"}`,
      detail: { containerId: judgment.containerId, role: req.researchRole ?? null },
    });
    res.json(judgment);
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});

// ── GET /judgments/:id/paragraphs ─────────────────────────────────────────
// Return ordered paragraphs for the judgment (judicial text only).

router.get("/:id/paragraphs", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const { judgment, allowed } = await resolveJudgmentAccess(
      id,
      req.researchRole ?? null,
      "view",
      req.authEmail ?? undefined,
    );

    if (!judgment || !allowed) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    // Build ordered paragraphs from page extractions for the approved pages.
    const pageIds = judgment.pageRefs;
    if (pageIds.length === 0) {
      res.json({ judgmentId: id, paragraphs: [] });
      return;
    }

    const sourcePages = await db
      .select()
      .from(researchSourcePages)
      .where(inArray(researchSourcePages.id, pageIds));

    const extractions = await db
      .select()
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, pageIds))
      .orderBy(desc(researchPageExtractions.id));

    const latestByPage = new Map<number, string>();
    for (const ex of extractions) {
      if (!latestByPage.has(ex.pageId) && ex.rawText) {
        latestByPage.set(ex.pageId, ex.rawText);
      }
    }

    const paragraphs: Array<{
      paragraphRef: string;
      pageId: number;
      pageNumber: number;
      text: string;
    }> = [];

    const orderedPages = sourcePages.sort((a, b) => a.pageNumber - b.pageNumber);
    let paraIndex = 0;
    for (const page of orderedPages) {
      const text = latestByPage.get(page.id) ?? "";
      // Split by paragraph markers ([1], [2], ...) or double newlines.
      const chunks = text.split(/(?=\[\d+\])|(?:\n\n+)/g).filter((t) => t.trim().length > 0);
      for (const chunk of chunks) {
        const markerMatch = chunk.match(/^\[(\d+)\]/);
        const ref = markerMatch
          ? `[${markerMatch[1]}]`
          : `para-${++paraIndex}`;
        paragraphs.push({
          paragraphRef: ref,
          pageId: page.id,
          pageNumber: page.pageNumber,
          text: chunk.trim(),
        });
      }
    }

    res.json({ judgmentId: id, paragraphs });
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});

// ── GET /judgments/:id/source-pages ──────────────────────────────────────
// Return source page metadata for comparison view.

router.get("/:id/source-pages", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const { judgment, allowed } = await resolveJudgmentAccess(
      id,
      req.researchRole ?? null,
      "view",
      req.authEmail ?? undefined,
    );

    if (!judgment || !allowed) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const pageIds = judgment.pageRefs;
    if (pageIds.length === 0) {
      res.json({ judgmentId: id, pages: [] });
      return;
    }

    const pages = await db
      .select()
      .from(researchSourcePages)
      .where(inArray(researchSourcePages.id, pageIds));

    const sections = await db
      .select()
      .from(researchPageSections)
      .where(
        and(
          eq(researchPageSections.containerId, judgment.containerId),
          inArray(researchPageSections.pageId, pageIds),
        ),
      );

    const sectionsByPage = new Map<number, typeof sections>();
    for (const s of sections) {
      if (s.pageId == null) continue;
      if (!sectionsByPage.has(s.pageId)) sectionsByPage.set(s.pageId, []);
      sectionsByPage.get(s.pageId)!.push(s);
    }

    res.json({
      judgmentId: id,
      pages: pages
        .sort((a, b) => a.pageNumber - b.pageNumber)
        .map((p) => ({
          ...p,
          sections: sectionsByPage.get(p.id) ?? [],
        })),
    });
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }
});

// ── Annotations ───────────────────────────────────────────────────────────

const AnnotationCreateSchema = z.object({
  paragraphRef: z.string().optional(),
  kind: z.enum(["note", "highlight", "flag"]).default("note"),
  body: z.string().min(1).max(10000),
});

// GET /judgments/:id/annotations — list own annotations.
router.get(
  "/:id/annotations",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
    "researcher",
    "lecturer",
    "student",
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const userId = req.researchUserId;
    if (!userId) {
      res.status(403).json({ error: "No research user record" });
      return;
    }

    const { judgment, allowed } = await resolveJudgmentAccess(
      id,
      req.researchRole ?? null,
      "view",
      req.authEmail ?? undefined,
    );

    if (!judgment || !allowed) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const annotations = await db
      .select()
      .from(researchAnnotations)
      .where(
        and(
          eq(researchAnnotations.judgmentId, id),
          eq(researchAnnotations.userId, userId),
        ),
      )
      .orderBy(researchAnnotations.createdAt);

    res.json(annotations);
  },
);

// POST /judgments/:id/annotations — create annotation.
router.post(
  "/:id/annotations",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
    "researcher",
    "lecturer",
    "student",
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const userId = req.researchUserId;
    if (!userId) {
      res.status(403).json({ error: "No research user record" });
      return;
    }

    const parsed = AnnotationCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const { judgment, allowed } = await resolveJudgmentAccess(
      id,
      req.researchRole ?? null,
      "view",
      req.authEmail ?? undefined,
    );

    if (!judgment || !allowed) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const [annotation] = await db
      .insert(researchAnnotations)
      .values({
        userId,
        judgmentId: id,
        paragraphRef: parsed.data.paragraphRef ?? null,
        kind: parsed.data.kind,
        body: parsed.data.body,
      })
      .returning();

    res.status(201).json(annotation);
  },
);

// DELETE /judgments/:id/annotations/:annotationId
router.delete(
  "/:id/annotations/:annotationId",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
    "researcher",
    "lecturer",
    "student",
  ),
  async (req, res) => {
    const judgmentId = Number(req.params.id);
    const annotationId = Number(req.params.annotationId);
    if (!Number.isInteger(judgmentId) || !Number.isInteger(annotationId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const userId = req.researchUserId;
    if (!userId) {
      res.status(403).json({ error: "No research user record" });
      return;
    }

    const [existing] = await db
      .select()
      .from(researchAnnotations)
      .where(
        and(
          eq(researchAnnotations.id, annotationId),
          eq(researchAnnotations.userId, userId),
          eq(researchAnnotations.judgmentId, judgmentId),
        ),
      );

    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    await db
      .delete(researchAnnotations)
      .where(eq(researchAnnotations.id, annotationId));

    res.status(204).send();
  },
);

// ── Bookmarks ─────────────────────────────────────────────────────────────

// GET /judgments/:id/bookmark — check if bookmarked.
router.get(
  "/:id/bookmark",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
    "researcher",
    "lecturer",
    "student",
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const userId = req.researchUserId;
    if (!userId) {
      res.status(403).json({ error: "No research user record" });
      return;
    }

    const [bm] = await db
      .select()
      .from(researchBookmarks)
      .where(
        and(
          eq(researchBookmarks.userId, userId),
          eq(researchBookmarks.judgmentId, id),
        ),
      );

    res.json({ bookmarked: !!bm, bookmark: bm ?? null });
  },
);

// PUT /judgments/:id/bookmark — upsert bookmark.
router.put(
  "/:id/bookmark",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
    "researcher",
    "lecturer",
    "student",
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const userId = req.researchUserId;
    if (!userId) {
      res.status(403).json({ error: "No research user record" });
      return;
    }

    const { judgment, allowed } = await resolveJudgmentAccess(
      id,
      req.researchRole ?? null,
      "view",
      req.authEmail ?? undefined,
    );

    if (!judgment || !allowed) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const label =
      typeof req.body?.label === "string" ? req.body.label : null;

    const [bm] = await db
      .insert(researchBookmarks)
      .values({ userId, judgmentId: id, label })
      .onConflictDoUpdate({
        target: [researchBookmarks.userId, researchBookmarks.judgmentId],
        set: { label },
      })
      .returning();

    res.status(201).json(bm);
  },
);

// DELETE /judgments/:id/bookmark
router.delete(
  "/:id/bookmark",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
    "researcher",
    "lecturer",
    "student",
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const userId = req.researchUserId;
    if (!userId) {
      res.status(403).json({ error: "No research user record" });
      return;
    }

    await db
      .delete(researchBookmarks)
      .where(
        and(
          eq(researchBookmarks.userId, userId),
          eq(researchBookmarks.judgmentId, id),
        ),
      );

    res.status(204).send();
  },
);

// GET /judgments/bookmarks — list all bookmarks for current user.
router.get(
  "/my/bookmarks",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
    "researcher",
    "lecturer",
    "student",
  ),
  async (req, res) => {
    const userId = req.researchUserId;
    if (!userId) {
      res.status(403).json({ error: "No research user record" });
      return;
    }

    const bookmarks = await db
      .select()
      .from(researchBookmarks)
      .where(eq(researchBookmarks.userId, userId))
      .orderBy(desc(researchBookmarks.createdAt));

    res.json(bookmarks);
  },
);

export default router;
