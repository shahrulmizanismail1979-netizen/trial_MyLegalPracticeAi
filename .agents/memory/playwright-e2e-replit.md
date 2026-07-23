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
