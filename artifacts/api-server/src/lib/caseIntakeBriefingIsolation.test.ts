/**
 * Integration test: intake briefing isolation from AI Insights refresh.
 *
 * Invariant: calling GET /:id/ai-insights?refresh=1 must NEVER overwrite the
 * intake briefing stored in `case_intake_briefing`.  The two features write to
 * completely separate tables (case_ai_insights vs case_intake_briefing) and
 * this test verifies that isolation plus the idempotency of triggerIntakeBriefing.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";

// ── Mocks ────────────────────────────────────────────────────────────────────

// Clerk is used by the admin dashboard; stub it so tests run without credentials.
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

// Object storage is imported transitively via several routers.
vi.mock("../lib/objectStorage", () => {
  class FakeObjectStorageService {
    async getObjectEntityUploadURL(): Promise<string> {
      return `https://storage.example.com/bucket/.private/uploads/${randomUUID()}?sig=x`;
    }
    normalizeObjectEntityPath(rawPath: string): string {
      const m = rawPath.match(/uploads\/([0-9a-f-]+)/);
      return `/objects/uploads/${m ? m[1] : rawPath}`;
    }
    async getObjectEntityFile(): Promise<never> {
      const err = new Error("Object not found") as Error & { name: string };
      err.name = "ObjectNotFoundError";
      throw err;
    }
  }
  return {
    ObjectStorageService: FakeObjectStorageService,
    ObjectNotFoundError: class extends Error {},
  };
});

// Stub Gemini so no real AI calls are made.  Each call returns deterministic
// JSON that is valid for whichever prompt type asks for it.
const FAKE_INSIGHTS_JSON = JSON.stringify({
  nextSteps: [{ action: "Review matter urgently", priority: "high" }],
  caseSummary: "Mocked AI case summary for isolation test.",
  riskAssessment: { rating: "Low", keyStrengths: ["Strong facts"], keyWeaknesses: [] },
});

const FAKE_BRIEFING_JSON = JSON.stringify({
  parties: { client: "Alice Lim", opponent: "Bob Tan", counsel: null, others: [] },
  keyFacts: ["Client was injured at work on 1 Jan 2024"],
  legalIssues: ["Negligence", "Breach of duty of care"],
  initialActions: [{ action: "File writ of summons", priority: "high" }],
});

vi.mock("@workspace/integrations-gemini-ai", () => ({
  ai: {
    models: {
      generateContent: vi.fn().mockResolvedValue({ text: FAKE_INSIGHTS_JSON }),
    },
  },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

const { default: app } = await import("../app");
const { db, pool } = await import("@workspace/db");
const { accessCodesTable, accessCodeUsageTable, accMatters } = await import(
  "@workspace/db/schema"
);
const { ensureAccMatterTables } = await import("../accident/matters");
const { ensureCaseIntelligenceTables } = await import("./ensureCaseIntelligenceTables");
const { generateAndSaveIntakeBriefing, getIntakeBriefing } = await import(
  "./caseIntakeBriefing"
);
const { ai } = await import("@workspace/integrations-gemini-ai");

// ── Test state ───────────────────────────────────────────────────────────────

const RUN_ID = `intake-iso-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const ACCESS_CODE = `INT-${RUN_ID}`.slice(0, 20).toUpperCase();

const createdCodeIds: number[] = [];
const createdMatterIds: number[] = [];

async function loginWith(code: string): Promise<string> {
  const [row] = await db
    .insert(accessCodesTable)
    .values({ code, label: `IntakeTest ${RUN_ID}`, maxUsers: 5 })
    .returning();
  createdCodeIds.push(row.id);
  const res = await request(app)
    .post("/api/accident/auth/verify-code")
    .send({ code });
  expect(res.status).toBe(200);
  const cookie = res.headers["set-cookie"]?.[0]?.split(";")[0];
  expect(cookie).toBeTruthy();
  return cookie as string;
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await ensureAccMatterTables();
  await ensureCaseIntelligenceTables();
});

afterAll(async () => {
  if (createdMatterIds.length) {
    await pool.query(`DELETE FROM case_intake_briefing WHERE portal = 'acc' AND matter_id = ANY($1)`, [
      createdMatterIds,
    ]);
    await pool.query(`DELETE FROM case_ai_insights WHERE portal = 'acc' AND matter_id = ANY($1)`, [
      createdMatterIds,
    ]);
    await pool.query(`DELETE FROM case_stage_history WHERE portal = 'acc' AND matter_id = ANY($1)`, [
      createdMatterIds,
    ]);
    await pool.query(`DELETE FROM acc_matter_deadlines WHERE matter_id = ANY($1)`, [
      createdMatterIds,
    ]);
    await db.delete(accMatters).where(inArray(accMatters.id, createdMatterIds));
  }
  if (createdCodeIds.length) {
    await db
      .delete(accessCodeUsageTable)
      .where(inArray(accessCodeUsageTable.accessCodeId, createdCodeIds));
    await db.delete(accessCodesTable).where(inArray(accessCodesTable.id, createdCodeIds));
  }
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("intake briefing isolation from AI Insights refresh", () => {
  let cookie = "";
  let matterId = 0;

  beforeAll(async () => {
    cookie = await loginWith(ACCESS_CODE);

    // Create a matter.
    const res = await request(app)
      .post("/api/accident/matters")
      .set("Cookie", cookie)
      .send({
        title: `Isolation test matter ${RUN_ID}`,
        matterType: "personal_injury",
        clientName: "Alice Lim",
        notes: "Client slipped on wet floor at employer premises.",
      });
    expect(res.status).toBe(201);
    matterId = res.body.id as number;
    createdMatterIds.push(matterId);

    // Simulate the intake briefing that triggerIntakeBriefing fires after matter
    // creation.  We mock the Gemini response to return the briefing JSON for this
    // call only, then restore to the insights JSON for subsequent calls.
    (ai.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      text: FAKE_BRIEFING_JSON,
    });

    await generateAndSaveIntakeBriefing("acc", matterId, {
      title: `Isolation test matter ${RUN_ID}`,
      matterType: "personal_injury",
      clientName: "Alice Lim",
      notes: "Client slipped on wet floor at employer premises.",
    });
  });

  it("stores the intake briefing and it is retrievable via GET /intake-briefing", async () => {
    const res = await request(app)
      .get(`/api/accident/matters/${matterId}/intake-briefing`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.parties.client).toBe("Alice Lim");
    expect(res.body.keyFacts).toHaveLength(1);
    expect(res.body.legalIssues).toContain("Negligence");
    expect(typeof res.body.generatedAt).toBe("string");
  });

  it("refreshing AI Insights does NOT overwrite the intake briefing", async () => {
    // Capture the original briefing timestamp before refresh.
    const before = await getIntakeBriefing("acc", matterId);
    expect(before).not.toBeNull();
    const originalGeneratedAt = before!.generatedAt;

    // Force-refresh AI Insights — writes to case_ai_insights, not case_intake_briefing.
    const insightsRes = await request(app)
      .get(`/api/accident/matters/${matterId}/ai-insights?refresh=1`)
      .set("Cookie", cookie);
    expect(insightsRes.status).toBe(200);
    expect(insightsRes.body.caseSummary).toMatch(/Mocked AI case summary/);
    expect(insightsRes.body.nextSteps).toHaveLength(1);

    // Intake briefing must still be there, unchanged.
    const briefingRes = await request(app)
      .get(`/api/accident/matters/${matterId}/intake-briefing`)
      .set("Cookie", cookie);
    expect(briefingRes.status).toBe(200);
    expect(briefingRes.body.parties.client).toBe("Alice Lim");
    expect(briefingRes.body.generatedAt).toBe(originalGeneratedAt);

    // Both tables must have independent rows for this matter.
    const { rows: insightRows } = await pool.query(
      `SELECT id FROM case_ai_insights WHERE portal = 'acc' AND matter_id = $1`,
      [matterId],
    );
    const { rows: briefingRows } = await pool.query(
      `SELECT id FROM case_intake_briefing WHERE portal = 'acc' AND matter_id = $1`,
      [matterId],
    );
    // Each table has exactly one row for this matter — they are fully independent.
    expect(insightRows).toHaveLength(1);
    expect(briefingRows).toHaveLength(1);
  });

  it("a second call to generateAndSaveIntakeBriefing is idempotent (ON CONFLICT DO NOTHING)", async () => {
    // Capture the existing briefing.
    const before = await getIntakeBriefing("acc", matterId);
    expect(before).not.toBeNull();
    const originalGeneratedAt = before!.generatedAt;

    // A second invocation (e.g. if the matter creation hook fires twice) must
    // silently no-op — ON CONFLICT DO NOTHING means the original row is kept.
    // Provide different content to confirm it is NOT overwritten.
    (ai.models.generateContent as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      text: JSON.stringify({
        parties: { client: "OVERWRITE ATTEMPT", opponent: null, counsel: null, others: [] },
        keyFacts: ["should not appear"],
        legalIssues: ["should not appear"],
        initialActions: [],
      }),
    });

    await generateAndSaveIntakeBriefing("acc", matterId, {
      title: "second call",
      clientName: "OVERWRITE ATTEMPT",
    });

    // The original snapshot is still there.
    const after = await getIntakeBriefing("acc", matterId);
    expect(after).not.toBeNull();
    expect(after!.parties.client).toBe("Alice Lim");
    expect(after!.generatedAt).toBe(originalGeneratedAt);

    // Only one row in the table for this matter.
    const { rows } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM case_intake_briefing WHERE portal = 'acc' AND matter_id = $1`,
      [matterId],
    );
    expect(Number(rows[0].cnt)).toBe(1);
  });

  it("a second generateAndSaveIntakeBriefing call skips Gemini if briefing already exists", async () => {
    const generateSpy = ai.models.generateContent as ReturnType<typeof vi.fn>;
    const callCountBefore = generateSpy.mock.calls.length;

    await generateAndSaveIntakeBriefing("acc", matterId, {
      title: "third idempotency check",
    });

    // generateContent must NOT have been called again — the early-exit guard
    // (`if (existing) return`) prevents a redundant AI call.
    expect(generateSpy.mock.calls.length).toBe(callCountBefore);
  });
});
