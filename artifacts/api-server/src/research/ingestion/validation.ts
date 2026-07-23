import AdmZip from "adm-zip";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

// Phase 03 validation core (ADR 0004). Pure — no I/O, no DB, no logging.
// Every rejection is machine-readable: { code, message }. Content never
// appears in messages (only names, sizes, and codes).

export interface Rejection {
  code: string;
  message: string;
}

export const LIMITS = {
  /** Per-file byte cap (also applies to each ZIP entry, uncompressed). */
  maxFileBytes: 50 * 1024 * 1024,
  /** Total uncompressed cap across a ZIP archive. */
  maxZipTotalBytes: 200 * 1024 * 1024,
  /** Max entries in a ZIP archive. */
  maxZipEntries: 500,
  /** Max uncompressed/compressed ratio for a ZIP entry (bomb guard). */
  maxExpansionRatio: 100,
} as const;

/** Supported non-archive formats. */
export const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".rtf",
  ".html",
  ".htm",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".tif",
  ".tiff",
] as const;

const EXT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".rtf": "application/rtf",
  ".html": "text/html",
  ".htm": "text/html",
  ".txt": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".zip": "application/zip",
};

export type FileKind = "document" | "image";

export interface AcceptedFile {
  ok: true;
  mimeType: string;
  kind: FileKind;
}
export interface RejectedFile {
  ok: false;
  rejection: Rejection;
}
export type FileValidation = AcceptedFile | RejectedFile;

function reject(code: string, message: string): RejectedFile {
  return { ok: false, rejection: { code, message } };
}

function startsWith(buf: Buffer, sig: number[] | string, offset = 0): boolean {
  const bytes = typeof sig === "string" ? Buffer.from(sig, "latin1") : Buffer.from(sig);
  if (buf.length < offset + bytes.length) return false;
  return buf.subarray(offset, offset + bytes.length).equals(bytes);
}

/** Executable payloads masquerading as documents are always rejected. */
export function looksExecutable(buf: Buffer): boolean {
  return (
    startsWith(buf, "MZ") || // PE
    startsWith(buf, [0x7f, 0x45, 0x4c, 0x46]) || // ELF
    startsWith(buf, [0xfe, 0xed, 0xfa, 0xce]) || // Mach-O 32
    startsWith(buf, [0xfe, 0xed, 0xfa, 0xcf]) || // Mach-O 64
    startsWith(buf, [0xcf, 0xfa, 0xed, 0xfe]) || // Mach-O LE
    startsWith(buf, [0xca, 0xfe, 0xba, 0xbe]) || // Mach-O fat / Java class
    startsWith(buf, "#!") // script with shebang
  );
}

export function isZipSignature(buf: Buffer): boolean {
  return (
    startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(buf, [0x50, 0x4b, 0x05, 0x06]) // empty archive
  );
}

function looksBinary(buf: Buffer): boolean {
  const probe = buf.subarray(0, Math.min(buf.length, 8192));
  return probe.includes(0);
}

/** Detect the actual format from magic bytes. Returns extension-style token. */
export function sniffFormat(buf: Buffer): string | null {
  if (buf.length === 0) return null;
  if (startsWith(buf, "%PDF-")) return ".pdf";
  if (startsWith(buf, "{\\rtf")) return ".rtf";
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return ".png";
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return ".jpg";
  if (startsWith(buf, "II*\u0000") || startsWith(buf, "MM\u0000*"))
    return ".tiff";
  if (isZipSignature(buf)) return ".zip"; // may be DOCX — resolved by caller
  if (looksExecutable(buf)) return "executable";
  if (looksBinary(buf)) return "binary";
  const head = buf.subarray(0, 2048).toString("utf8").trimStart().toLowerCase();
  if (head.startsWith("<!doctype html") || head.startsWith("<html"))
    return ".html";
  return ".txt";
}

/** A ZIP that is actually a DOCX package (has [Content_Types].xml). */
export function isDocxPackage(buf: Buffer): boolean {
  try {
    const zip = new AdmZip(buf);
    return zip
      .getEntries()
      .some((e) => e.entryName === "[Content_Types].xml");
  } catch {
    return false;
  }
}

function normalizeExt(name: string): string {
  const ext = path.extname(name).toLowerCase();
  if (ext === ".jpeg") return ".jpg";
  if (ext === ".tif") return ".tiff";
  if (ext === ".htm") return ".html";
  return ext;
}

function sameFamily(sniffed: string, ext: string): boolean {
  const s = sniffed === ".jpeg" ? ".jpg" : sniffed === ".tif" ? ".tiff" : sniffed;
  if (s === ext) return true;
  // Plain text container formats: .txt sniff accepts txt/html/rtf claims is NOT
  // allowed — html must sniff as html; but .html sniff may be claimed as .txt.
  if (s === ".html" && ext === ".txt") return true;
  return false;
}

export function mimeTypeForExtension(name: string): string | undefined {
  return EXT_MIME[normalizeExt(name)];
}

/**
 * Validate one non-archive file: supported extension, magic-byte agreement,
 * declared MIME agreement (when supplied), size cap, executable detection.
 */
export function validateFile(
  originalName: string,
  bytes: Buffer,
  declaredMime?: string,
): FileValidation {
  const ext = normalizeExt(originalName);
  if (bytes.length === 0) {
    return reject("EMPTY_FILE", `File '${originalName}' is empty`);
  }
  if (bytes.length > LIMITS.maxFileBytes) {
    return reject(
      "FILE_TOO_LARGE",
      `File '${originalName}' exceeds the ${LIMITS.maxFileBytes}-byte cap (${bytes.length} bytes)`,
    );
  }
  if (looksExecutable(bytes)) {
    return reject(
      "EXECUTABLE_CONTENT",
      `File '${originalName}' contains executable content`,
    );
  }
  if (!EXT_MIME[ext] || ext === ".zip") {
    return reject(
      "UNSUPPORTED_TYPE",
      `File '${originalName}' has unsupported extension '${ext || "(none)"}'`,
    );
  }
  const sniffed = sniffFormat(bytes);
  if (sniffed === "binary" || sniffed === null) {
    return reject(
      "UNRECOGNIZED_CONTENT",
      `File '${originalName}' has unrecognized binary content`,
    );
  }
  if (sniffed === ".zip") {
    // Only DOCX may carry a ZIP signature among non-archive uploads.
    if (ext !== ".docx") {
      return reject(
        "SIGNATURE_MISMATCH",
        `File '${originalName}' claims '${ext}' but contains a ZIP archive`,
      );
    }
    if (!isDocxPackage(bytes)) {
      return reject(
        "CORRUPT_FILE",
        `File '${originalName}' is not a valid DOCX package`,
      );
    }
  } else if (ext === ".docx") {
    return reject(
      "SIGNATURE_MISMATCH",
      `File '${originalName}' claims '.docx' but its signature is '${sniffed}'`,
    );
  } else if (!sameFamily(sniffed, ext)) {
    return reject(
      "SIGNATURE_MISMATCH",
      `File '${originalName}' claims '${ext}' but its signature is '${sniffed}'`,
    );
  }
  const expectedMime = EXT_MIME[ext]!;
  if (
    declaredMime &&
    declaredMime !== "application/octet-stream" &&
    declaredMime.split(";")[0]!.trim().toLowerCase() !== expectedMime
  ) {
    return reject(
      "MIME_MISMATCH",
      `File '${originalName}' declared MIME '${declaredMime}' but '${expectedMime}' was expected for '${ext}'`,
    );
  }
  const kind: FileKind = [".png", ".jpg", ".tiff"].includes(ext)
    ? "image"
    : "document";
  return { ok: true, mimeType: expectedMime, kind };
}

export interface ZipEntryResult {
  path: string;
  bytes?: Buffer;
  mimeType?: string;
  rejection?: Rejection;
}

export interface ZipInspection {
  /** Set when the whole archive is rejected (bomb, traversal, corrupt, …). */
  zipRejection?: Rejection;
  entries: ZipEntryResult[];
}

/**
 * Decompress a ZIP entry with a hard output cap so a lying header or a
 * crafted deflate stream can never allocate more than the declared size
 * (which the structural scan has already bounded to LIMITS.maxFileBytes).
 * Throws on any breach or mismatch — callers treat that as CORRUPT_ENTRY.
 */
function boundedEntryData(e: AdmZip.IZipEntry): Buffer {
  const declared = e.header.size;
  if (declared > LIMITS.maxFileBytes) throw new Error("entry exceeds cap");
  const compressed = e.getCompressedData();
  let data: Buffer;
  if (e.header.method === 0) {
    // STORED — bytes are verbatim.
    data = compressed;
  } else if (e.header.method === 8) {
    // DEFLATE — inflate with a hard output ceiling; zlib aborts the
    // allocation as soon as the stream exceeds it.
    data = inflateRawSync(compressed, { maxOutputLength: declared });
  } else {
    throw new Error(`unsupported compression method ${e.header.method}`);
  }
  if (data.length !== declared) throw new Error("entry size mismatch");
  return data;
}

function isUnsafePath(entryName: string): boolean {
  if (entryName.includes("\u0000")) return true;
  const normalized = entryName.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) return true;
  return normalized
    .split("/")
    .some((seg) => seg === ".." || seg.trim() === "..");
}

/**
 * Inspect a ZIP archive. Structural attacks (bomb ratio, oversize, nesting,
 * traversal, duplicate paths, encryption, corruption) reject the WHOLE
 * archive; a merely-unsupported entry rejects only that entry.
 */
export function inspectZip(zipName: string, bytes: Buffer): ZipInspection {
  if (bytes.length > LIMITS.maxFileBytes) {
    return {
      zipRejection: {
        code: "FILE_TOO_LARGE",
        message: `Archive '${zipName}' exceeds the ${LIMITS.maxFileBytes}-byte cap`,
      },
      entries: [],
    };
  }
  if (!isZipSignature(bytes)) {
    return {
      zipRejection: {
        code: "SIGNATURE_MISMATCH",
        message: `Archive '${zipName}' does not have a ZIP signature`,
      },
      entries: [],
    };
  }
  let zip: AdmZip;
  let rawEntries: AdmZip.IZipEntry[];
  try {
    zip = new AdmZip(bytes);
    rawEntries = zip.getEntries();
  } catch {
    return {
      zipRejection: {
        code: "CORRUPT_ARCHIVE",
        message: `Archive '${zipName}' has a corrupt structure`,
      },
      entries: [],
    };
  }
  const files = rawEntries.filter((e) => !e.isDirectory);
  if (files.length === 0) {
    return {
      zipRejection: {
        code: "EMPTY_ARCHIVE",
        message: `Archive '${zipName}' contains no files`,
      },
      entries: [],
    };
  }
  if (files.length > LIMITS.maxZipEntries) {
    return {
      zipRejection: {
        code: "TOO_MANY_ENTRIES",
        message: `Archive '${zipName}' has ${files.length} entries (cap ${LIMITS.maxZipEntries})`,
      },
      entries: [],
    };
  }

  const seen = new Set<string>();
  let totalUncompressed = 0;
  for (const e of files) {
    const header = e.header;
    if (e.header.flags & 0x1) {
      return {
        zipRejection: {
          code: "ENCRYPTED_ENTRY",
          message: `Archive '${zipName}' contains an encrypted entry`,
        },
        entries: [],
      };
    }
    if (isUnsafePath(e.entryName)) {
      return {
        zipRejection: {
          code: "UNSAFE_PATH",
          message: `Archive '${zipName}' contains an unsafe path`,
        },
        entries: [],
      };
    }
    const normalized = e.entryName.replace(/\\/g, "/").toLowerCase();
    if (seen.has(normalized)) {
      return {
        zipRejection: {
          code: "DUPLICATE_PATH",
          message: `Archive '${zipName}' contains duplicate path '${e.entryName}'`,
        },
        entries: [],
      };
    }
    seen.add(normalized);
    totalUncompressed += header.size;
    if (header.size > LIMITS.maxFileBytes) {
      return {
        zipRejection: {
          code: "ENTRY_TOO_LARGE",
          message: `Archive '${zipName}' entry '${e.entryName}' exceeds the per-file cap`,
        },
        entries: [],
      };
    }
    const ratio = header.compressedSize > 0 ? header.size / header.compressedSize : 0;
    if (ratio > LIMITS.maxExpansionRatio) {
      return {
        zipRejection: {
          code: "EXPANSION_RATIO_EXCEEDED",
          message: `Archive '${zipName}' entry '${e.entryName}' expands ${Math.round(ratio)}x (cap ${LIMITS.maxExpansionRatio}x)`,
        },
        entries: [],
      };
    }
    const ext = normalizeExt(e.entryName);
    if (ext === ".zip") {
      return {
        zipRejection: {
          code: "NESTED_ARCHIVE",
          message: `Archive '${zipName}' contains a nested archive '${e.entryName}' (nesting is not permitted)`,
        },
        entries: [],
      };
    }
  }
  if (totalUncompressed > LIMITS.maxZipTotalBytes) {
    return {
      zipRejection: {
        code: "ARCHIVE_TOO_LARGE",
        message: `Archive '${zipName}' expands to ${totalUncompressed} bytes (cap ${LIMITS.maxZipTotalBytes})`,
      },
      entries: [],
    };
  }

  // Structure is safe — now validate each entry's content individually.
  const entries: ZipEntryResult[] = [];
  for (const e of files) {
    const entryPath = `${zipName}/${e.entryName.replace(/\\/g, "/")}`;
    let data: Buffer;
    try {
      data = boundedEntryData(e);
    } catch {
      entries.push({
        path: entryPath,
        rejection: {
          code: "CORRUPT_ENTRY",
          message: `Entry '${e.entryName}' in '${zipName}' could not be decompressed`,
        },
      });
      continue;
    }
    // Nested-archive content disguised under another extension is caught here.
    if (isZipSignature(data) && normalizeExt(e.entryName) !== ".docx") {
      entries.push({
        path: entryPath,
        rejection: {
          code: "NESTED_ARCHIVE",
          message: `Entry '${e.entryName}' in '${zipName}' contains archive content`,
        },
      });
      continue;
    }
    const result = validateFile(e.entryName, data);
    if (result.ok) {
      entries.push({ path: entryPath, bytes: data, mimeType: result.mimeType });
    } else {
      entries.push({ path: entryPath, rejection: result.rejection });
    }
  }
  return { entries };
}
