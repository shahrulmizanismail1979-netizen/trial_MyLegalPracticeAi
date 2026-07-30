/**
 * Debug: run one inventory job for pilot container #81338 and show what happens.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db, researchSourceContainers, researchJobs } from "@workspace/db";
import { like, eq, and, sql, desc } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../../..");
const CORPUS_DIR = path.join(WORKSPACE_ROOT, "fixtures", "pilot-corpus");

// Pre-populate storage
const stored = new Map<string, Buffer>();
const { setAdapters, getAdapters } = await import("./adapters.js");

setAdapters({
  storage: {
    name: "pilot-debug",
    async put(key: string, bytes: Uint8Array) { stored.set(key, Buffer.from(bytes)); return key; },
    async get(key: string) {
      console.log(`  [storage.get] key=${key} exists=${stored.has(key)}`);
      const b = stored.get(key);
      if (!b) throw new Error(`pilot adapter: key not found: ${key}`);
      return b;
    },
    async remove(key: string) { stored.delete(key); },
  },
});

// Read containers and pre-populate storage
const containers = await db.select().from(researchSourceContainers).where(like(researchSourceContainers.sourceBatch, "pilot-v1%"));
console.log(`Found ${containers.length} pilot-v1 containers`);

for (const c of containers) {
  if (!c.storageKey) continue;
  const filePath = path.join(CORPUS_DIR, c.originalName);
  if (fs.existsSync(filePath)) {
    const bytes = fs.readFileSync(filePath);
    stored.set(c.storageKey, bytes);
    console.log(`  stored: ${c.storageKey.slice(-20)} (${bytes.length} bytes)`);
  }
}

// Verify adapter is set
const adapters = getAdapters();
console.log(`Adapter name: ${adapters.storage.name}`);

// Register processors
const { registerInventoryProcessor } = await import("./ingestion/inventory.js");
registerInventoryProcessor();

const { runNextJob } = await import("./processing/index.js");

// Reset the first failed inventory job
const containerId = containers[0]?.id;
if (!containerId) { console.error("No containers"); process.exit(1); }

console.log(`\nResetting FAILED_PERMANENT inventory job for container #${containerId}…`);
const resetResult = await db.execute(sql`
  UPDATE research_jobs
  SET state = 'QUEUED', attempts = 0, last_error = null,
      claimed_at = null, started_at = null, finished_at = null
  WHERE kind = 'container.inventory'
    AND state = 'FAILED_PERMANENT'
    AND payload->>'containerId' = ${String(containerId)}
  RETURNING id
`);
console.log(`  reset rows: ${resetResult.rowCount}`);

// Find the job
const [job] = await db.select().from(researchJobs).where(
  and(
    eq(researchJobs.kind, "container.inventory"),
    sql`payload->>'containerId' = ${String(containerId)}`,
  )
).orderBy(desc(researchJobs.id)).limit(1);
console.log(`  job #${job?.id} state: ${job?.state}`);

// Run it
console.log(`\nRunning runNextJob("container.inventory")…`);
try {
  const result = await runNextJob("container.inventory");
  console.log(`  result: ${result ? `job #${result.id} state=${result.state}` : "null (no job)"}`);
  
  // Check final state
  const [final] = await db.select().from(researchJobs).where(eq(researchJobs.id, job!.id)).limit(1);
  console.log(`  job final state: ${final?.state} lastError: ${final?.lastError}`);
  
  const [container] = await db.select().from(researchSourceContainers).where(eq(researchSourceContainers.id, containerId));
  console.log(`  container state: ${container?.processingState}`);
} catch(err) {
  console.error(`  ERROR: ${err}`);
}

process.exit(0);
