import { fileURLToPath } from "node:url";

export default {
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: [
      "src/fixtures/lawyes-preview.test.ts",
      "src/data/legal-reference-guide.test.ts",
      "src/data/public-content.test.ts",
    ],
    maxWorkers: 1,
    fileParallelism: false,
  },
};