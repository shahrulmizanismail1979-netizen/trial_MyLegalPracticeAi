import { fileURLToPath } from "node:url";

export default {
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: [
      "src/fixtures/lawyes-preview.test.ts",
      "src/data/legal-reference-guide.test.ts",
      "src/data/public-content.test.ts",
      "src/components/admin/portal-access-check.test.tsx",
    ],
    maxWorkers: 1,
    fileParallelism: false,
  },
};