/**
 * Phase 14 — Pilot pipeline runner
 *
 * Drives the six existing pilot-v1 containers through every processing stage:
 *   rights decision → inventory → extraction → segmentation → validation → editorial
 *
 * Pre-populates the in-memory storage adapter from disk before running jobs so
 * that inventory and extraction processors can fetch the staged bytes even
 * though the original upload process has exited.
 *
 * Usage:
 *   pnpm --filter @workspace/api-server exec tsx ./src/research/pilot-pipeline.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, researchSourceContainers, researchJobs } from "@workspace/db";
import { like, eq, and, sql, desc, inArray } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../../..");
const CORPUS_DIR = path.join(WORKSPACE_ROOT, "fixtures", "pilot-corpus");

// ── In-memory storage (pre-populated below) ────────────────────────────────────
const stored = new Map<string, Buffer>();

const { setAdapters } = await import("./adapters.js");
setAdapters({
  storage: {
    name: "pilot-memory",
    async put(key: string, bytes: Uint8Array) { stored.set(key, Buffer.from(bytes)); return key; },
    async get(key: string) {
      const b = stored.get(key);
      if (!b) throw new Error(`pilot adapter: key not found: ${key}`);
      return b;
    },
    async remove(key: string) { stored.delete(key); },
  },
});

// ── Register processors ────────────────────────────────────────────────────────
const { registerIngestionProcessors } = await import("./ingestion/service.js");
const { registerInventoryProcessor } = await import("./ingestion/inventory.js");
const { registerExtractionProcessor } = await import("./extraction/pipeline.js");
const { registerSegmentationProcessor } = await import("./segmentation/pipeline.js");
const { registerValidationProcessor } = await import("./validation/pipeline.js");
const { registerEditorialProcessor } = await import("./isolation/editorialProcessor.js");
const { runNextJob } = await import("./processing/index.js");
const { recordRightsDecision } = await import("./data/rights.js");
const { startInventory } = await import("./ingestion/inventory.js");
const { startExtraction } = await import("./extraction/pipeline.js");
const { startSegmentation } = await import("./segmentation/pipeline.js");
const { startValidation } = await import("./validation/pipeline.js");
const { startEditorialClassification } = await import("./isolation/editorialProcessor.js");

registerIngestionProcessors();
registerInventoryProcessor();
registerExtractionProcessor();
registerSegmentationProcessor();
registerValidationProcessor();
registerEditorialProcessor();

// ── Rights decision ────────────────────────────────────────────────────────────
const RIGHTS_DECISION = {
  status: "PRIVATE_PROCESSING_APPROVED" as const,
  reason: "Pilot v1 synthetic corpus — approved for controlled testing",
  source: "Synthetic pilot corpus (Phase 14)",
  dateObtained: new Date("2026-07-01T00:00:00Z"),
  declaredSourceType: "official_court",
  licenceReference: null,
  approvedUsers: ["pilot@admin.internal"],
  approvedPurposes: ["research"],
  storagePermitted: true,
  analysisPermitted: true,
  externalProcessingPermitted: false,
  studentAccessPermitted: false,
  printingPermitted: true,
  exportPermitted: false,
  retentionPeriod: null,
  expiryDate: null,
  reviewer: "pilot@admin.internal",
  reviewDate: new Date("2026-07-02T00:00:00Z"),
  notes: "Controlled pilot batch — all content is purely synthetic",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

async function resetJobsForContainer(containerId: number, kind: string) {
  // Reset stuck/failed/cancelled jobs back to QUEUED so they can be re-run.
  // enqueue() uses .onConflictDoNothing() on the idempotency key, so any
  // non-QUEUED/RUNNING job with the same key blocks fresh enqueues.
  await db.execute(sql`
    UPDATE research_jobs
    SET state = 'QUEUED', attempts = 0, last_error = null,
        claimed_at = null, started_at = null, finished_at = null
    WHERE kind = ${kind}
      AND state IN ('FAILED_PERMANENT', 'FAILED_RETRYABLE', 'CANCELLED')
      AND payload->>'containerId' = ${String(containerId)}
  `);
}

async function waitForJob(
  containerId: number,
  kind: string,
  timeoutMs = 90_000,
): Promise<string> {

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const [job] = await db
      .select({ id: researchJobs.id, state: researchJobs.state })
      .from(researchJobs)
      .where(
        and(
          eq(researchJobs.kind, kind),
          sql`${researchJobs.payload}->>'containerId' = ${String(containerId)}`,
        ),
      )
      .orderBy(desc(researchJobs.id))
      .limit(1);

    if (!job) { await sleep(50); continue; }
    if (job.state === "SUCCEEDED" || job.state === "FAILED_PERMANENT") return job.state;
    if (job.state === "RUNNING" || job.state === "FAILED_RETRYABLE") { await sleep(50); continue; }
    // QUEUED — run it
    await runNextJob(kind);
  }
  return "TIMEOUT";
}

// ── Reload container state ────────────────────────────────────────────────────
async function reload(id: number) {
  const [row] = await db
    .select()
    .from(researchSourceContainers)
    .where(eq(researchSourceContainers.id, id));
  return row!;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const containers = await db
  .select()
  .from(researchSourceContainers)
  .where(like(researchSourceContainers.sourceBatch, "pilot-v1%"));

if (containers.length === 0) {
  console.error("No pilot-v1 containers found. Run pilot-upload.ts first.");
  process.exit(1);
}

// ── Pre-populate in-memory storage from disk ───────────────────────────────────
// The upload script stored bytes in an in-memory adapter that only lived for
// that process. Now we reload the same bytes from the corpus directory and
// populate the adapter under the storageKey recorded in the DB, so that
// inventory and extraction jobs can fetch them.
console.log(`\nPre-populating storage from ${CORPUS_DIR}…`);
for (const container of containers) {
  const key = container.storageKey;
  if (!key) {
    console.log(`  ⚠️  #${container.id} ${container.originalName}: no storageKey`);
    continue;
  }
  const filePath = path.join(CORPUS_DIR, container.originalName);
  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  #${container.id} ${container.originalName}: file not found at ${filePath}`);
    continue;
  }
  const bytes = fs.readFileSync(filePath);
  stored.set(key, bytes);
  console.log(`  ✅ #${container.id} ${container.originalName} → ${key.slice(-16)}  (${bytes.length} bytes)`);
}

console.log(`\nPilot pipeline — ${containers.length} container(s)\n${"═".repeat(60)}`);

for (const container of containers) {
  const id = container.id;
  const name = container.originalName;
  console.log(`\n▶ #${id}  ${name}  (${container.processingState})`);

  // ── Step 1: Rights decision ────────────────────────────────────────────────
  const current = await reload(id);
  if (current.rightsStatus === "UNREVIEWED") {
    try {
      await recordRightsDecision(id, RIGHTS_DECISION, { actor: "pilot-pipeline" });
      console.log(`  ✅ rights decision recorded`);
    } catch (err: unknown) {
      console.log(`  ⚠️  rights: ${err instanceof Error ? err.message : err}`);
    }
  } else {
    console.log(`  ✅ rights already: ${current.rightsStatus}`);
  }

  let state = (await reload(id)).processingState;

  // ── Step 2: Inventory ──────────────────────────────────────────────────────
  if (["RIGHTS_REVIEW_REQUIRED", "RIGHTS_APPROVED", "INVENTORY_PENDING"].includes(state)) {
    // Reset any stuck/failed/cancelled jobs BEFORE calling startInventory, so
    // the idempotency-key slot is re-usable (or the existing job is QUEUED).
    await resetJobsForContainer(id, "container.inventory");
    try {
      await startInventory(id, "pilot-pipeline");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("INVENTORY_PENDING")) {
        console.log(`  ⚠️  startInventory: ${msg}`);
      }
    }
    const result = await waitForJob(id, "container.inventory");
    state = (await reload(id)).processingState;
    console.log(`  inventory: ${result} → ${state}`);
  } else {
    console.log(`  inventory: skipped (state=${state})`);
  }

  // ── Step 3: Extraction ─────────────────────────────────────────────────────
  if (["INVENTORIED", "EXTRACTION_PENDING", "OCR_REVIEW_REQUIRED"].includes(state)) {
    await resetJobsForContainer(id, "container.extract");
    try {
      await startExtraction(id, "pilot-pipeline");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("EXTRACTION_PENDING")) {
        console.log(`  ⚠️  startExtraction: ${msg}`);
      }
    }
    const result = await waitForJob(id, "container.extract", 120_000);
    state = (await reload(id)).processingState;
    console.log(`  extraction: ${result} → ${state}`);
  } else {
    console.log(`  extraction: skipped (state=${state})`);
  }

  // Scanned file lands in OCR_REVIEW_REQUIRED — expected outcome.
  if (state === "OCR_REVIEW_REQUIRED") {
    console.log(`  → OCR_REVIEW_REQUIRED (expected for scanned file)`);
    continue;
  }

  // ── Step 4: Segmentation ───────────────────────────────────────────────────
  if (["TEXT_EXTRACTED", "SEGMENTATION_PENDING"].includes(state)) {
    await resetJobsForContainer(id, "container.segment");
    try {
      await startSegmentation(id, "pilot-pipeline");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("SEGMENTATION_PENDING")) {
        console.log(`  ⚠️  startSegmentation: ${msg}`);
      }
    }
    const result = await waitForJob(id, "container.segment", 60_000);
    state = (await reload(id)).processingState;
    console.log(`  segmentation: ${result} → ${state}`);
  } else {
    console.log(`  segmentation: skipped (state=${state})`);
  }

  // ── Step 5: Validation ─────────────────────────────────────────────────────
  const validationEligible = [
    "SEGMENTATION_PROPOSED",
    "SEGMENTATION_REVIEW_REQUIRED",
    "TEXT_EXTRACTED",
  ].includes(state);
  if (validationEligible) {
    await resetJobsForContainer(id, "container.validate");
    try {
      await startValidation(id, "pilot-pipeline");
    } catch (err: unknown) {
      console.log(`  ⚠️  startValidation: ${err instanceof Error ? err.message : err}`);
    }
    const result = await waitForJob(id, "container.validate", 60_000);
    state = (await reload(id)).processingState;
    console.log(`  validation: ${result} → ${state}`);
  } else {
    console.log(`  validation: skipped (state=${state})`);
  }

  // ── Step 6: Editorial classification ──────────────────────────────────────
  await resetJobsForContainer(id, "container.editorial_classify");
  try {
    await startEditorialClassification(id, "pilot-pipeline");
    const result = await waitForJob(id, "container.editorial_classify", 60_000);
    state = (await reload(id)).processingState;
    console.log(`  editorial: ${result} → ${state}`);
  } catch (err: unknown) {
    console.log(`  ⚠️  editorial: ${err instanceof Error ? err.message : err}`);
  }

  console.log(`  ✅ final state: ${state}`);
}

console.log(`\n${"═".repeat(60)}`);
console.log(`Pipeline complete.`);
console.log(`\nNext: generate the pilot report:`);
console.log(`  pnpm --filter @workspace/scripts exec tsx ./src/generate-pilot-report.ts`);
console.log(`${"═".repeat(60)}\n`);
process.exit(0);
