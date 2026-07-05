import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

/**
 * Registry that our mocked ObjectStorageService reads from. Tests register an
 * object path -> Buffer so the extraction pipeline receives real file bytes
 * without touching the Replit object-storage sidecar or GCS.
 */
const { fileRegistry } = vi.hoisted(() => ({
  fileRegistry: new Map<string, Buffer>(),
}));

vi.mock("../lib/objectStorage", () => {
  class ObjectNotFoundError extends Error {
    constructor() {
      super("Object not found");
      this.name = "ObjectNotFoundError";
    }
  }
  class ObjectStorageService {
    async getObjectEntityFile(objectPath: string) {
      const buffer = fileRegistry.get(objectPath);
      if (!buffer) throw new ObjectNotFoundError();
      return {
        download: async (): Promise<[Buffer]> => [buffer],
      };
    }
  }
  return { ObjectStorageService, ObjectNotFoundError };
});

// Imported after the mock so the singleton in the route uses the mocked storage.
const { default: app } = await import("../app");
const { db, contributionsTable } = await import("@workspace/db");
const { inArray } = await import("drizzle-orm");

/** Build a minimal but valid single-page PDF whose text layer is extractable. */
function buildPdf(textContent: string): Buffer {
  const objects: string[] = [];
  objects.push("<</Type/Catalog/Pages 2 0 R>>");
  objects.push("<</Type/Pages/Kids[3 0 R]/Count 1>>");
  objects.push(
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
  );
  const stream = `BT /F1 24 Tf 72 720 Td (${textContent}) Tj ET`;
  objects.push(`<</Length ${stream.length}>>\nstream\n${stream}\nendstream`);
  objects.push("<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  const count = objects.length + 1;
  pdf += `xref\n0 ${count}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += String(off).padStart(10, "0") + " 00000 n \n";
  });
  pdf += `trailer\n<</Size ${count}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

const PDF_TEXT = "Hello Contribution Test PDF";
const TXT_TEXT = "Plain text contribution body for extraction.";

// Unique marker so we only ever touch and clean up rows this run created.
const RUN_ID = randomUUID();
const contributorEmail = `e2e-${RUN_ID}@example.test`;
const createdIds: number[] = [];

describe("contribution upload + extraction + knowledge-base (e2e)", () => {
  beforeAll(() => {
    fileRegistry.set(`/objects/uploads/${RUN_ID}-pdf`, buildPdf(PDF_TEXT));
    fileRegistry.set(
      `/objects/uploads/${RUN_ID}-txt`,
      Buffer.from(TXT_TEXT, "utf-8"),
    );
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await db
        .delete(contributionsTable)
        .where(inArray(contributionsTable.id, createdIds));
    }
  });

  it("extracts text from an uploaded PDF via the real pdf-parse pipeline", async () => {
    const res = await request(app)
      .post("/api/contributions")
      .send({
        title: `PDF Contribution ${RUN_ID}`,
        categories: ["Litigation"],
        contributorName: "E2E Tester",
        contributorEmail,
        fileName: "sample.pdf",
        objectPath: `/objects/uploads/${RUN_ID}-pdf`,
        contentType: "application/pdf",
      });

    expect(res.status).toBe(201);
    expect(res.body.extractionStatus).toBe("extracted");
    expect(res.body.extractedText).toContain(PDF_TEXT);
    expect(res.body.status).toBe("pending");
    createdIds.push(res.body.id);
  });

  it("extracts text from an uploaded plain-text file", async () => {
    const res = await request(app)
      .post("/api/contributions")
      .send({
        title: `Text Contribution ${RUN_ID}`,
        categories: ["General/Other"],
        contributorName: "E2E Tester",
        contributorEmail,
        fileName: "notes.txt",
        objectPath: `/objects/uploads/${RUN_ID}-txt`,
        contentType: "text/plain",
      });

    expect(res.status).toBe(201);
    expect(res.body.extractionStatus).toBe("extracted");
    expect(res.body.extractedText).toContain(TXT_TEXT);
    createdIds.push(res.body.id);
  });

  it("knowledge-base returns only approved contributions", async () => {
    expect(createdIds.length).toBe(2);
    const [approvedId, pendingId] = createdIds;

    // Approve exactly one of the two contributions created above.
    const { eq } = await import("drizzle-orm");
    await db
      .update(contributionsTable)
      .set({ status: "approved" })
      .where(eq(contributionsTable.id, approvedId));

    const res = await request(app).get("/api/knowledge-base");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const returnedIds = res.body.map((e: { id: number }) => e.id);
    expect(returnedIds).toContain(approvedId);
    expect(returnedIds).not.toContain(pendingId);

    const approvedEntry = res.body.find(
      (e: { id: number }) => e.id === approvedId,
    );
    expect(approvedEntry.extractedText).toContain(PDF_TEXT);
  });

  it("accepts multiple categories and filters knowledge-base by any of them", async () => {
    fileRegistry.set(`/objects/uploads/${RUN_ID}-multi`, Buffer.from("Multi-category doc"));

    const res = await request(app)
      .post("/api/contributions")
      .send({
        title: `Multi Category Contribution ${RUN_ID}`,
        categories: ["Litigation", "Criminal"],
        contributorName: "E2E Tester",
        contributorEmail,
        fileName: "multi.txt",
        objectPath: `/objects/uploads/${RUN_ID}-multi`,
        contentType: "text/plain",
      });

    expect(res.status).toBe(201);
    expect(res.body.categories).toEqual(["Litigation", "Criminal"]);
    createdIds.push(res.body.id);

    const { eq } = await import("drizzle-orm");
    await db
      .update(contributionsTable)
      .set({ status: "approved" })
      .where(eq(contributionsTable.id, res.body.id));

    // Filtering by either category returns the doc; a non-matching one does not.
    for (const cat of ["Litigation", "Criminal"]) {
      const filtered = await request(app)
        .get("/api/knowledge-base")
        .query({ category: cat });
      expect(filtered.status).toBe(200);
      expect(filtered.body.map((e: { id: number }) => e.id)).toContain(res.body.id);
    }
    const nonMatching = await request(app)
      .get("/api/knowledge-base")
      .query({ category: "Conveyancing" });
    expect(nonMatching.status).toBe(200);
    expect(nonMatching.body.map((e: { id: number }) => e.id)).not.toContain(res.body.id);
  });

  it("rejects a contribution with no categories", async () => {
    const res = await request(app)
      .post("/api/contributions")
      .send({
        title: `Empty Categories ${RUN_ID}`,
        categories: [],
        contributorName: "E2E Tester",
        contributorEmail,
        fileName: "empty.txt",
        objectPath: `/objects/uploads/${RUN_ID}-empty`,
        contentType: "text/plain",
      });
    expect(res.status).toBe(400);
  });
});
