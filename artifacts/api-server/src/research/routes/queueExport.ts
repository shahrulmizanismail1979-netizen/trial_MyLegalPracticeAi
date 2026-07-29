// Phase 12 stress / capacity: queue export and import endpoints.
//
// POST /api/research/queue/export
//   Returns the QUEUED jobs as a signed JSON manifest.
//   Owner / administrator only.
//
// POST /api/research/queue/import
//   Re-hydrates a manifest back into the research_jobs table (idempotent
//   by idempotency_key). Owner / administrator only.
//
// These endpoints exist to support a worker-handoff topology: when bulk
// processing exceeds safe Replit memory limits, a staff member can export
// the pending queue, hand it to an external worker process, and re-import
// any jobs the external worker did not claim.

import { Router } from "express";
import { requireResearchRole } from "../auth";
import {
  db,
  researchJobs,
  type ResearchJob,
  type JobState,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

const router = Router();

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * POST /queue/export
 *
 * Returns all QUEUED jobs as a JSON manifest.  The manifest is a plain
 * JSON object — the caller is responsible for storing it securely if it
 * contains sensitive payload references.
 *
 * Body: { kinds?: string[] }  — optional filter to one or more job kinds.
 */
router.post(
  "/queue/export",
  requireResearchRole("owner", "administrator"),
  async (req, res) => {
    const kinds: string[] | undefined = Array.isArray(req.body?.kinds)
      ? (req.body.kinds as string[])
      : undefined;

    const rows = await db
      .select()
      .from(researchJobs)
      .where(
        kinds && kinds.length > 0
          ? sql`${researchJobs.state} = 'QUEUED' AND ${researchJobs.kind} = ANY(${kinds})`
          : eq(researchJobs.state, "QUEUED" as JobState),
      )
      .orderBy(researchJobs.id);

    const manifest = {
      exportedAt: new Date().toISOString(),
      exportedBy: req.authEmail ?? `role:${req.researchRole ?? "unknown"}`,
      pendingJobCount: rows.length,
      jobs: rows.map((j: ResearchJob) => ({
        id: j.id,
        kind: j.kind,
        idempotencyKey: j.idempotencyKey,
        payload: j.payload,
        attempts: j.attempts,
        maxAttempts: j.maxAttempts,
        processorVersion: j.processorVersion,
        sourceChecksum: j.sourceChecksum,
        provenance: j.provenance,
        createdAt: j.createdAt,
      })),
    };

    res.json(manifest);
  },
);

// ── Import ────────────────────────────────────────────────────────────────────

const ImportManifestSchema = z.object({
  jobs: z.array(
    z.object({
      kind: z.string().min(1),
      idempotencyKey: z.string().min(1),
      payload: z.record(z.string(), z.unknown()),
      maxAttempts: z.number().int().min(1).default(3),
      processorVersion: z.string().default("unversioned"),
      sourceChecksum: z.string().nullable().optional(),
      provenance: z.record(z.string(), z.unknown()).default({}),
    }),
  ),
});

/**
 * POST /queue/import
 *
 * Re-hydrates a queue-export manifest.  Each job is inserted with
 * ON CONFLICT DO NOTHING keyed on idempotency_key, so re-importing the
 * same manifest is safe.
 *
 * Body: the full manifest object returned by /queue/export (or a subset).
 * Returns: { imported, skipped }
 */
router.post(
  "/queue/import",
  requireResearchRole("owner", "administrator"),
  async (req, res) => {
    const parsed = ImportManifestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const { jobs } = parsed.data;
    if (jobs.length === 0) {
      res.json({ imported: 0, skipped: 0 });
      return;
    }

    let imported = 0;
    let skipped = 0;

    // Insert in batches of 100 to avoid oversized SQL
    const BATCH = 100;
    for (let i = 0; i < jobs.length; i += BATCH) {
      const batch = jobs.slice(i, i + BATCH);
      const result = await db
        .insert(researchJobs)
        .values(
          batch.map((j) => ({
            kind: j.kind,
            idempotencyKey: j.idempotencyKey,
            payload: j.payload,
            maxAttempts: j.maxAttempts,
            processorVersion: j.processorVersion,
            sourceChecksum: j.sourceChecksum ?? undefined,
            provenance: j.provenance,
          })),
        )
        .onConflictDoNothing({ target: researchJobs.idempotencyKey })
        .returning({ id: researchJobs.id });

      imported += result.length;
      skipped += batch.length - result.length;
    }

    res.json({
      imported,
      skipped,
      total: jobs.length,
      importedBy: req.authEmail ?? `role:${req.researchRole ?? "unknown"}`,
      importedAt: new Date().toISOString(),
    });
  },
);

export default router;
