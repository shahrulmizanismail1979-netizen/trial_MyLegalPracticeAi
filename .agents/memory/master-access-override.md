---
name: Master access code override
description: How the single MASTER_ACCESS_CODE grants full access across every portal
---

The owner override (`MASTER_ACCESS_CODE` secret) is intended to grant access across practitioner portals and administrator login surfaces, alongside existing administrator credentials. Never store the actual code in source or memory.

**Why:** The user explicitly requested one securely configured credential for all app access, including administration. Portals have divergent session and login mechanisms; one accepted comparison does not prove downstream access works.

**How to apply:** Keep the master login distinct from subscriber identity. Synthetic tenant identifiers are never credentials: reject them from normal login and SSO paths. Keep original subscriber and administrator access working. Shared administrator access does not replace attributed legal-review sign-off, and public Sarawak checkout/billing must not gain a payment or account-ownership bypass.

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
