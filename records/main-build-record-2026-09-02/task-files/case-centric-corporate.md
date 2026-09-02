# Case-Centric UI — MyCorpLegalAI, MyCCBLitAI & MyConveyLitAI

## What & Why
Transform the three corporate/commercial portals so that matter/transaction management is the primary experience, with AI tools launched from within a case. Each portal has a distinct transaction lifecycle: corporate advisory has retainer matters, CCBLitAI has banking litigation files, and MyConveyLitAI has property transactions (SPA, tenancy, strata).

## Done looks like
- **Default home is the case dashboard** for all three portals: first screen after login shows active matters/transactions with status badge, next key date countdown, and AI-suggested next action per matter.
- **Matter detail command center** (same tab structure as other portals): Overview (AI summary + risk + next steps), Timeline, Documents, Checklist, Team (client + counterparty card), Time (billing entries), and for Convey — a Transaction Progress tracker.
- **Corporate stages** (MyCorpLegalAI): Instruction → Due Diligence → Advisory → Opinion Delivered → Closed.
- **Banking/Commercial stages** (MyCCBLitAI): Pre-action → Filing → Interlocutory → Trial → Judgment → Enforcement.
- **Conveyancing stages** (MyConveyLitAI): Instruction → SPA Execution → Financing → Stamping → Completion → Registration. Auto-checklist maps to real conveyancing workflow (SPA, loan docs, CKHT, Form 14A, etc.).
- **AI insights**: Overview tab shows AI-generated matter summary (from filed opinions/documents), risk rating, and next-step recommendations for the specific transaction/litigation type.
- **Launch AI tools from inside a matter**: every tool (Legal Opinion drafting, banking litigation cause papers, conveyancing documents) is launchable from within the matter, pre-filled with parties, matter type, and file reference.
- **Client + counterparty card**: Team tab shows client and counterparty (bank/vendor/purchaser) contacts linked to the matter.
- **Time recording**: Time tab with entries and running total (especially important for corporate billing).
- **Google Calendar sync**: key transaction dates (completion date, filing deadlines, title search validity) synced to Google Calendar.

## Out of scope
- Invoicing / PDF billing statements
- Multi-user firm access
- Mobile app
- MyLawFirmAI (firm management product, separate concept)

## Steps
1. **Case dashboard home** — Replace default authenticated route in all three portals with a matters-first dashboard showing transaction/case cards (status badge, next date countdown, AI next-step snippet).
2. **Matter detail tabs** — Restructure matter detail into Overview / Timeline / Documents / Checklist / Team / Time tabs; Convey adds a Transaction Progress tab.
3. **AI insights component** — Call `GET /api/corp/matters/:id/ai-insights`, `/api/ccb/matters/:id/ai-insights`, `/api/convey/matters/:id/ai-insights`; render summary, risk badge, and ordered next-steps.
4. **Stage stepper** — Portal-specific stage progressions displayed as clickable steppers; PATCH `/api/*/matters/:id/status`; history on hover.
5. **Visual timeline** — Chronological vertical timeline merging deadlines, document filings, and transaction milestones.
6. **Checklist tab** — Auto-generated procedural checklist (backend creates on matter creation); tick-off, progress fraction, custom item addition.
7. **Pre-filled AI tool launch** — "Draft for this matter" / "Review document" buttons passing matter context (parties, type, file ref) to the relevant tool pages.
8. **Client + counterparty management** — Team tab with client and counterparty cards; `/api/*/clients`; link-client prompt on new matter.
9. **Time recording** — Time tab with entry list and "+ Log time" form; running totals.
10. **Google Calendar sync** — Sync key dates button; OAuth flow if not connected; calendar icon on synced dates.

## Relevant files
- `artifacts/mycorplegalai/src/App.tsx`
- `artifacts/mycorplegalai/src/pages/` (DashboardPage, matters pages)
- `artifacts/myccblitai/src/App.tsx`
- `artifacts/myccblitai/src/pages/` (WorkspaceIndex, matters pages)
- `artifacts/myconveylitai/src/App.tsx`
- `artifacts/myconveylitai/src/pages/` (Dashboard, matters pages)
- `artifacts/api-server/src/routes/` (corp, ccb, convey matter routes)
- `.agents/memory/portal-matter-files.md`
- `.agents/memory/ccb-integration-pattern.md`
- `.agents/memory/convey-access-code-sync.md`
