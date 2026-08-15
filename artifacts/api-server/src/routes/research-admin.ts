/**
 * Research Admin API — password-gated routes for the Case Law Research Admin
 * portal (/research-admin/). Uses ADMIN_PASSWORD session auth rather than
 * Clerk, so the standalone admin frontend can log in without a Clerk tenant.
 *
 * Mounted at /api/research-admin (outside the Clerk-gated /api/research prefix).
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod/v4";
import {
  db,
  driveAssets,
  driveInventoryRuns,
  researchJobs,
  researchAuditEvents,
} from "@workspace/db";
import { and, asc, count, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { getAllFolderChildren, DRIVE_FOLDER_MIME } from "../research/drive/driveClient";
import { classifyDriveFile, rightsStatusForClassification } from "../research/drive/classify";

const IS_PROD = process.env.NODE_ENV === "production";
const ADMIN_PASSWORD: string | null =
  process.env.ADMIN_PASSWORD || (IS_PROD ? null : "admin123");

if (!ADMIN_PASSWORD) {
  console.warn(
    "[research-admin] ADMIN_PASSWORD is not set — research-admin login is disabled until configured",
  );
}

const ROOT_FOLDER_ID = "1Rm5yiE4DsXEG1mVwbcTL8ehneCCRAtbx";

// ── Cookie-based auth (uses cookie-parser signed cookies) ────────────────────
const COOKIE_NAME = "ra_auth";

function requireAdminSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.signedCookies?.[COOKIE_NAME] === "1") {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}

// ── Router ───────────────────────────────────────────────────────────────────
const router = Router();

// ── Auth endpoints (no session required) ─────────────────────────────────────

router.post("/auth/login", (req: Request, res: Response) => {
  if (!ADMIN_PASSWORD) {
    res.status(503).json({ error: "Admin auth not configured" });
    return;
  }
  const { password } = (req.body ?? {}) as { password?: string };
  if (!password || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  res.cookie(COOKIE_NAME, "1", {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000, // 24h
  });
  res.json({ ok: true });
});

router.post("/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get("/auth/me", (req: Request, res: Response) => {
  const authed = req.signedCookies?.[COOKIE_NAME] === "1";
  res.json({ authed });
});

// ── Dashboard Stats ───────────────────────────────────────────────────────────

router.get("/stats", requireAdminSession, async (_req: Request, res: Response) => {
  const [
    [totalRow],
    [approvedRow],
    [restrictedRow],
    [rightsReviewRow],
    [needsOfficialRow],
    [publishedRow],
    [failedRow],
    [pendingRow],
    [queuedJobsRow],
    [failedJobsRow],
    [latestRun],
  ] = await Promise.all([
    db.select({ c: count() }).from(driveAssets),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.rightsStatus, "APPROVED")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.rightsStatus, "RESTRICTED_REFERENCE_ONLY")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.rightsStatus, "RIGHTS_REVIEW_REQUIRED")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.rightsStatus, "NEEDS_OFFICIAL_SOURCE")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.processingStatus, "PUBLISHED")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.processingStatus, "FAILED")),
    db.select({ c: count() }).from(driveAssets).where(eq(driveAssets.processingStatus, "PENDING")),
    db.select({ c: count() }).from(researchJobs).where(eq(researchJobs.state, "QUEUED")),
    db.select({ c: count() }).from(researchJobs).where(eq(researchJobs.state, "FAILED_PERMANENT")),
    db.select().from(driveInventoryRuns).orderBy(desc(driveInventoryRuns.createdAt)).limit(1),
  ]);

  res.json({
    totalDriveAssets: totalRow?.c ?? 0,
    approved: approvedRow?.c ?? 0,
    restricted: restrictedRow?.c ?? 0,
    rightsReview: rightsReviewRow?.c ?? 0,
    needsOfficialSource: needsOfficialRow?.c ?? 0,
    published: publishedRow?.c ?? 0,
    failed: failedRow?.c ?? 0,
    pending: pendingRow?.c ?? 0,
    queuedJobs: queuedJobsRow?.c ?? 0,
    failedJobs: failedJobsRow?.c ?? 0,
    latestInventoryRun: latestRun ?? null,
  });
});

// ── Drive Inventory ───────────────────────────────────────────────────────────

router.post("/drive/inventory/start", requireAdminSession, async (req: Request, res: Response) => {
  // Prevent concurrent runs
  const [existing] = await db
    .select({ id: driveInventoryRuns.id })
    .from(driveInventoryRuns)
    .where(eq(driveInventoryRuns.status, "RUNNING"))
    .limit(1);

  if (existing) {
    res.status(409).json({
      error: "An inventory run is already in progress",
      runId: existing.id,
    });
    return;
  }

  const [run] = await db
    .insert(driveInventoryRuns)
    .values({
      rootFolderId: ROOT_FOLDER_ID,
      actorId: "admin",
    })
    .returning();

  // Fire-and-forget — errors are written back to the run row
  runDriveInventory(run!.id, ROOT_FOLDER_ID).catch((err: unknown) => {
    console.error("[drive-inventory] Fatal:", err);
    db.update(driveInventoryRuns)
      .set({
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: String(err),
      })
      .where(eq(driveInventoryRuns.id, run!.id))
      .catch(console.error);
  });

  res.status(202).json({ runId: run!.id, status: "RUNNING" });
});

router.get("/drive/inventory/status", requireAdminSession, async (_req: Request, res: Response) => {
  const [run] = await db
    .select()
    .from(driveInventoryRuns)
    .orderBy(desc(driveInventoryRuns.createdAt))
    .limit(1);
  res.json(run ?? null);
});

router.get("/drive/inventory/runs", requireAdminSession, async (_req: Request, res: Response) => {
  const runs = await db
    .select()
    .from(driveInventoryRuns)
    .orderBy(desc(driveInventoryRuns.createdAt))
    .limit(50);
  res.json(runs);
});

// ── Drive Assets ──────────────────────────────────────────────────────────────

router.get("/drive/assets", requireAdminSession, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const rightsStatus = req.query.rightsStatus as string | undefined;
  const processingStatus = req.query.processingStatus as string | undefined;
  const sourceClassification = req.query.sourceClassification as string | undefined;
  const search = req.query.search as string | undefined;

  const conditions = [];
  if (rightsStatus) conditions.push(eq(driveAssets.rightsStatus, rightsStatus as Parameters<typeof eq>[1]));
  if (processingStatus) conditions.push(eq(driveAssets.processingStatus, processingStatus as Parameters<typeof eq>[1]));
  if (sourceClassification) conditions.push(eq(driveAssets.sourceClassification, sourceClassification as Parameters<typeof eq>[1]));
  if (search) {
    conditions.push(
      sql`(${driveAssets.name} ILIKE ${`%${search}%`} OR ${driveAssets.folderPath} ILIKE ${`%${search}%`})`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(driveAssets)
      .where(where)
      .orderBy(desc(driveAssets.inventoryTimestamp))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(driveAssets)
      .where(where),
  ]);

  res.json({ total, limit, offset, assets: rows });
});

router.get("/drive/assets/:id", requireAdminSession, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [asset] = await db.select().from(driveAssets).where(eq(driveAssets.id, id));
  if (!asset) { res.status(404).json({ error: "Not found" }); return; }
  res.json(asset);
});

const PatchRightsSchema = z.object({
  rightsStatus: z.enum([
    "RESTRICTED_REFERENCE_ONLY",
    "NEEDS_OFFICIAL_SOURCE",
    "RIGHTS_REVIEW_REQUIRED",
    "APPROVED",
  ]),
});

router.patch("/drive/assets/:id/rights", requireAdminSession, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = PatchRightsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.issues });
    return;
  }

  const [updated] = await db
    .update(driveAssets)
    .set({ rightsStatus: parsed.data.rightsStatus, updatedAt: new Date() })
    .where(eq(driveAssets.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

// ── Processing Queue (research jobs) ─────────────────────────────────────────

router.get("/queue", requireAdminSession, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const status = req.query.status as string | undefined;

  const where = status ? eq(researchJobs.state, status as Parameters<typeof eq>[1]) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(researchJobs)
      .where(where)
      .orderBy(desc(researchJobs.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(researchJobs)
      .where(where),
  ]);

  res.json({ total, limit, offset, jobs: rows });
});

router.get("/queue/stats", requireAdminSession, async (_req: Request, res: Response) => {
  const statuses = [
    "QUEUED",
    "RUNNING",
    "FAILED_RETRYABLE",
    "REVIEW_REQUIRED",
    "BLOCKED_BY_RIGHTS",
    "SUCCEEDED",
    "FAILED_PERMANENT",
    "CANCELLED",
  ] as const;

  const results = await Promise.all(
    statuses.map((s) =>
      db
        .select({ c: count() })
        .from(researchJobs)
        .where(eq(researchJobs.state, s))
        .then(([r]) => [s, r?.c ?? 0] as const),
    ),
  );

  res.json(Object.fromEntries(results));
});

// ── Audit Log ────────────────────────────────────────────────────────────────

router.get("/audit", requireAdminSession, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(researchAuditEvents)
      .orderBy(desc(researchAuditEvents.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(researchAuditEvents),
  ]);

  res.json({ total, limit, offset, events: rows });
});

// ── Error assets ─────────────────────────────────────────────────────────────

router.get("/errors", requireAdminSession, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(driveAssets)
      .where(eq(driveAssets.processingStatus, "FAILED"))
      .orderBy(desc(driveAssets.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(driveAssets)
      .where(eq(driveAssets.processingStatus, "FAILED")),
  ]);

  res.json({ total, limit, offset, assets: rows });
});

// ── Inventory worker (runs async in process) ─────────────────────────────────

async function runDriveInventory(runId: number, rootFolderId: string): Promise<void> {
  let totalItems = 0;
  let totalFolders = 0;
  let totalBytes = 0;

  async function walkFolder(folderId: string, pathParts: string[]): Promise<void> {
    const children = await getAllFolderChildren(folderId);

    for (const file of children) {
      if (file.mimeType === DRIVE_FOLDER_MIME) {
        totalFolders++;
        await walkFolder(file.id, [...pathParts, file.name]);
      } else {
        totalItems++;
        const folderPath = pathParts.join(" / ");
        const fileSize = file.size ? Number(file.size) : 0;
        totalBytes += fileSize;

        const classification = classifyDriveFile(file, folderPath);
        const rightsStatus = rightsStatusForClassification(classification);

        await db
          .insert(driveAssets)
          .values({
            driveFileId: file.id,
            name: file.name,
            mimeType: file.mimeType ?? null,
            size: fileSize || null,
            createdTime: file.createdTime ? new Date(file.createdTime) : null,
            modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
            folderPath,
            contributorFolder: pathParts[0] ?? null,
            dateFolder: pathParts[1] ?? null,
            md5Checksum: file.md5Checksum ?? null,
            parentFolderId: folderId,
            sourceClassification: classification,
            rightsStatus,
            processingStatus: "PENDING",
            inventoryRunId: runId,
          })
          .onConflictDoUpdate({
            target: driveAssets.driveFileId,
            set: {
              name: file.name,
              mimeType: file.mimeType ?? null,
              size: fileSize || null,
              modifiedTime: file.modifiedTime ? new Date(file.modifiedTime) : null,
              folderPath,
              md5Checksum: file.md5Checksum ?? null,
              parentFolderId: folderId,
              inventoryTimestamp: new Date(),
              inventoryRunId: runId,
              updatedAt: new Date(),
            },
          });
      }
    }

    // Persist running progress after each folder
    await db
      .update(driveInventoryRuns)
      .set({ totalItems, totalFolders, totalBytes })
      .where(eq(driveInventoryRuns.id, runId));
  }

  await walkFolder(rootFolderId, []);

  await db
    .update(driveInventoryRuns)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      totalItems,
      totalFolders,
      totalBytes,
    })
    .where(eq(driveInventoryRuns.id, runId));
}

export default router;
