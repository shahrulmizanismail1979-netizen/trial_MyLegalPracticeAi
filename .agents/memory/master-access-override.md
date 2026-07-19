---
name: Master access code override
description: How the single MASTER_ACCESS_CODE grants full access across every portal
---

The owner override code (`MASTER_ACCESS_CODE` secret) unlocks full/admin access in every portal. Each portal implements it independently at its login route — there is no shared helper.

**Why:** the user wants one code to open everything; portals have divergent auth (session cookies, JWT/localStorage, access-code vs email+password), so the override lives per-portal.

**How to apply / login endpoints (all take the code):**
- acad (MyLawAcad): `POST /api/acad/auth/login` `{email, password: code}` — synthetic master user `master-override@mylawacad.local` (no password hash); reserved email blocked from registration.
- lit vault: `POST /api/lit/auth/login` `{password}`
- sya: `POST /api/sya/auth/verify` `{accessCode}` (MASTER_MIN_LENGTH 6)
- crim: `POST /api/crim/auth/verify` `{accessCode}`
- accident: `POST /api/accident/auth/verify-code` `{code}`
- convey: `POST /api/convey/auth` `{accessCode}` — master account upserted at api-server boot, so restart after changing the secret
- ccb: `POST /api/ccb/auth/verify` `{code}`
- corp: `POST /api/corp/legal/verify-password` `{password}` — MASTER-OVERRIDE sentinel row upserted at boot

**Rules for a synthetic master account (acad/corp/convey pattern):** on conflict, force the row fully synthetic — `passwordHash: null`, clear oauth fields — so it can never be logged into via the normal password/OAuth path. Fail closed when the secret is unset; use constant-time comparison.
