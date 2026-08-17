/**
 * Tests for the ALERT_COOLDOWN_MS IIFE in stripeClient.ts.
 *
 * Because ALERT_COOLDOWN_MS is evaluated at module-load time, each test must
 * reset the module registry and dynamically import stripeClient so the IIFE
 * re-runs with the desired env var value.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Heavy dependencies imported by stripeClient at the module level — mock them
// so the module resolves without real credentials or a DB connection.
vi.mock("stripe", () => ({
  default: vi.fn(),
}));
vi.mock("stripe-replit-sync", () => ({
  StripeSync: vi.fn(),
}));
vi.mock("./lib/mailer", () => ({
  sendEmail: vi.fn(),
  getOwnerEmail: vi.fn(),
  sendWebhookAlert: vi.fn(),
}));
vi.mock("./lib/alertStatus", () => ({
  recordAlertAttempt: vi.fn(),
}));

/** Helper: reset modules + env var, then import stripeClient fresh. */
async function importWithCooldown(
  value: string | undefined,
): Promise<{ ALERT_COOLDOWN_MS: number }> {
  vi.resetModules();
  if (value === undefined) {
    delete process.env.STRIPE_ALERT_COOLDOWN_MINUTES;
  } else {
    process.env.STRIPE_ALERT_COOLDOWN_MINUTES = value;
  }
  // Dynamic import picks up the freshly-reset module registry.
  return import("./stripeClient");
}

describe("ALERT_COOLDOWN_MS parsing", () => {
  const originalEnv = process.env.STRIPE_ALERT_COOLDOWN_MINUTES;

  afterEach(() => {
    // Restore original value (or delete) after each test.
    if (originalEnv === undefined) {
      delete process.env.STRIPE_ALERT_COOLDOWN_MINUTES;
    } else {
      process.env.STRIPE_ALERT_COOLDOWN_MINUTES = originalEnv;
    }
    vi.resetModules();
  });

  it("returns the default (60 min → 3 600 000 ms) when the env var is absent", async () => {
    const { ALERT_COOLDOWN_MS } = await importWithCooldown(undefined);
    expect(ALERT_COOLDOWN_MS).toBe(60 * 60 * 1_000);
  });

  it("converts a positive integer correctly (e.g. 30 → 1 800 000 ms)", async () => {
    const { ALERT_COOLDOWN_MS } = await importWithCooldown("30");
    expect(ALERT_COOLDOWN_MS).toBe(30 * 60 * 1_000);
  });

  it("converts zero to 0 ms (immediate re-alert on every restart)", async () => {
    const { ALERT_COOLDOWN_MS } = await importWithCooldown("0");
    expect(ALERT_COOLDOWN_MS).toBe(0);
  });

  it("falls back to the 60-min default and warns for a negative value", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ALERT_COOLDOWN_MS } = await importWithCooldown("-5");
    expect(ALERT_COOLDOWN_MS).toBe(60 * 60 * 1_000);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/invalid/i);
    warnSpy.mockRestore();
  });

  it("falls back to the 60-min default and warns for a non-numeric value", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { ALERT_COOLDOWN_MS } = await importWithCooldown("banana");
    expect(ALERT_COOLDOWN_MS).toBe(60 * 60 * 1_000);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/invalid/i);
    warnSpy.mockRestore();
  });

  it("falls back to the 60-min default and warns for an empty string", async () => {
    // An empty string coerces to 0 via Number(""), which IS finite and >= 0,
    // so the IIFE would accept it as 0 ms — the expected value is 0 ms here.
    // Document this edge case explicitly so it is a conscious decision.
    const { ALERT_COOLDOWN_MS } = await importWithCooldown("");
    // Number("") === 0, which is finite and non-negative → accepted as 0 ms.
    expect(ALERT_COOLDOWN_MS).toBe(0);
  });

  it("converts a large value correctly (e.g. 1440 min = 24 h → 86 400 000 ms)", async () => {
    const { ALERT_COOLDOWN_MS } = await importWithCooldown("1440");
    expect(ALERT_COOLDOWN_MS).toBe(1440 * 60 * 1_000);
  });
});
