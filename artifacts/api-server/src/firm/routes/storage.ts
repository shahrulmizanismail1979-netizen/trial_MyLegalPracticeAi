import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "../apiZod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import {
  trackPendingUpload,
} from "../lib/uploadTracker";
import { and, eq } from "drizzle-orm";
import { db, taskEvidenceTable } from "../db";
import { currentFirmWorkspaceId, firmScope } from "../lib/workspace";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Per-user sliding-window rate limit for upload URL minting.
// Bounds the blast radius even when a session is valid: at most
// UPLOAD_RATE_MAX signed PUT URLs per UPLOAD_RATE_WINDOW_MS per user.
const uploadRateLimiter = new Map<string, number[]>();
const UPLOAD_RATE_WINDOW_MS = 60_000;
const UPLOAD_RATE_MAX = 10;

function checkUploadRateLimit(workspaceId: number, userId: number): boolean {
  const key = `${workspaceId}:${userId}`;
  const now = Date.now();
  const timestamps = (uploadRateLimiter.get(key) ?? []).filter(
    (t) => now - t < UPLOAD_RATE_WINDOW_MS,
  );
  if (timestamps.length >= UPLOAD_RATE_MAX) return false;
  timestamps.push(now);
  uploadRateLimiter.set(key, timestamps);
  return true;
}

// Allowlist of MIME types that may be uploaded as task evidence.
// Rejects arbitrary binary uploads that have no legitimate business purpose.
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg",
  "video/mp4", "video/webm",
]);

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload. Past the global staff/manager
 * session gate (app.ts), any signed-in user may request one; actingUserId is
 * used only for attribution and per-user abuse bounding (rate limit +
 * pending-upload cap), never as an authorization claim.
 *
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  const { actingUserId, name, size, contentType } = parsed.data;

  // Past the global staff/manager session gate (app.ts), any signed-in user may
  // request an upload URL. We no longer require a separate per-user storage
  // session; actingUserId is used only for attribution and per-user abuse
  // bounding (rate limit + pending-upload cap).
  const uploaderId = actingUserId;
  const workspaceId = currentFirmWorkspaceId();

  if (!checkUploadRateLimit(workspaceId, uploaderId)) {
    res.status(429).json({ error: "Too many upload requests. Please wait before requesting another upload URL." });
    return;
  }

  if (!ALLOWED_MIME_TYPES.has(contentType)) {
    res.status(400).json({ error: `Content type '${contentType}' is not permitted for upload.` });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL(workspaceId);
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    // Reservation is persisted and cap-checked under a database advisory lock,
    // so restarts and concurrent instances cannot mint around the limit.
    if (!(await trackPendingUpload(workspaceId, uploaderId, objectPath))) {
      res.status(429).json({ error: "Too many unclaimed uploads. Complete or cancel pending uploads before requesting a new URL." });
      return;
    }

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
 * Serve public assets — no authentication required.
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
 * Serve private object entities from PRIVATE_OBJECT_DIR.
 * Requires an active storage session. The session-bound userId is used as the
 * authoritative actor for ACL checks — the URL carries no identity claim.
 * Managers bypass per-object ACL checks and may access all private objects.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  // Past the global staff/manager session gate (app.ts) — and the deliberate
  // header-gate exemption that lets <img>/<a> navigations through — any signed-in
  // user may read evidence objects. Per-object ACL is intentionally not enforced
  // (evidence is shared team-wide), consistent with the shared-passcode model.
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    // Object names are not bearer credentials. A persisted evidence row in the
    // authenticated workspace is the authoritative read grant.
    const [grant] = await db
      .select({ id: taskEvidenceTable.id })
      .from(taskEvidenceTable)
      .where(
        and(
          eq(taskEvidenceTable.objectPath, objectPath),
          firmScope(taskEvidenceTable),
        ),
      )
      .limit(1);
    if (!grant) {
      res.status(404).json({ error: "Object not found" });
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
