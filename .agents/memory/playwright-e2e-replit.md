---
name: Playwright e2e in this Replit monorepo
description: How browser e2e tests run here without downloading browsers, and auth constraints
---

# Playwright e2e in this Replit monorepo

- Do NOT run `playwright install` — browser downloads are unnecessary. Point
  Playwright at the Nix-provided Chromium via the
  `REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE` env var
  (`launchOptions.executablePath` / `use.launchOptions` in
  `playwright.config.ts`).
- **Why:** downloaded browsers miss system libs in the Nix environment; the
  provided executable works out of the box.
- baseURL must be the shared proxy (`http://localhost:80`), never a direct
  service port.
- Keep e2e specs out of vitest's reach: vitest `include` limited to
  `src/**/*.test.ts`; Playwright uses `testDir: e2e/`.
- Clerk staff sessions cannot be minted headlessly, so e2e against staff-only
  APIs asserts the 401 default-deny posture instead of bypassing auth.

**How to apply:** any new e2e suite in api-server or portals — copy
`artifacts/api-server/playwright.config.ts` pattern; run via
`pnpm --filter <pkg> run test:e2e`.

- Preview artifact workflows may be `NOT_STARTED` even when the deployment
  sidecar is present. Start or restart the API and target frontend workflows
  before browser validation if the shared proxy returns 502.
- **Why:** Playwright cannot reach a static artifact or API route until its
  owning managed workflow is serving, and the resulting navigation error looks
  like a test failure rather than an application assertion failure.
- **How to apply:** check workflow status and restart only the API plus the
  target artifact before rerunning a failed browser suite.
