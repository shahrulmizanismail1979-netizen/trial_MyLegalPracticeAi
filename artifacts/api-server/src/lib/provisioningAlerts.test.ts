import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  PROVISIONING_ALERT_BATCH_SIZE,
  type ProvisioningAlertDependencies,
  type ProvisioningAlertState,
  provisioningAlertContent,
  runProvisioningAccessAlertCycle,
} from "./provisioningAlerts";

const state = (overrides: Partial<ProvisioningAlertState> = {}): ProvisioningAlertState => ({
  cursor: 0, upperBound: 0, gapCount: 0, gapSamples: [],
  unknownIntentCount: 0, unknownIntentSamples: [],
  incidentOpen: false, lastWarningAt: null, ...overrides,
});

function harness(initial: ProvisioningAlertState, batches: Array<Record<string, unknown>>) {
  let current = structuredClone(initial);
  const sendAlert = vi.fn();
  const checkBatch = vi.fn(async () => batches.shift() as never);
  const deps: ProvisioningAlertDependencies = {
    withLock: async (work) => work(),
    loadState: async () => structuredClone(current),
    saveState: async (next) => { current = structuredClone(next); },
    getUpperBound: async () => 100,
    checkBatch,
    sendAlert,
  };
  return { deps, sendAlert, checkBatch, current: () => current };
}

describe("automatic provisioning-gap alerts", () => {
  it("uses a fixed upper bound and cursor so busy signup periods cannot hide older rows", async () => {
    const h = harness(state(), [
      { sampled: 25, lastId: 25, complete: false, unknownIntent: 0, gaps: [] },
      { sampled: 10, lastId: 100, complete: true, unknownIntent: 0, gaps: [] },
    ]);
    await runProvisioningAccessAlertCycle(new Date("2026-01-01"), h.deps);
    expect(h.checkBatch).toHaveBeenCalledWith(expect.objectContaining({ afterId: 0, throughId: 100, limit: PROVISIONING_ALERT_BATCH_SIZE }));
    await runProvisioningAccessAlertCycle(new Date("2026-01-01T00:01:00Z"), h.deps);
    expect(h.checkBatch).toHaveBeenLastCalledWith(expect.objectContaining({ afterId: 25, throughId: 100 }));
  });

  it("serializes concurrent replica cycles so cursor updates and alerts cannot race", async () => {
    let held = false;
    const waiters: Array<() => void> = [];
    const h = harness(state(), [
      { sampled: 1, lastId: 100, complete: true, unknownIntent: 0, gaps: [{ subscriberId: 7, portal: "MyCrimAI" }] },
      { sampled: 1, lastId: 100, complete: true, unknownIntent: 0, gaps: [{ subscriberId: 7, portal: "MyCrimAI" }] },
    ]);
    h.deps.withLock = async (work) => {
      if (held) await new Promise<void>((resolve) => waiters.push(resolve));
      held = true;
      try { await work(); } finally {
        held = false;
        waiters.shift()?.();
      }
    };
    await Promise.all([
      runProvisioningAccessAlertCycle(new Date("2026-01-01T00:00:00Z"), h.deps),
      runProvisioningAccessAlertCycle(new Date("2026-01-01T00:00:01Z"), h.deps),
    ]);
    expect(h.sendAlert).toHaveBeenCalledTimes(1);
    expect(h.sendAlert).toHaveBeenCalledWith("warning", expect.anything(), expect.anything());
  });

  it("deduplicates warnings during cooldown, repeats after cooldown, then reports recovery", async () => {
    const gap = { subscriberId: 7, portal: "MyCrimAI" };
    const h = harness(state(), [
      { sampled: 1, lastId: 100, complete: true, unknownIntent: 0, gaps: [gap] },
      { sampled: 1, lastId: 100, complete: true, unknownIntent: 0, gaps: [gap] },
      { sampled: 1, lastId: 100, complete: true, unknownIntent: 0, gaps: [gap] },
      { sampled: 1, lastId: 100, complete: true, unknownIntent: 0, gaps: [] },
    ]);
    await runProvisioningAccessAlertCycle(new Date("2026-01-01T00:00:00Z"), h.deps);
    await runProvisioningAccessAlertCycle(new Date("2026-01-01T00:30:00Z"), h.deps);
    await runProvisioningAccessAlertCycle(new Date("2026-01-01T01:01:00Z"), h.deps);
    await runProvisioningAccessAlertCycle(new Date("2026-01-01T01:02:00Z"), h.deps);
    expect(h.sendAlert.mock.calls.map(([kind]) => kind)).toEqual(["warning", "warning", "recovery"]);
    expect(h.current().incidentOpen).toBe(false);
  });

  it("warns for confirmed subscribers with unknown entitlement and does not falsely recover", async () => {
    const h = harness(state({ incidentOpen: true, lastWarningAt: "2026-01-01T00:00:00.000Z" }), [
      { sampled: 1, lastId: 100, complete: true, unknownIntent: 1, unknownSubscriberIds: [73], gaps: [] },
    ]);
    await runProvisioningAccessAlertCycle(new Date("2026-01-01T01:01:00Z"), h.deps);
    expect(h.sendAlert).toHaveBeenCalledOnce();
    expect(h.sendAlert).toHaveBeenCalledWith("warning", expect.objectContaining({
      gapCount: 0,
      unknownIntentCount: 1,
      unknownIntentSamples: [73],
    }), expect.anything());
    expect(h.sendAlert).not.toHaveBeenCalledWith("recovery", expect.anything(), expect.anything());
    expect(h.current().incidentOpen).toBe(true);
  });

  it("never puts access codes, names, or contact details in warning or recovery content", () => {
    const sensitive = ["MLPA-SECRET", "Private Person", "private@example.test"];
    const warning = provisioningAlertContent("warning", state({
      gapCount: 1,
      gapSamples: [{ subscriberId: 42, portal: "MyLitAI" }],
      unknownIntentCount: 1,
      unknownIntentSamples: [73],
    }), "2026-01-01T00:00:00.000Z");
    const recovery = provisioningAlertContent("recovery", state(), "2026-01-01T01:00:00.000Z");
    const output = JSON.stringify([warning, recovery]);
    for (const value of sensitive) expect(output).not.toContain(value);
    expect(output).toContain("Subscriber #42");
    expect(output).toContain("Subscriber #73");
    expect(output).not.toMatch(/access.?code|credential|email/i);
  });

  it("keeps checker and mailer failure logs free of exception and webhook credential objects", () => {
    const checker = readFileSync(new URL("./provisioningAlerts.ts", import.meta.url), "utf8");
    const mailer = readFileSync(new URL("./mailer.ts", import.meta.url), "utf8");
    expect(checker).not.toMatch(/logger\.(?:error|warn)\(\s*\{\s*err\b/);
    expect(mailer).not.toContain("{ webhookUrl");
    expect(mailer).not.toMatch(/logger\.(?:error|warn)\(\s*\{\s*err\b/);
  });
});