import { expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { db, pool, researchJobs } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { enqueue, registerProcessor, runNextJob } from "./processing";
import { createIsolatedTestDb } from "./testing/testDb";
import { isIsolatedQueueSuite } from "./testing/isolatedQueueSuites";

it.each([
  "/research/drive/driveIngestCrashRecovery.test.ts",
  "/routes/research-admin.restricted.test.ts",
  "/routes/research-admin-bulk-rights.test.ts",
  "/routes/headnotes-search.test.ts",
])("isolates audited producer %s before its service imports", suite => {
  expect(isIsolatedQueueSuite(`/workspace/src${suite}`)).toBe(true);
  expect(isIsolatedQueueSuite(`C:\\workspace\\src${suite.replaceAll("/", "\\")}`)).toBe(true);
});

it("default db and pool cannot dispatch a foreign queued job to a private processor", async () => {
  // Model the shared development queue in another disposable schema: never
  // plant a runnable sentinel in public where a real worker could claim it.
  const foreign = await createIsolatedTestDb();
  try {
    const local = await pool.query("SELECT current_schema() AS schema, current_schemas(false)::text[] AS schemas");
    expect(local.rows[0].schema).toMatch(/^test_research_/);
    expect(local.rows[0].schemas).toEqual([local.rows[0].schema]);
    expect(local.rows[0].schema).not.toBe(foreign.schemaName);
    const dbSchema = await db.execute(sql`SELECT current_schema() AS schema`);
    expect(dbSchema.rows[0].schema).toBe(local.rows[0].schema);

    const dispatched: string[] = [];
    const kind = "test.isolation.boundary";
    const unregister = registerProcessor(kind, async ({ job }) => {
      dispatched.push(String(job.payload.storageKey));
      return {};
    }, { touchesContent: false });
    const sentinel = await enqueue(kind, "same-key",
      { storageKey: "foreign-private-file" }, { dbc: foreign.db });
    const owned = await enqueue(kind, "same-key",
      { storageKey: "local-private-file" });
    expect((await runNextJob(kind))?.id).toBe(owned!.id);
    expect(await runNextJob(kind)).toBeNull();
    expect(await runNextJob()).toBeNull();
    expect(dispatched).toEqual(["local-private-file"]);
    const [untouched] = await foreign.db.select().from(researchJobs)
      .where(eq(researchJobs.id, sentinel!.id));
    expect(untouched.state).toBe("QUEUED");
    expect(untouched.attempts).toBe(0);
    unregister();
  } finally {
    await foreign.drop();
  }
});

it("every direct queue-consuming suite opts into isolation", async () => {
  const root = path.resolve(__dirname, "..");
  const files = await readdir(root, { recursive: true });
  const consumers: string[] = [];
  for (const file of files.filter(file => file.endsWith(".test.ts"))) {
    const fullPath = path.join(root, file).replaceAll("\\", "/");
    const source = await readFile(fullPath, "utf8");
    if (!/\b(?:runNextJob|claimNext)\s*\(/.test(source)) continue;
    // This suite explicitly supplies its disposable client on each queue call.
    if (fullPath.endsWith("/research/domain/stateMachines.test.ts")) continue;
    consumers.push(fullPath);
  }
  expect(consumers.length).toBeGreaterThan(10);
  expect(consumers.filter(file => !isIsolatedQueueSuite(file))).toEqual([]);
});