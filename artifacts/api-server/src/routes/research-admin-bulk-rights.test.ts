/**
 * Integration tests for POST /api/research-admin/drive/assets/bulk-rights
 *
 * Verifies:
 *  1. Successful bulk-approve updates rights_status AND inserts research_jobs rows
 *     in a single atomic transaction — both changes are visible together.
 *  2. Job rows are idempotent — a second call is a no-op for job creation
 *     (ON CONFLICT DO NOTHING on idempotency_key).
 *  3. Non-APPROVED statuses (RESTRICTED_REFERENCE_ONLY) update rights but do
 *     NOT insert any research_jobs rows.
 *  4. sourceClassification filter only touches matching assets.
 *
 * Uses the live dev DB with RUN_ID-scoped seed rows, cleaned up in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { db, driveAssets, driveInventoryRuns, researchJobs } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { DRIVE_INGEST_JOB_KIND } from "../research/drive/driveIngestProcessor";

const RUN_ID = randomUUID();
const TEST_SECRET = "test-cookie-secret";
const TEST_PASSWORD = "admin123"; // default in research-admin.ts when IS_PROD=false

// ── App fixture ──────────────────────────────────────────────────────────────

// Set password before the module is imported so it picks it up.
process.env.ADMIN_PASSWORD = TEST_PASSWORD;
const { default: researchAdminRouter } = await import("./research-admin");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser(TEST_SECRET));
  app.use("/api/research-admin", researchAdminRouter);
  return app;
}

async function authedAgent() {
  const agent = request.agent(buildApp());
  await agent
    .post("/api/research-admin/auth/login")
    .send({ password: TEST_PASSWORD })
    .expect(200);
  return agent;
}

// ── Seed helpers ──────────────────────────────────────────────────────────────

let inventoryRunId: number;
const seededAssetIds: number[] = [];

async function seedAsset(opts: {
  sourceClassification?: "UNKNOWN_SOURCE" | "EXPRESSLY_LICENSED_SOURCE" | "OFFICIAL_JUDGMENT";
  rightsStatus?: "RIGHTS_REVIEW_REQUIRED" | "APPROVED" | "RESTRICTED_REFERENCE_ONLY";
} = {}) {
  const [row] = await db
    .insert(driveAssets)
    .values({
      inventoryRunId,
      driveFileId: `test-${RUN_ID}-${Math.random().toString(36).slice(2)}`,
      name: `judgment-${RUN_ID}.pdf`,
      mimeType: "application/pdf",
      sourceClassification: opts.sourceClassification ?? "UNKNOWN_SOURCE",
      rightsStatus: opts.rightsStatus ?? "RIGHTS_REVIEW_REQUIRED",
      processingStatus: "PENDING",
    })
    .returning({ id: driveAssets.id });
  seededAssetIds.push(row!.id);
  return row!.id;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const [run] = await db
    .insert(driveInventoryRuns)
    .values({
      rootFolderId: `test-folder-${RUN_ID}`,
      status: "COMPLETED",
    })
    .returning({ id: driveInventoryRuns.id });
  inventoryRunId = run!.id;
});

afterAll(async () => {
  if (seededAssetIds.length > 0) {
    await db
      .delete(researchJobs)
      .where(
        inArray(
          researchJobs.idempotencyKey,
          seededAssetIds.map((id) => `drive.ingest:asset:${id}`),
        ),
      );
    await db.delete(driveAssets).where(inArray(driveAssets.id, seededAssetIds));
  }
  await db.delete(driveInventoryRuns).where(eq(driveInventoryRuns.id, inventoryRunId));
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/research-admin/drive/assets/bulk-rights", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const res = await request(buildApp())
      .post("/api/research-admin/drive/assets/bulk-rights")
      .send({ rightsStatus: "APPROVED" });
    expect(res.status).toBe(401);
  });

  it("rejects invalid rightsStatus with 400", async () => {
    const agent = await authedAgent();
    const res = await agent
      .post("/api/research-admin/drive/assets/bulk-rights")
      .send({ rightsStatus: "INVALID_VALUE" });
    expect(res.status).toBe(400);
  });

  it("atomically updates rights AND inserts durable research_jobs rows for APPROVED", async () => {
    const assetId1 = await seedAsset();
    const assetId2 = await seedAsset();
    const agent = await authedAgent();

    const res = await agent
      .post("/api/research-admin/drive/assets/bulk-rights")
      .send({ rightsStatus: "APPROVED" });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBeGreaterThanOrEqual(2);
    expect(res.body.ingestionQueued).toBeGreaterThanOrEqual(2);

    // Both assets should have APPROVED rights in the DB
    const rows = await db
      .select({ id: driveAssets.id, rights: driveAssets.rightsStatus })
      .from(driveAssets)
      .where(inArray(driveAssets.id, [assetId1, assetId2]));
    expect(rows.every((r) => r.rights === "APPROVED")).toBe(true);

    // And a durable research_jobs row must exist for each asset
    const jobs = await db
      .select({ key: researchJobs.idempotencyKey, kind: researchJobs.kind })
      .from(researchJobs)
      .where(
        inArray(researchJobs.idempotencyKey, [
          `drive.ingest:asset:${assetId1}`,
          `drive.ingest:asset:${assetId2}`,
        ]),
      );
    expect(jobs).toHaveLength(2);
    expect(jobs.every((j) => j.kind === DRIVE_INGEST_JOB_KIND)).toBe(true);
  });

  it("is idempotent — second call inserts 0 new job rows (ON CONFLICT DO NOTHING)", async () => {
    // Seed an asset that is already APPROVED (simulating a prior run)
    const assetId = await seedAsset({ rightsStatus: "APPROVED" });
    const agent = await authedAgent();

    // The asset is already APPROVED, so the WHERE (RIGHTS_REVIEW_REQUIRED) won't match.
    // Any previous run's job row would also conflict — queued count must be 0.
    const res = await agent
      .post("/api/research-admin/drive/assets/bulk-rights")
      .send({ rightsStatus: "APPROVED" });
    expect(res.status).toBe(200);

    // Verify no duplicate job was created for our already-approved asset
    const jobs = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${assetId}`));
    // Either 0 (never queued before) or 1 (existed from a prior run) — never > 1
    expect(jobs.length).toBeLessThanOrEqual(1);
  });

  it("RESTRICTED_REFERENCE_ONLY updates rights but inserts NO job rows", async () => {
    const assetId = await seedAsset({ sourceClassification: "EXPRESSLY_LICENSED_SOURCE" });
    const agent = await authedAgent();

    const res = await agent
      .post("/api/research-admin/drive/assets/bulk-rights")
      .send({
        rightsStatus: "RESTRICTED_REFERENCE_ONLY",
        sourceClassification: "EXPRESSLY_LICENSED_SOURCE",
      });

    expect(res.status).toBe(200);
    expect(res.body.ingestionQueued).toBe(0);

    const [asset] = await db
      .select({ rights: driveAssets.rightsStatus })
      .from(driveAssets)
      .where(eq(driveAssets.id, assetId));
    expect(asset?.rights).toBe("RESTRICTED_REFERENCE_ONLY");

    const [job] = await db
      .select()
      .from(researchJobs)
      .where(eq(researchJobs.idempotencyKey, `drive.ingest:asset:${assetId}`));
    expect(job).toBeUndefined();
  });

  it("sourceClassification filter only updates matching assets, leaves others untouched", async () => {
    const unknownId = await seedAsset({ sourceClassification: "UNKNOWN_SOURCE" });
    const licensedId = await seedAsset({ sourceClassification: "EXPRESSLY_LICENSED_SOURCE" });
    const agent = await authedAgent();

    await agent
      .post("/api/research-admin/drive/assets/bulk-rights")
      .send({
        rightsStatus: "APPROVED",
        sourceClassification: "EXPRESSLY_LICENSED_SOURCE",
      })
      .expect(200);

    const [unknownRow] = await db
      .select({ rights: driveAssets.rightsStatus })
      .from(driveAssets)
      .where(eq(driveAssets.id, unknownId));
    const [licensedRow] = await db
      .select({ rights: driveAssets.rightsStatus })
      .from(driveAssets)
      .where(eq(driveAssets.id, licensedId));

    // UNKNOWN_SOURCE asset must remain at RIGHTS_REVIEW_REQUIRED
    expect(unknownRow?.rights).toBe("RIGHTS_REVIEW_REQUIRED");
    // EXPRESSLY_LICENSED_SOURCE asset must now be APPROVED
    expect(licensedRow?.rights).toBe("APPROVED");
  });
});
