import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";

const RUN_ID = randomUUID();
const CODE = `MLPA-SEATS-${RUN_ID.slice(0, 5).toUpperCase()}`;

const { claimSeat, releaseSeat, hasActiveSeat, ensureSeatLimitSchema, SEAT_TTL_MS } = await import(
  "./seatLimits"
);
const { db, portalCodeSeatsTable, litAccessCodes, crimAccessCodesTable, subscribersTable } =
  await import("@workspace/db");
const { syncPortalAccessCodes, BUNDLE_TIER_CATALOG } = await import("./provisioning");
const { and, eq } = await import("drizzle-orm");

describe("team-bundle seat limits", () => {
  beforeAll(async () => {
    await ensureSeatLimitSchema();
  });

  afterAll(async () => {
    await db.delete(portalCodeSeatsTable).where(eq(portalCodeSeatsTable.code, CODE));
    await db.delete(litAccessCodes).where(eq(litAccessCodes.code, CODE));
    await db.delete(crimAccessCodesTable).where(eq(crimAccessCodesTable.code, CODE));
    await db.delete(subscribersTable).where(eq(subscribersTable.accessCode, CODE));
  });

  it("allows up to maxSeats distinct seat keys and rejects the next", async () => {
    const maxSeats = 3;
    for (let i = 0; i < maxSeats; i++) {
      const claim = await claimSeat({ portal: "lit", code: CODE, maxSeats, seatKey: `dev-${i}` });
      expect(claim.ok).toBe(true);
    }
    const overflow = await claimSeat({ portal: "lit", code: CODE, maxSeats, seatKey: "dev-extra" });
    expect(overflow.ok).toBe(false);

    // Re-claiming an existing seat is always allowed (same device re-login).
    const again = await claimSeat({ portal: "lit", code: CODE, maxSeats, seatKey: "dev-1" });
    expect(again.ok).toBe(true);

    // Releasing a seat frees room for a new device.
    await releaseSeat("lit", "dev-0");
    const afterRelease = await claimSeat({
      portal: "lit",
      code: CODE,
      maxSeats,
      seatKey: "dev-extra",
    });
    expect(afterRelease.ok).toBe(true);
  });

  it("expires stale seats after the TTL", async () => {
    const stale = new Date(Date.now() - SEAT_TTL_MS - 60_000);
    await db
      .update(portalCodeSeatsTable)
      .set({ lastSeenAt: stale })
      .where(
        and(eq(portalCodeSeatsTable.code, CODE), eq(portalCodeSeatsTable.seatKey, "dev-1")),
      );
    expect(await hasActiveSeat("lit", CODE, "dev-1")).toBe(false);
    // Stale seat no longer blocks a new claimant.
    const claim = await claimSeat({ portal: "lit", code: CODE, maxSeats: 3, seatKey: "dev-new" });
    expect(claim.ok).toBe(true);
  });

  it("never oversubscribes under concurrent logins (advisory lock)", async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        claimSeat({ portal: "crim", code: CODE, maxSeats: 3, seatKey: `race-${i}` }),
      ),
    );
    expect(results.filter((r) => r.ok).length).toBe(3);
    const rows = await db
      .select()
      .from(portalCodeSeatsTable)
      .where(and(eq(portalCodeSeatsTable.portal, "crim"), eq(portalCodeSeatsTable.code, CODE)));
    expect(rows.length).toBe(3);
  });

  it("keeps a continuously active seat alive past the TTL (per-request refresh)", async () => {
    await claimSeat({ portal: "ccb", code: CODE, maxSeats: 1, seatKey: "active-dev" });
    // Simulate a device nearing the inactivity cutoff…
    const nearCutoff = new Date(Date.now() - SEAT_TTL_MS + 60_000);
    await db
      .update(portalCodeSeatsTable)
      .set({ lastSeenAt: nearCutoff })
      .where(
        and(eq(portalCodeSeatsTable.portal, "ccb"), eq(portalCodeSeatsTable.seatKey, "active-dev")),
      );
    // …an authenticated request (hasActiveSeat/claimSeat) refreshes it…
    expect(await hasActiveSeat("ccb", CODE, "active-dev")).toBe(true);
    const [row] = await db
      .select()
      .from(portalCodeSeatsTable)
      .where(
        and(eq(portalCodeSeatsTable.portal, "ccb"), eq(portalCodeSeatsTable.seatKey, "active-dev")),
      );
    // …so its last-seen time is now fresh and it will not be reaped.
    expect(row!.lastSeenAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
  });

  it("caps concurrent corp sessions under parallel logins", async () => {
    const { allocateCorpSession } = await import("../corp/routes/legal/index");
    const { corpAccessCodes, corpSessions } = await import("@workspace/db");
    const [codeRow] = await db
      .insert(corpAccessCodes)
      .values({ code: CODE.slice(0, 20), label: `seats-test-${RUN_ID}`, maxSeats: 3 })
      .returning();
    try {
      await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          allocateCorpSession({
            accessCodeId: codeRow!.id,
            maxSeats: 3,
            deviceInfo: `race-device-${i}`,
          }),
        ),
      );
      const active = await db
        .select()
        .from(corpSessions)
        .where(and(eq(corpSessions.accessCodeId, codeRow!.id), eq(corpSessions.isActive, true)));
      expect(active.length).toBe(3);
    } finally {
      await db.delete(corpSessions).where(eq(corpSessions.accessCodeId, codeRow!.id));
      await db.delete(corpAccessCodes).where(eq(corpAccessCodes.id, codeRow!.id));
    }
  });

  it("frees a seat on release so another device can log in", async () => {
    await claimSeat({ portal: "sya", code: CODE, maxSeats: 1, seatKey: "sya-sess-1" });
    const blocked = await claimSeat({ portal: "sya", code: CODE, maxSeats: 1, seatKey: "sya-sess-2" });
    expect(blocked.ok).toBe(false);
    await releaseSeat("sya", "sya-sess-1");
    const afterLogout = await claimSeat({
      portal: "sya",
      code: CODE,
      maxSeats: 1,
      seatKey: "sya-sess-2",
    });
    expect(afterLogout.ok).toBe(true);
  });

  it("treats codes without a configured limit as unlimited (legacy)", async () => {
    for (let i = 0; i < 10; i++) {
      const claim = await claimSeat({
        portal: "sya",
        code: CODE,
        maxSeats: null,
        seatKey: `legacy-${i}`,
      });
      expect(claim.ok).toBe(true);
    }
  });

  it("propagates the catalog seat count to portal access-code rows", async () => {
    const tier = "firm-boutique";
    const licenses = BUNDLE_TIER_CATALOG[tier]!.licenses;
    await syncPortalAccessCodes({
      accessCode: CODE,
      name: `seats-test-${RUN_ID}`,
      email: `seats-test-${RUN_ID}@example.test`,
      apps: ["MyLitAI", "MyCrimAI"],
      tier,
    });
    const [lit] = await db.select().from(litAccessCodes).where(eq(litAccessCodes.code, CODE));
    const [crim] = await db
      .select()
      .from(crimAccessCodesTable)
      .where(eq(crimAccessCodesTable.code, CODE));
    expect(lit?.maxSeats).toBe(licenses);
    expect(crim?.maxSeats).toBe(licenses);
  });
});
