---
name: AI rate limiter auth ordering
description: Auth must run before the shared subscriber-keyed AI rate limiter or unauth traffic collapses into the __noauth__ bucket
---

# Auth before the AI rate limiter

The shared subscriber-keyed AI rate limiter falls back to a single `__noauth__` bucket when no portal identity is present. Any route where the limiter runs before auth lets unauthenticated scripted traffic drain that shared bucket (and can even 429 other portals' traffic).

**Why:** three real leaks were found and fixed: (1) the convey router is mounted at the API root, so its POST AI-limit wrapper matched EVERY `/api/*` POST until scoped to `/convey/`; (2) lit's and sya's session gates intentionally pass unauthenticated requests through, so their AI mounts needed explicit auth checks before the limiter; (3) an acad admin AI route ran the limiter before its admin check.

**How to apply:** when adding an AI route or portal: put the portal's auth/session-requiring middleware strictly before the AI limiter; for routers mounted at the API root, path-scope any `router.use` middleware; don't assume a "session gate" rejects unauthenticated requests — several only validate sessions that exist. A full-app regression test (`aiRateLimit-noauth` test in the api-server lib tests) sweeps every AI endpoint unauthenticated with limit=1 and asserts the `__noauth__` bucket stays untouched — add new AI endpoints to its list.
