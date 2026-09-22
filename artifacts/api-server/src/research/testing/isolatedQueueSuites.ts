/** Enqueue-only suites also need isolation: a live worker can claim their jobs. */
export const isolatedProducerSuites = [
  "/research/drive/driveIngestCrashRecovery.test.ts",
  "/routes/research-admin.restricted.test.ts",
  "/routes/research-admin-bulk-rights.test.ts",
  "/routes/research-admin-headnotes-approval.test.ts",
];

/** Suites whose services must import a schema-local default db AND pool. */
export function isIsolatedQueueSuite(testPath: string): boolean {
  const normalized = testPath.replaceAll("\\", "/");
  return /\/research\/(?:phase0[2-8]|pilot|stress|research|queueIsolation(?:[AB]|Boundary))\.test\.ts$/.test(normalized)
    || /\/research\/phase12d-security\.test\.ts$/.test(normalized)
    || /\/routes\/headnotes-search\.test\.ts$/.test(normalized)
    || isolatedProducerSuites.some(suite => normalized.endsWith(suite));
}
