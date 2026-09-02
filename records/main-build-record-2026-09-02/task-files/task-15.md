---
title: Integrate MyConveyLitAI app into this project
---
# Integrate MyConveyLitAI App

## What & Why
Incorporate the uploaded MYConveyAI application (extracted at `/tmp/myconvey`, source ZIP at `attached_assets/MYConveyAI-full_1783946744210.zip`) into this project as a fully working app, rebranded **MyConveyLitAI**. It is a Malaysian conveyancing legal-practice platform: React frontend (dashboard with 6 education sections, 39 Gemini AI tools, admin panel), Express API (~37 routes under `/api/convey/*`), its own users/auth (dual login: legacy email+password and access codes), subscriptions via Stripe, and 4 DB tables (`users`, `conversations`, `messages`, `ai_usage` — no collision with existing tables).

## Done looks like
- MyConveyLitAI app loads at the `/myconveylitai` path (new web artifact) with all pages working: home, login, signup, dashboard (all 6 sections), pricing, admin.
- All 39 AI tools respond (Gemini via Replit AI integration).
- Dual login works: access codes and legacy email+password; master code and admin seeding preserved.
- Subscriptions/checkout flow works end-to-end against the existing Stripe setup (test mode).
- Access codes sold on the main landing page for the conveyancing product also unlock this app (one synced system), while the app's own signup keeps working.
- Landing page's MyConveyAI card is updated to point to the hosted MyConveyLitAI app and renamed accordingly.
- Deployment build (`pnpm run build` + landing-page prerender) passes; nothing existing breaks.

## Out of scope
- Migrating the ~107 legacy student accounts' data (separate follow-up task).
- Live Stripe keys / production products.
- SMS or email delivery changes.

## Steps
1. Copy the convey-app frontend into a new web artifact registered at previewPath `/myconveylitai` (use the artifacts skill; unique PORT/BASE_PATH; keep its dark-gold theme). Rebrand all user-facing "MYConveyAI" strings to "MyConveyLitAI"; keep the `MYCV-` access-code prefix for compatibility.
2. Merge the uploaded API server's routes, middleware, and libs into the existing api-server (convey routes, convey admin, subscription, convey stripe webhook, JWT auth, access-code generation, docx export, ElevenLabs TTS helper). Mount under the existing `/api` prefix so paths stay `/api/convey/*`. Add needed deps (bcryptjs, jsonwebtoken, cookie-parser, docx). Keep startup seeding/backfill logic (master user, admin, access-code backfill) — note `access_code` column must stay NULLABLE (documented production data-loss incident in the source project).
3. Merge the 4 new tables into `lib/db` schema and push (dev). No table renames needed.
4. Port `lib/integrations-gemini-ai` as a new lib in this workspace (register in root tsconfig references) and verify the Gemini AI integration is available in this project (check/add via integrations flow if missing).
5. Merge the uploaded OpenAPI spec paths/schemas into the existing `lib/api-spec/openapi.yaml` (resolve any operationId/schema-name collisions; do NOT change info.title) and run codegen; point the frontend at generated hooks where it used them.
6. Access-code sync: when a landing-page purchase provisions a conveyancing-product subscriber, also create/activate a MyConveyLitAI user with that same access code so the code works in the app; the app's `/convey/auth` should accept these codes.
7. Update the landing page apps list: rename the conveyancing card to MyConveyLitAI and link to `/myconveylitai` instead of the external domain.
8. Verify end-to-end: typecheck, root build including landing-page prerender, app loads at `/myconveylitai`, login/signup, at least one AI tool, checkout in Stripe test mode, and existing landing/admin features unaffected. Env vars needed: `ADMIN_PASSWORD`, optional `MASTER_ACCESS_CODE` (defaults exist); `SESSION_SECRET` and `DATABASE_URL` already present.

Critical constraints: artifacts must not import each other — share code only via `lib/*`. Any new React provider added to the landing page client tree must also be added to its SSR entry. Vite configs must not hard-require PORT/BASE_PATH at build time.

## Relevant files
- `attached_assets/MYConveyAI-full_1783946744210.zip`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/lib/provisioning.ts`
- `artifacts/api-server/src/stripeClient.ts`
- `lib/db/src/schema/index.ts`
- `lib/api-spec/openapi.yaml`
- `artifacts/landing-page/src/components/apps-grid.tsx`
- `artifacts/landing-page/src/entry-server.tsx`