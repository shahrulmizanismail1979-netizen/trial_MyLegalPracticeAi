import { defineConfig } from "@playwright/test";

// Browser end-to-end tests for the research platform. Uses the
// environment-provided Chromium (REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE) when
// available so no browser download is required in this environment.

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:80",
    launchOptions: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
});
