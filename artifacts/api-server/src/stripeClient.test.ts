/**
 * Integration smoke-tests for warnIfTestModeInProduction (stripeClient.ts).
 *
 * Coverage
 * --------
 * 1. When the server boots in production (REPLIT_DEPLOYMENT set) with a
 *    sk_test_ key, sendEmail is called with the alarm subject.
 * 2. De-duplication: calling warnIfTestModeInProduction a second time in the
 *    same process does NOT trigger a second send.
 * 3. In development (no REPLIT_DEPLOYMENT), the function is silent.
 * 4. With a live key in production, no alert is sent.
 * 5. When getOwnerEmail returns null, sendEmail is still not called.
 * 6. Cross-restart de-duplication: when the DB upsert returns no row (slot
 *    already claimed within the cooldown window), no email is sent even after a
 *    simulated process restart (testModeAlertSent reset via resetModules).
 * 7. Cross-restart sends when the cooldown has expired (upsert returns a row).
 * 8. Concurrent-start dedup: two independent server processes race on the DB
 *    slot; only the one whose atomic upsert returns a row sends the alert.
 *
 * Module isolation
 * ----------------
 * `testModeAlertSent` is a module-level flag inside stripeClient.ts.  We call
 * vi.resetModules() before every test so each import gets a fresh flag
 * (= false).  vi.mock() registrations survive resetModules() in Vitest — the
 * mock factory is re-applied on the fresh import automatically.
 *
 * Shared mock handles
 * -------------------
 * All mock functions are created via vi.hoisted() so the SAME spy object is
 * returned across every module-registry reset.  This allows test 8 to reset
 * modules (simulating a second process restart) and still track sendEmail
 * calls from both module instances on the same spy.
 *
 * Fire-and-forget timing
 * ----------------------
 * The alert email is sent inside an un-awaited async IIFE.  After calling
 * warnIfTestModeInProduction we drain the microtask/macro-task queue with a
 * short setTimeout so the IIFE has time to settle before we assert.
 *
 * Atomic upsert mock shape
 * ------------------------
 * tryClaimAlertSlot() makes exactly two pool.query() calls per invocation:
 *   1. CREATE TABLE IF NOT EXISTS server_kv  (rows ignored)
 *   2. INSERT … ON CONFLICT … RETURNING key  (non-empty → slot claimed)
 * mockClaim(true/false) sets up these two responses in one call.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mock state ─────────────────────────────────────────────────────────
// vi.mock() factories are hoisted before variable declarations, so we use
// vi.hoisted() to create shared mock handles.  Using the SAME spy objects
// across all vi.mock() factory invocations (including after vi.resetModules())
// means call counts are tracked correctly even when modules are re-imported.

const { mockQuery, mockSendEmail, mockGetOwnerEmail, mockSendWebhookAlert } =
  vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockSendEmail: vi.fn().mockResolvedValue(true),
    mockGetOwnerEmail: vi.fn().mockResolvedValue("admin@example.test"),
    mockSendWebhookAlert: vi.fn().mockResolvedValue(false),
  }));

// ── Mocks ─────────────────────────────────────────────────────────────────────
// These are hoisted and re-applied on every fresh module import that follows a
// vi.resetModules() call, but always using the same shared spy objects above.

vi.mock("./lib/mailer", () => ({
  sendEmail: mockSendEmail,
  getOwnerEmail: mockGetOwnerEmail,
  sendWebhookAlert: mockSendWebhookAlert,
}));

vi.mock("@workspace/db", () => ({
  pool: { query: mockQuery },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wait long enough for a fire-and-forget async IIFE to finish. */
const flushAsync = () => new Promise<void>((resolve) => setTimeout(resolve, 100));

/** Save and restore relevant env vars around each test. */
const ENV_KEYS = ["REPLIT_DEPLOYMENT", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;

const ALERT_KV_KEY = "stripe_test_mode_alert_sent_at";

/**
 * Sets up the mockQuery for one tryClaimAlertSlot() call.
 * tryClaimAlertSlot makes exactly two pool.query calls per invocation:
 *   1. CREATE TABLE IF NOT EXISTS (rows ignored — always return empty)
 *   2. INSERT … RETURNING key   (non-empty rows ⟹ slot claimed)
 */
function mockClaim(claimed: boolean) {
  mockQuery
    .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE IF NOT EXISTS
    .mockResolvedValueOnce({
      rows: claimed ? [{ key: ALERT_KV_KEY }] : [],
    }); // INSERT … RETURNING
}

describe("warnIfTestModeInProduction", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Snapshot
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
    // Start clean
    for (const k of ENV_KEYS) delete process.env[k];
    // Clear call tracking on the shared spies, then re-set default implementations.
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockGetOwnerEmail.mockResolvedValue("admin@example.test");
    mockSendWebhookAlert.mockResolvedValue(false);
    // Default: no INSERT rows (slot not claimed). Override via mockClaim().
    mockQuery.mockResolvedValue({ rows: [] });
    // Fresh module registry — resets testModeAlertSent to false
    vi.resetModules();
  });

  afterEach(() => {
    // Restore
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  // ── Test 1: alert fires in production with a test key ─────────────────────

  it("sends one alert email when production server has a sk_test_ key", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task401_smoke";

    // Fresh DB: upsert claims the slot
    mockClaim(true);

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    // Banner was logged
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("STRIPE IS IN TEST MODE"),
    );

    // Email was sent exactly once
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.test",
        subject: "🚨 CRITICAL: Stripe is in TEST mode on production",
      }),
    );

    // Admin email was looked up
    expect(mockGetOwnerEmail).toHaveBeenCalledOnce();
  });

  // ── Test 2: de-duplication (within same process) ──────────────────────────

  it("de-duplicates: a second call in the same process sends no further email", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task401_dedup";

    // Only the first call hits the DB; the second is short-circuited by
    // the in-memory testModeAlertSent flag.
    mockClaim(true);

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    // First call
    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    // Second call — testModeAlertSent is now true inside the module
    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    // Only one send, regardless of how many times we called warn
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  // ── Test 3: silent in development ─────────────────────────────────────────

  it("does nothing when REPLIT_DEPLOYMENT is not set (development mode)", async () => {
    // No REPLIT_DEPLOYMENT
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task401_dev";

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    // No DB calls either — returns before reaching tryClaimAlertSlot
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // ── Test 4: live key in production is fine ────────────────────────────────

  it("does not alert and logs 'live ✓' when production uses a live key", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_live_fakekey_task401_live";

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("Stripe mode: live ✓");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  // ── Test 5: no admin email → no send ─────────────────────────────────────

  it("skips sendEmail and logs a warning when getOwnerEmail returns null", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task401_noemail";

    // Slot is claimed (past the DB gate) but no admin email available
    mockClaim(true);
    mockGetOwnerEmail.mockResolvedValueOnce(null);

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("Could not resolve admin email"),
    );
  });

  // ── Test 6: cross-restart de-duplication (cooldown active) ────────────────

  it("suppresses the alert when the DB upsert returns no row (slot taken within cooldown)", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task405_xrestart";

    // Simulate: another process already claimed the slot within the cooldown
    // window — the upsert WHERE clause is false, RETURNING returns nothing.
    mockClaim(false);

    // vi.resetModules() in beforeEach already gives us a fresh testModeAlertSent = false,
    // simulating a process restart.
    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    // The banner is still logged (visible warning even when suppressed)
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("STRIPE IS IN TEST MODE"),
    );

    // But NO email was sent — cooldown is active
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  // ── Test 7: cross-restart sends when cooldown has expired ─────────────────

  it("sends the alert when the DB record is stale (upsert WHERE clause satisfied, row returned)", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task405_expired";

    // Simulate: existing record is older than ALERT_COOLDOWN_MS — the upsert
    // UPDATE fires and RETURNING returns the row (slot reclaimed).
    mockClaim(true);

    // Fresh module import = simulated process restart (testModeAlertSent reset)
    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    // Alert should fire since cooldown has expired
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "🚨 CRITICAL: Stripe is in TEST mode on production",
      }),
    );
  });

  // ── Test 8: concurrent-start de-duplication ───────────────────────────────

  it("sends exactly one alert when two server processes race concurrently on the DB slot", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task405_concurrent";

    // Process A (first fresh import = testModeAlertSent: false)
    // Its tryClaimAlertSlot wins the race (upsert returns a row).
    mockClaim(true);

    const { warnIfTestModeInProduction: warnA } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnA(log, errorLog);
    await flushAsync();

    // One email sent by process A
    expect(mockSendEmail).toHaveBeenCalledOnce();

    // Process B: simulate a second server restart by resetting the module
    // registry so the new import gets a fresh testModeAlertSent = false.
    // The DB slot was already claimed by A within the cooldown window, so
    // B's upsert returns no row (WHERE clause is false) → suppressed.
    vi.resetModules();
    mockClaim(false);

    const { warnIfTestModeInProduction: warnB } = await import("./stripeClient");

    await warnB(log, errorLog);
    await flushAsync();

    // Still exactly one email — process B was suppressed by the DB claim
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });
});
