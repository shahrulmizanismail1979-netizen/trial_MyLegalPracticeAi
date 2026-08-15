import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

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

// Object storage depends on the Replit sidecar + GCS; replace with an
// in-memory registry (same pattern as lit-uploads.test.ts).
const storageState = vi.hoisted(() => ({
  objects: new Map<string, { buffer: Buffer; contentType: string }>(),
}));

vi.mock("../lib/objectStorage", () => {
  class ObjectNotFoundError extends Error {}
  class FakeObjectStorageService {
    async getObjectEntityUploadURL(): Promise<string> {
      return `https://storage.example.com/bucket/.private/uploads/${randomUUID()}?sig=x`;
    }

    normalizeObjectEntityPath(rawPath: string): string {
      const m = rawPath.match(/uploads\/([0-9a-f-]+)/);
      return `/objects/uploads/${m ? m[1] : rawPath}`;
    }

    async getObjectEntityFile(objectPath: string) {
      const entry = storageState.objects.get(objectPath);
      if (!entry) throw new ObjectNotFoundError("Object not found");
      return {
        getMetadata: async () => [
          { size: entry.buffer.length, contentType: entry.contentType },
        ],
        download: async () => [entry.buffer],
        delete: async () => {
          storageState.objects.delete(objectPath);
        },
        createReadStream: () => {
          const { Readable } = require("node:stream");
          return Readable.from(entry.buffer);
        },
      };
    }
  }
  return { ObjectStorageService: FakeObjectStorageService, ObjectNotFoundError };
});

const { default: app } = await import("../../app");
const {
  db,
  litAccessCodes,
  litMatters,
  litSavedWork,
  litBundles,
  litPendingUploads,
} = await import("@workspace/db");
const { inArray } = await import("drizzle-orm");

const RUN_ID = randomUUID().slice(0, 8).toUpperCase();
const CODE_A = `TEST-LITBUN-A-${RUN_ID}`;
const CODE_B = `TEST-LITBUN-B-${RUN_ID}`;

let codeIds: number[] = [];
let matter1 = 0;
let matter2 = 0;
let work1 = 0; // saved work filed to matter1
let work2 = 0; // saved work filed to matter2
let workUnfiled = 0;

async function loginAgent(code: string): Promise<request.Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/lit/auth/login").send({ password: code });
  expect(res.status).toBe(200);
  return agent;
}

beforeAll(async () => {
  const rows = await db
    .insert(litAccessCodes)
    .values([
      {
        code: CODE_A,
        recipientName: `Bundle A ${RUN_ID}`,
        recipientEmail: `lit-bundles-a-${RUN_ID}@test.invalid`,
        status: "active",
      },
      {
        code: CODE_B,
        recipientName: `Bundle B ${RUN_ID}`,
        recipientEmail: `lit-bundles-b-${RUN_ID}@test.invalid`,
        status: "active",
      },
    ])
    .returning({ id: litAccessCodes.id });
  codeIds = rows.map((r) => r.id);
  const [m1, m2] = await db
    .insert(litMatters)
    .values([
      { accessCodeId: codeIds[0]!, title: `Matter 1 ${RUN_ID}` },
      { accessCodeId: codeIds[0]!, title: `Matter 2 ${RUN_ID}` },
    ])
    .returning({ id: litMatters.id });
  matter1 = m1!.id;
  matter2 = m2!.id;
  const works = await db
    .insert(litSavedWork)
    .values([
      { accessCodeId: codeIds[0]!, matterId: matter1, kind: "draft", title: `SOC ${RUN_ID}` },
      { accessCodeId: codeIds[0]!, matterId: matter2, kind: "draft", title: `Defence ${RUN_ID}` },
      { accessCodeId: codeIds[0]!, kind: "draft", title: `Unfiled ${RUN_ID}` },
    ])
    .returning({ id: litSavedWork.id });
  work1 = works[0]!.id;
  work2 = works[1]!.id;
  workUnfiled = works[2]!.id;
});

afterAll(async () => {
  if (codeIds.length > 0) {
    await db.delete(litBundles).where(inArray(litBundles.accessCodeId, codeIds));
    await db.delete(litSavedWork).where(inArray(litSavedWork.accessCodeId, codeIds));
    await db.delete(litMatters).where(inArray(litMatters.accessCodeId, codeIds));
    await db
      .delete(litPendingUploads)
      .where(inArray(litPendingUploads.accessCodeId, codeIds));
    await db.delete(litAccessCodes).where(inArray(litAccessCodes.id, codeIds));
  }
});

describe("bundle uploads + cause-paper linking", () => {
  it("uploads a PDF into a bundle and streams it back; other subscribers get 404", async () => {
    const agentA = await loginAgent(CODE_A);
    const bundle = await agentA
      .post("/api/lit/bundles")
      .send({ title: `Pleadings ${RUN_ID}`, bundleType: "pleadings", matterId: matter1 });
    expect(bundle.status).toBe(201);
    const bundleId = bundle.body.id as number;

    const urlRes = await agentA
      .post(`/api/lit/bundles/${bundleId}/documents/upload-url`)
      .send({ fileName: "soc.pdf", contentType: "application/pdf" });
    expect(urlRes.status).toBe(200);
    const objectPath = urlRes.body.objectPath as string;
    storageState.objects.set(objectPath, {
      buffer: Buffer.from("%PDF-1.4 test bytes"),
      contentType: "application/pdf",
    });

    const created = await agentA
      .post(`/api/lit/bundles/${bundleId}/documents/from-upload`)
      .send({ objectPath, fileName: "soc.pdf", contentType: "application/pdf" });
    expect(created.status).toBe(201);
    expect(created.body.source).toBe("upload");
    expect(created.body.objectPath).toBe(objectPath);

    const dl = await agentA.get(
      `/api/lit/bundles/${bundleId}/documents/${created.body.id}/download`,
    );
    expect(dl.status).toBe(200);

    // Another subscriber cannot reach the bundle or its file.
    const agentB = await loginAgent(CODE_B);
    const dlB = await agentB.get(
      `/api/lit/bundles/${bundleId}/documents/${created.body.id}/download`,
    );
    expect(dlB.status).toBe(404);
  });

  it("rejects files whose bytes are not really PDF/DOCX (magic-byte check)", async () => {
    const agentA = await loginAgent(CODE_A);
    const bundle = await agentA
      .post("/api/lit/bundles")
      .send({ title: `Magic ${RUN_ID}`, bundleType: "pleadings" });
    const urlRes = await agentA
      .post(`/api/lit/bundles/${bundle.body.id}/documents/upload-url`)
      .send({ fileName: "fake.pdf", contentType: "application/pdf" });
    const objectPath = urlRes.body.objectPath as string;
    storageState.objects.set(objectPath, {
      buffer: Buffer.from("MZ this is an executable, not a pdf"),
      contentType: "application/pdf",
    });
    const created = await agentA
      .post(`/api/lit/bundles/${bundle.body.id}/documents/from-upload`)
      .send({ objectPath, fileName: "fake.pdf", contentType: "application/pdf" });
    expect(created.status).toBe(400);
    // The bogus object is cleaned out of storage.
    expect(storageState.objects.has(objectPath)).toBe(false);
  });

  it("blocks re-assigning a bundle's matter while incompatible cause papers are linked", async () => {
    const agentA = await loginAgent(CODE_A);
    // Unscoped bundle: link matter-2 work, then try to move it onto matter 1.
    const bundle = await agentA
      .post("/api/lit/bundles")
      .send({ title: `Move ${RUN_ID}`, bundleType: "pleadings" });
    const bundleId = bundle.body.id as number;
    const link = await agentA
      .post(`/api/lit/bundles/${bundleId}/documents/from-saved-work`)
      .send({ savedWorkId: work2 });
    expect(link.status).toBe(201);

    const move = await agentA
      .patch(`/api/lit/bundles/${bundleId}`)
      .send({ matterId: matter1 });
    expect(move.status).toBe(400);

    // Moving onto the matter the linked work IS filed to succeeds.
    const moveHome = await agentA
      .patch(`/api/lit/bundles/${bundleId}`)
      .send({ matterId: matter2 });
    expect(moveHome.status).toBe(200);
    expect(moveHome.body.matterId).toBe(matter2);

    // And once matter-linked, cross-matter moves stay blocked until the
    // incompatible link is removed.
    const moveAway = await agentA
      .patch(`/api/lit/bundles/${bundleId}`)
      .send({ matterId: matter1 });
    expect(moveAway.status).toBe(400);
    await agentA.delete(`/api/lit/bundles/${bundleId}/documents/${link.body.id}`);
    const moveNow = await agentA
      .patch(`/api/lit/bundles/${bundleId}`)
      .send({ matterId: matter1 });
    expect(moveNow.status).toBe(200);
  });

  it("rejects non-PDF/DOCX uploads", async () => {
    const agentA = await loginAgent(CODE_A);
    const bundle = await agentA
      .post("/api/lit/bundles")
      .send({ title: `Rejects ${RUN_ID}`, bundleType: "pleadings" });
    const res = await agentA
      .post(`/api/lit/bundles/${bundle.body.id}/documents/upload-url`)
      .send({ fileName: "evil.exe", contentType: "application/x-msdownload" });
    expect(res.status).toBe(400);
  });

  it("rejects attaching an upload path the caller does not own", async () => {
    const agentA = await loginAgent(CODE_A);
    const agentB = await loginAgent(CODE_B);
    const bundleA = await agentA
      .post("/api/lit/bundles")
      .send({ title: `Owner ${RUN_ID}`, bundleType: "pleadings" });
    const bundleB = await agentB
      .post("/api/lit/bundles")
      .send({ title: `Thief ${RUN_ID}`, bundleType: "pleadings" });

    const urlRes = await agentA
      .post(`/api/lit/bundles/${bundleA.body.id}/documents/upload-url`)
      .send({ fileName: "a.pdf", contentType: "application/pdf" });
    const objectPath = urlRes.body.objectPath as string;
    storageState.objects.set(objectPath, {
      buffer: Buffer.from("%PDF-1.4 owned by A"),
      contentType: "application/pdf",
    });

    const stolen = await agentB
      .post(`/api/lit/bundles/${bundleB.body.id}/documents/from-upload`)
      .send({ objectPath, fileName: "a.pdf", contentType: "application/pdf" });
    expect(stolen.status).toBe(400);
    // A can still attach their own upload afterwards.
    const ok = await agentA
      .post(`/api/lit/bundles/${bundleA.body.id}/documents/from-upload`)
      .send({ objectPath, fileName: "a.pdf", contentType: "application/pdf" });
    expect(ok.status).toBe(201);
  });

  it("links matter-scoped cause papers, and rejects cross-matter links directly", async () => {
    const agentA = await loginAgent(CODE_A);
    const bundle = await agentA
      .post("/api/lit/bundles")
      .send({ title: `Linking ${RUN_ID}`, bundleType: "pleadings", matterId: matter1 });
    const bundleId = bundle.body.id as number;

    // Listing is scoped to the bundle's matter.
    const linkable = await agentA.get(`/api/lit/bundles/${bundleId}/linkable-work`);
    expect(linkable.status).toBe(200);
    const ids = (linkable.body.items as { id: number }[]).map((i) => i.id);
    expect(ids).toContain(work1);
    expect(ids).not.toContain(work2);

    // Same-matter link succeeds.
    const link = await agentA
      .post(`/api/lit/bundles/${bundleId}/documents/from-saved-work`)
      .send({ savedWorkId: work1 });
    expect(link.status).toBe(201);
    expect(link.body.source).toBe("saved-work");
    expect(link.body.savedWorkId).toBe(work1);

    // Duplicate link rejected.
    const dup = await agentA
      .post(`/api/lit/bundles/${bundleId}/documents/from-saved-work`)
      .send({ savedWorkId: work1 });
    expect(dup.status).toBe(409);

    // Direct cross-matter link (bypassing the filtered listing) is rejected.
    const cross = await agentA
      .post(`/api/lit/bundles/${bundleId}/documents/from-saved-work`)
      .send({ savedWorkId: work2 });
    expect(cross.status).toBe(400);
    // Unfiled saved work is also rejected for a matter-linked bundle.
    const unfiled = await agentA
      .post(`/api/lit/bundles/${bundleId}/documents/from-saved-work`)
      .send({ savedWorkId: workUnfiled });
    expect(unfiled.status).toBe(400);

    // A bundle with no matter accepts any of the subscriber's saved work.
    const loose = await agentA
      .post("/api/lit/bundles")
      .send({ title: `Loose ${RUN_ID}`, bundleType: "pleadings" });
    const looseLink = await agentA
      .post(`/api/lit/bundles/${loose.body.id}/documents/from-saved-work`)
      .send({ savedWorkId: work2 });
    expect(looseLink.status).toBe(201);

    // Another subscriber cannot link A's saved work.
    const agentB = await loginAgent(CODE_B);
    const bundleB = await agentB
      .post("/api/lit/bundles")
      .send({ title: `B bundle ${RUN_ID}`, bundleType: "pleadings" });
    const theft = await agentB
      .post(`/api/lit/bundles/${bundleB.body.id}/documents/from-saved-work`)
      .send({ savedWorkId: work1 });
    expect(theft.status).toBe(404);
  });
});
