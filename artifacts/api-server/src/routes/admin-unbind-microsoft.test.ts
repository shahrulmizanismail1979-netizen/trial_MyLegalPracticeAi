import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import { and, eq, sql } from "drizzle-orm";
import { db, subscribersTable, microsoftLinks } from "@workspace/db";

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

const { default: app } = await import("../app");

const RUN_ID = crypto.randomUUID().slice(0, 8);
const CODE = `TEST-UNBIND-${RUN_ID}`;
const EMAIL = `unbind-${RUN_ID}@test.example`;

function signInAsStaff(): void {
  state.auth = { userId: "user_staff" };
  state.users["user_staff"] = {
    emailAddresses: [{ id: "email_1", emailAddress: "staff@example.com" }],
    primaryEmailAddressId: "email_1",
  };
}

beforeEach(() => {
  state.auth = { userId: null };
  state.users = {};
  process.env.ADMIN_ALLOWED_EMAILS = "staff@example.com";
});

afterAll(async () => {
  await db.delete(microsoftLinks).where(eq(microsoftLinks.email, EMAIL));
  await db.delete(subscribersTable).where(eq(subscribersTable.accessCode, CODE));
});

describe("PATCH /api/admin/subscribers/:id/unbind-microsoft", () => {
  it("requires authentication", async () => {
    const res = await request(app).patch("/api/admin/subscribers/1/unbind-microsoft");
    expect(res.status).toBe(401);
  });

  it("deactivates Microsoft links for the subscriber's code (case-insensitive)", async () => {
    const [sub] = await db
      .insert(subscribersTable)
      .values({
        name: `Unbind Test ${RUN_ID}`,
        email: EMAIL,
        phone: "0000000000",
        accessCode: CODE,
        apps: [],
        paymentStatus: "confirmed",
        paymentAmount: "0",
      })
      .returning();
    await db
      .insert(microsoftLinks)
      .values({ email: EMAIL, app: "lit", accessCode: CODE.toLowerCase(), active: true });

    signInAsStaff();
    const res = await request(app).patch(`/api/admin/subscribers/${sub!.id}/unbind-microsoft`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unbound: 1 });

    const remaining = await db
      .select()
      .from(microsoftLinks)
      .where(
        and(
          sql`lower(${microsoftLinks.accessCode}) = lower(${CODE})`,
          eq(microsoftLinks.active, true),
        ),
      );
    expect(remaining).toHaveLength(0);

    // Second call is a no-op.
    const again = await request(app).patch(`/api/admin/subscribers/${sub!.id}/unbind-microsoft`);
    expect(again.status).toBe(200);
    expect(again.body).toEqual({ unbound: 0 });
  });

  it("returns 404 for an unknown subscriber", async () => {
    signInAsStaff();
    const res = await request(app).patch("/api/admin/subscribers/999999999/unbind-microsoft");
    expect(res.status).toBe(404);
  });
});
