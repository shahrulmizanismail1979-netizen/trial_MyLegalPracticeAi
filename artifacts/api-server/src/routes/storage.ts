import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { checkStaff } from "../middlewares/requireAdmin";
import { db, contributionPendingUploadsTable } from "@workspace/db";
import { lt, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// How long an issued upload grant stays valid before the uploader must
// submit the contribution referencing it.
const UPLOAD_GRANT_TTL_MS = 2 * 60 * 60 * 1000;

// Idempotent boot-time ensure (mirrors lit/routes/uploads.ts): production
// applies SQL migrations additively with no automatic runner, so guarantee
// the grants table exists before the first upload request. Also see
// lib/db/sql/migrations/0025.
void db
  .execute(
    sql`CREATE TABLE IF NOT EXISTS contribution_pending_uploads (
      id SERIAL PRIMARY KEY,
      object_path TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  )
  .then(() => {})
  .catch((err: unknown) =>
    logger.error({ err }, "Failed to ensure contribution_pending_uploads table"),
  );

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    // Record the server-issued grant so POST /contributions can prove this
    // objectPath came from us (and consume it exactly once). Fail closed:
    // without the grant row, the later submission would be rejected anyway.
    await db
      .insert(contributionPendingUploadsTable)
      .values({
        objectPath,
        expiresAt: new Date(Date.now() + UPLOAD_GRANT_TTL_MS),
      })
      .onConflictDoNothing();

    // Opportunistic cleanup of long-expired grants.
    void db
      .delete(contributionPendingUploadsTable)
      .where(lt(contributionPendingUploadsTable.expiresAt, new Date(Date.now() - 24 * 60 * 60 * 1000)))
      .catch(() => {});

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 *
 * ALL contribution files are staff-only, including approved ones: the original
 * uploads contain real client names and personal details. The public
 * knowledge-base corpus only ever exposes the AI-anonymised text, never the
 * original document. Staff access works over the browser because the web app
 * carries the Clerk session as a cookie, which is sent on ordinary
 * navigations too.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    // Original documents may contain real client details — staff only.
    const access = await checkStaff(req);
    if (access === "anonymous") {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (access !== "staff") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
