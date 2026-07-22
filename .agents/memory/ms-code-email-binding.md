---
name: Microsoft SSO code-email binding
description: Access codes become exclusively owned by the first Microsoft email that links them, enforced across all portals.
---

Once a Microsoft account links an access code, only that email may use the code — plain code login returns 403 with a masked-owner hint, and SSO with a different email returns 403. Ownership is global per code (same MLPA code syncs to every portal). Master code never binds.

**Why:** codes were shareable; user wants one code = one Microsoft identity.

**How to apply:**
- Helpers live in the api-server `microsoft` module: `getCodeOwnerEmail` (case-insensitive, active links only), `ssoBindingError`, `codeLoginBindingError`, `maskEmail`.
- `saveLink` is the atomic claim: transaction + `pg_advisory_xact_lock` on lower(code); it returns `{ok:false, ownerEmail}` on conflict. SSO handlers must claim BEFORE issuing the session/token and 403 on failure — never link after login (TOCTOU race, caught by review).
- Any new portal login endpoint (plain or SSO) must add both checks; codes are stored with mixed casing across portals, so comparisons must be lower().
