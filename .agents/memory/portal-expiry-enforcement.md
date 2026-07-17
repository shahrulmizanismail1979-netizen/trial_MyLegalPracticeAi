---
name: Portal access-code expiry enforcement
description: Expiry must be re-checked per-request, not just at login, across all 6 portals
---

Rule: an access code's `expires_at` must be enforced at login AND on every authenticated request, because sessions (sya) and 7-day JWTs (ccb) outlive the code.

**Why:** architect review found expired codes kept working after login — sya's global tier-gate middleware in `sya/routes/index.ts` only checked `session.userId`, and ccb JWTs were never re-validated against the DB.

**How to apply:** any new gated route or portal must go through the per-request check: sya uses `ensureCodeNotExpired` (called in requireAuth/requireFeature and the tier-gate middleware); ccb uses `requirePractitioner` mounted before tools/gemini routers (static/env codes are exempt). CCB frontend fetches must send `Authorization` via `authHeaders()` — unauthenticated tool/conversation fetches will now 401.
