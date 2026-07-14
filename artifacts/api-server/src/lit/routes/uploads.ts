import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { logger } from "../../lib/logger";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const objectStorage = new ObjectStorageService();

// The direct-to-storage endpoints below mint signed URLs and read stored
// objects, so they must be authenticated (the dropzone is only reached by
// logged-in users). This mirrors the per-router session gate used elsewhere.
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const sess = req.session as unknown as Record<string, unknown> | undefined;
  if (!sess || sess.authenticated !== true || !sess.accessCodeId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_CHARS_PER_FILE = 500_000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_BYTES,
    files: MAX_FILES,
  },
});

async function extractFromBuffer(
  buffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<string> {
  const lowerName = filename.toLowerCase();

  if (
    mimetype === "application/pdf" ||
    lowerName.endsWith(".pdf")
  ) {
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
    lowerName.endsWith(".rtf")
  ) {
    return buffer.toString("utf-8");
  }

  throw new Error(
    `Unsupported file type: ${mimetype || filename}. Supported: PDF, DOCX, TXT, MD.`,
  );
}

function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.array("files", MAX_FILES)(req, res, (err: unknown): void => {
    if (err instanceof multer.MulterError) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "LIMIT_FILE_SIZE") {
        return void res.status(413).json({
          error: `File too large. Each file must be under ${MAX_FILE_BYTES / (1024 * 1024)}MB.`,
        });
      }
      if (code === "LIMIT_FILE_COUNT" || code === "LIMIT_UNEXPECTED_FILE") {
        return void res.status(400).json({
          error: `Too many files. Maximum ${MAX_FILES} files per upload.`,
        });
      }
      return void res.status(400).json({ error: (err as Error).message });
    }
    if (err) {
      logger.error({ err }, "Upload middleware failure");
      return void res.status(500).json({ error: "Upload failed" });
    }
    next();
  });
}

router.post("/extract", uploadMiddleware, async (req, res): Promise<void> => {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      return void res.status(400).json({ error: "No files uploaded" });
    }

    const results = await Promise.all(
      files.map(async (file) => {
        try {
          const rawText = await extractFromBuffer(
            file.buffer,
            file.mimetype,
            file.originalname,
          );
          const trimmed = rawText.trim();
          const truncated = trimmed.length > MAX_CHARS_PER_FILE;
          const text = truncated
            ? trimmed.slice(0, MAX_CHARS_PER_FILE) +
              `\n\n[… truncated — file exceeds ${MAX_CHARS_PER_FILE.toLocaleString()} characters; ${(trimmed.length - MAX_CHARS_PER_FILE).toLocaleString()} characters omitted]`
            : trimmed;
          return {
            name: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            chars: text.length,
            text,
            truncated,
          };
        } catch (err) {
          return {
            name: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            chars: 0,
            text: "",
            error:
              err instanceof Error ? (err as Error).message : "Failed to extract text",
          };
        }
      }),
    );

    return void res.json({ files: results });
  } catch (err) {
    logger.error({ err }, "File extraction failed");
    const message =
      err instanceof Error ? (err as Error).message : "Failed to process files";
    return void res.status(500).json({ error: message });
  }
});

// --- Direct-to-object-storage path (bypasses the platform's ~32MB request
// body limit at the edge, which would otherwise 413 large uploads before they
// reach this server). The browser PUTs the file straight to storage using a
// short-lived presigned URL, then we read + extract it server-side. ---

function truncate(raw: string): { text: string; truncated: boolean } {
  const trimmed = raw.trim();
  const truncated = trimmed.length > MAX_CHARS_PER_FILE;
  const text = truncated
    ? trimmed.slice(0, MAX_CHARS_PER_FILE) +
      `\n\n[… truncated — file exceeds ${MAX_CHARS_PER_FILE.toLocaleString()} characters; ${(trimmed.length - MAX_CHARS_PER_FILE).toLocaleString()} characters omitted]`
    : trimmed;
  return { text, truncated };
}

router.post("/upload-url", requireAuth, async (req, res): Promise<void> => {
  try {
    const fileName =
      typeof req.body?.fileName === "string" ? req.body.fileName : "upload";
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    logger.info({ fileName, objectPath }, "Issued supporting-doc upload URL");
    return void res.json({ uploadURL, objectPath });
  } catch (err) {
    logger.error({ err }, "Failed to create upload URL");
    return void res
      .status(500)
      .json({ error: "Could not start the upload. Please try again." });
  }
});

router.post("/extract-stored", requireAuth, async (req, res): Promise<void> => {
  try {
    const inputFiles = Array.isArray(req.body?.files) ? req.body.files : [];
    if (inputFiles.length === 0) {
      return void res.status(400).json({ error: "No files provided" });
    }
    if (inputFiles.length > MAX_FILES) {
      return void res
        .status(400)
        .json({ error: `Too many files. Maximum ${MAX_FILES} files per upload.` });
    }

    // Process sequentially so we hold at most one (up to 100MB) file in memory
    // at a time, rather than all five at once — keeps peak RAM bounded.
    const results = [];
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
        const { text, truncated } = truncate(rawText);
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
          error: err instanceof Error ? (err as Error).message : "Failed to extract text",
        });
      } finally {
        // Supporting docs are transient context only — remove from storage
        // once extracted so the bucket doesn't accumulate orphans.
        try {
          await objectFile?.delete();
        } catch {
          /* best-effort cleanup */
        }
      }
    }

    return void res.json({ files: results });
  } catch (err) {
    logger.error({ err }, "Stored file extraction failed");
    const message =
      err instanceof Error ? (err as Error).message : "Failed to process files";
    return void res.status(500).json({ error: message });
  }
});

export default router;
