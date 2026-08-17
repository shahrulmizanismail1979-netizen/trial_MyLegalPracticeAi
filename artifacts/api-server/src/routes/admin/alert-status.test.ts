import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// ── Mocks must be declared before any imports that pull in the mocked modules ──

// Prevent real email / webhook sends during the test.
const sendEmailMock = vi.fn(async (_opts: { to: string; subject: string; html: string }) => true);
const getOwnerEmailMock = vi.fn(async () => "owner@example.test");
const sendWebhookAlertMock = vi.fn(async (_opts: unknown) => false);

vi.mock("../../lib/mailer", () => ({
  sendEmail: (opts: { to: string; subject: string; html: string }) => sendEmailMock(opts),
  getOwnerEmail: () => getOwnerEmailMock(),
  sendWebhookAlert: (opts: unknown) => sendWebhookAlertMock(opts),
}));

// Make tryClaimAlertSlot succeed by returning a row from the conditional upsert.
// pool.query is called twice:
//   1. CREATE TABLE IF NOT EXISTS server_kv  → result unused
//   2. INSERT … ON CONFLICT … RETURNING key  → needs a row to signal "claimed"
const poolQueryMock = vi.fn().mockResolvedValue({ rows: [{ key: "stripe_test_mode_alert_sent_at" }] });
vi.mock("@workspace/db", () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
  // Provide stubs for anything else the module re-exports that other imports may need.
  db: {},
  subscribersTable: {},
  activityTable: {},
}));

// ── Real imports (after mocks are registered) ──
import express from "express";
import request from "supertest";
import alertStatusRouter from "./alert-status";
import { warnIfTestModeInProduction } from "../../stripeClient";

// ── Minimal Express app that mounts only the route under test ──
const app = express();
app.use(express.json());
app.use("/admin", alertStatusRouter);

describe("GET /admin/alert-status after warnIfTestModeInProduction (test-mode boot)", () => {
  beforeAll(async () => {
    // Simulate a production server that boots with a test Stripe key.
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_alert_status_test";

    // Trigger the alert check.
    await warnIfTestModeInProduction(
      (_msg) => {/* suppress stdout noise in test output */},
      (_msg) => {/* suppress stderr noise in test output */},
    );

    // warnIfTestModeInProduction fires the email send as fire-and-forget
    // (no await in the implementation). Wait until sendEmail has been called
    // before proceeding to the assertion step.
    await vi.waitFor(() => {
      expect(sendEmailMock).toHaveBeenCalled();
    }, { timeout: 5_000 });
  });

  afterAll(() => {
    // Restore env so other tests (if any share the process) are unaffected.
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("returns an array with at least one gmail entry", async () => {
    const res = await request(app).get("/admin/alert-status");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("gmail entry has the correct shape", async () => {
    const res = await request(app).get("/admin/alert-status");
    const gmailEntry = (res.body as Array<{
      channel: string;
      outcome: string;
      attemptedAt: string | null;
      detail: string;
    }>).find((e) => e.channel === "gmail");

    expect(gmailEntry).toBeDefined();
    expect(gmailEntry!.outcome).toBe("success");
    expect(gmailEntry!.attemptedAt).not.toBeNull();
    // attemptedAt must be a valid ISO-8601 timestamp.
    expect(() => new Date(gmailEntry!.attemptedAt)).not.toThrow();
    expect(new Date(gmailEntry!.attemptedAt).getTime()).toBeGreaterThan(0);
  });

  it("the gmail send was attempted with the resolved admin email", () => {
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.test" }),
    );
  });

  it("webhook fallback was NOT attempted when gmail succeeded", () => {
    expect(sendWebhookAlertMock).not.toHaveBeenCalled();
  });
});
