import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";
import {
  LIMITS,
  validateFile,
  inspectZip,
  looksExecutable,
  isZipSignature,
  sniffFormat,
} from "./validation";

// Phase 03 validation-core unit tests. Pure functions, no DB, no I/O.
// Hostile inputs are built programmatically — nothing hostile is committed
// as a fixture file.

const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF");
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);
const TXT = Buffer.from(
  "IN THE HIGH COURT OF MALAYA\nSynthetic judgment text for testing.\n",
);
const ELF = Buffer.concat([
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
  Buffer.alloc(32),
]);
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);

function docxBytes(): Buffer {
  const zip = new AdmZip();
  zip.addFile("[Content_Types].xml", Buffer.from("<Types/>"));
  zip.addFile("word/document.xml", Buffer.from("<w:document/>"));
  return zip.toBuffer();
}

function zipOf(entries: Array<[string, Buffer]>): Buffer {
  const zip = new AdmZip();
  for (const [name, data] of entries) zip.addFile(name, data);
  return zip.toBuffer();
}

describe("validateFile", () => {
  it("accepts supported formats with matching signatures", () => {
    expect(validateFile("j.pdf", PDF)).toMatchObject({
      ok: true,
      mimeType: "application/pdf",
      kind: "document",
    });
    expect(validateFile("scan.png", PNG)).toMatchObject({
      ok: true,
      kind: "image",
    });
    expect(validateFile("case.txt", TXT)).toMatchObject({ ok: true });
    expect(validateFile("doc.docx", docxBytes())).toMatchObject({ ok: true });
  });

  it("rejects unsupported extensions", () => {
    const r = validateFile("macro.xlsm", TXT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe("UNSUPPORTED_TYPE");
  });

  it("rejects executables regardless of the claimed name", () => {
    expect(looksExecutable(ELF)).toBe(true);
    expect(looksExecutable(EXE)).toBe(true);
    const r = validateFile("judgment.pdf", ELF);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe("EXECUTABLE_CONTENT");
  });

  it("rejects a misleading name: PNG bytes named .pdf", () => {
    const r = validateFile("report.pdf", PNG);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe("SIGNATURE_MISMATCH");
  });

  it("distinguishes DOCX packages from plain ZIPs named .docx", () => {
    const notDocx = zipOf([["random.txt", TXT]]);
    const r = validateFile("fake.docx", notDocx);
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(["SIGNATURE_MISMATCH", "CORRUPT_FILE"]).toContain(
        r.rejection.code,
      );
  });

  it("rejects empty files", () => {
    const r = validateFile("empty.pdf", Buffer.alloc(0));
    expect(r.ok).toBe(false);
  });

  it("rejects oversized files", () => {
    // Do not allocate 50MB — validateFile checks length first.
    const big = Buffer.alloc(1024);
    Object.defineProperty(big, "length", {
      value: LIMITS.maxFileBytes + 1,
    });
    const r = validateFile("big.txt", big);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe("FILE_TOO_LARGE");
  });

  it("rejects declared-MIME disagreement", () => {
    const r = validateFile("j.pdf", PDF, "image/png");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.rejection.code).toBe("MIME_MISMATCH");
  });
});

describe("inspectZip", () => {
  it("accepts a benign archive and validates each entry", () => {
    const inspection = inspectZip(
      "batch.zip",
      zipOf([
        ["a/case1.txt", TXT],
        ["case2.pdf", PDF],
      ]),
    );
    expect(inspection.zipRejection).toBeUndefined();
    expect(inspection.entries).toHaveLength(2);
    expect(inspection.entries.every((e) => !e.rejection)).toBe(true);
  });

  // Replace one entry-name string with another of the SAME length inside the
  // raw archive bytes (local header + central directory). AdmZip normalizes
  // hostile names on addFile, so hostile archives must be byte-patched.
  function patchName(zipBytes: Buffer, from: string, to: string): Buffer {
    if (from.length !== to.length) throw new Error("length mismatch");
    let out = Buffer.from(zipBytes);
    let idx = out.indexOf(from, 0, "latin1");
    while (idx !== -1) {
      Buffer.from(to, "latin1").copy(out, idx);
      idx = out.indexOf(from, idx + 1, "latin1");
    }
    return out;
  }

  it("rejects path traversal for the whole archive", () => {
    const benign = zipOf([["aaa/bb/evil.txt", TXT]]);
    const hostile = patchName(benign, "aaa/bb/evil.txt", "../../evil2.txt");
    const inspection = inspectZip("evil.zip", hostile);
    expect(inspection.zipRejection?.code).toBe("UNSAFE_PATH");
  });

  it("rejects duplicate entry paths for the whole archive", () => {
    const benign = zipOf([
      ["a.txt", TXT],
      ["b.txt", TXT],
    ]);
    const hostile = patchName(benign, "b.txt", "a.txt");
    const inspection = inspectZip("dup.zip", hostile);
    expect(inspection.zipRejection?.code).toBe("DUPLICATE_PATH");
  });

  it("rejects nested archives (.zip entry) for the whole archive", () => {
    const inner = zipOf([["inner.txt", TXT]]);
    const inspection = inspectZip("outer.zip", zipOf([["inner.zip", inner]]));
    expect(inspection.zipRejection?.code).toBe("NESTED_ARCHIVE");
  });

  it("rejects disguised archive content per entry", () => {
    const inner = zipOf([["inner.txt", TXT]]);
    const inspection = inspectZip(
      "outer.zip",
      zipOf([
        ["good.txt", TXT],
        ["disguised.txt", inner],
      ]),
    );
    expect(inspection.zipRejection).toBeUndefined();
    const bad = inspection.entries.find((e) =>
      e.path.endsWith("disguised.txt"),
    );
    expect(bad?.rejection?.code).toBe("NESTED_ARCHIVE");
  });

  it("rejects executables inside archives per entry", () => {
    const inspection = inspectZip(
      "mixed.zip",
      zipOf([
        ["good.txt", TXT],
        ["bad.pdf", ELF],
      ]),
    );
    expect(inspection.zipRejection).toBeUndefined();
    const bad = inspection.entries.find((e) => e.path.endsWith("bad.pdf"));
    expect(bad?.rejection?.code).toBe("EXECUTABLE_CONTENT");
    const good = inspection.entries.find((e) => e.path.endsWith("good.txt"));
    expect(good?.rejection).toBeUndefined();
  });

  it("rejects archives with too many entries", () => {
    const entries: Array<[string, Buffer]> = [];
    for (let i = 0; i < LIMITS.maxZipEntries + 1; i++) {
      entries.push([`f${i}.txt`, Buffer.from(`x${i}`)]);
    }
    const inspection = inspectZip("many.zip", zipOf(entries));
    expect(inspection.zipRejection?.code).toBe("TOO_MANY_ENTRIES");
  });

  it("rejects corrupt archives", () => {
    const corrupt = Buffer.concat([
      Buffer.from("PK\x03\x04"),
      Buffer.from("this is not a real zip structure at all"),
    ]);
    const inspection = inspectZip("corrupt.zip", corrupt);
    expect(inspection.zipRejection).toBeDefined();
  });
});

describe("format sniffing", () => {
  it("sniffs common signatures", () => {
    expect(sniffFormat(PDF)).toBe(".pdf");
    expect(sniffFormat(PNG)).toBe(".png");
    expect(isZipSignature(docxBytes())).toBe(true);
  });
});
