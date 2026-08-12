---
name: AI rate-limit visibility
description: Contract between the API's draft-8 rate-limit headers and the portals' quota-warning UI
---
Portal frontends warn lawyers before an AI 429 by reading the server's **draft-8** rate-limit headers. Draft-8 emits `RateLimit: "<policy>"; r=<remaining>; t=<reset-seconds>` — there is **no** `RateLimit-Remaining` header (that's draft-6/7).

**Why:** A merged implementation once parsed `RateLimit-Remaining` and silently never warned until the 429; the format mismatch is invisible in typechecks.

**How to apply:** Any client-side quota UI must parse `r=`/`t=` from the `RateLimit` header. An api-server contract test guards the emitted format — keep it in sync if the limiter config changes. Every portal with AI calls must mount a warning component; CORS must expose the RateLimit headers for cross-origin dev.
