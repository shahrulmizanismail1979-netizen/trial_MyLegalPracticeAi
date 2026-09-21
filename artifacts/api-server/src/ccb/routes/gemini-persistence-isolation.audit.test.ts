import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { eq, inArray } from "drizzle-orm";

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

const { default: app } = await import("../../app");
const { db, ccbAccessCodes, ccbConversations, ccbMessages } =
  await import("@workspace/db");

const RUN_ID = `ccb-persistence-audit-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
const CODE_A = `${RUN_ID}-A`.toUpperCase();
const CODE_B = `${RUN_ID}-B`.toUpperCase();
const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";
const accessCodeIds: number[] = [];
const conversationIds: number[] = [];

function token(code: string): string {
  return jwt.sign({ role: "practitioner", code }, SECRET, { expiresIn: "10m" });
}

function api(
  method: "get" | "post" | "delete",
  path: string,
  code: string,
) {
  const client = request(app);
  const req =
    method === "get"
      ? client.get(path)
      : method === "post"
        ? client.post(path)
        : client.delete(path);
  return req.set("Authorization", `Bearer ${token(code)}`);
}

beforeAll(async () => {
  const rows = await db
    .insert(ccbAccessCodes)
    .values([
      { code: CODE_A, label: RUN_ID, active: true },
      { code: CODE_B, label: RUN_ID, active: true },
    ])
    .returning({ id: ccbAccessCodes.id });
  accessCodeIds.push(...rows.map((row) => row.id));
});

afterAll(async () => {
  if (conversationIds.length > 0) {
    await db
      .delete(ccbMessages)
      .where(inArray(ccbMessages.conversationId, conversationIds));
    await db
      .delete(ccbConversations)
      .where(inArray(ccbConversations.id, conversationIds));
  }
  if (accessCodeIds.length > 0) {
    await db
      .delete(ccbAccessCodes)
      .where(inArray(ccbAccessCodes.id, accessCodeIds));
  }
});

describe("CCB specialist output persistence and tenant isolation audit", () => {
  it("saves a conversation, reopens its persisted output, and hides it from another subscriber", async () => {
    const created = await api(
      "post",
      "/api/ccb/gemini/conversations",
      CODE_A,
    ).send({ title: `Persisted specialist output ${RUN_ID}` });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const conversationId = created.body.id as number;
    conversationIds.push(conversationId);

    const [message] = await db
      .insert(ccbMessages)
      .values({
        conversationId,
        role: "assistant",
        content: `Persisted analysis ${RUN_ID}`,
      })
      .returning();

    const reopened = await api(
      "get",
      `/api/ccb/gemini/conversations/${conversationId}`,
      CODE_A,
    );
    expect(reopened.status).toBe(200);
    expect(reopened.body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: message.id,
          content: `Persisted analysis ${RUN_ID}`,
        }),
      ]),
    );

    const foreignList = await api(
      "get",
      "/api/ccb/gemini/conversations",
      CODE_B,
    );
    expect(foreignList.status).toBe(200);
    expect(
      foreignList.body.some(
        (conversation: { id: number }) => conversation.id === conversationId,
      ),
    ).toBe(false);

    expect(
      (
        await api(
          "get",
          `/api/ccb/gemini/conversations/${conversationId}`,
          CODE_B,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await api(
          "get",
          `/api/ccb/gemini/conversations/${conversationId}/messages`,
          CODE_B,
        )
      ).status,
    ).toBe(404);
  });

  it("does not let a foreign subscriber erase another subscriber's persisted output", async () => {
    const created = await api(
      "post",
      "/api/ccb/gemini/conversations",
      CODE_A,
    ).send({ title: `Deletion isolation ${RUN_ID}` });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const conversationId = created.body.id as number;
    conversationIds.push(conversationId);

    const [message] = await db
      .insert(ccbMessages)
      .values({
        conversationId,
        role: "assistant",
        content: `Must survive foreign delete ${RUN_ID}`,
      })
      .returning();

    const foreignDelete = await api(
      "delete",
      `/api/ccb/gemini/conversations/${conversationId}`,
      CODE_B,
    );
    expect(foreignDelete.status).toBe(404);

    const [persistedMessage] = await db
      .select()
      .from(ccbMessages)
      .where(eq(ccbMessages.id, message.id));
    expect(persistedMessage).toBeDefined();

    const reopened = await api(
      "get",
      `/api/ccb/gemini/conversations/${conversationId}`,
      CODE_A,
    );
    expect(reopened.status).toBe(200);
    expect(reopened.body.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: message.id }),
      ]),
    );
  });

  it("lets the owner delete a conversation and atomically cascades its persisted output", async () => {
    const created = await api(
      "post",
      "/api/ccb/gemini/conversations",
      CODE_A,
    ).send({ title: `Owner deletion ${RUN_ID}` });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const conversationId = created.body.id as number;
    conversationIds.push(conversationId);

    const [message] = await db
      .insert(ccbMessages)
      .values({
        conversationId,
        role: "assistant",
        content: `Delete with parent ${RUN_ID}`,
      })
      .returning();

    const ownerDelete = await api(
      "delete",
      `/api/ccb/gemini/conversations/${conversationId}`,
      CODE_A,
    );
    expect(ownerDelete.status).toBe(200);
    expect(ownerDelete.body).toEqual({ success: true });

    const [deletedConversation] = await db
      .select()
      .from(ccbConversations)
      .where(eq(ccbConversations.id, conversationId));
    const [deletedMessage] = await db
      .select()
      .from(ccbMessages)
      .where(eq(ccbMessages.id, message.id));
    expect(deletedConversation).toBeUndefined();
    expect(deletedMessage).toBeUndefined();

    expect(
      (
        await api(
          "get",
          `/api/ccb/gemini/conversations/${conversationId}`,
          CODE_A,
        )
      ).status,
    ).toBe(404);
  });
});