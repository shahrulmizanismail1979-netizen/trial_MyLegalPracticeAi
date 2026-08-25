/**
 * Durable evidence for the first real official-court-source publication.
 *
 * This test is intentionally read-only. It verifies the actual court PDF that
 * completed the production-like research workflow rather than fabricating a
 * pre-approved judgment: extraction persisted the citation and its provenance,
 * a reviewer accepted headnotes, and portal case search exposes that citation.
 */
import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  researchCaseMetadata,
  researchHeadnotes,
  researchSourceContainers,
  researchVerifiedJudgments,
} from "@workspace/db";
import casesRouter from "./cases";
import type { PortalAuthIdentity } from "../middlewares/requireAnyPortalAuth";

const REAL_CONTAINER_ID = 145851;
const REAL_JUDGMENT_ID = 18785;
const REAL_CITATION = "[2004] 4 MLJ 118";

function portalApp(identity: PortalAuthIdentity) {
  const app = express();
  app.use((req, _res, next) => {
    req.portalAuth = identity;
    next();
  });
  app.use("/api/cases", casesRouter);
  return app;
}

describe("real official court-source judgment pipeline", () => {
  it("persists live extracted citation provenance and returns the citation to portal search", async () => {
    const [[container], [judgment], [citation], acceptedHeadnotes] = await Promise.all([
      db
        .select({
          id: researchSourceContainers.id,
          originalName: researchSourceContainers.originalName,
          rightsStatus: researchSourceContainers.rightsStatus,
          processingState: researchSourceContainers.processingState,
        })
        .from(researchSourceContainers)
        .where(eq(researchSourceContainers.id, REAL_CONTAINER_ID))
        .limit(1),
      db
        .select({
          id: researchVerifiedJudgments.id,
          containerId: researchVerifiedJudgments.containerId,
        })
        .from(researchVerifiedJudgments)
        .where(eq(researchVerifiedJudgments.id, REAL_JUDGMENT_ID))
        .limit(1),
      db
        .select({
          value: researchCaseMetadata.value,
          sourcePageId: researchCaseMetadata.sourcePageId,
          sourceCharStart: researchCaseMetadata.sourceCharStart,
          sourceCharEnd: researchCaseMetadata.sourceCharEnd,
          method: researchCaseMetadata.method,
          processorVersion: researchCaseMetadata.processorVersion,
        })
        .from(researchCaseMetadata)
        .where(
          and(
            eq(researchCaseMetadata.judgmentId, REAL_JUDGMENT_ID),
            eq(researchCaseMetadata.fieldName, "reportCitation"),
          ),
        )
        .orderBy(desc(researchCaseMetadata.id))
        .limit(1),
      db
        .select({ id: researchHeadnotes.id })
        .from(researchHeadnotes)
        .where(
          and(
            eq(researchHeadnotes.judgmentId, REAL_JUDGMENT_ID),
            eq(researchHeadnotes.status, "accepted"),
          ),
        ),
    ]);

    expect(container).toMatchObject({
      id: REAL_CONTAINER_ID,
      rightsStatus: "OFFICIAL_COURT_SOURCE",
      processingState: "SEARCHABLE",
    });
    expect(container?.originalName).toContain("TAN KIM HOR");
    expect(judgment).toEqual({ id: REAL_JUDGMENT_ID, containerId: REAL_CONTAINER_ID });
    expect(citation).toMatchObject({
      value: REAL_CITATION,
      method: "regex",
      processorVersion: "metadata_extract@2",
    });
    expect(citation?.sourcePageId).toBeTypeOf("number");
    expect(citation?.sourceCharStart).toBeGreaterThanOrEqual(0);
    expect(citation?.sourceCharEnd).toBeGreaterThan(citation!.sourceCharStart!);
    expect(acceptedHeadnotes.length).toBeGreaterThan(0);

    const app = portalApp({ type: "master", identityKey: "master" });
    const search = await request(app)
      .get("/api/cases/search")
      .query({ q: "Tan Kim Hor", limit: 50 });

    expect(search.status).toBe(200);
    expect(search.body.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: REAL_JUDGMENT_ID,
          citation: REAL_CITATION,
          caseName: "TAN KIM HOR & ORS v TAN HENG CHEW & ORS",
        }),
      ]),
    );

    const detail = await request(app).get(`/api/cases/${REAL_JUDGMENT_ID}`);
    expect(detail.status).toBe(200);
    expect(detail.body).toMatchObject({
      id: REAL_JUDGMENT_ID,
      citation: REAL_CITATION,
    });
    expect(detail.body.headnotes.length).toBeGreaterThan(0);
  });
});