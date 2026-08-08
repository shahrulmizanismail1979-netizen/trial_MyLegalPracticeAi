import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

// The app pulls in Clerk middleware for the main admin dashboard; mock it so
// these tests run without Clerk credentials.
vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: null }),
  clerkClient: {
    users: { getUser: async () => Promise.reject(new Error("not found")) },
  },
}));

// Object storage depends on the Replit sidecar + GCS, unavailable in CI.
// Replace it with an in-memory registry that serves real file bytes so the
// extraction pipeline still runs on real buffers.
const storageState = vi.hoisted(() => ({
  objects: new Map<string, { buffer: Buffer; contentType: string }>(),
  issued: [] as string[],
}));

vi.mock("../lib/objectStorage", () => {
  class FakeObjectStorageService {
    async getObjectEntityUploadURL(): Promise<string> {
      const id = randomUUID();
      storageState.issued.push(id);
      return `https://storage.example.com/bucket/.private/uploads/${id}?sig=x`;
    }

    normalizeObjectEntityPath(rawPath: string): string {
      const m = rawPath.match(/uploads\/([0-9a-f-]+)/);
      return `/objects/uploads/${m ? m[1] : rawPath}`;
    }

    async getObjectEntityFile(objectPath: string): Promise<{
      getMetadata: () => Promise<
        [{ size: number; contentType: string }]
      >;
      download: () => Promise<[Buffer]>;
      delete: () => Promise<void>;
    }> {
      const entry = storageState.objects.get(objectPath);
      if (!entry) {
        const err = new Error("Object not found") as Error & { name: string };
        err.name = "ObjectNotFoundError";
        throw err;
      }
      return {
        getMetadata: async () => [
          { size: entry.buffer.length, contentType: entry.contentType },
        ],
        download: async () => [entry.buffer],
        delete: async () => {
          storageState.objects.delete(objectPath);
        },
      };
    }
  }
  return {
    ObjectStorageService: FakeObjectStorageService,
    ObjectNotFoundError: class extends Error {},
  };
});

const { default: app } = await import("../../app");
const { db, litAccessCodes, litPendingUploads } = await import(
  "@workspace/db"
);
const { inArray, like } = await import("drizzle-orm");

// Login uppercases submitted codes, so the stored code must be uppercase too.
const RUN_ID = randomUUID().slice(0, 8).toUpperCase();
const CODE_A = `TEST-LITUP-A-${RUN_ID}`;
const CODE_B = `TEST-LITUP-B-${RUN_ID}`;

let codeIds: number[] = [];

async function loginAgent(code: string): Promise<request.Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/lit/auth/login").send({ password: code });
  expect(res.status).toBe(200);
  return agent;
}

async function issueUpload(
  agent: request.Agent,
  content: string,
): Promise<string> {
  const res = await agent
    .post("/api/lit/uploads/upload-url")
    .send({ fileName: "notes.txt" });
  expect(res.status).toBe(200);
  const objectPath = res.body.objectPath as string;
  // Simulate the browser PUTting the file straight to storage.
  storageState.objects.set(objectPath, {
    buffer: Buffer.from(content, "utf-8"),
    contentType: "text/plain",
  });
  return objectPath;
}

function extractStored(
  agent: request.Agent,
  objectPath: string,
): request.Test {
  return agent.post("/api/lit/uploads/extract-stored").send({
    files: [{ name: "notes.txt", objectPath, contentType: "text/plain" }],
  });
}

beforeAll(async () => {
  const rows = await db
    .insert(litAccessCodes)
    .values([
      {
        code: CODE_A,
        recipientName: `Test A ${RUN_ID}`,
        recipientEmail: `lit-uploads-a-${RUN_ID}@test.invalid`,
        status: "active",
      },
      {
        code: CODE_B,
        recipientName: `Test B ${RUN_ID}`,
        recipientEmail: `lit-uploads-b-${RUN_ID}@test.invalid`,
        status: "active",
      },
    ])
    .returning({ id: litAccessCodes.id });
  codeIds = rows.map((r) => r.id);
});

afterAll(async () => {
  if (codeIds.length > 0) {
    await db
      .delete(litPendingUploads)
      .where(inArray(litPendingUploads.accessCodeId, codeIds));
    await db.delete(litAccessCodes).where(inArray(litAccessCodes.id, codeIds));
  }
  await db
    .delete(litAccessCodes)
    .where(like(litAccessCodes.code, `TEST-LITUP-%-${RUN_ID}`));
});

describe("lit upload ownership binding", () => {
  it("rejects upload-url and extract-stored without a session", async () => {
    const anon = request(app);
    const r1 = await anon
      .post("/api/lit/uploads/upload-url")
      .send({ fileName: "x.txt" });
    expect(r1.status).toBe(401);
    const r2 = await anon
      .post("/api/lit/uploads/extract-stored")
      .send({ files: [{ name: "x.txt", objectPath: "/objects/uploads/x" }] });
    expect(r2.status).toBe(401);
  });

  it("lets the owner extract their own upload (end to end)", async () => {
    const agentA = await loginAgent(CODE_A);
    const objectPath = await issueUpload(agentA, "Hello from subscriber A");

    const res = await extractStored(agentA, objectPath);
    expect(res.status).toBe(200);
    expect(res.body.files).toHaveLength(1);
    expect(res.body.files[0].error).toBeUndefined();
    expect(res.body.files[0].text).toContain("Hello from subscriber A");
    // Transient: deleted from storage after extraction.
    expect(storageState.objects.has(objectPath)).toBe(false);
  });

  it("blocks another subscriber from extracting (or deleting) a pending upload", async () => {
    const agentA = await loginAgent(CODE_A);
    const agentB = await loginAgent(CODE_B);
    const objectPath = await issueUpload(agentA, "Confidential draft of A");

    const resB = await extractStored(agentB, objectPath);
    expect(resB.status).toBe(200);
    expect(resB.body.files[0].error).toMatch(/invalid or has expired/i);
    expect(resB.body.files[0].text).toBe("");
    // The victim's object must NOT have been deleted by the failed attempt.
    expect(storageState.objects.has(objectPath)).toBe(true);

    // The rightful owner can still extract afterwards.
    const resA = await extractStored(agentA, objectPath);
    expect(resA.status).toBe(200);
    expect(resA.body.files[0].error).toBeUndefined();
    expect(resA.body.files[0].text).toContain("Confidential draft of A");
  });

  it("is one-time use: a second extraction of the same path fails", async () => {
    const agentA = await loginAgent(CODE_A);
    const objectPath = await issueUpload(agentA, "One-time extraction");

    const first = await extractStored(agentA, objectPath);
    expect(first.body.files[0].error).toBeUndefined();

    // Re-stage bytes to prove the rejection comes from the consumed
    // ownership row, not from the object being gone.
    storageState.objects.set(objectPath, {
      buffer: Buffer.from("replayed", "utf-8"),
      contentType: "text/plain",
    });
    const second = await extractStored(agentA, objectPath);
    expect(second.body.files[0].error).toMatch(/invalid or has expired/i);
  });

  it("rejects expired pending uploads", async () => {
    const agentA = await loginAgent(CODE_A);
    const objectPath = await issueUpload(agentA, "Expired upload");

    // Force the pending row past its TTL directly in the DB (the check must
    // hold per-request, DB-backed — not just in process memory).
    const { eq } = await import("drizzle-orm");
    await db
      .update(litPendingUploads)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(litPendingUploads.objectPath, objectPath));

    const res = await extractStored(agentA, objectPath);
    expect(res.body.files[0].error).toMatch(/invalid or has expired/i);
  });

  it("survives a restart: ownership recorded in the DB, not process memory", async () => {
    const agentA = await loginAgent(CODE_A);
    const objectPath = await issueUpload(agentA, "Cross-instance upload");

    // Verify the binding is persisted where any instance can see it.
    const { eq } = await import("drizzle-orm");
    const [row] = await db
      .select()
      .from(litPendingUploads)
      .where(eq(litPendingUploads.objectPath, objectPath));
    expect(row).toBeDefined();
    expect(codeIds).toContain(row.accessCodeId);
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
