import { Router, type IRouter } from "express";
import mammoth from "mammoth";
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
// Uploads are transient (extracted within minutes of issuance), so an
// in-memory registry with a short TTL is sufficient.
const PENDING_TTL_MS = 30 * 60 * 1000;
const pendingUploads = new Map<
  string,
  { accessCodeId: number; expiresAt: number }
>();

function prunePending(): void {
  const now = Date.now();
  for (const [key, val] of pendingUploads) {
    if (val.expiresAt < now) pendingUploads.delete(key);
  }
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
      prunePending();
      pendingUploads.set(objectPath, {
        accessCodeId: res.locals.accessCodeId as number,
        expiresAt: Date.now() + PENDING_TTL_MS,
      });
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

      prunePending();
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
          // may extract (and thereby delete) the stored object. One-time use.
          const pending = pendingUploads.get(objectPath);
          if (!pending || pending.accessCodeId !== callerCodeId) {
            throw new Error(
              "File reference is invalid or has expired. Please upload the file again.",
            );
          }
          pendingUploads.delete(objectPath);
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
