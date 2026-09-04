/**
 * Shared client document vault for every practice portal (Task #193).
 *
 * Lawyers safekeep client documents (ICs, agreements, court papers, medical
 * reports, correspondence) permanently against a matter or a client record.
 * Files live in private object storage; ownership lives in case_documents
 * keyed by (portal, owner_key) like the rest of the case-intelligence layer.
 *
 * Upload flow (presigned, ownership DB-backed — never in-memory):
 *   1. POST {P}/documents/upload-url            → presigned PUT URL + objectPath
 *      (grant registered in case_pending_uploads for this portal+owner)
 *   2. Browser PUTs the file to the presigned URL.
 *   3. POST {P}/documents                       → consumes the grant atomically
 *      (owner-checked DELETE..RETURNING) and inserts the case_documents row.
 *
 * Routes (all owner-level paths use ≥2 segments so they never collide with a
 * portal's GET /:id matter route):
 *   POST   {P}/documents/upload-url
 *   POST   {P}/documents/confirm                — confirm upload {objectPath, fileName, ...}
 *   GET    {P}/documents/list                   — list; filters: matterId, clientId, category, from, to, q
 *   PATCH  {P}/documents/:docId                 — rename / re-categorise / doc date
 *   DELETE {P}/documents/:docId                 — remove row + stored object
 *   GET    {P}/documents/:docId/download        — stream the file (ownership-checked)
 *   GET    {P}/:matterId/documents              — list documents of one matter
 */
import type { IRouter, Request, Response } from "express";
import { Readable } from "stream";
import { pool } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { verifyMatterOwnership } from "./caseOwnership";
import type { Portal } from "./caseStages";
import { logger } from "./logger";

type Row = Record<string, unknown>;
type GetOwnerKey = (req: Request, res: Response) => string | null;

const objectStorage = new ObjectStorageService();

const UPLOAD_GRANT_TTL_MS = 2 * 60 * 60 * 1000;

// Only these content types may ever be served inline (Preview). Anything
// else — notably HTML/SVG/XML which can execute script in the portal origin —
// is always forced to download as an attachment (stored-XSS defence).
const INLINE_SAFE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
]);
export function isInlineSafe(contentType: unknown): boolean {
  return (
    typeof contentType === "string" &&
    INLINE_SAFE_TYPES.has(contentType.split(";")[0].trim().toLowerCase())
  );
}
const MAX_NAME = 300;
export const DOCUMENT_CATEGORIES = [
  "correspondence",
  "cause_papers",
  "evidence",
  "client_kyc",
  "billing",
  "other",
] as const;

export async function ensureDocumentTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_documents (
      id SERIAL PRIMARY KEY,
      portal TEXT NOT NULL,
      owner_key TEXT NOT NULL,
      matter_id INTEGER,
      client_id INTEGER,
      object_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT,
      size_bytes BIGINT NOT NULL DEFAULT 0,
      category TEXT NOT NULL DEFAULT 'other',
      doc_date DATE,
      notes TEXT,
      extracted_text TEXT,
      extraction_metadata JSONB,
      evidence_verified BOOLEAN NOT NULL DEFAULT false,
      evidence_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS case_documents_owner_idx
      ON case_documents (portal, owner_key);
    CREATE INDEX IF NOT EXISTS case_documents_matter_idx
      ON case_documents (portal, owner_key, matter_id);
    ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS extracted_text TEXT;
    ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS extraction_metadata JSONB;
    ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS evidence_verified BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE case_documents ADD COLUMN IF NOT EXISTS evidence_verified_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS case_pending_uploads (
      id SERIAL PRIMARY KEY,
      portal TEXT NOT NULL,
      owner_key TEXT NOT NULL,
      matter_id INTEGER,
      object_path TEXT NOT NULL UNIQUE,
       purpose TEXT NOT NULL DEFAULT 'document',
      status TEXT NOT NULL DEFAULT 'pending',
      claimed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
     ALTER TABLE case_pending_uploads
       ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'document';
     ALTER TABLE case_pending_uploads
       ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
     ALTER TABLE case_pending_uploads
       ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
     ALTER TABLE case_pending_uploads
       ADD COLUMN IF NOT EXISTS matter_id INTEGER;
  `);
}

function cleanCategory(v: unknown): string {
  return typeof v === "string" && (DOCUMENT_CATEGORIES as readonly string[]).includes(v)
    ? v
    : "other";
}

function parseDate(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : v.slice(0, 10);
}

async function ownedClientId(
  portal: Portal,
  ownerKey: string,
  raw: unknown,
): Promise<number | null | "forbidden"> {
  const id = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!raw || Number.isNaN(id) || id <= 0) return null;
  const { rows } = await pool.query(
    `SELECT id FROM case_clients WHERE portal = $1 AND owner_key = $2 AND id = $3`,
    [portal, ownerKey, id],
  );
  return rows[0] ? id : "forbidden";
}

export function attachDocumentVault(opts: {
  router: IRouter;
  portal: Portal;
  pathPrefix?: string;
  getOwnerKey: GetOwnerKey;
}): void {
  const { router, portal, getOwnerKey } = opts;
  const P = opts.pathPrefix ?? "";

  const auth = (req: Request, res: Response): string | null => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return null;
    }
    return ownerKey;
  };

  async function ownedDoc(ownerKey: string, idParam: string, res: Response) {
    const id = parseInt(idParam, 10);
    if (Number.isNaN(id) || id <= 0) {
      res.status(400).json({ error: "Invalid document id" });
      return undefined;
    }
    const { rows } = await pool.query(
      `SELECT * FROM case_documents WHERE id = $1 AND portal = $2 AND owner_key = $3`,
      [id, portal, ownerKey],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Document not found" });
      return undefined;
    }
    return rows[0] as Row;
  }

  // Resolve + ownership-check optional matterId / clientId from a body or query.
  async function resolveLinks(
    ownerKey: string,
    src: Record<string, unknown>,
    res: Response,
  ): Promise<{ matterId: number | null; clientId: number | null } | undefined> {
    let matterId: number | null = null;
    if (src.matterId != null && src.matterId !== "") {
      const id = parseInt(String(src.matterId), 10);
      if (Number.isNaN(id) || id <= 0 || !(await verifyMatterOwnership(portal, id, ownerKey))) {
        res.status(404).json({ error: "Matter not found" });
        return undefined;
      }
      matterId = id;
    }
    let clientId: number | null = null;
    if (src.clientId != null && src.clientId !== "") {
      const r = await ownedClientId(portal, ownerKey, src.clientId);
      if (r === "forbidden" || r === null) {
        res.status(404).json({ error: "Client not found" });
        return undefined;
      }
      clientId = r;
    }
    return { matterId, clientId };
  }

  // ── Upload URL (grant registered per portal+owner in the DB) ─────────────

  router.post(`${P}/documents/upload-url`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    try {
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      await pool.query(
        `INSERT INTO case_pending_uploads (portal, owner_key, object_path, purpose, expires_at)
         VALUES ($1, $2, $3, 'document', $4) ON CONFLICT (object_path) DO NOTHING`,
        [portal, ownerKey, objectPath, new Date(Date.now() + UPLOAD_GRANT_TTL_MS)],
      );
      // Opportunistic cleanup of long-expired grants.
      void pool
        .query(`DELETE FROM case_pending_uploads WHERE expires_at < now() - interval '24 hours'`)
        .catch(() => {});
      res.json({ uploadURL, objectPath });
    } catch (err) {
      logger.error({ err, portal }, "document vault: failed to create upload URL");
      res.status(500).json({ error: "Could not start the upload. Please try again." });
    }
  });

  // ── Confirm upload → create document row ─────────────────────────────────

  router.post(`${P}/documents/confirm`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const objectPath = typeof b.objectPath === "string" ? b.objectPath : "";
    const fileName =
      typeof b.fileName === "string" && b.fileName.trim()
        ? b.fileName.trim().slice(0, MAX_NAME)
        : "";
    if (!objectPath || !fileName) {
      res.status(400).json({ error: "objectPath and fileName are required" });
      return;
    }
    const links = await resolveLinks(ownerKey, b, res);
    if (!links) return;
    if (links.matterId === null && links.clientId === null) {
      res.status(400).json({ error: "A document must be filed under a matter or a client" });
      return;
    }

    // Consume the grant atomically, owner-checked. Without a matching live
    // grant the objectPath was never issued to this owner (or was already
    // used) — reject and do NOT touch the object.
    const consumed = await pool.query(
      `DELETE FROM case_pending_uploads
       WHERE object_path = $1 AND portal = $2 AND owner_key = $3
         AND purpose = 'document' AND expires_at > now()
       RETURNING id`,
      [objectPath, portal, ownerKey],
    );
    if (consumed.rowCount === 0) {
      res.status(400).json({ error: "Upload reference is invalid or has expired. Please upload again." });
      return;
    }

    // Verify the object actually landed and capture canonical metadata.
    let size = 0;
    let contentType: string | null =
      typeof b.contentType === "string" ? b.contentType.slice(0, 200) : null;
    try {
      const file = await objectStorage.getObjectEntityFile(objectPath);
      const [meta] = await file.getMetadata();
      size = Number(meta.size ?? 0);
      contentType = (meta.contentType as string) || contentType;
    } catch (err) {
      logger.warn({ err, portal, objectPath }, "document vault: uploaded object missing");
      res.status(400).json({ error: "The uploaded file was not found. Please upload again." });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO case_documents
         (portal, owner_key, matter_id, client_id, object_path, file_name,
          content_type, size_bytes, category, doc_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        portal,
        ownerKey,
        links.matterId,
        links.clientId,
        objectPath,
        fileName,
        contentType,
        size,
        cleanCategory(b.category),
        parseDate(b.docDate),
        typeof b.notes === "string" ? b.notes.slice(0, 5000) : null,
      ],
    );
    res.status(201).json(rows[0]);
  });

  // ── List (owner-level, filterable) ────────────────────────────────────────

  router.get(`${P}/documents/list`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const q = req.query as Record<string, unknown>;
    const conds = [`portal = $1`, `owner_key = $2`];
    const vals: unknown[] = [portal, ownerKey];
    const add = (c: string, v: unknown) => {
      vals.push(v);
      conds.push(c.replace("?", `$${vals.length}`));
    };
    if (q.matterId) {
      const id = parseInt(String(q.matterId), 10);
      if (!Number.isNaN(id)) add(`matter_id = ?`, id);
    }
    if (q.clientId) {
      const id = parseInt(String(q.clientId), 10);
      if (!Number.isNaN(id)) add(`client_id = ?`, id);
    }
    if (typeof q.category === "string" && q.category) add(`category = ?`, cleanCategory(q.category));
    const from = parseDate(q.from);
    if (from) add(`COALESCE(doc_date, created_at::date) >= ?`, from);
    const to = parseDate(q.to);
    if (to) add(`COALESCE(doc_date, created_at::date) <= ?`, to);
    if (typeof q.q === "string" && q.q.trim()) add(`file_name ILIKE ?`, `%${q.q.trim()}%`);
    const { rows } = await pool.query(
      `SELECT * FROM case_documents WHERE ${conds.join(" AND ")}
       ORDER BY COALESCE(doc_date, created_at::date) DESC, id DESC LIMIT 500`,
      vals,
    );
    res.json({ documents: rows, categories: DOCUMENT_CATEGORIES });
  });

  // ── Matter-level convenience list ─────────────────────────────────────────

  router.get(`${P}/:matterId/documents`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0) {
      res.status(400).json({ error: "Invalid matter id" });
      return;
    }
    if (!(await verifyMatterOwnership(portal, matterId, ownerKey))) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }
    const { rows } = await pool.query(
      `SELECT * FROM case_documents
       WHERE portal = $1 AND owner_key = $2 AND matter_id = $3
       ORDER BY COALESCE(doc_date, created_at::date) DESC, id DESC`,
      [portal, ownerKey, matterId],
    );
    res.json({ documents: rows, categories: DOCUMENT_CATEGORIES });
  });

  // ── Rename / re-categorise ────────────────────────────────────────────────

  router.patch(`${P}/documents/:docId`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const doc = await ownedDoc(ownerKey, req.params.docId as string, res);
    if (!doc) return;
    const b = (req.body ?? {}) as Record<string, unknown>;
    const sets: string[] = [];
    const vals: unknown[] = [doc.id];
    const push = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (typeof b.fileName === "string" && b.fileName.trim())
      push("file_name", b.fileName.trim().slice(0, MAX_NAME));
    if (b.category !== undefined) push("category", cleanCategory(b.category));
    if (b.docDate !== undefined) push("doc_date", parseDate(b.docDate));
    if (typeof b.notes === "string") push("notes", b.notes.slice(0, 5000));
    if (b.matterId !== undefined || b.clientId !== undefined) {
      const links = await resolveLinks(ownerKey, b, res);
      if (!links) return;
      // Filing invariant: a document must always stay linked to a matter or
      // a client. Compute the post-update pair from existing row + changes.
      const nextMatter = b.matterId !== undefined ? links.matterId : (doc.matter_id as number | null);
      const nextClient = b.clientId !== undefined ? links.clientId : (doc.client_id as number | null);
      if (nextMatter === null && nextClient === null) {
        res.status(400).json({ error: "A document must stay filed under a matter or a client" });
        return;
      }
      if (b.matterId !== undefined) push("matter_id", links.matterId);
      if (b.clientId !== undefined) push("client_id", links.clientId);
    }
    if (sets.length === 0) {
      res.json(doc);
      return;
    }
    const { rows } = await pool.query(
      `UPDATE case_documents SET ${sets.join(", ")}, updated_at = now() WHERE id = $1 RETURNING *`,
      vals,
    );
    res.json(rows[0]);
  });

  // ── Delete (row first, then best-effort object removal) ──────────────────

  router.delete(`${P}/documents/:docId`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const doc = await ownedDoc(ownerKey, req.params.docId as string, res);
    if (!doc) return;
    await pool.query(`DELETE FROM case_documents WHERE id = $1`, [doc.id]);
    try {
      const file = await objectStorage.getObjectEntityFile(doc.object_path as string);
      await file.delete();
    } catch (err) {
      // The DB row is gone; a stranded object is harmless. Log and move on.
      logger.warn({ err, portal, docId: doc.id }, "document vault: object delete failed");
    }
    res.json({ success: true });
  });

  // ── Download (ownership-checked stream) ───────────────────────────────────

  router.get(`${P}/documents/:docId/download`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const doc = await ownedDoc(ownerKey, req.params.docId as string, res);
    if (!doc) return;
    try {
      const file = await objectStorage.getObjectEntityFile(doc.object_path as string);
      const response = await objectStorage.downloadObject(file, 0);
      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === "cache-control") return;
        res.setHeader(key, value);
      });
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Inline preview only for a strict safe-type allowlist; everything else
      // (HTML, SVG, XML, unknown types) is forced to attachment so it can
      // never execute in the portal origin.
      const inline = req.query.inline === "1" && isInlineSafe(doc.content_type);
      if (!isInlineSafe(doc.content_type)) {
        res.setHeader("Content-Type", "application/octet-stream");
      }
      res.setHeader(
        "Content-Disposition",
        `${inline ? "inline" : "attachment"}; filename="${String(doc.file_name).replace(/["\\\r\n]/g, "_")}"`,
      );
      if (response.body) {
        Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Stored file not found" });
        return;
      }
      logger.error({ err, portal, docId: doc.id }, "document vault: download failed");
      res.status(500).json({ error: "Failed to download the document" });
    }
  });
}
