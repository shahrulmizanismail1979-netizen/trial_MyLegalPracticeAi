import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

const RUN_ID = randomUUID();
const CCB_CODE = `MLPA-SEATM-${RUN_ID.slice(0, 5).toUpperCase()}`;
const CORP_CODE = `SEATM-${RUN_ID.slice(0, 5).toUpperCase()}`.slice(0, 20);

// Partial mock: real seat registry, but with a switch that simulates a
// seat-registry outage so we can prove capped codes fail CLOSED.
const seatState = { failClaims: false };
vi.mock("./seatLimits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./seatLimits")>();
  return {
    ...actual,
    claimSeat: (params: Parameters<typeof actual.claimSeat>[0]) => {
      if (seatState.failClaims) return Promise.reject(new Error("simulated seat registry outage"));
      return actual.claimSeat(params);
    },
  };
});

const { ensureSeatLimitSchema } = await import("./seatLimits");
const { db, portalCodeSeatsTable, ccbAccessCodes, corpAccessCodes, corpSessions } = await import(
  "@workspace/db"
);
const { and, eq } = await import("drizzle-orm");
const { requirePractitioner } = await import("../ccb/routes/auth");
const { requireSession } = await import("../corp/lib/requireSession");
const { allocateCorpSession } = await import("../corp/routes/legal/index");

const SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

function ccbApp() {
  const app = express();
  app.get("/protected", (req, res, next) => void requirePractitioner(req, res, next), (_req, res) =>
    res.json({ ok: true }),
  );
  return app;
}

describe("seat enforcement in real middleware paths", () => {
  beforeAll(async () => {
    await ensureSeatLimitSchema();
  });

  afterAll(async () => {
    await db.delete(portalCodeSeatsTable).where(eq(portalCodeSeatsTable.code, CCB_CODE));
    await db.delete(ccbAccessCodes).where(eq(ccbAccessCodes.code, CCB_CODE));
    const codes = await db.select().from(corpAccessCodes).where(eq(corpAccessCodes.code, CORP_CODE));
    for (const c of codes) {
      await db.delete(corpSessions).where(eq(corpSessions.accessCodeId, c.id));
    }
    await db.delete(corpAccessCodes).where(eq(corpAccessCodes.code, CORP_CODE));
  });

  it("ccb: refreshes the caller's seat, blocks an over-limit device, and fails closed on registry errors", async () => {
    await db.insert(ccbAccessCodes).values({ code: CCB_CODE, active: true, maxSeats: 1 });
    const token = jwt.sign({ role: "practitioner", code: CCB_CODE }, SECRET, { expiresIn: "1h" });
    const app = ccbApp();

    // Device A holds the single licensed seat.
    const a1 = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`)
      .set("User-Agent", "device-A");
    expect(a1.status).toBe(200);

    // Device B (different fingerprint) is over the licensed count.
    const b1 = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`)
      .set("User-Agent", "device-B");
    expect(b1.status).toBe(401);
    expect(b1.body.error).toMatch(/seat limit/i);

    // Device A keeps working (per-request refresh, not login-only).
    const a2 = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`)
      .set("User-Agent", "device-A");
    expect(a2.status).toBe(200);

    // Seat-registry outage: capped codes must fail CLOSED, even for the
    // device that holds a seat.
    seatState.failClaims = true;
    try {
      const a3 = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${token}`)
        .set("User-Agent", "device-A");
      expect(a3.status).toBe(401);
    } finally {
      seatState.failClaims = false;
    }
  });

  it("accident: concurrent logins can never exceed maxUsers, and stale sessions free their seat", async () => {
    const { allocateAccidentSession, touchAccidentUsage } = await import("../accident/seats");
    const { accessCodesTable, accessCodeUsageTable } = await import("@workspace/db");
    const { SEAT_TTL_MS } = await import("./seatLimits");
    const [code] = await db
      .insert(accessCodesTable)
      .values({ code: `ACC-${RUN_ID.slice(0, 8)}`, label: `seat-test-${RUN_ID}`, maxUsers: 3 })
      .returning();
    try {
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          allocateAccidentSession({ accessCodeId: code!.id, maxUsers: 3 }),
        ),
      );
      const granted = results.filter((r) => r.ok);
      expect(granted.length).toBe(3);
      const [after] = await db
        .select()
        .from(accessCodesTable)
        .where(eq(accessCodesTable.id, code!.id));
      expect(after!.currentUsers).toBe(3);

      // An abandoned session past the TTL frees its seat for a new login…
      const stale = new Date(Date.now() - SEAT_TTL_MS - 60_000);
      const staleSession = (granted[0] as { ok: true; sessionId: string }).sessionId;
      await db
        .update(accessCodeUsageTable)
        .set({ usedAt: stale })
        .where(eq(accessCodeUsageTable.sessionId, staleSession));
      const reclaimed = await allocateAccidentSession({ accessCodeId: code!.id, maxUsers: 3 });
      expect(reclaimed.ok).toBe(true);

      // …but an active session that keeps getting refreshed does not.
      const activeSession = (granted[1] as { ok: true; sessionId: string }).sessionId;
      await touchAccidentUsage(activeSession);
      const [activeRow] = await db
        .select()
        .from(accessCodeUsageTable)
        .where(eq(accessCodeUsageTable.sessionId, activeSession));
      expect(activeRow!.usedAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
      const overflow = await allocateAccidentSession({ accessCodeId: code!.id, maxUsers: 3 });
      expect(overflow.ok).toBe(false);
    } finally {
      await db.delete(accessCodeUsageTable).where(eq(accessCodeUsageTable.accessCodeId, code!.id));
      await db.delete(accessCodesTable).where(eq(accessCodesTable.id, code!.id));
    }
  });

  it("lit: the router-level gate displaces an over-limit session on any route, not just Gemini", async () => {
    const { litSessionGate } = await import("../lit/routes/auth");
    const { litAccessCodes } = await import("@workspace/db");
    const session = (await import("express-session")).default;
    const LIT_CODE = `LIT-SEATM-${RUN_ID.slice(0, 5).toUpperCase()}`;
    const [code] = await db
      .insert(litAccessCodes)
      .values({
        code: LIT_CODE,
        recipientName: `seat-test-${RUN_ID}`,
        recipientEmail: "seat-test@example.com",
        status: "active",
        maxSeats: 1,
      })
      .returning();
    try {
      const app = express();
      app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
      // Stub login: binds an authenticated code session, like loginWithCode.
      app.post("/login", (req, res) => {
        const sess = req.session as unknown as Record<string, unknown>;
        sess.authenticated = true;
        sess.accessCodeId = code!.id;
        res.json({ ok: true });
      });
      app.use((req, res, next) => void litSessionGate(req, res, next));
      // A non-Gemini product route with no per-route auth of its own.
      app.get("/matters", (_req, res) => res.json({ ok: true }));

      const deviceA = request.agent(app);
      const deviceB = request.agent(app);
      await deviceA.post("/login").expect(200);
      const a1 = await deviceA.get("/matters");
      expect(a1.status).toBe(200); // device A claims the single seat

      await deviceB.post("/login").expect(200);
      const b1 = await deviceB.get("/matters");
      expect(b1.status).toBe(401); // over the licensed count
      expect(b1.body.error).toMatch(/seat limit/i);

      const a2 = await deviceA.get("/matters");
      expect(a2.status).toBe(200); // holder keeps working (refresh)
    } finally {
      await db.delete(portalCodeSeatsTable).where(eq(portalCodeSeatsTable.code, LIT_CODE));
      await db.delete(litAccessCodes).where(eq(litAccessCodes.id, code!.id));
    }
  });

  it("accident: AI routes reject displaced or idle-expired sessions and refresh active ones", async () => {
    const { requireAccidentSession } = await import("../accident/sessionGate");
    const { allocateAccidentSession } = await import("../accident/seats");
    const { accessCodesTable, accessCodeUsageTable } = await import("@workspace/db");
    const { SEAT_TTL_MS } = await import("./seatLimits");
    const cookieParser = (await import("cookie-parser")).default;
    const [code] = await db
      .insert(accessCodesTable)
      .values({ code: `ACCAI-${RUN_ID.slice(0, 8)}`, label: `seat-test-${RUN_ID}`, maxUsers: 2 })
      .returning();
    try {
      const app = express();
      app.use(cookieParser());
      app.use((req, res, next) => void requireAccidentSession(req, res, next));
      app.get("/ai", (_req, res) => res.json({ ok: true }));

      const seat = await allocateAccidentSession({ accessCodeId: code!.id, maxUsers: 2 });
      expect(seat.ok).toBe(true);
      const sessionId = (seat as { ok: true; sessionId: string }).sessionId;

      // Live session works (and is refreshed).
      const ok = await request(app).get("/ai").set("Cookie", `session_id=${sessionId}`);
      expect(ok.status).toBe(200);

      // Idle past the TTL → rejected and the seat is freed.
      await db
        .update(accessCodeUsageTable)
        .set({ usedAt: new Date(Date.now() - SEAT_TTL_MS - 60_000) })
        .where(eq(accessCodeUsageTable.sessionId, sessionId));
      const expired = await request(app).get("/ai").set("Cookie", `session_id=${sessionId}`);
      expect(expired.status).toBe(401);
      const rows = await db
        .select()
        .from(accessCodeUsageTable)
        .where(eq(accessCodeUsageTable.sessionId, sessionId));
      expect(rows.length).toBe(0); // displaced

      // Displaced session stays rejected; no cookie is rejected outright.
      const displaced = await request(app).get("/ai").set("Cookie", `session_id=${sessionId}`);
      expect(displaced.status).toBe(401);
      const anon = await request(app).get("/ai");
      expect(anon.status).toBe(401);
    } finally {
      await db.delete(accessCodeUsageTable).where(eq(accessCodeUsageTable.accessCodeId, code!.id));
      await db.delete(accessCodesTable).where(eq(accessCodesTable.id, code!.id));
    }
  });

  it("sya: the router-level gate caps sessions on any product route and fails closed on registry errors", async () => {
    const { syaSessionGate } = await import("../sya/lib/auth");
    const { accessCodesTable: syaAccessCodes } = await import("@workspace/db/sya");
    const session = (await import("express-session")).default;
    const SYA_CODE = `SYA-SEATM-${RUN_ID.slice(0, 5).toUpperCase()}`;
    const [code] = await db
      .insert(syaAccessCodes)
      .values({ code: SYA_CODE, name: `seat-test-${RUN_ID}`, maxSeats: 1 })
      .returning();
    try {
      const app = express();
      app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
      app.post("/login", (req, res) => {
        req.session.userId = 1;
        req.session.accountType = "code";
        req.session.accessCode = SYA_CODE;
        res.json({ ok: true });
      });
      app.use((req, res, next) => void syaSessionGate(req, res, next));
      // A representative previously-ungated product route.
      app.get("/dashboard", (_req, res) => res.json({ ok: true }));

      const deviceA = request.agent(app);
      const deviceB = request.agent(app);
      await deviceA.post("/login").expect(200);
      expect((await deviceA.get("/dashboard")).status).toBe(200);

      await deviceB.post("/login").expect(200);
      const b = await deviceB.get("/dashboard");
      expect(b.status).toBe(401);
      expect(b.body.error).toMatch(/seat limit/i);

      expect((await deviceA.get("/dashboard")).status).toBe(200);

      // Seat-registry outage → fail closed for capped codes.
      seatState.failClaims = true;
      try {
        expect((await deviceA.get("/dashboard")).status).toBe(401);
      } finally {
        seatState.failClaims = false;
      }
    } finally {
      await db.delete(portalCodeSeatsTable).where(eq(portalCodeSeatsTable.code, SYA_CODE));
      await db.delete(syaAccessCodes).where(eq(syaAccessCodes.id, code!.id));
    }
  });

  it("sya: login-time recovery of a bundle code re-creates the row WITH its licensed seat cap", async () => {
    const { recoverCodeFromSubscribers } = await import("../sya/routes/auth/index");
    const { subscribersTable } = await import("@workspace/db");
    const { accessCodesTable: syaAccessCodes } = await import("@workspace/db/sya");
    const REC_CODE = `SYA-RECOV-${RUN_ID.slice(0, 5).toUpperCase()}`;
    const [sub] = await db
      .insert(subscribersTable)
      .values({
        name: `seat-test-${RUN_ID}`,
        email: `seat-recovery-${RUN_ID.slice(0, 8)}@example.com`,
        phone: "0000000000",
        accessCode: REC_CODE,
        paymentAmount: "500",
        paymentStatus: "confirmed",
        apps: ["MySyalitAI"],
        licenses: 5,
      })
      .returning();
    try {
      // No portal row exists yet — recovery must mint it WITH the cap.
      const recovered = await recoverCodeFromSubscribers(REC_CODE);
      expect(recovered).not.toBeNull();
      expect(recovered!.maxSeats).toBe(5);
    } finally {
      await db.delete(syaAccessCodes).where(eq(syaAccessCodes.code, REC_CODE));
      await db.delete(subscribersTable).where(eq(subscribersTable.id, sub!.id));
    }
  });

  it("accident: matter routes reject an idle-expired session too (shared validator)", async () => {
    const { validateAccidentSession } = await import("../accident/sessionGate");
    const { allocateAccidentSession } = await import("../accident/seats");
    const { accessCodesTable, accessCodeUsageTable } = await import("@workspace/db");
    const { SEAT_TTL_MS } = await import("./seatLimits");
    const [code] = await db
      .insert(accessCodesTable)
      .values({ code: `ACCMT-${RUN_ID.slice(0, 8)}`, label: `seat-test-${RUN_ID}`, maxUsers: 2 })
      .returning();
    try {
      const seat = await allocateAccidentSession({ accessCodeId: code!.id, maxUsers: 2 });
      const sessionId = (seat as { ok: true; sessionId: string }).sessionId;
      expect((await validateAccidentSession(sessionId)).ok).toBe(true);
      await db
        .update(accessCodeUsageTable)
        .set({ usedAt: new Date(Date.now() - SEAT_TTL_MS - 60_000) })
        .where(eq(accessCodeUsageTable.sessionId, sessionId));
      expect((await validateAccidentSession(sessionId)).ok).toBe(false);
    } finally {
      await db.delete(accessCodeUsageTable).where(eq(accessCodeUsageTable.accessCodeId, code!.id));
      await db.delete(accessCodesTable).where(eq(accessCodesTable.id, code!.id));
    }
  });

  it("corp: sessions idle past the TTL are rejected by requireSession and freed at the next login", async () => {
    const { SEAT_TTL_MS } = await import("./seatLimits");
    const CORP_TTL_CODE = `SEATT-${RUN_ID.slice(5, 10)}`.toUpperCase();
    const [code] = await db
      .insert(corpAccessCodes)
      .values({ code: CORP_TTL_CODE, label: `seat-ttl-test-${RUN_ID}`, maxSeats: 1 })
      .returning();
    try {
      const token = await allocateCorpSession({
        accessCodeId: code!.id,
        maxSeats: 1,
        deviceInfo: "idle-device",
      });
      await db
        .update(corpSessions)
        .set({ lastSeenAt: new Date(Date.now() - SEAT_TTL_MS - 60_000) })
        .where(eq(corpSessions.sessionToken, token));

      const app = express();
      app.get("/protected", (req, res, next) => void requireSession(req, res, next), (_req, res) =>
        res.json({ ok: true }),
      );
      const r = await request(app).get("/protected").set("Authorization", `Bearer ${token}`);
      expect(r.status).toBe(401);
      const [row] = await db
        .select()
        .from(corpSessions)
        .where(eq(corpSessions.sessionToken, token));
      expect(row!.isActive).toBe(false);

      // A new login also sweeps idle sessions before deciding capacity.
      const token2 = await allocateCorpSession({
        accessCodeId: code!.id,
        maxSeats: 1,
        deviceInfo: "fresh-device",
      });
      expect(token2).toBeTruthy();
    } finally {
      await db.delete(corpSessions).where(eq(corpSessions.accessCodeId, code!.id));
      await db.delete(corpAccessCodes).where(eq(corpAccessCodes.id, code!.id));
    }
  });

  it("acad: an Academic bundle propagates its cap and the N+1 concurrent session is rejected", async () => {
    const { syncPortalAccessCodes } = await import("./provisioning");
    const { usersTable: acadUsers } = await import("@workspace/db/acad");
    const { requireUser } = await import("../acad/lib/auth");
    const session = (await import("express-session")).default;
    const ACAD_CODE = `ACAD-SEATM-${RUN_ID.slice(0, 5).toUpperCase()}`;
    await syncPortalAccessCodes({
      accessCode: ACAD_CODE,
      name: `seat-test-${RUN_ID}`,
      email: null,
      apps: ["MyLawAcad"],
      licenses: 1,
    });
    const [user] = await db.select().from(acadUsers).where(eq(acadUsers.accessCode, ACAD_CODE));
    try {
      expect(user).toBeTruthy();
      expect(user!.maxSeats).toBe(1); // cap propagated from the bundle licenses

      const app = express();
      app.use(session({ secret: "test-secret", resave: false, saveUninitialized: false }));
      // Stub of the code-login outcome: binds the acad user to the session.
      app.post("/login", (req, res) => {
        req.session.acadUserId = user!.id;
        res.json({ ok: true });
      });
      app.get("/templates", requireUser(), (_req, res) => res.json({ ok: true }));

      const deviceA = request.agent(app);
      const deviceB = request.agent(app);
      await deviceA.post("/login").expect(200);
      expect((await deviceA.get("/templates")).status).toBe(200); // claims the only seat

      await deviceB.post("/login").expect(200);
      expect((await deviceB.get("/templates")).status).toBe(401); // N+1 rejected

      expect((await deviceA.get("/templates")).status).toBe(200); // holder keeps working
    } finally {
      await db.delete(portalCodeSeatsTable).where(eq(portalCodeSeatsTable.code, ACAD_CODE));
      const { usersTable: acadUsersCleanup } = await import("@workspace/db/acad");
      await db.delete(acadUsersCleanup).where(eq(acadUsersCleanup.accessCode, ACAD_CODE));
    }
  });

  it("corp: protected traffic refreshes lastSeenAt so a competing login evicts the idle session, not the active one", async () => {
    const [code] = await db
      .insert(corpAccessCodes)
      .values({ code: CORP_CODE, label: `seat-test-${RUN_ID}`, maxSeats: 2 })
      .returning();
    const activeToken = await allocateCorpSession({
      accessCodeId: code!.id,
      maxSeats: 2,
      deviceInfo: "active-device",
    });
    const idleToken = await allocateCorpSession({
      accessCodeId: code!.id,
      maxSeats: 2,
      deviceInfo: "idle-device",
    });
    // Make BOTH look old, then send real protected traffic from the active one.
    const old = new Date(Date.now() - 60 * 60 * 1000);
    await db
      .update(corpSessions)
      .set({ lastSeenAt: old })
      .where(eq(corpSessions.accessCodeId, code!.id));

    const app = express();
    app.get("/protected", (req, res, next) => void requireSession(req, res, next), (_req, res) =>
      res.json({ ok: true }),
    );
    const r = await request(app).get("/protected").set("Authorization", `Bearer ${activeToken}`);
    expect(r.status).toBe(200);

    // A third login must evict the idle session (LRU), keeping the active one.
    await allocateCorpSession({ accessCodeId: code!.id, maxSeats: 2, deviceInfo: "new-device" });
    const [activeRow] = await db
      .select()
      .from(corpSessions)
      .where(and(eq(corpSessions.sessionToken, activeToken)));
    const [idleRow] = await db
      .select()
      .from(corpSessions)
      .where(and(eq(corpSessions.sessionToken, idleToken)));
    expect(activeRow!.isActive).toBe(true);
    expect(idleRow!.isActive).toBe(false);
    const active = await db
      .select()
      .from(corpSessions)
      .where(and(eq(corpSessions.accessCodeId, code!.id), eq(corpSessions.isActive, true)));
    expect(active.length).toBe(2);
  });
});
