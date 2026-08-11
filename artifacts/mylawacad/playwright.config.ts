import { defineConfig } from "@playwright/test";

// Browser end-to-end tests for MyLawAcad.
//
// HOW THE URL ROUTING WORKS IN REPLIT
// ------------------------------------
// In this monorepo, all artifacts are served through Replit's shared reverse
// proxy at http://localhost:80. The proxy maps path prefixes to the individual
// Vite dev servers (e.g. /mylawacad/* → the MyLawAcad Vite process, /api/* →
// the Express API server). Setting baseURL to port 80 is therefore correct and
// is the same pattern used by every other Playwright config in this workspace
// (see artifacts/api-server/playwright.config.ts).
//
// PREREQUISITE
// ------------
// The "artifacts/mylawacad: web" and "artifacts/api-server: API Server"
// workflows must be running before you invoke `pnpm --filter
// @workspace/mylawacad run test:e2e`. In the Replit dev environment those
// workflows are managed by the Replit workflow system and are typically already
// running; in a headless CI environment start them first with
// `pnpm --filter @workspace/mylawacad run dev` (and likewise for api-server).
//
// CHROMIUM EXECUTABLE
// -------------------
// Uses REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE when set (Nix-provided binary)
// so no browser download is required. Omitting the env var falls back to
// Playwright's default browser resolution for non-Replit CI.

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:80",
    launchOptions: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
});
