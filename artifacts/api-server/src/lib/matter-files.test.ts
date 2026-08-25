import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";

// The app pulls in Clerk middleware for the main admin dashboard; mock it so
// these tests run without Clerk credentials (mirrors lit-uploads.test.ts).
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

// Object storage depends on the Replit sidecar + GCS; the app imports it
// transitively via the lit/other routers, so stub it out the same way.
vi.mock("../lib/objectStorage", () => {
  const deletedObjects = new Set<string>();
  const unsafeContentPaths = new Set<string>();
  class FakeObjectStorageService {
    async getObjectEntityUploadURL(): Promise<string> {
      return `https://storage.example.com/bucket/.private/uploads/${randomUUID()}?sig=x`;
    }
    normalizeObjectEntityPath(rawPath: string): string {
      const m = rawPath.match(/uploads\/([0-9a-f-]+)/);
      return `/objects/uploads/${m ? m[1] : rawPath}`;
    }
    async getObjectEntityFile(path: string) {
      if (!path.startsWith("/objects/uploads/")) {
        const err = new Error("Object not found") as Error & { name: string };
        err.name = "ObjectNotFoundError";
        throw err;
      }
      return {
        async getMetadata() {
          return [{
            size: "5242880",
            contentType: unsafeContentPaths.has(path) ? "text/html; charset=utf-8" : "text/markdown; charset=utf-8",
          }];
        },
        async delete() {
          deletedObjects.add(path);
        },
      };
    }
    async downloadObject(): Promise<Response> {
      return new Response("# Stored test draft\n\nA private generated work product.", {
        headers: { "Content-Type": "text/markdown; charset=utf-8" },
      });
    }
  }
  return {
    ObjectStorageService: FakeObjectStorageService,
    ObjectNotFoundError: class extends Error {},
    storageTestState: { deletedObjects, unsafeContentPaths },
  };
});

const { default: app } = await import("../app");
const { ensureDocumentTables } = await import("../lib/caseDocuments");
const { ensureMatterFileTables } = await import("../lib/matterFiles");
const { storageTestState } = await import("../lib/objectStorage");
const {
  db,
  corpAccessCodes,
  corpSessions,
  corpMatters,
  corpMatterDeadlines,
  corpSavedWork,
  ccbAccessCodes,
  ccbMatters,
  ccbMatterDeadlines,
  ccbSavedWork,
  usersTable,
  conveyMatters,
  conveyMatterDeadlines,
  conveySavedWork,
} = await import("@workspace/db");
const { inArray, like } = await import("drizzle-orm");
const { signToken } = await import("./auth");

// Same signing secret resolution as src/ccb/routes/auth.ts + src/lib/auth.ts.
const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";
// Reuse the ccb auth token shape (role + code) so requirePractitioner accepts it.
function signCcbToken(code: string): string {
  return jwt.sign({ role: "practitioner", code }, SECRET, { expiresIn: "7d" });
}
// A master/static code (see MASTER_ACCESS_CODE / CCB_ACCESS_CODES defaults)
// resolves to accessCodeId null in requirePractitioner → matter routes 403.
const MASTER_CODE = (process.env.MASTER_ACCESS_CODE ?? "CCBLIT2024").trim().toUpperCase();

const RUN_ID = randomUUID().slice(0, 8).toUpperCase();

// corp_access_codes.code is varchar(20); keep codes short.
const CORP_CODE_A = `C-A-${RUN_ID}`;
const CORP_CODE_B = `C-B-${RUN_ID}`;
const CORP_TOKEN_A = `corp-tok-a-${RUN_ID}`;
const CORP_TOKEN_B = `corp-tok-b-${RUN_ID}`;

const CCB_CODE_A = `CCB-A-${RUN_ID}`;
const CCB_CODE_B = `CCB-B-${RUN_ID}`;

const USER_CODE_A = `U-A-${RUN_ID}`;
const USER_CODE_B = `U-B-${RUN_ID}`;

// Owner ids seeded in beforeAll, per portal.
const corp = { aId: 0, bId: 0, tokenA: CORP_TOKEN_A, tokenB: CORP_TOKEN_B };
const ccb = { aId: 0, bId: 0, tokenA: "", tokenB: "", masterToken: "" };
const convey = { aId: 0, bId: 0, tokenA: "", tokenB: "" };

beforeAll(async () => {
  await ensureMatterFileTables();
  await ensureDocumentTables();
  // ── Corp: two access codes + one active session each ──────────────────────
  const corpRows = await db
    .insert(corpAccessCodes)
    .values([
      { code: CORP_CODE_A, label: `corp A ${RUN_ID}`, isActive: true, tier: "firm" },
      { code: CORP_CODE_B, label: `corp B ${RUN_ID}`, isActive: true, tier: "firm" },
    ])
    .returning({ id: corpAccessCodes.id });
  corp.aId = corpRows[0].id;
  corp.bId = corpRows[1].id;
  await db.insert(corpSessions).values([
    { accessCodeId: corp.aId, sessionToken: CORP_TOKEN_A, isActive: true },
    { accessCodeId: corp.bId, sessionToken: CORP_TOKEN_B, isActive: true },
  ]);

  // ── CCB: two access codes; tokens signed like the real auth route ─────────
  const ccbRows = await db
    .insert(ccbAccessCodes)
    .values([
      { code: CCB_CODE_A, label: `ccb A ${RUN_ID}`, active: true },
      { code: CCB_CODE_B, label: `ccb B ${RUN_ID}`, active: true },
    ])
    .returning({ id: ccbAccessCodes.id });
  ccb.aId = ccbRows[0].id;
  ccb.bId = ccbRows[1].id;
  ccb.tokenA = signCcbToken(CCB_CODE_A);
  ccb.tokenB = signCcbToken(CCB_CODE_B);
  ccb.masterToken = signCcbToken(MASTER_CODE);

  // ── Convey: two active users (no accessCode → never expires) ──────────────
  const userRows = await db
    .insert(usersTable)
    .values([
      {
        accessCode: USER_CODE_A,
        displayName: `convey A ${RUN_ID}`,
        isActive: true,
        // grandfathered → effectiveTier "firm" + active, so the convey paywall
        // (conveyGate default-deny) never blocks matter-file requests.
        grandfathered: true,
      },
      {
        accessCode: USER_CODE_B,
        displayName: `convey B ${RUN_ID}`,
        isActive: true,
        grandfathered: true,
      },
    ])
    .returning({ id: usersTable.id });
  convey.aId = userRows[0].id;
  convey.bId = userRows[1].id;
  convey.tokenA = signToken(convey.aId);
  convey.tokenB = signToken(convey.bId);
});

afterAll(async () => {
  // Matters/deadlines/saved-work cascade off their owners, but delete
  // explicitly (by seeded owner ids) so nothing lingers regardless of FKs.
  const corpIds = [corp.aId, corp.bId].filter(Boolean);
  const ccbIds = [ccb.aId, ccb.bId].filter(Boolean);
  const userIds = [convey.aId, convey.bId].filter(Boolean);

  if (corpIds.length) {
    await db.delete(corpMatterDeadlines).where(inArray(corpMatterDeadlines.ownerId, corpIds));
    await db.delete(corpSavedWork).where(inArray(corpSavedWork.ownerId, corpIds));
    await db.delete(corpMatters).where(inArray(corpMatters.ownerId, corpIds));
    await db.delete(corpSessions).where(inArray(corpSessions.accessCodeId, corpIds));
    await db.delete(corpAccessCodes).where(inArray(corpAccessCodes.id, corpIds));
  }
  await db.delete(corpAccessCodes).where(like(corpAccessCodes.code, `C-%-${RUN_ID}`));

  if (ccbIds.length) {
    await db.delete(ccbMatterDeadlines).where(inArray(ccbMatterDeadlines.ownerId, ccbIds));
    await db.delete(ccbSavedWork).where(inArray(ccbSavedWork.ownerId, ccbIds));
    await db.delete(ccbMatters).where(inArray(ccbMatters.ownerId, ccbIds));
    await db.delete(ccbAccessCodes).where(inArray(ccbAccessCodes.id, ccbIds));
  }
  await db.delete(ccbAccessCodes).where(like(ccbAccessCodes.code, `CCB-%-${RUN_ID}`));

  if (userIds.length) {
    await db.delete(conveyMatterDeadlines).where(inArray(conveyMatterDeadlines.ownerId, userIds));
    await db.delete(conveySavedWork).where(inArray(conveySavedWork.ownerId, userIds));
    await db.delete(conveyMatters).where(inArray(conveyMatters.ownerId, userIds));
    await db.delete(usersTable).where(inArray(usersTable.id, userIds));
  }
  await db.delete(usersTable).where(like(usersTable.accessCode, `U-%-${RUN_ID}`));
});

/**
 * Runs the full happy-path + isolation suite against one portal. `bearer`
 * builds the Authorization header for a token; each portal passes its own
 * base path and two independently-owned tokens.
 */
function portalSuite(
  name: string,
  base: string, // e.g. "/api/corp"
  tokenA: () => string,
  tokenB: () => string,
) {
  const auth = (t: string) => `Bearer ${t}`;
  const mattersPath = `${base}/matters`;
  const savedWorkPath = `${base}/saved-work`;

  describe(`${name} matter files`, () => {
    it("runs the create → file draft → reopen → deadline e2e flow", async () => {
      const A = auth(tokenA());

      // 1. Create matter (201, auto reference passed through).
      const reference = `REF-${RUN_ID}`;
      const created = await request(app)
        .post(mattersPath)
        .set("Authorization", A)
        .send({
          title: `E2E matter ${RUN_ID}`,
          clientName: "Acme Bhd",
          reference,
          matterType: "advisory",
        });
      expect(created.status).toBe(201);
      const matterId = created.body.id as number;
      expect(typeof matterId).toBe("number");
      expect(created.body.reference).toBe(reference);
      expect(created.body.status).toBe("open");

      // 2. File a draft via saved-work linked to the matter.
      const filed = await request(app)
        .post(savedWorkPath)
        .set("Authorization", A)
        .send({
          kind: "draft",
          title: `Filed draft ${RUN_ID}`,
          matterId,
          content: "First draft body",
        });
      expect(filed.status).toBe(201);
      expect(filed.body.matterId).toBe(matterId);
      expect(filed.body.kind).toBe("draft");
      const savedWorkId = filed.body.id as number;

      // 3. GET /matters/:id returns the matter (with deadlines array).
      const detail1 = await request(app)
        .get(`${mattersPath}/${matterId}`)
        .set("Authorization", A);
      expect(detail1.status).toBe(200);
      expect(detail1.body.id).toBe(matterId);
      expect(Array.isArray(detail1.body.deadlines)).toBe(true);
      expect(detail1.body.deadlines).toHaveLength(0);

      // 4. GET /matters/:id/work returns the filed draft (reopen).
      const work = await request(app)
        .get(`${mattersPath}/${matterId}/work`)
        .set("Authorization", A);
      expect(work.status).toBe(200);
      expect(work.body).toHaveLength(1);
      expect(work.body[0].id).toBe(savedWorkId);
      expect(work.body[0].content).toBe("First draft body");

      // 5. Add a deadline.
      const due = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
      const deadline = await request(app)
        .post(`${mattersPath}/${matterId}/deadlines`)
        .set("Authorization", A)
        .send({ title: `Hearing ${RUN_ID}`, dueDate: due, category: "custom" });
      expect(deadline.status).toBe(201);
      const deadlineId = deadline.body.id as number;
      expect(typeof deadlineId).toBe("number");

      // 6. GET detail now includes the deadline.
      const detail2 = await request(app)
        .get(`${mattersPath}/${matterId}`)
        .set("Authorization", A);
      expect(detail2.status).toBe(200);
      expect(detail2.body.deadlines).toHaveLength(1);
      expect(detail2.body.deadlines[0].id).toBe(deadlineId);
      expect(detail2.body.deadlines[0].title).toBe(`Hearing ${RUN_ID}`);
    });

    it("isolates matters between owners (404 across tenants, 401 anonymous)", async () => {
      const A = auth(tokenA());
      const B = auth(tokenB());

      // Owner A creates a matter.
      const created = await request(app)
        .post(mattersPath)
        .set("Authorization", A)
        .send({ title: `Isolation matter ${RUN_ID}` });
      expect(created.status).toBe(201);
      const aMatterId = created.body.id as number;

      // Owner B cannot GET / PATCH / DELETE A's matter → 404 (not 403, so the
      // existence of A's matter is not leaked).
      const bGet = await request(app)
        .get(`${mattersPath}/${aMatterId}`)
        .set("Authorization", B);
      expect(bGet.status).toBe(404);

      const bPatch = await request(app)
        .patch(`${mattersPath}/${aMatterId}`)
        .set("Authorization", B)
        .send({ title: "hijacked" });
      expect(bPatch.status).toBe(404);

      const bDelete = await request(app)
        .delete(`${mattersPath}/${aMatterId}`)
        .set("Authorization", B);
      expect(bDelete.status).toBe(404);

      // Owner B cannot file saved work against A's matter → 404.
      const bFile = await request(app)
        .post(savedWorkPath)
        .set("Authorization", B)
        .send({ kind: "draft", title: "cross-tenant", matterId: aMatterId });
      expect(bFile.status).toBe(404);

      // A's matter survived every attack.
      const aStillThere = await request(app)
        .get(`${mattersPath}/${aMatterId}`)
        .set("Authorization", A);
      expect(aStillThere.status).toBe(200);

      // Unauthenticated requests are rejected.
      const anonList = await request(app).get(mattersPath);
      expect(anonList.status).toBe(401);
      const anonWork = await request(app)
        .post(savedWorkPath)
        .send({ kind: "draft", title: "x" });
      expect(anonWork.status).toBe(401);
    });
  });
}

portalSuite("corp", "/api/corp", () => corp.tokenA, () => corp.tokenB);
portalSuite("ccb", "/api/ccb", () => ccb.tokenA, () => ccb.tokenB);
portalSuite("convey", "/api/convey", () => convey.tokenA, () => convey.tokenB);

describe("ccb static/master code", () => {
  // Master/static sessions are mapped onto a synthetic inactive access-code
  // row (see ccb/routes/matterAuth.ts) so they can own matter files without
  // seeing any real subscriber's data.
  it("owns its own isolated matter files via the synthetic tenant row", async () => {
    const master = `Bearer ${ccb.masterToken}`;
    const list = await request(app).get("/api/ccb/matters").set("Authorization", master);
    expect(list.status).toBe(200);
    // The synthetic tenant must never surface a real subscriber's matters:
    // every matter it sees belongs to the synthetic row, none to codes A/B.
    const masterMatters = Array.isArray(list.body)
      ? (list.body as { title: string }[])
      : [];
    for (const m of masterMatters) {
      expect(m.title).not.toContain(RUN_ID);
    }
    const work = await request(app)
      .post("/api/ccb/saved-work")
      .set("Authorization", master)
      .send({ kind: "draft", title: `master-work-${RUN_ID}` });
    expect(work.status).toBe(201);
    // The master's own list contains the row it just filed (owned by the
    // synthetic tenant; per-subscriber isolation is covered by portalSuite).
    const masterWork = await request(app)
      .get("/api/ccb/saved-work")
      .set("Authorization", master);
    expect(masterWork.status).toBe(200);
    const titles = (masterWork.body as { title: string }[]).map((w) => w.title);
    expect(titles).toContain(`master-work-${RUN_ID}`);
    // Clean up the master's saved work row.
    if (work.body?.id) {
      await request(app)
        .delete(`/api/ccb/saved-work/${work.body.id}`)
        .set("Authorization", master);
    }
  });
});

describe("private generated draft storage", () => {
  it("files a large draft through a one-time grant, supports retry/open/download, and remains owner-scoped", async () => {
    const A = `Bearer ${corp.tokenA}`;
    const B = `Bearer ${corp.tokenB}`;
    const matter = await request(app)
      .post("/api/corp/matters")
      .set("Authorization", A)
      .send({ title: `Stored draft matter ${RUN_ID}` });
    expect(matter.status).toBe(201);

    const grant = await request(app)
      .post("/api/corp/saved-work/upload-url")
      .set("Authorization", A)
      .send({});
    expect(grant.status).toBe(200);
    expect(grant.body.objectPath).toMatch(/^\/objects\/uploads\//);

    const body = {
      kind: "draft",
      title: `Stored draft ${RUN_ID}`,
      matterId: matter.body.id,
      objectPath: grant.body.objectPath,
      fileName: "board-resolution.md",
      contentType: "text/markdown; charset=utf-8",
      clientRequestId: `saved-${RUN_ID}`,
    };
    const filed = await request(app)
      .post("/api/corp/saved-work")
      .set("Authorization", A)
      .send(body);
    expect(filed.status).toBe(201);
    expect(filed.body.storageStatus).toBe("stored");
    expect(filed.body.content).toBe("");
    expect(filed.body.sizeBytes).toBe(5_242_880);
    const workId = filed.body.id as number;

    // A lost response can be retried without consuming the one-time grant
    // again or creating a second saved-work row.
    const retried = await request(app)
      .post("/api/corp/saved-work")
      .set("Authorization", A)
      .send(body);
    expect(retried.status).toBe(200);
    expect(retried.body.id).toBe(workId);

    const reopened = await request(app)
      .get(`/api/corp/saved-work/${workId}/content`)
      .set("Authorization", A);
    expect(reopened.status).toBe(200);
    expect(reopened.text).toContain("Stored test draft");
    expect(reopened.headers["content-type"]).toContain("text/plain");
    expect(reopened.headers["content-disposition"]).toContain("attachment");

    const downloaded = await request(app)
      .get(`/api/corp/saved-work/${workId}/download`)
      .set("Authorization", A);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers["content-disposition"]).toContain("attachment");

    const foreignOpen = await request(app)
      .get(`/api/corp/saved-work/${workId}/content`)
      .set("Authorization", B);
    expect(foreignOpen.status).toBe(404);

    const deleted = await request(app)
      .delete(`/api/corp/saved-work/${workId}`)
      .set("Authorization", A);
    expect(deleted.status).toBe(200);
    expect(storageTestState.deletedObjects.has(grant.body.objectPath)).toBe(true);
  });

  it("forces hostile stored content to download as plain text", async () => {
    const A = `Bearer ${corp.tokenA}`;
    const grant = await request(app)
      .post("/api/corp/saved-work/upload-url")
      .set("Authorization", A)
      .send({});
    storageTestState.unsafeContentPaths.add(grant.body.objectPath);
    const filed = await request(app)
      .post("/api/corp/saved-work")
      .set("Authorization", A)
      .send({
        kind: "draft",
        title: "hostile content",
        objectPath: grant.body.objectPath,
        fileName: "unsafe.html",
        clientRequestId: `unsafe-${RUN_ID}`,
      });
    expect(filed.status).toBe(201);
    const opened = await request(app)
      .get(`/api/corp/saved-work/${filed.body.id}/content`)
      .set("Authorization", A);
    expect(opened.status).toBe(200);
    expect(opened.headers["content-type"]).toContain("text/plain");
    expect(opened.headers["content-disposition"]).toContain("attachment");
  });

  it("confirms simultaneous retries once without duplicate saved-work rows", async () => {
    const A = `Bearer ${corp.tokenA}`;
    const [firstGrant, secondGrant] = await Promise.all([
      request(app)
        .post("/api/corp/saved-work/upload-url")
        .set("Authorization", A)
        .send({}),
      request(app)
        .post("/api/corp/saved-work/upload-url")
        .set("Authorization", A)
        .send({}),
    ]);
    expect(firstGrant.status).toBe(200);
    expect(secondGrant.status).toBe(200);
    const body = (objectPath: string) => ({
      kind: "draft",
      title: "concurrent confirmation",
      objectPath,
      fileName: "concurrent.md",
      clientRequestId: `race-${RUN_ID}`,
    });
    const [first, second] = await Promise.all([
      request(app).post("/api/corp/saved-work").set("Authorization", A).send(body(firstGrant.body.objectPath)),
      request(app).post("/api/corp/saved-work").set("Authorization", A).send(body(secondGrant.body.objectPath)),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(first.body.id).toBe(second.body.id);
    const paths = [firstGrant.body.objectPath, secondGrant.body.objectPath];
    expect(paths.some((path) => storageTestState.deletedObjects.has(path))).toBe(true);
  });

  it("rejects oversized legacy JSON drafts and unissued storage paths", async () => {
    const A = `Bearer ${corp.tokenA}`;
    const tooLarge = await request(app)
      .post("/api/corp/saved-work")
      .set("Authorization", A)
      .send({ kind: "draft", title: "too large", content: "x".repeat(500_001) });
    expect(tooLarge.status).toBe(413);

    const grant = await request(app)
      .post("/api/corp/saved-work/upload-url")
      .set("Authorization", A)
      .send({});
    const unissued = await request(app)
      .post("/api/corp/saved-work")
      .set("Authorization", A)
      .send({
        kind: "draft",
        title: "unissued",
        objectPath: `${grant.body.objectPath}-not-issued`,
        fileName: "unissued.md",
      });
    expect(unissued.status).toBe(400);
  });
});
