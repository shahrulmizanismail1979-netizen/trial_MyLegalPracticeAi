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
 *
 * Module isolation
 * ----------------
 * `testModeAlertSent` is a module-level flag inside stripeClient.ts.  We call
 * vi.resetModules() before every test so each import gets a fresh flag
 * (= false).  vi.mock() registrations survive resetModules() in Vitest — the
 * mock factory is re-applied on the fresh import automatically.
 *
 * Fire-and-forget timing
 * ----------------------
 * The alert email is sent inside an un-awaited async IIFE.  After calling
 * warnIfTestModeInProduction we drain the microtask/macro-task queue with a
 * short setTimeout so the IIFE has time to settle before we assert.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────
// These are hoisted by Vitest and re-applied on every fresh module import that
// follows a vi.resetModules() call.

vi.mock("./lib/mailer", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
  getOwnerEmail: vi.fn().mockResolvedValue("admin@example.test"),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Wait long enough for a fire-and-forget async IIFE to finish. */
const flushAsync = () => new Promise<void>((resolve) => setTimeout(resolve, 100));

/** Save and restore relevant env vars around each test. */
const ENV_KEYS = ["REPLIT_DEPLOYMENT", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;

describe("warnIfTestModeInProduction", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Snapshot
    for (const k of ENV_KEYS) savedEnv[k] = process.env[k];
    // Start clean
    for (const k of ENV_KEYS) delete process.env[k];
    vi.clearAllMocks();
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

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const { sendEmail, getOwnerEmail } = await import("./lib/mailer");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    // Banner was logged
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("STRIPE IS IN TEST MODE"),
    );

    // Email was sent exactly once
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@example.test",
        subject: "🚨 CRITICAL: Stripe is in TEST mode on production",
      }),
    );

    // Admin email was looked up
    expect(getOwnerEmail).toHaveBeenCalledOnce();
  });

  // ── Test 2: de-duplication ────────────────────────────────────────────────

  it("de-duplicates: a second call in the same process sends no further email", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task401_dedup";

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const { sendEmail } = await import("./lib/mailer");
    const log = vi.fn();
    const errorLog = vi.fn();

    // First call
    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    // Second call — testModeAlertSent is now true inside the module
    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    // Only one send, regardless of how many times we called warn
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  // ── Test 3: silent in development ─────────────────────────────────────────

  it("does nothing when REPLIT_DEPLOYMENT is not set (development mode)", async () => {
    // No REPLIT_DEPLOYMENT
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task401_dev";

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const { sendEmail } = await import("./lib/mailer");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    expect(sendEmail).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
  });

  // ── Test 4: live key in production is fine ────────────────────────────────

  it("does not alert and logs 'live ✓' when production uses a live key", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_live_fakekey_task401_live";

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const { sendEmail } = await import("./lib/mailer");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    expect(sendEmail).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("Stripe mode: live ✓");
  });

  // ── Test 5: no admin email → no send ─────────────────────────────────────

  it("skips sendEmail and logs a warning when getOwnerEmail returns null", async () => {
    process.env.REPLIT_DEPLOYMENT = "1";
    process.env.STRIPE_SECRET_KEY = "sk_test_fakekey_task401_noemail";

    // Override the mock for this test only
    const { getOwnerEmail, sendEmail } = await import("./lib/mailer");
    (getOwnerEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const { warnIfTestModeInProduction } = await import("./stripeClient");
    const log = vi.fn();
    const errorLog = vi.fn();

    await warnIfTestModeInProduction(log, errorLog);
    await flushAsync();

    expect(sendEmail).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining("Could not resolve admin email"),
    );
  });
});
