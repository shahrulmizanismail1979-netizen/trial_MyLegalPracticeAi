import { expect, it } from "vitest";
import { BroadcastChannel } from "node:worker_threads";
import { db, pool, researchJobs, researchSourceContainers } from "@workspace/db";
import { setAdapters } from "../adapters";
import { processUpload, registerIngestionProcessors } from "../ingestion/service";
import { registerInventoryProcessor, startInventory, getLatestInventory } from "../ingestion/inventory";
import { recordRightsDecision, type RightsDecision } from "../data/rights";
import { getBatchItem } from "../data/uploads";
import { runNextJob } from "../processing";

// With RESEARCH_ISOLATION_PROOF=1, run both files with two thread workers.
// The barrier ensures both queues contain colliding fixture/job IDs before
// either worker drains them. Ordinary sequential suite runs need no barrier.
async function meetPeer(worker: string, stage: string, schema: string) {
  if (process.env.RESEARCH_ISOLATION_PROOF !== "1") return;
  const channel = new BroadcastChannel(`research-isolation-${process.pid}-${stage}`);
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`No concurrent isolation peer at ${stage}`));
      }, 15_000);
      const send = () => channel.postMessage({ worker, schema });
      const interval = setInterval(send, 30);
      channel.onmessage = ({ data }) => {
        if (data.worker === worker) return;
        send();
        clearTimeout(timer);
        clearInterval(interval);
        if (data.schema === schema) reject(new Error("Workers share a schema"));
        else resolve();
      };
      send();
    });
  } finally {
    channel.close();
  }
}

export function queueIsolationProof(worker: string) {
  it("ingests and inventories only this worker's fixtures, even with colliding IDs", async () => {
    const { rows: [{ schema }] } = await pool.query("SELECT current_schema() AS schema");
    expect(schema).toMatch(/^test_research_/);
    const storage = new Map<string, Buffer>();
    const reads: string[] = [];
    const previous = setAdapters({
      storage: {
        name: `isolated-${worker}`,
        async put(key, bytes) { storage.set(key, Buffer.from(bytes)); return key; },
        async get(key) {
          reads.push(key);
          const bytes = storage.get(key);
          if (!bytes) throw new Error(`${worker} read a foreign storage key: ${key}`);
          return bytes;
        },
        async remove(key) { storage.delete(key); },
      },
    });
    try {
      registerIngestionProcessors();
      registerInventoryProcessor();
      // Identical bytes deliberately test that dedup is schema-local too.
      const bytes = Buffer.from("IN THE HIGH COURT OF MALAYA\n[2026] 1 MLJ 42\nAlpha v Beta\nJUDGMENT\nSynthetic text only.");
      const upload = await processUpload([{ originalName: "same.txt", bytes }], {
        declaredSource: worker, uploadedBy: worker, provenance: { worker },
      });
      expect(upload.items).toHaveLength(1);
      await meetPeer(worker, "ingest", schema);
      const ingestion = await runNextJob("container.ingest");
      expect(ingestion?.payload["batchItemId"]).toBe(upload.items[0].id);
      expect(await runNextJob("container.ingest")).toBeNull();
      const item = await getBatchItem(upload.items[0].id);
      expect(item?.state).toBe("INGESTED");
      const containers = await db.select().from(researchSourceContainers);
      expect(containers).toHaveLength(1);
      expect(containers[0].uploadedBy).toBe(worker);
      const containerId = item!.containerId!;
      const decision: RightsDecision = {
        status: "PRIVATE_PROCESSING_APPROVED", reason: "synthetic isolation proof",
        source: "synthetic", dateObtained: new Date(), declaredSourceType: "official_court",
        licenceReference: null, approvedUsers: [worker], approvedPurposes: ["research"],
        storagePermitted: true, analysisPermitted: true, externalProcessingPermitted: false,
        studentAccessPermitted: false, printingPermitted: false, exportPermitted: false,
        retentionPeriod: null, expiryDate: null, reviewer: worker, reviewDate: new Date(), notes: null,
      };
      await recordRightsDecision(containerId, decision, { actor: worker });
      const inventory = await startInventory(containerId, worker);
      await meetPeer(worker, "inventory", schema);
      expect((await runNextJob("container.inventory"))?.id).toBe(inventory.jobId);
      expect(await runNextJob("container.inventory")).toBeNull();
      expect((await getLatestInventory(containerId))?.textCharCount).toBeGreaterThan(0);
      expect(reads.length).toBeGreaterThan(0);
      const jobs = await db.select().from(researchJobs);
      expect(jobs.filter(job => ["FAILED", "DEAD_LETTER"].includes(job.state))).toEqual([]);
      expect(jobs.filter(job => ["container.ingest", "container.inventory"].includes(job.kind))
        .every(job => job.state === "SUCCEEDED")).toBe(true);
    } finally {
      setAdapters(previous);
    }
  }, 40_000);
}