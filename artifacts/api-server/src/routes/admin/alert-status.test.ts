import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

// ── Mocks must be declared before any imports that pull in the mocked modules ──

// Prevent real email / webhook sends during the test.
const sendEmailMock = vi.fn(async (_opts: { to: string; subject: string; html: string }) => true);
const getOwnerEmailMock = vi.fn(async (): Promise<string | null> => "owner@example.test");
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
  // Stub db so alertStatus.ts DB calls are no-ops; getAlertStatus falls back
  // to its in-memory map when execute returns an empty result.
  db: {
    insert: () => ({ values: () => ({ catch: (_fn: unknown) => undefined }) }),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  },
  alertDeliveryAttemptsTable: {},
  subscribersTable: {},
  activityTable: {},
}));

// ── Real imports (after mocks are registered) ──
import express from "express";
import request from "supertest";
import alertStatusRouter from "./alert-status";
import { warnIfTestModeInProduction, _resetTestModeAlertSentForTesting } from "../../stripeClient";
import { _resetAlertStatusForTesting } from "../../lib/alertStatus";

// ── Minimal Express app that mounts only the route under test ──
const app = express();
app.use(express.json());
app.use("/admin", alertStatusRouter);

// ── Suite 1: live-mode boot — must run FIRST so lastAttempts is still empty ──
describe("GET /admin/alert-status on a fresh live-mode boot", () => {
  beforeAll(async () => {
    // Simulate a production server that boots with a live Stripe key.
    // warnIfTestModeInProduction exits early without recording any attempt.
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_live_fake_key_for_alert_status_test";

    await warnIfTestModeInProduction(
      (_msg) => {/* suppress stdout */},
      (_msg) => {/* suppress stderr */},
    );
  });

  afterAll(() => {
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.STRIPE_SECRET_KEY;
    // Reset the mock so Suite 2's waitFor starts from zero calls.
    sendEmailMock.mockClear();
  });

  it("returns 200 with an empty array", async () => {
    const res = await request(app).get("/admin/alert-status");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(0);
  });

  it("never called sendEmail", () => {
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("GET /admin/alert-status when getOwnerEmail returns null (no admin email configured)", () => {
  beforeAll(async () => {
    // Reset in-process dedup flag so warnIfTestModeInProduction runs the full
    // send path again, and clear the status store so the previous suite's
    // "success" entry does not pollute this suite's assertions.
    _resetTestModeAlertSentForTesting();
    _resetAlertStatusForTesting();

    // Clear call counts from the previous suite.
    sendEmailMock.mockClear();
    sendWebhookAlertMock.mockClear();

    // Override getOwnerEmail to return null — simulates no admin email being
    // configured on the Gmail account.
    getOwnerEmailMock.mockResolvedValueOnce(null);

    // Simulate a production server that boots with a test Stripe key.
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_skipped_test";

    // Trigger the alert check.
    await warnIfTestModeInProduction(
      (_msg) => {/* suppress stdout noise in test output */},
      (_msg) => {/* suppress stderr noise in test output */},
    );

    // The fire-and-forget async block calls getOwnerEmail (returns null) and
    // then immediately falls through to the webhook fallback.  Wait until the
    // webhook attempt has been made before asserting.
    await vi.waitFor(() => {
      expect(sendWebhookAlertMock).toHaveBeenCalled();
    }, { timeout: 5_000 });
  });

  afterAll(() => {
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("returns a gmail entry with outcome 'skipped'", async () => {
    const res = await request(app).get("/admin/alert-status");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const gmailEntry = (res.body as Array<{
      channel: string;
      outcome: string;
      attemptedAt: string;
      detail: string;
    }>).find((e) => e.channel === "gmail");

    expect(gmailEntry).toBeDefined();
    expect(gmailEntry!.outcome).toBe("skipped");
  });

  it("never called sendEmail", () => {
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("GET /admin/alert-status when getOwnerEmail returns null (no admin email configured)", () => {
  beforeAll(async () => {
    // Reset in-process dedup flag so warnIfTestModeInProduction runs the full
    // send path again, and clear the status store so the previous suite's
    // "success" entry does not pollute this suite's assertions.
    _resetTestModeAlertSentForTesting();
    _resetAlertStatusForTesting();

    // Clear call counts from the previous suite.
    sendEmailMock.mockClear();
    sendWebhookAlertMock.mockClear();

    // Override getOwnerEmail to return null — simulates no admin email being
    // configured on the Gmail account.
    getOwnerEmailMock.mockResolvedValueOnce(null);

    // Simulate a production server that boots with a test Stripe key.
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_skipped_test";

    // Trigger the alert check.
    await warnIfTestModeInProduction(
      (_msg) => {/* suppress stdout noise in test output */},
      (_msg) => {/* suppress stderr noise in test output */},
    );

    // The fire-and-forget async block calls getOwnerEmail (returns null) and
    // then immediately falls through to the webhook fallback.  Wait until the
    // webhook attempt has been made before asserting.
    await vi.waitFor(() => {
      expect(sendWebhookAlertMock).toHaveBeenCalled();
    }, { timeout: 5_000 });
  });

  afterAll(() => {
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("returns a gmail entry with outcome 'skipped'", async () => {
    const res = await request(app).get("/admin/alert-status");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const gmailEntry = (res.body as Array<{
      channel: string;
      outcome: string;
      attemptedAt: string;
      detail: string;
    }>).find((e) => e.channel === "gmail");

    expect(gmailEntry).toBeDefined();
    expect(gmailEntry!.outcome).toBe("skipped");
    // attemptedAt must be a valid ISO-8601 timestamp.
    expect(() => new Date(gmailEntry!.attemptedAt)).not.toThrow();
    expect(new Date(gmailEntry!.attemptedAt).getTime()).toBeGreaterThan(0);
  });

  it("gmail send was NOT attempted when owner email resolved to null", () => {
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("webhook fallback was attempted after gmail was skipped", () => {
    expect(sendWebhookAlertMock).toHaveBeenCalled();
  });
});

describe("GET /admin/alert-status when sendEmail throws an error mid-send", () => {
  beforeAll(async () => {
    // Reset in-process dedup flag and status store so previous suites' entries
    // don't pollute this suite's assertions.
    _resetTestModeAlertSentForTesting();
    _resetAlertStatusForTesting();

    // Clear call counts from the previous suite.
    sendEmailMock.mockClear();
    sendWebhookAlertMock.mockClear();

    // Make getOwnerEmail return a valid address so the send is attempted.
    getOwnerEmailMock.mockResolvedValueOnce("owner@example.test");

    // Make sendEmail throw — simulates a Gmail connector runtime error.
    sendEmailMock.mockRejectedValueOnce(new Error("Gmail connector timeout"));

    // Simulate a production server that boots with a test Stripe key.
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_gmail_throw_test";

    // Trigger the alert check.
    await warnIfTestModeInProduction(
      (_msg) => {/* suppress stdout noise in test output */},
      (_msg) => {/* suppress stderr noise in test output */},
    );

    // The fire-and-forget async block calls sendEmail (throws), then falls
    // through to the webhook fallback. Wait until the webhook has been
    // attempted before asserting.
    await vi.waitFor(() => {
      expect(sendWebhookAlertMock).toHaveBeenCalled();
    }, { timeout: 5_000 });
  });

  afterAll(() => {
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.STRIPE_SECRET_KEY;
  });

  it("returns a gmail entry with outcome 'failure'", async () => {
    const res = await request(app).get("/admin/alert-status");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const gmailEntry = (res.body as Array<{
      channel: string;
      outcome: string;
      attemptedAt: string;
      detail: string;
    }>).find((e) => e.channel === "gmail");

    expect(gmailEntry).toBeDefined();
    expect(gmailEntry!.outcome).toBe("failure");
    // attemptedAt must be a valid ISO-8601 timestamp.
    expect(() => new Date(gmailEntry!.attemptedAt)).not.toThrow();
    expect(new Date(gmailEntry!.attemptedAt).getTime()).toBeGreaterThan(0);
    // detail must mention the thrown error.
    expect(gmailEntry!.detail).toContain("Gmail connector timeout");
  });

  it("gmail send was attempted with the resolved admin email before throwing", () => {
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.test" }),
    );
  });

  it("webhook fallback was attempted after the gmail failure", () => {
    expect(sendWebhookAlertMock).toHaveBeenCalled();
  });
});

// ── Suite 3: cross-restart cooldown dedup ──────────────────────────────────
//
// Two back-to-back calls to warnIfTestModeInProduction — each with the
// in-memory testModeAlertSent flag reset (simulating a server restart) —
// should result in exactly ONE email send:
//
//   Boot 1: testModeAlertSent starts false → tryClaimAlertSlot() → pool
//           returns a row (slot claimed) → email sent, flag set to true.
//
//   Boot 2: _resetTestModeAlertSentForTesting() resets the flag to false
//           (simulating a new process) → tryClaimAlertSlot() → pool returns
//           no row (slot already held within the cooldown window) → no email.
//
describe("warnIfTestModeInProduction — cross-restart cooldown dedup", () => {
  beforeAll(async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_restart_dedup_test";

    // Start each side-effect counter from zero for this suite.
    _resetTestModeAlertSentForTesting();
    _resetAlertStatusForTesting();
    sendEmailMock.mockClear();
    sendWebhookAlertMock.mockClear();

    // Queue exactly four pool.query responses (consumed in order):
    //   Boot 1 → CREATE TABLE (result ignored), INSERT RETURNING (row → claimed)
    //   Boot 2 → CREATE TABLE (result ignored), INSERT RETURNING (empty → blocked)
    poolQueryMock
      .mockResolvedValueOnce({ rows: [] })                                          // Boot 1 – CREATE TABLE
      .mockResolvedValueOnce({ rows: [{ key: "stripe_test_mode_alert_sent_at" }] }) // Boot 1 – INSERT (claimed)
      .mockResolvedValueOnce({ rows: [] })                                          // Boot 2 – CREATE TABLE
      .mockResolvedValueOnce({ rows: [] });                                         // Boot 2 – INSERT (blocked)

    // ── Boot 1: testModeAlertSent is false (just reset above) ──
    await warnIfTestModeInProduction(
      (_msg) => { /* suppress stdout */ },
      (_msg) => { /* suppress stderr */ },
    );

    // The email send is fire-and-forget; wait until it resolves.
    await vi.waitFor(
      () => { expect(sendEmailMock).toHaveBeenCalledTimes(1); },
      { timeout: 5_000 },
    );

    // ── Boot 2: reset flag to simulate a server restart within the cooldown
    //    window; the DB claim now returns no row so email must NOT fire ──
    _resetTestModeAlertSentForTesting();

    await warnIfTestModeInProduction(
      (_msg) => { /* suppress stdout */ },
      (_msg) => { /* suppress stderr */ },
    );

    // Give any async work (that should NOT happen) time to settle.
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
  });

  afterAll(() => {
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.STRIPE_SECRET_KEY;
    // Restore a default so any subsequent pool.query calls in this process
    // return a sensible value instead of `undefined`.
    poolQueryMock.mockResolvedValue({ rows: [{ key: "stripe_test_mode_alert_sent_at" }] });
  });

  it("sendEmail was called exactly once across both simulated boots", () => {
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("the single email went to the resolved admin address", () => {
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.test" }),
    );
  });

  it("no webhook fallback was attempted (gmail succeeded on the only send)", () => {
    expect(sendWebhookAlertMock).not.toHaveBeenCalled();
  });
});

// ── Suite: stale cooldown — alert re-fires after cooldown window has expired ──
//
// Scenario: a test key was deployed → alert fired → server_kv row was written.
// The operator then swapped in a live key (alert stopped).  Later a rollback
// put a test key back in production, but by now the server_kv entry is older
// than ALERT_COOLDOWN_MS.
//
// The conditional upsert's WHERE clause (server_kv.updated_at < $cutoff)
// evaluates to TRUE for a stale row, so the DB returns a row → slot is claimed
// → alert fires.
//
// This test seeds that stale state by making pool.query return a row (= slot
// claimed), which is exactly what the DB does when the existing row's
// updated_at pre-dates the cutoff.
//
describe("warnIfTestModeInProduction — alert re-fires when cooldown row is sufficiently stale", () => {
  beforeAll(async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_stale_cooldown_refire_test";

    // Start counters from zero for this suite.
    _resetTestModeAlertSentForTesting();
    _resetAlertStatusForTesting();
    sendEmailMock.mockClear();
    sendWebhookAlertMock.mockClear();

    // Simulate a stale server_kv row: the conditional upsert succeeds because
    // the existing row's updated_at is older than ALERT_COOLDOWN_MS.  The DB
    // therefore returns a row, signalling that this process has claimed the slot.
    //
    //   pool.query call 1 → CREATE TABLE IF NOT EXISTS (result ignored)
    //   pool.query call 2 → INSERT … ON CONFLICT … RETURNING key
    //                       → row returned (stale row was overwritten → claimed)
    poolQueryMock
      .mockResolvedValueOnce({ rows: [] })                                          // CREATE TABLE
      .mockResolvedValueOnce({ rows: [{ key: "stripe_test_mode_alert_sent_at" }] }); // INSERT (stale → claimed)

    await warnIfTestModeInProduction(
      (_msg) => { /* suppress stdout */ },
      (_msg) => { /* suppress stderr */ },
    );

    // The fire-and-forget email send must complete before we assert.
    await vi.waitFor(
      () => { expect(sendEmailMock).toHaveBeenCalledTimes(1); },
      { timeout: 5_000 },
    );
  });

  afterAll(() => {
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.STRIPE_SECRET_KEY;
    // Restore a default so any subsequent pool.query calls return a sensible
    // value instead of `undefined`.
    poolQueryMock.mockResolvedValue({ rows: [{ key: "stripe_test_mode_alert_sent_at" }] });
  });

  it("sendEmail is called once — the expired slot allows the alert to re-fire", () => {
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("the re-fired alert email is addressed to the admin", () => {
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "owner@example.test" }),
    );
  });

  it("no webhook fallback is triggered when gmail succeeds", () => {
    expect(sendWebhookAlertMock).not.toHaveBeenCalled();
  });
});
