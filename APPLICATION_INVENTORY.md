# APPLICATION_INVENTORY.md

Audit date: 2026-08-10. Monorepo: pnpm workspace ("MyLegalPracticeAI").

## 1. Technology stack
- TypeScript ~5.9, pnpm workspaces, TS project references (`tsc -b`).
- Backend: Node + Express 5, Drizzle ORM 0.45.2, PostgreSQL (Replit-managed), Zod, Pino, Multer, JWT, bcrypt, pdf-parse/DOCX tooling, esbuild bundling.
- Frontends: React 19, Vite 7.3.6, Wouter, TanStack Query, Tailwind 4, Radix UI, Framer Motion, React Hook Form, Recharts, Clerk React (landing/admin).
- Shared libs (`lib/`): `db` (Drizzle schema), `api-spec` (OpenAPI) + `api-zod`, `api-client-react`, `entitlements`, `tiers`, `draft-export`, `object-storage-web`, Gemini/OpenAI integration wrappers.

## 2. Artifacts (apps)
| Artifact | Path | Purpose |
|---|---|---|
| api-server | `/api` | Consolidated backend for all portals |
| landing-page | `/` | Marketing site, pricing/checkout, admin dashboard, contribution flows |
| mylitai | `/mylitai/` | Civil litigation portal |
| mylitai-irac | `/mylitai-irac/` | IRAC case-analysis tool |
| mysyariahai | `/mysyariahai/` | Syariah portal |
| mycrimai | `/mycrimai/` | Criminal law portal |
| mycorplegalai | `/mycorplegalai/` | Corporate legal portal |
| myconveylitai | `/myconveylitai/` | Conveyancing portal |
| myccblitai | `/myccblitai/` | Corporate/commercial/banking litigation portal |
| myaccidentai | `/myaccidentai/` | Accident/personal injury portal |
| mylawfirmai | `/mylawfirmai/` | Law-firm management (sold separately, not in landing picker) |
| mylawacad | `/mylawacad/` | Academic portal (exams, studio) |
| mockup-sandbox | `/__mockup` | Internal design sandbox (not a product) |

## 3. Backend route groups (`artifacts/api-server/src`)
- General: `routes/` — health, stats, currency, access codes, auth, storage, assistant (AI receptionist), contributions, stripe (checkout/webhook/session-info), accident portal, convey portal + matters + subscription, admin/* (dashboard, subscribers, kohorts, pricing, vouchers, contributions, stripe, app-stats).
- Modules: `acad/` (incl. Microsoft OAuth, exams, studio), `ccb/`, `corp/`, `crim/` (incl. voice), `firm/`, `lit/`, `sya/`, `research/` (judgment ingestion/validation pipeline), `microsoft/` (shared Entra SSO).

## 4. Data & persistence
- PostgreSQL via Drizzle; schema in `lib/db/src/schema/` (per-portal prefixed tables: `lit_*`, `crim_*`, `sya_*`, `ccb_*`, `corp_*`, `firm_*`, `acad_*`, plus subscribers, vouchers, contributions, research, stripe.* synced schema).
- Object storage (Replit App Storage) for uploads; presigned upload ownership registry in DB.

## 5. Auth
- Clerk: staff/admin (landing admin dashboard), multi-domain publishable key resolution.
- Portal access codes (session or JWT depending on portal); Convey/CCB use Bearer JWT (localStorage); Crim/Lit/Sya/Acad use cookie sessions.
- Microsoft Entra ID SSO shared at `/auth` + per-app `/sso` exchange; code-email binding.
- MASTER_ACCESS_CODE override across all portals; ADMIN_PASSWORD for admin endpoints (fails closed in prod).

## 6. External services
- AI: Gemini + OpenAI via Replit AI Integrations proxy; ElevenLabs (voice/STT via object-storage staging).
- Payments: **Stripe only** (stripe-replit-sync, managed webhook, checkout, provisioning → portal access codes). **No ToyyibPay anywhere.**
- Email: Gmail integration (access-code delivery, notifications).

## 7. Jobs & webhooks
- Research job worker (polling loop in `src/index.ts`).
- Boot-time: Stripe sync, webhook registration (prod only), `reconcileMissedProvisioning`, portal access-code backfill, boot-seeding of content tables.
- Inbound webhook: `POST /api/stripe/webhook` (idempotent provisioning keyed on unique `stripe_subscription_id`).

## 8. Test infrastructure
- `api-tests` workflow: Vitest integration suite — 35 files, 521 tests (all passing as of this audit).
- Playwright available for e2e (REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE).
