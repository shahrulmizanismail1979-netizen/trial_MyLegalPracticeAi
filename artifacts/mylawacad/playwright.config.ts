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
// PREREQUISITE / webServer
// ------------------------
// Two upstream services must be ready before the tests run:
//
//   1. API server   – Express app on port 8080 (proxied from /api/).
//      Health check: GET http://localhost:8080/api/healthz
//
//   2. MyLawAcad    – Vite dev server on port 25700 (proxied from /mylawacad/).
//      Health check: GET http://localhost:25700/mylawacad/
//
// Playwright's `webServer` option handles this automatically:
//   • reuseExistingServer: true  — if the port is already occupied (managed
//     workflow running in the Replit dev environment) the existing process is
//     used and the `command` is never executed.
//   • If the port is NOT occupied (CI validation without pre-started services)
//     Playwright starts the service itself and waits for the health URL.
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
    // Point directly at the Vite dev server (port 25700), which proxies /api/*
    // to the Express API server on port 8080.  This avoids a dependency on the
    // Replit shared reverse-proxy at localhost:80, making the test suite
    // self-contained in any environment where the two webServer processes start.
    baseURL: "http://localhost:25700",
    launchOptions: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: [
    {
      // API server – Express on port 8080.
      // The managed workflow sets PORT automatically; replicate that here so
      // the process starts correctly when launched by Playwright.
      command:
        "PORT=8080 pnpm --filter @workspace/api-server run dev",
      url: "http://localhost:8080/api/healthz",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // MyLawAcad Vite dev server on port 25700.
      command:
        "PORT=25700 BASE_PATH=/mylawacad/ pnpm --filter @workspace/mylawacad run dev",
      url: "http://localhost:25700/mylawacad/",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
