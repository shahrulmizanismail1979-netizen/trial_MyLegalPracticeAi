import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, corpAccessCodes, corpSessions, microsoftLinks, subscribersTable } from "@workspace/db";
import { saveLink, signMsTicket } from "../microsoft";
import corpLegalRouter from "../corp/routes/legal";
import {
  createPortalSignInSignalObserver,
  resolveKnownSubscriber,
  updateSignInSignalState,
  type SignInSignalState,
} from "./portalSignInSignals";

describe("corporate portal sign-in outcome signals", () => {
  const suffix = `${Date.now()}`.slice(-10);
  const code = `SIG-${suffix}`.slice(0, 20);
  const ssoCode = `SSO-${suffix}`.slice(0, 20);
  const ssoEmail = `portal-signal-sso-${suffix}@example.test`;
  let subscriberId = 0;
  let ssoSubscriberId = 0;
  let codeId = 0;
  let ssoCodeId = 0;
  let state: SignInSignalState = { records: {} };
  const notices: string[] = [];
  let clock = Date.parse("2026-01-01T00:00:00Z");
  let pending = Promise.resolve();

  const app = express();
  app.use(express.json());
  app.use(createPortalSignInSignalObserver({
    enabled: true,
    onCodeOutcome: async (event) => {
      const work = pending.then(async () => {
        const id = await resolveKnownSubscriber(event.code, event.portal, new Date(clock));
        if (id == null) return;
        const result = updateSignInSignalState(
          state,
          { subscriberId: id, portal: event.portal, success: event.success },
          new Date(clock++),
        );
        state = result.state;
        notices.push(...result.notifications.map((notice) => notice.kind));
      });
      pending = work;
      await work;
    },
  }));
  app.use("/api/corp", corpLegalRouter);

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await pending;
  }

  beforeAll(async () => {
    const [subscriber] = await db.insert(subscribersTable).values({
      name: "Portal signal route test",
      email: `portal-signal-${suffix}@example.test`,
      phone: "not-collected",
      apps: ["MyCorpAI"],
      paymentStatus: "confirmed",
      paymentAmount: "25.00",
      accessCode: code,
    }).returning({ id: subscribersTable.id });
    subscriberId = subscriber.id;
    const [ssoSubscriber] = await db.insert(subscribersTable).values({
      name: "Portal signal SSO route test",
      email: ssoEmail,
      phone: "not-collected",
      apps: ["MyCorpAI"],
      paymentStatus: "confirmed",
      paymentAmount: "25.00",
      accessCode: ssoCode,
    }).returning({ id: subscribersTable.id });
    ssoSubscriberId = ssoSubscriber.id;
    const accesses = await db.insert(corpAccessCodes).values([
      { code, label: "Portal signal route test", isActive: false },
      { code: ssoCode, label: "Portal signal SSO route test", isActive: false },
    ]).returning({ id: corpAccessCodes.id, code: corpAccessCodes.code });
    codeId = accesses.find((row) => row.code === code)!.id;
    ssoCodeId = accesses.find((row) => row.code === ssoCode)!.id;
    const link = await saveLink(ssoEmail, "corp", ssoCode);
    expect(link.ok).toBe(true);
  });

  afterAll(async () => {
    await db.delete(microsoftLinks).where(eq(microsoftLinks.email, ssoEmail));
    for (const id of [codeId, ssoCodeId]) {
      if (!id) continue;
      await db.delete(corpSessions).where(eq(corpSessions.accessCodeId, id));
      await db.delete(corpAccessCodes).where(eq(corpAccessCodes.id, id));
    }
    for (const id of [subscriberId, ssoSubscriberId]) {
      if (id) await db.delete(subscribersTable).where(eq(subscribersTable.id, id));
    }
  });

  it("warns once for three HTTP-200 rejections, does not falsely recover, then recovers on genuine success", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const rejected = await request(app)
        .post("/api/corp/legal/verify-password")
        .send({ password: code });
      expect(rejected.status).toBe(200);
      expect(rejected.body.success).toBe(false);
      await settle();
    }
    expect(notices).toEqual(["warning"]);
    expect(state.records[`${subscriberId}:corp`]?.incidentOpen).toBe(true);

    const stillRejected = await request(app)
      .post("/api/corp/legal/verify-password")
      .send({ password: code });
    expect(stillRejected.status).toBe(200);
    expect(stillRejected.body.success).toBe(false);
    await settle();
    expect(notices).toEqual(["warning"]);
    expect(state.records[`${subscriberId}:corp`]?.incidentOpen).toBe(true);

    await db.update(corpAccessCodes)
      .set({ isActive: true })
      .where(eq(corpAccessCodes.id, codeId));
    const accepted = await request(app)
      .post("/api/corp/legal/verify-password")
      .send({ password: code });
    expect(accepted.status).toBe(200);
    expect(accepted.body.success).toBe(true);
    await settle();

    expect(notices).toEqual(["warning", "recovery-success"]);
    expect(state.records[`${subscriberId}:corp`]).toMatchObject({
      incidentOpen: false,
      recoveryNotified: true,
    });
  });

  it("attributes a validated ticket-only linked code, but never an invalid ticket", async () => {
    state = { records: {} };
    notices.length = 0;
    const ticket = signMsTicket(ssoEmail, "corp");

    const invalid = await request(app)
      .post("/api/corp/legal/sso")
      .send({ ticket: "not-a-valid-ticket" });
    expect(invalid.status).toBe(401);
    await settle();
    expect(state.records).toEqual({});

    for (let attempt = 0; attempt < 3; attempt++) {
      const rejected = await request(app)
        .post("/api/corp/legal/sso")
        .send({ ticket });
      expect(rejected.status).toBe(200);
      expect(rejected.body.success).toBe(false);
      await settle();
    }
    expect(notices).toEqual(["warning"]);
    expect(state.records[`${ssoSubscriberId}:corp`]?.incidentOpen).toBe(true);

    await db.update(corpAccessCodes)
      .set({ isActive: true })
      .where(eq(corpAccessCodes.id, ssoCodeId));
    const accepted = await request(app)
      .post("/api/corp/legal/sso")
      .send({ ticket });
    expect(accepted.status).toBe(200);
    expect(accepted.body.success).toBe(true);
    await settle();
    expect(notices).toEqual(["warning", "recovery-success"]);
  });
});