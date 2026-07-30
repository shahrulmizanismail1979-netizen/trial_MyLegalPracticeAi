/**
 * Phase 14 — Pilot upload and pipeline runner
 *
 * Reads the five PDFs from fixtures/pilot-corpus/, uploads them through the
 * research ingestion pipeline, records rights decisions, then runs
 * segmentation, validation, and editorial classification for every container.
 * Containers are stamped sourceBatch='pilot-v1' so the report generator can
 * find them.
 *
 * Usage (run once against the dev database):
 *   pnpm --filter @workspace/api-server exec tsx ./src/research/pilot-upload.ts
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Corpus location ────────────────────────────────────────────────────────────
// artifacts/api-server/src/research → up four levels → workspace root
const WORKSPACE_ROOT = path.resolve(__dirname, "../../../..");
const CORPUS_DIR = path.join(WORKSPACE_ROOT, "fixtures", "pilot-corpus");

// ── Adapter setup (in-memory so we don't need real object-storage creds) ──────
const stored = new Map<string, Buffer>();

const { setAdapters } = await import("./adapters.js");
setAdapters({
  storage: {
    name: "pilot-memory",
    async put(key: string, bytes: Uint8Array) {
      stored.set(key, Buffer.from(bytes));
      return key;
    },
    async get(key: string) {
      const b = stored.get(key);
      if (!b) throw new Error(`pilot adapter: key not found: ${key}`);
      return b;
    },
    async remove(key: string) {
      stored.delete(key);
    },
  },
});

// ── Import pipeline modules ────────────────────────────────────────────────────
const { processUpload, registerIngestionProcessors } = await import(
  "./ingestion/service.js"
);
const { registerSegmentationProcessor } = await import(
  "./segmentation/pipeline.js"
);
const { registerValidationProcessor } = await import(
  "./validation/pipeline.js"
);
const { registerEditorialProcessor } = await import(
  "./isolation/editorialProcessor.js"
);
const { runNextJob } = await import("./processing/index.js");
const { recordRightsDecision } = await import("./data/rights.js");
const {
  db,
  researchSourceContainers,
  researchUploadBatchItems,
  researchUploadBatches,
  researchJobs,
} = await import("@workspace/db");
const { eq, inArray, like, and, sql, desc } = await import("drizzle-orm");

// ── Register all processors ────────────────────────────────────────────────────
registerIngestionProcessors();
registerSegmentationProcessor();
registerValidationProcessor();
registerEditorialProcessor();

// Cancel any orphaned QUEUED jobs from aborted previous runs so they don't
// stall the drain loops.
await db.execute(sql`
  UPDATE research_jobs
  SET state = 'FAILED_PERMANENT'
  WHERE kind IN ('container.validate', 'container.editorial_classify')
    AND state = 'QUEUED'
    AND NOT EXISTS (
      SELECT 1 FROM research_source_containers
      WHERE id = (research_jobs.payload->>'containerId')::int
    )
`);

// ── Rights decision applied to all pilot containers ────────────────────────────
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

async function drainJobKind(kind: string, max = 200): Promise<number> {
  let count = 0;
  for (let i = 0; i < max; i++) {
    const job = await runNextJob(kind);
    if (!job) break;
    count++;
  }
  return count;
}

async function drainForContainer(
  containerId: number,
  kind: string,
  timeoutMs = 30_000,
): Promise<void> {
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

    if (!job) {
      await new Promise<void>((r) => setTimeout(r, 40));
      continue;
    }
    if (job.state === "SUCCEEDED" || job.state === "FAILED_PERMANENT") return;
    if (job.state === "RUNNING" || job.state === "FAILED_RETRYABLE") {
      await new Promise<void>((r) => setTimeout(r, 40));
      continue;
    }
    // QUEUED — run it
    await runNextJob(kind);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // ── 1. Check existing pilot-v1 containers ─────────────────────────────────
  const existing = await db
    .select({ id: researchSourceContainers.id, name: researchSourceContainers.originalName })
    .from(researchSourceContainers)
    .where(like(researchSourceContainers.sourceBatch, "pilot-v1%"));

  if (existing.length > 0) {
    console.log(`\n⚠️  Found ${existing.length} existing pilot-v1 container(s):`);
    for (const c of existing) console.log(`   #${c.id} ${c.name}`);
    console.log(`\nPilot containers already exist — skipping upload.`);
    console.log(`Run 'pnpm --filter @workspace/scripts exec tsx ./src/generate-pilot-report.ts' to generate the report.\n`);
    process.exit(0);
  }

  // ── 2. Read corpus files ───────────────────────────────────────────────────
  const files = [
    "pilot-a-dense-30cases.pdf",
    "pilot-b-4cases.pdf",
    "pilot-c-scanned.pdf",
    "pilot-d-duplicate.pdf",
    "pilot-e1-split-part1.pdf",
    "pilot-e2-split-part2.pdf",
  ].map((name) => {
    const filePath = path.join(CORPUS_DIR, name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Corpus file not found: ${filePath}. Run generate-pilot-corpus.ts first.`);
    }
    return { originalName: name, bytes: fs.readFileSync(filePath) };
  });

  console.log(`\n📂 Read ${files.length} corpus files from ${CORPUS_DIR}`);
  for (const f of files) console.log(`   ${f.originalName}  (${f.bytes.length} bytes)`);

  // ── 3. Upload all files as a single batch ──────────────────────────────────
  console.log(`\n⬆️  Uploading files via processUpload…`);
  const { batch, items } = await processUpload(
    files.map((f) => ({ originalName: f.originalName, bytes: f.bytes })),
    {
      declaredSource: "pilot-v1",
      uploadedBy: "pilot@admin.internal",
      provenance: { enteredVia: "pilot-upload-script", phase: 14 },
    },
  );
  console.log(`   Batch #${batch.id} created with ${items.length} item(s)`);
  for (const item of items) {
    console.log(`   Item #${item.id}: ${item.originalPath} — ${item.state}`);
  }

  // ── 4. Drain ingest jobs ───────────────────────────────────────────────────
  console.log(`\n⚙️  Running ingest jobs…`);
  const ingested = await drainJobKind("container.ingest");
  console.log(`   Ran ${ingested} ingest job(s)`);

  // ── 5. Find all containers from this batch ─────────────────────────────────
  const batchItems = await db
    .select({
      containerId: researchUploadBatchItems.containerId,
      state: researchUploadBatchItems.state,
      originalPath: researchUploadBatchItems.originalPath,
      duplicateOfContainerId: researchUploadBatchItems.duplicateOfContainerId,
    })
    .from(researchUploadBatchItems)
    .where(eq(researchUploadBatchItems.batchId, batch.id));

  const containerIds = batchItems
    .filter((bi) => bi.containerId !== null)
    .map((bi) => bi.containerId as number);

  const duplicates = batchItems.filter((bi) => bi.state === "DUPLICATE");
  console.log(`\n📦 Batch items after ingest:`);
  for (const bi of batchItems) {
    console.log(
      `   ${bi.originalPath}: ${bi.state}` +
        (bi.containerId ? ` → container #${bi.containerId}` : "") +
        (bi.duplicateOfContainerId ? ` (duplicate of #${bi.duplicateOfContainerId})` : ""),
    );
  }
  if (duplicates.length > 0) {
    console.log(`\n✅ Duplicate detection: ${duplicates.length} duplicate(s) detected`);
  }

  if (containerIds.length === 0) {
    console.error("No containers were created — all items rejected or duplicate.");
    process.exit(1);
  }

  // ── 6. Stamp sourceBatch = 'pilot-v1' on all containers ───────────────────
  // The ingest processor sets sourceBatch = 'upload-batch-N'; we override
  // this so the report generator's LIKE 'pilot-v1%' query can find them.
  console.log(`\n🏷️  Stamping sourceBatch='pilot-v1' on ${containerIds.length} container(s)…`);
  await db
    .update(researchSourceContainers)
    .set({ sourceBatch: "pilot-v1" })
    .where(inArray(researchSourceContainers.id, containerIds));

  // ── 7. Record rights decisions and run pipeline for each container ─────────
  const containerRows = await db
    .select({ id: researchSourceContainers.id, originalName: researchSourceContainers.originalName, processingState: researchSourceContainers.processingState })
    .from(researchSourceContainers)
    .where(inArray(researchSourceContainers.id, containerIds));

  for (const container of containerRows) {
    console.log(`\n📋 Processing container #${container.id}: ${container.originalName} (${container.processingState})`);

    // Record rights decision
    try {
      await recordRightsDecision(container.id, RIGHTS_DECISION, {
        actor: "pilot-upload-script",
      });
      console.log(`   ✅ Rights decision recorded`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ⚠️  Rights already recorded or error: ${msg}`);
    }

    // Drain inventory job if any
    await drainForContainer(container.id, "container.inventory");

    // Run segmentation
    console.log(`   ⚙️  Running segmentation…`);
    await drainForContainer(container.id, "container.segment", 60_000);

    // Run validation
    console.log(`   ⚙️  Running validation…`);
    await drainForContainer(container.id, "container.validate", 60_000);

    // Run editorial classification
    console.log(`   ⚙️  Running editorial classification…`);
    await drainForContainer(container.id, "container.editorial_classify", 60_000);

    // Read final state
    const [updated] = await db
      .select({ processingState: researchSourceContainers.processingState })
      .from(researchSourceContainers)
      .where(eq(researchSourceContainers.id, container.id));
    console.log(`   → Final state: ${updated?.processingState ?? "unknown"}`);
  }

  // ── 8. Summary ────────────────────────────────────────────────────────────
  const finalContainers = await db
    .select()
    .from(researchSourceContainers)
    .where(inArray(researchSourceContainers.id, containerIds));

  console.log(`\n${"═".repeat(60)}`);
  console.log(`Pilot upload complete.`);
  console.log(`  Batch #${batch.id}  |  ${containerIds.length} container(s)  |  ${duplicates.length} duplicate(s)`);
  console.log(`\nFinal container states:`);
  for (const c of finalContainers) {
    console.log(`  #${c.id}  ${c.originalName.padEnd(35)} ${c.processingState}`);
  }
  console.log(`\nNext step: generate the pilot report:`);
  console.log(`  pnpm --filter @workspace/scripts exec tsx ./src/generate-pilot-report.ts`);
  console.log(`${"═".repeat(60)}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
