/** Suites whose services must import a schema-local default db AND pool. */
export function isIsolatedQueueSuite(testPath: string): boolean {
  const normalized = testPath.replaceAll("\\", "/");
  return /\/research\/(?:phase0[2-8]|pilot|stress|research|queueIsolation(?:[AB]|Boundary))\.test\.ts$/.test(normalized)
    || /\/routes\/headnotes-search\.test\.ts$/.test(normalized);
}