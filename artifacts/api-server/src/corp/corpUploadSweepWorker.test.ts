/**
 * Unit tests: startCorpUploadSweepWorker (Task #482)
 *
 * Verifies that the hourly sweep loop:
 *   1. Calls sweepExpiredCorpUploads once after the scheduled interval fires.
 *   2. Continues to call sweepExpiredCorpUploads on the next interval even
 *      when the previous iteration threw (non-fatal behaviour).
 *
 * Uses vitest fake timers so the tests complete in milliseconds rather than
 * waiting a real hour.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoist mocks so they are initialised before vi.mock factory runs ───────────
// vi.mock calls are hoisted to the top of the compiled output; any variable
// referenced inside the factory must itself be hoisted via vi.hoisted().

const { mockSweep } = vi.hoisted(() => ({
  mockSweep: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
}));

vi.mock("./routes/legal/uploads", () => ({
  sweepExpiredCorpUploads: mockSweep,
}));

// Stub the logger to keep test output clean.
vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import AFTER mocks are installed.
import {
  startCorpUploadSweepWorker,
  CORP_UPLOAD_SWEEP_INTERVAL_MS,
} from "./corpUploadSweepWorker";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Advance fake timers by exactly one sweep interval and flush all pending
 * microtasks so the loop body runs to completion before we assert.
 */
async function advanceOneInterval(): Promise<void> {
  await vi.advanceTimersByTimeAsync(CORP_UPLOAD_SWEEP_INTERVAL_MS);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("startCorpUploadSweepWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSweep.mockReset();
    mockSweep.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("calls sweepExpiredCorpUploads once after the first interval fires", async () => {
    // Start the worker — the returned promise never settles (infinite loop).
    void startCorpUploadSweepWorker();

    // Before the interval fires, the sweep must not have been called.
    expect(mockSweep).not.toHaveBeenCalled();

    // Advance by one full interval; the loop should call the sweep exactly once.
    await advanceOneInterval();

    expect(mockSweep).toHaveBeenCalledTimes(1);
  });

  it("calls sweepExpiredCorpUploads again on the second interval", async () => {
    void startCorpUploadSweepWorker();

    await advanceOneInterval();
    expect(mockSweep).toHaveBeenCalledTimes(1);

    await advanceOneInterval();
    expect(mockSweep).toHaveBeenCalledTimes(2);
  });

  it("continues firing on the next interval even when sweepExpiredCorpUploads throws", async () => {
    // First interval: simulate a sweep failure.
    mockSweep.mockRejectedValueOnce(new Error("Simulated sweep failure"));
    // Subsequent intervals: succeed normally.
    mockSweep.mockResolvedValue(undefined);

    void startCorpUploadSweepWorker();

    // First interval — sweep throws; the loop must catch and swallow the error.
    await advanceOneInterval();
    expect(mockSweep).toHaveBeenCalledTimes(1);

    // Second interval — loop must still fire and call the sweep again.
    await advanceOneInterval();
    expect(mockSweep).toHaveBeenCalledTimes(2);
  });
});
