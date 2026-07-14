import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db } from "@workspace/db";
import {
  litBundles,
  litBundleDocuments,
  litMatters,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireSubscription } from "./billing";

const router: IRouter = Router();

function getAccessCodeId(req: Request): number | undefined {
  const sess = req.session as unknown as Record<string, unknown> | undefined;
  if (!sess || sess.authenticated !== true) return undefined;
  return sess.accessCodeId as number | undefined;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const accessCodeId = getAccessCodeId(req);
  if (!accessCodeId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  (req as unknown as Request & { accessCodeId: number }).accessCodeId = accessCodeId;
  next();
}

const MAX_NOTES = 20_000;

export const BUNDLE_TYPES = [
  { id: "pleadings", name: "Bundle of Pleadings" },
  { id: "common-agreed-A", name: "Common Agreed Bundle — Part A" },
  { id: "common-agreed-B", name: "Common Agreed Bundle — Part B (authenticity not agreed)" },
  { id: "common-agreed-C", name: "Common Agreed Bundle — Part C (disputed)" },
  { id: "witness-statements", name: "Bundle of Witness Statements (O.38)" },
  { id: "authorities", name: "Bundle of Authorities" },
  { id: "core", name: "Core Bundle" },
  { id: "other", name: "Other Bundle" },
] as const;

const DOC_TYPES = [
  "pleading",
  "affidavit",
  "witness-statement",
  "exhibit",
  "correspondence",
  "contract",
  "authority",
  "order",
  "other",
];

router.get("/types", (_req, res) => {
  res.json({ bundleTypes: BUNDLE_TYPES, docTypes: DOC_TYPES });
});

router.use(requireAuth);

async function getOwnedBundle(req: Request, res: Response, idParam: string) {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const id = parseInt(idParam, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid bundle id" });
    return undefined;
  }
  const [row] = await db
    .select()
    .from(litBundles)
    .where(and(eq(litBundles.id, id), eq(litBundles.accessCodeId, accessCodeId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Bundle not found" });
    return undefined;
  }
  return row;
}

// Verify a matterId (if supplied) belongs to the caller. Returns:
//  - number  -> validated matter id
//  - null    -> no matter linked
//  - false   -> supplied but not owned (caller should 404)
async function resolveMatterId(
  accessCodeId: number,
  matterId: unknown,
): Promise<number | null | false> {
  if (matterId === undefined || matterId === null || matterId === "") return null;
  const id = Number(matterId);
  if (Number.isNaN(id)) return null;
  const [owned] = await db
    .select({ id: litMatters.id })
    .from(litMatters)
    .where(and(eq(litMatters.id, id), eq(litMatters.accessCodeId, accessCodeId)))
    .limit(1);
  return owned ? owned.id : false;
}

// ── Bundle CRUD ──────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const { matterId } = req.query;
  let where = eq(litBundles.accessCodeId, accessCodeId);
  if (matterId && typeof matterId === "string") {
    const mid = parseInt(matterId, 10);
    if (!Number.isNaN(mid)) {
      where = and(eq(litBundles.accessCodeId, accessCodeId), eq(litBundles.matterId, mid))!;
    }
  }
  const rows = await db
    .select()
    .from(litBundles)
    .where(where)
    .orderBy(desc(litBundles.updatedAt));
  res.json(rows);
});

function normaliseBundleBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of ["title", "bundleType", "court", "suitNo", "parties"]) {
    const v = body[f];
    if (typeof v === "string") out[f] = v.slice(0, 500);
  }
  if (typeof body.notes === "string") out.notes = body.notes.slice(0, MAX_NOTES);
  if (body.startPage !== undefined) {
    const n = parseInt(String(body.startPage), 10);
    if (!Number.isNaN(n) && n >= 1) out.startPage = n;
  }
  return out;
}

router.post("/", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const data = normaliseBundleBody(req.body ?? {});
  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const matterId = await resolveMatterId(accessCodeId, req.body?.matterId);
  if (matterId === false) {
    res.status(404).json({ error: "matter not found" });
    return;
  }
  const [row] = await db
    .insert(litBundles)
    .values({ ...(data as object), accessCodeId, matterId, title: (data.title as string).trim() })
    .returning();
  res.status(201).json(row);
});

// Build the running, paginated index for a bundle.
function buildIndex(
  bundle: typeof litBundles.$inferSelect,
  docs: (typeof litBundleDocuments.$inferSelect)[],
) {
  let page = bundle.startPage ?? 1;
  const items = docs.map((d, i) => {
    const count = Math.max(1, d.pageCount ?? 1);
    const startPage = page;
    const endPage = page + count - 1;
    page = endPage + 1;
    return {
      tab: i + 1,
      id: d.id,
      section: d.section ?? null,
      title: d.title,
      docType: d.docType,
      docDate: d.docDate ?? null,
      pageCount: count,
      startPage,
      endPage,
      pageLabel: count === 1 ? `${startPage}` : `${startPage}–${endPage}`,
    };
  });
  return { items, totalPages: page - (bundle.startPage ?? 1), lastPage: page - 1 };
}

router.get("/:id", async (req, res) => {
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  const docs = await db
    .select()
    .from(litBundleDocuments)
    .where(eq(litBundleDocuments.bundleId, bundle.id))
    .orderBy(asc(litBundleDocuments.sortOrder), asc(litBundleDocuments.id));
  res.json({ ...bundle, documents: docs, index: buildIndex(bundle, docs) });
});

router.patch("/:id", async (req, res) => {
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  const data = normaliseBundleBody(req.body ?? {});
  if (req.body?.matterId !== undefined) {
    const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
    const matterId = await resolveMatterId(accessCodeId, req.body.matterId);
    if (matterId === false) {
      res.status(404).json({ error: "matter not found" });
      return;
    }
    (data as Record<string, unknown>).matterId = matterId;
  }
  const [row] = await db
    .update(litBundles)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(eq(litBundles.id, bundle.id))
    .returning();
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  await db.delete(litBundles).where(eq(litBundles.id, bundle.id));
  res.json({ success: true });
});

// ── Documents ────────────────────────────────────────────────────────────────

function normaliseDocBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (typeof body.title === "string") out.title = body.title.slice(0, 500);
  if (typeof body.section === "string") out.section = body.section.slice(0, 300);
  if (typeof body.docType === "string") out.docType = body.docType.slice(0, 50);
  if (typeof body.docDate === "string") out.docDate = body.docDate.slice(0, 100);
  if (body.pageCount !== undefined) {
    const n = parseInt(String(body.pageCount), 10);
    if (!Number.isNaN(n) && n >= 1) out.pageCount = n;
  }
  if (body.sortOrder !== undefined) {
    const n = parseInt(String(body.sortOrder), 10);
    if (!Number.isNaN(n)) out.sortOrder = n;
  }
  return out;
}

router.post("/:id/documents", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  const data = normaliseDocBody(req.body ?? {});
  if (!data.title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (data.sortOrder === undefined) {
    const [last] = await db
      .select({ max: litBundleDocuments.sortOrder })
      .from(litBundleDocuments)
      .where(eq(litBundleDocuments.bundleId, bundle.id))
      .orderBy(desc(litBundleDocuments.sortOrder))
      .limit(1);
    data.sortOrder = (last?.max ?? -1) + 1;
  }
  const [row] = await db
    .insert(litBundleDocuments)
    .values({
      ...(data as { title: string }),
      bundleId: bundle.id,
      accessCodeId,
    })
    .returning();
  await db.update(litBundles).set({ updatedAt: new Date() }).where(eq(litBundles.id, bundle.id));
  res.status(201).json(row);
});

router.patch("/:id/documents/:docId", async (req, res) => {
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  const docId = parseInt((req.params.docId as string), 10);
  if (Number.isNaN(docId)) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const data = normaliseDocBody(req.body ?? {});
  const [row] = await db
    .update(litBundleDocuments)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(and(eq(litBundleDocuments.id, docId), eq(litBundleDocuments.bundleId, bundle.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(row);
});

router.delete("/:id/documents/:docId", async (req, res) => {
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  const docId = parseInt((req.params.docId as string), 10);
  if (Number.isNaN(docId)) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const [row] = await db
    .delete(litBundleDocuments)
    .where(and(eq(litBundleDocuments.id, docId), eq(litBundleDocuments.bundleId, bundle.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json({ success: true });
});

// Reorder documents — body: { order: number[] } (document ids in new order).
router.post("/:id/reorder", requireSubscription, async (req, res) => {
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  const order = Array.isArray(req.body?.order) ? req.body.order : [];
  const ids = order.map((x: unknown) => Number(x)).filter((n: number) => !Number.isNaN(n));
  if (ids.length === 0) {
    res.status(400).json({ error: "order array is required" });
    return;
  }
  for (let i = 0; i < ids.length; i++) {
    await db
      .update(litBundleDocuments)
      .set({ sortOrder: i, updatedAt: new Date() })
      .where(and(eq(litBundleDocuments.id, ids[i]), eq(litBundleDocuments.bundleId, bundle.id)));
  }
  const docs = await db
    .select()
    .from(litBundleDocuments)
    .where(eq(litBundleDocuments.bundleId, bundle.id))
    .orderBy(asc(litBundleDocuments.sortOrder), asc(litBundleDocuments.id));
  res.json({ documents: docs, index: buildIndex(bundle, docs) });
});

export default router;
