import { afterAll, expect, vi } from "vitest";

// Install before the test module imports any services. Injecting only the
// runNextJob client is insufficient: downstream services also use the default
// db/pool. Never include public in search_path as a missing table must fail.
const testPath = expect.getState().testPath?.replaceAll("\\", "/") ?? "";
if (/\/research\/(?:phase0[3-8]|queueIsolation[AB])\.test\.ts$/.test(testPath)) {
  const { createIsolatedTestDb } = await import("./testDb");
  const actual = await vi.importActual<typeof import("@workspace/db")>("@workspace/db");
  const isolated = await createIsolatedTestDb({ throughPhase08: true });
  vi.doMock("@workspace/db", () => ({
    ...actual,
    db: isolated.db,
    pool: isolated.pool,
  }));
  afterAll(async () => {
    vi.doUnmock("@workspace/db");
    await isolated.drop();
  });
}