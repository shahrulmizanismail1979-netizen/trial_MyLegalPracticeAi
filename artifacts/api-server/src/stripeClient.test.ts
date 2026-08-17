/**
 * Tests for warnIfTestModeInProduction (stripeClient.ts).
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
 * 9. DB error fallback: when pool.query throws (e.g. server_kv was wiped by a
 *    migration), tryClaimAlertSlot fails open → alert fires exactly once.
 *    The in-memory testModeAlertSent flag then suppresses any further calls
 *    within the same process, so the blast is bounded to one per restart.
 *
 * Webhook fallback suite (separate describe block below):
 * 9. The webhook fallback fires when Gmail returns false.
 * 10. The webhook fallback fires when Gmail throws.
 * 11. The webhook fallback does NOT fire when Gmail succeeds.
 * 12. The webhook fallback does NOT fire when not in production.
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
  // alertStatus.ts imports these; provide no-op stubs so the module loads.
  db: {
    insert: () => ({ values: () => ({ catch: () => {} }) }),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  },
  alertDeliveryAttemptsTable: {},
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

// ── Suite 1: main alert + cooldown path ──────────────────────────────────────

describe("warnIfTestModeInProduction", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {};
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

  // ── Test 2: de-duplication within process ─────────────────────────────────

  it("de-duplicates: a second call in the same process sends no further email", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task401_dedup";

    // First call claims the slot
    mockClaim(true);

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    // First call
    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    // Second call — testModeAlertSent is now true inside the module; no DB hit
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
  });

  // ── Test 5: no admin email → no send ─────────────────────────────────────

  it("skips sendEmail and logs a warning when getOwnerEmail returns null", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task401_noemail";

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

  // ── Test 6: cross-restart suppression while cooldown is active ────────────

  it("suppresses the alert on restart when the DB slot is still within the cooldown window", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task405_suppressed";

    // Simulate: existing record is within the cooldown window — the upsert
    // WHERE clause is false, so no row is returned (slot NOT reclaimed).
    mockClaim(false);

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    // Banner still logged (visible warning regardless)
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("STRIPE IS IN TEST MODE"),
    );

    // No email — cooldown is active
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

  // ── Test 9: DB error falls back to sending once (server_kv wiped) ─────────

  it("sends exactly once when pool.query throws (server_kv missing after migration), then in-memory flag suppresses further calls", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task407_dberror";

    // Simulate server_kv being wiped by a migration — every query throws.
    mockQuery.mockRejectedValue(new Error('relation "server_kv" does not exist'));

    // Fresh module import = simulated process restart (testModeAlertSent: false)
    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    // First call: DB error → fail open → alert fires once
    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("STRIPE IS IN TEST MODE"),
    );
    expect(mockSendEmail).toHaveBeenCalledOnce();

    // Second call in the same process: testModeAlertSent is now true →
    // short-circuited before even reaching tryClaimAlertSlot.
    // mockQuery still rejects, but it should never be called.
    mockQuery.mockClear();
    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    // No further emails and no DB calls — the in-memory flag suppressed spam.
    expect(mockSendEmail).toHaveBeenCalledOnce();
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

// ── Suite 2: ALERT_COOLDOWN_MS IIFE ──────────────────────────────────────────
//
// ALERT_COOLDOWN_MS is evaluated once when the module is first imported.
// To test it with different env var values we:
//  1. Set process.env.STRIPE_ALERT_COOLDOWN_MINUTES before each test.
//  2. Call vi.resetModules() so the next import gets a fresh module.
//  3. Dynamically import stripeClient and inspect the exported constant.
//
// console.warn is spied on to verify invalid-input warnings.

describe("ALERT_COOLDOWN_MS — env var parsing", () => {
  const COOLDOWN_KEY = "STRIPE_ALERT_COOLDOWN_MINUTES";
  let savedValue: string | undefined;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    savedValue = process.env[COOLDOWN_KEY];
    delete process.env[COOLDOWN_KEY];
    vi.clearAllMocks();
    vi.resetModules();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    if (savedValue === undefined) delete process.env[COOLDOWN_KEY];
    else process.env[COOLDOWN_KEY] = savedValue;
    warnSpy.mockRestore();
  });

  // ── Test A: valid positive integer ────────────────────────────────────────

  it("returns the correct ms for a valid positive integer (30 → 1 800 000 ms)", async () => {
    process.env[COOLDOWN_KEY] = "30";

    const { ALERT_COOLDOWN_MS } = await import("./stripeClient");

    expect(ALERT_COOLDOWN_MS).toBe(30 * 60 * 1_000);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ── Test B: valid zero ────────────────────────────────────────────────────

  it("returns 0 ms for the value '0' (zero-minute cooldown is valid)", async () => {
    process.env[COOLDOWN_KEY] = "0";

    const { ALERT_COOLDOWN_MS } = await import("./stripeClient");

    expect(ALERT_COOLDOWN_MS).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ── Test C: non-numeric string → fallback + warn ──────────────────────────

  it("falls back to 60-min default and emits console.warn for a non-numeric string", async () => {
    process.env[COOLDOWN_KEY] = "abc";

    const { ALERT_COOLDOWN_MS } = await import("./stripeClient");

    expect(ALERT_COOLDOWN_MS).toBe(60 * 60 * 1_000);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('STRIPE_ALERT_COOLDOWN_MINUTES="abc" is invalid'),
    );
  });

  // ── Test D: negative number → fallback + warn ─────────────────────────────

  it("falls back to 60-min default and emits console.warn for a negative number", async () => {
    process.env[COOLDOWN_KEY] = "-5";

    const { ALERT_COOLDOWN_MS } = await import("./stripeClient");

    expect(ALERT_COOLDOWN_MS).toBe(60 * 60 * 1_000);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('STRIPE_ALERT_COOLDOWN_MINUTES="-5" is invalid'),
    );
  });

  // ── Test E: env var absent → default 60 min, no warn ─────────────────────

  it("defaults to 60-min (3 600 000 ms) when STRIPE_ALERT_COOLDOWN_MINUTES is not set", async () => {
    // env var already deleted in beforeEach
    const { ALERT_COOLDOWN_MS } = await import("./stripeClient");

    expect(ALERT_COOLDOWN_MS).toBe(60 * 60 * 1_000);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ── Test F: tryClaimAlertSlot uses the module-level ALERT_COOLDOWN_MS ─────
  //
  // When a custom cooldown is set (e.g. 1 minute), the cutoff timestamp passed
  // to the DB upsert must reflect that value rather than the 60-min default.
  // We verify this indirectly: after warnIfTestModeInProduction runs, the DB
  // query is called with a cutoff close to (now - 1 min).

  it("tryClaimAlertSlot uses the runtime ALERT_COOLDOWN_MS (1-min cooldown test)", async () => {
    process.env[COOLDOWN_KEY] = "1"; // 1 minute = 60 000 ms
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task411_cooldown";

    // mockQuery is already set to return empty rows (slot not claimed is fine —
    // we only care that the correct cutoff was passed).
    // Slot claimed so the alert fires:
    mockClaim(true);

    const before = Date.now();
    const { warnIfTestModeInProduction } = await import("./stripeClient");
    await warnIfTestModeInProduction(vi.fn(), vi.fn());
    await new Promise((r) => setTimeout(r, 200));
    const after = Date.now();

    // The second pool.query call carries the cutoff as $2.
    // Find the INSERT … RETURNING call (it has two params: key and cutoff).
    const insertCall = mockQuery.mock.calls.find(
      (args: unknown[]) =>
        typeof args[0] === "string" && (args[0] as string).includes("RETURNING"),
    );
    expect(insertCall).toBeDefined();

    const cutoffStr = (insertCall as [string, [string, string]])[1][1] as string;
    const cutoffMs = new Date(cutoffStr).getTime();

    // The cutoff should be approximately (now - 1 min), i.e. within 5 s of
    // (before - 60_000) and (after - 60_000).
    expect(cutoffMs).toBeGreaterThanOrEqual(before - 60_000 - 5_000);
    expect(cutoffMs).toBeLessThanOrEqual(after - 60_000 + 5_000);

    // Clean up the extra env vars set for this test.
    delete process.env.REPLIT_DEPLOYMENT;
    delete process.env.STRIPE_SECRET_KEY;
  });
});

// ── Suite 3: webhook fallback path ────────────────────────────────────────────

describe("warnIfTestModeInProduction — webhook fallback", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      REPLIT_DEPLOYMENT: process.env.REPLIT_DEPLOYMENT,
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    };
    vi.clearAllMocks();
    mockSendEmail.mockResolvedValue(true);
    mockGetOwnerEmail.mockResolvedValue("admin@example.test");
    mockSendWebhookAlert.mockResolvedValue(true);
    mockQuery.mockResolvedValue({ rows: [] });
    vi.resetModules();
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  // ── Test 9: webhook fires when Gmail returns false ────────────────────────

  it("calls sendWebhookAlert with the correct payload when Gmail returns false", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_vitest";

    mockClaim(true);
    mockSendEmail.mockResolvedValue(false);

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    await warnIfTestModeInProduction(vi.fn(), vi.fn());

    await vi.waitFor(
      () => {
        expect(mockSendWebhookAlert).toHaveBeenCalledTimes(1);
        const [payload] = mockSendWebhookAlert.mock.calls[0] as [
          { subject: string; html: string; detectedAt: string; server: string },
        ];
        expect(payload.subject).toContain("TEST mode");
        expect(typeof payload.detectedAt).toBe("string");
        expect(typeof payload.server).toBe("string");
      },
      { timeout: 3000 },
    );
  });

  // ── Test 10: webhook fires when Gmail throws ──────────────────────────────

  it("calls sendWebhookAlert with the correct payload when Gmail throws", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_vitest";

    mockClaim(true);
    mockSendEmail.mockRejectedValue(new Error("Gmail connector unavailable"));

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    await warnIfTestModeInProduction(vi.fn(), vi.fn());

    await vi.waitFor(
      () => {
        expect(mockSendWebhookAlert).toHaveBeenCalledTimes(1);
        const [payload] = mockSendWebhookAlert.mock.calls[0] as [
          { subject: string; html: string; detectedAt: string; server: string },
        ];
        expect(payload.subject).toContain("TEST mode");
        expect(typeof payload.detectedAt).toBe("string");
        expect(typeof payload.server).toBe("string");
      },
      { timeout: 3000 },
    );
  });

  // ── Test 11: webhook does NOT fire when Gmail succeeds ────────────────────

  it("does NOT call sendWebhookAlert when Gmail succeeds", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_vitest";

    mockClaim(true);
    mockSendEmail.mockResolvedValue(true);

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    await warnIfTestModeInProduction(vi.fn(), vi.fn());

    await new Promise((r) => setTimeout(r, 200));

    expect(mockSendWebhookAlert).not.toHaveBeenCalled();
  });

  // ── Test 12: webhook does NOT fire outside production ─────────────────────

  it("does NOT call sendWebhookAlert when NOT in production (REPLIT_DEPLOYMENT unset)", async () => {
    delete process.env.REPLIT_DEPLOYMENT;
    process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_vitest";

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    await warnIfTestModeInProduction(vi.fn(), vi.fn());
    await new Promise((r) => setTimeout(r, 200));

    expect(mockSendWebhookAlert).not.toHaveBeenCalled();
  });
});

// ── Suite 3: purgeTestModeStripeData ─────────────────────────────────────────

import {
  purgeTestModeStripeData,
  STRIPE_DATA_TABLES,
  type PgClientLike,
  type PgPoolLike,
} from "./stripeClient";

/**
 * Build a mock PgPoolLike whose single client returns the supplied rowCounts
 * for each successive query call.
 *
 * Call order inside purgeTestModeStripeData:
 *   [0]  BEGIN
 *   [1…N] DELETE from each STRIPE_DATA_TABLES entry  (N = 25)
 *   If totalDeleted > 0:
 *     [N+1]  DELETE from stripe._sync_status
 *     [N+2]  COMMIT
 *   Else:
 *     [N+1]  ROLLBACK
 *
 * `rowCounts` only needs to cover the DELETE calls; BEGIN/COMMIT/ROLLBACK
 * positions are inserted automatically at the correct indices.
 */
function makePool(
  /** rowCount for each DELETE from STRIPE_DATA_TABLES (index = table order) */
  tableRowCounts: number[],
  /** rowCount for the _sync_status DELETE (only called when totalDeleted > 0) */
  syncRowCount = 0,
): {
  pool: PgPoolLike;
  clientQuery: ReturnType<typeof vi.fn>;
  clientRelease: ReturnType<typeof vi.fn>;
} {
  const clientQuery = vi.fn();
  const clientRelease = vi.fn();

  // Begin always succeeds
  clientQuery.mockResolvedValueOnce({ rowCount: null }); // BEGIN

  // Table DELETEs
  for (let i = 0; i < STRIPE_DATA_TABLES.length; i++) {
    clientQuery.mockResolvedValueOnce({ rowCount: tableRowCounts[i] ?? 0 });
  }

  const totalDeleted = tableRowCounts.reduce((s, n) => s + (n ?? 0), 0);
  if (totalDeleted > 0) {
    clientQuery.mockResolvedValueOnce({ rowCount: syncRowCount }); // _sync_status DELETE
    clientQuery.mockResolvedValueOnce({ rowCount: null }); // COMMIT
  } else {
    clientQuery.mockResolvedValueOnce({ rowCount: null }); // ROLLBACK
  }

  const mockClient: PgClientLike = {
    query: clientQuery,
    release: clientRelease,
  };

  const pool: PgPoolLike = {
    connect: vi.fn().mockResolvedValue(mockClient),
  };

  return { pool, clientQuery, clientRelease };
}

describe("purgeTestModeStripeData", () => {
  // ── no-op when nothing to delete ─────────────────────────────────────────

  it("is a no-op and calls ROLLBACK when no test-mode rows exist in any table", async () => {
    const allZero = new Array<number>(STRIPE_DATA_TABLES.length).fill(0);
    const { pool, clientQuery, clientRelease } = makePool(allZero);
    const logs: string[] = [];

    await purgeTestModeStripeData(pool, (m) => logs.push(m));

    // BEGIN + 25 DELETEs + ROLLBACK
    expect(clientQuery).toHaveBeenCalledTimes(STRIPE_DATA_TABLES.length + 2);

    const calls = clientQuery.mock.calls.map((c) => (c[0] as string).trim());
    expect(calls[0]).toBe("BEGIN");
    expect(calls[calls.length - 1]).toBe("ROLLBACK");

    // _sync_status must NOT be touched
    expect(calls.some((s) => s.includes("_sync_status"))).toBe(false);

    expect(logs.some((l) => l.includes("skipping"))).toBe(true);
    expect(clientRelease).toHaveBeenCalledOnce();
  });

  // ── customers only ────────────────────────────────────────────────────────

  it("purges and commits when only customers have test-mode rows", async () => {
    const counts = new Array<number>(STRIPE_DATA_TABLES.length).fill(0);
    const custIdx = STRIPE_DATA_TABLES.indexOf("customers");
    counts[custIdx] = 22;

    const { pool, clientQuery, clientRelease } = makePool(counts, 3);
    const logs: string[] = [];

    await purgeTestModeStripeData(pool, (m) => logs.push(m));

    const calls = clientQuery.mock.calls.map((c) => (c[0] as string).trim());
    expect(calls[0]).toBe("BEGIN");
    expect(calls[calls.length - 1]).toBe("COMMIT");
    expect(calls.some((s) => s.includes("_sync_status"))).toBe(true);

    expect(logs.some((l) => l.includes("22") && l.includes("customers"))).toBe(true);
    expect(logs.some((l) => l.includes("22 test-mode row(s) removed atomically"))).toBe(true);
    expect(clientRelease).toHaveBeenCalledOnce();
  });

  // ── non-customer table only ───────────────────────────────────────────────

  it("purges and commits when only a non-customer table (products) has test-mode rows", async () => {
    const counts = new Array<number>(STRIPE_DATA_TABLES.length).fill(0);
    const prodIdx = STRIPE_DATA_TABLES.indexOf("products");
    counts[prodIdx] = 12;

    const { pool, clientQuery } = makePool(counts, 1);
    const logs: string[] = [];

    await purgeTestModeStripeData(pool, (m) => logs.push(m));

    const calls = clientQuery.mock.calls.map((c) => (c[0] as string).trim());
    expect(calls[0]).toBe("BEGIN");
    expect(calls[calls.length - 1]).toBe("COMMIT");
    expect(calls.some((s) => s.includes("_sync_status"))).toBe(true);
    expect(logs.some((l) => l.includes("12") && l.includes("products"))).toBe(true);
    // No customer log line
    expect(logs.some((l) => l.includes("customers"))).toBe(false);
  });

  // ── mixed: multiple tables ────────────────────────────────────────────────

  it("deletes across multiple tables and reports the correct total", async () => {
    const counts = new Array<number>(STRIPE_DATA_TABLES.length).fill(0);
    counts[STRIPE_DATA_TABLES.indexOf("customers")] = 22;
    counts[STRIPE_DATA_TABLES.indexOf("subscriptions")] = 9;
    counts[STRIPE_DATA_TABLES.indexOf("invoices")] = 18;

    const { pool, clientQuery } = makePool(counts, 2);
    const logs: string[] = [];

    await purgeTestModeStripeData(pool, (m) => logs.push(m));

    const calls = clientQuery.mock.calls.map((c) => (c[0] as string).trim());
    expect(calls[0]).toBe("BEGIN");
    expect(calls[calls.length - 1]).toBe("COMMIT");

    // Total = 22 + 9 + 18 = 49
    expect(logs.some((l) => l.includes("49 test-mode row(s) removed atomically"))).toBe(true);
  });

  // ── error handling: ROLLBACK on failure ───────────────────────────────────

  it("calls ROLLBACK and re-throws when a DELETE query throws", async () => {
    const clientQuery = vi.fn();
    const clientRelease = vi.fn();

    clientQuery.mockResolvedValueOnce({ rowCount: null }); // BEGIN
    clientQuery.mockRejectedValueOnce(new Error("DB error during DELETE")); // first table DELETE
    clientQuery.mockResolvedValueOnce({ rowCount: null }); // ROLLBACK

    const pool: PgPoolLike = {
      connect: vi.fn().mockResolvedValue({ query: clientQuery, release: clientRelease }),
    };

    await expect(purgeTestModeStripeData(pool)).rejects.toThrow("DB error during DELETE");

    const calls = clientQuery.mock.calls.map((c) => (c[0] as string).trim());
    expect(calls[calls.length - 1]).toBe("ROLLBACK");
    expect(clientRelease).toHaveBeenCalledOnce();
  });
});
