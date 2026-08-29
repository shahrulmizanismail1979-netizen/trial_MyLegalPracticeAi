import { describe, it, expect, afterAll, vi } from "vitest";

// Resend tests must never send real email — mock the Gmail mailer.
const sendEmailMock = vi.fn(
  async (_options: { to: string; subject: string; html: string }) => true,
);
vi.mock("../../lib/mailer", () => ({
  sendEmail: (options: { to: string; subject: string; html: string }) => sendEmailMock(options),
  getOwnerEmail: async () => null,
}));
// Resend-SMS tests must never hit Twilio — mock sendSms, keep the real body template.
const sendSmsMock = vi.fn(
  async (_to: string, _body: string): Promise<"sent" | "failed" | "not_configured"> => "sent",
);
vi.mock("../../lib/sms", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/sms")>();
  return { ...actual, sendSms: (to: string, body: string) => sendSmsMock(to, body) };
});
import express from "express";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { db, activityTable } from "@workspace/db";
import dashboardRouter from "./dashboard";

const RUN_ID = randomUUID();

// Mount the dashboard router directly (auth middleware is applied at mount
// time in routes/index.ts; the endpoints under test don't depend on it).
const app = express();
app.use(express.json());
app.use("/admin", dashboardRouter);

afterAll(async () => {
  await db.delete(activityTable).where(like(activityTable.description, `%${RUN_ID}%`));
});

describe("admin delivery-failures", () => {
  it("lists delivery failures with parsed metadata and supports resolving", async () => {
    const email = `buyer-${RUN_ID}@example.test`;
    const [smsRow] = await db
      .insert(activityTable)
      .values({
        type: "sms_failed",
        description: `FAILED to SMS access code MLPA-TEST1 to +60123456789 — code was emailed to ${email} instead [${RUN_ID}]`,
        metadata: JSON.stringify({ accessCode: "MLPA-TEST1", email, phone: "+60123456789" }),
      })
      .returning();

    // Legacy row without metadata — fields must be recovered from description.
    const [legacyRow] = await db
      .insert(activityTable)
      .values({
        type: "email_failed",
        description: `FAILED to email access code MLPA-TEST2 to ${email} — send manually [${RUN_ID}]`,
      })
      .returning();

    const list = await request(app).get("/admin/delivery-failures");
    expect(list.status).toBe(200);
    const mine = list.body.filter((f: { description: string }) => f.description.includes(RUN_ID));
    expect(mine).toHaveLength(2);

    const sms = mine.find((f: { id: number }) => f.id === smsRow.id);
    expect(sms).toMatchObject({
      type: "sms_failed",
      accessCode: "MLPA-TEST1",
      email,
      phone: "+60123456789",
      resolved: false,
    });

    const legacy = mine.find((f: { id: number }) => f.id === legacyRow.id);
    expect(legacy).toMatchObject({
      type: "email_failed",
      accessCode: "MLPA-TEST2",
      email,
      resolved: false,
    });

    // Resolve the SMS failure.
    const resolved = await request(app).post(`/admin/delivery-failures/${smsRow.id}/resolve`);
    expect(resolved.status).toBe(200);
    expect(resolved.body.resolved).toBe(true);
    expect(resolved.body.resolvedAt).toBeTruthy();

    // Resolved entries are hidden by default…
    const after = await request(app).get("/admin/delivery-failures");
    const afterMine = after.body.filter((f: { description: string }) => f.description.includes(RUN_ID));
    expect(afterMine.map((f: { id: number }) => f.id)).toEqual([legacyRow.id]);

    // …and also hidden when the client explicitly sends includeResolved=false
    // (the generated client serializes the boolean as the string "false").
    const explicitFalse = await request(app).get("/admin/delivery-failures?includeResolved=false");
    const explicitFalseMine = explicitFalse.body.filter((f: { description: string }) =>
      f.description.includes(RUN_ID),
    );
    expect(explicitFalseMine.map((f: { id: number }) => f.id)).toEqual([legacyRow.id]);

    // …but visible with includeResolved=true.
    const all = await request(app).get("/admin/delivery-failures?includeResolved=true");
    const allMine = all.body.filter((f: { description: string }) => f.description.includes(RUN_ID));
    expect(allMine).toHaveLength(2);
  });

  it("resends the access-code email and auto-marks the entry handled", async () => {
    const email = `resend-${RUN_ID}@example.test`;
    const [row] = await db
      .insert(activityTable)
      .values({
        type: "email_failed",
        description: `FAILED to email access code MLPA-RESEND1 to ${email} — send manually [${RUN_ID}]`,
        metadata: JSON.stringify({ accessCode: "MLPA-RESEND1", email, phone: null }),
      })
      .returning();

    sendEmailMock.mockClear();
    sendEmailMock.mockResolvedValueOnce(true);
    const res = await request(app).post(`/admin/delivery-failures/${row.id}/resend-email`);
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(true);
    expect(res.body.resolvedAt).toBeTruthy();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0]![0] as unknown as {
      to: string;
      subject: string;
      html: string;
    };
    expect(call.to).toBe(email);
    expect(call.subject).toContain("access code");
    expect(call.html).toContain("MLPA-RESEND1");
  });

  it("surfaces a send failure as 502 and does not mark the entry handled", async () => {
    const email = `resend-fail-${RUN_ID}@example.test`;
    const [row] = await db
      .insert(activityTable)
      .values({
        type: "email_failed",
        description: `FAILED to email access code MLPA-RESEND2 to ${email} — send manually [${RUN_ID}]`,
        metadata: JSON.stringify({ accessCode: "MLPA-RESEND2", email, phone: null }),
      })
      .returning();

    sendEmailMock.mockResolvedValueOnce(false);
    const res = await request(app).post(`/admin/delivery-failures/${row.id}/resend-email`);
    expect(res.status).toBe(502);
    expect(res.body.error).toBeTruthy();

    const list = await request(app).get("/admin/delivery-failures");
    const mine = list.body.find((f: { id: number }) => f.id === row.id);
    expect(mine?.resolved).toBe(false);
  });

  it("422s when the entry lacks an email or access code", async () => {
    const [row] = await db
      .insert(activityTable)
      .values({
        type: "sms_failed",
        description: `FAILED to SMS access code (unknown) [${RUN_ID}]`,
        metadata: JSON.stringify({ accessCode: null, email: null, phone: "+60111111111" }),
      })
      .returning();
    const res = await request(app).post(`/admin/delivery-failures/${row.id}/resend-email`);
    expect(res.status).toBe(422);
  });

  it("resends the access-code SMS and auto-marks the entry handled", async () => {
    const email = `sms-resend-${RUN_ID}@example.test`;
    const phone = "+60129998877";
    const [row] = await db
      .insert(activityTable)
      .values({
        type: "sms_failed",
        description: `FAILED to SMS access code MLPA-SMS1 to ${phone} — code was emailed to ${email} instead [${RUN_ID}]`,
        metadata: JSON.stringify({ accessCode: "MLPA-SMS1", email, phone }),
      })
      .returning();

    sendSmsMock.mockClear();
    sendSmsMock.mockResolvedValueOnce("sent");
    const res = await request(app).post(`/admin/delivery-failures/${row.id}/resend-sms`);
    expect(res.status).toBe(200);
    expect(res.body.resolved).toBe(true);
    expect(res.body.resolvedAt).toBeTruthy();
    expect(sendSmsMock).toHaveBeenCalledTimes(1);
    const [to, body] = sendSmsMock.mock.calls[0]!;
    expect(to).toBe(phone);
    expect(body).toContain("MLPA-SMS1");
  });

  it("surfaces an SMS send failure as 502 and Twilio-not-configured as 422, without marking handled", async () => {
    const phone = "+60127776655";
    const [row] = await db
      .insert(activityTable)
      .values({
        type: "sms_failed",
        description: `FAILED to SMS access code MLPA-SMS2 to ${phone} [${RUN_ID}]`,
        metadata: JSON.stringify({ accessCode: "MLPA-SMS2", email: null, phone }),
      })
      .returning();

    sendSmsMock.mockResolvedValueOnce("failed");
    const failRes = await request(app).post(`/admin/delivery-failures/${row.id}/resend-sms`);
    expect(failRes.status).toBe(502);
    expect(failRes.body.error).toBeTruthy();

    sendSmsMock.mockResolvedValueOnce("not_configured");
    const notConfigured = await request(app).post(`/admin/delivery-failures/${row.id}/resend-sms`);
    expect(notConfigured.status).toBe(422);
    expect(notConfigured.body.error).toContain("not configured");

    const list = await request(app).get("/admin/delivery-failures");
    const mine = list.body.find((f: { id: number }) => f.id === row.id);
    expect(mine?.resolved).toBe(false);
  });

  it("422s on resend-sms when the entry lacks a phone or access code", async () => {
    const [row] = await db
      .insert(activityTable)
      .values({
        type: "sms_skipped",
        description: `SMS not configured — access code MLPA-SMS3 [${RUN_ID}]`,
        metadata: JSON.stringify({ accessCode: "MLPA-SMS3", email: `x-${RUN_ID}@example.test`, phone: null }),
      })
      .returning();
    sendSmsMock.mockClear();
    const res = await request(app).post(`/admin/delivery-failures/${row.id}/resend-sms`);
    expect(res.status).toBe(422);
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("404s when resolving a non-failure or missing row", async () => {
    const [other] = await db
      .insert(activityTable)
      .values({
        type: "subscriber_added",
        description: `Some other activity [${RUN_ID}]`,
      })
      .returning();
    const res = await request(app).post(`/admin/delivery-failures/${other.id}/resolve`);
    expect(res.status).toBe(404);
    const missing = await request(app).post(`/admin/delivery-failures/999999999/resolve`);
    expect(missing.status).toBe(404);
    await db.delete(activityTable).where(eq(activityTable.id, other.id));
  });
});
