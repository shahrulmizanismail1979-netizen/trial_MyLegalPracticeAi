import { fileURLToPath } from "node:url";

// Reuse the workspace API server's Vitest runner without relinking the frontend.
export default {
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/lib/irac-api.test.ts"],
    maxWorkers: 1,
    fileParallelism: false,
  },
};