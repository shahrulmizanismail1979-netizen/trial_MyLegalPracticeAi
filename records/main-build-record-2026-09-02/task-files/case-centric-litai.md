# Case-Centric UI — MyLitAI & MyLitAI IRAC

## What & Why
Transform MyLitAI and MyLitAI-IRAC so that case/matter management is the primary experience, with AI tools accessible from within a case rather than as standalone pages. Lawyers open the app, see their active matters, and everything flows from there.

## Done looks like
- **Default home is the case dashboard**: the first screen after login shows active matters sorted by most-recently-updated, each card showing client name, file ref, case status badge, next pending deadline countdown, and a one-line AI next-step. "New matter" is the primary action.
- **Matter detail is the command center**: opening a matter shows a tabbed layout — Overview (AI summary + risk badge + status), Timeline (visual vertical timeline of deadlines and filed events), Documents (all filed drafts), Checklist (auto-generated procedural checklist with tick-off), Team (client contact card), Time (billing entries + running total), and Diary (existing).
- **AI insights panel**: the Overview tab renders the AI-generated case summary, risk rating (Low / Medium / High with colour), and ordered next-steps list, each with a suggested deadline. A "Refresh insights" button re-fetches from the backend.
- **Status/stage tracker**: a horizontal stage stepper at the top of the matter detail (Pre-Trial → Trial → Judgment → Appeal) with a click to advance — confirms before changing, logs to history.
- **Launch drafting from inside a case**: every AI tool accessible from within the matter automatically pre-fills the parties (plaintiff/defendant from matter title), file reference, and any instructions the matter's notes contain. A "Draft for this matter" button on the case card takes the user directly to the relevant drafting tool.
- **Client card**: the Team tab shows the linked client's name, IC/company, phone, and email. An "Edit client" button opens an inline form. New matters prompt "Link a client?" after creation.
- **Time recording**: the Time tab lists time entries with a "+ Log time" button (description, hours:minutes, date). A running total shows hours and estimated fees.
- **Google Calendar sync**: a "Sync to Google Calendar" button on the Deadlines/Timeline tab triggers OAuth if not connected, then syncs all matter deadlines as Calendar events; synced events show a calendar icon.

## Out of scope
- Invoicing / PDF billing
- Multi-user firm access (single user per access code)
- Mobile app

## Steps
1. **Case dashboard home** — Replace the current default authenticated route with a Matters-first dashboard page showing active case cards (status badge, next deadline countdown, AI next-step snippet). Keep navigation to all existing AI tools accessible from a secondary menu.
2. **Matter detail tabs** — Restructure the matter detail page into Overview / Timeline / Documents / Checklist / Team / Time / Diary tabs using the existing shadcn Tabs component.
3. **AI insights component** — Build an `AIInsightsPanel` component that calls `GET /api/lit/matters/:id/ai-insights`; renders summary, risk badge (colour-coded), and ordered next-steps list with "Refresh" control.
4. **Visual timeline** — Build a `CaseTimeline` component that merges deadlines and document-filed events into a chronological vertical timeline with date markers.
5. **Status stage stepper** — Add a `StageTracker` component using the status API; shows current stage, allows clicking next stage, displays history on hover.
6. **Checklist tab** — Fetch and render checklist items from `/api/lit/matters/:id/checklist`; tick-off via PATCH; show progress fraction; allow custom item addition.
7. **Pre-filled drafting launch** — Add a "Draft for this matter" action on the matter card and overview tab; navigates to the practice hub/drafting page with query params (`?matter=<id>&plaintiff=...&defendant=...&ref=...`) that pre-fill the drafting form.
8. **Client management** — Add a Team tab with client card display/edit calling `/api/lit/clients`; show "Link client" prompt on new-matter creation.
9. **Time recording** — Add a Time tab with entry list and "+ Log time" form calling `/api/lit/matters/:id/time-entries`.
10. **Google Calendar sync** — Add "Sync to Google Calendar" button calling `/api/calendar/sync-matter`; show OAuth redirect if not connected; mark synced deadlines with a calendar icon.
11. **IRAC parity** — Apply all the same changes to `artifacts/mylitai-irac`; it shares the same `/api/lit/*` backend so no new routes are needed, only UI changes mirroring MyLitAI.

## Relevant files
- `artifacts/mylitai/src/App.tsx`
- `artifacts/mylitai/src/pages/MatterDetail.tsx`
- `artifacts/mylitai/src/pages/Matters.tsx`
- `artifacts/mylitai/src/hooks/use-matters.ts`
- `artifacts/mylitai/src/components/SaveToMatterPanel.tsx`
- `artifacts/mylitai-irac/src/App.tsx`
- `artifacts/mylitai-irac/src/pages/MatterFile.tsx`
- `artifacts/mylitai-irac/src/pages/Matters.tsx`
- `artifacts/mylitai-irac/src/hooks/use-matters.ts`
