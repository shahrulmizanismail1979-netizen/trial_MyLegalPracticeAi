import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  SIGN_IN_FAILURE_WINDOW_MS,
  SIGN_IN_SIGNAL_MAX_KEYS,
  SIGN_IN_WARNING_COOLDOWN_MS,
  classifySignInStatus,
  resolveKnownSubscriber,
  portalSignInSignalObserver,
  updateSignInSignalState,
  type SignInSignalState,
} from "./portalSignInSignals";

const empty = (): SignInSignalState => ({ records: {} });

describe("privacy-safe portal sign-in signals", () => {
  it("attributes only one active confirmed query result with matching entitlement", async () => {
    const query = vi.fn(async () => ({
      rows: [{ id: 42, apps: ["MyCrimAI"] }],
      rowCount: 1,
    })) as never;
    await expect(resolveKnownSubscriber("SECRET-CODE", "crim", new Date("2026-01-01"), query))
      .resolves.toBe(42);
    const [sql, params] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toMatch(/^SELECT id, apps FROM subscribers/m);
    expect(sql).toContain("payment_status = 'confirmed'");
    expect(sql).toContain("subscription_expiry > $2");
    expect(params).toEqual(["SECRET-CODE", new Date("2026-01-01")]);
  });

  it("uses canonical shared MyCorpAI entitlement names", async () => {
    const query = vi.fn(async () => ({
      rows: [{ id: 51, apps: ["MyCorpAI"] }],
      rowCount: 1,
    })) as never;
    await expect(resolveKnownSubscriber("CORP-CODE", "corp", new Date(), query))
      .resolves.toBe(51);
  });

  it.each([
    ["wrong portal", [{ id: 42, apps: ["MyLitAI"] }]],
    ["unpaid, expired, or unrecognized (excluded by query)", []],
    ["ambiguous identity", [{ id: 42, apps: ["MyCrimAI"] }, { id: 43, apps: ["MyCrimAI"] }]],
  ])("skips %s", async (_label, rows) => {
    const query = vi.fn(async () => ({ rows, rowCount: rows.length })) as never;
    await expect(resolveKnownSubscriber("NOT-STORED", "crim", new Date(), query)).resolves.toBeNull();
  });

  it("opens at three failures, cools down, and recovers only its own login incident", () => {
    let state = empty();
    const notices: string[] = [];
    for (const minute of [0, 1, 2, 10, 20, 30, 40, 50, 60, 62]) {
      const result = updateSignInSignalState(state, {
        subscriberId: 7, portal: "lit", success: false,
      }, new Date(`2026-01-01T${minute < 60 ? "00" : "01"}:${String(minute % 60).padStart(2, "0")}:00Z`));
      state = result.state;
      notices.push(...result.notifications.map((n) => n.kind));
    }
    expect(notices).toEqual(["warning", "warning"]);
    const recovered = updateSignInSignalState(state, {
      subscriberId: 7, portal: "lit", success: true,
    }, new Date("2026-01-01T01:04:00Z"));
    expect(recovered.notifications.map((n) => n.kind)).toEqual(["recovery-success"]);
    expect(recovered.state.records["7:lit"]).toMatchObject({
      incidentOpen: false,
      recoveryNotified: true,
    });
  });

  it("labels quiet-window expiry separately instead of claiming login was fixed", () => {
    let state = empty();
    for (let minute = 0; minute < 3; minute++) {
      state = updateSignInSignalState(state, {
        subscriberId: 8, portal: "corp", success: false,
      }, new Date(1_000 + minute * 1_000)).state;
    }
    const quiet = updateSignInSignalState(
      state,
      null,
      new Date(1_000 + 2_000 + SIGN_IN_FAILURE_WINDOW_MS + 1),
    );
    expect(quiet.notifications.map((n) => n.kind)).toEqual(["recovery-quiet"]);
    expect(quiet.state.records["8:corp"]).toMatchObject({
      incidentOpen: false,
      recoveryNotified: true,
    });
  });

  it("keeps a cooldown tombstone across success and quiet recovery", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    let state = empty();
    for (let second = 0; second < 3; second++) {
      state = updateSignInSignalState(state, {
        subscriberId: 9, portal: "ccb", success: false,
      }, new Date(start.getTime() + second * 1_000)).state;
    }
    const recovered = updateSignInSignalState(state, {
      subscriberId: 9, portal: "ccb", success: true,
    }, new Date(start.getTime() + 3_000));
    state = recovered.state;
    expect(state.records["9:ccb"]?.lastWarningAt).toBe(start.toISOString().replace("00.000", "02.000"));

    const notices: string[] = [];
    for (const second of [
      SIGN_IN_WARNING_COOLDOWN_MS / 1_000 - 15,
      SIGN_IN_WARNING_COOLDOWN_MS / 1_000 - 10,
      SIGN_IN_WARNING_COOLDOWN_MS / 1_000 - 5,
    ]) {
      const next = updateSignInSignalState(state, {
        subscriberId: 9, portal: "ccb", success: false,
      }, new Date(start.getTime() + second * 1_000));
      state = next.state;
      notices.push(...next.notifications.map((n) => n.kind));
    }
    expect(notices).toEqual([]);

    const afterCooldown = updateSignInSignalState(state, {
      subscriberId: 9, portal: "ccb", success: false,
    }, new Date(start.getTime() + SIGN_IN_WARNING_COOLDOWN_MS + 3_000));
    expect(afterCooldown.notifications.map((n) => n.kind)).toContain("warning");
  });

  it("bounds and defensively projects persisted state without credentials", () => {
    const records = Object.fromEntries(Array.from({ length: SIGN_IN_SIGNAL_MAX_KEYS + 20 }, (_, id) => [
      `attacker-key-${id}`,
      {
        subscriberId: id + 1,
        portal: "acad",
        failures: ["2026-01-01T00:00:00.000Z", "RAW-CREDENTIAL"],
        incidentOpen: false,
        lastWarningAt: "invalid",
        lastSeenAt: "2026-01-01T00:00:00.000Z",
        email: "private@example.test",
        code: "RAW-CREDENTIAL",
      },
    ]));
    const projected = updateSignInSignalState(
      { records } as SignInSignalState,
      null,
      new Date("2026-01-01T00:01:00Z"),
    ).state;
    expect(Object.keys(projected.records).length).toBeLessThanOrEqual(SIGN_IN_SIGNAL_MAX_KEYS);
    const output = JSON.stringify(projected);
    expect(output).not.toContain("RAW-CREDENTIAL");
    expect(output).not.toContain("private@example.test");
    expect(Object.keys(projected.records)[0]).toMatch(/^\d+:acad$/);
  });

  it("rejects injected persisted fields, prototype portals, and invalid exported events", () => {
    const poisoned = {
      records: {
        one: {
          subscriberId: 1,
          portal: "lit",
          failures: ["ACCESS-CODE", "private@example.test"],
          incidentOpen: "ACCESS-CODE",
          recoveryNotified: "ACCESS-CODE",
          lastWarningAt: "ACCESS-CODE",
          lastSeenAt: "ACCESS-CODE",
        },
        two: {
          subscriberId: 2,
          portal: "__proto__",
          failures: ["2026-01-01T00:00:00Z"],
          incidentOpen: true,
          lastWarningAt: "2026-01-01T00:00:00Z",
          lastSeenAt: "2026-01-01T00:00:00Z",
        },
        three: {
          subscriberId: -3,
          portal: "corp",
          failures: [],
          incidentOpen: false,
          lastWarningAt: null,
          lastSeenAt: "2026-01-01T00:00:00Z",
        },
      },
    };
    const projected = updateSignInSignalState(
      poisoned as never,
      { subscriberId: 4, portal: "__proto__", success: false } as never,
      new Date("2026-01-01T00:01:00Z"),
    ).state;
    expect(JSON.stringify(projected)).not.toMatch(/ACCESS-CODE|private@example|__proto__/);
    expect(projected.records["4:__proto__"]).toBeUndefined();
  });

  it("counts internal faults but excludes malformed, rate-limited, and redirect statuses", () => {
    expect(classifySignInStatus(500)).toBe(false);
    expect(classifySignInStatus(503)).toBe(false);
    expect(classifySignInStatus(401)).toBe(false);
    expect(classifySignInStatus(409)).toBe(false);
    expect(classifySignInStatus(200)).toBe(true);
    expect(classifySignInStatus(400)).toBeNull();
    expect(classifySignInStatus(429)).toBeNull();
    expect(classifySignInStatus(302)).toBeNull();

    let state = empty();
    for (let i = 0; i < 3; i++) {
      state = updateSignInSignalState(state, {
        subscriberId: 10, portal: "accident", success: classifySignInStatus(500)!,
      }, new Date(1_000 + i)).state;
    }
    expect(state.records["10:accident"]?.incidentOpen).toBe(true);
  });

  it("is passive and preserves downstream auth and rate-limit responses", async () => {
    const app = express();
    app.use(express.json());
    app.use(portalSignInSignalObserver);
    app.post("/api/crim/auth/verify", (_req, res) => {
      res.set("x-auth-handler", "reached").status(401).json({ authenticated: false });
    });
    app.post("/api/ccb/auth/verify", (_req, res) => {
      res.set("Retry-After", "60").status(429).json({ error: "rate limited" });
    });

    const auth = await request(app).post("/api/crim/auth/verify").send({});
    expect(auth.status).toBe(401);
    expect(auth.headers["x-auth-handler"]).toBe("reached");
    expect(auth.body).toEqual({ authenticated: false });

    const limited = await request(app)
      .post("/api/ccb/auth/verify")
      .send({ code: "TRANSIENT-ONLY" });
    expect(limited.status).toBe(429);
    expect(limited.headers["retry-after"]).toBe("60");
    expect(limited.body).toEqual({ error: "rate limited" });
  });
});