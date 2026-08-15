/**
 * Practice-area scoping for /api/cases.
 *
 * Verifies that:
 *  1. A scoped portal identity (e.g. crim) only receives its own practice
 *     area's cases from /search — even when tampering with ?practiceArea=.
 *  2. Untagged (NULL practice_area) cases are invisible to scoped portals.
 *  3. Unrestricted identities (master) see everything and may filter voluntarily.
 *  4. /:id detail 404s for cases outside a scoped portal's area.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID, createHash } from "node:crypto";
import express from "express";
import request from "supertest";
import {
  db,
  researchSourceContainers,
  researchCaseCandidates,
  researchVerifiedJudgments,
  researchHeadnotes,
  researchSearchIndex,
} from "@workspace/db";
import { inArray } from "drizzle-orm";
import casesRouter from "./cases";
import type { PortalAuthIdentity } from "../middlewares/requireAnyPortalAuth";
import { indexJudgment } from "../research/search/postgresFtsAdapter";

const RUN_ID = randomUUID();
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const trackedContainerIds: number[] = [];
const trackedJudgmentIds: number[] = [];

function buildApp(identity: PortalAuthIdentity) {
  const app = express();
  app.use((req, _res, next) => {
    req.portalAuth = identity;
    next();
  });
  app.use("/api/cases", casesRouter);
  return app;
}

async function seedCase(practiceArea: string | null): Promise<number> {
  const text = `Practice-area fixture ${RUN_ID} ${practiceArea ?? "untagged"} zebraquark${RUN_ID.slice(0, 8)}`;
  const [container] = await db
    .insert(researchSourceContainers)
    .values({
      originalName: `pa-fixture-${RUN_ID}-${practiceArea ?? "null"}.txt`,
      sourceBatch: `pa-test-${RUN_ID}`,
      contentSha256: sha256(text + Math.random()),
      sizeBytes: text.length,
      mimeType: "text/plain",
      rightsStatus: "OFFICIAL_COURT_SOURCE",
      processingState: "SEARCHABLE",
      provenance: { enteredVia: `pa-test-${RUN_ID}` },
    })
    .returning({ id: researchSourceContainers.id });
  trackedContainerIds.push(container!.id);

  const [candidate] = await db
    .insert(researchCaseCandidates)
    .values({ containerId: container!.id })
    .returning({ id: researchCaseCandidates.id });

  const [judgment] = await db
    .insert(researchVerifiedJudgments)
    .values({
      candidateId: candidate!.id,
      containerId: container!.id,
      pageRefs: [],
      paragraphIdentifiers: [],
      textChecksum: sha256(text),
      verifiedBy: `pa-test-${RUN_ID}`,
    })
    .returning({ id: researchVerifiedJudgments.id });
  trackedJudgmentIds.push(judgment!.id);

  await db.insert(researchHeadnotes).values({
    judgmentId: judgment!.id,
    number: 1,
    text: `Fixture headnote ${RUN_ID}`,
    status: "accepted",
  });

  await indexJudgment({
    judgmentId: judgment!.id,
    containerId: container!.id,
    documentText: text,
    processorVersion: `pa-test-${RUN_ID}`,
    practiceArea,
  });

  return judgment!.id;
}

let criminalId = 0;
let bankingId = 0;
let untaggedId = 0;

beforeAll(async () => {
  criminalId = await seedCase("criminal");
  bankingId = await seedCase("banking");
  untaggedId = await seedCase(null);
});

afterAll(async () => {
  if (trackedJudgmentIds.length > 0) {
    await db.delete(researchSearchIndex).where(inArray(researchSearchIndex.judgmentId, trackedJudgmentIds));
    await db.delete(researchHeadnotes).where(inArray(researchHeadnotes.judgmentId, trackedJudgmentIds));
    await db.delete(researchVerifiedJudgments).where(inArray(researchVerifiedJudgments.id, trackedJudgmentIds));
  }
  if (trackedContainerIds.length > 0) {
    await db.delete(researchCaseCandidates).where(inArray(researchCaseCandidates.containerId, trackedContainerIds));
    await db.delete(researchSourceContainers).where(inArray(researchSourceContainers.id, trackedContainerIds));
  }
});

const crimApp = () => buildApp({ type: "crim", identityKey: `crim-${RUN_ID}` });
const conveyApp = () => buildApp({ type: "convey", identityKey: `convey-${RUN_ID}` });
const syaApp = () => buildApp({ type: "sya", identityKey: `sya-${RUN_ID}` });
const masterApp = () => buildApp({ type: "master", identityKey: "master" });

describe("practice-area scoping on /api/cases", () => {
  it("crim portal browse only returns criminal cases", async () => {
    const res = await request(crimApp()).get("/api/cases/search?limit=50");
    expect(res.status).toBe(200);
    const ids = res.body.results.map((r: { id: number }) => r.id);
    expect(ids).toContain(criminalId);
    expect(ids).not.toContain(bankingId);
    expect(ids).not.toContain(untaggedId);
  });

  it("tampering with ?practiceArea cannot widen a scoped portal's results", async () => {
    const res = await request(crimApp()).get("/api/cases/search?practiceArea=banking&limit=50");
    expect(res.status).toBe(200);
    const ids = res.body.results.map((r: { id: number }) => r.id);
    expect(ids).toContain(criminalId);
    expect(ids).not.toContain(bankingId);
  });

  it("FTS path is also scoped for tampered params", async () => {
    const res = await request(crimApp()).get(
      `/api/cases/search?q=zebraquark${RUN_ID.slice(0, 8)}&practiceArea=banking&limit=50`,
    );
    expect(res.status).toBe(200);
    const ids = res.body.results.map((r: { id: number }) => r.id);
    expect(ids).not.toContain(bankingId);
    expect(ids).not.toContain(untaggedId);
  });

  it("master sees all areas and may filter voluntarily", async () => {
    const all = await request(masterApp()).get("/api/cases/search?limit=50");
    expect(all.status).toBe(200);
    const allIds = all.body.results.map((r: { id: number }) => r.id);
    expect(allIds).toEqual(expect.arrayContaining([criminalId, bankingId, untaggedId]));

    const filtered = await request(masterApp()).get("/api/cases/search?practiceArea=banking&limit=50");
    const filteredIds = filtered.body.results.map((r: { id: number }) => r.id);
    expect(filteredIds).toContain(bankingId);
    expect(filteredIds).not.toContain(criminalId);
  });

  it("convey and sya portals are locked to their own (currently empty) areas even when tampering", async () => {
    for (const app of [conveyApp(), syaApp()]) {
      const res = await request(app).get("/api/cases/search?practiceArea=banking&limit=50");
      expect(res.status).toBe(200);
      const ids = res.body.results.map((r: { id: number }) => r.id);
      expect(ids).not.toContain(bankingId);
      expect(ids).not.toContain(criminalId);
      expect(ids).not.toContain(untaggedId);
    }
  });

  it("convey and sya detail routes deny cross-area and untagged cases", async () => {
    for (const app of [conveyApp(), syaApp()]) {
      expect((await request(app).get(`/api/cases/${bankingId}`)).status).toBe(404);
      expect((await request(app).get(`/api/cases/${untaggedId}`)).status).toBe(404);
    }
  });

  it("detail route 404s for another area's case and for untagged cases", async () => {
    expect((await request(crimApp()).get(`/api/cases/${bankingId}`)).status).toBe(404);
    expect((await request(crimApp()).get(`/api/cases/${untaggedId}`)).status).toBe(404);
    expect((await request(crimApp()).get(`/api/cases/${criminalId}`)).status).toBe(200);
    expect((await request(masterApp()).get(`/api/cases/${bankingId}`)).status).toBe(200);
  });
});
