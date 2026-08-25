import { afterAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  researchAuditEvents,
  researchCaseCandidates,
  researchCatchwords,
  researchHeadnotes,
  researchSourceContainers,
  researchVerifiedJudgments,
} from "@workspace/db";
import researchAdminRouter from "./research-admin";

const RUN_ID = randomUUID();
const createdContainerIds: number[] = [];
const createdJudgmentIds: number[] = [];

function appWithAdminSession() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.signedCookies = { ra_auth: "1" };
    next();
  });
  app.use("/api/research-admin", researchAdminRouter);
  return app;
}

async function seedVerifiedOfficialJudgment() {
  const fixtureId = randomUUID();
  const text = `Official court-source approval fixture ${RUN_ID}:${fixtureId}`;
  const [container] = await db
    .insert(researchSourceContainers)
    .values({
      originalName: `official-court-source-${RUN_ID}-${fixtureId}.pdf`,
      sourceBatch: `research-admin-headnotes-${RUN_ID}-${fixtureId}`,
      contentSha256: createHash("sha256").update(text).digest("hex"),
      sizeBytes: text.length,
      mimeType: "application/pdf",
      rightsStatus: "OFFICIAL_COURT_SOURCE",
      processingState: "VERIFIED",
      provenance: { testRun: RUN_ID, source: "official-court-fixture" },
    })
    .returning({ id: researchSourceContainers.id });
  createdContainerIds.push(container!.id);

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
      textChecksum: createHash("sha256").update(`${text}:judgment`).digest("hex"),
      verifiedBy: `research-admin-test:${RUN_ID}`,
    })
    .returning({ id: researchVerifiedJudgments.id });
  createdJudgmentIds.push(judgment!.id);

  const [headnote] = await db
    .insert(researchHeadnotes)
    .values({
      judgmentId: judgment!.id,
      number: 1,
      text: "The official court-source fixture confirms a reviewed legal proposition.",
      status: "ai_draft",
    })
    .returning({ id: researchHeadnotes.id });

  await db.insert(researchCatchwords).values({
    judgmentId: judgment!.id,
    sortOrder: 1,
    catchwordLine: "Official court source — approval",
    status: "ai_draft",
  });

  return {
    containerId: container!.id,
    judgmentId: judgment!.id,
    headnoteId: headnote!.id,
  };
}

async function processingState(containerId: number) {
  const [container] = await db
    .select({ state: researchSourceContainers.processingState })
    .from(researchSourceContainers)
    .where(eq(researchSourceContainers.id, containerId));
  return container?.state;
}

afterAll(async () => {
  if (createdJudgmentIds.length > 0) {
    await db.delete(researchCatchwords).where(inArray(researchCatchwords.judgmentId, createdJudgmentIds));
    await db.delete(researchHeadnotes).where(inArray(researchHeadnotes.judgmentId, createdJudgmentIds));
    await db.delete(researchVerifiedJudgments).where(inArray(researchVerifiedJudgments.id, createdJudgmentIds));
  }
  if (createdContainerIds.length > 0) {
    await db
      .delete(researchAuditEvents)
      .where(
        and(
          eq(researchAuditEvents.entityType, "container"),
          inArray(researchAuditEvents.entityId, createdContainerIds),
        ),
      );
    await db.delete(researchCaseCandidates).where(inArray(researchCaseCandidates.containerId, createdContainerIds));
    await db.delete(researchSourceContainers).where(inArray(researchSourceContainers.id, createdContainerIds));
  }
});

describe("research-admin headnote approval visibility", () => {
  it("promotes a verified official court judgment after an individual headnote acceptance", async () => {
    const fixture = await seedVerifiedOfficialJudgment();

    const response = await request(appWithAdminSession())
      .patch(`/api/research-admin/headnotes/${fixture.judgmentId}/headnotes/${fixture.headnoteId}`)
      .send({ status: "accepted" });

    expect(response.status, response.text).toBe(200);
    expect(response.body.promotedToSearchable).toBe(true);
    expect(await processingState(fixture.containerId)).toBe("SEARCHABLE");
  });

  it("promotes a verified official court judgment after accepting all generated content", async () => {
    const fixture = await seedVerifiedOfficialJudgment();

    const response = await request(appWithAdminSession())
      .post(`/api/research-admin/headnotes/${fixture.judgmentId}/accept-all`);

    expect(response.status, response.text).toBe(200);
    expect(response.body.acceptedHeadnotes).toBe(1);
    expect(response.body.acceptedCatchwords).toBe(1);
    expect(response.body.promotedToSearchable).toBe(true);
    expect(await processingState(fixture.containerId)).toBe("SEARCHABLE");
  });
});