// Phase 11b: Research Workspace routes.
//
// All routes require a resolved research user (req.researchUserId must be
// non-null).  The helper `requireWorkspaceUser` enforces this.
//
// Container view gates are applied before any judgment-content is returned,
// using the non-leak 404 pattern established in other research routes.

import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod/v4";
import { requireResearchRole } from "../auth";
import { checkContainerAccess, getRestrictions } from "../domain/gates";
import { EntityNotFoundError } from "../domain/types";
import {
  db,
  researchVerifiedJudgments,
  type ResearchRole,
} from "@workspace/db";
import { ftSearch } from "../search/postgresFtsAdapter";
import { decideAccess } from "../domain/access";
import { eq, inArray } from "drizzle-orm";
import {
  createFolder,
  listFolders,
  getFolder,
  deleteFolder,
  addJudgmentToFolder,
  removeJudgmentFromFolder,
  listFolderItems,
  createSavedSearch,
  listSavedSearches,
  deleteSavedSearch,
  createReadingList,
  listReadingLists,
  getReadingList,
  addJudgmentToList,
  markItemAsRead,
  reorderListItem,
  listReadingListItems,
  removeJudgmentFromList,
  upsertBookmark,
  deleteBookmark,
  listBookmarks,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  listAnnotations,
  createQuotationCollection,
  listQuotationCollections,
  saveQuotation,
  listQuotations,
  exportCollectionText,
  createComparisonTable,
  updateComparisonTable,
  listComparisonTables,
  getComparisonTable,
  deleteComparisonTable,
  renderComparisonTable,
  createAuthoritiesTable,
  listAuthoritiesTables,
  getAuthoritiesTable,
  deleteAuthoritiesTable,
  renderAuthoritiesTable,
  MAX_COMPARISON_JUDGMENTS,
} from "../workspace/service";

const router: IRouter = Router();

// ── Auth helper ───────────────────────────────────────────────────────────

/** Requires a resolved research user id (non-null). */
function requireWorkspaceUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.researchUserId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

/** Resolve judgment's containerId and verify the caller has view access. */
async function gateJudgmentView(
  req: Request,
  res: Response,
  judgmentId: number,
): Promise<number | null> {
  const [judgment] = await db
    .select()
    .from(researchVerifiedJudgments)
    .where(eq(researchVerifiedJudgments.id, judgmentId));
  if (!judgment) {
    res.status(404).json({ error: "Not found" });
    return null;
  }
  try {
    const { decision } = await checkContainerAccess(
      judgment.containerId,
      req.researchRole ?? null,
      "view",
      { actor: req.authEmail ?? undefined },
    );
    if (!decision.allowed) {
      res.status(404).json({ error: "Not found" });
      return null;
    }
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return null;
    }
    throw err;
  }
  return judgment.containerId;
}

// ── Folders ───────────────────────────────────────────────────────────────

const CreateFolderBody = z.object({
  kind: z.enum(["research", "course", "matter"]).default("research"),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
});

router.get("/workspace/folders", requireWorkspaceUser, async (req, res) => {
  const folders = await listFolders(req.researchUserId!, req.researchRole ?? null, db);
  res.json(folders);
});

router.post("/workspace/folders", requireWorkspaceUser, async (req, res) => {
  const parsed = CreateFolderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return;
  }
  // Students may not create course or matter folders.
  if (
    req.researchRole === "student" &&
    (parsed.data.kind === "course" || parsed.data.kind === "matter")
  ) {
    res.status(403).json({
      error: "Students may only create research folders.",
      code: "STUDENT_FOLDER_KIND_RESTRICTED",
    });
    return;
  }
  const folder = await createFolder(req.researchUserId!, parsed.data, db);
  res.status(201).json(folder);
});

router.get("/workspace/folders/:folderId", requireWorkspaceUser, async (req, res) => {
  const folderId = Number(req.params.folderId);
  if (!Number.isInteger(folderId)) { res.status(400).json({ error: "Invalid folder id" }); return; }
  const folder = await getFolder(folderId, db);
  if (!folder) { res.status(404).json({ error: "Not found" }); return; }
  // Owners see their folder; students see shared folders; others need to own it.
  if (
    folder.ownerId !== req.researchUserId &&
    !(req.researchRole === "student" && folder.sharedWithStudents)
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const items = await listFolderItems(folderId, db);
  res.json({ folder, items });
});

router.delete("/workspace/folders/:folderId", requireWorkspaceUser, async (req, res) => {
  const folderId = Number(req.params.folderId);
  if (!Number.isInteger(folderId)) { res.status(400).json({ error: "Invalid folder id" }); return; }
  const folder = await getFolder(folderId, db);
  if (!folder || folder.ownerId !== req.researchUserId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await deleteFolder(folderId, db);
  res.status(204).end();
});

router.post("/workspace/folders/:folderId/items", requireWorkspaceUser, async (req, res) => {
  const folderId = Number(req.params.folderId);
  if (!Number.isInteger(folderId)) { res.status(400).json({ error: "Invalid folder id" }); return; }
  const folder = await getFolder(folderId, db);
  if (!folder || folder.ownerId !== req.researchUserId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { judgmentId } = z.object({ judgmentId: z.number().int() }).parse(req.body);
  const gated = await gateJudgmentView(req, res, judgmentId);
  if (gated === null) return;
  const item = await addJudgmentToFolder(folderId, judgmentId, db);
  res.status(201).json(item);
});

router.delete(
  "/workspace/folders/:folderId/items/:judgmentId",
  requireWorkspaceUser,
  async (req, res) => {
    const folderId = Number(req.params.folderId);
    const judgmentId = Number(req.params.judgmentId);
    const folder = await getFolder(folderId, db);
    if (!folder || folder.ownerId !== req.researchUserId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await removeJudgmentFromFolder(folderId, judgmentId, db);
    res.status(204).end();
  },
);

// ── Saved searches ────────────────────────────────────────────────────────

const SaveSearchBody = z.object({
  name: z.string().min(1).max(200),
  query: z.record(z.string(), z.unknown()),
});

router.get("/workspace/saved-searches", requireWorkspaceUser, async (req, res) => {
  res.json(await listSavedSearches(req.researchUserId!, db));
});

router.post("/workspace/saved-searches", requireWorkspaceUser, async (req, res) => {
  const parsed = SaveSearchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  const row = await createSavedSearch(req.researchUserId!, parsed.data, db);
  res.status(201).json(row);
});

router.delete("/workspace/saved-searches/:id", requireWorkspaceUser, async (req, res) => {
  const id = Number(req.params.id);
  const rows = await listSavedSearches(req.researchUserId!, db);
  if (!rows.find((r) => r.id === id)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await deleteSavedSearch(id, db);
  res.status(204).end();
});

/**
 * POST /workspace/saved-searches/:id/run
 * Re-execute a stored search query against the FTS search index.
 * The stored query is used as-is; the caller may override `limit` via body.
 * Results are filtered by the caller's container-level view access (same
 * logic as GET /search).
 */
router.post(
  "/workspace/saved-searches/:id/run",
  requireWorkspaceUser,
  async (req, res) => {
    const id = Number(req.params.id);
    const searches = await listSavedSearches(req.researchUserId!, db);
    const saved = searches.find((s) => s.id === id);
    if (!saved) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const q = saved.query as Record<string, unknown>;
    const queryStr = typeof q.q === "string" ? q.q : "";
    if (!queryStr) {
      res.status(422).json({ error: "Saved search has no query string." });
      return;
    }

    const limit = typeof req.body?.limit === "number" ? Math.min(req.body.limit, 100) : 20;
    const lang = q.lang === "ms" ? "ms" : "en";

    const rawResults = await ftSearch(queryStr, {
      court: typeof q.court === "string" ? q.court : undefined,
      dateFrom: typeof q.dateFrom === "string" ? new Date(q.dateFrom) : undefined,
      dateTo: typeof q.dateTo === "string" ? new Date(q.dateTo) : undefined,
      dictionary: lang === "ms" ? "simple" : "english",
      limit,
    });

    // Filter by caller's view access (non-leak: inaccessible results silently removed).
    const role = req.researchRole ?? null;
    const visible = [];
    for (const r of rawResults) {
      const { decision } = await checkContainerAccess(r.containerId, role, "search", {
        actor: req.authEmail ?? undefined,
        audit: false,
      }).catch(() => ({ decision: { allowed: false, reason: "LOOKUP_FAILED" } }));
      if (decision.allowed) visible.push(r);
    }

    res.json({ savedSearch: saved, results: visible });
  },
);

// ── Reading lists ─────────────────────────────────────────────────────────

const CreateReadingListBody = z.object({
  name: z.string().min(1).max(200),
  sharedWithStudents: z.boolean().optional(),
});

router.get("/workspace/reading-lists", requireWorkspaceUser, async (req, res) => {
  res.json(await listReadingLists(req.researchUserId!, req.researchRole ?? null, db));
});

router.post("/workspace/reading-lists", requireWorkspaceUser, async (req, res) => {
  const parsed = CreateReadingListBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  const row = await createReadingList(req.researchUserId!, parsed.data, db);
  res.status(201).json(row);
});

router.get("/workspace/reading-lists/:listId", requireWorkspaceUser, async (req, res) => {
  const listId = Number(req.params.listId);
  const list = await getReadingList(listId, db);
  if (!list) { res.status(404).json({ error: "Not found" }); return; }
  // Ownership or shared-with-students access.
  if (
    list.ownerId !== req.researchUserId &&
    !(req.researchRole === "student" && list.sharedWithStudents)
  ) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const items = await listReadingListItems(listId, db);
  res.json({ list, items });
});

const AddListItemBody = z.object({
  judgmentId: z.number().int(),
  position: z.number().int().min(0).optional(),
});

router.post("/workspace/reading-lists/:listId/items", requireWorkspaceUser, async (req, res) => {
  const listId = Number(req.params.listId);
  const list = await getReadingList(listId, db);
  if (!list || list.ownerId !== req.researchUserId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = AddListItemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  const gated = await gateJudgmentView(req, res, parsed.data.judgmentId);
  if (gated === null) return;
  const item = await addJudgmentToList(listId, parsed.data.judgmentId, parsed.data.position ?? 0, db);
  res.status(201).json(item);
});

router.patch(
  "/workspace/reading-lists/:listId/items/:judgmentId",
  requireWorkspaceUser,
  async (req, res) => {
    const listId = Number(req.params.listId);
    const judgmentId = Number(req.params.judgmentId);
    const list = await getReadingList(listId, db);
    if (!list || list.ownerId !== req.researchUserId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const body = z.object({
      action: z.enum(["mark_read", "reorder"]),
      position: z.number().int().min(0).optional(),
    }).parse(req.body);
    if (body.action === "mark_read") {
      const row = await markItemAsRead(listId, judgmentId, db);
      res.json(row);
    } else {
      if (body.position === undefined) { res.status(400).json({ error: "position required for reorder" }); return; }
      const row = await reorderListItem(listId, judgmentId, body.position, db);
      res.json(row);
    }
  },
);

router.delete(
  "/workspace/reading-lists/:listId/items/:judgmentId",
  requireWorkspaceUser,
  async (req, res) => {
    const listId = Number(req.params.listId);
    const judgmentId = Number(req.params.judgmentId);
    const list = await getReadingList(listId, db);
    if (!list || list.ownerId !== req.researchUserId) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await removeJudgmentFromList(listId, judgmentId, db);
    res.status(204).end();
  },
);

// ── Bookmarks ─────────────────────────────────────────────────────────────

const BookmarkBody = z.object({
  label: z.string().optional(),
  folderId: z.number().int().optional(),
});

router.get("/workspace/bookmarks", requireWorkspaceUser, async (req, res) => {
  res.json(await listBookmarks(req.researchUserId!, db));
});

router.put("/workspace/bookmarks/:judgmentId", requireWorkspaceUser, async (req, res) => {
  const judgmentId = Number(req.params.judgmentId);
  const gated = await gateJudgmentView(req, res, judgmentId);
  if (gated === null) return;
  const parsed = BookmarkBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  const row = await upsertBookmark(req.researchUserId!, judgmentId, parsed.data, db);
  res.json(row);
});

router.delete("/workspace/bookmarks/:judgmentId", requireWorkspaceUser, async (req, res) => {
  const judgmentId = Number(req.params.judgmentId);
  await deleteBookmark(req.researchUserId!, judgmentId, db);
  res.status(204).end();
});

// ── Annotations ───────────────────────────────────────────────────────────

const CreateAnnotationBody = z.object({
  kind: z.enum(["note", "highlight", "flag"]).optional(),
  body: z.string().min(1),
  paragraphRef: z.string().optional(),
  charStart: z.number().int().optional(),
  charEnd: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
});

const UpdateAnnotationBody = z.object({
  body: z.string().optional(),
  kind: z.enum(["note", "highlight", "flag"]).optional(),
  paragraphRef: z.string().nullable().optional(),
  charStart: z.number().int().nullable().optional(),
  charEnd: z.number().int().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  isPublic: z.boolean().optional(),
});

router.get("/workspace/judgments/:judgmentId/annotations", requireWorkspaceUser, async (req, res) => {
  const judgmentId = Number(req.params.judgmentId);
  const gated = await gateJudgmentView(req, res, judgmentId);
  if (gated === null) return;
  const rows = await listAnnotations(judgmentId, req.researchUserId!, db);
  res.json(rows);
});

router.post("/workspace/judgments/:judgmentId/annotations", requireWorkspaceUser, async (req, res) => {
  const judgmentId = Number(req.params.judgmentId);
  const gated = await gateJudgmentView(req, res, judgmentId);
  if (gated === null) return;
  const parsed = CreateAnnotationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  const row = await createAnnotation(req.researchUserId!, judgmentId, parsed.data, db);
  res.status(201).json(row);
});

router.patch(
  "/workspace/annotations/:annotationId",
  requireWorkspaceUser,
  async (req, res) => {
    const annotationId = Number(req.params.annotationId);
    const parsed = UpdateAnnotationBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const row = await updateAnnotation(annotationId, req.researchUserId!, parsed.data, db);
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  },
);

router.delete(
  "/workspace/annotations/:annotationId",
  requireWorkspaceUser,
  async (req, res) => {
    await deleteAnnotation(Number(req.params.annotationId), req.researchUserId!, db);
    res.status(204).end();
  },
);

// ── Quotation collections ─────────────────────────────────────────────────

router.get("/workspace/quotation-collections", requireWorkspaceUser, async (req, res) => {
  res.json(await listQuotationCollections(req.researchUserId!, db));
});

router.post("/workspace/quotation-collections", requireWorkspaceUser, async (req, res) => {
  const { name } = z.object({ name: z.string().min(1).max(200) }).parse(req.body);
  const row = await createQuotationCollection(req.researchUserId!, name, db);
  res.status(201).json(row);
});

router.get(
  "/workspace/quotation-collections/:collectionId",
  requireWorkspaceUser,
  async (req, res) => {
    const collectionId = Number(req.params.collectionId);
    const collections = await listQuotationCollections(req.researchUserId!, db);
    if (!collections.find((c) => c.id === collectionId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const quotations = await listQuotations(collectionId, db);
    res.json({ collectionId, quotations });
  },
);

router.get(
  "/workspace/quotation-collections/:collectionId/export",
  requireWorkspaceUser,
  async (req, res) => {
    const collectionId = Number(req.params.collectionId);
    const collections = await listQuotationCollections(req.researchUserId!, db);
    if (!collections.find((c) => c.id === collectionId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const text = await exportCollectionText(collectionId, db);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(text);
  },
);

const SaveQuotationBody = z.object({
  propositionId: z.number().int(),
  passageText: z.string().min(1),
  label: z.string().optional(),
  charStart: z.number().int().optional(),
  charEnd: z.number().int().optional(),
});

router.post(
  "/workspace/quotation-collections/:collectionId/quotations",
  requireWorkspaceUser,
  async (req, res) => {
    const collectionId = Number(req.params.collectionId);
    const collections = await listQuotationCollections(req.researchUserId!, db);
    if (!collections.find((c) => c.id === collectionId)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const parsed = SaveQuotationBody.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
    const row = await saveQuotation(collectionId, parsed.data, db);
    res.status(201).json(row);
  },
);

// ── Case-comparison tables ────────────────────────────────────────────────

const CreateComparisonBody = z.object({
  name: z.string().min(1).max(200),
  judgmentIds: z.array(z.number().int()).min(1).max(MAX_COMPARISON_JUDGMENTS),
  fieldNames: z.array(z.string().min(1)).min(1),
});

const UpdateComparisonBody = z.object({
  name: z.string().min(1).max(200).optional(),
  judgmentIds: z.array(z.number().int()).max(MAX_COMPARISON_JUDGMENTS).optional(),
  fieldNames: z.array(z.string().min(1)).optional(),
});

router.get("/workspace/comparison-tables", requireWorkspaceUser, async (req, res) => {
  res.json(await listComparisonTables(req.researchUserId!, db));
});

router.post("/workspace/comparison-tables", requireWorkspaceUser, async (req, res) => {
  const parsed = CreateComparisonBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  // Gate: all judgment IDs must be viewable by the caller.
  for (const jid of parsed.data.judgmentIds) {
    const gated = await gateJudgmentView(req, res, jid);
    if (gated === null) return;
  }
  try {
    const row = await createComparisonTable(req.researchUserId!, parsed.data, db);
    res.status(201).json(row);
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

router.get("/workspace/comparison-tables/:tableId", requireWorkspaceUser, async (req, res) => {
  const tableId = Number(req.params.tableId);
  const table = await getComparisonTable(tableId, db);
  if (!table || table.ownerId !== req.researchUserId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const result = await renderComparisonTable(tableId, db);
  res.json(result);
});

router.patch("/workspace/comparison-tables/:tableId", requireWorkspaceUser, async (req, res) => {
  const tableId = Number(req.params.tableId);
  const table = await getComparisonTable(tableId, db);
  if (!table || table.ownerId !== req.researchUserId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parsed = UpdateComparisonBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  if (parsed.data.judgmentIds) {
    for (const jid of parsed.data.judgmentIds) {
      const gated = await gateJudgmentView(req, res, jid);
      if (gated === null) return;
    }
  }
  try {
    const updated = await updateComparisonTable(tableId, parsed.data, db);
    res.json(updated);
  } catch (err) {
    res.status(422).json({ error: (err as Error).message });
  }
});

router.delete("/workspace/comparison-tables/:tableId", requireWorkspaceUser, async (req, res) => {
  const tableId = Number(req.params.tableId);
  const table = await getComparisonTable(tableId, db);
  if (!table || table.ownerId !== req.researchUserId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await deleteComparisonTable(tableId, db);
  res.status(204).end();
});

// ── Authorities tables ────────────────────────────────────────────────────

const CreateAuthoritiesTableBody = z.object({
  name: z.string().min(1).max(200),
  judgmentIds: z.array(z.number().int()).min(1),
});

router.get("/workspace/authorities-tables", requireWorkspaceUser, async (req, res) => {
  res.json(await listAuthoritiesTables(req.researchUserId!, db));
});

router.post("/workspace/authorities-tables", requireWorkspaceUser, async (req, res) => {
  const parsed = CreateAuthoritiesTableBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: z.treeifyError(parsed.error) }); return; }
  for (const jid of parsed.data.judgmentIds) {
    const gated = await gateJudgmentView(req, res, jid);
    if (gated === null) return;
  }
  const row = await createAuthoritiesTable(req.researchUserId!, parsed.data, db);
  res.status(201).json(row);
});

router.get("/workspace/authorities-tables/:tableId", requireWorkspaceUser, async (req, res) => {
  const tableId = Number(req.params.tableId);
  const table = await getAuthoritiesTable(tableId, db);
  if (!table || table.ownerId !== req.researchUserId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const result = await renderAuthoritiesTable(tableId, db);
  res.json(result);
});

router.delete("/workspace/authorities-tables/:tableId", requireWorkspaceUser, async (req, res) => {
  const tableId = Number(req.params.tableId);
  const table = await getAuthoritiesTable(tableId, db);
  if (!table || table.ownerId !== req.researchUserId) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await deleteAuthoritiesTable(tableId, db);
  res.status(204).end();
});

export default router;
