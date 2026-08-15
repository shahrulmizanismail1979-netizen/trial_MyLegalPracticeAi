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
  litSavedWork,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { requireSubscription } from "./billing";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { registerPendingUpload, consumePendingUpload } from "./uploads";
import { logger } from "../../lib/logger";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

// Idempotent boot-time ensure: production applies SQL migrations additively,
// so guarantee the provenance columns exist before the first request.
// Mirrors lib/db/sql/migrations/0029-bundle-doc-files.sql.
const ensureColumns = db
  .execute(
    sql`ALTER TABLE lit_bundle_documents
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS object_path TEXT,
      ADD COLUMN IF NOT EXISTS file_name TEXT,
      ADD COLUMN IF NOT EXISTS content_type TEXT,
      ADD COLUMN IF NOT EXISTS size_bytes INTEGER,
      ADD COLUMN IF NOT EXISTS saved_work_id INTEGER`,
  )
  .then(() => {})
  .catch((err: unknown) =>
    logger.error({ err }, "Failed to ensure lit_bundle_documents columns"),
  );
router.use(async (_req, _res, next) => {
  await ensureColumns;
  next();
});

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
      source: d.source ?? "manual",
      fileName: d.fileName ?? null,
      hasFile: Boolean(d.objectPath),
      savedWorkId: d.savedWorkId ?? null,
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
    // Durable matter integrity: moving a bundle onto a matter must not smuggle
    // in cause papers filed to a different (or no) matter. Reject the change
    // while any linked saved-work item isn't filed to the target matter.
    if (matterId !== null && matterId !== bundle.matterId) {
      const linkedDocs = await db
        .select({ savedWorkId: litBundleDocuments.savedWorkId })
        .from(litBundleDocuments)
        .where(eq(litBundleDocuments.bundleId, bundle.id));
      const linkedIds = linkedDocs
        .map((d) => d.savedWorkId)
        .filter((n): n is number => typeof n === "number");
      if (linkedIds.length > 0) {
        const matching = await db
          .select({ id: litSavedWork.id })
          .from(litSavedWork)
          .where(
            and(
              inArray(litSavedWork.id, linkedIds),
              eq(litSavedWork.accessCodeId, accessCodeId),
              eq(litSavedWork.matterId, matterId),
            ),
          );
        if (matching.length !== linkedIds.length) {
          res.status(400).json({
            error:
              "This bundle contains linked cause papers filed to a different matter. Remove them before changing the bundle's matter.",
          });
          return;
        }
      }
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
  // Clean up stored files for uploaded documents before the cascade delete.
  const docs = await db
    .select({ objectPath: litBundleDocuments.objectPath })
    .from(litBundleDocuments)
    .where(eq(litBundleDocuments.bundleId, bundle.id));
  await db.delete(litBundles).where(eq(litBundles.id, bundle.id));
  for (const d of docs) await bestEffortDeleteObject(d.objectPath);
  res.json({ success: true });
});

// ── Documents ────────────────────────────────────────────────────────────────

const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".docx"];
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

function sanitiseFileName(name: string): string {
  return name.replace(/[\r\n"\\]/g, "_").slice(0, 300) || "document";
}

function isAllowedUpload(fileName: string, contentType: string): boolean {
  const lower = fileName.toLowerCase();
  if (ALLOWED_UPLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  return (
    contentType === "application/pdf" ||
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

// Read the first `n` bytes of a stored object without downloading the whole
// file (uploads may be up to 100MB).
function readFirstBytes(
  file: Awaited<ReturnType<typeof objectStorage.getObjectEntityFile>>,
  n: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let got = 0;
    const stream = (file.createReadStream as (opts?: { start: number; end: number }) => NodeJS.ReadableStream)({
      start: 0,
      end: Math.max(0, n - 1),
    });
    stream.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      got += chunk.length;
      if (got >= n) {
        (stream as unknown as { destroy?: () => void }).destroy?.();
        resolve(Buffer.concat(chunks).subarray(0, n));
      }
    });
    stream.on("end", () => resolve(Buffer.concat(chunks).subarray(0, n)));
    stream.on("error", reject);
  });
}

async function bestEffortDeleteObject(objectPath: string | null): Promise<void> {
  if (!objectPath) return;
  try {
    const file = await objectStorage.getObjectEntityFile(objectPath);
    await file.delete({ ignoreNotFound: true });
  } catch {
    /* object already gone or unreachable — the DB row is what matters */
  }
}

// Step 1 of an upload: mint a presigned PUT URL and bind the resulting object
// path to the caller's access code (one-time-use DB registry) so another
// subscriber can't attach someone else's pending upload.
router.post("/:id/documents/upload-url", requireSubscription, async (req, res) => {
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const fileName =
    typeof req.body?.fileName === "string" ? req.body.fileName : "upload";
  const contentType =
    typeof req.body?.contentType === "string" ? req.body.contentType : "";
  if (!isAllowedUpload(fileName, contentType)) {
    res.status(400).json({ error: "Only PDF and DOCX files can be added to a bundle." });
    return;
  }
  try {
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    await registerPendingUpload(objectPath, accessCodeId);
    res.json({ uploadURL, objectPath });
  } catch (err) {
    logger.error({ err }, "Failed to create bundle upload URL");
    res.status(500).json({ error: "Could not start the upload. Please try again." });
  }
});

// Step 2: after the browser PUTs the bytes, record the document row.
router.post("/:id/documents/from-upload", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawPath = typeof body.objectPath === "string" ? body.objectPath : "";
  if (!rawPath) {
    res.status(400).json({ error: "objectPath is required" });
    return;
  }
  const objectPath = objectStorage.normalizeObjectEntityPath(rawPath);
  if (!objectPath.startsWith("/objects/")) {
    res.status(400).json({ error: "Invalid upload reference" });
    return;
  }
  const fileName = sanitiseFileName(
    typeof body.fileName === "string" && body.fileName.trim()
      ? body.fileName
      : "document",
  );
  const contentType =
    typeof body.contentType === "string" ? body.contentType.slice(0, 200) : "";
  if (!isAllowedUpload(fileName, contentType)) {
    res.status(400).json({ error: "Only PDF and DOCX files can be added to a bundle." });
    return;
  }
  // Ownership check: only the session that requested the upload URL may
  // attach the stored object. One-time use, consumed atomically.
  const owned = await consumePendingUpload(objectPath, accessCodeId);
  if (!owned) {
    res.status(400).json({
      error: "File reference is invalid or has expired. Please upload the file again.",
    });
    return;
  }
  // Verify the object actually exists, isn't oversized, and the bytes really
  // are a PDF (%PDF) or DOCX (ZIP, PK\x03\x04) — the name/MIME the client
  // supplied is not trusted on its own.
  let sizeBytes: number | null = null;
  try {
    const file = await objectStorage.getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    sizeBytes = Number(metadata.size ?? 0) || null;
    if (sizeBytes !== null && sizeBytes > MAX_UPLOAD_BYTES) {
      await bestEffortDeleteObject(objectPath);
      res.status(413).json({
        error: `File too large. Each file must be under ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`,
      });
      return;
    }
    const head = await readFirstBytes(file, 4);
    const isPdf = head.length >= 4 && head.toString("latin1", 0, 4) === "%PDF";
    const isZip =
      head.length >= 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
    if (!isPdf && !isZip) {
      await bestEffortDeleteObject(objectPath);
      res.status(400).json({
        error: "The uploaded file is not a valid PDF or DOCX document.",
      });
      return;
    }
  } catch {
    res.status(400).json({ error: "The uploaded file could not be found. Please try again." });
    return;
  }
  const data = normaliseDocBody(body);
  const title =
    (typeof data.title === "string" && data.title.trim()) ||
    fileName.replace(/\.(pdf|docx)$/i, "");
  const [last] = await db
    .select({ max: litBundleDocuments.sortOrder })
    .from(litBundleDocuments)
    .where(eq(litBundleDocuments.bundleId, bundle.id))
    .orderBy(desc(litBundleDocuments.sortOrder))
    .limit(1);
  const [row] = await db
    .insert(litBundleDocuments)
    .values({
      ...(data as object),
      title,
      sortOrder: (data.sortOrder as number | undefined) ?? (last?.max ?? -1) + 1,
      bundleId: bundle.id,
      accessCodeId,
      source: "upload",
      objectPath,
      fileName,
      contentType: contentType || null,
      sizeBytes,
    })
    .returning();
  await db.update(litBundles).set({ updatedAt: new Date() }).where(eq(litBundles.id, bundle.id));
  res.status(201).json(row);
});

// Stream an uploaded document back. Ownership-checked; login only (no
// subscription needed to retrieve your own files).
router.get("/:id/documents/:docId/download", async (req, res) => {
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  const docId = parseInt((req.params.docId as string), 10);
  if (Number.isNaN(docId)) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const [doc] = await db
    .select()
    .from(litBundleDocuments)
    .where(and(eq(litBundleDocuments.id, docId), eq(litBundleDocuments.bundleId, bundle.id)))
    .limit(1);
  if (!doc || !doc.objectPath) {
    res.status(404).json({ error: "No stored file for this document" });
    return;
  }
  try {
    const file = await objectStorage.getObjectEntityFile(doc.objectPath);
    const [metadata] = await file.getMetadata();
    res.setHeader(
      "Content-Type",
      doc.contentType || (metadata.contentType as string) || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${sanitiseFileName(doc.fileName || "document")}"`,
    );
    if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
    file.createReadStream().pipe(res);
  } catch (e) {
    if (e instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Stored file not found" });
      return;
    }
    res.status(500).json({ error: "Could not retrieve the document" });
  }
});

// ── Cause-paper linking ──────────────────────────────────────────────────────

// List the caller's saved work (cause papers etc. generated in the app) that
// can be linked into this bundle. Filtered to the bundle's matter when the
// bundle is linked to one; already-linked items are excluded.
router.get("/:id/linkable-work", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  const linked = await db
    .select({ savedWorkId: litBundleDocuments.savedWorkId })
    .from(litBundleDocuments)
    .where(eq(litBundleDocuments.bundleId, bundle.id));
  const linkedIds = linked
    .map((r) => r.savedWorkId)
    .filter((n): n is number => typeof n === "number");
  const predicates = [eq(litSavedWork.accessCodeId, accessCodeId)];
  if (bundle.matterId != null) predicates.push(eq(litSavedWork.matterId, bundle.matterId));
  const rows = await db
    .select({
      id: litSavedWork.id,
      kind: litSavedWork.kind,
      title: litSavedWork.title,
      matter: litSavedWork.matter,
      matterId: litSavedWork.matterId,
      updatedAt: litSavedWork.updatedAt,
    })
    .from(litSavedWork)
    .where(and(...predicates))
    .orderBy(desc(litSavedWork.updatedAt))
    .limit(200);
  const available = linkedIds.length
    ? rows.filter((r) => !linkedIds.includes(r.id))
    : rows;
  res.json({ items: available, matterScoped: bundle.matterId != null });
});

// Link a saved-work item (e.g. a drafted cause paper) into the bundle as a
// document entry.
router.post("/:id/documents/from-saved-work", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const bundle = await getOwnedBundle(req, res, (req.params.id as string));
  if (!bundle) return;
  const savedWorkId = Number(req.body?.savedWorkId);
  if (!Number.isFinite(savedWorkId)) {
    res.status(400).json({ error: "savedWorkId is required" });
    return;
  }
  const [work] = await db
    .select()
    .from(litSavedWork)
    .where(and(eq(litSavedWork.id, savedWorkId), eq(litSavedWork.accessCodeId, accessCodeId)))
    .limit(1);
  if (!work) {
    res.status(404).json({ error: "Saved work not found" });
    return;
  }
  // Matter integrity: a matter-linked bundle only accepts cause papers filed
  // to that same matter (mirrors the /linkable-work filter, enforced here so
  // direct API calls can't cross-attach another case's papers). Bundles with
  // no matter deliberately accept any of the subscriber's saved work.
  if (bundle.matterId != null && work.matterId !== bundle.matterId) {
    res.status(400).json({
      error: "This item belongs to a different matter than the bundle.",
    });
    return;
  }
  const [existing] = await db
    .select({ id: litBundleDocuments.id })
    .from(litBundleDocuments)
    .where(
      and(
        eq(litBundleDocuments.bundleId, bundle.id),
        eq(litBundleDocuments.savedWorkId, work.id),
      ),
    )
    .limit(1);
  if (existing) {
    res.status(409).json({ error: "This item is already in the bundle" });
    return;
  }
  const data = normaliseDocBody(req.body ?? {});
  const [last] = await db
    .select({ max: litBundleDocuments.sortOrder })
    .from(litBundleDocuments)
    .where(eq(litBundleDocuments.bundleId, bundle.id))
    .orderBy(desc(litBundleDocuments.sortOrder))
    .limit(1);
  const [row] = await db
    .insert(litBundleDocuments)
    .values({
      ...(data as object),
      title: (typeof data.title === "string" && data.title.trim()) || work.title,
      docType: (data.docType as string | undefined) ?? "pleading",
      sortOrder: (data.sortOrder as number | undefined) ?? (last?.max ?? -1) + 1,
      bundleId: bundle.id,
      accessCodeId,
      source: "saved-work",
      savedWorkId: work.id,
    })
    .returning();
  await db.update(litBundles).set({ updatedAt: new Date() }).where(eq(litBundles.id, bundle.id));
  res.status(201).json(row);
});

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
  await bestEffortDeleteObject(row.objectPath);
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
