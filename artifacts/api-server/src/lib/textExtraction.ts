import mammoth from "mammoth";
import { ObjectStorageService } from "./objectStorage";

export type ExtractionStatus = "extracted" | "unsupported" | "failed";

export interface ExtractionResult {
  status: ExtractionStatus;
  text: string | null;
}

const PDF_TYPES = ["application/pdf"];
const DOCX_TYPES = [
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const TEXT_TYPES = [
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
];

function detectKind(
  fileName: string,
  contentType: string | null | undefined,
): "pdf" | "docx" | "text" | "unsupported" {
  const ct = (contentType || "").toLowerCase();
  const name = fileName.toLowerCase();

  if (PDF_TYPES.includes(ct) || name.endsWith(".pdf")) return "pdf";
  if (DOCX_TYPES.includes(ct) || name.endsWith(".docx")) return "docx";
  if (
    TEXT_TYPES.some((t) => ct.startsWith(t)) ||
    /\.(txt|md|csv|json)$/.test(name)
  ) {
    return "text";
  }
  return "unsupported";
}

function normalizeText(raw: string): string {
  return raw.replace(/\u0000/g, "").replace(/\s+\n/g, "\n").trim();
}

/**
 * Download an uploaded object and extract its text where the format allows.
 * Supported: PDF, DOCX, and plain-text-like formats. Everything else is stored
 * and downloadable but flagged as "unsupported". Any parse error is "failed".
 */
export async function extractTextFromObject(params: {
  objectPath: string;
  fileName: string;
  contentType: string | null | undefined;
  storage: ObjectStorageService;
}): Promise<ExtractionResult> {
  const { objectPath, fileName, contentType, storage } = params;
  const kind = detectKind(fileName, contentType);

  if (kind === "unsupported") {
    return { status: "unsupported", text: null };
  }

  const file = await storage.getObjectEntityFile(objectPath);
  const [buffer] = await file.download();

  if (kind === "text") {
    const text = normalizeText(buffer.toString("utf-8"));
    return text.length > 0
      ? { status: "extracted", text }
      : { status: "unsupported", text: null };
  }

  if (kind === "docx") {
    const { value } = await mammoth.extractRawText({ buffer });
    const text = normalizeText(value);
    return text.length > 0
      ? { status: "extracted", text }
      : { status: "unsupported", text: null };
  }

  // pdf: pdf-parse v2 exposes a class-based API. It is externalized in the
  // esbuild config (it depends on native @napi-rs/canvas) and loaded lazily.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const { text: rawText } = await parser.getText();
    const text = normalizeText(rawText);
    return text.length > 0
      ? { status: "extracted", text }
      : { status: "unsupported", text: null };
  } finally {
    await parser.destroy();
  }
}
