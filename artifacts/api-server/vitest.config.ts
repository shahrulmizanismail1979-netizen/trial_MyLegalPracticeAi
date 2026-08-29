import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    // Node 24 can emit an unhandled EPIPE when Vitest's default fork worker
    // exits while the parent is scheduling the next long-running DB suite.
    // Threads avoid that child-process IPC failure while preserving isolation.
    pool: "threads",
    maxWorkers: 1,
  },
});
