---
name: SSR prerender for interactive/noindex routes
description: Why the landing-page build must not let interactive/noindex route prerendering be fatal, and how prerender + client mount actually work here.
---

# SSR prerender of interactive / noindex routes must be non-fatal

The landing-page `build` runs `vite build && node prerender.mjs`. `prerender.mjs`
SSR-renders routes via `renderToString` and injects HTML into each route's static
HTML template at the `<!--ssr-outlet-->` placeholder.

**Rule:** only routes that are actually indexed (e.g. `/`) should fail the build
if their SSR render throws. Interactive, `noindex` routes (e.g. `/contribute`, a
file-upload form) must wrap their prerender in try/catch and fall back to client
rendering — never `process.exit(1)`.

**Why:** SSR of a `noindex` interactive page carries no SEO value (its metadata
lives in the static per-route HTML template, and the client mounts fresh anyway).
But such pages pull in browser-only hooks — e.g. a hook using
`useSyncExternalStore` without a `getServerSnapshot` — which throw during
`renderToString` ("Missing getServerSnapshot, which is required for server-rendered
content"). Letting that crash the whole build turns a harmless page into a
publish-blocking failure. This exact regression shipped once via an SEO/crawlability
change that added `/contribute` to the prerender list without verifying the build.

**How to apply:**
- The client mounts with `createRoot` (not `hydrateRoot`), so the SSR HTML is
  discarded on the client regardless — a missing/unreplaced `<!--ssr-outlet-->`
  for a client-rendered route is harmless.
- Post-merge setup only runs typecheck + db push, NOT the build. So a task that
  changes prerender/SSR wiring can merge green yet break `pnpm --filter
  @workspace/landing-page run build`. Always run the landing-page build
  (`PORT=... BASE_PATH=/ pnpm --filter @workspace/landing-page run build`) after
  any change to routing, SSR entry, or prerender before considering deploy-ready.
