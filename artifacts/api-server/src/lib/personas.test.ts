import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { inArray } from "drizzle-orm";

const { buildPersonasRouter, ensureUserPersonasTable } = await import("./personas");
const { db, pool } = await import("@workspace/db");
const { litAccessCodes } = await import("@workspace/db/schema");

const app = express();
app.use(express.json());
app.use("/api/personas", buildPersonasRouter());

const RUN_ID = `persona-${Date.now()}`;
const CODE = `TEST-${RUN_ID}`.toUpperCase();
const EXPIRED_CODE = `TEST-${RUN_ID}-EXP`.toUpperCase();
const REVOKED_CODE = `TEST-${RUN_ID}-REV`.toUpperCase();
const createdCodeIds: number[] = [];

beforeAll(async () => {
  await ensureUserPersonasTable();
  const rows = await db
    .insert(litAccessCodes)
    .values([
      { code: CODE, recipientName: `Persona ${RUN_ID}`, recipientEmail: "", status: "active" },
      {
        code: EXPIRED_CODE,
        recipientName: `Persona ${RUN_ID} expired`,
        recipientEmail: "",
        status: "active",
        expiresAt: new Date(Date.now() - 24 * 3600 * 1000),
      },
      {
        code: REVOKED_CODE,
        recipientName: `Persona ${RUN_ID} revoked`,
        recipientEmail: "",
        status: "revoked",
      },
    ])
    .returning();
  createdCodeIds.push(...rows.map((r) => r.id));
});

afterAll(async () => {
  await pool.query(`DELETE FROM user_personas WHERE owner_key = $1`, [CODE]);
  if (createdCodeIds.length) {
    await db.delete(litAccessCodes).where(inArray(litAccessCodes.id, createdCodeIds));
  }
});

describe("personas API", () => {
  it("404s lookup and save for unknown codes", async () => {
    const lookup = await request(app)
      .post("/api/personas/lookup")
      .send({ code: `NOPE-${RUN_ID}` });
    expect(lookup.status).toBe(404);
    const save = await request(app)
      .put("/api/personas")
      .send({ code: `NOPE-${RUN_ID}`, primaryRole: "practitioner" });
    expect(save.status).toBe(404);
  });

  it("rejects expired and revoked codes (expiry re-checked per request)", async () => {
    for (const bad of [EXPIRED_CODE, REVOKED_CODE]) {
      const lookup = await request(app).post("/api/personas/lookup").send({ code: bad });
      expect(lookup.status).toBe(404);
      const save = await request(app)
        .put("/api/personas")
        .send({ code: bad, primaryRole: "practitioner" });
      expect(save.status).toBe(404);
    }
  });

  it("rejects invalid roles", async () => {
    const res = await request(app)
      .put("/api/personas")
      .send({ code: CODE, primaryRole: "hacker" });
    expect(res.status).toBe(400);
  });

  it("returns null persona before onboarding, then round-trips a save", async () => {
    const before = await request(app).post("/api/personas/lookup").send({ code: CODE });
    expect(before.status).toBe(200);
    expect(before.body.persona).toBeNull();

    const save = await request(app).put("/api/personas").send({
      code: CODE.toLowerCase(), // case-insensitive
      primaryRole: "practitioner",
      roles: ["academic"],
      onboarding: { source: "test" },
    });
    expect(save.status).toBe(200);
    expect(save.body.persona.primaryRole).toBe("practitioner");
    expect(save.body.persona.roles).toEqual(
      expect.arrayContaining(["practitioner", "academic"]),
    );

    const after = await request(app).post("/api/personas/lookup").send({ code: CODE });
    expect(after.body.persona.primaryRole).toBe("practitioner");
    expect(after.body.persona.onboarding).toMatchObject({ source: "test" });

    // Switching primary role updates, merges onboarding
    const switched = await request(app).put("/api/personas").send({
      code: CODE,
      primaryRole: "academic",
      onboarding: { switched: true },
    });
    expect(switched.body.persona.primaryRole).toBe("academic");
    expect(switched.body.persona.onboarding).toMatchObject({ source: "test", switched: true });
  });

  it("rejects the master access code as an identity", async () => {
    const master = (process.env.MASTER_ACCESS_CODE ?? "").trim();
    if (!master) return; // nothing to test without the env var
    const res = await request(app)
      .post("/api/personas/lookup")
      .send({ code: master });
    expect(res.status).toBe(404);
  });
});
