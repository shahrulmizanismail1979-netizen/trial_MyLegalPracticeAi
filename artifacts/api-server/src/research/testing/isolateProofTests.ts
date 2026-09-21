import { afterAll, afterEach, beforeAll, expect, vi } from "vitest";
import { isIsolatedQueueSuite, isolatedProducerSuites } from "./isolatedQueueSuites";

// Install before the test module imports any services. Injecting only the
// runNextJob client is insufficient: downstream services also use the default
// db/pool. Never include public in search_path as a missing table must fail.
const testPath = expect.getState().testPath?.replaceAll("\\", "/") ?? "";
if (isIsolatedQueueSuite(testPath)) {
  const { createIsolatedTestDb } = await import("./testDb");
  const actual = await vi.importActual<typeof import("@workspace/db")>("@workspace/db");
  const isolated = await createIsolatedTestDb({ throughPhase08: true });
  vi.doMock("@workspace/db", () => ({
    ...actual,
    db: isolated.db,
    pool: isolated.pool,
  }));
  // Exercise the real claim implementation against a separate empty worker
  // schema while each producer's actual jobs still exist. Never plant or claim
  // sentinel jobs in public: a development worker may already be running.
  const producer = isolatedProducerSuites.some(suite => testPath.endsWith(suite));
  const sharedWorker = producer ? await createIsolatedTestDb() : undefined;
  let observedRunnableJob = false;
  if (sharedWorker) {
    beforeAll(async () => {
      const { db, pool } = await import("@workspace/db");
      expect(db).toBe(isolated.db);
      expect(pool).toBe(isolated.pool);
      const schema = await pool.query("SELECT current_schemas(false)::text[] AS schemas");
      expect(schema.rows[0].schemas).toEqual([isolated.schemaName]);
    });
    afterEach(async () => {
      const { claimNext } = await import("../processing");
      const before = await isolated.pool.query("SELECT * FROM research_jobs ORDER BY id");
      observedRunnableJob ||= before.rows.some(row => row.state === "QUEUED");
      expect(await claimNext(undefined, sharedWorker.db)).toBeNull();
      for (const kind of new Set(before.rows.map(row => row.kind as string))) {
        expect(await claimNext(kind, sharedWorker.db)).toBeNull();
      }
      const after = await isolated.pool.query("SELECT * FROM research_jobs ORDER BY id");
      expect(after.rows).toEqual(before.rows);
    });
  }
  afterAll(async () => {
    vi.doUnmock("@workspace/db");
    try {
      if (sharedWorker) expect(observedRunnableJob, "producer proof must exercise runnable jobs").toBe(true);
    } finally {
      try {
        await isolated.drop();
      } finally {
        await sharedWorker?.drop();
      }
    }
  });
}