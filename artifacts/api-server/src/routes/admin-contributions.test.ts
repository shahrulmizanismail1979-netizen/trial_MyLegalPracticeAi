import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";

// Hoisted mutable state so both the mock factory and test code share the same ref.
const authState = vi.hoisted(() => ({
  userId: "user_admin" as string | null,
}));

// Mock Clerk so every request is treated as authenticated staff.
vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: authState.userId }),
  clerkClient: {
    users: {
      getUser: async (_id: string) => ({
        emailAddresses: [{ id: "e1", emailAddress: "admin@aiwebbooks.com" }],
        primaryEmailAddressId: "e1",
      }),
    },
  },
}));

// Mock the stripe client so it always throws — simulating Stripe being unavailable.
vi.mock("../stripeClient", () => ({
  getStripeSync: vi.fn().mockRejectedValue(new Error("Stripe unavailable")),
  getUncachableStripeClient: vi.fn().mockRejectedValue(new Error("Stripe unavailable")),
}));

// Also mock object storage (same pattern as contributions.test.ts).
vi.mock("../lib/objectStorage", () => {
  class ObjectNotFoundError extends Error {
    constructor() { super("Object not found"); this.name = "ObjectNotFoundError"; }
  }
  class ObjectStorageService {
    async getObjectEntityFile(_objectPath: string) {
      return { download: async (): Promise<[Buffer]> => [Buffer.from("test")] };
    }
  }
  return { ObjectStorageService, ObjectNotFoundError };
});

const { default: app } = await import("../app");
const { db, contributionsTable } = await import("@workspace/db");
const { eq, inArray } = await import("drizzle-orm");

const STAFF_EMAIL = "admin@aiwebbooks.com";
const RUN_ID = randomUUID();
const createdIds: number[] = [];

describe("admin contribution approval — decoupled from Stripe", () => {
  beforeAll(async () => {
    process.env.ADMIN_ALLOWED_EMAILS = STAFF_EMAIL;

    // Create a pending contribution directly in the DB.
    const [row] = await db
      .insert(contributionsTable)
      .values({
        title: `Admin Approval Test ${RUN_ID}`,
        categories: ["Litigation"],
        contributorName: "Test Contributor",
        contributorEmail: `contrib-${RUN_ID}@example.test`,
        fileName: "test.txt",
        objectPath: `/objects/test-${RUN_ID}`,
        status: "pending",
        extractionStatus: "pending",
      })
      .returning();
    createdIds.push(row.id);
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await db.delete(contributionsTable).where(inArray(contributionsTable.id, createdIds));
    }
  });

  it("approves a contribution and returns 200 even when Stripe throws", async () => {
    const [row] = await db
      .select()
      .from(contributionsTable)
      .where(eq(contributionsTable.id, createdIds[0]));
    expect(row).toBeDefined();

    const res = await request(app)
      .patch(`/api/admin/contributions/${row.id}`)
      .send({ status: "approved" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("approved");
    expect(res.body.id).toBe(row.id);
  });

  it("contribution is persisted as approved in the DB after Stripe failure", async () => {
    const [row] = await db
      .select()
      .from(contributionsTable)
      .where(eq(contributionsTable.id, createdIds[0]));
    expect(row.status).toBe("approved");
  });

  it("approved contribution appears in the public knowledge-base endpoint", async () => {
    const res = await request(app).get("/api/knowledge-base");
    expect(res.status).toBe(200);
    const ids = res.body.map((e: { id: number }) => e.id);
    expect(ids).toContain(createdIds[0]);
  });
});
