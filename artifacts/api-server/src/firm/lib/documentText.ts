import mammoth from "mammoth";

/** Thrown when a document's type is not supported for text extraction. */
export class UnsupportedDocumentError extends Error {}

/**
 * Extract plain text from an uploaded document buffer.
 * Supports PDF (embedded text only — not scanned images), Word (.docx) and plain text.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<string> {
  const name = (filename || "").toLowerCase();
  const type = (mimeType || "").toLowerCase();

  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  const isDocx =
    type.includes("officedocument.wordprocessingml") || name.endsWith(".docx");
  const isText =
    type.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md");

  if (isPdf) {
    // pdf-parse v2 exposes a class-based API. It is externalized in the
    // esbuild config (it depends on native @napi-rs/canvas) and loaded lazily.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const { text } = await parser.getText();
      return (text ?? "").trim();
    } finally {
      await parser.destroy();
    }
  }
  if (isDocx) {
    const res = await mammoth.extractRawText({ buffer });
    return (res?.value ?? "").trim();
  }
  if (isText) {
    return buffer.toString("utf-8").trim();
  }

  throw new UnsupportedDocumentError(
    "Unsupported document type. Upload a PDF, Word (.docx), or plain-text file.",
  );
}
