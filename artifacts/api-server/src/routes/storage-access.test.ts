import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

const MASTER_ACCESS_CODE = "storage-test-master-code";
const SESSION_SECRET = "storage-test-session-secret";
const FINGERPRINT_KEY = "storage-test-fingerprint-key";

vi.stubEnv("MASTER_ACCESS_CODE", MASTER_ACCESS_CODE);
vi.stubEnv("SESSION_SECRET", SESSION_SECRET);
vi.stubEnv("MASTER_ACCESS_FINGERPRINT_KEY", FINGERPRINT_KEY);

// Mutable Clerk auth state, mirroring admin-auth.test.ts.
const state = vi.hoisted(() => ({
  auth: { userId: null as string | null },
  users: {} as Record<
    string,
    {
      emailAddresses: Array<{ id: string; emailAddress: string }>;
      primaryEmailAddressId: string | null;
    }
  >,
}));

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => state.auth,
  clerkClient: {
    users: {
      getUser: async (id: string) => {
        const user = state.users[id];
        if (!user) throw new Error(`user ${id} not found`);
        return user;
      },
    },
  },
}));

// Mock only the storage I/O so the route can serve bytes without the Replit
// object-storage sidecar. The access-control logic under test lives in the route.
vi.mock("../lib/objectStorage", () => {
  class ObjectNotFoundError extends Error {
    constructor() {
      super("Object not found");
      this.name = "ObjectNotFoundError";
    }
  }
  class ObjectStorageService {
    async getObjectEntityFile(objectPath: string) {
      return { objectPath };
    }
    async downloadObject() {
      return new Response("file-bytes", {
        headers: { "Content-Type": "text/plain" },
      });
    }
  }
  return { ObjectStorageService, ObjectNotFoundError };
});

const { default: app } = await import("../app");
const { db, contributionsTable } = await import("@workspace/db");
const { inArray } = await import("drizzle-orm");

const RUN_ID = randomUUID();
const APPROVED_PATH = `/objects/uploads/${RUN_ID}-approved`;
const PENDING_PATH = `/objects/uploads/${RUN_ID}-pending`;
const UNKNOWN_PATH = `/objects/uploads/${RUN_ID}-unknown`;

function urlFor(objectPath: string): string {
  // objectPath is "/objects/<...>"; the route is mounted at /api/storage/objects/<...>
  return `/api/storage${objectPath}`;
}

function signInAs(userId: string, email: string): void {
  state.auth = { userId };
  state.users[userId] = {
    emailAddresses: [{ id: "email_1", emailAddress: email }],
    primaryEmailAddressId: "email_1",
  };
}

async function masterAgent() {
  const agent = request.agent(app);
  await agent
    .post("/api/admin/master/login")
    .send({ password: MASTER_ACCESS_CODE })
    .expect(200);
  return agent;
}

const createdPaths = [APPROVED_PATH, PENDING_PATH];

beforeAll(async () => {
  await db.insert(contributionsTable).values([
    {
      title: "Approved doc",
      categories: ["Litigation"],
      contributorName: "Alice",
      contributorEmail: "alice@example.com",
      fileName: "approved.txt",
      objectPath: APPROVED_PATH,
      status: "approved",
    },
    {
      title: "Pending doc",
      categories: ["Litigation"],
      contributorName: "Bob",
      contributorEmail: "bob@example.com",
      fileName: "pending.txt",
      objectPath: PENDING_PATH,
      status: "pending",
    },
  ]);
});

afterAll(async () => {
  await db
    .delete(contributionsTable)
    .where(inArray(contributionsTable.objectPath, createdPaths));
  vi.unstubAllEnvs();
});

beforeEach(() => {
  state.auth = { userId: null };
  state.users = {};
  process.env.ADMIN_ALLOWED_EMAILS = "staff@example.com";
});

describe("GET /api/storage/objects/* access control", () => {
  it("returns 401 for an approved contribution's file when anonymous (originals stay private)", async () => {
    const res = await request(app).get(urlFor(APPROVED_PATH));
    expect(res.status).toBe(401);
  });

  it("serves an approved contribution's file to a staff member", async () => {
    signInAs("user_staff", "staff@example.com");
    const res = await request(app).get(urlFor(APPROVED_PATH));
    expect(res.status).toBe(200);
    expect(res.text).toBe("file-bytes");
  });

  it("serves an approved contribution's file to a landing master session", async () => {
    const agent = await masterAgent();
    const res = await agent.get(urlFor(APPROVED_PATH));
    expect(res.status).toBe(200);
    expect(res.text).toBe("file-bytes");
  });

  it("returns 401 for a pending contribution's file when anonymous", async () => {
    const res = await request(app).get(urlFor(PENDING_PATH));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a pending contribution's file when authenticated but not staff", async () => {
    signInAs("user_outsider", "outsider@example.com");
    const res = await request(app).get(urlFor(PENDING_PATH));
    expect(res.status).toBe(403);
  });

  it("serves a pending contribution's file to a staff member", async () => {
    signInAs("user_staff", "staff@example.com");
    const res = await request(app).get(urlFor(PENDING_PATH));
    expect(res.status).toBe(200);
    expect(res.text).toBe("file-bytes");
  });

  it("serves an admin-review contribution's file to a landing master session", async () => {
    const agent = await masterAgent();
    const res = await agent.get(urlFor(PENDING_PATH));
    expect(res.status).toBe(200);
    expect(res.text).toBe("file-bytes");
  });

  it("returns 401 for an object not tied to any contribution when anonymous", async () => {
    const res = await request(app).get(urlFor(UNKNOWN_PATH));
    expect(res.status).toBe(401);
  });

  it("serves an unknown object to a staff member", async () => {
    signInAs("user_staff", "staff@example.com");
    const res = await request(app).get(urlFor(UNKNOWN_PATH));
    expect(res.status).toBe(200);
  });

  it("does not let a landing master session read an unregistered private object", async () => {
    const agent = await masterAgent();
    const res = await agent.get(urlFor(UNKNOWN_PATH));
    expect(res.status).toBe(403);
  });

  it("does not let platform staff bypass a firm workspace object route", async () => {
    signInAs("user_staff", "staff@example.com");
    const res = await request(app).get(
      "/api/storage/objects/firm/123/uploads/known-object",
    );
    expect(res.status).toBe(404);
  });
});
