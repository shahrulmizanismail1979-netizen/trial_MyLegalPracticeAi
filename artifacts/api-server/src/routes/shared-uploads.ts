/**
 * Shared file-extraction endpoint — accepts multipart file uploads and returns
 * extracted plain text. No portal-specific auth required; this is pure file
 * processing (no user data is stored). Mounted at /api/shared/uploads/extract.
 *
 * Supported: PDF, DOCX, TXT, MD, RTF. Images (JPG, PNG) are accepted but
 * return a friendly error (OCR not available).
 */
import multer from "multer";
import { Router, type Request, type Response, type NextFunction } from "express";
import mammoth from "mammoth";
import { logger } from "../lib/logger.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;
const MAX_CHARS_PER_FILE = 100_000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

async function extractFromBuffer(
  buffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<string> {
  const lower = filename.toLowerCase();

  if (mimetype === "application/pdf" || lower.endsWith(".pdf")) {
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
          "This PDF appears to be scanned or image-based. Upload a text-based PDF, DOCX, or TXT.",
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
    lower.endsWith(".docx")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  if (
    mimetype.startsWith("text/") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".rtf")
  ) {
    return buffer.toString("utf-8");
  }

  if (
    mimetype.startsWith("image/") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp")
  ) {
    throw new Error(
      "Image files cannot be read as text. Please upload a PDF, DOCX, or TXT version of the document.",
    );
  }

  throw new Error(
    `Unsupported file type (${mimetype || filename}). Supported: PDF, DOCX, TXT, MD.`,
  );
}

function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.array("files", MAX_FILES)(req, res, (err: unknown): void => {
    if (err instanceof multer.MulterError) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "LIMIT_FILE_SIZE") {
        return void res.status(413).json({
          error: `File too large. Each file must be under ${MAX_FILE_BYTES / (1024 * 1024)} MB.`,
        });
      }
      return void res
        .status(400)
        .json({ error: (err as Error).message });
    }
    if (err) {
      logger.error({ err }, "shared upload middleware error");
      return void res.status(500).json({ error: "Upload failed" });
    }
    next();
  });
}

const router = Router();

router.post(
  "/shared/uploads/extract",
  uploadMiddleware,
  async (req: Request, res: Response): Promise<void> => {
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
              `\n\n[… truncated — ${(trimmed.length - MAX_CHARS_PER_FILE).toLocaleString()} characters omitted]`
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
              err instanceof Error ? err.message : "Failed to extract text",
          };
        }
      }),
    );

    return void res.json({ files: results });
  },
);

export default router;
