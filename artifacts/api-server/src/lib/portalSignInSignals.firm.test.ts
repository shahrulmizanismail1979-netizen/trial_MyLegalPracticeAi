import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, subscribersTable } from "@workspace/db";
import { firmAccessCodesTable } from "../firm/db";
import firmAuthRouter from "../firm/routes/auth";
import {
  createPortalSignInSignalObserver,
  resolveKnownSubscriber,
  updateSignInSignalState,
  type SignInSignalState,
} from "./portalSignInSignals";

describe("MyLawFirmAi staff-code sign-in signals", () => {
  const suffix = `${Date.now()}`.slice(-10);
  const code = `FIRM-SIGNAL-${suffix}`;
  let subscriberId = 0;
  let firmCodeId = 0;
  let state: SignInSignalState = { records: {} };
  const notices: string[] = [];
  let pending = Promise.resolve();
  let clock = Date.parse("2026-02-01T00:00:00Z");

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
  app.use("/api/firm", firmAuthRouter);

  async function settle(): Promise<void> {
    await new Promise<void>((resolve) => setImmediate(resolve));
    await pending;
  }

  beforeAll(async () => {
    const [subscriber] = await db.insert(subscribersTable).values({
      name: "Firm signal route test",
      email: `firm-signal-${suffix}@example.test`,
      phone: "not-collected",
      apps: ["MyLawFirmAi"],
      paymentStatus: "confirmed",
      paymentAmount: "75.00",
      accessCode: code,
    }).returning({ id: subscribersTable.id });
    subscriberId = subscriber.id;
    const [firmCode] = await db.insert(firmAccessCodesTable).values({
      code,
      label: "Firm signal route test",
      isActive: false,
    }).returning({ id: firmAccessCodesTable.id });
    firmCodeId = firmCode.id;
  });

  afterAll(async () => {
    if (firmCodeId) await db.delete(firmAccessCodesTable).where(eq(firmAccessCodesTable.id, firmCodeId));
    if (subscriberId) await db.delete(subscribersTable).where(eq(subscribersTable.id, subscriberId));
  });

  it("warns on subscriber staff-code failures and recovers after real staff login", async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const rejected = await request(app)
        .post("/api/firm/auth/staff")
        .send({ passcode: code });
      expect(rejected.status).toBe(401);
      await settle();
    }
    expect(notices).toEqual(["warning"]);
    expect(state.records[`${subscriberId}:firm`]?.incidentOpen).toBe(true);

    await db.update(firmAccessCodesTable)
      .set({ isActive: true })
      .where(eq(firmAccessCodesTable.id, firmCodeId));
    const accepted = await request(app)
      .post("/api/firm/auth/staff")
      .send({ passcode: code });
    expect(accepted.status).toBe(200);
    expect(accepted.body.staff).toBe(true);
    await settle();
    expect(notices).toEqual(["warning", "recovery-success"]);
  });
});