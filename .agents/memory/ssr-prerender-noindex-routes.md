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
- Production hydrates when the root contains prerendered elements, preserving
  the first paint while Clerk initializes. Vite development serves only the
  `<!--ssr-outlet-->` comment, so the client must detect that empty-element case
  and use `createRoot`; blindly calling `hydrateRoot` there causes a mismatch.
- Initial client state for any browser preference (persona, currency, locale)
  must match the SSR default, then restore from browser APIs in a one-time effect.
- Post-merge setup only runs typecheck + db push, NOT the build. So a task that
  changes prerender/SSR wiring can merge green yet break `pnpm --filter
  @workspace/landing-page run build`. Always run the landing-page build
  (`PORT=... BASE_PATH=/ pnpm --filter @workspace/landing-page run build`) after
  any change to routing, SSR entry, or prerender before considering deploy-ready.

# Dual provider trees: entry-server has its own copy

The SSR entry does NOT reuse the client `App` — it builds its own provider tree
and renders pages directly. **Any new global React context/provider added to the
client provider tree must also wrap the SSR entry's render tree**, or the
prerender of `/` throws ("useX must be used within XProvider") and blocks
publish. This exact regression shipped once when a display-currency provider was
added client-side only. Providers must also be SSR-safe: guard `localStorage` /
`navigator` / `window` in try/catch or typeof checks (a bare `localStorage`
reference is a ReferenceError in Node).

# Vite config env requirements must be serve-only

Vite configs that hard-throw on missing `PORT`/`BASE_PATH` break `vite build`
in any context that doesn't provide workflow env (root build, deployment build
of other artifacts). Gate such checks with `defineConfig(({ command }) => ...)`
and only enforce when `command === "serve"`.
