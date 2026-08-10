# SECURITY_AUDIT_REPORT.md

Audit date: 2026-08-10. Scanners: dependency audit, SAST (semgrep-class), HoundDog dataflow scan, plus manual auth/access review.

## Fixed during this audit

| ID | Severity | Finding | Fix |
|---|---|---|---|
| S1 | **P1** | CORS reflected any origin with `credentials: true` (`app.ts`) — any website could make cookie-authenticated requests to the API (CSRF-class exposure for cookie-session portals: Crim, Lit, Sya, Acad, Accident). | Replaced with an origin allowlist (own dev/prod domains + localhost + `CORS_EXTRA_ORIGINS` env). Verified: hostile origin gets no ACAO header; own domain allowed. |
| S2 | **P1** | No brute-force rate limiting on 13 portal login / access-code / SSO endpoints (Lit, Crim, CCB, Corp, Convey, Acad, Accident). Only Syariah and Firm had protection. | Shared `loginRateLimit` (20 attempts / 15 min / IP, `trust proxy` already configured) applied to every login endpoint. |
| S3 | High | 14 high-severity dependency vulnerabilities (picomatch, brace-expansion ×2 majors, drizzle-orm CVE-2026-39356, vite ×3 CVEs, ip-address, undici, dompurify via jspdf). | pnpm overrides force patched versions; lockfile verified; full workspace builds and boots. |
| S4 | P2 | Stale TypeScript project-reference declarations (`lib/db/dist`) made `tsc` fail workspace-wide — type errors could ship undetected (task #118). | `tsc -b` rebuild; whole workspace typechecks clean. |

## Reviewed — no action needed (false positives / accepted)

| Finding | Assessment |
|---|---|
| SAST: open-redirect in `microsoft/index.ts`, `acad/routes/oauth.ts` | Redirect targets are fixed `APP_LOGIN_PATHS` entries, MSAL-generated URLs, or pass through `safeNext()` which only allows same-origin paths. Not exploitable. |
| SAST: session fixation in `firm/routes/session.ts` | Cookie is server-signed (`signed: true`), SameSite=Strict, gated by app key + known-user check. Acad OAuth regenerates the session on login. Not exploitable. |
| HoundDog: "password sent to stdout" in `scripts/src/import-convey-users.ts`, `push-convey-users-to-prod.ts` | Scripts print **counts** of password hashes, never values. Operator-only tooling. |
| SAST: session fixation in `routes/accident.ts` | Session ID is randomly generated server-side; cookie flags correct (httpOnly, secure in prod, SameSite=Lax). |
| pdfjs-dist CVE (high) | Fix requires major upgrade 5→6 (breaking API). Used server-side on trusted-ish uploaded PDFs. **Deferred — tracked as tech debt.** |

## Outstanding risks (not fixed in this pass — recommend follow-up)

1. **Lit conversation isolation (existing task #112)** — verify per-access-code scoping of litigation AI chats end-to-end.
2. **localStorage JWTs (CCB, Convey)** — XSS-theft exposure; acceptable trade-off vs CSRF but keep CSP tight.
3. **Expiry semantics** — in Convey, a missing subscriber/expiry record is treated as non-expiring; confirm this matches business intent.
4. **Portal-specific `/admin` routes** live outside the global Clerk staff gate; each has its own auth (ADMIN_PASSWORD fails closed in prod) — periodically re-audit.
5. **pdfjs-dist major upgrade** (see above).

## Posture summary
- Cookies: httpOnly + secure-in-prod + SameSite lax/strict across portals. ✔
- Webhooks: Stripe signature verified by stripe-replit-sync; provisioning idempotent via unique `stripe_subscription_id`. ✔
- Secrets: managed via Replit env; dev-only fallbacks fail closed in prod (ADMIN_PASSWORD / MASTER_ACCESS_CODE). ✔
- Dependency audit after fixes: 0 critical, remaining highs limited to pdfjs-dist (deferred, documented).
