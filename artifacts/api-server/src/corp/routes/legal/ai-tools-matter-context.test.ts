/**
 * Corporate AI drafting matter context integration coverage.
 *
 * A matter chosen in the drafting UI is sent as matterId. The route must
 * resolve that ID against the authenticated access-code owner before placing
 * any matter details in the Gemini request.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { inArray } from "drizzle-orm";

vi.mock("@clerk/express", () => ({
  clerkMiddleware:
    () =>
    (_req: unknown, _res: unknown, next: () => void): void =>
      next(),
  getAuth: () => ({ userId: null }),
  clerkClient: { users: { getUser: async () => Promise.reject(new Error("not found")) } },
}));

vi.mock("@workspace/integrations-gemini-ai", () => ({
  ai: {
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: "{}" }),
      generateContentStream: vi.fn(async () =>
        (async function* () {
          yield { text: "# Draft\n\nComplete mocked draft." };
        })(),
      ),
    },
  },
}));

const { default: app } = await import("../../../app");
const { ai } = await import("@workspace/integrations-gemini-ai");
const { db, corpAccessCodes, corpMatterFiles, corpSessions, pool } = await import("@workspace/db");
const { ensureMatterFileTables } = await import("../../../lib/matterFiles");

const RUN_ID = `corp-ai-matter-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const CODE_A = `CAMTA${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
const CODE_B = `CAMTB${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

let ownerA = 0;
let ownerB = 0;
let tokenA = "";
let tokenB = "";
let matterA = 0;
let matterB = 0;

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  await ensureMatterFileTables();

  const codes = await db
    .insert(corpAccessCodes)
    .values([
      { code: CODE_A, label: `Corporate AI matter context A ${RUN_ID}`, isActive: true },
      { code: CODE_B, label: `Corporate AI matter context B ${RUN_ID}`, isActive: true },
    ])
    .returning();
  ownerA = codes[0]!.id;
  ownerB = codes[1]!.id;

  const [loginA, loginB] = await Promise.all([
    request(app).post("/api/corp/legal/verify-password").send({ password: CODE_A }),
    request(app).post("/api/corp/legal/verify-password").send({ password: CODE_B }),
  ]);
  expect(loginA.body.success).toBe(true);
  expect(loginB.body.success).toBe(true);
  tokenA = loginA.body.token as string;
  tokenB = loginB.body.token as string;

  const [createdA, createdB] = await Promise.all([
    request(app)
      .post("/api/corp/matters")
      .set(auth(tokenA))
      .send({
        title: `Matter owned by A ${RUN_ID}`,
        clientName: "A Client Sdn Bhd",
        counterparty: "A Counterparty",
        matterType: "share sale",
        reference: `A-REF-${RUN_ID}`,
        notes: "Use the approved A-side transaction facts.",
      }),
    request(app)
      .post("/api/corp/matters")
      .set(auth(tokenB))
      .send({ title: `Matter owned by B ${RUN_ID}` }),
  ]);
  expect(createdA.status).toBe(201);
  expect(createdB.status).toBe(201);
  matterA = createdA.body.id as number;
  matterB = createdB.body.id as number;
});

afterAll(async () => {
  if (ownerA || ownerB) {
    await pool.query("DELETE FROM corp_matters WHERE access_code_id = ANY($1::int[])", [[ownerA, ownerB]]);
    await db.delete(corpSessions).where(inArray(corpSessions.accessCodeId, [ownerA, ownerB]));
    await db.delete(corpAccessCodes).where(inArray(corpAccessCodes.id, [ownerA, ownerB]));
  }
});

describe("corporate AI drafting matter context", () => {
  it("includes the selected owner's matter context in the Gemini request", async () => {
    const generateContentStream = ai.models.generateContentStream as ReturnType<typeof vi.fn>;
    generateContentStream.mockClear();

    const response = await request(app)
      .post("/api/corp/legal/ai-tools/chat")
      .set(auth(tokenA))
      .send({
        tool: "drafter",
        message: "Prepare a board resolution for the transaction.",
        matterId: matterA,
      });

    expect(response.status).toBe(200);
    expect(generateContentStream).toHaveBeenCalledTimes(1);
    const requestConfig = generateContentStream.mock.calls[0]![0] as {
      contents: Array<{ parts: Array<{ text: string }> }>;
    };
    const prompt = requestConfig.contents[0]!.parts[0]!.text;
    expect(prompt).toContain(`Matter ID: ${matterA}`);
    expect(prompt).toContain(`Matter: Matter owned by A ${RUN_ID}`);
    expect(prompt).toContain("Client: A Client Sdn Bhd");
    expect(prompt).toContain("Use the approved A-side transaction facts.");
  });

  it("rejects a matter owned by another corporate access code before generating", async () => {
    const generateContentStream = ai.models.generateContentStream as ReturnType<typeof vi.fn>;
    generateContentStream.mockClear();

    const response = await request(app)
      .post("/api/corp/legal/ai-tools/chat")
      .set(auth(tokenA))
      .send({
        tool: "drafter",
        message: "Prepare a board resolution.",
        matterId: matterB,
      });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Matter not found" });
    expect(generateContentStream).not.toHaveBeenCalled();
  });
});