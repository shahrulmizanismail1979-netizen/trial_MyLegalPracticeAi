# Restore Cross-App Reliability

## What & Why
Resolve every currently observed regression across LAWYes, stabilize the shared development environment, and establish a serialized verification pass for all registered apps. The goal is to stop payment, authentication, matter, research, drafting, export, and routing failures from being hidden by stale tests or process exhaustion.

## Done looks like
- Payment checkout stays in live mode, payment completion provisions the correct portal access, missed webhooks reconcile, cancellation revokes access, and customer billing access remains available
- Every configured API, payment-access, and end-to-end check passes when run in controlled batches
- Matter-file uploads reject unknown, expired, consumed, or cross-owner storage grants without breaking legitimate save/export flows
- Rights-permitted official court judgments progress through the correct reviewed and searchable states, and headnote approval responses follow one consistent contract
- MyCorpLegalAI login, specialist and shared AI drafting, completion status, saving, and exports work in the browser
- The landing page reliably renders pricing and creates a live Stripe Checkout session without blank-screen failures
- Every registered app loads at desktop and mobile widths, its authentication entry works, and its primary matter/workflow navigation has no crashes, broken links, or blocking console errors
- Preview workflows start once on their intended ports without stale duplicate processes or resource-exhaustion failures
- Any test that proves a real product defect is fixed; any stale expectation is updated only after the intended product contract is documented and verified

## Out of scope
- Charging a real customer card or mutating real customer production records during validation
- Guaranteeing availability during an external Stripe, Clerk, AI-provider, email, or hosting outage
- Adding unrelated new product features beyond repairing and validating existing implemented behavior

## Steps
1. **Stabilize the test environment** -- Remove duplicate preview ownership and stale process/port collisions, then ensure API and app workflows can start predictably without exhausting threads or database workers.
2. **Repair protected file saving** -- Restore owner-scoped, one-time storage-grant enforcement and verify legitimate uploads, retries, exports, cleanup, and cross-tenant isolation.
3. **Repair research publication states** -- Align official-source rights decisions, state transitions, indexing, and headnote approval responses without weakening deny-by-default access controls.
4. **Repair corporate authentication and drafting** -- Fix the login/session navigation failure and validate both drafting paths through completion, saving, evidence/finalisation safeguards, and Word/PDF export availability.
5. **Repair landing and checkout rendering** -- Eliminate the intermittent blank page, preserve visible failure handling, and verify pricing and live-session checkout redirects across supported plan families.
6. **Run the cross-app matrix** -- Execute API, payment, authentication, matter, AI, upload, export, and portal-routing checks serially; add focused regression coverage wherever an implemented customer flow lacks protection.
7. **Verify production-critical boundaries** -- Confirm live Stripe mode and canonical return URLs without charging a card, inspect production-safe webhook health if available, and report any external-only verification gap explicitly instead of declaring a false pass.

## Relevant files
- `artifacts/api-server/src/lib/matter-files.test.ts`
- `artifacts/api-server/src/lib/matterFiles.ts`
- `artifacts/api-server/src/routes/research-admin.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/routes/real-court-source-pipeline.test.ts`
- `artifacts/api-server/e2e/corp-draft-completion.spec.ts`
- `artifacts/mycorplegalai/src/pages/LoginPage.tsx`
- `artifacts/mycorplegalai/src/App.tsx`
- `artifacts/landing-page/src/App.tsx`
- `artifacts/landing-page/src/main.tsx`
- `.replit`
