import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db } from "@workspace/db";
import {
  litClients,
  litClientDocuments,
  litMatters,
  litSavedWork,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireSubscription } from "./billing";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

// ── Auth: the Client Vault is the one IRAC area that requires login ──────────
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

router.use(requireAuth);

const MAX_NOTES = 20_000;

// Fetch a client and assert it belongs to the caller. Sends the error response
// and returns undefined when not found / not owned.
async function getOwnedClient(req: Request, res: Response, idParam: string) {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const id = parseInt(idParam, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid client id" });
    return undefined;
  }
  const [row] = await db
    .select()
    .from(litClients)
    .where(and(eq(litClients.id, id), eq(litClients.accessCodeId, accessCodeId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Client not found" });
    return undefined;
  }
  return row;
}

function normaliseClientBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of ["name", "reference", "clientType", "email", "phone", "address"]) {
    const v = body[f];
    if (typeof v === "string") out[f] = v.slice(0, 500);
  }
  if (typeof body.notes === "string") out.notes = body.notes.slice(0, MAX_NOTES);
  return out;
}

function sanitiseFileName(name: string): string {
  const base = name.replace(/[\r\n"]/g, "").trim().slice(0, 255);
  return base || "document";
}

// ── Static routes (must precede "/:id") ──────────────────────────────────────

// Everything the caller could attach to a client: their saved work and matters,
// each carrying its current clientId so the UI can show/toggle the link.
router.get("/assignable", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const [work, matters] = await Promise.all([
    db
      .select({
        id: litSavedWork.id,
        title: litSavedWork.title,
        kind: litSavedWork.kind,
        clientId: litSavedWork.clientId,
        updatedAt: litSavedWork.updatedAt,
      })
      .from(litSavedWork)
      .where(eq(litSavedWork.accessCodeId, accessCodeId))
      .orderBy(desc(litSavedWork.updatedAt)),
    db
      .select({
        id: litMatters.id,
        title: litMatters.title,
        suitNo: litMatters.suitNo,
        clientId: litMatters.clientId,
        updatedAt: litMatters.updatedAt,
      })
      .from(litMatters)
      .where(eq(litMatters.accessCodeId, accessCodeId))
      .orderBy(desc(litMatters.updatedAt)),
  ]);
  res.json({ work, matters });
});

// Stream a document for download. Read-only, ownership-checked — needs login
// but not a subscription (you can always retrieve your own files).
router.get("/documents/:docId/download", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const docId = parseInt((req.params.docId as string), 10);
  if (Number.isNaN(docId)) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const [doc] = await db
    .select()
    .from(litClientDocuments)
    .where(
      and(
        eq(litClientDocuments.id, docId),
        eq(litClientDocuments.accessCodeId, accessCodeId),
      ),
    )
    .limit(1);
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
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
      `attachment; filename="${sanitiseFileName(doc.fileName)}"`,
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

// Link / unlink a saved-work item to a client (set or clear its clientId).
router.patch("/work/:workId/client", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const workId = parseInt((req.params.workId as string), 10);
  if (Number.isNaN(workId)) {
    res.status(400).json({ error: "Invalid work id" });
    return;
  }
  const clientId = await resolveClientIdParam(req, res, accessCodeId);
  if (clientId === false) return;
  const [row] = await db
    .update(litSavedWork)
    .set({ clientId, updatedAt: new Date() })
    .where(
      and(eq(litSavedWork.id, workId), eq(litSavedWork.accessCodeId, accessCodeId)),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Saved work not found" });
    return;
  }
  res.json(row);
});

// Link / unlink a matter to a client (set or clear its clientId).
router.patch("/matters/:matterId/client", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const matterId = parseInt((req.params.matterId as string), 10);
  if (Number.isNaN(matterId)) {
    res.status(400).json({ error: "Invalid matter id" });
    return;
  }
  const clientId = await resolveClientIdParam(req, res, accessCodeId);
  if (clientId === false) return;
  const [row] = await db
    .update(litMatters)
    .set({ clientId, updatedAt: new Date() })
    .where(and(eq(litMatters.id, matterId), eq(litMatters.accessCodeId, accessCodeId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Matter not found" });
    return;
  }
  res.json(row);
});

// Validates the `clientId` in the body: must be null (unlink) or a client the
// caller owns. Returns the value, or false after sending an error response.
async function resolveClientIdParam(
  req: Request,
  res: Response,
  accessCodeId: number,
): Promise<number | null | false> {
  const raw = (req.body ?? {}).clientId;
  if (raw === null || raw === undefined || raw === "") return null;
  const id = Number(raw);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid clientId" });
    return false;
  }
  const [row] = await db
    .select({ id: litClients.id })
    .from(litClients)
    .where(and(eq(litClients.id, id), eq(litClients.accessCodeId, accessCodeId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Client not found" });
    return false;
  }
  return id;
}

// ── Client CRUD ──────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const rows = await db
    .select()
    .from(litClients)
    .where(eq(litClients.accessCodeId, accessCodeId))
    .orderBy(desc(litClients.updatedAt));
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const client = await getOwnedClient(req, res, (req.params.id as string));
  if (!client) return;
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const [documents, work, matters] = await Promise.all([
    db
      .select()
      .from(litClientDocuments)
      .where(eq(litClientDocuments.clientId, client.id))
      .orderBy(desc(litClientDocuments.createdAt)),
    db
      .select()
      .from(litSavedWork)
      .where(
        and(
          eq(litSavedWork.clientId, client.id),
          eq(litSavedWork.accessCodeId, accessCodeId),
        ),
      )
      .orderBy(desc(litSavedWork.updatedAt)),
    db
      .select()
      .from(litMatters)
      .where(
        and(
          eq(litMatters.clientId, client.id),
          eq(litMatters.accessCodeId, accessCodeId),
        ),
      )
      .orderBy(desc(litMatters.updatedAt)),
  ]);
  res.json({ ...client, documents, work, matters });
});

router.post("/", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const data = normaliseClientBody(req.body ?? {});
  if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [row] = await db
    .insert(litClients)
    .values({ ...(data as object), accessCodeId, name: (data.name as string).trim() })
    .returning();
  res.status(201).json(row);
});

router.patch("/:id", requireSubscription, async (req, res) => {
  const client = await getOwnedClient(req, res, (req.params.id as string));
  if (!client) return;
  const data = normaliseClientBody(req.body ?? {});
  const [row] = await db
    .update(litClients)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(eq(litClients.id, client.id))
    .returning();
  res.json(row);
});

router.delete("/:id", requireSubscription, async (req, res) => {
  const client = await getOwnedClient(req, res, (req.params.id as string));
  if (!client) return;
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  // Best-effort: purge the stored bytes for every document before the rows go.
  const docs = await db
    .select({ objectPath: litClientDocuments.objectPath })
    .from(litClientDocuments)
    .where(eq(litClientDocuments.clientId, client.id));
  await Promise.all(docs.map((d) => bestEffortDeleteObject(d.objectPath)));
  // Detach (do not delete) any linked matters / saved work — they live on
  // independently; their clientId is a soft link, not a cascade.
  await Promise.all([
    db
      .update(litMatters)
      .set({ clientId: null })
      .where(
        and(eq(litMatters.clientId, client.id), eq(litMatters.accessCodeId, accessCodeId)),
      ),
    db
      .update(litSavedWork)
      .set({ clientId: null })
      .where(
        and(
          eq(litSavedWork.clientId, client.id),
          eq(litSavedWork.accessCodeId, accessCodeId),
        ),
      ),
  ]);
  await db.delete(litClients).where(eq(litClients.id, client.id));
  res.json({ success: true });
});

// ── Documents ────────────────────────────────────────────────────────────────

router.get("/:id/documents", async (req, res) => {
  const client = await getOwnedClient(req, res, (req.params.id as string));
  if (!client) return;
  const rows = await db
    .select()
    .from(litClientDocuments)
    .where(eq(litClientDocuments.clientId, client.id))
    .orderBy(desc(litClientDocuments.createdAt));
  res.json(rows);
});

// Step 1 of the upload: hand back a presigned PUT URL. The browser uploads the
// bytes straight to object storage, then calls POST /documents to record it.
router.post("/:id/documents/upload-url", requireSubscription, async (req, res) => {
  const client = await getOwnedClient(req, res, (req.params.id as string));
  if (!client) return;
  try {
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    res.json({ uploadURL });
  } catch {
    res.status(500).json({ error: "Could not prepare the upload" });
  }
});

// Step 2: persist the metadata after the browser has PUT the file.
router.post("/:id/documents", requireSubscription, async (req, res) => {
  const client = await getOwnedClient(req, res, (req.params.id as string));
  if (!client) return;
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawUrl = body.uploadURL ?? body.objectPath;
  if (typeof rawUrl !== "string" || !rawUrl) {
    res.status(400).json({ error: "uploadURL is required" });
    return;
  }
  const fileName =
    typeof body.fileName === "string" && body.fileName.trim()
      ? sanitiseFileName(body.fileName)
      : "document";
  const objectPath = objectStorage.normalizeObjectEntityPath(rawUrl);
  if (!objectPath.startsWith("/objects/")) {
    res.status(400).json({ error: "Invalid upload reference" });
    return;
  }
  const contentType =
    typeof body.contentType === "string" ? body.contentType.slice(0, 200) : null;
  const sizeBytes =
    body.sizeBytes !== undefined && Number.isFinite(Number(body.sizeBytes))
      ? Number(body.sizeBytes)
      : null;
  const label = typeof body.label === "string" ? body.label.slice(0, 300) : null;
  const [row] = await db
    .insert(litClientDocuments)
    .values({
      clientId: client.id,
      accessCodeId,
      fileName,
      objectPath,
      contentType,
      sizeBytes,
      label,
    })
    .returning();
  res.status(201).json(row);
});

router.delete("/documents/:docId", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const docId = parseInt((req.params.docId as string), 10);
  if (Number.isNaN(docId)) {
    res.status(400).json({ error: "Invalid document id" });
    return;
  }
  const [doc] = await db
    .delete(litClientDocuments)
    .where(
      and(
        eq(litClientDocuments.id, docId),
        eq(litClientDocuments.accessCodeId, accessCodeId),
      ),
    )
    .returning();
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await bestEffortDeleteObject(doc.objectPath);
  res.json({ success: true });
});

async function bestEffortDeleteObject(objectPath: string): Promise<void> {
  try {
    const file = await objectStorage.getObjectEntityFile(objectPath);
    await file.delete({ ignoreNotFound: true });
  } catch {
    /* object already gone or unreachable — the DB row is what matters */
  }
}

export default router;
