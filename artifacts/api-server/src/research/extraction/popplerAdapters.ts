import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type {
  ExtractedPage,
  NativeTextExtractorAdapter,
  PageImageRendererAdapter,
  RenderedPageImage,
  WordBox,
} from "../adapters";

// Poppler-backed extraction adapters (ADR 0005). pdftotext -bbox-layout
// yields per-word boxes in PDF points; pdftoppm renders page images.
// Plain-text containers pass through the native extractor with synthetic
// page geometry (form-feed page separation).

const execFileAsync = promisify(execFile);

export const RENDER_DPI = 200;

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "research-extract-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function binaryAvailable(bin: string): Promise<boolean> {
  try {
    await execFileAsync(bin, ["-v"]);
    return true;
  } catch (err) {
    // poppler tools print version to stderr and exit 0/99 depending on tool
    return !(err as NodeJS.ErrnoException).code?.toString().includes("ENOENT");
  }
}

let popplerChecked: boolean | null = null;

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Parse `pdftotext -bbox-layout` XML into per-page word boxes. */
export function parseBboxLayout(xml: string): ExtractedPage[] {
  const pages: ExtractedPage[] = [];
  const pageRe = /<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g;
  const wordRe =
    /<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/word>/g;
  let pm: RegExpExecArray | null;
  let pageNumber = 0;
  while ((pm = pageRe.exec(xml))) {
    pageNumber += 1;
    const words: WordBox[] = [];
    let wm: RegExpExecArray | null;
    while ((wm = wordRe.exec(pm[3]!))) {
      const [xMin, yMin, xMax, yMax] = [
        Number(wm[1]),
        Number(wm[2]),
        Number(wm[3]),
        Number(wm[4]),
      ];
      words.push({
        text: decodeXmlEntities(wm[5]!.trim()),
        bbox: {
          x: xMin,
          y: yMin,
          width: xMax - xMin,
          height: yMax - yMin,
          unit: "pt",
        },
      });
    }
    pages.push({
      pageNumber,
      hasTextLayer: words.length > 0,
      words,
      width: Number(pm[1]),
      height: Number(pm[2]),
      unit: "pt",
    });
  }
  return pages;
}

/** Plain text → synthetic pages (form-feed separated), line-per-word-row. */
function plainTextPages(bytes: Buffer): ExtractedPage[] {
  const pagesText = bytes.toString("utf8").split("\f");
  return pagesText.map((pageText, i) => {
    const words: WordBox[] = [];
    const lines = pageText.split("\n");
    lines.forEach((line, row) => {
      let col = 0;
      for (const token of line.split(/\s+/)) {
        if (!token) {
          col += 1;
          continue;
        }
        const x = line.indexOf(token, col);
        col = x + token.length;
        words.push({
          text: token,
          bbox: { x: x * 6, y: row * 12, width: token.length * 6, height: 12, unit: "pt" },
        });
      }
    });
    return {
      pageNumber: i + 1,
      hasTextLayer: words.length > 0,
      words,
      width: 612,
      height: Math.max(792, lines.length * 12),
      unit: "pt" as const,
    };
  });
}

export const popplerNativeTextExtractor: NativeTextExtractorAdapter = {
  name: "poppler-pdftotext",
  version: "bbox-layout-1",
  isEnabled() {
    return true;
  },
  supports(mimeType) {
    return mimeType === "application/pdf" || mimeType.startsWith("text/");
  },
  async extract(bytes, mimeType) {
    if (mimeType.startsWith("text/")) return plainTextPages(bytes);
    if (popplerChecked === null) {
      popplerChecked = await binaryAvailable("pdftotext");
    }
    if (!popplerChecked) {
      throw new Error("pdftotext is not available in this environment");
    }
    return withTempDir(async (dir) => {
      const pdf = path.join(dir, "input.pdf");
      await writeFile(pdf, bytes);
      const { stdout } = await execFileAsync(
        "pdftotext",
        ["-bbox-layout", pdf, "-"],
        { maxBuffer: 64 * 1024 * 1024 },
      );
      return parseBboxLayout(stdout);
    });
  },
};

export const popplerPageImageRenderer: PageImageRendererAdapter = {
  name: "poppler-pdftoppm",
  version: `png-${RENDER_DPI}dpi-1`,
  isEnabled() {
    return true;
  },
  supports(mimeType) {
    return mimeType === "application/pdf";
  },
  async render(bytes, mimeType) {
    if (!this.supports(mimeType)) {
      throw new Error(`Renderer does not support ${mimeType}`);
    }
    return withTempDir(async (dir) => {
      const pdf = path.join(dir, "input.pdf");
      await writeFile(pdf, bytes);
      await execFileAsync("pdftoppm", [
        "-r",
        String(RENDER_DPI),
        "-png",
        pdf,
        path.join(dir, "page"),
      ]);
      const files = (await readdir(dir))
        .filter((f) => f.startsWith("page-") && f.endsWith(".png"))
        .sort();
      const images: RenderedPageImage[] = [];
      for (const file of files) {
        const png = await readFile(path.join(dir, file));
        const num = Number(file.replace(/^page-0*/, "").replace(/\.png$/, ""));
        // PNG IHDR: width at byte 16, height at byte 20 (big-endian)
        images.push({
          pageNumber: num,
          png,
          widthPx: png.readUInt32BE(16),
          heightPx: png.readUInt32BE(20),
          dpi: RENDER_DPI,
        });
      }
      return images;
    });
  },
};
