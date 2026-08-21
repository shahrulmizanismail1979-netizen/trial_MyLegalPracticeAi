/**
 * Integration test — Analyzer matterContext wiring (Task #137 follow-up)
 *
 * Verifies the full request path:
 *   POST /api/lit/irac/extract  (pasteTexts)  → caseId
 *   POST /api/lit/irac/analyze  { caseId, matterContext }
 *   → streamChat receives a prompt that contains the matterContext string
 *
 * The AI layer (streamChat) is mocked so no real API keys are needed.
 * The IRAC in-memory case store is used directly.
 * A real lit access-code row is created/cleaned up to satisfy the session gate.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "crypto";

// ── Standard clerk mock (required by app bootstrap) ─────────────────────────
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

// ── Capture streamChat calls without hitting the real AI ─────────────────────
// Hoisted so the vi.mock factory can reference the same object.
const capturedMessages = vi.hoisted(() => ({
  calls: [] as Array<Array<{ role?: string; text: string }>>,
}));

vi.mock("../lib/aiProvider", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/aiProvider")>();
  return {
    ...original,
    // Replace the streaming generator: record the messages, then emit a minimal
    // SSE-compatible response so the route handler finishes cleanly.
    streamChat: vi.fn(async function* (
      messages: Array<{ role?: string; text: string }>,
    ) {
      capturedMessages.calls.push(messages);
      yield { text: "MOCK_ANALYSIS" };
      yield {
        text: "",
        done: true,
        citations: [] as unknown[],
        disclaimer: "mock disclaimer",
        truncated: false,
        groundingWarning: false,
      };
    }),
  };
});

// ── App + DB imports (after mocks are registered) ────────────────────────────
const { default: app } = await import("../../app");
const { db, litAccessCodes } = await import("@workspace/db");
const { inArray } = await import("drizzle-orm");

// ─────────────────────────────────────────────────────────────────────────────

const RUN_ID = crypto.randomUUID().slice(0, 8).toUpperCase();
const CODE = `IRACCTX-${RUN_ID}`;

let codeId: number;
let agent: request.Agent;
let caseId: string;

beforeAll(async () => {
  // Insert a real access code so the lit session gate accepts the login.
  const [row] = await db
    .insert(litAccessCodes)
    .values({
      code: CODE,
      recipientName: `IRAC Context Test ${RUN_ID}`,
      recipientEmail: `iracctx-${RUN_ID}@test.invalid`,
      status: "active",
    })
    .returning({ id: litAccessCodes.id });
  codeId = row.id;

  // Log in to get a session cookie.
  agent = request.agent(app);
  const loginRes = await agent
    .post("/api/lit/auth/login")
    .send({ password: CODE });
  expect(
    loginRes.status,
    `lit login failed: ${JSON.stringify(loginRes.body)}`,
  ).toBe(200);

  // Register a small document using pasteTexts (no file upload required).
  const extractRes = await agent
    .post("/api/lit/irac/extract")
    .field("pathway", "general-civil")
    .field(
      "pasteTexts",
      JSON.stringify([
        {
          label: "Test statement of claim",
          content:
            "This is a test statement of claim. Plaintiff claims RM50,000 from Defendant for breach of contract.",
        },
      ]),
    );

  expect(
    extractRes.status,
    `extract failed: ${JSON.stringify(extractRes.body)}`,
  ).toBe(200);
  caseId = extractRes.body.caseId as string;
  expect(typeof caseId).toBe("string");
  expect(caseId.length).toBeGreaterThan(0);
});

afterAll(async () => {
  if (codeId) {
    await db
      .delete(litAccessCodes)
      .where(inArray(litAccessCodes.id, [codeId]));
  }
});

describe("POST /api/lit/irac/analyze — matterContext reaches the AI prompt", () => {
  it("passes matterContext into the prompt sent to streamChat", async () => {
    const matterContext =
      "Matter: Ahmad bin Ali v Bala a/l Subramaniam\nSuit: WA-22-999-2024\nCourt: High Court Kuala Lumpur\nType: Breach of contract";

    capturedMessages.calls.length = 0;

    const analyzeRes = await agent
      .post("/api/lit/irac/analyze")
      .send({ caseId, matterContext, provider: "gemini" });

    expect(
      analyzeRes.status,
      `analyze returned unexpected status: ${analyzeRes.text}`,
    ).toBe(200);

    // Exactly one streamChat call should have been made
    expect(capturedMessages.calls).toHaveLength(1);

    const promptText = capturedMessages.calls[0][0].text;

    // The matter context block must appear verbatim in the prompt
    expect(promptText).toContain(
      "=== MATTER CONTEXT (supplied by the solicitor) ===",
    );
    expect(promptText).toContain(matterContext);

    // The TASK section should reference the matter context
    expect(promptText).toContain("incorporate it throughout your analysis");
  });

  it("works without matterContext — backward-compatible", async () => {
    capturedMessages.calls.length = 0;

    const analyzeRes = await agent
      .post("/api/lit/irac/analyze")
      .send({ caseId, provider: "gemini" });

    expect(analyzeRes.status).toBe(200);
    expect(capturedMessages.calls).toHaveLength(1);

    const promptText = capturedMessages.calls[0][0].text;

    // No matter context block when the field is absent
    expect(promptText).not.toContain(
      "=== MATTER CONTEXT (supplied by the solicitor) ===",
    );
    expect(promptText).not.toContain("incorporate it throughout your analysis");

    // Core task directive is still present
    expect(promptText).toContain("TASK — DOCUMENT ANALYSIS");
  });

  it("ignores whitespace-only matterContext", async () => {
    capturedMessages.calls.length = 0;

    const analyzeRes = await agent
      .post("/api/lit/irac/analyze")
      .send({ caseId, matterContext: "   \n  ", provider: "gemini" });

    expect(analyzeRes.status).toBe(200);
    expect(capturedMessages.calls).toHaveLength(1);

    const promptText = capturedMessages.calls[0][0].text;
    expect(promptText).not.toContain(
      "=== MATTER CONTEXT (supplied by the solicitor) ===",
    );
  });
});
