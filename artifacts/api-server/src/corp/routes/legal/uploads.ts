import { Router, type IRouter } from "express";
import mammoth from "mammoth";
import { db, corpPendingUploads } from "@workspace/db";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { logger } from "../../../lib/logger";
import { ObjectStorageService } from "../../../lib/objectStorage";
import { requireSession } from "../../lib/requireSession";

// Document upload + text extraction for corp AI tools (e.g. Legal Opinion
// Writer). Browser PUTs the file straight to object storage via a presigned
// URL (bypasses the platform's ~32MB edge body limit), then asks us to read
// + extract the stored object. Files are transient context only and are
// deleted from storage right after extraction.

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_CHARS_PER_FILE = 200_000;
// Aggregate budget per extraction request so the downstream Gemini prompt
// stays well within the model's input window even with several upload zones.
const MAX_CHARS_TOTAL = 600_000;

// Bind each issued upload path to the session's access code so one subscriber
// cannot extract (and thereby delete) another subscriber's pending upload.
// The registry is DB-backed (corp_pending_uploads) so ownership survives
// restarts and holds across multiple API instances. Rows are one-time use:
// consumed atomically (owner-checked DELETE ... RETURNING) at extraction.
const PENDING_TTL_MS = 30 * 60 * 1000;

// Idempotent boot-time ensure: production applies SQL migrations additively,
// so guarantee the registry table exists before the first upload request.
const ensureTable = db
  .execute(
    sql`CREATE TABLE IF NOT EXISTS corp_pending_uploads (
      id SERIAL PRIMARY KEY,
      object_path TEXT NOT NULL UNIQUE,
      access_code_id INTEGER NOT NULL
        REFERENCES corp_access_codes(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  )
  .then(() => {})
  .catch((err: unknown) =>
    logger.error({ err }, "Failed to ensure corp_pending_uploads table"),
  );

// Sweep all expired corp_pending_uploads rows and delete their storage objects.
// Called opportunistically on each upload-url request, and also on a periodic
// schedule so orphaned objects (from tab-closes mid-upload) are bounded.
export async function sweepExpiredCorpUploads(): Promise<void> {
  await ensureTable;
  const expired = await db
    .delete(corpPendingUploads)
    .where(lt(corpPendingUploads.expiresAt, new Date()))
    .returning({ objectPath: corpPendingUploads.objectPath });
  for (const row of expired) {
    try {
      const file = await objectStorage.getObjectEntityFile(row.objectPath);
      await file.delete({ ignoreNotFound: true });
    } catch {
      /* never uploaded or already gone — nothing to clean */
    }
  }
  if (expired.length > 0) {
    logger.info(
      { count: expired.length },
      "Swept expired corp pending uploads",
    );
  }
}

async function registerPendingUpload(
  objectPath: string,
  accessCodeId: number,
): Promise<void> {
  await ensureTable;
  // Opportunistically prune expired rows and best-effort delete their
  // abandoned storage objects so the bucket doesn't accumulate orphans.
  await sweepExpiredCorpUploads();

  // Object paths are generated with randomUUID() so two different upload
  // sessions will never share the same path in practice.  However, as a
  // defence-in-depth measure the INSERT uses ON CONFLICT DO UPDATE so that
  // if a path *were* ever reused the newest registration always wins:
  //   - accessCodeId is overwritten → the new session becomes the owner
  //   - expiresAt is refreshed      → the TTL window restarts
  //   - createdAt is updated        → ownership timestamp reflects the new session
  // This guarantees consumePendingUpload will accept the newer session and
  // correctly reject any stale reference from the previous session.
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PENDING_TTL_MS);
  await db
    .insert(corpPendingUploads)
    .values({
      objectPath,
      accessCodeId,
      expiresAt,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: corpPendingUploads.objectPath,
      set: {
        accessCodeId,
        expiresAt,
        createdAt: now,
      },
    });
}

// Atomically consumes the pending-upload row for this path IF it belongs to
// the caller and has not expired. Returns true when the caller owns it.
async function consumePendingUpload(
  objectPath: string,
  accessCodeId: number,
): Promise<boolean> {
  const deleted = await db
    .delete(corpPendingUploads)
    .where(
      and(
        eq(corpPendingUploads.objectPath, objectPath),
        eq(corpPendingUploads.accessCodeId, accessCodeId),
        gt(corpPendingUploads.expiresAt, new Date()),
      ),
    )
    .returning({ id: corpPendingUploads.id });
  return deleted.length > 0;
}

async function extractFromBuffer(
  buffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<string> {
  const lowerName = filename.toLowerCase();

  if (mimetype === "application/pdf" || lowerName.endsWith(".pdf")) {
    // pdf-parse v2 exposes a `PDFParse` class (not a callable default export).
    const { PDFParse } = (await import("pdf-parse")) as unknown as {
      PDFParse: new (opts: { data: Uint8Array }) => {
        getText: () => Promise<{ text?: string }>;
        destroy?: () => Promise<void>;
      };
    };
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const text = (result.text ?? "").trim();
      if (text.length < 20) {
        throw new Error(
          "This PDF appears to be scanned or image-based, so no selectable text could be read. Please upload a text-based PDF or a Word/TXT version.",
        );
      }
      return text;
    } finally {
      await parser.destroy?.();
    }
  }

  if (
    mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (
    mimetype.startsWith("text/") ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".rtf") ||
    lowerName.endsWith(".eml")
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error(
    `Unsupported file type: ${mimetype || filename}. Supported: PDF, DOCX, TXT, MD, EML.`,
  );
}

function truncate(raw: string): { text: string; truncated: boolean } {
  const trimmed = raw.trim();
  const truncated = trimmed.length > MAX_CHARS_PER_FILE;
  const text = truncated
    ? trimmed.slice(0, MAX_CHARS_PER_FILE) +
      `\n\n[… truncated — file exceeds ${MAX_CHARS_PER_FILE.toLocaleString()} characters; ${(trimmed.length - MAX_CHARS_PER_FILE).toLocaleString()} characters omitted]`
    : trimmed;
  return { text, truncated };
}

router.post(
  "/legal/uploads/upload-url",
  requireSession,
  async (req, res): Promise<void> => {
    try {
      const fileName =
        typeof req.body?.fileName === "string" ? req.body.fileName : "upload";
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      await registerPendingUpload(objectPath, res.locals.accessCodeId as number);
      logger.info({ fileName, objectPath }, "Issued corp doc upload URL");
      res.json({ uploadURL, objectPath });
    } catch (err) {
      logger.error({ err }, "Failed to create corp upload URL");
      res
        .status(500)
        .json({ error: "Could not start the upload. Please try again." });
    }
  },
);

router.post(
  "/legal/uploads/extract-stored",
  requireSession,
  async (req, res): Promise<void> => {
    try {
      const inputFiles = Array.isArray(req.body?.files) ? req.body.files : [];
      if (inputFiles.length === 0) {
        return void res.status(400).json({ error: "No files provided" });
      }
      if (inputFiles.length > MAX_FILES) {
        return void res.status(400).json({
          error: `Too many files. Maximum ${MAX_FILES} files per upload.`,
        });
      }

      const callerCodeId = res.locals.accessCodeId as number;

      // Process sequentially so we hold at most one (up to 100MB) file in
      // memory at a time — keeps peak RAM bounded.
      const results = [];
      let totalChars = 0;
      for (const f of inputFiles.slice(0, MAX_FILES) as unknown[]) {
        const item = (f ?? {}) as {
          name?: unknown;
          objectPath?: unknown;
          contentType?: unknown;
        };
        const name = typeof item.name === "string" ? item.name : "file";
        const objectPath =
          typeof item.objectPath === "string" ? item.objectPath : "";
        const contentType =
          typeof item.contentType === "string" ? item.contentType : "";

        let objectFile: Awaited<
          ReturnType<typeof objectStorage.getObjectEntityFile>
        > | null = null;
        try {
          if (!objectPath) throw new Error("Missing file reference.");
          // Ownership check: only the session that requested the upload URL
          // may extract (and thereby delete) the stored object. One-time use,
          // consumed atomically so concurrent requests cannot double-extract.
          const owned = await consumePendingUpload(objectPath, callerCodeId);
          if (!owned) {
            throw new Error(
              "File reference is invalid or has expired. Please upload the file again.",
            );
          }
          objectFile = await objectStorage.getObjectEntityFile(objectPath);
          const [metadata] = await objectFile.getMetadata();
          const size = Number(metadata.size ?? 0);
          if (size > MAX_FILE_BYTES) {
            throw new Error(
              `File too large. Each file must be under ${MAX_FILE_BYTES / (1024 * 1024)}MB.`,
            );
          }
          const [buffer] = await objectFile.download();
          const rawText = await extractFromBuffer(
            buffer,
            contentType || (metadata.contentType as string) || "",
            name,
          );
          let { text, truncated } = truncate(rawText);
          // Enforce the aggregate budget across all files in this request.
          const remaining = MAX_CHARS_TOTAL - totalChars;
          if (text.length > remaining) {
            text =
              remaining > 0
                ? text.slice(0, remaining) +
                  "\n\n[… truncated — combined size of uploaded documents exceeds the total limit for a single request]"
                : "";
            truncated = true;
            if (text.length === 0) {
              throw new Error(
                "Combined uploads exceed the total text limit for one request. Remove a file or upload a shorter version.",
              );
            }
          }
          totalChars += text.length;
          results.push({
            name,
            mimetype: contentType,
            size,
            chars: text.length,
            text,
            truncated,
          });
        } catch (err) {
          results.push({
            name,
            mimetype: contentType,
            size: 0,
            chars: 0,
            text: "",
            error:
              err instanceof Error
                ? (err as Error).message
                : "Failed to extract text",
          });
        } finally {
          // Transient context only — remove from storage once extracted so
          // the bucket doesn't accumulate orphans.
          try {
            await objectFile?.delete();
          } catch {
            /* best-effort cleanup */
          }
        }
      }

      res.json({ files: results });
    } catch (err) {
      logger.error({ err }, "Corp stored file extraction failed");
      const message =
        err instanceof Error ? (err as Error).message : "Failed to process files";
      res.status(500).json({ error: message });
    }
  },
);

export default router;
