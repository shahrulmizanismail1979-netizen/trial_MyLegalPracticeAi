import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

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

const createdPaths = [APPROVED_PATH, PENDING_PATH];

beforeAll(async () => {
  await db.insert(contributionsTable).values([
    {
      title: "Approved doc",
      category: "Litigation",
      contributorName: "Alice",
      contributorEmail: "alice@example.com",
      fileName: "approved.txt",
      objectPath: APPROVED_PATH,
      status: "approved",
    },
    {
      title: "Pending doc",
      category: "Litigation",
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
});

beforeEach(() => {
  state.auth = { userId: null };
  state.users = {};
  process.env.ADMIN_ALLOWED_EMAILS = "staff@example.com";
});

describe("GET /api/storage/objects/* access control", () => {
  it("serves an approved contribution's file to anonymous callers (public corpus)", async () => {
    const res = await request(app).get(urlFor(APPROVED_PATH));
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

  it("returns 401 for an object not tied to any contribution when anonymous", async () => {
    const res = await request(app).get(urlFor(UNKNOWN_PATH));
    expect(res.status).toBe(401);
  });

  it("serves an unknown object to a staff member", async () => {
    signInAs("user_staff", "staff@example.com");
    const res = await request(app).get(urlFor(UNKNOWN_PATH));
    expect(res.status).toBe(200);
  });
});
