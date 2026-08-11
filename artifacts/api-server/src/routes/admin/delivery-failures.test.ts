import { describe, it, expect, afterAll } from "vitest";
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
