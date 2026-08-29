/**
 * Accepted reporter summaries must be part of the portal-search document.
 * This follows the real editorial path: accept drafts in Research Admin,
 * process the resulting re-index job, then search through the portal API.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import {
  db,
  researchCaseCandidates,
  researchCatchwords,
  researchHeadnotes,
  researchJobs,
  researchLawyesReports,
  researchRightsRecords,
  researchSearchIndex,
  researchSourceContainers,
  researchVerifiedJudgments,
} from "@workspace/db";
import { desc, eq, like, or } from "drizzle-orm";
import type { PortalAuthIdentity } from "../middlewares/requireAnyPortalAuth";
import casesRouter from "./cases";
import { registerSearchIndexProcessor, SEARCH_INDEX_JOB_KIND } from "../research/search/searchIndexProcessor";
import { runNextJob } from "../research/processing";

const RUN_ID = randomUUID();
const TEST_PASSWORD = "headnotes-search-test-password";
const TEST_COOKIE_SECRET = "headnotes-search-test-cookie-secret";
const catchwordTerm = `remoteness${RUN_ID.replace(/-/g, "").slice(0, 12)}`;
const revisedCatchwordTerm = `revisedremoteness${RUN_ID.replace(/-/g, "").slice(0, 12)}`;
const headnoteTerm = `holding${RUN_ID.replace(/-/g, "").slice(0, 12)}`;
const revisedHeadnoteTerm = `revisedholding${RUN_ID.replace(/-/g, "").slice(0, 12)}`;

process.env.ADMIN_PASSWORD = TEST_PASSWORD;
const { default: researchAdminRouter } = await import("./research-admin");

let containerId = 0;
let judgmentId = 0;

function adminApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser(TEST_COOKIE_SECRET));
  app.use("/api/research-admin", researchAdminRouter);
  return app;
}

function portalApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.portalAuth = {
      type: "master",
      identityKey: `headnotes-search-test-${RUN_ID}`,
    } satisfies PortalAuthIdentity;
    next();
  });
  app.use("/api/cases", casesRouter);
  return app;
}

async function driveAcceptedContentReindex(key: string): Promise<void> {
  const terminal = new Set([
    "SUCCEEDED",
    "FAILED_PERMANENT",
    "CANCELLED",
    "BLOCKED_BY_RIGHTS",
    "REVIEW_REQUIRED",
  ]);

  for (let attempt = 0; attempt < 60; attempt++) {
    const [job] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, key));

    if (job && terminal.has(job.state)) {
      expect(job.state).toBe("SUCCEEDED");
      return;
    }

    await runNextJob(SEARCH_INDEX_JOB_KIND);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for accepted-content reindex job ${key}`);
}

async function latestAcceptedContentReindexJob() {
  const [job] = await db
    .select()
    .from(researchJobs)
    .where(
      like(
        researchJobs.idempotencyKey,
        `${SEARCH_INDEX_JOB_KIND}:accepted-content:${judgmentId}:%`,
      ),
    )
    .orderBy(desc(researchJobs.id))
    .limit(1);
  expect(job).toBeDefined();
  return job!;
}

async function portalSearchIds(query: string): Promise<number[]> {
  const response = await request(portalApp())
    .get(`/api/cases/search?q=${encodeURIComponent(query)}`)
    .expect(200);
  return response.body.results.map((row: { id: number }) => row.id);
}

beforeAll(async () => {
  registerSearchIndexProcessor();

  const sourceText = `Judicial reasons fixture ${RUN_ID}; the judgment itself does not use the catchword term.`;
  const [container] = await db
    .insert(researchSourceContainers)
    .values({
      originalName: `headnotes-search-${RUN_ID}.txt`,
      sourceBatch: `headnotes-search-${RUN_ID}`,
      contentSha256: createHash("sha256").update(sourceText).digest("hex"),
      sizeBytes: sourceText.length,
      mimeType: "text/plain",
      rightsStatus: "OFFICIAL_COURT_SOURCE",
      processingState: "SEARCHABLE",
      provenance: { enteredVia: "headnotes-search-test" },
    })
    .returning({ id: researchSourceContainers.id });
  containerId = container!.id;
  const [rights] = await db
    .insert(researchRightsRecords)
    .values({
      containerId,
      status: "OFFICIAL_COURT_SOURCE",
      decidedBy: "headnotes-search-test",
      reason: "Published-search fixture",
      storagePermitted: true,
      analysisPermitted: true,
      studentAccessPermitted: true,
    })
    .returning({ id: researchRightsRecords.id });

  const [candidate] = await db
    .insert(researchCaseCandidates)
    .values({ containerId })
    .returning({ id: researchCaseCandidates.id });

  const [judgment] = await db
    .insert(researchVerifiedJudgments)
    .values({
      candidateId: candidate!.id,
      containerId,
      pageRefs: [],
      paragraphIdentifiers: [],
      textChecksum: createHash("sha256").update(sourceText).digest("hex"),
      verifiedBy: "headnotes-search-test",
    })
    .returning({ id: researchVerifiedJudgments.id });
  judgmentId = judgment!.id;

  const publishedAt = new Date();
  await db.insert(researchLawyesReports).values({
    judgmentId,
    state: "Published",
    title: `Headnotes search report ${RUN_ID}`,
    sourceUrl: `https://example.invalid/headnotes/${judgmentId}`,
    sourceVerifiedAt: publishedAt,
    sourceRightsRecordId: rights!.id,
    lawyerReviewedAt: publishedAt,
    publishedAt,
    createdBy: "headnotes-search-test",
  });

  await db.insert(researchHeadnotes).values({
    judgmentId,
    number: 1,
    text: `Held: the ${headnoteTerm} issue was resolved.`,
    status: "ai_draft",
  });
  await db.insert(researchCatchwords).values({
    judgmentId,
    sortOrder: 0,
    catchwordLine: `Contract — Damages — ${catchwordTerm}`,
    status: "ai_draft",
  });
});

afterAll(async () => {
  if (!judgmentId) return;

  // The search processor intentionally queues headnote generation without
  // awaiting it. Give that enqueue a turn to commit before removing all jobs
  // associated with this synthetic judgment.
  await new Promise((resolve) => setTimeout(resolve, 50));
  await db
    .delete(researchJobs)
    .where(
      or(
        like(
          researchJobs.idempotencyKey,
          `${SEARCH_INDEX_JOB_KIND}:accepted-content:${judgmentId}:%`,
        ),
        like(researchJobs.idempotencyKey, `container.headnotes:judgment:${judgmentId}:%`),
      ),
    );
  await db.delete(researchSearchIndex).where(eq(researchSearchIndex.judgmentId, judgmentId));
  await db.delete(researchHeadnotes).where(eq(researchHeadnotes.judgmentId, judgmentId));
  await db.delete(researchCatchwords).where(eq(researchCatchwords.judgmentId, judgmentId));
  await db.delete(researchLawyesReports).where(eq(researchLawyesReports.judgmentId, judgmentId));
  await db.delete(researchVerifiedJudgments).where(eq(researchVerifiedJudgments.id, judgmentId));
  await db.delete(researchRightsRecords).where(eq(researchRightsRecords.containerId, containerId));
  await db.delete(researchCaseCandidates).where(eq(researchCaseCandidates.containerId, containerId));
  await db.delete(researchSourceContainers).where(eq(researchSourceContainers.id, containerId));
});

describe("accepted headnotes and catchwords in portal search", () => {
  it("adds, refreshes, and removes accepted editorial terms from portal search", async () => {
    const admin = request.agent(adminApp());
    await admin
      .post("/api/research-admin/auth/login")
      .send({ password: TEST_PASSWORD })
      .expect(200);

    const accepted = await admin
      .post(`/api/research-admin/headnotes/${judgmentId}/accept-all`)
      .expect(200);
    // Accept-all reports whether this acceptance performed the one-way
    // VERIFIED → SEARCHABLE transition. This fixture starts SEARCHABLE, so it
    // deliberately confirms the stable response contract and the no-op value.
    expect(accepted.body).toEqual({
      acceptedHeadnotes: 1,
      acceptedCatchwords: 1,
      promotedToSearchable: false,
    });

    await driveAcceptedContentReindex((await latestAcceptedContentReindexJob()).idempotencyKey);

    const [index] = await db
      .select({ documentText: researchSearchIndex.documentText })
      .from(researchSearchIndex)
      .where(eq(researchSearchIndex.judgmentId, judgmentId));
    expect(index!.documentText).toContain("ACCEPTED HEADNOTES:");
    expect(index!.documentText).toContain(catchwordTerm);

    expect(await portalSearchIds(catchwordTerm)).toContain(judgmentId);

    const [acceptedHeadnote] = await db
      .select()
      .from(researchHeadnotes)
      .where(eq(researchHeadnotes.judgmentId, judgmentId));
    await admin
      .patch(`/api/research-admin/headnotes/${judgmentId}/headnotes/${acceptedHeadnote!.id}`)
      .send({ text: `Held: the ${revisedHeadnoteTerm} issue was resolved.` })
      .expect(200);
    await driveAcceptedContentReindex((await latestAcceptedContentReindexJob()).idempotencyKey);
    expect(await portalSearchIds(headnoteTerm)).not.toContain(judgmentId);
    expect(await portalSearchIds(revisedHeadnoteTerm)).toContain(judgmentId);

    const [acceptedCatchword] = await db
      .select()
      .from(researchCatchwords)
      .where(eq(researchCatchwords.judgmentId, judgmentId));
    await admin
      .patch(`/api/research-admin/headnotes/${judgmentId}/catchwords/${acceptedCatchword!.id}`)
      .send({ catchwordLine: `Contract — Damages — ${revisedCatchwordTerm}` })
      .expect(200);
    await driveAcceptedContentReindex((await latestAcceptedContentReindexJob()).idempotencyKey);
    expect(await portalSearchIds(catchwordTerm)).not.toContain(judgmentId);

    const revisedSearch = await request(portalApp())
      .get(`/api/cases/search?q=${encodeURIComponent(revisedCatchwordTerm)}`)
      .expect(200);
    const revisedResult = revisedSearch.body.results.find(
      (row: { id: number }) => row.id === judgmentId,
    );
    expect(revisedResult).toBeDefined();
    expect(revisedResult.snippet).toContain(revisedCatchwordTerm);

    await admin
      .patch(`/api/research-admin/headnotes/${judgmentId}/catchwords/${acceptedCatchword!.id}`)
      .send({ status: "rejected" })
      .expect(200);
    await driveAcceptedContentReindex((await latestAcceptedContentReindexJob()).idempotencyKey);
    expect(await portalSearchIds(revisedCatchwordTerm)).not.toContain(judgmentId);
  });
});