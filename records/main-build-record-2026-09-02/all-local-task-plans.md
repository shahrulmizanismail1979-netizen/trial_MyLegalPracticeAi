# All Locally Stored Project Task Plans

This file contains the verbatim contents of every Markdown task-plan file found under .local/tasks at export time.


---

## 1. AI Case Intelligence Engine — Shared Backend

Source: .local/tasks/ai-case-engine-backend.md

# AI Case Intelligence Engine — Shared Backend

## What & Why
All 7 portals need AI-powered case management on top of their existing matter tables. This task builds the shared backend layer that every portal UI will call: AI next-steps suggestions, case summary/chronology, risk assessment, auto-generated procedural checklists, case status/stage tracking, billing/time recording, client management, and Google Calendar sync for deadlines. All portal UIs depend on this first.

## Done looks like
- Every portal's matter now has a `status` field with portal-appropriate stages (e.g. Pre-Trial → Trial → Appeal for litigation; Charge → Hearing → Sentencing for criminal; Mal → Syariah Court → Decree for Syariah; Instruction → Completion for conveyancing) — queryable and settable via API.
- `GET /api/*/matters/:id/ai-insights` returns an AI-generated object with: `nextSteps` (ordered action items with deadlines), `caseSummary` (2-3 paragraph chronology derived from filed documents and notes), and `riskAssessment` (strength rating + key weaknesses). Works for all portals (`/api/lit/`, `/api/crim/`, `/api/sya/`, `/api/corp/`, `/api/ccb/`, `/api/convey/`).
- `POST /api/*/matters` auto-generates and saves a procedural checklist when a new matter is created — checklist items are portal and matter-type specific (e.g. for a winding-up matter: statutory demand, petition, sealed order checklist; for a robbery charge: cautioned statement, charge, PKDK, trial preparation).
- `GET /api/*/matters/:id/checklist` and `PATCH /api/*/matters/:id/checklist/:itemId` (mark done/undone) work for all portals.
- Client management: `GET/POST /api/*/clients` and `PATCH /api/*/matters/:id` can accept a `clientId` linking a matter to a client record (name, IC/company no, contact). Client tables follow the existing `lit_clients` pattern.
- Billing/time recording: `GET/POST /api/*/matters/:id/time-entries` stores time entries (description, minutes, rate, date) and returns running total. Tables per portal follow a consistent schema.
- Google Calendar: `POST /api/calendar/sync-matter` accepts a matter ID and portal, reads its deadlines, and creates/updates Google Calendar events using the Google OAuth connector. `GET /api/calendar/auth-url` and `GET /api/calendar/callback` handle the OAuth flow.

## Out of scope
- Portal frontend UI changes (handled by the three parallel UI tasks)
- Invoicing / PDF billing statements
- Google Drive document sync (calendar only for now)
- WhatsApp/SMS reminders

## Steps
1. **Case status schema** — Add a `status` text column and `stage_history` JSONB column to every portal's matter table (lit_matters, crim_matters, sya_matters, corp_matters, ccb_matters, convey_matters) via direct SQL boot-ensures (not drizzle push). Define permitted stage arrays per portal in a shared config.
2. **Status API routes** — Add `PATCH /api/*/matters/:id/status` to each portal's matter router; validate against the portal's allowed stages and append to history; ownership-scoped.
3. **Checklist schema and boot** — Create per-portal checklist tables (`lit_matter_checklists`, `crim_matter_checklists`, etc.) via direct SQL with columns: matter_id, item_text, done, position, created_at. Auto-generate on matter creation using a per-portal, per-matterType prompt to the Gemini/OpenAI integration.
4. **Checklist routes** — Add GET (full list), PATCH (toggle done), POST (add custom item) routes for each portal, ownership-scoped.
5. **AI case insights endpoint** — Create a shared `buildCaseInsights(portal, matterId, accessCodeId)` function that fetches the matter's notes, filed documents (first 800 chars each), deadlines, and status history, then calls Gemini with a structured prompt to return `nextSteps`, `caseSummary`, and `riskAssessment`. Cache result in a `case_ai_insights` table (per-portal) with a 6-hour TTL; invalidate on new document filing. Expose as `GET /api/*/matters/:id/ai-insights`.
6. **Client management** — Create per-portal client tables (`crim_clients`, `sya_clients`, etc.) mirroring `lit_clients` (name, ic_number, company_name, email, phone, access_code_id). Wire `GET/POST /api/*/clients` and `PATCH /api/*/matters/:id` to accept `clientId`.
7. **Billing/time recording** — Create per-portal time-entry tables (`lit_time_entries`, `crim_time_entries`, etc.) with columns: matter_id, description, minutes, rate_usd, date, access_code_id. Wire `GET/POST /api/*/matters/:id/time-entries`.
8. **Google Calendar integration** — Use the Replit Google OAuth connector to request `calendar.events` scope. Store user tokens in a `google_tokens` table keyed to access_code_id. Implement sync: for each deadline in the matter, upsert a Calendar event (title = deadline label, start = deadline date, description = matter file ref + portal link). Handle token refresh.

## Relevant files
- `lib/db/src/schema/lit-matters.ts`
- `lib/db/src/schema/lit-clients.ts`
- `artifacts/api-server/src/lit/routes/matters.ts`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/index.ts`
- `.local/skills/ai-integrations-gemini/SKILL.md`
- `.local/skills/integrations/SKILL.md`
- `.agents/memory/drizzle-push-rename-trap.md`
- `.agents/memory/portal-matter-files.md`


---

## 2. Batch ETA + Pipeline Guide in Admin Documents

Source: .local/tasks/batch-eta-and-pipeline-guide.md

# Batch ETA + Pipeline Guide in Admin Documents

## What & Why
Two admin quality-of-life additions to the Documents page:

1. **ETA per PDF** — right now the batch modal shows a static status badge for each file. Admins uploading 15–50 PDFs have no sense of when a file will finish. Adding an estimated time remaining beside each item makes progress transparent.

2. **Pipeline guide** — the research database powers eight portals (MyLitAI, MyLitAI IRAC, MySyalitAI, MyCorpLegalAI, MyCrimAI, MyAccidentAI, MyCCBLitAI, MyConveyLitAI) but there is no explanation of how a PDF becomes searchable content. Admins need a short, always-visible guide showing the pipeline stages and which portals are fed by the corpus.

## Done looks like
- Each row in the Batch Items modal shows an estimated time beside files that are still processing (e.g. "~2 min", "queued ~4 min", "processing…")
- Finished or failed items show no ETA (not needed once complete)
- A new collapsible "Pipeline Guide" panel appears on the Documents admin page (above or below the batches table)
- The guide shows the pipeline stages in order: Upload → Ingest → Validation → Metadata Extraction → Segmentation → Rights Review → Editorial → Search Index
- Each stage has a one-line description of what happens
- A "Portals powered by this corpus" section lists all 8 portals with their names

## Out of scope
- Per-stage progress bars for individual containers (deep pipeline monitoring is a separate task)
- Real-time WebSocket push (polling every 3 s is already in place and sufficient)
- Editing or configuring the pipeline from this UI

## Steps
1. **Expose job timing in the batch detail API** — when `GET /api/research/uploads/:id` returns items, join `research_jobs` to include `startedAt`, `finishedAt`, and `state` for each item's ingest job (via the `jobId` foreign key on `research_upload_batch_items`). Also compute a `avgSecondsPerItem` across recently finished items in the same batch so the frontend can estimate queue wait.

2. **Add ETA calculation and display** — in `BatchDetailDialog`, use the returned timing fields to compute and show an ETA label beside each still-PENDING row: items with a running job show "processing…"; items with no started job show "queued (est. ~N min)" based on their position and the average; finished items show nothing. Keep the existing status badge unchanged.

3. **Add the Pipeline Guide panel** — add a new collapsible `PipelineGuide` component to the Documents admin page. It lists the 8 pipeline stages with a short description each, then lists all 8 portals that are fed by the research corpus. Style it consistently with the rest of the admin page (dark card, muted headings). Default to collapsed so it doesn't clutter the view.

## Relevant files
- `artifacts/landing-page/src/pages/admin/documents.tsx:201-351`
- `artifacts/api-server/src/research/routes/uploads.ts:103-117`
- `artifacts/api-server/src/research/data/uploads.ts:144-153`
- `lib/db/src/schema/research.ts:187-210`


---

## 3. Case-Centric UI — MyCorpLegalAI, MyCCBLitAI & MyConveyLitAI

Source: .local/tasks/case-centric-corporate.md

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


---

## 4. Case-Centric UI — MyCrimAI & MySyariahAI

Source: .local/tasks/case-centric-crim-sya.md

# Case-Centric UI — MyCrimAI & MySyariahAI

## What & Why
Transform MyCrimAI and MySyariahAI so that case/matter management is the primary experience, with AI tools launched from within a matter. Criminal and Syariah practice has distinct stage structures and procedural checklists — these must reflect real Malaysian criminal procedure (CPC) and Syariah court practice.

## Done looks like
- **Default home is the case dashboard** for both portals: first screen after login shows active matters with case status badge, next hearing date countdown, and AI-suggested next step per case.
- **Matter detail is the command center** (same tab structure as LitAI): Overview (AI summary + risk + next steps), Timeline (hearings, filings, key events in order), Documents, Checklist, Team (client card), Time (billing entries), and for CrimAI — a Hearings sub-tab showing remand / mention / trial dates.
- **Criminal stages** (MyCrimAI): Investigation → Charge → Mention → Trial → Judgment → Appeal. Auto-checklist on new matter includes CPC-relevant items (obtain cautioned statement, PKDK, charge sheet, witness list, etc.) — generated by AI for the specific offence type.
- **Syariah stages** (MySyariahAI): Pengajuan → Perbicaraan → Penghakiman → Rayuan (with mal/jenayah/faraid variants). Auto-checklist follows Syariah Court procedure rules (Kaedah-Kaedah Tatacara Mal Mahkamah Syariah).
- **AI insights**: Overview tab shows AI case summary from filed documents, risk/strength assessment, and prioritised next steps — each with suggested action and date.
- **Launch AI tools from inside a case**: every cause-paper drafter, case analyzer, and strategy tool is launchable from within the matter, pre-filled with the matter's parties, offence/claim type, and file reference.
- **Client card and time recording**: same pattern as LitAI — Team tab with client contact, Time tab with entries and running total.
- **Google Calendar sync**: "Sync to Google Calendar" button syncs all hearing dates and deadlines.

## Out of scope
- Invoicing / PDF billing
- Multi-user firm access
- Mobile app

## Steps
1. **Case dashboard home** — Replace default authenticated route in both portals with a matters-first dashboard showing case cards (status badge, next date countdown, AI next-step snippet).
2. **Matter detail tabs** — Restructure matter detail into Overview / Timeline / Documents / Checklist / Team / Time tabs; for MyCrimAI add a Hearings sub-tab.
3. **AI insights component** — Call `GET /api/crim/matters/:id/ai-insights` and `GET /api/sya/matters/:id/ai-insights`; render summary, colour-coded risk badge, and ordered next-steps list.
4. **Stage stepper** — Criminal stages (Investigation → Charge → Mention → Trial → Judgment → Appeal) and Syariah stages (Pengajuan → Perbicaraan → Penghakiman → Rayuan) displayed as clickable steppers; PATCH `/api/*/matters/:id/status`; history shown on hover.
5. **Visual timeline** — Merge deadlines and filed documents into a chronological vertical timeline per matter.
6. **Checklist tab** — Render auto-generated procedural checklist items (created by backend on matter creation); tick-off via PATCH; show progress.
7. **Pre-filled AI tool launch** — "Draft for this matter" / "Analyse this case" buttons on the matter card and overview tab, passing matter context as query params to the relevant tool pages.
8. **Client management** — Team tab with client card display/edit calling `/api/crim/clients` or `/api/sya/clients`; link-client prompt after new matter creation.
9. **Time recording** — Time tab with entry list and "+ Log time" form.
10. **Google Calendar sync** — Sync hearing dates and deadlines button; OAuth flow if not connected.

## Relevant files
- `artifacts/mycrimai/src/App.tsx`
- `artifacts/mycrimai/src/pages/` (workspace pages)
- `artifacts/mysyariahai/src/App.tsx`
- `artifacts/mysyariahai/src/pages/` (MattersPage.tsx, MatterDetailPage.tsx)
- `artifacts/api-server/src/` (crim and sya route directories)
- `.agents/memory/portal-matter-files.md`
- `.agents/memory/matter-files-port.md`


---

## 5. Case-Centric UI — MyLitAI & MyLitAI IRAC

Source: .local/tasks/case-centric-litai.md

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


---

## 6. Central Case Home Across Portals

Source: .local/tasks/central-case-home-across-portals.md

# Central Case Home Across Portals

## What & Why
Make the case or matter—not a collection of separate AI tools—the main working unit across every practitioner legal portal that already handles client matters. Current 2026 legal-workflow research emphasizes centralized matter dashboards, clear task ownership, critical-date visibility, document context, reduced duplicate entry, and human-reviewed AI inside the normal workflow. The project already has most of these ingredients, but they are fragmented across tabs and implemented unevenly by portal.

This task creates one consistent “Case Home” experience for MyAccidentAI, MyLitAI/MyLitAI IRAC, MyCrimAI, MySyariahAI, MyCorpLegalAI, MyCorpCommBankLitAI, and MyConveyLitAI. Each portal keeps its practice-specific terminology and tools while sharing a faster common workflow.

## Done looks like
- Active matters and “continue working” actions are prominent from each practitioner portal’s main workspace
- Every matter opens to a useful Case Home showing the current stage, next deadline, outstanding tasks, latest activity, key people, and the most relevant next action
- Lawyers can create and assign matter tasks with an owner, due date, priority, status, and short note
- One chronological timeline combines stage changes, deadlines, task activity, uploads, saved documents, notes, and filed AI outputs
- Launching an AI tool from a matter carries the matter context into editable fields, and the reviewed result can be filed back into the same matter without re-entering details
- Filed AI work records its source tool and time so lawyers can distinguish generated work from uploaded or manually authored documents
- The baseline experience is consistent and mobile-usable across all included portals, while practice-specific workflows remain intact
- Existing tenant and access-code ownership rules continue to isolate one subscriber’s matters, tasks, documents, and AI outputs from another’s

## Out of scope
- Turning MyLawFirmAI, MyLawAcad, the public landing page, or research-admin into case-work portals
- External email, calendar, document-management, or court-filing integrations
- Automatic legal decisions, automatic court filing, or unreviewed AI output treated as final legal work
- Replacing billing, accounting, HR, research-ingestion, or assessment workflows

## Steps
1. **Define the shared Case Home contract** -- Consolidate the existing matter, deadline, stage, saved-work, and client capabilities behind a consistent cross-portal summary, and add matter tasks plus a unified activity feed.
2. **Build the reusable Case Home experience** -- Present next action, critical dates, tasks, people, documents, and timeline in a clear hierarchy that works on desktop and mobile.
3. **Make AI actions matter-aware** -- Preserve matter context when opening relevant AI tools, keep pre-filled details editable, and let reviewed outputs return to the originating matter with clear provenance.
4. **Roll out to every practitioner portal** -- Apply the common baseline to Accident, Lit/IRAC, Criminal, Syariah, Corporate Legal, Corporate/Commercial/Banking Litigation, and Conveyancing while retaining each practice area’s terminology and specialist tools.
5. **Verify real lawyer workflows and isolation** -- Test create/open/continue flows, task and deadline updates, timeline ordering, AI-to-matter filing, mobile usability, and cross-subscriber access controls in representative portals.

## Relevant files
- `artifacts/api-server/src/lib/attachCaseIntelligence.ts`
- `artifacts/api-server/src/lib/matterFiles.ts`
- `artifacts/mylitai/src/pages/MatterDetail.tsx`
- `artifacts/mylitai/src/hooks/use-matters.ts`
- `artifacts/mylitai-irac/src/pages/MatterFile.tsx`
- `artifacts/mycrimai/src/pages/matter-detail.tsx`
- `artifacts/mysyariahai/src/pages/matter-detail.tsx`
- `artifacts/myconveylitai/src/pages/MatterDetail.tsx`
- `artifacts/myaccidentai/src/components/MatterPicker.tsx`
- `artifacts/mycorplegalai/src/components/MatterPicker.tsx`
- `artifacts/myccblitai/src/components/MatterPicker.tsx`

---

## 7. Client Document Vault on Every Portal

Source: .local/tasks/client-document-vault.md

# Client Document Vault on Every Portal

## What & Why
Lawyers must safekeep client documents (ICs, agreements, court papers, medical reports, letters received). Portals currently upload files only as temporary AI-analysis inputs — nothing is stored against the matter or client permanently. This adds a per-matter/per-client document repository with real uploads to object storage, on all practice portals.

## Done looks like
- Each matter (and client record where clients exist) has a "Documents" tab: upload, list (with date, type, size, uploader), preview/download, rename, delete
- Files live in private object storage with ownership recorded in the database; only the owning subscriber (or master) can access them — presigned upload consumption must be owner-checked in the DB, never in-memory
- Documents can be tagged by category (correspondence, cause papers, evidence, client KYC, billing) and filtered by date
- Works end to end in the browser on every practice portal

## Out of scope
- OCR/AI analysis of stored documents (existing AI tools remain separate)
- Sharing links to third parties

## Steps
1. **Shared document-vault library** — Central module with a documents table (portal, owner, matter/client link, object key, category, dates) and routes for presigned upload, owner-checked confirm, list, download, delete; persist the canonical key returned by storage
2. **Per-portal mounts** — Mount behind each portal's auth with the correct owner mapping (mixed code/email portals scope by owner_type + owner_id)
3. **Portal UI** — Documents tab on matter pages (and client pages where applicable) in all 7 practice portals
4. **End-to-end verification** — Upload/download/delete verified against real object storage per portal; unauthenticated and cross-tenant access must 401/404

## Relevant files
- `artifacts/api-server/src/routes/storage.ts`
- `artifacts/api-server/src/lib/matterFiles.ts`
- `.agents/memory/upload-ownership-registry.md`
- `.agents/memory/storage-adapter-canonical-keys.md`


---

## 8. Build Sarawak-first LAWYes Preview

Source: .local/tasks/complete-drive-lawyes-rollout.md

# Build Sarawak-first LAWYes Preview

## What & Why
Upgrade LAWYes into a genuinely useful Sarawak practitioner research and drafting experience, beginning in the existing isolated Safe Preview. Sarawak must be a first-class jurisdiction throughout the navigation, dashboard, research corpus, case reports, drafting packs, matter playbooks, precedents, checklists, and search—not a cosmetic state label. Preserve useful Malaysian content, but make Sarawak content equally visible and easy to reach.

Use only verifiable official or lawfully accessible public material. Every substantive proposition, procedure, form, precedent, and case report must carry source URL, source type, jurisdiction, currency or last-verified date, and editorial status. Never fabricate legal content. Unverified or incomplete material must appear as an access record or verification-required item.

## Done looks like
- The Safe Preview opens to a clearly labelled Sarawak Practitioner pathway with an explicit jurisdiction selector and equally reachable Malaysian content.
- The dashboard and Sarawak Practice Centre expose verified updates, legislation and practice directions, judgments and reports, registry/agency links, matter playbooks, precedents/forms, conveyancing/NCR decision trees, and deadline/limitation checklists.
- Sarawak coverage is represented as structured jurisdictional content across civil, criminal, conveyancing/land, Native law, professional practice, probate/estates, family, employment, commercial/company, insolvency, public law, local government, and state regulatory work. National Rules of Court or federal law are visibly distinguished from Sarawak-specific rules and registry practice.
- Search recognises Sarawak statutes, sections, case names, judges, registries, land categories, native-law terms, practice areas, and relevant Bahasa Malaysia terminology. Filters include court, registry, date, subject, legislation, source, report status, jurisdiction, and judicial treatment.
- Sarawak case reports are built only from accessible full judgments and contain the complete report schema: case identity/citation, court and registry, date, coram, counsel where stated, procedure, catchwords, headnote, facts, issues, holdings, ratio, obiter, orders/costs, legislation, authorities, appellate or subsequent treatment where verifiable, paragraph pinpoints, and direct source. AI editorial drafts are visibly distinct from lawyer-reviewed published reports.
- Practical civil, criminal, and Sarawak conveyancing/land document packs have guided intake, facts/exhibits, jurisdiction checks, court heading/cause-paper structure, filing/service checklist, editable notes, risk flags, and DOCX/print-ready PDF export. Unverified precedents remain labelled as practitioner-review templates.
- Each content item displays a prominent “law as at” or last-verified indicator, source status, and any unresolved verification gap. No item implies completeness or publisher equivalence.
- Mobile and desktop flows cover navigation, empty/error states, source links, filters, document intake, exports, permissions, and production-write isolation.
- A review-ready audit report states sources reviewed, verified-current additions, substantive reports added, precedents added, verification gaps, tests passed/failed, and production-release risks.

## Out of scope
- Publishing or altering the live production deployment, production database, production Drive data, billing, or subscriber entitlements.
- Auto-publishing any document solely because it exists in Google Drive or has a plausible filename.
- Inventing Sarawak legislation, registry requirements, fees, timelines, forms, quotations, case citations, paragraph numbers, customs, or practice directions.
- Presenting restricted commercial material, private Drive documents, or unverified AI output as public authoritative content.
- Removing existing Malaysian content or weakening authentication, tenant isolation, practice-area scope, rights gates, or editorial approval requirements.

## Steps
1. **Establish the Sarawak content model** -- Add jurisdiction-aware fixture/content contracts for sources, currency, rights, editorial status, practice area, court/registry, and judicial treatment, with explicit provenance and verification-required states.
2. **Perform the source audit** -- Review current consolidated Sarawak legislation, amendments, subsidiary legislation, accessible Gazette material, official court directions, Judiciary/e-Kehakiman judgments, Sarawak government and Land and Survey sources, and publicly available Bar/Advocates Association materials; record only sources that can be verified and link every addition directly.
3. **Build the Sarawak practitioner centre** -- Add the jurisdiction selector, Sarawak pathway, dashboard modules, library navigation, registry directory, change log, practice playbooks, checklists, decision trees, bilingual labels where supported, and clear “law as at” indicators.
4. **Expand research and reports** -- Add verified-current Sarawak content and a representative collection of full-judgment case reports across relevant courts and practice areas, including appellate treatment where available; keep access records separate from report content and drafts separate from published status.
5. **Build drafting and precedent packs** -- Add practical guided workflows for civil applications, affidavits, originating papers, submissions, orders, criminal representations/bail/mitigation, and Sarawak land/NCR transactions, with source-backed intake checks, risk flags, document structure, and safe exports.
6. **Make search and navigation jurisdiction-aware** -- Implement Sarawak-first ranking and filters without hiding national material; support statutory references, registries, judges, land/native-law terminology, and Bahasa Malaysia search aliases.
7. **Verify and produce the audit** -- Run fixture tests, TypeScript/build checks, browser tests at phone and desktop sizes, export and source-link checks, permission/isolation checks, and a written coverage/risk audit. Keep the Safe Preview clearly isolated from API, database, uploads, AI, billing, local storage, and server writes until review approval.

**Critical constraints:** Safe Preview is the only implementation surface in this phase. Treat official source verification and editorial status as hard gates. Preserve existing Malaysian content and all authentication, rights, scope, and tenant-isolation controls. Do not claim 100% coverage; show transparent gaps and stop before production release.

## Relevant files
- `artifacts/landing-page/src/App.tsx`
- `artifacts/landing-page/src/pages/lawyes-safe-preview.tsx`
- `artifacts/landing-page/src/fixtures/lawyes-preview.ts`
- `artifacts/landing-page/src/fixtures/lawyes-verified-reports.json`
- `artifacts/landing-page/src/fixtures/lawyes-preview.test.ts`
- `artifacts/landing-page/src/components/lawyes-nav.tsx`
- `artifacts/landing-page/src/index.css`
- `artifacts/api-server/src/research/editorial/lawyesIntake.ts`
- `artifacts/api-server/src/research/editorial/lawyesReportService.ts`
- `artifacts/api-server/src/routes/cases.ts`
- `lib/case-home-ui/src/index.tsx`
- `artifacts/research-admin/src/pages/editorial-workbench.tsx`

---

## 9. Close corporate legal workflow gaps

Source: .local/tasks/corporate-legal-workflow-priorities.md

# Close corporate legal workflow gaps

## What & Why

Bring the highest-risk practitioner needs identified in the Malaysia corporate-legal research into one coherent workflow milestone. The existing app has strong matter and secure-draft foundations, but corporate work still lacks a complete chain from intake through evidence, approval, execution, and follow-up.

## Done looks like

- Every supported MyCorpLegalAI drafting flow clearly carries matter context and lets a user save the completed work to the correct matter without losing ownership, status, or exportability.
- A corporate compliance workspace can track an obligation against an entity/matter, required evidence, responsible owner, verification state, filing/disclosure deadline, and completion history.
- Contract and transaction work supports a canonical document, version/deviation history, approval state, closing actions, and post-signing obligations rather than only one-shot generation.
- AI-assisted work visibly records sources or supplied evidence, assumptions, missing facts, reviewer status, and final approval state; client-facing/export actions cannot silently present unreviewed work as final.
- Matter deadlines support reminder and escalation states with clear overdue/blocked visibility.
- Existing ownership and privacy protections remain intact, and the changed flows have focused API/UI/e2e coverage.

## Out of scope

- Replacing the existing legal research corpus or adding unsupported legal content.
- Building a full e-billing, external-counsel panel, or procurement integration in this milestone.
- Claiming that any AI output is legal advice or automatically correct.
- Redesigning every portal’s visual language; other portals should consume shared behavior where practical, but MyCorpLegalAI is the primary delivery surface.

## Steps

1. **Normalize matter context and filing** — Trace every supported corporate AI tool from input through completion, export, and save; close paths that lose matter context or allow an unlinked completed work product, while preserving retry-safe private storage and owner scoping.
2. **Add an evidence-led compliance slice** — Implement a reusable corporate obligation record and UI for a first high-value workflow such as beneficial ownership/e-BOS, including entity, evidence checklist, owner, verification, due date, status history, and explicit “not legal advice / verify current rule” boundaries.
3. **Add contract/transaction follow-through** — Extend matter work with canonical document/version metadata, deviation or issue records, approval decisions, closing checklist items, and post-closing actions; keep drafting tools as assistance rather than treating generated text as completion.
4. **Enforce AI review and provenance** — Persist supplied evidence, assumptions, missing-fact markers, source/provenance metadata where available, reviewer identity/status, and finalisation state; gate final exports or matter filing according to the chosen review policy and make incomplete/interrupted generation explicit.
5. **Complete deadline reminders and escalation** — Build on the existing deadline model to provide reminder status, overdue/blocked states, ownership escalation, and an observable delivery path without leaking matter data across tenants.
6. **Verify the end-to-end flows** — Add focused backend tests and browser coverage for matter save, compliance evidence, approval/review gates, contract follow-through, deadline escalation, privacy boundaries, and retry/concurrency behavior; run typechecks and the relevant workflows before completion.

## Relevant files

- `artifacts/mycorplegalai/src/pages/MatterDetailPage.tsx`
- `artifacts/mycorplegalai/src/pages/ToolDetailPage.tsx`
- `artifacts/mycorplegalai/src/components/SaveToMatterPanel.tsx`
- `artifacts/mycorplegalai/src/hooks/use-saved-work.ts`
- `artifacts/mycorplegalai/src/hooks/use-matters.ts`
- `artifacts/mycorplegalai/src/data/ai-tools-data.ts`
- `artifacts/api-server/src/lib/matterFiles.ts`
- `artifacts/api-server/src/lib/caseIntakeBriefing.ts`
- `artifacts/api-server/src/lib/attachCaseIntelligence.ts`
- `artifacts/api-server/src/lib/caseEvents.ts`
- `artifacts/api-server/src/corp/routes/legal/index.ts`
- `lib/db/src/schema/matter-files.ts`

---

## 10. Customer Unsubscribe Portal

Source: .local/tasks/customer-unsubscribe-portal.md

# Customer Unsubscribe Portal

## What & Why
Add one clear, secure self-service route for Stripe subscribers to manage or cancel their LAWyes subscription. Users currently see “cancel anytime” messaging but have no visible way to reach Stripe's billing portal, causing legitimate complaints and avoidable support requests.

## Done looks like
- The LAWyes site clearly shows a “Manage or cancel subscription” action near the subscription/payment area and in the site footer
- A subscriber can verify ownership using their access code and subscription email, then open their own Stripe-hosted billing portal
- Stripe's portal lets the subscriber cancel, update payment details, and view billing history without exposing another customer's account
- Invalid or mismatched details show a neutral, helpful error without revealing whether an account exists
- Cancellation continues to deactivate portal access through the existing Stripe webhook flow
- Focused API and browser tests confirm the link is visible and the secure portal handoff works

## Out of scope
- Changing prices, checkout, product catalog, or subscription entitlements
- Replacing Stripe's hosted billing portal with a custom cancellation system
- Changing manually arranged firm, corporate, or academic agreements that are not billed through Stripe
- Adding any unrelated portal features or design changes

## Steps
1. **Secure billing-portal handoff** — Add a rate-limited endpoint that verifies the submitted access code and subscription email against the same subscriber record before creating a Stripe billing-portal session. Derive the return URL from trusted server configuration and return neutral errors for failed verification.
2. **Visible customer action** — Add a small subscription-management page and place a clear “Manage or cancel subscription” link in the public payment area and footer so users can find it without signing into a specific portal.
3. **Focused verification** — Test successful ownership verification, incorrect details, subscribers without Stripe billing accounts, safe return URLs, and browser visibility of the cancellation action.

## Relevant files
- `artifacts/api-server/src/routes/stripe.ts:199-352`
- `artifacts/api-server/src/lib/provisioning.ts`
- `artifacts/api-server/src/lib/cancellation.test.ts`
- `artifacts/landing-page/src/components/payment.tsx`
- `artifacts/landing-page/src/App.tsx:57-105`
- `lib/db/src/schema/subscribers.ts`


---

## 11. Definitive LAWYes Practice Platform

Source: .local/tasks/definitive-lawyes-platform.md

# Definitive LAWYes Practice Platform

## What & Why
Upgrade the existing public MyLegalPracticeAI deployment in place into the definitive LAWYes Malaysian legal-practice platform, using the user-facing LAWYes experience as the product/design benchmark while preserving the current custom domain, accounts, roles, authentication, subscriptions, payments, database records, secrets, environment settings, deployment configuration, and every working portal feature. The Judgment Library becomes an independent LAWYes editorial case-report service built only from verified official or authorised judgments, with original editorial work, paragraph-level support, human approval, and practitioner-grade search and exports.

## Done looks like
- The existing public deployment at mylegalpracticeai.life remains the same deployment and domain, with current users, roles, subscriptions, Stripe flows, access codes, data, secrets, and portal routes preserved.
- The canonical landing/app shell uses the official LAWYes logo and a consistent polished, responsive LAWYes design, while existing portal functionality remains reachable and intact.
- Users have a complete matter-led workspace that retains existing matter records and improves chronology, parties, issues, evidence, relief, practical Malaysian cause papers, precedent benchmarks, filing-readiness controls, document packs, and genuine DOCX/PDF/print/HTML/text exports.
- The Judgment Library provides structured LAWYes reports for verified source judgments with case identity, court/registry/date/coram/counsel, hierarchical catchwords, original headnote, facts, procedural history, issues, issue-by-issue holdings, ratio, separate obiter, orders/relief/costs, legislation, treated authorities, practice tags, paragraph pinpoints, source provenance, access/report state, editorial ownership, verification date, and revision history.
- Missing source facts display “Not stated in the published judgment”; the system never invents them.
- Every important factual or legal proposition links to supporting judgment paragraphs. Reports without verified official/authorised full text and paragraph support remain access records or pending editorial review and cannot be published.
- Report states visibly distinguish Draft, AI-assisted draft, Lawyer reviewed, and Published; only legally trained human-reviewed reports can become Published.
- A professional report page includes masthead/status, copy citation, anchored table of contents, pinpoint/source links, print view, related cases, legislation, original judgment access, and responsive/keyboard-accessible behavior.
- Search covers full text and metadata across parties, citation/case number, catchwords, court, judge, counsel, dates, practice area, legislation, issues, outcomes, and judicial treatment, with filters, sorting, recent/related reports, and account-backed saved searches where supported.
- Initial editorial intake starts from currently indexed official records, prioritising Sabah and Sarawak High Court civil/criminal decisions, Industrial Court awards, and JAKESS decisions. All identified free official collections remain prominently linked: Malaysian Judiciary eJudgment, e-Kehakiman Sabah and Sarawak, Industrial Court Full Awards, JAKESS, Native Court of Appeal, and Judiciary Digital Repository.
- Report exports include A4 PDF, genuine DOCX, print, plain text, citation copy, CSV search results, and appropriate structured-data export, with provenance and entitlement controls.
- Regression and end-to-end checks pass for sign-in, roles, subscriptions/payments, stored data, custom-domain routing, matter/document workflows, ingestion validation, publication gates, search/filtering, report navigation/source links, empty/error states, all exports, desktop/mobile layouts, keyboard accessibility, production build, and browser console.
- The existing deployment is prepared for republishing to mylegalpracticeai.life without changing or replacing the domain; publishing itself happens only after explicit user approval.

## Out of scope
- Rebuilding the project from scratch, replacing the current database/auth/payment systems, changing the custom domain, deleting or resetting existing records, or removing working portal features.
- Copying proprietary headnotes, catchwords, annotations, layouts, editorial classifications, or report text from CLJ, eLaw, LexisNexis, or any other commercial publisher.
- Publishing reports based only on metadata, links, snippets, inaccessible documents, commercial reports, or unverified AI output.
- Fabricating missing source details, subsequent treatment, citations, paragraph references, counsel, coram, relief, or costs.
- Republishing the production deployment before the user approves the validated release.

## Steps
1. Create a preservation baseline before implementation: inventory the current production deployment, artifact routing, custom-domain configuration, auth/role/session mechanisms, Stripe catalog/webhooks/subscriptions/access-code provisioning, database schemas and record counts, object storage, environment contracts, and all current portal routes/features. Add non-destructive regression fixtures and prohibit destructive migrations.
2. Reconcile the current landing-page shell with the reference LAWYes experience and official branding. Build a unified responsive navigation and product entry experience around the existing artifact/portal routes rather than merging or replacing their auth and data stores.
3. Define additive OpenAPI and PostgreSQL contracts for independent case reports, including source judgment identity/provenance, paragraph corpus, structured report sections, catchword hierarchy, issues/holdings, ratio/obiter, orders, legislation, treated authorities, proposition-to-pinpoint mappings, editorial assignments/reviews, publication state, verification dates, revision history, saved searches, and export history. Keep source bytes in object storage and use additive, reversible migrations.
4. Extend the existing rights-gated research ingestion pipeline so only official or authorised full judgments can enter substantive report drafting. Preserve source checksums and access records, segment stable judgment paragraphs, extract a draft report, map every proposition to paragraph IDs, and flag contradictions, unsupported claims, and absent fields without filling gaps.
5. Implement enforceable editorial state transitions and permissions: metadata/access record → Draft or AI-assisted draft → Lawyer reviewed → Published. Require a legally trained reviewer and a complete verified-source/pinpoint checklist for publication; maintain immutable review and revision audit history; fail closed on source-rights changes.
6. Build the editorial workbench in the existing research-admin artifact for source verification, paragraph review, structured report editing, proposition/pinpoint inspection, contradiction/missing-field flags, reviewer sign-off, revision comparison, and controlled publication/unpublication.
7. Build the public/subscriber Judgment Library and report pages in the canonical LAWYes shell, reusing existing publication/access gates. Include professional report anatomy, anchored navigation, source/pinpoint links, citation copy, related reports, legislation and authority treatment, recent reports, official collection gateway, clear access/full-text/report states, and mobile/keyboard accessibility.
8. Implement indexed, paginated search and facets across report metadata and verified judgment text. Support all requested fields, date filters, judicial treatment, relevance/date/title sorting, snippets/highlights, saved searches tied to existing accounts where compatible, CSV results export, and strict publication/rights filtering before results are returned.
9. Upgrade matter and practical Malaysian document workflows in place: connect published reports as source-backed precedent benchmarks; retain matter ownership and all existing records; improve parties/issues/evidence/chronology/relief, cause-paper templates and packs, filing-readiness checklists, and non-destructive save-to-matter behavior across relevant practice portals.
10. Deliver robust exports using shared export services: citation, plain text, structured data, CSV search results, print-optimised report HTML, genuine DOCX, and A4 PDF case reports with LAWYes editorial provenance, paragraph pinpoints, headers/footers, status, verification date, and original-source link. Preserve and regression-test existing legal-document DOCX/PDF/print/HTML/text exports.
11. Seed only eligible current official records into the new workflow, prioritising Sabah/Sarawak High Court civil and criminal decisions, Industrial Court awards, and JAKESS judgments. Publish no report automatically; records lacking verified full text remain pending access/editorial records.
12. Run security, copyright/provenance, migration, unit, integration, export-file, and browser tests. Exercise existing sign-in/roles/subscriptions/payments/custom-domain paths without live charges; validate report gates, all search dimensions, source links, empty/error states, every export, desktop/mobile/keyboard behavior, production build, logs, and browser console. Fix discovered regressions before preparing the existing deployment for user-approved republishing.

## Relevant files
- `artifacts/landing-page/src/App.tsx`
- `artifacts/landing-page/src/pages/home.tsx`
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/routes/stripe.ts`
- `artifacts/api-server/src/routes/cases.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/research-admin.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/extraction/pipeline.ts`
- `lib/db/src/schema/research.ts`
- `lib/api-spec/openapi.yaml`
- `artifacts/research-admin/src/pages/rights-review.tsx`
- `artifacts/mylitai/src/pages/PracticeMatter.tsx`
- `artifacts/mylitai/src/pages/MatterDetail.tsx`
- `artifacts/mylitai/src/components/ExportButtons.tsx`
- `artifacts/api-server/src/lit/routes/exports.ts`


---

## 12. Document Contribution Portal

Source: .local/tasks/document-contribution-portal.md

# Document Contribution Portal

## What & Why
Let legal professionals contribute soft-copy cause papers and legal documents to strengthen the whole AI Portals ecosystem. Contributions are stored at scale, organized by category, and turned into a curated, searchable knowledge base that the apps can draw on to improve their proficiency and familiarity with real Malaysian legal documents.

Important architectural reality: the 7 apps are separate external deployments. This task builds the full supply side on THIS project — collection, large-volume storage, categorization, text extraction, curation, and a read API that exposes the approved corpus. Actually wiring each external app to consume the corpus (RAG/fine-tuning inside those apps) is out of scope here because it must be done inside each app.

## Done looks like
- Anyone can open a "Contribute" page from the landing page, fill in their name/email, pick one or more categories, and upload documents of ANY file format (PDF, DOC/DOCX, images, scans, ZIP, etc.).
- Multiple large files can be uploaded in one go without hitting a small size cap; storage scales to large volumes (object storage, not the DB).
- Each upload is recorded with contributor info, chosen category, original filename, size, format, and a status.
- Uploaded documents show a clear on-screen confirmation and a note that contributions are reviewed before being adopted into the knowledge base.
- Admin dashboard gets a "Contributions" section listing every submission, filterable by category and status, with the ability to download the original file and to change status (Pending -> Approved/Adopted -> Rejected).
- When a document is marked Adopted, its extracted text becomes part of a searchable knowledge base, and a read-only API endpoint can return approved/adopted corpus entries (title, category, extracted text, source metadata) so any app can consume it later.
- Text is auto-extracted where the format allows (PDF, DOCX, plain text); formats that can't be parsed are still stored and downloadable, just flagged as "not text-extracted".

## Out of scope
- Modifying the external apps (mylitai.life, mysyalitai.life, mycorpai.life, myconveyai.life, mycrimai.life, myccblitai.life, myaccidentai.life) to actually query/train on the corpus. That is separate work inside each app.
- Automatic model fine-tuning / retraining. We build the curated corpus + API; consumption is the apps' responsibility.
- Authentication/accounts for contributors (open submission with name/email, consistent with the existing open admin). Can be added later.
- OCR of scanned image-only PDFs (store + flag; OCR can be a later enhancement).

## Steps
1. **Provision object storage** — Set up App Storage (GCS-backed) for large-volume, any-format file storage, and wire the presigned-URL upload endpoints and object-serving routes into the API server.
2. **Contributions data model** — Add a `contributions` table capturing contributor name/email, category, original filename, content type, size, object storage path, extracted-text field, extraction status, and review status; regenerate the API layer from the OpenAPI spec.
3. **Contribution API** — Add endpoints to create a contribution record (after upload), list/filter contributions (admin), update status, and a read-only "knowledge base" endpoint returning approved/adopted entries with extracted text for downstream app consumption.
4. **Server-side text extraction** — On contribution create (or on adopt), extract text from supported formats (PDF, DOCX, TXT) into the extracted-text field; mark unsupported formats as not-extracted but keep them stored/downloadable.
5. **Public Contribute page** — Add a branded "Contribute" page/section to the landing page: contributor details, category picker (aligned to the app domains: Litigation, Syariah, Corporate Secretary, Conveyancing, Criminal, Corp/Comm/Banking, Accident & PI, plus a General/Other), multi-file any-format uploader with progress, and a clear confirmation + review-notice message. Add a nav/CTA entry point to it.
6. **Admin Contributions view** — Add a "Contributions" page to the admin dashboard to browse/filter by category and status, download original files, and change review status (including "Adopt into knowledge base").

## Relevant files
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/routes/admin/index.ts`
- `artifacts/api-server/src/routes/admin/subscribers.ts`
- `lib/db/src/schema/index.ts`
- `lib/db/src/schema/subscribers.ts`
- `lib/api-spec/openapi.yaml`
- `lib/api-spec/orval.config.ts`
- `artifacts/landing-page/src/pages/home.tsx`
- `artifacts/landing-page/src/pages/admin/subscribers.tsx`
- `artifacts/landing-page/src/components/admin/layout.tsx`
- `artifacts/landing-page/src/components/apps-grid.tsx`


---

## 13. Drive-to-Pipeline Ingestion Bridge

Source: .local/tasks/drive-to-pipeline-bridge.md

# Drive-to-Pipeline Ingestion Bridge

## What & Why
Drive-discovered assets (stored in `drive_assets`) are not currently connected to the research processing pipeline. This task builds the bridge: for each rights-approved Drive asset, download the file from Google Drive, store it in object storage, register it as a `research_source_container`, and enqueue the full pipeline (ingest → extract → segment → validate → editorial → metadata → search index).

This is the prerequisite for all case law to flow through to headnote generation and portal search.

## Done looks like
- The Research Admin console has a "Run Pipeline" button (or auto-triggers after a Drive inventory run) that enqueues all approved Drive assets that haven't been ingested yet
- Each asset's processing status is visible in the Research Admin Drive Inventory table (columns: ingested, extracted, verified, indexed)
- The existing job queue processes all enqueued jobs; verified judgments appear in `research_verified_judgments` as they complete each stage
- Re-running does not duplicate already-ingested containers (idempotent on Drive file ID)

## Out of scope
- Human review/verification UI for candidates/judgments (existing admin tooling handles this)
- Headnote and catchword generation (separate task)
- Portal-facing API or UI (separate tasks)

## Steps
1. **Download helper** — Add a `downloadDriveFile(fileId)` function using the Google Drive connector that streams the file content and stores it in object storage, returning the storage key and file size.
2. **Ingestion bridge function** — Write `ingestDriveAsset(driveAssetId)` that: checks the asset isn't already ingested (idempotent), downloads via step 1, creates a `research_source_container` row, creates a `research_source_page` for each page (or defers to extraction), and enqueues a `container.ingest` job. Update `drive_assets.processing_status` to `QUEUED`.
3. **Bulk trigger endpoint** — Add `POST /api/research-admin/drive/pipeline/start` that calls `ingestDriveAsset` for every `drive_assets` row with `rights_status = APPROVED` and `processing_status = PENDING`. Returns counts of newly queued vs already queued.
4. **Status sync** — Update `drive_assets.processing_status` as research jobs progress: listen/poll `research_jobs` for job state changes on containers that originate from Drive assets, and mirror: RUNNING → `PROCESSING`, SUCCEEDED (final stage) → `COMPLETED`, FAILED_PERMANENT → `FAILED`.
5. **Admin UI** — Add a "Run Pipeline on Approved Assets" button to the Research Admin Drive Inventory page and show per-asset pipeline status in the table.

## Relevant files
- `artifacts/api-server/src/research/drive/driveClient.ts`
- `artifacts/api-server/src/routes/research-admin.ts`
- `artifacts/research-admin/src/pages/drive-inventory.tsx`
- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/research/ingestion/service.ts`


---

## 14. Enrich LAWYes Sarawak Preview

Source: .local/tasks/enrich-test-lawyes-sarawak-preview.md

# Enrich LAWYes Sarawak Preview

## What & Why
Expand the simplified LAWYes Sarawak Safe Preview into a much richer practitioner demonstration while preserving its four-action, progressive-disclosure experience. Test-drive every major flow, repair faulty or confusing behavior, and test-drive it again so the preview feels substantial, reliable, and honest without connecting to production systems.

## Done looks like
- The opening screen remains simple and mobile-first, with one instruction box and four primary actions.
- Search, drafting, matter work, and all six Sarawak Practice Centre categories contain substantially more useful structured material, contextual guidance, examples, checklists, source notes, and verification detail.
- Enrichment clearly distinguishes verified law, access records, practitioner-review material, demonstrations, and known content gaps; no unverified legal proposition is presented as authoritative.
- Search offers guided filters, coherent jurisdiction behavior, useful empty states, visible result context, reliable history/deep links, and clear copy/export feedback.
- Draft generation requires its stated safeguards, uses pack-appropriate fields and defaults, and exports a useful source-and-gap manifest without implying lawyer approval.
- Matter work requires meaningful material selection, carries the client reference and chosen materials into confirmation, supports a clear Search/Draft handoff, and remains explicitly local-only.
- All visible buttons, links, navigation, disclosures, exports, keyboard paths, browser Back behavior, and responsive layouts work on desktop and mobile.
- A first browser test drive records defects, repairs address those defects, and a second browser test drive confirms the repaired flows with no new console errors.
- The Safe Preview remains isolated from production APIs, databases, authentication, uploads, billing, AI, persistence, and server writes.

## Out of scope
- Publishing or modifying `mylegalpracticeai.life`.
- Adding production integrations, persistence, authentication, billing, uploads, database access, or live AI.
- Claiming substantive Sarawak case reports or legal conclusions that have not completed the existing provenance and lawyer-review gate.
- Replacing the four-action information architecture with a dense dashboard.

## Steps
1. **Baseline test drive** -- Exercise every primary action, navigation path, disclosure, filter, report view, drafting step, matter step, export, browser-history behavior, keyboard path, and mobile layout; record reproducible defects and confusing states.
2. **Deepen the content model** -- Add significantly richer structured Sarawak coverage, official-source guidance, practical workflows, checklists, decision support, drafting intake, examples, provenance, verification metadata, and transparent gap notices without manufacturing authority.
3. **Improve search and report use** -- Add guided taxonomies and contextual result information, reconcile jurisdiction/filter behavior, strengthen empty/reset states, preserve useful URL/history state, and make copy/export outcomes explicit.
4. **Repair drafting safeguards** -- Require acknowledgements, tailor intake and output to each pack, show source and uncertainty manifests, and ensure every generated item remains clearly marked for practitioner review.
5. **Repair matter workflow** -- Require selected materials, carry entered details through confirmation, expose selected-source context, provide safe exports and handoffs, and keep the demonstration non-persistent.
6. **Preserve progressive disclosure** -- Keep advanced metadata, audits, source histories, and detailed practice content behind clear disclosures while improving desktop and mobile readability, keyboard access, focus handling, and overflow behavior.
7. **Strengthen regression coverage** -- Extend fixture and browser tests for content integrity, safety isolation, navigation/history, filters, safeguards, matter requirements, source links, exports, clipboard feedback, and responsive behavior.
8. **Final test drive and audit** -- Restart only the relevant workflow, rerun focused automated checks, repeat the desktop and mobile browser journey, repair any remaining regressions, and update the Safe Preview audit with verified counts and limitations.

**Critical constraints:** All work stays confined to the development-only Safe Preview. Richness must come from structured, source-aware practitioner assistance and transparent demonstrations, never invented legal authority or concealed uncertainty.

## Relevant files
- `artifacts/landing-page/src/pages/lawyes-safe-preview.tsx`
- `artifacts/landing-page/src/fixtures/lawyes-preview.ts`
- `artifacts/landing-page/src/fixtures/lawyes-preview.test.ts`
- `artifacts/landing-page/src/fixtures/lawyes-verified-reports.json`
- `artifacts/landing-page/src/index.css`
- `artifacts/landing-page/src/App.tsx`
- `artifacts/landing-page/LAWYES_SARAWAK_SAFE_PREVIEW_AUDIT.md`
- `docs/lawyes-sarawak-safe-preview-audit.md`
- `artifacts/api-server/e2e/lawyes-safe-preview-source.spec.ts`

---

## 15. Firm Accounts Module in MyLawFirmAi

Source: .local/tasks/firm-accounts-module.md

# Firm Accounts Module in MyLawFirmAi

## What & Why
Law firms in Malaysia must keep an office account and a separate client (trust) account under the Solicitors' Account Rules. MyLawFirmAi has no accounting at all. This adds an Accounts section: office ledger, client account ledger, expenses, receipts and reports.

## Done looks like
- Office account: record income (bills paid, other income) and expenses (rent, salaries, utilities, disbursements) with categories; running ledger and monthly view
- Client account: per-client trust ledger — money in (deposits from client), money out (disbursements, transfers to office when billed), with a hard rule that a client ledger can never go negative and office/client funds are never mixed
- Receipts/payment vouchers printable as PDF
- Reports: monthly profit & loss, expense breakdown, client-account balances list, simple cashflow — viewable on screen and exportable
- Manager-only access; works end to end in the browser

## Out of scope
- Bank feed integration and auto-reconciliation
- Statutory audit filing formats
- Payroll postings (HR module owns payroll; accounts records the salary expense manually or via a summary entry)

## Steps
1. **Ledger schema & routes** — Office ledger, client trust ledgers, categories and vouchers in the firm schema; enforce the no-negative-client-ledger and no-mixing rules at the API level; manager-session gated
2. **Reports** — P&L, expense breakdown, trust balances, cashflow endpoints with PDF export
3. **Frontend Accounts section** — Accounts area in MyLawFirmAi: office ledger, client ledgers, add income/expense/receipt forms, reports dashboard with charts
4. **End-to-end verification** — Post entries, attempt an overdrawn client ledger (must be blocked), generate reports and PDFs in the browser

## Relevant files
- `artifacts/api-server/src/firm/index.ts`
- `artifacts/api-server/src/firm/routes/index.ts`
- `artifacts/mylawfirmai/src/pages/dashboard.tsx`


---

## 16. Firm HR Module in MyLawFirmAi

Source: .local/tasks/firm-hr-module.md

# Firm HR Module in MyLawFirmAi

## What & Why
MyLawFirmAi manages staff tasks and meetings, but has no human-resources functions. Law firms need employee records, leave, attendance and payroll basics. This adds an HR section to MyLawFirmAi for managers.

## Done looks like
- Employee records: personal details, position, employment dates, salary, EPF/SOCSO/income-tax reference numbers, emergency contact, employment documents
- Leave management: Malaysian leave types (annual, medical, maternity/paternity, unpaid), balances, staff apply → manager approves/rejects, calendar view
- Attendance: simple clock-in/out or daily presence record, monthly summary
- Payroll basics: monthly payslip generation with gross salary, EPF/SOCSO/EIS/PCB statutory deductions at current Malaysian rates, net pay; payslip PDF download
- All manager-only areas locked to the manager session; staff see only their own records, leave and payslips
- Works end to end in the browser

## Out of scope
- Bank payment file generation / actual salary disbursement
- Performance reviews (existing goals/insights features remain)

## Steps
1. **HR schema & routes** — Employee, leave, attendance and payroll tables in the firm schema; routes split into manager-only and self-service, mounted behind the existing manager/staff session gates
2. **Payroll calculations** — Statutory deduction calculators (EPF, SOCSO, EIS, PCB simplified) with rates kept in one editable config; payslip PDF
3. **Frontend HR section** — New HR area in MyLawFirmAi: employees, leave (apply/approve + calendar), attendance, payroll runs & payslips
4. **End-to-end verification** — Manager and staff flows tested in the browser; cross-staff access must be denied

## Relevant files
- `artifacts/api-server/src/firm/index.ts`
- `artifacts/api-server/src/firm/routes/users.ts`
- `artifacts/mylawfirmai/src/pages/dashboard.tsx`


---

## 17. Fix phase07 runNextJob race condition

Source: .local/tasks/fix-phase07-flaky-test.md

# Fix phase07 runNextJob race condition

## What & Why
The `phase07.test.ts` editorial-processor test fails intermittently when the full test suite runs together. The retry loop calls `runNextJob()` with no kind filter, so it can claim jobs from other test files (phase09, phase10, etc.) before claiming the editorial classification job it actually needs. After 15 stolen claims the retry budget exhausts and the container never transitions to `JUDGMENT_VERIFICATION_PENDING`.

The fix is a single-line change: pass `"container.editorial_classify"` as the kind argument to every `runNextJob()` call inside phase07's retry loop. `runNextJob(kind)` already supports this filter — it just isn't used.

## Done looks like
- `phase07.test.ts` passes consistently in the full suite across multiple back-to-back validation runs
- No other test files are affected

## Out of scope
- Changes to any production code (processors, routes, DB schema)
- Fixing other test files (only phase07 has this problem)

## Steps
1. **Pass kind filter to runNextJob** — In the retry loop at line ~955 of `phase07.test.ts`, change `runNextJob()` to `runNextJob(EDITORIAL_JOB_KIND)`. Import `EDITORIAL_JOB_KIND` from the editorial processor module (already available in the file via `startEditorialClassification`).
2. **Verify** — Run the full test suite three consecutive times and confirm 325/325 pass every time.

## Relevant files
- `artifacts/api-server/src/research/phase07.test.ts:929-975`
- `artifacts/api-server/src/research/isolation/editorialProcessor.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`


---

## 18. AI Headnotes & Catchwords Generator

Source: .local/tasks/headnotes-catchwords-pipeline.md

# AI Headnotes & Catchwords Generator

## What & Why
The research pipeline produces verified judgments and extracted metadata (case name, citation, court, parties, dates) but has no headnotes or catchwords — the two most important law reporter outputs. This task adds: a DB schema for structured headnotes and catchwords, an AI processor (Gemini) that generates professional law reporter-style headnotes and catchwords from verified judgment text, and a review/approval workflow so editors can confirm or edit AI-generated output before it goes live.

## Done looks like
- Each verified judgment in `research_verified_judgments` can have one or more headnotes (numbered, summarising each point of law) and a list of catchwords (keyword phrases, hierarchical e.g. "Contract — Breach — Damages")
- Headnotes follow Malaysian law reporter style: numbered paragraphs, each stating a point of law held, with the paragraph reference from the judgment
- Catchwords are comma/em-dash separated keyword hierarchies matching MLJ/CLJ conventions
- AI-generated headnotes and catchwords are marked `ai_draft` until reviewed; a Research Admin review UI lets editors accept, edit, or regenerate them
- Accepted headnotes and catchwords are included in the search index

## Out of scope
- Headnote display in portal apps (covered in the portal API + UI tasks)
- Ratio decidendi or full law report writing (future)

## Steps
1. **Schema** — Add `research_headnotes` table (judgment_id, number, text, point_of_law_paragraph_ref, status: ai_draft/accepted/rejected, processor_version, created_at) and `research_catchwords` table (judgment_id, catchword_line, status, processor_version, created_at). Add indexes and export types.
2. **AI processor** — Register a `container.headnotes` job processor that: fetches the verified judgment's full text (paragraphs from `research_verified_judgments`), calls Gemini with a Malaysian law reporter prompt requesting structured headnotes (JSON array of {number, text, paragraphRef}) and catchwords (string in MLJ format), validates the JSON, and upserts rows into both tables with status `ai_draft`.
3. **Auto-enqueue** — After a judgment's search-index job succeeds, automatically enqueue a `container.headnotes` job for that judgment (idempotent: skip if headnotes already accepted).
4. **Review API** — Add endpoints under `/api/research-admin/headnotes/:judgmentId` to list ai_draft headnotes/catchwords, `PATCH` to edit text and mark `accepted`, `DELETE` to reject, and `POST /regenerate` to re-run the AI processor.
5. **Admin review UI** — Add a "Headnotes Review" page in the Research Admin console listing judgments with `ai_draft` headnotes, with inline editing, accept/reject buttons, and a regenerate option.

## Relevant files
- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/research/analysis/processor.ts`
- `artifacts/api-server/src/routes/research-admin.ts`
- `artifacts/research-admin/src/pages/`
- `artifacts/api-server/src/research/search/searchIndexProcessor.ts`


---

## 19. Integrate MyConveyLitAI App

Source: .local/tasks/integrate-myconveylitai.md

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


---

## 20. Judgment Research Platform Bootstrap (Phase 00)

Source: .local/tasks/judgment-research-bootstrap.md

# Judgment Research Platform Bootstrap (Phase 00)

## What & Why
Bootstrap a private legal judgment research and knowledge-management platform inside this monorepo. It will eventually serve the 8 legal portals (MyLitAI, MyLitAI IRAC, MySyalitAI, MyCorpLegalAI, MyConveyLitAI, MyCrimAI, MyCCBLitAI, MyAccidentAI). The platform ingests folders/ZIP archives of documents where a source file is a CONTAINER, not automatically a case — a file may hold zero, one, many, duplicate, partial, or split judgments. Phase 00 delivers only the stable foundation: persistent governance documents, module architecture with replaceable adapters, database schema stubs, a database-backed job queue skeleton, and smoke tests. No document extraction, OCR, case segmentation, or AI analysis in this phase.

## Done looks like
- The API server starts successfully with the new research module mounted (health endpoint responds).
- All required persistent documents exist:
  - `replit.md` extended with a "Judgment Research Platform" section carrying the persistent agent rules (source-container model, provenance, uncertainty routed to human review, judicial-text integrity, publisher-content isolation, rights gating with all files starting UNREVIEWED, AI as separate evidence-backed research aid, engineering behaviour rules, phase discipline). The existing AI Web Books content is preserved, not replaced.
  - `docs/PROJECT_CHARTER.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY_MODEL.md`, `docs/RIGHTS_MODEL.md`, `docs/PROCESSING_STATES.md`, `docs/PHASES.md`
  - `docs/status/current-phase.json` recording Phase 00 as complete
  - `docs/reports/` (Phase 00 completion report goes here) and `docs/decisions/` (ADR directory with an initial decision record)
  - `fixtures/synthetic/` with small synthetic multi-judgment container fixtures; `fixtures/golden/` scaffolded (real restricted case files are excluded from source control — enforced via .gitignore)
- Test, lint, type-check, and formatting commands exist and pass (`typecheck` and `prettier` exist at root already; add lint and research tests).
- An automated smoke test passes (server boots, research health endpoint, job queue enqueue/claim/complete round-trip, adapter registry resolves defaults).
- Architecture separates web, data, processing, storage, and AI modules with replaceable adapters: storage adapter (object storage default), OCR adapter (stub, disabled), search adapter (Postgres default), AI-provider adapter (disabled by default).
- Rights gating baked into the schema: every source file row starts with rights status `UNREVIEWED`.
- A checkpoint is produced and a Phase 00 completion report is written to `docs/reports/`, after which work stops (phase discipline).

## Out of scope
- Document extraction, OCR, case segmentation, deduplication, and AI analysis (later phases)
- Any UI inside the 8 portals (later phases; Phase 00 is backend + docs foundation)
- Real judgment data ingestion; only local synthetic fixtures
- External queue/search infrastructure (database-backed queue and Postgres search only for now)

## Steps
1. **Persistent documents** — Write the charter, architecture, data model, security model, rights model, processing states, and phases documents; create the status, reports, decisions, and fixtures directories; extend `replit.md` with the platform's persistent rules section.
2. **Research module scaffold** — Add a `research` module to the shared API server following the existing per-portal module pattern, with clear submodule boundaries: web (routes), data (repositories), processing (job handlers), storage, and AI. Mount under `/api/research` with a health endpoint.
3. **Database schema (non-destructive)** — Add research-prefixed tables in the shared db lib: source containers (with rights status defaulting to UNREVIEWED, checksum, provenance fields), processing jobs (queue with states, attempts, idempotency key, resumability), transformations/audit log, and review queue stubs. Push via the existing dev push flow; no destructive migrations.
4. **Adapter layer** — Define TypeScript interfaces and a registry for storage, OCR, search, and AI-provider adapters; wire default implementations (object storage, stub OCR, Postgres search, disabled AI) selected via configuration, with AI off by default.
5. **Job queue skeleton** — Database-backed queue with enqueue, atomic claim, complete/fail, retry with attempt limits, and idempotent handlers; a no-op "container registered" job proves the loop works. Errors recorded to the jobs table and surfaced in logs (restricted data excluded from log lines).
6. **Fixtures and tests** — Add synthetic fixture files modelling the container principle (empty file, single judgment, multi-judgment, split-across-files) and integration tests: smoke boot test, health endpoint, queue round-trip, adapter registry, rights-status default. Add a root lint command if missing. All existing tests must remain passing.
7. **Phase close-out** — Write `docs/status/current-phase.json` (phase 00, complete) and the Phase 00 completion report in `docs/reports/`, then stop (do not begin extraction/OCR work).

Note: judicial-text integrity and publisher-content isolation are documented as schema/architecture constraints in this phase; the enforcing pipelines arrive in later phases.

## Relevant files
- `replit.md`
- `artifacts/api-server/src/app.ts`
- `lib/db`
- `artifacts/api-server/package.json`
- `package.json`
- `pnpm-workspace.yaml`


---

## 21. Launch Project Sarawak 20

Source: .local/tasks/launch-project-sarawak-20.md

# Launch Project Sarawak 20

## What & Why
Create a completely separate, public Project Sarawak 20 campaign app at /sarawak20/ without changing or interrupting the current LAWYes website. The app will translate the supplied campaign artwork into a polished responsive landing page and provide a real first-come, first-served Stripe subscription channel for two founding cohorts: the first 20 paid law firms/lawyers and the first 20 paid chambering students.

The approved founding offer is RM49 per month for every participant, cancellable anytime. The founding price is protected for 12 months while the subscription remains active. Each cohort has its own 20-place cap; a place is secured by completed payment, not by an unverified form submission.

## Done looks like
- A new standalone Project Sarawak 20 web artifact opens at /sarawak20/ and the existing LAWYes landing page is unchanged
- The visual direction follows the supplied navy, Sarawak green, white, and orange campaign artwork, with strong mobile and desktop presentation
- The page clearly explains the co-development programme, Sarawak-practice focus, founding-partner benefits, eligibility, RM49 monthly price, cancellation terms, and 12-month founding-rate protection
- Visitors choose either Law Firm / Lawyer or Chambering Student and can see trustworthy remaining-place information for that cohort
- Each cohort accepts no more than 20 active paid participants, including under concurrent checkout attempts
- Repeated clicks, abandoned or expired checkouts, duplicate webhooks, failed payments, and cancellations cannot leak or over-allocate places
- Successful Stripe checkout provisions access through the existing LAWYes access-code flow, shows a clear confirmation, and provides subscription-management access
- Once a cohort is full, checkout is disabled with a clear sold-out or waitlist-style message; cancellations safely make a place available again
- The programme uses its own MYR 49.00 monthly Stripe catalog entry and does not alter existing USD prices or checkout behavior
- Public campaign routes are crawlable with appropriate title, description, Open Graph artwork, structured data, robots, sitemap, and prerendered content
- Focused API, payment, concurrency, cancellation, responsive, accessibility, and end-to-end browser checks pass

## Out of scope
- Replacing, restyling, or rerouting the existing LAWYes landing page
- Building the future Sarawak Practice Mode product features themselves; the page presents these as co-development programme outcomes rather than already-complete functionality
- Multi-seat firm administration beyond one founding subscription/place per checkout
- Increasing either founding cohort beyond 20 without a later product decision
- Alternative payment providers or manual bank-transfer enrollment

## Steps
1. **Create the standalone campaign artifact** — Bootstrap and register a React-Vite app for /sarawak20/, copy the supplied programme artwork into its own public assets, and establish independent routing, metadata, and prerendering.
2. **Design the campaign experience** — Build a responsive, conversion-focused page with campaign hero, programme story, founding benefits, eligibility tracks, transparent terms, live cohort status, FAQs, and strong but non-coercive checkout actions.
3. **Add programme catalog and availability contracts** — Extend the shared API contract with dedicated read and checkout operations for the two Sarawak cohorts while preserving every existing checkout caller and USD catalog response.
4. **Enforce first-paid cohort limits** — Add a concurrency-safe reservation and enrollment ledger so active paid subscriptions plus unexpired checkout reservations can never exceed 20 per cohort.
5. **Integrate Stripe checkout and lifecycle events** — Provision an isolated MYR 49 monthly programme product, create idempotent checkout sessions, consume or release reservations from Stripe events, and reuse existing access-code activation and deactivation flows.
6. **Complete success and cancellation journeys** — Show verified checkout confirmation, access instructions, cohort status, and customer-portal management while ensuring cancellation frees exactly one place and revokes access exactly once.
7. **Protect existing products with regression coverage** — Test parallel 20/21 checkout behavior, expiry, duplicate delivery, failure cleanup, cancellation reuse, mobile/desktop accessibility, existing USD checkout invariants, and a real browser journey through both cohort choices.
8. **Verify and present the new app** — Restart affected workflows, inspect logs, capture responsive screenshots, verify the original landing page is unchanged, and present the new artifact for review.

## Critical architectural constraints
- The two 20-place limits must be enforced server-side under database locking; client-side counters are informational only.
- Stripe remains the source of truth for products and prices, while programme reservations and cohort membership live in application tables.
- The programme MYR catalog is separate from the current USD-only LAWYes catalog and must not enable adaptive currency conversion on existing products.
- A checkout reservation expires and releases automatically; only a completed paid subscription becomes an active founding place.
- Marketing copy must distinguish available programme benefits from future Sarawak Practice Mode features being shaped with founding participants.

## Relevant files
- `attached_assets/bf7a5c9e-36f7-47c9-8d6e-f16eba951516_1787900306121.png`
- `artifacts/landing-page/package.json`
- `artifacts/landing-page/vite.config.ts`
- `artifacts/landing-page/src/main.tsx`
- `artifacts/landing-page/src/entry-server.tsx`
- `artifacts/landing-page/prerender.mjs`
- `artifacts/api-server/src/routes/stripe.ts`
- `artifacts/api-server/src/lib/provisioning.ts`
- `artifacts/api-server/src/app.ts`
- `lib/db/src/schema/kohorts.ts`
- `lib/db/src/schema/subscribers.ts`
- `lib/api-spec/openapi.yaml`
- `pnpm-workspace.yaml`


---

## 22. Simplify LAWYes Sarawak Preview

Source: .local/tasks/lawyes-sarawak-release-readiness.md

# Simplify LAWYes Sarawak Preview

## What & Why

Redesign the existing LAWYes Sarawak Safe Preview because the current page feels too complicated. Preserve verified content, safeguards, source metadata, search and exports, but reorganise them through progressive disclosure so a busy Malaysian practitioner can understand the workspace immediately on desktop and phone.

## Done looks like

- The opening screen shows one natural-language instruction/search box and exactly four primary actions: Search Law & Cases, Draft a Legal Document, Work on a Matter, and Sarawak Practice Centre.
- Search initially exposes only query, jurisdiction, practice area and search; specialist fields sit behind one Advanced filters control.
- Result summaries stay concise, with source status, editorial history, treatment and full metadata shown only after selection.
- Drafting follows a short guided sequence from practice area and document choice through essential questions, warnings and context-appropriate exports.
- Matter work uses clearly labelled demonstration data and a simple identify/create, task, materials and next-action flow without persistence or writes.
- The Sarawak Practice Centre opens into six categories: Civil Litigation, Criminal Litigation, Conveyancing & Land, NCR & Native Law, Probate & Estates, and Professional Practice.
- Source registers, audit methodology, coverage statistics and technical disclaimers live in one discreet Sources & Verification area; ordinary content shows only a compact badge and law-as-at date.
- Navigation, wording, whitespace and visual hierarchy are simplified, with fewer simultaneous cards and no dashboard of metrics.
- Mobile is single-column, has large tap targets, no horizontal overflow and a sticky bottom navigation with no more than four items.
- TXT, DOCX, print/PDF, CSV and JSON exports remain functional but appear only after a report, result or generated document makes them relevant.
- The running preview uses one canonical dataset and one consistent audit summary; no access record is upgraded without verification.
- Desktop and 390-pixel mobile browser checks cover all requested flows, keyboard access, empty states, back navigation and overflow.
- Existing relevant regressions, type checking and production build run after the final changes with exact pass/fail results recorded.
- The work remains confined to `/lawyes-safe-preview`; nothing is published to mylegalpracticeai.life.

## Out of scope

- Publishing or changing mylegalpracticeai.life.
- Connecting the Safe Preview to production APIs, databases, authentication, uploads, billing, AI or persistent browser storage.
- Adding new product features beyond reorganising the existing capabilities.
- Fabricating legal propositions or upgrading unverified access records.
- Treating practitioner-review templates as approved court forms.

## Steps

1. **Reconcile the preview data** — Establish one canonical fixture and audit, preserve verified material and remove conflicting counts or duplicate representations.
2. **Rebuild the opening experience** — Create the universal instruction box and four-action home with plain practitioner language and progressive disclosure.
3. **Simplify legal search** — Reduce the default form, move specialist fields behind Advanced filters, and show detailed provenance and editorial information only in the selected-result view.
4. **Guide drafting and matter work** — Convert the existing packs and demonstration matter tools into short, sequential flows with warnings and exports shown at the appropriate stage.
5. **Reorganise Sarawak practice content** — Group existing sources, legislation, judgments, registry material, forms and updates under the six required categories.
6. **Consolidate verification information** — Move full audit, provenance methodology, status history and coverage details into Sources & Verification while retaining compact badges and law-as-at dates elsewhere.
7. **Optimise responsive interaction** — Implement single-column mobile layouts, large targets, four-item sticky bottom navigation, keyboard navigation, back behavior and overflow protection.
8. **Validate the final preview** — Run type checking, production build, focused fixture tests, relevant existing regressions and desktop/mobile browser scenarios; record exact results and confirm production remains untouched.

## Relevant files

- `artifacts/landing-page/src/pages/lawyes-safe-preview.tsx`
- `artifacts/landing-page/src/fixtures/lawyes-preview.ts`
- `artifacts/landing-page/src/fixtures/lawyes-sarawak-preview.ts`
- `artifacts/landing-page/src/fixtures/lawyes-preview.test.ts`
- `artifacts/landing-page/src/fixtures/lawyes-verified-reports.json`
- `artifacts/landing-page/src/index.css`
- `artifacts/landing-page/LAWYES_SARAWAK_SAFE_PREVIEW_AUDIT.md`
- `docs/lawyes-sarawak-safe-preview-audit.md`

---

## 23. Client Letters & Dated Drafts Workspace

Source: .local/tasks/letters-drafts-timeline.md

# Client Letters & Dated Drafts Workspace

## What & Why
Lawyers write letters to clients (fee updates, status reports, requests for documents) and iterate on drafts of cause papers/legal documents over time. Portals can generate some AI documents but there is no letter-writing tool addressed to a client, and drafts are not organised by date/version. This adds an AI-assisted client letter writer and a dated drafts workspace on every practice portal.

## Done looks like
- A "Letters" tool per matter: pick letter type (status update, fee reminder, request for documents, cover letter to court/opponent, etc.), AI drafts it in English or Bahasa Malaysia on the firm's letterhead details, lawyer edits and saves; export as PDF/DOCX
- A "Drafts" workspace per matter: every saved draft (cause papers, letters, agreements, AI outputs) is listed by date with version history — saving again creates a new dated version, older versions remain viewable
- Both work end to end in the browser on all 7 practice portals

## Out of scope
- Emailing letters directly to clients
- Binary uploads (covered by the document vault task)

## Steps
1. **Draft versioning layer** — Extend the shared saved-work storage with versions (parent draft id, version number, created date) and a timeline listing endpoint
2. **Letter generation** — Shared AI letter-writer endpoint (behind auth + the shared AI rate limiter, auth first) with letter-type templates appropriate to each portal's practice area; letterhead details editable per subscriber
3. **Export** — PDF and DOCX export of any draft version
4. **Portal UI** — Letters tool and Drafts timeline on matter pages in all 7 practice portals
5. **End-to-end verification** — Generate, edit, re-save (new version), export, and confirm history displays correctly in the browser

## Relevant files
- `artifacts/api-server/src/lib/matterFiles.ts`
- `artifacts/api-server/src/utils/docxExport.ts`
- `artifacts/api-server/src/sya/routes/document-generator/index.ts`
- `.agents/memory/ai-ratelimit-auth-ordering.md`


---

## 24. Migrate Legacy MyConveyAI User Data

Source: .local/tasks/migrate-conveyai-users.md

# Migrate Legacy MyConveyAI User Data

## What & Why
Bring the ~107 existing student accounts (and related data) from the original MYConveyAI project's production database into this project's database, so legacy users can keep logging in (email+password or their existing access codes) on the integrated MyConveyLitAI app.

## Done looks like
- All legacy user rows imported into this project's `users` table with password hashes, access codes, tiers, and grandfathered flags intact.
- A legacy user can log in with email+password on the hosted MyConveyLitAI app.
- No duplicate or clobbered accounts; import is idempotent and reports a summary (imported/skipped counts).
- Prof confirms with a spot-check login.

## Out of scope
- Migrating AI conversation history unless the export includes it and Prof wants it.
- Changes to auth logic (done in the integration task).

## Steps
1. Ask Prof to export the data from the old project (provide exact instructions: SQL dump or CSV of the `users` table — and optionally `conversations`/`messages`/`ai_usage` — from the old project's production database).
2. Build an idempotent import script in the workspace `scripts` package that validates rows, preserves password hashes and access codes exactly, skips existing accounts, and logs a summary.
3. Run the import against the development database first, verify counts and a test login, then plan the production import (run against prod DB only with Prof's explicit go-ahead).
4. Verify: legacy login works both by email+password and by access code; admin user list shows the imported accounts.

## Relevant files
- `scripts/src`
- `lib/db/src/schema/index.ts`


---

## 25. Export and save every draft

Source: .local/tasks/mycorp-draft-export-matter-storage.md

# Export and save every draft

## What & Why
Make every MyCorpLegalAI-generated work product easy to export in several useful formats and easy to file into the exact matter selected by the user. Store large draft bodies in private object storage while keeping searchable metadata and ownership links in the database, so saving and reopening drafts remains fast and reliable as the document library grows.

## Done looks like
- Every completed AI result, including the shared AI Drafter panel and specialist tool pages, exposes Copy, TXT, Markdown, Word, and PDF export actions.
- Users can choose an existing matter or create a new matter from any completed draft, see upload/save progress, and receive a clear success state with a link back to that matter.
- A saved draft appears in the selected matter's Documents/Work area and can be reopened or downloaded without exposing another user's files.
- Large drafts do not travel through PostgreSQL as the primary blob; private object storage holds the document body and the database holds ownership, matter, filename, format, size, and storage status metadata.
- Storage failures, expired upload grants, retries, and interrupted saves show actionable messages and never report success prematurely.
- Matter lists, saved-work lists, and document downloads remain owner-scoped and do not regress existing access-code isolation.

## Out of scope
- Collaborative simultaneous editing or version-diff workflows.
- Changing the AI drafting prompts or legal-content policy.
- Public or unauthenticated document URLs.
- Replacing the existing matter model or migrating unrelated portals.

## Steps
1. **Unify export actions** -- Ensure all completed draft surfaces use the shared export controls and preserve clean formatting for Word/PDF output, including tables and long documents.
2. **Add save-to-matter everywhere** -- Add the matter picker/create flow to the shared AI Drafter panel and keep the specialist page flow aligned, with save disabled until a terminally complete response exists.
3. **Move draft bodies to private storage** -- Add an owner-checked, database-backed upload/consume flow for generated draft content, store canonical object paths and metadata, and keep a bounded preview only where list responses need one.
4. **Serve saved drafts safely** -- Add owner- and matter-checked reopen/download behavior, clean up stored objects when a saved work item is deleted, and preserve existing soft-link and matter ownership rules.
5. **Make saves resilient** -- Add progress, retry-safe state handling, bounded client memory use, and explicit failure states so slow storage or a dropped connection cannot create duplicate or misleading records.
6. **Verify the full user flow** -- Cover export buttons, save-to-new/existing-matter, reopen/download, cross-owner denial, large content handling, interrupted upload, and browser behavior for both shared and specialist drafting surfaces.

## Relevant files
- `lib/draft-export/src/index.ts`
- `lib/draft-export/src/react.tsx`
- `artifacts/mycorplegalai/src/pages/ToolDetailPage.tsx`
- `artifacts/mycorplegalai/src/components/ai-tools/AiToolsPanel.tsx`
- `artifacts/mycorplegalai/src/components/SaveToMatterPanel.tsx`
- `artifacts/mycorplegalai/src/components/MatterPicker.tsx`
- `artifacts/mycorplegalai/src/hooks/use-saved-work.ts`
- `artifacts/mycorplegalai/src/pages/MatterDetailPage.tsx`
- `artifacts/api-server/src/lib/matterFiles.ts`
- `artifacts/api-server/src/lib/caseDocuments.ts`
- `artifacts/api-server/src/lib/objectStorage.ts`
- `lib/db/src/schema/matter-files.ts`

---

## 26. Phase 01: Core Architecture & State Machines

Source: .local/tasks/phase-01-core-architecture.md

# Phase 01: Core Architecture & State Machines

## What & Why
Build the architectural foundation of the Judgment Research Platform on top of the Phase 00 bootstrap: the full entity model, enforceable state machines for containers and jobs, a processor execution contract, and a complete testing foundation. No document intelligence (no OCR, PDF parsing, segmentation, AI, semantic search, or exports) is implemented — this phase makes later phases safe to build.

Note: this redefines Phase 01 relative to the current `docs/PHASES.md` table ("Ingestion"). Per the phase-discipline rule, the change requires a decision record (`docs/decisions/0002-...`) and an updated phase table — included in scope.

## Done looks like
- All ten core entities exist as `research_*` tables with Drizzle schemas and Zod validation: users (staff roles for review), source containers (extended), source pages, processing jobs (extended), case candidates, verified cases, rights records, human-review tasks, audit events, stored artifacts.
- Containers move through an enforceable state machine with exactly the 20 required states (UPLOADED → … → DELETED, incl. QUARANTINED, PROCESSING_BLOCKED, DELETION_PENDING); every transition goes through one guarded function; invalid transitions are rejected with a structured error and are proven rejected by tests.
- Jobs use the 8 required job states (QUEUED, RUNNING, SUCCEEDED, FAILED_RETRYABLE, FAILED_PERMANENT, CANCELLED, REVIEW_REQUIRED, BLOCKED_BY_RIGHTS) with their own guarded transition function; retryable and permanent failures are distinguishable.
- Every processor run records: processor version, idempotency key, created/started/finished times, retry count, structured failure reason, source checksum, output checksum, and provenance links; re-running with the same idempotency key never duplicates outputs.
- Every state change (container and job) emits an audit event row automatically and atomically (same transaction).
- Testing foundation in place: unit tests (vitest), integration tests against an isolated database schema (not the shared dev data), a browser end-to-end framework wired up with at least one passing smoke test, a synthetic fixture factory, and golden-result comparison utilities with golden files under `fixtures/golden/`.
- All previously passing tests (49) remain green; docs updated (`ARCHITECTURE.md`, `DATA_MODEL.md`, `PROCESSING_STATES.md`, `PHASES.md` + decision record); completion report `docs/reports/phase-01-completion.md` written and `docs/status/current-phase.json` updated.

## Out of scope
- OCR, PDF parsing, text extraction, segmentation, AI summaries, semantic search, production exports (Phases 02+).
- Any upload UI or portal-facing UI (state machines are exercised via code/API and tests only; a UI is not required by this phase).
- Real restricted legal documents — synthetic fixtures only.
- Removing or weakening any Phase 00 control (rights gating, provenance, review routing, disabled AI).

## Steps
1. **Decision record + phase table update** — Write an ADR recording the redefinition of Phase 01 as "Core architecture, state machines, test harness" (Ingestion shifts later) and update the phase table accordingly.
2. **Entity schema expansion** — Add the missing entities as additive `research_*` tables (source pages, case candidates, verified cases, rights records, review tasks, audit events, stored artifacts, research users/roles) and extend containers and jobs with the required state and processor-metadata columns; migrate existing rows from the Phase 00 states to the new state vocabulary with a recorded, reversible mapping. Apply tables via additive SQL (do not use interactive drizzle push — it has proposed destructive renames in this repo).
3. **Container state machine** — Implement a single guarded transition function with an explicit allowed-transitions map for the 20 states; invalid transitions throw a structured error; every accepted transition writes an audit event in the same transaction.
4. **Job state machine + processor contract** — Rework the job queue to the 8 job states while keeping idempotent enqueue and SKIP LOCKED claiming; add processor version, checksums, structured failure reasons, timing fields, and provenance links; rights-blocked and review-required outcomes route to the correct states; same-idempotency-key re-execution is a no-op.
5. **Testing foundation** — Add a database-isolated integration test environment (dedicated schema created/dropped per run), a synthetic fixture factory, golden-result comparison utilities with initial golden files, and a browser end-to-end framework with a passing smoke test; keep the existing 49 tests green.
6. **State-machine and processor test suites** — Exhaustive tests: every invalid container/job transition rejected, retryable vs permanent failure paths, idempotency no-duplication, audit events emitted for all state changes.
7. **Docs + close-out** — Update architecture/data-model/processing-state docs, write the phase-01 completion report in the agreed template, and set `docs/status/current-phase.json` to complete.

## Relevant files
- `lib/db/src/schema/research.ts`
- `lib/db/src/schema/index.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/research.test.ts`
- `docs/PROCESSING_STATES.md`
- `docs/PHASES.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-00-completion.md`
- `fixtures/synthetic/README.md`
- `fixtures/golden/README.md`


---

## 27. Phase 02: Authentication, Roles, Rights & Quarantine

Source: .local/tasks/phase-02-auth-roles-rights-quarantine.md

# Phase 02: Authentication, Roles, Rights & Quarantine

## What & Why

Implement authentication, an 8-role model, a 13-status document-rights vocabulary, a combined role-plus-rights access decision layer, and quarantine enforcement for the Judgment Research Platform — before any document processing exists. This replaces the previously planned "Ingestion" scope for Phase 02, so the change requires a new Architecture Decision Record (ADR 0003) and updates to `docs/PHASES.md` and `docs/RIGHTS_MODEL.md` (which currently defines only 4 rights statuses: UNREVIEWED / CLEARED_INTERNAL / RESTRICTED / EXCLUDED — those must be migrated into the new 13-status vocabulary with a recorded, reversible mapping).

## Done looks like

- Research platform users authenticate and hold exactly one of 8 roles: owner, administrator, rights reviewer, legal reviewer, researcher, lecturer, student, read-only guest.
- Every source container carries one of the 13 rights statuses (UNREVIEWED, COMMERCIAL_SOURCE_REVIEW_REQUIRED, PRIVATE_PROCESSING_APPROVED, OFFICIAL_COURT_SOURCE, PUBLIC_OR_OPEN_LICENCE_SOURCE, USER_OWNED_OR_AUTHORISED, DISPLAY_RESTRICTED, ANALYSIS_RESTRICTED, EXTERNAL_AI_RESTRICTED, EXPORT_RESTRICTED, DO_NOT_PROCESS, DO_NOT_RETAIN, MANUAL_LEGAL_REVIEW_REQUIRED); new containers still default to UNREVIEWED with no way to supply another value at insert.
- A single access-decision function evaluates (user role × resource rights status × requested action: view / search / process / analyse / external-AI / export / share / print) and is the only gate used by routes and job processors. A permissive role can never override a more restrictive rights status — administrators cannot bypass DO_NOT_PROCESS without a formal, audited rights-status change.
- Quarantined sources (QUARANTINED processing state, or restrictive rights statuses) are visible only to administrators and rights reviewers, excluded from search and AI and external processing, cannot be shared by public URL, and cannot be exported without express approval recorded in the rights record.
- The rights record captures all 17 required fields (source; date obtained; declared source type; licence/permission reference; approved users; approved purposes; storage / analysis / external-processing / student-access / printing / export permissions; retention period; expiry date; reviewer; review date; notes) with an append-only history; the container mirrors the latest status.
- Rights-status changes and access denials on restricted resources create audit events atomically.
- Test suite proves all 6 required scenarios: unauthenticated user sees no protected source; student cannot see a lecturer-only source; administrator cannot bypass DO_NOT_PROCESS without a formal rights change; quarantined source absent from search results; EXTERNAL_AI_RESTRICTED source rejected by the external-AI submission gate; rights changes emit audit events. All 69 existing tests remain green.
- Completion report at `docs/reports/phase-02-completion.md` (PASS/PARTIAL/BLOCKED format) and `docs/status/current-phase.json` updated. Response ends with the PHASE:/STATUS:/CHECKPOINT: structure.

## Out of scope

- Uploading or parsing real files; folder/ZIP ingestion (moves to a later phase).
- OCR, extraction, segmentation, search implementation, or AI features — this phase only builds the *gates* those phases must pass through.
- Real restricted legal documents; external AI calls (only a gate that refuses them is built).
- Portal-facing UI beyond what is needed to exercise auth/rights (staff-facing routes and minimal admin surface only).

## Steps

1. **ADR 0003 + docs** — Record the Phase 02 redefinition (Auth/Roles/Rights/Quarantine; Ingestion shifts later), rewrite `docs/RIGHTS_MODEL.md` around the 13 statuses with a per-status capability matrix (storage, display, search, analysis, external AI, export, print, student access), and update `docs/PHASES.md`.
2. **Schema & migration** — Extend `research_users` with the 8-role vocabulary and authentication linkage; extend `research_rights_records` with the 17 required fields (append-only); migrate the 4 legacy rights statuses to the new vocabulary via psql-applied additive SQL with a recorded reversible mapping; keep the UNREVIEWED insert-time lock. Test both applying the migration and booting the app against the migrated database.
3. **Access-decision layer** — A pure, exhaustively-tested `decideAccess({role, rightsStatus, processingState, action})` function returning allow/deny with a structured reason; deny-by-default; rights status always caps role permissions; golden-pinned decision matrix.
4. **Authentication & role wiring** — Authenticate research users (building on the existing staff gate) and resolve their research role per request; unauthenticated requests see nothing protected; wire `decideAccess` into every research route and into job processing (processors re-check rights before touching content, per the existing enforcement rules).
5. **Quarantine & gate enforcement** — Enforce quarantine visibility rules; a search-listing gate that excludes quarantined/restricted containers; an external-processing/AI submission gate that structurally refuses EXTERNAL_AI_RESTRICTED / DO_NOT_PROCESS sources; no public-URL sharing; export requires recorded approval.
6. **Rights-review workflow** — Endpoints for rights reviewers/administrators to record a full rights decision (all 17 fields), which appends a rights record, updates the container mirror, and writes the audit event and transformation atomically; expiry dates and DO_NOT_RETAIN feed the container state machine (existing DELETION_PENDING path).
7. **Tests & close-out** — The 6 mandated proof tests plus exhaustive decision-matrix tests (synthetic fixtures only, isolated test schema); browser e2e extending the existing Playwright smoke for the unauthenticated-denial case; format/lint/typecheck/unit/integration/e2e all green; completion report + `current-phase.json`; architect security review.

Critical constraints: never weaken an existing control; no mocks in production code; no hard-coded success; deny-by-default everywhere; psql migrations only (never drizzle push); zod/v4 + req.log/logger conventions.

## Relevant files

- `lib/db/src/schema/research.ts`
- `lib/db/sql/research-schema.sql`
- `lib/db/sql/migrations/0002-phase01-core-architecture.sql`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/testing/testDb.ts`
- `artifacts/api-server/src/research/testing/fixtureFactory.ts`
- `artifacts/api-server/e2e/research-smoke.spec.ts`
- `docs/RIGHTS_MODEL.md`
- `docs/PHASES.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-01-completion.md`


---

## 28. Phase 03: Secure Upload, Container Inventory & Failure Isolation

Source: .local/tasks/phase-03-ingestion.md

# Phase 03: Secure Upload, Container Inventory & Failure Isolation

## What & Why
Implement Phase 03 (Ingestion) of the Judgment Research Platform: secure upload of individual files, multiple files, folder uploads (as multi-file batches), and ZIP archives. Every accepted upload becomes a `source_container` — never automatically a case (source-container principle). Includes hostile-input validation, full provenance, a non-destructive inventory/triage pass with diagnostic classifications, and batch processing where one failed file never terminates the batch. All work stays behind the Phase 02 auth/roles/rights gates, follows `docs/BUILD_PROMPT.md`, and ends with `docs/reports/phase-03-completion.md` plus an updated `docs/status/current-phase.json`.

## Done looks like
- Authorized staff (roles permitted to upload) can submit single files, multiple files, or ZIP archives; each accepted file becomes an `UNREVIEWED` source container with the original bytes stored unchanged in private object storage.
- Supported formats: PDF, DOCX, RTF, HTML, TXT, PNG, JPG, TIFF, and ZIP containing supported files.
- Uploads are validated: MIME type, extension, file signature (magic bytes), size limits, archive structure, expansion ratio, nested-archive depth, unsafe/duplicate paths, executable masquerading, corrupted content. Malicious archives (ZIP bombs, path traversal, disguised executables) are rejected with recorded reasons.
- Every container records full provenance: internal ID, original filename, byte size, MIME type, SHA-256, uploader, upload time, declared source, rights status (UNREVIEWED), storage locator, processing status.
- Duplicate uploads (same SHA-256) are detected and flagged, not silently re-ingested.
- An inventory job produces per-container diagnostics: file type, page count where available, text vs scan, probable OCR requirement, probable case-title-region count, repeated header/footer patterns, possible commercial-source markers, blank/unreadable/damaged pages, probable multi-case status — plus one diagnostic label from EMPTY_OR_INVALID / SINGLE_CASE_POSSIBLE / MULTI_CASE_POSSIBLE / MIXED_CONTENT_POSSIBLE / OCR_REQUIRED / MANUAL_INSPECTION_REQUIRED. Labels are diagnostic, never final findings; no case records are created.
- Batch ingestion isolates failures: a failed file is dead-lettered with a per-file error report while the rest of the batch completes; jobs support progress, retry, cancellation, restart, and dead-letter status (extending the existing resumable job runner).
- Synthetic fixtures exist for: one-case, five-case, thirty-case containers, blank pages, corrupt pages, repeated pages, nested ZIPs, unsafe ZIP paths, misleading filenames. No real restricted documents are used.
- All existing 89 tests remain green; new validation/ingestion/inventory tests pass; full typecheck passes; completion report written with PASS/PARTIAL/BLOCKED status and the PHASE:/STATUS:/CHECKPOINT: response format.

## Out of scope
- Text extraction/OCR execution and character-level span provenance (Phase 04) — inventory only estimates OCR need.
- Case-candidate segmentation and case creation (Phase 05).
- Duplicate/version consolidation (Phase 06).
- Search, research UI beyond a minimal upload/queue surface, and any AI processing (Phases 07–08). External AI remains disabled.
- Sending any document to an external service.

## Steps
1. **Decision record & schema** — Write ADR 0004 for the ingestion design; extend the DB schema (upload batches, batch items with per-file status/error, container inventory results, dead-letter fields as needed) via an additive migration; test applying the migration and booting against the migrated database.
2. **Validation core** — Build a pure, well-tested validation module: magic-byte/extension/MIME agreement, size caps, ZIP safety (expansion ratio, nesting depth, path traversal, duplicate paths, executable detection), and corruption checks; every rejection carries a machine-readable reason.
3. **Upload & registration endpoints** — Role-gated upload routes for single/multi-file and ZIP submission that stage original bytes byte-for-byte to private object storage, compute SHA-256, detect duplicates, and register UNREVIEWED containers with full provenance; deny-by-default access rules from Phase 02 apply (per-container checks, 404-not-403, restriction-aware filters).
4. **Batch jobs with failure isolation** — Ingestion and inventory run through the existing resumable job runner, extended with batch progress, per-item retry, cancellation, restart, and dead-letter status; a content-touching job without rights clearance still fails closed.
5. **Inventory analyzer** — Non-destructive per-container inventory (format probing, page counts, text-vs-scan heuristics, header/footer repetition, commercial-source markers, blank/damaged page detection) producing the six diagnostic labels; results stored with provenance, never mutating the original file.
6. **Fixtures & tests** — Generate the required synthetic fixture set (including hostile ZIPs built programmatically in tests, not committed as binaries where avoidable); add unit + integration tests covering every acceptance criterion; run the full api-tests suite and typecheck.
7. **Minimal review-queue surface & close-out** — Expose container/batch listing for the rights-review queue via existing role-gated routes; browser-test any UI touched; write `docs/reports/phase-03-completion.md`, update `docs/status/current-phase.json`, and finish with architect review and the required response format.

Note: preserve all Phase 02 invariants — deny-by-default access, absolute rights-status caps, append-only audit, fail-closed processors, and no mock implementations in production code.

## Relevant files
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `artifacts/api-server/src/research/storage/objectStorageAdapter.ts`
- `artifacts/api-server/src/research/testing/fixtureFactory.ts`
- `lib/db/src/schema/research.ts:118-141`
- `docs/PHASES.md`
- `docs/BUILD_PROMPT.md`
- `docs/status/current-phase.json`
- `fixtures/synthetic`


---

## 29. Phase 04: Page-Level Extraction & OCR Adapters

Source: .local/tasks/phase-04-extraction.md

# Phase 04: Page-Level Extraction & OCR Adapters

## What & Why
Implement Phase 04 (Extraction) of the Judgment Research Platform: page-level text extraction from ingested source containers, with the source page as the smallest immutable provenance unit. Extraction runs behind four separately replaceable adapters (native text extraction, page-image rendering, OCR, layout analysis) so the platform is never coupled to one OCR engine. Follow docs/BUILD_PROMPT.md: read charter/architecture/phase docs first; phase-scope-only; synthetic fixtures only; no external AI services.

## Done looks like
- Every ingested document can be extracted into immutable page records with full provenance (container → page → block → character offsets, coordinates where the format supports them)
- Native-text pages capture page number, text blocks, reading order, bounding boxes/font/style metadata where available, header/footer/column detection, and character offsets
- Scanned pages capture the original page image, OCR text, confidence data, text-region coordinates, rotation, language indication, and processing warnings
- Uncertainty is stored as structured warning codes (ILLEGIBLE_REGION, LOW_OCR_CONFIDENCE, POSSIBLE_MISSING_TEXT, READING_ORDER_UNCERTAIN, PAGE_ROTATION_UNCERTAIN, LANGUAGE_UNCERTAIN) with source coordinates — never guessed replacement text; display may render a visible marker but the record preserves the warning
- A page-review interface shows original page, extracted text, detected blocks, OCR warnings, reviewer corrections, and correction history; corrections never overwrite raw extraction and store raw output, corrected output, reviewer, reason, date, and processor version
- Low-quality pages automatically enter the review queue
- A benchmark of safe (local, no-external-AI) OCR options against synthetic fixtures is run and recorded before the initial OCR adapter is selected, with the choice documented in a decision record
- All tests green (existing 125 preserved), typecheck clean, completion report in docs/reports/ and docs/status/current-phase.json updated

## Out of scope
- Case-candidate segmentation (Phase 05), consolidation (Phase 06), search UI (Phase 07), AI aids (Phase 08)
- Sending any document content to external AI/OCR services
- Processing real restricted legal documents (synthetic fixtures only)

## Steps
1. **ADR + schema** — Decision record for the extraction architecture; new `research_*` tables for pages, page images, text blocks, extraction runs (processor version, adapter identity, checksums), warnings, and page corrections (append-only version history); migration tested for apply + boot.
2. **Adapter contracts** — Extend the adapter registry with four independent interfaces: native text extractor, page-image renderer, OCR engine, layout analyzer; each versioned, disable-safe (unconfigured adapter routes work to human review, never fakes output).
3. **OCR benchmark** — Evaluate available safe local OCR options (e.g. Tesseract-based engines runnable in this environment) against synthetic scanned fixtures; record accuracy/confidence/rotation handling results in a benchmark report and select the initial adapter via the ADR.
4. **Extraction pipeline** — Resumable, idempotent extraction jobs per container: detect native-text vs scanned pages, run the appropriate adapter chain, persist immutable page records with provenance and structured warnings, route low-quality pages to review, respect rights gating (fail closed).
5. **Page-review interface** — Staff-only review screens showing original page image, extracted text, detected blocks, warnings, and correction history; corrections stored as new versions alongside untouched raw output, with atomic audit events.
6. **Fixtures + tests** — New synthetic fixtures: clean native text, two-column text, rotated scans, faint scans, page numbers, repeated headers, footnotes, tables, mixed languages, blank pages; tests covering traceability, raw-output preservation, correction versioning, review routing, and no-silent-guessing; browser-based testing of the review UI.
7. **Close-out** — Formatting/typecheck/full test run; completion report in docs/reports/; update docs/status/current-phase.json to Phase 05 next.

Note: critical architectural constraints — the source page is immutable once extracted; corrections are append-only versions; uncertainty is preserved as structured warnings with coordinates, never replaced with guessed text; all four adapters must remain independently swappable.

## Relevant files
- `docs/BUILD_PROMPT.md`
- `docs/PHASES.md`
- `docs/ARCHITECTURE.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-03-completion.md`
- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/ingestion/service.ts`
- `artifacts/api-server/src/research/storage/objectStorageAdapter.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `lib/db/src/schema/research.ts`
- `fixtures/synthetic/README.md`


---

## 30. Phase 07 — Publisher-Content Isolation & Verified Judicial Text

Source: .local/tasks/phase-07-publisher-isolation.md

# Phase 07 — Publisher-Content Isolation & Verified Judicial Text

## What & Why

Separate judicially-issued text from suspected publisher-created editorial
material. This is a core platform invariant stated in `replit.md` and
`docs/ARCHITECTURE.md` but not yet enforced at the data level. Phase 06
deferred automatic scrubbing; Phase 07 delivers it.

The state machine already defines `EDITORIAL_REVIEW_PENDING →
EDITORIAL_REVIEW_REQUIRED → JUDGMENT_VERIFICATION_PENDING → VERIFIED`, and
`validation/pipeline.ts` already transitions containers into
`EDITORIAL_REVIEW_PENDING` after coherence validation. Phase 07 implements
the content of those states.

## Done looks like

- Every page section of a container is classified with one of:
  `VERIFIED_JUDICIAL_TEXT`, `PROBABLE_JUDICIAL_TEXT`,
  `SUSPECTED_PUBLISHER_EDITORIAL`, `ADMINISTRATIVE_METADATA`,
  `SOURCE_ARTIFACT`, `UNKNOWN`, `MANUAL_REVIEW_REQUIRED`.
- The classifier uses all required detection signals (page location, layout,
  font changes, heading patterns, repeated headers/footers, branding markers,
  editorial vocabulary, court-document conventions, paragraph continuity,
  authorship context, prior reviewer decisions).
- The required safeguards are enforced: a section cannot be excluded solely
  because it appears before "Judgment", contains a summary, contains
  catchword-like wording, appears as a footnote, or uses bold headings.
  Court-issued summaries, judicial footnotes, judicial headings, and judicial
  annexures may remain VERIFIED_JUDICIAL_TEXT.
- `SUSPECTED_PUBLISHER_EDITORIAL` sections are held separately from verified
  judicial text, the full-text index, embeddings, AI prompts, AI summaries,
  classification models, and quotation tools — enforced by a single
  `isolationGate` function that all downstream consumers must call.
- The completeness checker catches: missing first/last page, incomplete
  opening/ending sentence, skipped paragraph numbers, duplicate paragraphs,
  missing orders/schedules/annexures, unreadable pages, multiple judgments
  accidentally combined.
- A verified judgment record is created only when: all approved judicial
  source spans are present, source refs, original page refs, and paragraph
  identifiers are recorded, a text checksum is computed, unresolved
  non-critical warnings are listed, and there are zero critical integrity
  warnings.
- Reviewer endpoints allow classification overrides and editorial approval
  before proceeding to verification.
- Excluded sections remain auditable via `research_transformations`.
- All included paragraphs retain source provenance.
- Incomplete cases (critical integrity warnings present) cannot reach VERIFIED.
- Judicial text is never silently rewritten.
- 196 existing tests continue to pass; new isolation tests are added.

## Out of scope

- Search adapter implementation (to become Phase 08).
- Research workspace portal UI (later phase).
- Embedding generation.
- AI research aids (later phase).
- Sentence-level character diffing inside a section.

## Steps

1. **ADR + phase redefinition** — Write `docs/decisions/0008-phase-07-publisher-content-isolation.md` recording the redefinition of Phase 07 from "Search & Research UI" to "Publisher-Content Isolation and Verified Judicial Text". Update `docs/PHASES.md` and `docs/status/current-phase.json`.

2. **DB schema: page sections table** — Add `research_page_sections` to `lib/db/src/schema/research.ts`: container_id (FK), page_id (FK, nullable — some sections span a full page), span_start_char / span_end_char (nullable — character offsets within the page's extracted text), classification (text enum, not null), confidence (real, 0–1), detector_version (text), reviewer_id (FK → research_users, nullable), reviewer_decision (text, nullable), reviewer_decided_at (timestamptz, nullable), isolation_applied (boolean, default false), notes (text, nullable), created_at. Index on (container_id, page_id).

3. **DB schema: editorial runs table** — Add `research_editorial_runs`: container_id (FK, not null), processor_version (text), section_count (int), uncertain_count (int), critical_warning_count (int), non_critical_warning_count (int), created_at.

4. **DB schema: verified judgments table** — Add `research_verified_judgments` to hold the full verified judgment record: candidate_id (FK → research_case_candidates, unique), approved_judicial_spans (jsonb — array of {containerId, pageId, spanStart, spanEnd}), source_refs (jsonb — array of {containerId, originalName}), original_page_refs (jsonb — array of page numbers), paragraph_identifiers (jsonb — array of paragraph labels), verified_by (text, not null), verified_at (timestamptz, not null), text_checksum (text, SHA-256 of all judicial text in order), critical_integrity_warnings (jsonb — must be empty array for VERIFIED), unresolved_non_critical_warnings (jsonb), created_at. A row here only exists when container is VERIFIED.

5. **Migration** — Generate and apply the Drizzle migration for all three new tables. Run `pnpm --filter @workspace/db run push` in dev.

6. **Section classifier (pure function)** — Create `artifacts/api-server/src/research/isolation/sectionClassifier.ts`. Input: page text, page metadata (page number, total pages, blocks/layout info from `research_page_blocks`). Output: `SectionClassification[]` with classification, confidence, supporting evidence text, and detector version. Implement the required detection signals: (a) page location heuristics — first/last pages are higher-risk for editorial framing but this alone is not exclusion grounds; (b) repeated header/footer patterns across pages; (c) branding markers (publisher name/logo patterns, ISBN, series titles, "All rights reserved", prices); (d) editorial vocabulary ("Headnotes", "Editorial Note", "Publisher's Summary", "Catchwords:", "Key Terms"); (e) court-document conventions (cause number, coram block, appearances block, date-of-judgment line, "JUDGMENT OF THE COURT" patterns); (f) paragraph continuity (numbered paragraph sequences signal judicial text); (g) font-change indicators from block metadata. Implement all safeguards: summary-like content, catchword-like wording, footnote position, bold headings, and pre-"Judgment" position cannot alone produce SUSPECTED_PUBLISHER_EDITORIAL — each requires corroborating signal evidence.

7. **Completeness checker (pure function)** — Create `artifacts/api-server/src/research/isolation/completenessChecker.ts`. Input: ordered judicial sections for a candidate with their page refs. Output: `{criticalWarnings: Warning[], nonCriticalWarnings: Warning[]}` where each warning has a code and description. Critical checks: missing first page, missing final page, incomplete opening sentence (no recognisable case-opening pattern), incomplete ending (no judgment dispositif or ending pattern), multiple judgments accidentally combined (conflicting case numbers/coram). Non-critical checks: skipped paragraph numbers, duplicate paragraph numbers, possible missing orders, possible missing schedules/annexures referenced in body, unreadable pages in span.

8. **Isolation gate** — Create `artifacts/api-server/src/research/isolation/isolationGate.ts`. Export a single `applyIsolationGate(sections: SectionClassification[]): SectionClassification[]` that keeps only VERIFIED_JUDICIAL_TEXT and PROBABLE_JUDICIAL_TEXT, strips everything else, and records a log-level note for each excluded section. This function must be called by any code path returning full-text content, and later by search indexing and AI prompt construction.

9. **Editorial processor (job)** — Create `artifacts/api-server/src/research/isolation/editorialProcessor.ts`, job kind `container.editorial_classify`. The processor: fetches all page extractions and block metadata for the container's active candidate pages; calls `sectionClassifier` for each page; persists `research_page_sections` rows (idempotent: ON CONFLICT DO NOTHING); creates a `research_editorial_runs` row; records a `research_transformations` row for every section classified as SUSPECTED_PUBLISHER_EDITORIAL or ADMINISTRATIVE_METADATA; if any section is MANUAL_REVIEW_REQUIRED or confidence < threshold, transitions container to EDITORIAL_REVIEW_REQUIRED and opens a `research_review_items` row; otherwise transitions to JUDGMENT_VERIFICATION_PENDING.

10. **Auto-enqueue editorial job** — In `validation/pipeline.ts`, after the transition to `EDITORIAL_REVIEW_PENDING`, enqueue a `container.editorial_classify` job (idempotent key: `editorial:${containerId}:${runId}`) in the same transaction.

11. **Editorial review routes** — Create `artifacts/api-server/src/research/routes/editorial.ts` and register it in `routes/index.ts`. Endpoints (all staff-gated):
    - `GET /api/research/containers/:id/sections` — list all research_page_sections for the container, grouped by page.
    - `PATCH /api/research/containers/:id/sections/:sectionId` — reviewer overrides classification; updates reviewer_id / reviewer_decision / reviewer_decided_at / isolation_applied; records a research_transformations row.
    - `POST /api/research/containers/:id/editorial-review/complete` — reviewer marks all editorial issues resolved; validates no remaining MANUAL_REVIEW_REQUIRED sections; transitions container EDITORIAL_REVIEW_REQUIRED → EDITORIAL_REVIEW_PENDING → JUDGMENT_VERIFICATION_PENDING.
    - `GET /api/research/containers/:id/judicial-text` — returns only isolation-gated (VERIFIED + PROBABLE) sections in page order, with provenance per section.
    - `POST /api/research/containers/:id/verify` — staff reviewer submits verification; runs completeness checker against gated sections; if critical warnings exist returns 422 with warning list (container stays in JUDGMENT_VERIFICATION_PENDING); if none, builds the `research_verified_judgments` record, computes text checksum, transitions container to VERIFIED, writes audit event.

12. **Synthetic fixtures** — Create fixtures in `fixtures/synthetic/isolation/`: multi-section judgment with clearly separated publisher headnotes; judgment with a court-issued summary (must NOT be excluded); judgment with judicial footnotes (must NOT be excluded); judgment with both publisher footer branding and judicial text on the same page; judgment with a missing final page (must trigger critical warning); judgment with skipped paragraph numbers (non-critical warning). All `.txt` fixtures paired with `.expected.json` acceptance gates.

13. **Tests** — Create `artifacts/api-server/src/research/phase07.test.ts`. Test: sectionClassifier correctly classifies each fixture scenario; safeguards are enforced (no false exclusion of judicial summaries, footnotes, catchword-adjacent text, bold headings alone); completenessChecker returns correct critical/non-critical warnings per scenario; isolationGate strips only the right sections; editorial processor job creates correct section rows and transitions container state; all five review endpoints (list, override, complete, judicial-text, verify); verify endpoint rejects with 422 when critical warnings remain; verified judgment record is complete and checksummed. All existing 196 tests must still pass.

14. **Completion report + phase status update** — Write `docs/reports/phase-07-completion.md` per `docs/BUILD_PROMPT.md`. Update `docs/status/current-phase.json` to mark Phase 07 complete and Phase 08 (now "Search & Research UI") as next.

## Relevant files

- `artifacts/api-server/src/research/validation/pipeline.ts`
- `artifacts/api-server/src/research/segmentation/signalDetector.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/candidateReview.ts`
- `lib/db/src/schema/research.ts`
- `docs/PHASES.md`
- `docs/status/current-phase.json`
- `docs/PROCESSING_STATES.md`
- `docs/ARCHITECTURE.md`
- `docs/BUILD_PROMPT.md`
- `docs/decisions/0007-phase-06-validation-review-cross-file.md`
- `docs/reports/phase-06-completion.md`
- `fixtures/synthetic/`


---

## 31. Phase 08: Search & Research UI

Source: .local/tasks/phase-08-search-research-ui.md

# Phase 08: Search & Research UI

## What & Why

Deliver usable legal-research access to the verified, isolation-gated judgments
produced by Phase 07. This phase has four interlocking layers:

1. **Case metadata extraction** — structured, provenance-traced metadata for
   every verified judgment (13 defined fields).
2. **Duplicate and version detection** — identify related judgments without
   automatically merging materially different versions.
3. **Full-text search** — PostgreSQL-native FTS over authorised, verified
   judicial text only; publisher editorial text never appears in results.
4. **Judgment viewer** — paragraph-navigable verified text with source-page
   comparison, private annotations, and bookmarks.

The research portals (MyLitAI, MySyalitAI, etc.) will consume these APIs.
The initial viewer phase shows verified judicial text and user notes only;
AI-generated research aids remain deferred to Phase 09.

---

## Done looks like

- Every `research_verified_judgments` row has a corresponding
  `research_case_metadata` row holding up to 13 fields; each field stores:
  extracted value, char-level source reference, confidence category
  (HIGH / MEDIUM / LOW / ABSENT), extraction method (REGEX / STRUCTURAL /
  AI_DISABLED), and reviewer status (UNREVIEWED / CONFIRMED / CORRECTED).
  Fields that cannot be extracted remain absent — no fabricated values.
- `research_duplicate_links` rows exist between verified judgments that share
  citations, party names + court + date, checksums, or paragraph fingerprints.
  Linked judgments remain distinguishable; no automatic merge occurs.
- `GET /api/research/search` accepts keyword, exact phrase, Boolean operators,
  proximity, field filters (court, judge, jurisdiction, statute, date range),
  wildcards, and paragraph-text queries; results include excerpts with paragraph
  IDs and source-page refs; only authorised VERIFIED containers appear.
- Publisher editorial text (`isolation_applied = true` sections) is structurally
  absent from every search result and every search excerpt.
- Judgment viewer endpoints return paragraphs in reading order, source-page
  comparison data, and user-private annotation / bookmark state.
- Browser tests pass all 8 acceptance scenarios (see Steps 13).
- All 249 existing tests remain green; new test count ≥ 310.

---

## Out of scope

- AI-generated research aids (Phase 09).
- Public-facing portal UI — portals call these APIs; the viewer in this phase
  is internal staff tooling.
- Export mechanics (reserved for a later phase).
- Full editorial review UI for `MANUAL_REVIEW_REQUIRED` sections (deferred).
- External search engines (Elasticsearch, OpenSearch) — PostgreSQL FTS only.

---

## Steps

1. **ADR 0009** — Write `docs/decisions/0009-phase-08-search-research-ui.md`
   recording: PostgreSQL FTS as the search engine (no external service),
   metadata field schema and storage model, duplicate-link model, annotation
   and bookmark data model, judgment viewer API design, and indexing strategy.

2. **DB schema and migrations** — Add the following tables (one idempotent
   migration `0014-phase08-search-ui.sql`):
   - `research_case_metadata` — one row per verified judgment; all 13 possible
     fields stored as a JSONB column (`fields`) where each field entry is
     `{ value, sourceRef, confidence, method, reviewerStatus, reviewedBy?,
     reviewedAt? }`. Indexed on `verified_judgment_id`.
   - `research_duplicate_links` — bidirectional pair `(judgment_a_id,
     judgment_b_id)`, signals JSONB (checksumMatch, citationMatch,
     partyCourtDateMatch, judgeMatch, paragraphFingerprintScore), status
     enum (`DETECTED` / `SAME_CASE` / `DIFFERENT_VERSION` / `DISTINCT`),
     reviewer columns.
   - `research_annotations` — per user per verified judgment per paragraph
     (optional anchor); private; text content, highlighted quote, highlight
     start/end chars within paragraph, created_at, updated_at.
   - `research_bookmarks` — per user per verified judgment; created_at.
   - `research_search_index` — one row per paragraph (or metadata-only row
     per judgment); columns: `verified_judgment_id`, `container_id`,
     `paragraph_id` (nullable), `section_id`, `content_tsv` (tsvector),
     `content_text`, `metadata_fields` JSONB (court, judge, jurisdiction,
     citation, parties, date), indexed with GIN on `content_tsv` and BTREE
     on the metadata columns.

3. **Metadata extractor** — Pure function
   `extractCaseMetadata(verifiedJudgment, sections, pageTexts)` in a new
   `research/metadata/` submodule. Extracts all 13 fields using regex and
   structural signals (positional heuristics, coram block, citation patterns,
   date formats). Each field result carries source character range,
   confidence category, and extraction method. Missing fields produce an
   ABSENT entry — never a guess. The 13 fields: case name, neutral citation,
   report citation, court, registry, proceeding number, judges, hearing date,
   decision date, parties, jurisdiction, procedural posture, language.

4. **Metadata processor job** — Background job type
   `container.metadata_extract`; fetches the verified judgment, sections, and
   page texts; calls the extractor; upserts the `research_case_metadata` row.
   Registered at startup. Enqueued automatically after the container reaches
   `VERIFIED` (add to pipeline integration after the verify route succeeds).
   Idempotent: re-running replaces the fields JSONB but records a
   transformation audit row showing the before/after.

5. **Duplicate and version detector** — Pure function
   `detectDuplicates(candidate, corpus)` in `research/metadata/`. Compares:
   SHA-256 checksum (exact match → SAME_CASE signal), neutral and report
   citations (parsed and normalised), party names + court + decision date
   (normalised string similarity), judge names, paragraph-count fingerprint,
   leading-paragraph text similarity (Jaccard or dice on shingles). Returns
   an array of `{ otherJudgmentId, signals, aggregateScore }` objects.
   A score above the SAME_CASE threshold creates a `DETECTED` link;
   materially different versions are never automatically merged.

6. **Duplicate processor job** — Background job type
   `container.duplicate_detect`; runs after `container.metadata_extract`
   completes; calls the detector against all existing VERIFIED judgments;
   upserts `research_duplicate_links` rows. Registered at startup. Idempotent.

7. **PostgreSQL FTS search adapter** — Replace `postgres-search-stub` with
   `postgres-fts` implementing the existing `SearchAdapter` interface.
   Extend the interface minimally to support structured queries (the current
   interface takes a plain `string`; add a typed `StructuredQuery` overload
   that the routes use directly, keeping the plain-string path for
   backward-compatibility). The adapter must:
   - Accept the full query grammar: keyword, exact phrase (quoted), Boolean
     (AND/OR/NOT), proximity (NEAR/n), field filters (court:, judge:,
     jurisdiction:, statute:, section:, date:), wildcards (prefix*),
     paragraph text.
   - Translate to `websearch_to_tsquery` / `phraseto_tsquery` / custom
     `tsquery` as appropriate; apply field-column filters as SQL WHERE
     predicates.
   - Enforce the isolation gate: only rows in `research_search_index` that
     passed `isolation_applied = false` on the originating section are
     indexed; publisher editorial rows are structurally absent.
   - Enforce rights and access: join against `research_rights_records` and
     container processing state (`VERIFIED` only).
   - Return: `{ verifiedJudgmentId, paragraphId?, sectionId, excerpt,
     matchedTermPositions, score, metadata }` per hit.

8. **Search API routes** — New router `research/routes/search.ts` mounted
   on the main research router:
   - `GET /search` — query params: `q` (raw query string parsed by the
     adapter), `court`, `judge`, `jurisdiction`, `statute`, `section`,
     `dateFrom`, `dateTo`, `page`, `perPage`. Response: paginated hit list
     with excerpts. Requires `research` role.
   - `POST /search/index/:containerId` — admin: rebuild the search index for
     one verified container. Requires `administrator` or `owner` role. Enqueues
     a `container.search_index` job.
   - `GET /search/metadata` — autocomplete sources for field filters
     (distinct courts, judges, jurisdictions from indexed metadata).

9. **Judgment viewer routes** — New router `research/routes/viewer.ts`:
   - `GET /judgments/:id` — summary: metadata, duplicate links, stats.
   - `GET /judgments/:id/paragraphs` — ordered paragraph list with paragraph
     IDs, section IDs, source-page refs, and text. Supports `?highlight=term`
     to return match positions within each paragraph.
   - `GET /judgments/:id/pages/:pageNum` — page view: judicial sections for
     the given source-page number, with section classifications.
   - `GET /judgments/:id/source-page/:pageId` — source-page comparison:
     full page text alongside isolation-gated judicial sections, for
     side-by-side review.
   - `GET /judgments/:id/annotations` — caller's private annotations
     (filtered by `research_user_id`).
   - `POST /judgments/:id/annotations` — create annotation; body: paragraph
     id, optional highlight quote + char range, text content.
   - `PATCH /judgments/:id/annotations/:annotationId` — edit text or highlight.
   - `DELETE /judgments/:id/annotations/:annotationId` — delete own annotation.
   - `GET /judgments/:id/bookmarks` — caller's bookmark state for this
     judgment.
   - `PUT /judgments/:id/bookmarks` — toggle bookmark (idempotent upsert /
     delete).
   All routes: require `research` role; access decision checked per container.

10. **Metadata review routes** — Extend or add to `research/routes/viewer.ts`:
    - `GET /judgments/:id/metadata` — all 13 fields with confidence, source
      ref, method, reviewer status.
    - `PATCH /judgments/:id/metadata/:field` — reviewer override: update the
      field's value and set `reviewerStatus: CORRECTED`; write a
      `research_transformations` row. Requires `legal_reviewer` / `administrator`
      / `owner`.
    - `GET /judgments/:id/duplicates` — linked judgments with similarity
      signals and current reviewer status.
    - `PATCH /duplicates/:linkId` — reviewer decision on a duplicate link
      (SAME_CASE / DIFFERENT_VERSION / DISTINCT); write a transformations row.

11. **Search index pipeline** — After `container.metadata_extract` succeeds,
    enqueue `container.search_index`. The `search_index` processor: fetches the
    verified judgment's approved judicial sections and metadata; rebuilds the
    `research_search_index` rows for that judgment (delete-then-insert to keep
    it idempotent); calls `update_search_index_tsvector()` to regenerate the
    `content_tsv` column via a DB trigger or explicit `to_tsvector` call.
    Registered at startup.

12. **Synthetic fixtures** — Add to `fixtures/synthetic/metadata/`:
    - `full-metadata.txt` — judgment containing all 13 extractable fields.
    - `partial-metadata.txt` — judgment with 6 absent fields (stays absent).
    - `duplicate-pair-a.txt` / `duplicate-pair-b.txt` — two sources of the
      same judgment (same citation, different edition text).
    - `version-pair-a.txt` / `version-pair-b.txt` — different-year versions
      of the same case (citation differs in year).
    - `complex-citations.txt` — multiple citation formats in one judgment.

13. **Tests (integration)** — In `phase08.test.ts`:
    - Metadata extractor: all 13 fields; missing-field stays absent; source
      ref points to correct character range.
    - Duplicate detector: checksum match, citation match, party+court+date
      match, paragraph fingerprint match, no-match (score below threshold).
    - Search adapter: keyword query returns hits; exact phrase returns only
      phrase matches; Boolean AND/OR/NOT filters correctly; field filter on
      court/judge/date; wildcard prefix; isolation gate (editorial text absent
      from results); rights gate (restricted container hidden); empty result
      for unknown query.
    - Viewer routes: auth gate (non-research role → 403); paragraph list
      ordered correctly; source-page comparison returns judicial sections only;
      annotation CRUD (create, edit, delete, visibility restricted to owner);
      bookmark toggle (idempotent).
    - Metadata review routes: all 13 fields returned; reviewer override writes
      transformation; duplicate link reviewer decision persisted.
    - Pipeline: after verify, metadata_extract and search_index jobs enqueued
      and processable.
    - All 249 existing tests must remain green.

14. **Browser tests (Playwright)** — Using the existing testing skill, cover
    the 8 acceptance scenarios against the running API:
    1. Login (research user authenticates, receives research role).
    2. Authorised search (verified, rights-approved case returns results).
    3. Restricted search (container with UNREVIEWED rights returns no results).
    4. Open a case (judgment viewer returns paragraphs in order).
    5. Page comparison (source-page endpoint returns judicial sections
       alongside raw page text).
    6. Paragraph navigation (paragraphs have IDs; highlight query returns
       term positions).
    7. Annotation creation (POST creates annotation; GET returns it for the
       same user only).
    8. Unauthorised access attempt (no research role → 401/403).

15. **Phase reports and status update** — Write
    `docs/reports/phase-08-completion.md` (full required structure from
    `docs/BUILD_PROMPT.md`); update `docs/status/current-phase.json` to
    phase 08 complete, `nextPhase` Phase 09 (AI Research Aids). Set
    `/api/research/health` `phase` field to `"08"`.

---

## Relevant files

- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/editorial.ts`
- `artifacts/api-server/src/research/isolation/isolationGate.ts`
- `artifacts/api-server/src/research/isolation/editorialProcessor.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/validation/pipeline.ts`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/auth.ts`
- `artifacts/api-server/src/research/phase07.test.ts`
- `artifacts/api-server/src/research/testing/`
- `lib/db/src/schema/research.ts`
- `lib/db/sql/migrations/`
- `docs/decisions/0008-phase-07-publisher-content-isolation.md`
- `docs/reports/phase-07-completion.md`
- `docs/PHASES.md`
- `docs/BUILD_PROMPT.md`
- `fixtures/synthetic/isolation/`


---

## 32. Phase 09: Exact Quotations & Citation Tools

Source: .local/tasks/phase09-quotations-citations.md

# Phase 09: Exact Quotations & Citation Tools

## What & Why

Lawyers and researchers working with verified judgments need to lift exact passages and format them as citations — with full provenance, integrity guarantees, and legally defensible output. Phase 09 adds the data model, service logic, API routes, and citation formatter that together make this possible.

This phase is entirely backend (schema + API + tests). No UI is included.

## Done looks like

- A researcher can submit a text selection (offsets into a verified paragraph) and receive a persisted quotation record carrying all required provenance fields.
- The system rejects any creation request where the selected text does not exactly match the verified paragraph text at the stated offsets.
- A stored quotation that was created against source text that later changed is flagged on read (checksum mismatch).
- A researcher can record alterations to a stored quotation — omissions rendered as `[…]`, inserted words rendered as `[added text]`, both with the original selection preserved.
- An altered quotation cannot be presented as "exact"; its kind field is `"altered"`.
- Six citation style templates are supported: `neutral-citation-first`, `oscola`, `malaysian`, `bluebook`, `academic-footnote`, `bibliography`.
- The citation formatter never invents metadata: if a reporter citation is absent from verified metadata and has not been entered by an authorised reviewer, the reporter field renders as `"REPORTER CITATION NOT VERIFIED"`.
- Export and copy routes are gated by role; `guest` role is refused.
- All 11 required test cases pass.

## Out of scope

- Frontend UI for quotation selection or citation display.
- PDF or DOCX export formatting.
- Batch export of multiple quotations.
- Custom user-defined citation style storage (the Malaysian template is a built-in default, not a user-saved template in this phase).

## Steps

1. **Schema — `research_quotations`**: Add a new table holding all required provenance fields: exact selected text, case ID (judgment FK), case name (denormalised from metadata), citation, court, judge, date, paragraph identifier, source page FK, character offsets (start/end), source text checksum at creation time, creator (research_user FK), creation timestamp, and user note. Index on `judgment_id` and `creator_id`.

2. **Schema — `research_quotation_alterations`**: Add a child table recording each deliberate edit to a quotation. Columns: `quotation_id` (FK), `kind` (`omission` | `insertion` | `alteration`), `position_start`, `position_end`, `original_text`, `replacement_text`, `recorded_at`, `recorded_by`. A quotation with any alteration row has its `kind` set to `"altered"`.

3. **Integrity service**: Write a `verifyQuotationSelection` function that reconstructs the paragraph text from `research_page_extractions` filtered through `approved_judicial_spans`, slices it at the stated offsets, and compares it byte-for-byte against the submitted text. Reject with a structured error (not a silent fallback) if they differ. On success, compute and return the SHA-256 checksum of the full source paragraph.

4. **Quotation service**: Write `createQuotation`, `getQuotation`, `recordAlteration`, and `listQuotations` (by judgment or by creator). `createQuotation` calls `verifyQuotationSelection` first; any mismatch is a hard rejection. `getQuotation` re-checks the current paragraph checksum and adds a `sourceChanged: true` flag when it differs from the stored checksum.

5. **Citation formatter**: Write a `formatCitation(quotation, style, metadata)` function that accepts one of the six style names and a metadata map keyed by `MetadataFieldName`. Each style template interpolates from the map without inventing values. If a style template requires a reporter citation and the `neutral_citation` or `law_report` field is absent from verified metadata and has not been supplied by a `rights_reviewer` or higher role, the reporter segment renders as `"REPORTER CITATION NOT VERIFIED"`.

6. **API routes**: Add a `research/quotations` router under the existing research routes:
   - `POST /api/research/quotations` — create (requires `researcher` role or above; runs integrity check).
   - `GET /api/research/quotations/:id` — read with live checksum comparison.
   - `PATCH /api/research/quotations/:id/alterations` — append an alteration record.
   - `GET /api/research/quotations/:id/cite?style=…` — return formatted citation string.
   - `GET /api/research/quotations/:id/export` — export provenance bundle; refused for `guest` role.
   - `GET /api/research/judgments/:judgmentId/quotations` — list all quotations for a judgment (role-gated).

7. **Tests — `phase09.test.ts`**: Write tests covering all 11 required cases using the same `driveUntilComplete`-style helpers established in earlier phases:
   - Exact selection (text matches exactly, record created, checksum stored).
   - Multi-paragraph selection (offsets spanning a paragraph boundary).
   - Punctuation (selection containing em-dashes, quotation marks, colons).
   - Unicode (Malay/Arabic characters in passage text).
   - Footnotes (selection that includes a footnote marker).
   - Ellipsis alteration (omission recorded, kind becomes `"altered"`, original preserved).
   - Bracketed addition (insertion recorded, kind becomes `"altered"`).
   - Missing reporter citation (formatter renders `"REPORTER CITATION NOT VERIFIED"`).
   - Restricted export (`guest` role refused with 403, `researcher` role permitted).
   - Changed source text (quotation created, source paragraph text mutated directly in DB, `getQuotation` returns `sourceChanged: true`).
   - Altered quotation not presentable as exact (altered quotation `kind !== "exact"`; API rejects a request to cite an altered quotation with `style=exact`).

## Relevant files

- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/research/metadata/metadataProcessor.ts`
- `artifacts/api-server/src/research/phase08.test.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/gates.ts`


---

## 33. Phase 10: AI-Generated Headnotes & Case Analysis

Source: .local/tasks/phase10-ai-headnotes-analysis.md

# Phase 10: AI-Generated Headnotes & Case Analysis

## What & Why
Add a fully governed AI pipeline that generates structured headnotes, catchwords, and case analysis from verified judgments. AI is disabled by default; an administrator must enable an approved provider before any generation runs. Every output is schema-validated, evidence-anchored to the verified judicial text, and subject to a human review workflow before it can be published. Publisher-supplied editorial material is categorically excluded from the AI input boundary.

## Done looks like
- An administrator can enable/disable an AI provider and configure approved model settings via the admin API; AI is off by default
- A `POST /api/research/judgments/:id/analysis` endpoint triggers AI analysis when the rights record permits it (`analysisPermitted === true`) and a provider is enabled; guests and unauthenticated callers are blocked
- The AI pipeline receives only: verified judicial text (reconstructed via Phase 09 `reconstructJudicialText`), approved case metadata (approved rows from `researchCaseMetadata` for the allowed fields only), the approved generation schema, and administrator-approved model settings — nothing else
- The pipeline produces schema-validated structured output for all 17 fields: catchwords, procedural posture, material facts, legal issues, parties' material submissions, holding on each issue, reasoning, possible ratio decidendi, possible obiter dicta, orders, statutes considered, cases considered, significance, 50-word summary, 150-word summary, detailed case brief, teaching note
- Every substantive proposition in the output carries: proposition ID, supporting paragraph IDs (validated against the judgment's `paragraphIdentifiers`), exact supporting passages (validated byte-for-byte against the judicial text using Phase 09 integrity logic), confidence category, and review status — propositions without valid evidence are rejected before the run is stored
- Every AI-generated quotation is checked against the verified judgment text; quotations that do not match exactly are rejected
- Uncertainty labels are applied automatically where appropriate: `NOT_STATED_IN_VERIFIED_JUDGMENT`, `INSUFFICIENT_EVIDENCE`, `LEGAL_CLASSIFICATION_UNCERTAIN`, `RATIO_OBITER_REVIEW_REQUIRED`, `HUMAN_REVIEW_REQUIRED`
- Each analysis run has a status machine: DRAFT → REVIEWING → APPROVED / REJECTED, with full revision history, prompt version, model version, creation date, and evidence-validation result stored on every run
- `GET /api/research/judgments/:id/analysis` returns the latest approved run (or DRAFT for reviewers); every response includes the mandatory disclaimer: `"AI-GENERATED RESEARCH AID — NOT PART OF THE JUDGMENT — VERIFY AGAINST THE JUDICIAL TEXT."`
- A reviewer (legal_reviewer or above) can approve or reject individual propositions and the run as a whole via `PATCH /api/research/analysis/:runId/review`
- Eight synthetic-judgment test cases confirm the acceptance gates: unsupported propositions rejected, broken paragraph references rejected, publisher editorial material excluded from input, AI output never written into the judicial-text field, exact-quotation mismatches rejected, and all tests pass

## Out of scope
- Frontend UI (API-only, same as all prior phases)
- Bulk/batch generation across multiple judgments (single-judgment trigger only)
- Fine-tuning or custom model training
- Automatic approval without human review
- Integration with external publishers or citation databases
- Retrieval-augmented generation across multiple judgments

## Steps

1. **AI provider configuration** — Create `research_ai_providers` table storing provider name (gemini/openai), enabled flag, approved model settings (model name, temperature, max tokens), created/updated timestamps, and the admin email that approved it. Add admin routes `GET/POST/PATCH /api/research/admin/ai-providers` gated to `administrator` and `owner` roles. Provider is disabled by default; explicit admin enable is required.

2. **Analysis schema and DB tables** — Create `research_ai_analysis_runs` (one per judgment × schema-version × model-version; fields: judgment_id, provider_id, prompt_version, model_version, raw_output JSONB, status, reviewer_email, review_notes, created_at, approved_at) and `research_ai_propositions` (one row per proposition: run_id, proposition_id UUID, field_name, content text, supporting_paragraph_ids text[], validated_passages JSONB, confidence_category, uncertainty_label, review_status). Add zod schema for the full 17-field structured output used for parse-and-validate on the raw model response.

3. **Input boundary builder** — Implement `buildAnalysisInput(judgmentId)` that assembles the AI prompt from: (a) verified judicial text reconstructed via `reconstructJudicialText`, (b) approved `researchCaseMetadata` rows filtered to the 13 permitted field names only, (c) the approved generation schema, (d) provider model settings. The builder must enforce that it never includes suspected publisher headnotes (any metadata field whose extraction method is `publisher_supplied` or whose source is a non-judicial-text page section), publisher catchwords, editorial summaries, or restricted metadata. The builder logs every included/excluded field for audit.

4. **AI generation and structured-output validation** — Implement `runAiAnalysis(judgmentId, providerId)` that calls the approved provider with a strict JSON output schema, parses the response with zod, rejects the entire run if the top-level structure is invalid, then validates each proposition's supporting paragraph IDs against `judgment.paragraphIdentifiers` and each supporting passage against the reconstructed judicial text (byte-for-byte using Phase 09 `verifyQuotationSelection` logic). Propositions that fail evidence validation are marked `INSUFFICIENT_EVIDENCE` and their `review_status` is set to `rejected`; if more than half of propositions in a critical field (ratio, holding) fail, the whole run is set to status `DRAFT` with a critical warning. AI-generated quotations that fail exact-match are excluded from the run output.

5. **Job processor** — Register a `container.ai_analysis` job processor. It gates on `analysisPermitted === true` from the rights record and on a provider being enabled. It calls `runAiAnalysis`, stores the run and all propositions, stores the full raw model response in object storage (keyed by run ID), and transitions the run to status `DRAFT`. If the rights check fails or no provider is enabled, the job fails with a clear coded error (not a silent fallback).

6. **Analysis routes** — Add to the research router: `POST /api/research/judgments/:id/analysis` (requires researcher+ role + `analyse` container access — enqueues the analysis job), `GET /api/research/judgments/:id/analysis` (requires `view` access — returns latest approved run for most roles, latest DRAFT for reviewers; always includes the disclaimer string), `GET /api/research/analysis/:runId` (full run detail with all propositions), `PATCH /api/research/analysis/:runId/review` (legal_reviewer+ only — approve/reject the run or individual propositions, records reviewer email and timestamp).

7. **Tests — synthetic ambiguous judgments** — Write `phase10.test.ts` with eight test cases using synthetic judgments crafted to trigger model failure modes, all run against real Gemini or a stub provider that replays canned responses to avoid live API calls in CI:
   - *Invented fact*: judgment contains no statement about damages; model output claiming a damages figure is rejected as `INSUFFICIENT_EVIDENCE`
   - *Inferred unexpressed holding*: judgment deliberates but issues no explicit ruling; holding proposition gets `NOT_STATED_IN_VERIFIED_JUDGMENT`
   - *Submission vs decision confusion*: model confuses a party's submission with the court's holding; proposition review_status is flagged `HUMAN_REVIEW_REQUIRED`
   - *Ratio misclassification*: long obiter passage is misclassified as ratio; run stored with `RATIO_OBITER_REVIEW_REQUIRED` on that proposition
   - *Inaccurate quotation*: model returns a near-miss quotation with one word changed; quotation is rejected before storage
   - *Unsupported metadata*: model uses metadata that was not in the approved input; paragraph reference validation fails and proposition is rejected
   - *Publisher material exclusion*: input boundary builder is called with a judgment whose metadata includes a `publisher_supplied` field; the field is excluded and the audit log records the exclusion
   - *AI output isolation*: attempt to write an analysis result into the `selectedText` field of a quotation is structurally impossible (schema separation test)

## Relevant files
- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/research/quotations/integrity.ts`
- `artifacts/api-server/src/research/quotations/service.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/viewer.ts`
- `lib/db/sql/migrations/0015-phase09-quotations.sql`


---

## 34. Phase 11a: Authorities & Legislation Extraction

Source: .local/tasks/phase11a-authorities-legislation.md

# Phase 11a: Authorities & Legislation Extraction

## What & Why
The AI analysis (Phase 10) already identifies cases and statutes considered in a judgment, but stores them only as raw proposition text. Phase 11a structures that raw text into searchable, reviewable authority and legislation records — with treatment labels, supporting evidence, and a citation graph limited to the private collection.

This is the data layer that powers the Workspace's authorities tables (Phase 11b) and any future citator features.

## Done looks like
- Every approved AI analysis run can be processed to extract structured authority records (case name, citation, paragraph ref, treatment label, supporting passage, proposition link)
- Every approved AI analysis run can be processed to extract structured legislation refs (statute, provision, jurisdiction, paragraph ref, mode of use, supporting passage)
- Treatment labels come from the fixed vocabulary; any label without clear textual evidence is flagged as `UNCLEAR` and enters the review queue
- A `GET /judgments/:id/authorities` endpoint returns extracted authorities for a judgment (role-gated, same non-leak 404 policy)
- A `GET /judgments/:id/legislation` endpoint returns extracted legislation refs
- A `GET /judgments/:id/citation-graph` endpoint returns inbound/outbound authority links limited to documents in the collection, with the disclaimer text visible in the response
- All three extraction jobs are idempotent and re-runnable
- Tests: extraction from realistic proposition text, treatment-label evidence gate, unclear-treatment → review-queue path, citation-graph limitation disclaimer present, legislation mode assignment; all via stub data, no live AI

## Out of scope
- UI for browsing authorities (Phase 11b)
- Extracting authorities from documents not yet in the AI analysis pipeline
- Cross-collection citator or "good law" verdicts

## Steps
1. **DB schema — authorities** — Add `research_authorities` table: `id`, `judgment_id` (FK), `run_id` (FK), `case_name`, `citation`, `source_paragraph_id`, `proposition_id` (FK to `research_ai_propositions`), `treatment` (enum of 14 labels + `UNCLEAR`), `treatment_evidence` (text), `review_status` (`pending_review` | `approved` | `rejected`), `reviewer_email`, `reviewed_at`, `created_at`. Add migration.
2. **DB schema — legislation refs** — Add `research_legislation_refs` table: `id`, `judgment_id` (FK), `run_id` (FK), `statute`, `provision`, `jurisdiction`, `source_paragraph_id`, `mode` (enum: `applied` | `interpreted` | `mentioned` | `challenged` | `constitutionality_considered`), `supporting_passage` (text), `proposition_id` (FK), `created_at`. Add to migration.
3. **Extraction service — authorities** — `extractAuthorities(runId)`: reads `casesConsidered` propositions from the approved run, parses each into `case_name` + `citation` (regex-first, fallback heuristic), assigns treatment label by matching content against label keywords with passage evidence requirement; any match lacking clear textual evidence → `UNCLEAR` + enqueue review item. Idempotent via `ON CONFLICT DO NOTHING` on `(run_id, proposition_id)`.
4. **Extraction service — legislation** — `extractLegislation(runId)`: reads `statutesConsidered` propositions, parses statute name + provision + jurisdiction, assigns mode from content signals. Same idempotency pattern.
5. **Citation graph service** — `getCitationGraph(judgmentId)`: queries `research_authorities` for all `judgment_id = X` rows (outbound) and all rows where `citation` matches any known citation string in the collection (inbound). Returns `{ outbound, inbound, disclaimer }` where `disclaimer` is the fixed collection-limitation string. The graph never claims a case is good law.
6. **Routes** — Add `GET /judgments/:id/authorities` (returns list + review-queue counts), `PATCH /authorities/:id/review` (approve/reject treatment label, owner/administrator/legal_reviewer only), `GET /judgments/:id/legislation`, `GET /judgments/:id/citation-graph`. All use the existing non-leak 404 container gate.
7. **Tests** — Verify: realistic `casesConsidered` proposition → correct case_name, citation, treatment label with evidence; proposition with ambiguous treatment → `UNCLEAR` + review item created; legislation proposition → correct statute/provision/mode; citation graph inbound/outbound links correct; disclaimer present; treatment review PATCH enforces container gate.

## Relevant files
- `lib/db/src/schema/research.ts`
- `lib/db/sql/migrations/` (latest: 0016-phase10-ai-analysis.sql)
- `artifacts/api-server/src/research/analysis/schema.ts`
- `artifacts/api-server/src/research/analysis/service.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/analysis.ts`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/domain/gates.ts`


---

## 35. Phase 11b: Research Workspace

Source: .local/tasks/phase11b-research-workspace.md

# Phase 11b: Research Workspace

## What & Why
Researchers, lecturers, and students need personal organisation tools layered on top of the case collection: folders to group judgments, saved searches, reading lists, bookmarks, annotations, quotation collections pulled from validated AI passages, case-comparison tables, and authorities tables drawn from Phase 11a's extracted authorities. Workspace items are owned by a user and access is enforced per role (student access remains separate from lecturer access).

## Done looks like
- **Folders** — users can create research folders, course folders (lecturers only), and matter folders; judgments can be added to / removed from any folder the user owns; folder contents are paginated and filterable
- **Saved searches** — users can save a search query (with filters) and re-run it; saved searches are private to the owner
- **Reading lists** — ordered lists of judgments a user intends to read; items can be reordered and marked as read
- **Bookmarks** — existing `research_bookmarks` table extended with optional label and folder association; full CRUD API
- **Annotations** — existing `research_annotations` table extended with highlight range (char offsets), tags, and a `is_public` visibility toggle already present; full CRUD + list-by-judgment API
- **Quotation collections** — users can save a validated passage (from `research_ai_propositions.validated_passages`) as a named quotation; collections are listable and exportable as plain text
- **Case-comparison tables** — users create a named table, add up to 10 judgments as columns, choose which AI analysis fields to compare as rows; the table is stored as configuration and rendered on read
- **Authorities tables** — users create a named table scoped to one or more judgments; the table is populated from Phase 11a's `research_authorities` and `research_legislation_refs` for those judgments, with treatment labels and review status visible; the collection-limitation disclaimer is always included in the response
- **Permissions** — students cannot create course or matter folders; students cannot see `is_public: false` annotations from other users; lecturers can share reading lists and folders with enrolled students (flag, not full ACL); workspace items always enforce the underlying container view gate before returning judgment content
- Tests cover: folder CRUD, cross-user isolation (user A cannot read user B's private folder), student/lecturer permission split, quotation collection save + list, case-comparison table render, authorities table disclaimer present

## Out of scope
- Full ACL sharing (only the lecturer→student share flag)
- Export to PDF or Word (future)
- Real-time collaborative annotation

## Steps
1. **DB schema — workspace tables** — Add: `research_folders` (`id`, `owner_id`, `kind` enum `research|course|matter`, `name`, `description`, `created_at`); `research_folder_items` (`folder_id`, `judgment_id`, unique); `research_saved_searches` (`id`, `owner_id`, `name`, `query` jsonb, `created_at`); `research_reading_lists` (`id`, `owner_id`, `name`, `shared_with_students` bool, `created_at`); `research_reading_list_items` (`list_id`, `judgment_id`, `position` int, `read_at`, unique); `research_quotation_collections` (`id`, `owner_id`, `name`, `created_at`); `research_quotations` (`id`, `collection_id`, `proposition_id` FK, `passage_text`, `label`, `created_at`); `research_comparison_tables` (`id`, `owner_id`, `name`, `judgment_ids` jsonb, `field_names` jsonb, `created_at`); `research_authorities_tables` (`id`, `owner_id`, `name`, `judgment_ids` jsonb, `created_at`). Extend `research_bookmarks` with `label`, `folder_id`. Extend `research_annotations` with `char_start`, `char_end`, `tags` jsonb. Add migration.
2. **Folder service + routes** — CRUD for folders and folder items; `kind: "course"` and `kind: "matter"` creation blocked for `student` role; list returns judgment summaries with the container view gate applied per item.
3. **Saved-search service + routes** — Save/list/delete saved searches; re-run endpoint that executes the stored query against the existing search service.
4. **Reading-list service + routes** — CRUD for lists and items; reorder endpoint (position swap); mark-as-read endpoint; `shared_with_students` flag controls visibility to students in the same system.
5. **Bookmarks + annotations routes** — Full CRUD on top of the existing tables; extend bookmark with `label`/`folder_id`; extend annotation with `char_start`/`char_end`/`tags`; annotation list filters by `is_public` for non-owner callers.
6. **Quotation collections service + routes** — Save a passage from `research_ai_propositions.validated_passages` by proposition ID and char offsets; list collections and their quotations; plain-text export endpoint.
7. **Case-comparison table service + routes** — Create/update/delete tables (max 10 judgment columns); read endpoint assembles the comparison grid by fetching AI proposition content for each `field_name` × `judgment_id` pair from approved runs; returns structured rows.
8. **Authorities table service + routes** — Create/update/delete tables scoped to judgment IDs; read endpoint queries `research_authorities` and `research_legislation_refs` for the named judgments; always includes the fixed collection-limitation disclaimer; treatment review status visible in output.
9. **Permission enforcement** — All workspace reads enforce the underlying container view gate; `student` role blocked from `course`/`matter` folder creation and from seeing other users' private annotations; lecturer `shared_with_students` flag checked on reading-list reads for student callers.
10. **Tests** — Folder cross-user isolation; student blocked from course-folder creation; quotation save + list; comparison table render with two judgments; authorities table returns disclaimer; annotation visibility toggle.

## Relevant files
- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/routes/analysis.ts` (pattern to follow for container gate)
- Phase 11a outputs: `research_authorities`, `research_legislation_refs` tables


---

## 36. Phase 12a: Audit Event Coverage

Source: .local/tasks/phase12a-audit-events.md

# Phase 12a: Audit Event Coverage

## What & Why
The platform already has a `research_audit_events` table and a `recordAuditEvent` helper. However only container state-machine transitions are currently logged. Phase 12a extends audit coverage to every security- and compliance-relevant action: document access, search, AI requests, exports, prints, quotation creation, failed access attempts, administrator actions, deletion, and rights changes. Restricted judgment text must never appear in audit log bodies — only identifiers and metadata.

## Done looks like
- Every action in the list below produces a row in `research_audit_events` with `actor`, `action`, `entity_id`, `entity_kind`, `metadata` (safe, no judgment text), and `created_at`.
- A new admin-only `GET /api/research/audit-events` route returns paginated audit logs filterable by `actor`, `action`, `entityKind`, `entityId`, `dateFrom`, `dateTo`.
- A test file `phase12a.test.ts` covers all new event types (≥ 15 tests), including verifying that judgment text is absent from logged metadata.

## Out of scope
- UI for the audit log viewer (future phase)
- Exporting audit logs to external SIEM systems
- Altering the existing state-machine transition events (they already log correctly)

## Steps
1. **Audit event taxonomy** — define a TypeScript const enum of all event action strings (`DOCUMENT_UPLOADED`, `CHECKSUM_VERIFIED`, `RIGHTS_CHANGED`, `PROCESSING_STARTED`, `OCR_COMPLETED`, `SEGMENTATION_PROPOSED`, `BOUNDARY_CHANGED`, `REVIEWER_DECISION`, `JUDGMENT_VERIFIED`, `DOCUMENT_ACCESSED`, `SEARCH_EXECUTED`, `QUOTATION_CREATED`, `EXPORT_REQUESTED`, `PRINT_REQUESTED`, `AI_ANALYSIS_REQUESTED`, `AI_PROVIDER_USED`, `RECORD_DELETED`, `ACCESS_DENIED`, `ADMIN_ACTION`). Store in `research/domain/auditEvents.ts`.
2. **Text-leak guard** — add a `sanitiseForAudit(obj)` utility that recursively removes any key whose value is a string longer than 500 characters (to stop judgment text leaking into metadata). Apply to all `metadata` payloads before insertion.
3. **Instrument upload and checksum paths** — emit `DOCUMENT_UPLOADED` and `CHECKSUM_VERIFIED` events from the upload/registration flow.
4. **Instrument rights change** — emit `RIGHTS_CHANGED` from `recordRightsDecision` (and any update path) with old-status → new-status in metadata (no text content).
5. **Instrument processing milestones** — emit `PROCESSING_STARTED`, `OCR_COMPLETED`, `SEGMENTATION_PROPOSED`, `BOUNDARY_CHANGED`, `REVIEWER_DECISION`, `JUDGMENT_VERIFIED` at the relevant transition or job-completion points.
6. **Instrument access and search** — emit `DOCUMENT_ACCESSED` from the viewer judgment-fetch route and `SEARCH_EXECUTED` from the search route (query string is safe; result text is not included).
7. **Instrument workspace actions** — emit `QUOTATION_CREATED` from the quotation-save route, `EXPORT_REQUESTED` and `PRINT_REQUESTED` from the export/print stub routes (and later the real routes). Emit `AI_ANALYSIS_REQUESTED` and `AI_PROVIDER_USED` from the AI analysis runner.
8. **Instrument deletions** — emit `RECORD_DELETED` with `entityKind` and `entityId` from every deletion endpoint (Phase 12c will add more). Emit `ADMIN_ACTION` from admin-only endpoints (rights decisions, provider management, user management).
9. **Instrument failed access** — emit `ACCESS_DENIED` from `checkContainerAccess` when the decision is `allowed: false`. Include role and reason in metadata; never include judgment text.
10. **Admin audit-log query route** — `GET /api/research/audit-events` (owner/admin role only); paginated; filterable by actor, action, entityKind, entityId, dateFrom, dateTo. Returns events ordered by `created_at DESC`.
11. **Tests** — `phase12a.test.ts`: verify each event type is emitted; verify `sanitiseForAudit` strips long strings; verify `ACCESS_DENIED` events are written when a researcher tries to access a container they cannot view; verify judgment text is not present in any logged metadata field.

## Relevant files
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/viewer.ts`
- `artifacts/api-server/src/research/routes/search.ts`
- `artifacts/api-server/src/research/routes/workspace.ts`
- `artifacts/api-server/src/research/routes/authorities.ts`
- `artifacts/api-server/src/research/analysis/generator.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `lib/db/src/schema/research.ts`


---

## 37. Phase 12b: Permission-Controlled Exports

Source: .local/tasks/phase12b-exports.md

# Phase 12b: Permission-Controlled Exports

## What & Why
Researchers need to export verified judgment analysis in multiple formats for academic writing, court preparation, and teaching. Currently the export endpoint is a stub that returns a placeholder. Phase 12b implements real, permission-gated export across six formats: DOCX, PDF, CSV, JSON, Markdown, and bibliography. Every exported section must be labelled with its content provenance (verified judicial text / AI-generated / user-authored / unverified / rights-restricted).

## Done looks like
- `POST /api/research/containers/:id/exports` accepts `{ format, scope }` and streams the generated file; the response includes `Content-Disposition` with the appropriate filename.
- Supported formats: `docx`, `pdf`, `csv`, `json`, `markdown`, `bibliography`.
- Scope options: `full` (all sections), `judgment_only` (verified text only), `analysis_only` (AI propositions), `annotations` (user annotations), `authorities` (cited cases + legislation).
- Every section heading or cell includes a provenance tag: one of `[VERIFIED JUDICIAL TEXT]`, `[AI-GENERATED]`, `[USER-AUTHORED]`, `[UNVERIFIED]`, `[RIGHTS-RESTRICTED — content omitted]`.
- Documents whose rights status is not `OFFICIAL_COURT_SOURCE` or `LICENSED` have all text replaced with `[RIGHTS-RESTRICTED — content omitted]`; the export still succeeds but carries only metadata.
- Export events are audited (`EXPORT_REQUESTED` via Phase 12a audit infra).
- `GET /api/research/containers/:id/exports/history` returns the last 50 export events for that container (admin/owner only).
- Tests `phase12b.test.ts` cover: format generation (≥ one test per format), provenance tagging present in output, rights-restricted judgment text is absent from export when rights not approved, unauthenticated user receives 403.

## Out of scope
- Batch export of multiple judgments in a single call (future phase)
- Citation-manager integrations (Zotero, Mendeley)
- Custom export templates
- Print server / server-side rendering to printer (print events are audited but physical print is browser-side)

## Steps
1. **Export service scaffold** — create `research/export/exportService.ts` with a function `buildExport(judgmentId, format, scope, role)` returning `{ contentType, filename, buffer }`. All format renderers call this.
2. **Provenance labelling** — implement a `labelSection(text, provenance)` helper that prepends the appropriate tag to any content block; used by all renderers.
3. **Rights gate** — at the top of `buildExport`, call `assertExportAllowed` (already exists in `domain/gates.ts`). If rights status is not approved, replace all text blocks with the rights-restricted stub; still include metadata (citation, court, date).
4. **JSON renderer** — structured export: `{ judgment: { citation, court, date }, sections: [{ kind, provenance, content }] }`. Easiest format; implement first.
5. **Markdown renderer** — convert sections to Markdown headings + paragraphs with provenance tags inline. Use plain string concatenation, no external library needed.
6. **CSV renderer** — one row per AI proposition: columns `field`, `content`, `confidence`, `provenance`, `judgment_citation`. Use a minimal CSV serialiser (no external lib).
7. **Bibliography renderer** — OSCOLA-style citation string for each cited case from `research_authorities`; one entry per line; includes treatment label. Outputs as plain text with `.bib.txt` extension.
8. **DOCX renderer** — use the `docx` npm package (already in ecosystem or to be installed). Sections map to Heading 1 / Normal paragraphs; provenance tags in italic.
9. **PDF renderer** — use `pdfkit` npm package to produce a minimal PDF: title page with citation metadata, then sections. Provenance tags in grey italic.
10. **Route implementation** — replace the stub in `POST /containers/:id/exports`; add `GET /containers/:id/exports/history` reading audit events for `EXPORT_REQUESTED` on that container.
11. **Audit hook** — emit `EXPORT_REQUESTED` with `{ format, scope, judgmentId }` (no text) via Phase 12a audit helper.
12. **Tests** — `phase12b.test.ts`: per-format smoke tests against a seeded verified judgment; provenance tag assertions; rights-restricted stub present when rights not approved; 403 for unauthenticated; audit event written.

## Relevant files
- `artifacts/api-server/src/research/routes/index.ts:476`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/analysis/generator.ts`
- `lib/db/src/schema/research.ts`


---

## 38. Phase 12c: Retention and Granular Deletion

Source: .local/tasks/phase12c-retention-deletion.md

# Phase 12c: Retention and Granular Deletion

## What & Why
The platform accumulates several distinct data layers per document: original uploaded file, extracted page text, OCR intermediate images, corrected text, case candidates, verified judgment, search embeddings, AI analysis output, and temporary processing artefacts. Different layers have different retention obligations (e.g. rights holders may require original-file deletion while research use of extracted text continues). Phase 12c implements per-layer deletion with a generated deletion manifest, and enforces the principle that backup confirmation is required before claiming backup copies are deleted.

## Done looks like
- `DELETE /api/research/containers/:id/layers` accepts a body `{ layers: LayerKind[] }` where `LayerKind` is one of `original_file | page_text | ocr_images | corrected_text | case_candidates | verified_judgment | search_index | ai_output | temp_files`.
- Each layer deletion is atomic per layer; failures are collected but do not roll back already-completed layers.
- The response is a **deletion manifest** JSON document: `{ containerId, requestedAt, actor, layers: [{ layer, status: "deleted"|"not_found"|"failed", rowsAffected, objectStorageKeys, note }] }`.
- The manifest explicitly states `backupConfirmed: false` and includes the note: `"Backup deletion must be confirmed separately by the backup operator."` It never claims backup copies are deleted.
- `GET /api/research/containers/:id/deletion-manifest` returns the most recent deletion manifest for a container (owner/admin only).
- Deletion manifests are stored in object storage under a private path and their key recorded in a new `research_deletion_manifests` table (`id`, `container_id`, `requested_at`, `actor`, `layers_requested jsonb`, `manifest_key text`, `created_at`).
- All deletion operations emit `RECORD_DELETED` audit events (via Phase 12a audit infra).
- `phase12c.test.ts`: ≥ 10 tests covering: each layer successfully deleted; manifest structure present and correct; `backupConfirmed: false` always in manifest; partial failure returns `failed` status for the failing layer; non-owner receives 403; `GET` manifest history works.

## Out of scope
- Automated retention-period enforcement / scheduled purges (future)
- Deletion of backup store contents (requires separate operator confirmation outside this system)
- Cross-container bulk deletion
- Audit-log deletion (audit logs are append-only by policy)

## Steps
1. **DB migration** — add `research_deletion_manifests` table: `id serial PK`, `container_id int FK`, `requested_at timestamptz`, `actor text`, `layers_requested jsonb`, `manifest_key text`, `created_at timestamptz default now()`.
2. **Layer deletion service** — create `research/retention/deletionService.ts`. Implement one handler per `LayerKind`:
   - `original_file`: delete the uploaded object from object storage; nullify the stored-artifact reference.
   - `page_text`: delete rows from `research_page_extractions` for the container's pages.
   - `ocr_images`: delete any OCR intermediate objects from object storage (keyed by container + page).
   - `corrected_text`: delete rows from `research_page_corrections` for the container's pages.
   - `case_candidates`: delete `research_case_candidates` + cascade (`research_case_candidate_boundaries`).
   - `verified_judgment`: transition container to `DELETED` state if not already; delete `research_verified_judgments` row.
   - `search_index`: delete `research_search_index` row for the judgment.
   - `ai_output`: delete `research_ai_propositions` + `research_ai_analysis_runs` for the judgment.
   - `temp_files`: delete any object storage keys matching the container's temp prefix.
3. **Manifest generation** — after all layer operations complete, build the manifest object (see Done looks like), store it in object storage under `private/deletion-manifests/{containerId}/{uuid}.json`, insert a row into `research_deletion_manifests`, and return the manifest in the HTTP response.
4. **Audit hooks** — emit `RECORD_DELETED` for each successfully deleted layer with `{ layer, containerId }` metadata (no content text).
5. **Route** — `DELETE /containers/:id/layers` (owner/admin only). `GET /containers/:id/deletion-manifest` returns the most recent manifest JSON from object storage.
6. **Tests** — `phase12c.test.ts`: full lifecycle tests; manifest structure assertions; `backupConfirmed: false` check; 403 for non-owner; partial-failure path (stub one layer to throw, assert status `failed`).

## Relevant files
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `lib/db/src/schema/research.ts`
- `lib/db/sql/migrations/`


---

## 39. Phase 12d: Security Review and Penetration Tests

Source: .local/tasks/phase12d-security.md

# Phase 12d: Security Review and Penetration Tests

## What & Why
The research platform handles sensitive legal documents, personal data, AI output, and rights-restricted content. Before the platform can be opened to real researchers, it must pass a structured security review. Phase 12d runs Replit's dependency audit and SAST scanner, then writes a project-specific Vitest/supertest penetration test suite covering all categories specified in the acceptance gate.

## Done looks like
- `pnpm audit` and the Replit security scan tools run without any **unresolved critical or high** severity findings. Medium findings are documented with mitigations; low/info findings are noted.
- A new test file `phase12d-security.test.ts` (and any helpers) exercises every category below and all tests pass:
  - **Access-control** — unauthenticated requests to all gated routes return 401/403, not 200 or 500.
  - **Insecure direct object reference (IDOR)** — researcher A cannot read, modify, or delete researcher B's folders/annotations/collections/comparison tables via guessed numeric IDs.
  - **Rights-gate bypass** — a judgment whose container is in a non-approved rights state cannot be exported, downloaded, or viewed even if the caller knows the `judgmentId`.
  - **Export bypass** — a student cannot access an export endpoint that requires owner/admin role; the export of a rights-restricted judgment omits the text body.
  - **File-upload attacks** — attempting to register a container with a path-traversal filename (`../../etc/passwd`), an oversized declared size, and a ZIP-bomb content hash is rejected with a 400-level error.
  - **Archive-bomb** — uploading a polyglot or recursive archive as a source document is caught at validation (mime-type/content-type check); does not cause server OOM.
  - **SQL injection** — search queries containing SQL metacharacters (`'; DROP TABLE research_users; --`) are safely handled by Drizzle's parameterised queries and return an empty result set (not a 500).
  - **Path traversal in object storage keys** — the storage adapter rejects any key containing `..` or absolute paths; a direct GET with such a key returns 400.
  - **XSS in stored content** — annotation and folder names containing `<script>` tags are stored as literal text and returned as JSON (not executed); no `text/html` content-type is ever returned from API routes without an explicit set.
  - **CSRF** — state-mutating routes (POST/PUT/PATCH/DELETE) require a JSON body with `Content-Type: application/json`; form-encoded POST requests without a CSRF token are rejected.
  - **Prompt injection** — AI analysis requests that include user-controlled text (e.g., judgment text containing `"Ignore previous instructions"`) are passed to the LLM via a fixed system prompt structure and the injected text is treated as data, not instructions. Test asserts the analysis run completes without adopting injected instructions (mock LLM).
  - **Log leakage** — trigger a `DOCUMENT_ACCESSED` event on a judgment, then retrieve the audit log; assert that the full verified judgment text does not appear in any `metadata` field.
  - **Failed access attempts** — three consecutive failed access attempts by a researcher to a forbidden container each produce `ACCESS_DENIED` audit events with correct actor and entity.
- A `security-findings.md` report is written to `.local/tasks/` summarising scanner output, any accepted-risk decisions, and mitigations applied.

## Out of scope
- Full penetration test of the Stripe or Clerk integrations (separate third-party scope)
- OWASP ZAP or browser-based XSS testing (API-only scope)
- Network-layer security (handled by Replit's infrastructure)
- Social-engineering / phishing vectors

## Steps
1. **Dependency audit** — run `pnpm audit` across the workspace; run `runDependencyAudit` via Replit's security tooling. Record all critical/high findings. For each, either apply a fix (package update, `pnpm audit fix`, or override) or document accepted-risk rationale.
2. **SAST scan** — run `runSastScan` and `runHoundDogScan` via Replit's security tooling. Triage results; fix all critical/high; document medium and below.
3. **CSRF guard** — verify existing middleware enforces `Content-Type: application/json` on mutating routes; add enforcement if missing.
4. **Path-traversal guard** — add a storage-key validation function that rejects keys containing `..` or starting with `/`; apply in the object storage adapter and in any route that accepts a storage key from the caller.
5. **Upload validation hardening** — ensure the file-registration route validates: filename characters (allow only `[A-Za-z0-9._-]` after basename extraction), declared size within a configurable maximum, and that the content type is one of an allowed-list of MIME types.
6. **Security test suite** — write `phase12d-security.test.ts` covering all categories from Done looks like. Use supertest against the mounted research router; stub the object storage and LLM calls where needed. Each test should be independently runnable and have a descriptive name matching the attack category.
7. **Security findings report** — after scanner runs and test authoring, write `.local/tasks/security-findings.md` with: scanner tool versions, finding counts by severity, per-finding triage notes, and any code changes made in response.

## Relevant files
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/uploads.ts`
- `artifacts/api-server/src/research/routes/workspace.ts`
- `artifacts/api-server/src/research/routes/viewer.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/analysis/generator.ts`
- `.local/skills/security-scan/SKILL.md`


---

## 40. Phase 14 — Controlled Pilot with Authorised Documents

Source: .local/tasks/phase14-controlled-pilot.md

# Phase 14 — Controlled Pilot with Authorised Documents

## What & Why

Before any full-corpus import, a small controlled pilot must validate that every pipeline step operates correctly, that no case is silently lost or silently approved, and that the rights, audit, and review systems enforce their stated guarantees on real processing runs.

The pilot uses a five-container synthetic set whose processing rights have been reviewed. Each container exercises a specific edge case (dense multi-case, scanned, duplicate, incomplete, cross-file split). The pilot must complete all eighteen workflow steps for each container and produce a written acceptance report before full import is authorised.

This task builds the infrastructure the pilot needs that is not yet complete, generates the pilot file set, and defines the report template. It does **not** import the full collection.

## Done looks like

- A five-container pilot corpus exists in `fixtures/pilot-corpus/` with `MANIFEST.json` describing each file's declared variant.
- All eighteen workflow steps can be executed for each container through the existing admin UI and API without hitting a "not implemented" gap.
- Cross-file case linking (cases that span two containers) is reviewable in the boundary-review UI.
- Publisher-editorial content is flagged and isolated before a container reaches `VERIFIED`.
- The complete-judgment verification step checks that each candidate has a non-empty header, body, and terminus — containers with incomplete candidates are held at `JUDGMENT_VERIFICATION_PENDING` until a reviewer resolves them.
- A quotation-integrity check is runnable per container: it samples quoted strings from a candidate and confirms they appear verbatim in the source pages.
- The audit-review endpoint lists every audit event for a container in chronological order, filterable by stage, readable by staff.
- After all containers pass acceptance, a pilot report is generated at `pilot-report.md` covering all fifteen fields specified in the brief.
- The pilot acceptance gate (six conditions) is documented as a checklist in the report, with each condition marked pass or fail and any failures described.

## Out of scope

- Full collection import.
- Live AI processing (the AI gate remains a reviewed permission; AI steps in the pilot are recorded as "not executed — permission not granted" in the report).
- New storage backends or deployment topology changes.
- Changes to the Stripe or subscriber-access systems.

## Steps

1. **Pilot corpus generator** — Write `scripts/src/generate-pilot-corpus.ts` to produce exactly five source files: (a) a native-text PDF holding ~30 cases, (b) a native-text PDF holding 4 cases, (c) a simulated-scanned PDF (no text layer) holding 1 case, (d) a file that is a duplicate of file (b)'s first case, (e) two files together holding one case split across the file boundary. Output to `fixtures/pilot-corpus/` with a `MANIFEST.json` describing each file's declared variant, expected case count, and rights status. No commercial materials.

2. **Cross-file relationship review** — Extend the boundary-review UI to surface cross-file relationships (`research_relationships` table). When two containers share a `SPLIT_CASE` relationship, the review screen shows both sides side-by-side and provides an "Approve split" or "Reject split" action. Wire to the existing state machine so approval unblocks both containers.

3. **Publisher-content isolation check** — Add a `publisherContentCheck` step that runs after segmentation: it scans candidate boundaries for known editorial patterns (court reporter headers, index pages, table-of-contents pages) using heuristics. Containers with flagged editorial content move to `EDITORIAL_REVIEW_REQUIRED`; the review UI presents each flagged block with "Mark as editorial (exclude)" or "Mark as judgment (include)" actions. Containers that pass automatically continue.

4. **Complete-judgment verification logic** — Implement the completeness checker in `research/isolation/completenessChecker.ts`: each candidate must have a detectable citation header, a non-zero body word count, and a detected terminus (judgment footer or "I so order" pattern). Candidates that fail any check are flagged `INCOMPLETE`; the container stays at `JUDGMENT_VERIFICATION_PENDING` until a reviewer either approves or rejects each flagged candidate.

5. **Quotation-integrity endpoint** — Add `POST /api/research/containers/:id/quotation-check`: given a candidate ID, it extracts up to ten quoted strings from the candidate text and searches for each verbatim in the container's source pages. Returns a JSON result with found/not-found status per quote. The boundary-review UI shows a "Run quotation check" button per candidate that calls this endpoint and displays results inline.

6. **Audit-review endpoint and UI** — Add `GET /api/research/containers/:id/audit`: returns all `research_audit_events` for the container ordered by `created_at`, with optional `?stage=` filter (upload, rights, extraction, segmentation, verification, search, export). Wire a read-only "Audit trail" tab into the existing container detail view in the admin UI.

7. **Pilot report generator** — Write `scripts/src/generate-pilot-report.ts`: queries the live database for the five pilot containers by `source_batch = 'pilot-v1'`, counts source files received, case candidates detected, verified judgments, false boundaries, missed boundaries, OCR defects, missing pages, duplicates found, editorial corrections, rights restrictions, AI evidence failures (always 0 for this pilot), and exports `pilot-report.md` with the acceptance checklist (six conditions) marked pass/fail. Runs as `pnpm --filter @workspace/scripts exec tsx ./src/generate-pilot-report.ts`.

8. **Integration test for pilot workflow** — Add `artifacts/api-server/src/research/pilot.test.ts`: uploads the five pilot files, runs the full pipeline (ingest → rights → inventory → extraction → segmentation → editorial check → verification → search index), asserts each container reaches `SEARCHABLE` or a documented hold state, and asserts no container is silently skipped. Runs within the existing `pnpm --filter @workspace/api-server run test` suite.

## Relevant files

- `artifacts/api-server/src/research/segmentation/pipeline.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/isolation/completenessChecker.ts`
- `artifacts/api-server/src/research/routes/reviewUi.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/ingestion/service.ts`
- `artifacts/api-server/src/research/search/searchIndexProcessor.ts`
- `artifacts/api-server/src/research/export/exportService.ts`
- `artifacts/api-server/src/research/stress.test.ts`
- `scripts/src/generate-stress-corpus.ts`
- `scripts/package.json`


---

## 41. Phase Tracking Correction (Phases 08–14)

Source: .local/tasks/phase-tracking-correction.md

# Phase Tracking Correction (Phases 08–14)

## What & Why

The phase discipline requires each phase to end with a completion report in `docs/reports/` and an update to `docs/status/current-phase.json`. Phases 08–14 were implemented and tested by task agents — 488 tests pass, the pilot acceptance gate passes — but none of these required completion artefacts were produced. `current-phase.json` is frozen at phase 07. `PHASES.md` does not define phases 10–14. No ADRs exist for phases 09–14. Any operator or future agent reading the tracking files will believe the platform is at phase 07 and risk re-implementing or breaking work that already exists.

This task writes the missing documentation only. No code changes.

## Done looks like

- `docs/PHASES.md` defines all phases 00–14 with accurate scope descriptions.
- `docs/reports/` contains completion reports for phases 08–14, each covering: objective, deliverables (key modules/tables/routes), state machine changes, test counts, key design decisions, and the PHASE:/STATUS:/CHECKPOINT: footer.
- `docs/decisions/` contains ADRs 0010–0015 for phases 09–14 (phase 08 already has ADR 0009).
- `docs/status/current-phase.json` shows phase 14 as the latest completed phase.
- `docs/PRODUCTION_READINESS.md` includes a brief note that the phase tracking was stale at initial writing and has been corrected by this task.

## Out of scope

- Code changes of any kind.
- New tests.
- Changes to any research platform source files.
- Writing production readiness documentation (Task #93 already completed that).

## Steps

1. **Read the evidence** — For each phase 08–14, read the corresponding task plan in `.local/tasks/` and the test file in `artifacts/api-server/src/research/phase*.test.ts` to extract deliverables and design decisions.

2. **Extend PHASES.md** — Add table rows for phases 10–14. Phase 09 (AI Research Aids / Quotations) is listed but its scope may need clarification. Phases 10–14 are: Authorities & Legislation, Research Workspace, Audit Hardening, Exports & Retention, Security Hardening, Controlled Pilot.

3. **Write phase completion reports (phases 08–14)** — One report per phase in `docs/reports/phase-08-completion.md` through `docs/reports/phase-14-completion.md`. Base each report on the test file assertions and the task plan's "Done looks like" section.

4. **Write ADRs (phases 09–14)** — One ADR per phase in `docs/decisions/0010-phase-09-*.md` through `docs/decisions/0015-phase-14-*.md`. Each ADR documents the key design decisions that future maintainers need to be consistent with.

5. **Update current-phase.json** — Set phase to "14", status to "complete", completedAt to the date the pilot passed (2026-07-29), and report to "docs/reports/phase-14-completion.md". Record previous phase as 13.

6. **Amend PRODUCTION_READINESS.md** — Add a one-sentence note to the header area: "Phase tracking was stale (frozen at phase 07) at the time of initial writing; corrected by the phase-tracking-correction task (2026-07-30)."

## Relevant files

- `.local/tasks/phase-08-search-research-ui.md`
- `.local/tasks/phase09-quotations-citations.md`
- `.local/tasks/phase10-ai-headnotes-analysis.md`
- `.local/tasks/phase11a-authorities-legislation.md`
- `.local/tasks/phase11b-research-workspace.md`
- `.local/tasks/phase12a-audit-events.md`
- `.local/tasks/phase12b-exports.md`
- `.local/tasks/phase12c-retention-deletion.md`
- `.local/tasks/phase12d-security.md`
- `.local/tasks/phase14-controlled-pilot.md`
- `artifacts/api-server/src/research/phase08.test.ts`
- `artifacts/api-server/src/research/phase09.test.ts`
- `artifacts/api-server/src/research/phase10.test.ts`
- `artifacts/api-server/src/research/phase11a.test.ts`
- `artifacts/api-server/src/research/phase11b.test.ts`
- `artifacts/api-server/src/research/phase12a.test.ts`
- `artifacts/api-server/src/research/phase12b.test.ts`
- `artifacts/api-server/src/research/phase12c.test.ts`
- `artifacts/api-server/src/research/phase12d-security.test.ts`
- `artifacts/api-server/src/research/pilot.test.ts`
- `docs/status/current-phase.json`
- `docs/PHASES.md`
- `docs/decisions/0009-phase-08-search-research-ui.md`
- `docs/PRODUCTION_READINESS.md`


---

## 42. Portal-Accessible Case Law Search API

Source: .local/tasks/portal-caselaw-api.md

# Portal-Accessible Case Law Search API

## What & Why
The existing research search API (`/api/research/search`, `/api/research/judgments`) is staff-only (requires Clerk staff auth). Portal subscribers — lawyers using MyLitAI, MyCrimAI, MySyariahAI, etc. — cannot access it. This task exposes a subscriber-facing case law API that all portals can call using their existing access-code/JWT auth, returning cases with headnotes, catchwords, and full metadata, but only for rights-approved and headnote-accepted judgments.

## Done looks like
- `GET /api/cases/search?q=...&court=...&dateFrom=...&dateTo=...&limit=20&offset=0` returns a list of cases with: citation, case name, court, date, parties, catchwords, headnotes (numbered), and a snippet from the judgment text
- `GET /api/cases/:id` returns the full case record: all metadata, all accepted headnotes, all catchwords, and the full judgment text paragraphs
- All portal auth methods work (access-code session, CCB JWT, master access code) — any authenticated portal subscriber can call these endpoints
- Only rights-approved (`rights_status = APPROVED`) cases with at least one accepted headnote are returned
- Results are paginated and sortable by date/relevance

## Out of scope
- Staff review or editing of headnotes from this API (stays in Research Admin)
- Uploading or submitting new cases (staff/Drive pipeline only)
- Per-portal content filtering (all portals see all approved cases)

## Steps
1. **Auth middleware** — Write a `requireAnyPortalAuth` middleware that accepts any of the existing portal session types (lit session cookie, crim session cookie, sya session cookie, acad session cookie, CCB JWT bearer, convey session, corp bearer, accident session) and passes if any validates. This is the shared gate for the new endpoints.
2. **Search endpoint** — Implement `GET /api/cases/search` joining `research_search_index`, `research_verified_judgments`, `research_case_metadata`, `research_headnotes`, and `research_catchwords`. Filter to approved + accepted-headnotes. Support full-text `q`, `court`, `dateFrom`, `dateTo`, `limit`, `offset`. Return a normalised DTO.
3. **Case detail endpoint** — Implement `GET /api/cases/:id` returning full case record: all accepted headnotes (ordered by number), all catchwords, all metadata fields, and the judgment paragraphs from `research_verified_judgments`.
4. **Mount** — Register the new cases router at `/api/cases` in `artifacts/api-server/src/routes/index.ts` behind `requireAnyPortalAuth` (no Clerk required).
5. **Rate limit** — Apply the existing AI rate-limit pattern (or a simple per-access-code counter) to prevent bulk scraping: max 200 case reads per access code per day.

## Relevant files
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/research/routes/search.ts`
- `artifacts/api-server/src/research/routes/viewer.ts`
- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/routes/research-admin.ts`


---

## 43. Case Law Search UI in All Portals

Source: .local/tasks/portal-caselaw-ui.md

# Case Law Search UI in All Portals

## What & Why
Once the portal case law API exists, every portal app (MyLitAI, MyCrimAI, MySyariahAI, MyLitAI IRAC, MyConveyLitAI, MyCCBLitAI, MyCorpLegalAI, MyAccidentAI) needs a "Case Law" section where subscribers can search and read cases with headnotes and catchwords — exactly as they appear in a printed law report. This task builds a shared React component and wires it into each portal's navigation.

## Done looks like
- Every portal has a "Case Law" nav item (or tab) that opens a full-text search interface
- The search bar supports keyword search; results show: citation, case name, court, date, and catchwords
- Clicking a case opens a full case view styled like a law report: catchwords at the top, numbered headnotes, then the full judgment text with paragraph numbers
- The case viewer has a "Copy Citation" button and a "Save to Matter File" button (saves the case to the current portal's matter file if one is open)
- The UI is consistent with each portal's existing design system (uses the portal's own colours/components)

## Out of scope
- Annotation or highlighting of judgment text (future)
- Downloading/exporting cases as PDF (future)
- AI-powered case comparison or summarisation (separate AI tools already exist per portal)

## Steps
1. **Shared case law API client** — Add typed fetch helpers for `/api/cases/search` and `/api/cases/:id` to a shared location usable by all portal frontends (or duplicate per portal if they don't share a package). Include pagination state management.
2. **CaseLawSearch component** — Build a reusable React component: search bar + filter dropdowns (court, date range), result list cards (citation, case name, court, date, catchwords summary), and loading/empty/error states.
3. **CaseViewer component** — Build a full case view: catchwords block at top (styled as law report header), numbered headnotes section, judgment text paragraphs with numbers, sidebar with all metadata (parties, court, citation, judges, date). Add "Copy Citation" and "Save to Matter File" actions.
4. **Wire into each portal** — Add a "Case Law" nav link and route to each of the 8 portal apps, rendering the CaseLawSearch/CaseViewer components. Use each portal's existing layout and auth wrapper.
5. **Matter file integration** — In portals that have matter files (MyLitAI, MyCrimAI, MySyariahAI, MyLitAI IRAC, MyConveyLitAI, MyCorpLegalAI), implement "Save to Matter File" by posting the case citation + headnotes to the existing matter file attachment endpoint.

## Relevant files
- `artifacts/mylitai/src/`
- `artifacts/mycrimai/src/`
- `artifacts/mysyariahai/src/`
- `artifacts/mylitai-irac/src/`
- `artifacts/myconveylitai/src/`
- `artifacts/myccblitai/src/`
- `artifacts/mycorplegalai/src/`
- `artifacts/myaccidentai/src/`


---

## 44. Time, Billing & Invoicing Across All Portals

Source: .local/tasks/practice-billing-suite.md

# Time, Billing & Invoicing Across All Portals

## What & Why
Lawyers need to record billable time and fees on each matter and turn them into professional invoices for clients. Today the portals track matters and some time-log stubs, but there is no fee/rate system, no invoice lifecycle, and no legal-fee ledger anywhere. This adds a shared time-and-billing engine used by every practice portal (MyLitAI, MyCrimAI, MySyariahAI, MyCCBLitAI, MyAccidentAI, MyConveyLitAI, MyCorpLegalAI).

## Done looks like
- On any matter, a lawyer can log time entries (date, activity, minutes, rate) and record fixed fees & disbursements
- A billing tab per matter shows running totals (professional fees, disbursements, taxes)
- Lawyer can generate an invoice (draft → issued → paid/partly-paid), with firm/client details, itemized lines, and download it as a professional PDF
- A portal-level "Billing" page lists all invoices with status and aged-receivables summary
- Works end to end in the browser on every portal, scoped per subscriber (and master code)

## Out of scope
- Online payment collection from clients (Stripe checkout for the firm's own clients)
- Double-entry accounting (covered by the firm accounts task)

## Steps
1. **Shared billing engine** — Central library that creates the billing tables (time entries, fee items, invoices, invoice lines) with per-portal owner scoping following the existing shared matter-files/case-intelligence pattern; boot-ensured tables via direct SQL
2. **Routes per portal** — Mount billing routes behind each portal's auth, with the per-portal owner-column mapping (follow the case-ownership checklist so nothing fails closed)
3. **Invoice PDF export** — Server-side professional invoice PDF and billing-summary PDF (this supersedes the earlier billing-summary-PDF idea)
4. **Portal UI** — Matter billing tab + portal-level Billing page in each of the 7 practice portals, consistent design per portal theme
5. **End-to-end verification** — Curl-level auth checks on every portal, plus browser test on at least two portals; full api-tests run

## Relevant files
- `artifacts/api-server/src/lib/matterFiles.ts`
- `artifacts/api-server/src/lib/caseIntelligence.ts`
- `artifacts/api-server/src/lit/routes/matters.ts`
- `artifacts/api-server/src/utils/docxExport.ts`


---

## 45. Production-Readiness Review & Operational Docs

Source: .local/tasks/production-readiness-review.md

# Production-Readiness Review & Operational Docs

## What & Why

Conduct a structured production-readiness review of the Judgment Research Platform across all 24 required domains, issue a formal written readiness status, and produce the 12 operational documents needed before any supervised or full production use begins.

Phases 00–14 are now all merged (488/488 tests pass). The controlled pilot (Task #85) has merged. Before any corpus import or supervised use, a formal assessment and documentation suite must exist.

---

## Readiness Decision to Issue

The executor must read all phase completion reports, the pilot report, all ADRs, the security model, the rights model, and the open task list, then produce a formal decision using exactly one status:

- NOT_READY
- READY_FOR_LIMITED_INTERNAL_PILOT
- READY_FOR_CONTROLLED_PRIVATE_USE
- READY_FOR_APPROVED_PRODUCTION_USE

The decision must assess all 24 domains listed in the Steps section and cite the evidence for each.

**Known factors that must be weighed:**
- Task #7 (upload submitter binding) — still PROPOSED; unauthorised document access not fully closed
- Task #21 (corp chat isolation) — still PROPOSED; cross-subscriber isolation not formally verified
- Task #87 (job-stealing test) — still PROPOSED; test coverage gap
- Pilot report: Task #85 has merged but the acceptance-gate outcome must be read from the merged pilot report
- No backup/restoration or incident-response procedures yet exist
- All 12 operational documents are absent

---

## Done Looks Like

### Formal decision report
`docs/PRODUCTION_READINESS.md` — contains the status decision, a table assessing all 24 domains (authentication, permissions, rights gating, quarantine, file provenance, original-file integrity, page extraction, OCR review, multi-case segmentation, human boundary review, cross-file reconstruction, publisher-content isolation, complete-judgment verification, metadata, duplicates, search, quotations, AI evidence, exports, audit, deletion, security, backups, capacity, operational documentation), evidence citations, and the explicit preconditions for each higher status.

### 12 operational documents in `docs/operations/`

| # | Document | File |
|---|---|---|
| 1 | Administrator manual | `administrator-manual.md` |
| 2 | Staff ingestion manual | `staff-ingestion-manual.md` |
| 3 | Legal-review manual | `legal-review-manual.md` |
| 4 | Segmentation-review manual | `segmentation-review-manual.md` |
| 5 | Rights-review manual | `rights-review-manual.md` |
| 6 | Backup and restoration guide | `backup-and-restoration.md` |
| 7 | Incident-response guide | `incident-response.md` |
| 8 | Full-corpus import procedure | `full-corpus-import.md` |
| 9 | Risk register | `risk-register.md` |
| 10 | Known-limitations register | `known-limitations.md` |
| 11 | Deployment architecture | `deployment-architecture.md` |
| 12 | Rollback procedure | `rollback-procedure.md` |

Each document must be written to practitioner depth — sufficient for a staff member who has not built the system to operate it safely, make correct decisions, and escalate appropriately.

---

## Out of Scope

- Beginning full-corpus processing (explicitly deferred)
- Resolving Task #7, #21, or #87 (separate tasks — document them as blockers, do not fix them here)
- Any code changes — documentation only

---

## Steps

1. **Read all evidence** — phase completion reports (phases 00–07 in `docs/reports/`; phases 08–14 from merged test files and pilot report), all ADRs in `docs/decisions/`, `docs/ARCHITECTURE.md`, `docs/RIGHTS_MODEL.md`, `docs/SECURITY_MODEL.md`, `docs/PROCESSING_STATES.md`, `pilot-report.md`, and the open task list. Note the accepted pilot outcome.

2. **Write `docs/PRODUCTION_READINESS.md`** — formal status decision with full 24-domain assessment table; evidence citations per domain; explicit precondition list for each higher status level (READY_FOR_LIMITED_INTERNAL_PILOT, READY_FOR_CONTROLLED_PRIVATE_USE, READY_FOR_APPROVED_PRODUCTION_USE).

3. **Write administrator manual** — platform overview; user and role management (8 roles, how to grant/revoke); system health check procedure; job queue monitoring and intervention; container state dashboard; emergency quarantine of a container; session revocation; escalation contacts.

4. **Write staff ingestion manual** — end-to-end ingestion workflow step by step (upload → rights triage → extraction → segmentation → human review → editorial review → verification); expected processing times; what each queue state means; common error states and recovery; when to escalate to rights reviewer or legal reviewer.

5. **Write legal-review manual** — what `MANUAL_LEGAL_REVIEW_REQUIRED` means and how containers reach that state; the review decision procedure; the 17-field rights record fields a legal reviewer must complete; how to record the outcome; escalation and recusal procedure.

6. **Write segmentation-review manual** — what `SEGMENTATION_REVIEW_REQUIRED` and `EDITORIAL_REVIEW_REQUIRED` mean; how to inspect candidate boundaries; how to approve/reject/split/merge candidates in the review UI; cross-file span confirmation; when to escalate; what happens after approval.

7. **Write rights-review manual** — all 13 rights statuses explained for a reviewer (plain language); how to make a rights decision; the capability matrix (what each status permits for storage/display/search/analysis/AI/export/print/student access); handling expired rights records; the `DO_NOT_RETAIN` deletion path; audit trail obligations.

8. **Write backup and restoration guide** — what data exists (PostgreSQL database, private object storage bucket); where it lives in production (Replit deployment); how to trigger a manual database backup; how to verify backup integrity; step-by-step restoration procedure (database, then object storage, then consistency check); RTO and RPO targets; known limitations (no automated backup verification currently).

9. **Write incident-response guide** — severity classification (P1 data exposure / P2 processing error / P3 operational issue); first-responder checklist for each severity; how to quarantine a container immediately; how to freeze the job queue; how to revoke a user session; evidence preservation steps; communication chain; post-incident review requirement.

10. **Write full-corpus import procedure** — pre-conditions that must be met (pilot acceptance gate passed, security tasks #7 and #21 resolved, administrator and staff manuals read); batch sizing guidance; monitoring checkpoints during import; how to pause/resume the import job; handling partial batch failures; post-import report generation and sign-off.

11. **Write risk register** — one row per risk across: data loss, unauthorised access, rights mis-classification, OCR error propagation, segmentation error, AI evidence failure, external AI exposure, publisher-content leakage, single-point infrastructure failure, operational errors. Columns: risk, likelihood (H/M/L), impact (H/M/L), current mitigations, residual risk, owner, review date.

12. **Write known-limitations register** — document every confirmed limitation at this release: OCR confidence threshold not calibrated to real corpus; pilot not yet run with court-issued documents (or record actual pilot outcome if Task #85 data is available); full-corpus performance unverified at scale; AI evidence not enabled by default; upload submitter binding incomplete (Task #7); cross-subscriber chat isolation not formally verified (Task #21); job-stealing test coverage gap (Task #87); automated backup verification absent; no SLA commitments.

13. **Write deployment architecture** — production topology (Replit deployment, shared Express API server, PostgreSQL database, private object storage bucket); how the monorepo artifacts map to preview paths and routes; secret management (Replit Secrets); TLS termination; no direct database access from browsers (all through API); scaling constraints; health check endpoint (`/api/research/health`); how to verify the deployment is live and healthy.

14. **Write rollback procedure** — how to use Replit checkpoints to revert a bad deployment; which database migrations are reversible and which are irreversible (and what the safe path is for each irreversible one); how to verify system stability after rollback; how to communicate a rollback to affected staff; when rollback is not appropriate and forward-fix is preferred.

---

## Relevant Files

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/RIGHTS_MODEL.md`
- `docs/PROCESSING_STATES.md`
- `docs/SECURITY_MODEL.md`
- `docs/PHASES.md`
- `docs/PROJECT_CHARTER.md`
- `docs/reports/phase-00-completion.md`
- `docs/reports/phase-01-completion.md`
- `docs/reports/phase-02-completion.md`
- `docs/reports/phase-03-completion.md`
- `docs/reports/phase-04-completion.md`
- `docs/reports/phase-05-completion.md`
- `docs/reports/phase-06-completion.md`
- `docs/reports/phase-07-completion.md`
- `docs/decisions/0001-bootstrap-inside-monorepo.md`
- `docs/decisions/0002-phase-01-redefined-core-architecture.md`
- `docs/decisions/0003-phase-02-auth-roles-rights-quarantine.md`
- `docs/decisions/0004-phase-03-ingestion.md`
- `docs/decisions/0005-phase-04-extraction.md`
- `docs/decisions/0006-phase-05-segmentation.md`
- `docs/decisions/0007-phase-06-validation-review-cross-file.md`
- `docs/decisions/0008-phase-07-publisher-content-isolation.md`
- `docs/decisions/0009-phase-08-search-research-ui.md`
- `pilot-report.md`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/retention/deletionService.ts`
- `artifacts/api-server/src/research/storage/keyValidation.ts`
- `scripts/src/generate-pilot-report.ts`


---

## 46. Restore Cross-App Reliability

Source: .local/tasks/restore-cross-app-reliability.md

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


---

## 47. Sarawak Tiered Firm Pricing

Source: .local/tasks/sarawak-tiered-pricing-verification.md

# Sarawak Tiered Firm Pricing

## What & Why
Update Project Sarawak 20 so the first 20 law-firm/lawyer subscriptions cost RM69 per month, then offer verified Advocates Association of Sarawak firms an uncapped RM99 per month package with one shared access code and three active seats. Add credible eligibility details for both advocates and chambering students so programme places are reserved for the intended Sarawak legal community without making payment unreliable.

## Done looks like
- The first 20 firm/lawyer places display and charge RM69 per month; the chambering cohort remains RM49 per month.
- Once all 20 founding firm places are paid or validly reserved, the page automatically offers the RM99 per month AAS firm package instead of showing the firm option as simply sold out.
- The RM99 package is available only after AAS eligibility is confirmed and allows one firm access code with up to three active seats across the included LAWYes portals.
- Firm verification uses the official AAS-directory identity fields: advocate full name, registered firm name, and practice location, with practising-certificate or AAS reference accepted as supporting information rather than an invented mandatory membership-number format.
- Chambering verification collects legal name, pupil master, registered firm, pupillage commencement date, AAS branch, and Notice of Pupillage acknowledgement; a CMS petition/case number is optional when one has already been issued.
- Applicants receive clear correction or review messaging when details cannot be confirmed, and no ineligible AAS checkout is created or charged.
- Stripe checkout, webhook replay, cancellation, expired reservations, cohort transition, and three-seat access remain idempotent and protected by automated payment and browser regression tests.

## Out of scope
- Repricing or migrating existing RM49 Project Sarawak 20 subscriptions.
- Changing the 20-place chambering cap or its RM49 monthly price.
- Inventing an AAS membership-number standard that the Association does not publicly expose.
- Building a general membership-verification product outside this Sarawak campaign.

## Steps
1. **Model versioned programme plans** -- Preserve legacy subscriptions while adding explicit RM69 founding-firm, RM49 chambering, and RM99 post-cap AAS firm plans with independent pricing, capacity, and seat entitlements.
2. **Add eligibility records and contracts** -- Persist normalized advocate, firm, location, and pupillage evidence separately from Stripe data, with validation, duplicate protection, privacy controls, and a review state for details that cannot be conclusively matched.
3. **Implement safe cohort transition** -- Keep advisory-lock capacity protection for the founding 20 and expose the AAS three-seat package only after those places are fully allocated, without counting the uncapped package against the founding cohort.
4. **Harden Stripe lifecycle** -- Resolve dedicated MYR recurring prices by immutable plan metadata and amount, bind verified eligibility to idempotent checkout requests, and make webhook provisioning, cancellation, expiry, and delayed completion safe for all old and new plans.
5. **Provision three-seat access** -- Issue one shared AAS firm access code with a three-active-seat limit across the included portals while keeping founding-firm and chambering entitlements unchanged.
6. **Update the campaign experience** -- Present the new prices, live transition, eligibility fields, verification feedback, three-license terms, founding-rate wording, success state, and subscription-management paths clearly on desktop and mobile.
7. **Verify end to end** -- Add focused concurrency, price-selection, eligibility, transition, provisioning, webhook, and seat-limit tests, regenerate API clients, run existing payment-access regressions, and browser-test checkout payloads without creating a real charge.

**Critical constraints:** Existing LAWYes Stripe catalog and subscribers must remain unchanged; old Sarawak RM49 sessions must stay recognizable; sensitive professional identifiers must never be logged or copied into Stripe metadata; no access is provisioned until a paid session is bound to the correct verified plan.

## Relevant files
- `artifacts/api-server/src/lib/sarawak20.ts`
- `artifacts/api-server/src/lib/provisioning.ts`
- `artifacts/api-server/src/routes/stripe.ts`
- `artifacts/api-server/src/stripeClient.ts`
- `artifacts/sarawak20/src/pages/landing.tsx`
- `artifacts/sarawak20/src/pages/success.tsx`
- `artifacts/sarawak20/src/pages/manage.tsx`
- `lib/api-spec/openapi.yaml`
- `lib/db/src/schema/sarawak20.ts`
- `lib/db/sql/migrations/0031-sarawak20-reservations.sql`
- `artifacts/api-server/src/lib/sarawak20.test.ts`
- `artifacts/api-server/src/routes/payment-access-regression.test.ts`


---

## 48. Phase 12d — Security Scan Findings & Triage

Source: .local/tasks/security-findings.md

# Phase 12d — Security Scan Findings & Triage

**Scan date:** 2026-07-27  
**Tools:** `runDependencyAudit`, `runSastScan`, `runHoundDogScan`  
**Test suite:** `phase12d-security.test.ts` (13 categories)

---

## 1. Dependency Audit

**Summary:** 38 findings — 22 high, 13 moderate, 3 low (0 critical)

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 22    |
| Moderate | 13    |
| Low      | 3     |

**Notable high-severity packages:**

| Package | Version | Level | Fix available | Major update needed |
|---------|---------|-------|---------------|---------------------|
| `brace-expansion` | 1.1.16 | high | yes | yes (→ 5.x) |
| `brace-expansion` | 2.0.2  | moderate | yes | no (→ 2.1.2) |
| `body-parser` | 2.2.2 | low | yes | no |
| `@babel/core` | 7.29.0 | low | yes | no |

**Triage:**

All 38 findings are in **transitive dependencies** (build tooling, dev scripts, and library dependencies such as minimatch, glob patterns, babel, body-parser). None are direct vulnerabilities in the research module's runtime code. The `brace-expansion` high findings are Denial-of-Service only (AV:N, AC:L, no confidentiality impact). No exploit path exists through the research API surfaces.

**Action:** No immediate code-level fix required. Track for the next scheduled dependency update cycle. The `brace-expansion` major bump (1.x → 5.x) requires upstream ecosystem readiness.

---

## 2. SAST Scan

**Summary:** 7 findings — 0 critical, 0 high, 7 medium

All 7 are `tainted-redirect-express` rules in `artifacts/api-server/src/acad/routes/oauth.ts`.

| Location | Lines | Check | Severity | Triage |
|----------|-------|-------|----------|--------|
| `acad/routes/oauth.ts` | 122 | tainted-redirect-express | MEDIUM | **False positive** — redirect target comes from `url.toString()` which is a URL constructed from allowlisted provider endpoints, not from raw user input |
| `acad/routes/oauth.ts` | 150 | tainted-redirect-express | MEDIUM | **False positive** — redirect target passes through `safeNext()` which enforces `startsWith("/")` and rejects `//` prefix, blocking all open-redirect vectors |
| `acad/routes/oauth.ts` | (remaining 5) | tainted-redirect-express | MEDIUM | **False positive** — same `safeNext()` guard or fixed provider URL patterns |

**`safeNext` implementation (verified):**
```typescript
function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  // Only allow same-origin paths; never let an attacker bounce the user to
  // an external URL after login.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
```

This correctly blocks `http://evil.com`, `//evil.com`, and any non-string input. The SAST tool cannot see through the function boundary.

**Action:** All 7 findings are false positives. No code change needed.

---

## 3. HoundDog Scan

**Summary:** 3 findings — 2 "critical" (false positive), 1 other

| File | Line | Rule | Severity | Finding | Triage |
|------|------|------|----------|---------|--------|
| `scripts/src/import-convey-users.ts` | 242 | PASSWORD | CRITICAL | `console.log(... passwords ...)` | **False positive** — logs a count (`${updatedPasswords} existing accounts got their missing password hash`), not an actual credential value |
| `scripts/src/push-convey-users-to-prod.ts` | 130 | PASSWORD | CRITICAL | `console.log(... password hashes ...)` | **False positive** — logs count of accounts with hashes (`${withPassword} with password hashes`), not actual hash values |
| (third finding) | — | — | — | Not shown in scan output | Inspect if re-run shows it |

**Action:** Both CRITICAL findings are false positives — the word "password" appears in a count description string, not in a value being logged. No credentials are exposed. No code change needed for the scan findings themselves.

---

## 4. Hardening Implemented (Phase 12d)

### 4.1 Storage key path-traversal guard

**File:** `artifacts/api-server/src/research/storage/keyValidation.ts` *(new)*

Added `validateStorageKey(key: string): void` that throws `TypeError` if:
- Key is empty or not a string
- Key starts with `/` (absolute path)
- Any segment equals `..`
- Any segment contains a NUL byte
- Key exceeds 1,024 characters

Applied in `objectStorageAdapter.ts` at the top of `put`, `get`, and `remove`.

### 4.2 CSRF content-type guard

**File:** `artifacts/api-server/src/research/routes/csrf.ts` *(new)*  
**Applied in:** `artifacts/api-server/src/research/routes/index.ts`

`csrfGuard` middleware returns HTTP 415 for POST/PUT/PATCH/DELETE requests to the research API that do not carry `Content-Type: application/json`. File-upload routes (`/uploads/*`) are explicitly exempt as they use `multipart/form-data`.

### 4.3 Upload filename sanitisation

**File:** `artifacts/api-server/src/research/ingestion/service.ts`

Added `sanitiseFilename(raw: string): string | null`:
1. Applies `path.basename()` to strip all directory components
2. Rejects NUL bytes before and after stripping
3. Replaces characters outside `[A-Za-z0-9._\- ]` with `_`
4. Returns `null` for empty or purely-dot results (e.g. `..`)

Applied in `processUpload`: files with `null` sanitised names are immediately REJECTED with error code `UNSAFE_FILENAME` before any further processing.

---

## 5. Test Coverage (phase12d-security.test.ts)

| # | Category | Tests |
|---|----------|-------|
| 1 | Access control | unauthenticated → 401 (3 tests) |
| 2 | IDOR | B cannot access A's folder (3 tests) |
| 3 | Rights-gate bypass | UNREVIEWED container invisible (2 tests) |
| 4 | Export bypass | student → 403/404 on export (1 test) |
| 5 | File-upload attacks | sanitiseFilename (5 tests) |
| 6 | Archive-bomb | limits configured + crafted ZIP (2 tests) |
| 7 | SQL injection | 4 payloads → no 500 (4 tests) |
| 8 | Path traversal in storage | validateStorageKey (6 tests) |
| 9 | XSS in stored content | annotation + folder name (2 tests) |
| 10 | CSRF guard | form POST → 415 + JSON → not 415 (4 tests) |
| 11 | Prompt injection | injection text in data segment (1 test) |
| 12 | Log leakage | metadata strings ≤ 500 chars (1 test) |
| 13 | Failed-access trail | 3 denials → 3 ACCESS_DENIED events (1 test) |


---

## 49. Synthetic Stress Corpus and Capacity Report

Source: .local/tasks/stress-corpus-and-capacity-report.md

# Synthetic Stress Corpus and Capacity Report

## What & Why
The research platform has no verified capacity envelope. Before adding more users or larger corpora we need to know: how many containers it can ingest reliably, where memory and storage blow up, which pipeline stages are safe inside the Replit web process, and which demand a separate worker. This task builds the measurement apparatus and produces a signed-off report.

The corpus is fully synthetic — no restricted or commercial material.

## Done looks like
- A repeatable corpus-generation script produces the full 500-container / several-thousand-case corpus on demand (no commercial source material anywhere in the tree)
- A test harness runs each of the 14 measurement dimensions against that corpus and records results
- The final report (`stress-report.md`) is committed and states all acceptance-gate values:
  - Tested corpus size
  - Safe batch size
  - Peak memory (RSS, heap)
  - Average and worst-case processing time per stage
  - Failure rate and retry outcomes
  - Search latency (p50 / p95 / p99)
  - Storage requirements (object storage + DB row growth)
  - Recommended deployment topology
  - Features that require external workers
  - Features safe for Replit hosting
- Resource-constraint boundaries are documented honestly — no silent fallback, no concealed OOM
- If bulk OCR or large-batch segmentation exceeds safe Replit limits, a queue-export / worker-handoff path is implemented that preserves the existing web app, the processing-adapter interface, and the source-and-result provenance model; the capacity boundary is documented in the report

## Out of scope
- Replacing the existing ingestion or segmentation pipeline (adapter interface is preserved)
- Actual OCR engine integration (synthetic PDFs simulate OCR-quality variation via controlled character corruption)
- Production load testing against a live deployment
- Any use of real court judgments or commercially licensed text

## Steps

### 1. Corpus generator
Write a standalone Node.js script (`scripts/generate-stress-corpus.ts`) that produces deterministic synthetic PDFs:
- **Native-text containers** — pdf-lib or pdfkit; 1–5 cases per file up to dense containers with 30 + cases; one or more editorial introduction sections mimicking publisher front-matter
- **Simulated-scanned containers** — embed synthetic raster text blocks (low-res image of monospace text) rather than selectable text; no actual OCR needed — the content is pre-rendered as an image plane
- **Duplicates** — identical byte content reused across two or more containers; also near-duplicate (same text, different whitespace) and hash-collision-safe copies
- **Incomplete cases** — judgment that ends mid-sentence (simulates truncated download)
- **Damaged files** — valid PDF envelope with corrupted xref table or null bytes inside stream; one variant that is not a PDF at all (renamed `.docx`)
- **Misleading boundaries** — section headings that look like case citations but are editorial sub-headings; footnote blocks that span across a logical page break
- **Cases split across files** — a single judgment that is spread across two consecutively-named containers, requiring cross-container stitching
- **Mixed OCR quality** — parameterised character-substitution function applied to extracted text (0 % error = perfect, 5 % = typical scan, 25 % = low-quality scan, 50 % = near-unreadable)
Target output: ~500 container files, ~3 000–4 000 synthetic case candidates in total, covering all corpus variant types above.

### 2. Upload reliability and queue stability
Wire the corpus through the real ingestion API (`POST /api/research/uploads`) inside an integration test using the existing `buildApp` + `runNextJob` pattern. Record per-file success/failure, HTTP status distribution, retry events, and final queue depth after full drain.

### 3. Memory and storage instrumentation
Sample `process.memoryUsage()` (RSS + heapUsed) before and after each pipeline stage (ingest, segment, analyse). Record `research_source_containers`, `research_transformations`, and `research_jobs` row counts after each batch. Record total bytes written to the storage adapter (sum of `put` calls). Plot growth curves at 50, 100, 250, and 500 containers.

### 4. Throughput and timing
Time each pipeline stage: upload validation, object-storage write, segmentation (per-container), AI analysis (per-judgment). Record min / average / p95 / max. Use the existing `Date.now()` instrumentation pattern; do not add external tracing dependencies.

### 5. Retry and job resumption
Deliberately inject transient failures (stub the storage adapter to throw once per three calls). Verify that `maxAttempts` retries succeed for recoverable errors, that the job is marked permanently failed after exhausting attempts, and that a restarted worker picks up in-flight jobs correctly after a simulated process crash (kill the event loop mid-job, restart, re-drain).

### 6. Concurrent users
Simulate 5 and 10 simultaneous uploaders via `Promise.all` batches. Record throughput degradation, lock contention (serialized DB errors), and any dropped jobs.

### 7. Search latency
After seeding the DB with 500 containers + cases, issue 50 representative search queries against the research search route. Record p50 / p95 / p99 latency. Note whether a DB index is missing (EXPLAIN ANALYZE on the slow queries).

### 8. Backup and restore
Snapshot the DB row counts and a sample of storage keys before the test run. After the run, verify that the existing DB backup/restore mechanism (pg_dump / psql round-trip in CI) produces a consistent restored state. Flag any tables that grow faster than the backup window can safely handle.

### 9. Architectural capacity analysis
After gathering the measurements, produce a frank assessment section in the report covering:
- **Safe inside Replit web process**: small-batch upload validation, metadata extraction, search, rights checks, export
- **Safe inside a Replit background worker** (polling `runNextJob` in the same dyno): segmentation of containers ≤ N cases (determine N from the memory curve), lightweight analysis jobs
- **Requires a separate worker service** (separate process, auto-scaling): bulk ingestion of > N containers at once, scanned-PDF OCR, AI analysis at volume
- **Requires external dedicated infrastructure**: corpus re-indexing, bulk re-segmentation, archival export pipelines
Document the exact memory and time thresholds that define each boundary. Do not round down — state the observed limits.

### 10. Queue export / worker handoff (if Replit limits are exceeded)
If steps 3–4 show that bulk processing blows past safe Replit memory limits (heuristic: RSS > 512 MB sustained or any OOM kill):
- Add a `POST /api/research/queue/export` endpoint that serialises the pending `research_jobs` queue to a signed JSON manifest (job type, container ID, retry count, enqueued_at)
- Add a corresponding `POST /api/research/queue/import` endpoint that re-hydrates that manifest into the `research_jobs` table (idempotent by job ID)
- The existing `StorageAdapter` and `AiProviderAdapter` interfaces remain unchanged — the worker handoff is a deployment-topology concern, not an API change
- Document the handoff protocol in `stress-report.md`

### 11. Write the acceptance-gate report
Commit `stress-report.md` at the repo root containing every required field from the acceptance gate. Include a short table mapping each architectural tier to the specific feature set it must host.

## Relevant files
- `artifacts/api-server/src/research/ingestion/service.ts`
- `artifacts/api-server/src/research/ingestion/validation.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/segmentation/pipeline.ts`
- `artifacts/api-server/src/research/segmentation/signalDetector.ts`
- `artifacts/api-server/src/research/segmentation/candidateComposer.ts`
- `artifacts/api-server/src/research/storage/objectStorageAdapter.ts`
- `artifacts/api-server/src/research/storage/adapters.ts`
- `artifacts/api-server/src/research/analysis/generator.ts`
- `artifacts/api-server/src/research/analysis/processor.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/phase12d-security.test.ts`


---

## 50. Synchronize all product information

Source: .local/tasks/sync-all-apps-and-landing-info.md

# Synchronize all product information

## What & Why
Audit and synchronize every customer-facing application and landing page so displayed product facts, research-corpus counts, subscription actions, terminology, and freshness indicators come from authoritative current sources instead of conflicting stale values. The goal is that a customer sees the same truthful information regardless of which LAWyes portal or landing page they open.

The research corpus must remain explicitly separated into source-document intake, verified judgments, indexed judgments, and judgments published to customer search. The current baseline found during planning is 2,152 Google Drive source files catalogued, 299 verified judgments, 193 indexed judgments, and 0 customer-searchable judgments.

## Done looks like
- Every registered customer-facing app and landing page has been audited for stale or conflicting product facts, counts, labels, and subscription-management wording.
- A canonical, database-backed information contract is used wherever a value can change at runtime; static portal-specific content counts are clearly labelled as curated/local rather than presented as the Drive research corpus.
- All relevant pages show the same current research status and do not call source documents “cases.”
- Landing-page hero, footer, feature/stat sections, portal entry pages, case-law pages, Profile/Account, Billing, and unsubscribe entry points use consistent current wording and links.
- All eight practitioner portals plus MyLawAcad, MyLawFirmAI, research-admin, and the public landing page build successfully with no route or base-path regressions.
- Browser verification confirms representative desktop/mobile landing and portal pages render current information, status requests succeed, and every visible subscription-management link reaches the central unsubscribe flow.
- The final report records which values are live database metrics, which are portal-specific curated content, and which still require editorial approval before becoming customer-searchable.

## Out of scope
- Do not bypass research rights, editorial review, accepted-headnote requirements, or publication controls merely to increase the displayed case count.
- Do not rewrite historical customer/matter data, invoices, subscriptions, or user-specific dashboard data as part of a copy/statistics synchronization.
- Do not claim that all Drive files are cases; do not replace a portal’s intentionally separate curated library count unless its source and meaning are verified.
- Do not change unrelated business logic or migrate databases solely to consolidate presentation metadata.

## Steps
1. Inventory every registered artifact, route shell, landing section, case-law page, Profile/Account page, Billing page, footer, and product-stat surface; record each displayed fact and its current source.
2. Define the authoritative source and meaning for each shared fact, including the live research-corpus breakdown and each portal’s intentionally separate curated content counts.
3. Extend or consolidate shared information contracts and UI components so customer-facing pages consume current values consistently, with explicit labels for intake, verification, indexing, and publication.
4. Update all portal shells and landing-page surfaces, including subscription-management links, to use the shared contract and consistent terminology while preserving each artifact’s branding and base path.
5. Add regression coverage for the shared information response, cross-artifact unsubscribe navigation, and representative desktop/mobile rendering across landing and practitioner portals.
6. Run library, API, and artifact typechecks/builds plus focused browser verification; document any pre-existing failures separately from regressions introduced by this synchronization.

## Relevant files
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/routes/corpus-status.ts`
- `artifacts/api-server/src/routes/cases.ts`
- `artifacts/landing-page/src/App.tsx`
- `artifacts/landing-page/src/pages/home.tsx`
- `artifacts/landing-page/src/pages/manage-subscription.tsx`
- `artifacts/landing-page/src/components/hero.tsx`
- `artifacts/landing-page/src/components/footer.tsx`
- `artifacts/landing-page/src/components/powered-by-banner.tsx`
- `lib/case-home-ui/src/index.tsx`
- `lib/billing-ui/src/index.tsx`
- `artifacts/myaccidentai/src/App.tsx`
- `artifacts/mylitai/src/App.tsx`
- `artifacts/mylitai-irac/src/App.tsx`
- `artifacts/mycrimai/src/App.tsx`
- `artifacts/mysyariahai/src/App.tsx`
- `artifacts/mycorplegalai/src/App.tsx`
- `artifacts/myccblitai/src/App.tsx`
- `artifacts/myconveylitai/src/App.tsx`
- `artifacts/mylawacad/src/App.tsx`
- `artifacts/mylawfirmai/src/App.tsx`
- `artifacts/research-admin/src/pages/dashboard.tsx`
- `artifacts/research-admin/src/pages/drive-inventory.tsx`

---

## 51. Integrate MyConveyLitAI app into this project

Source: .local/tasks/task-15.md

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

---

## 52. Judgment Research Platform bootstrap (Phase 00)

Source: .local/tasks/task-26.md

---
title: Judgment Research Platform bootstrap (Phase 00)
---
# Judgment Research Platform Bootstrap (Phase 00)

## What & Why
Bootstrap a private legal judgment research and knowledge-management platform inside this monorepo. It will eventually serve the 8 legal portals (MyLitAI, MyLitAI IRAC, MySyalitAI, MyCorpLegalAI, MyConveyLitAI, MyCrimAI, MyCCBLitAI, MyAccidentAI). The platform ingests folders/ZIP archives of documents where a source file is a CONTAINER, not automatically a case — a file may hold zero, one, many, duplicate, partial, or split judgments. Phase 00 delivers only the stable foundation: persistent governance documents, module architecture with replaceable adapters, database schema stubs, a database-backed job queue skeleton, and smoke tests. No document extraction, OCR, case segmentation, or AI analysis in this phase.

## Done looks like
- The API server starts successfully with the new research module mounted (health endpoint responds).
- All required persistent documents exist:
  - `replit.md` extended with a "Judgment Research Platform" section carrying the persistent agent rules (source-container model, provenance, uncertainty routed to human review, judicial-text integrity, publisher-content isolation, rights gating with all files starting UNREVIEWED, AI as separate evidence-backed research aid, engineering behaviour rules, phase discipline). The existing AI Web Books content is preserved, not replaced.
  - `docs/PROJECT_CHARTER.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY_MODEL.md`, `docs/RIGHTS_MODEL.md`, `docs/PROCESSING_STATES.md`, `docs/PHASES.md`
  - `docs/status/current-phase.json` recording Phase 00 as complete
  - `docs/reports/` (Phase 00 completion report goes here) and `docs/decisions/` (ADR directory with an initial decision record)
  - `fixtures/synthetic/` with small synthetic multi-judgment container fixtures; `fixtures/golden/` scaffolded (real restricted case files are excluded from source control — enforced via .gitignore)
- Test, lint, type-check, and formatting commands exist and pass (`typecheck` and `prettier` exist at root already; add lint and research tests).
- An automated smoke test passes (server boots, research health endpoint, job queue enqueue/claim/complete round-trip, adapter registry resolves defaults).
- Architecture separates web, data, processing, storage, and AI modules with replaceable adapters: storage adapter (object storage default), OCR adapter (stub, disabled), search adapter (Postgres default), AI-provider adapter (disabled by default).
- Rights gating baked into the schema: every source file row starts with rights status `UNREVIEWED`.
- A checkpoint is produced and a Phase 00 completion report is written to `docs/reports/`, after which work stops (phase discipline).

## Out of scope
- Document extraction, OCR, case segmentation, deduplication, and AI analysis (later phases)
- Any UI inside the 8 portals (later phases; Phase 00 is backend + docs foundation)
- Real judgment data ingestion; only local synthetic fixtures
- External queue/search infrastructure (database-backed queue and Postgres search only for now)

## Steps
1. **Persistent documents** — Write the charter, architecture, data model, security model, rights model, processing states, and phases documents; create the status, reports, decisions, and fixtures directories; extend `replit.md` with the platform's persistent rules section.
2. **Research module scaffold** — Add a `research` module to the shared API server following the existing per-portal module pattern, with clear submodule boundaries: web (routes), data (repositories), processing (job handlers), storage, and AI. Mount under `/api/research` with a health endpoint.
3. **Database schema (non-destructive)** — Add research-prefixed tables in the shared db lib: source containers (with rights status defaulting to UNREVIEWED, checksum, provenance fields), processing jobs (queue with states, attempts, idempotency key, resumability), transformations/audit log, and review queue stubs. Push via the existing dev push flow; no destructive migrations.
4. **Adapter layer** — Define TypeScript interfaces and a registry for storage, OCR, search, and AI-provider adapters; wire default implementations (object storage, stub OCR, Postgres search, disabled AI) selected via configuration, with AI off by default.
5. **Job queue skeleton** — Database-backed queue with enqueue, atomic claim, complete/fail, retry with attempt limits, and idempotent handlers; a no-op "container registered" job proves the loop works. Errors recorded to the jobs table and surfaced in logs (restricted data excluded from log lines).
6. **Fixtures and tests** — Add synthetic fixture files modelling the container principle (empty file, single judgment, multi-judgment, split-across-files) and integration tests: smoke boot test, health endpoint, queue round-trip, adapter registry, rights-status default. Add a root lint command if missing. All existing tests must remain passing.
7. **Phase close-out** — Write `docs/status/current-phase.json` (phase 00, complete) and the Phase 00 completion report in `docs/reports/`, then stop (do not begin extraction/OCR work).

Note: judicial-text integrity and publisher-content isolation are documented as schema/architecture constraints in this phase; the enforcing pipelines arrive in later phases.

## Relevant files
- `replit.md`
- `artifacts/api-server/src/app.ts`
- `lib/db`
- `artifacts/api-server/package.json`
- `package.json`
- `pnpm-workspace.yaml`

---

## 53. Phase 01: Core architecture, state machines & test harness

Source: .local/tasks/task-30.md

---
title: Phase 01: Core architecture, state machines & test harness
---
# Phase 01: Core Architecture & State Machines

## What & Why
Build the architectural foundation of the Judgment Research Platform on top of the Phase 00 bootstrap: the full entity model, enforceable state machines for containers and jobs, a processor execution contract, and a complete testing foundation. No document intelligence (no OCR, PDF parsing, segmentation, AI, semantic search, or exports) is implemented — this phase makes later phases safe to build.

Note: this redefines Phase 01 relative to the current `docs/PHASES.md` table ("Ingestion"). Per the phase-discipline rule, the change requires a decision record (`docs/decisions/0002-...`) and an updated phase table — included in scope.

## Done looks like
- All ten core entities exist as `research_*` tables with Drizzle schemas and Zod validation: users (staff roles for review), source containers (extended), source pages, processing jobs (extended), case candidates, verified cases, rights records, human-review tasks, audit events, stored artifacts.
- Containers move through an enforceable state machine with exactly the 20 required states (UPLOADED → … → DELETED, incl. QUARANTINED, PROCESSING_BLOCKED, DELETION_PENDING); every transition goes through one guarded function; invalid transitions are rejected with a structured error and are proven rejected by tests.
- Jobs use the 8 required job states (QUEUED, RUNNING, SUCCEEDED, FAILED_RETRYABLE, FAILED_PERMANENT, CANCELLED, REVIEW_REQUIRED, BLOCKED_BY_RIGHTS) with their own guarded transition function; retryable and permanent failures are distinguishable.
- Every processor run records: processor version, idempotency key, created/started/finished times, retry count, structured failure reason, source checksum, output checksum, and provenance links; re-running with the same idempotency key never duplicates outputs.
- Every state change (container and job) emits an audit event row automatically and atomically (same transaction).
- Testing foundation in place: unit tests (vitest), integration tests against an isolated database schema (not the shared dev data), a browser end-to-end framework wired up with at least one passing smoke test, a synthetic fixture factory, and golden-result comparison utilities with golden files under `fixtures/golden/`.
- All previously passing tests (49) remain green; docs updated (`ARCHITECTURE.md`, `DATA_MODEL.md`, `PROCESSING_STATES.md`, `PHASES.md` + decision record); completion report `docs/reports/phase-01-completion.md` written and `docs/status/current-phase.json` updated.

## Out of scope
- OCR, PDF parsing, text extraction, segmentation, AI summaries, semantic search, production exports (Phases 02+).
- Any upload UI or portal-facing UI (state machines are exercised via code/API and tests only; a UI is not required by this phase).
- Real restricted legal documents — synthetic fixtures only.
- Removing or weakening any Phase 00 control (rights gating, provenance, review routing, disabled AI).

## Steps
1. **Decision record + phase table update** — Write an ADR recording the redefinition of Phase 01 as "Core architecture, state machines, test harness" (Ingestion shifts later) and update the phase table accordingly.
2. **Entity schema expansion** — Add the missing entities as additive `research_*` tables (source pages, case candidates, verified cases, rights records, review tasks, audit events, stored artifacts, research users/roles) and extend containers and jobs with the required state and processor-metadata columns; migrate existing rows from the Phase 00 states to the new state vocabulary with a recorded, reversible mapping. Apply tables via additive SQL (do not use interactive drizzle push — it has proposed destructive renames in this repo).
3. **Container state machine** — Implement a single guarded transition function with an explicit allowed-transitions map for the 20 states; invalid transitions throw a structured error; every accepted transition writes an audit event in the same transaction.
4. **Job state machine + processor contract** — Rework the job queue to the 8 job states while keeping idempotent enqueue and SKIP LOCKED claiming; add processor version, checksums, structured failure reasons, timing fields, and provenance links; rights-blocked and review-required outcomes route to the correct states; same-idempotency-key re-execution is a no-op.
5. **Testing foundation** — Add a database-isolated integration test environment (dedicated schema created/dropped per run), a synthetic fixture factory, golden-result comparison utilities with initial golden files, and a browser end-to-end framework with a passing smoke test; keep the existing 49 tests green.
6. **State-machine and processor test suites** — Exhaustive tests: every invalid container/job transition rejected, retryable vs permanent failure paths, idempotency no-duplication, audit events emitted for all state changes.
7. **Docs + close-out** — Update architecture/data-model/processing-state docs, write the phase-01 completion report in the agreed template, and set `docs/status/current-phase.json` to complete.

## Relevant files
- `lib/db/src/schema/research.ts`
- `lib/db/src/schema/index.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/research.test.ts`
- `docs/PROCESSING_STATES.md`
- `docs/PHASES.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-00-completion.md`
- `fixtures/synthetic/README.md`
- `fixtures/golden/README.md`

---

## 54. Phase 02: Authentication, roles, rights & quarantine

Source: .local/tasks/task-34.md

---
title: Phase 02: Authentication, roles, rights & quarantine
---
# Phase 02: Authentication, Roles, Rights & Quarantine

## What & Why

Implement authentication, an 8-role model, a 13-status document-rights vocabulary, a combined role-plus-rights access decision layer, and quarantine enforcement for the Judgment Research Platform — before any document processing exists. This replaces the previously planned "Ingestion" scope for Phase 02, so the change requires a new Architecture Decision Record (ADR 0003) and updates to `docs/PHASES.md` and `docs/RIGHTS_MODEL.md` (which currently defines only 4 rights statuses: UNREVIEWED / CLEARED_INTERNAL / RESTRICTED / EXCLUDED — those must be migrated into the new 13-status vocabulary with a recorded, reversible mapping).

## Done looks like

- Research platform users authenticate and hold exactly one of 8 roles: owner, administrator, rights reviewer, legal reviewer, researcher, lecturer, student, read-only guest.
- Every source container carries one of the 13 rights statuses (UNREVIEWED, COMMERCIAL_SOURCE_REVIEW_REQUIRED, PRIVATE_PROCESSING_APPROVED, OFFICIAL_COURT_SOURCE, PUBLIC_OR_OPEN_LICENCE_SOURCE, USER_OWNED_OR_AUTHORISED, DISPLAY_RESTRICTED, ANALYSIS_RESTRICTED, EXTERNAL_AI_RESTRICTED, EXPORT_RESTRICTED, DO_NOT_PROCESS, DO_NOT_RETAIN, MANUAL_LEGAL_REVIEW_REQUIRED); new containers still default to UNREVIEWED with no way to supply another value at insert.
- A single access-decision function evaluates (user role × resource rights status × requested action: view / search / process / analyse / external-AI / export / share / print) and is the only gate used by routes and job processors. A permissive role can never override a more restrictive rights status — administrators cannot bypass DO_NOT_PROCESS without a formal, audited rights-status change.
- Quarantined sources (QUARANTINED processing state, or restrictive rights statuses) are visible only to administrators and rights reviewers, excluded from search and AI and external processing, cannot be shared by public URL, and cannot be exported without express approval recorded in the rights record.
- The rights record captures all 17 required fields (source; date obtained; declared source type; licence/permission reference; approved users; approved purposes; storage / analysis / external-processing / student-access / printing / export permissions; retention period; expiry date; reviewer; review date; notes) with an append-only history; the container mirrors the latest status.
- Rights-status changes and access denials on restricted resources create audit events atomically.
- Test suite proves all 6 required scenarios: unauthenticated user sees no protected source; student cannot see a lecturer-only source; administrator cannot bypass DO_NOT_PROCESS without a formal rights change; quarantined source absent from search results; EXTERNAL_AI_RESTRICTED source rejected by the external-AI submission gate; rights changes emit audit events. All 69 existing tests remain green.
- Completion report at `docs/reports/phase-02-completion.md` (PASS/PARTIAL/BLOCKED format) and `docs/status/current-phase.json` updated. Response ends with the PHASE:/STATUS:/CHECKPOINT: structure.

## Out of scope

- Uploading or parsing real files; folder/ZIP ingestion (moves to a later phase).
- OCR, extraction, segmentation, search implementation, or AI features — this phase only builds the *gates* those phases must pass through.
- Real restricted legal documents; external AI calls (only a gate that refuses them is built).
- Portal-facing UI beyond what is needed to exercise auth/rights (staff-facing routes and minimal admin surface only).

## Steps

1. **ADR 0003 + docs** — Record the Phase 02 redefinition (Auth/Roles/Rights/Quarantine; Ingestion shifts later), rewrite `docs/RIGHTS_MODEL.md` around the 13 statuses with a per-status capability matrix (storage, display, search, analysis, external AI, export, print, student access), and update `docs/PHASES.md`.
2. **Schema & migration** — Extend `research_users` with the 8-role vocabulary and authentication linkage; extend `research_rights_records` with the 17 required fields (append-only); migrate the 4 legacy rights statuses to the new vocabulary via psql-applied additive SQL with a recorded reversible mapping; keep the UNREVIEWED insert-time lock. Test both applying the migration and booting the app against the migrated database.
3. **Access-decision layer** — A pure, exhaustively-tested `decideAccess({role, rightsStatus, processingState, action})` function returning allow/deny with a structured reason; deny-by-default; rights status always caps role permissions; golden-pinned decision matrix.
4. **Authentication & role wiring** — Authenticate research users (building on the existing staff gate) and resolve their research role per request; unauthenticated requests see nothing protected; wire `decideAccess` into every research route and into job processing (processors re-check rights before touching content, per the existing enforcement rules).
5. **Quarantine & gate enforcement** — Enforce quarantine visibility rules; a search-listing gate that excludes quarantined/restricted containers; an external-processing/AI submission gate that structurally refuses EXTERNAL_AI_RESTRICTED / DO_NOT_PROCESS sources; no public-URL sharing; export requires recorded approval.
6. **Rights-review workflow** — Endpoints for rights reviewers/administrators to record a full rights decision (all 17 fields), which appends a rights record, updates the container mirror, and writes the audit event and transformation atomically; expiry dates and DO_NOT_RETAIN feed the container state machine (existing DELETION_PENDING path).
7. **Tests & close-out** — The 6 mandated proof tests plus exhaustive decision-matrix tests (synthetic fixtures only, isolated test schema); browser e2e extending the existing Playwright smoke for the unauthenticated-denial case; format/lint/typecheck/unit/integration/e2e all green; completion report + `current-phase.json`; architect security review.

Critical constraints: never weaken an existing control; no mocks in production code; no hard-coded success; deny-by-default everywhere; psql migrations only (never drizzle push); zod/v4 + req.log/logger conventions.

## Relevant files

- `lib/db/src/schema/research.ts`
- `lib/db/sql/research-schema.sql`
- `lib/db/sql/migrations/0002-phase01-core-architecture.sql`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/testing/testDb.ts`
- `artifacts/api-server/src/research/testing/fixtureFactory.ts`
- `artifacts/api-server/e2e/research-smoke.spec.ts`
- `docs/RIGHTS_MODEL.md`
- `docs/PHASES.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-01-completion.md`

---

## 55. Phase 03: Secure upload, container inventory & failure isolation

Source: .local/tasks/task-38.md

---
title: Phase 03: Secure upload, container inventory & failure isolation
---
# Phase 03: Secure Upload, Container Inventory & Failure Isolation

## What & Why
Implement Phase 03 (Ingestion) of the Judgment Research Platform: secure upload of individual files, multiple files, folder uploads (as multi-file batches), and ZIP archives. Every accepted upload becomes a `source_container` — never automatically a case (source-container principle). Includes hostile-input validation, full provenance, a non-destructive inventory/triage pass with diagnostic classifications, and batch processing where one failed file never terminates the batch. All work stays behind the Phase 02 auth/roles/rights gates, follows `docs/BUILD_PROMPT.md`, and ends with `docs/reports/phase-03-completion.md` plus an updated `docs/status/current-phase.json`.

## Done looks like
- Authorized staff (roles permitted to upload) can submit single files, multiple files, or ZIP archives; each accepted file becomes an `UNREVIEWED` source container with the original bytes stored unchanged in private object storage.
- Supported formats: PDF, DOCX, RTF, HTML, TXT, PNG, JPG, TIFF, and ZIP containing supported files.
- Uploads are validated: MIME type, extension, file signature (magic bytes), size limits, archive structure, expansion ratio, nested-archive depth, unsafe/duplicate paths, executable masquerading, corrupted content. Malicious archives (ZIP bombs, path traversal, disguised executables) are rejected with recorded reasons.
- Every container records full provenance: internal ID, original filename, byte size, MIME type, SHA-256, uploader, upload time, declared source, rights status (UNREVIEWED), storage locator, processing status.
- Duplicate uploads (same SHA-256) are detected and flagged, not silently re-ingested.
- An inventory job produces per-container diagnostics: file type, page count where available, text vs scan, probable OCR requirement, probable case-title-region count, repeated header/footer patterns, possible commercial-source markers, blank/unreadable/damaged pages, probable multi-case status — plus one diagnostic label from EMPTY_OR_INVALID / SINGLE_CASE_POSSIBLE / MULTI_CASE_POSSIBLE / MIXED_CONTENT_POSSIBLE / OCR_REQUIRED / MANUAL_INSPECTION_REQUIRED. Labels are diagnostic, never final findings; no case records are created.
- Batch ingestion isolates failures: a failed file is dead-lettered with a per-file error report while the rest of the batch completes; jobs support progress, retry, cancellation, restart, and dead-letter status (extending the existing resumable job runner).
- Synthetic fixtures exist for: one-case, five-case, thirty-case containers, blank pages, corrupt pages, repeated pages, nested ZIPs, unsafe ZIP paths, misleading filenames. No real restricted documents are used.
- All existing 89 tests remain green; new validation/ingestion/inventory tests pass; full typecheck passes; completion report written with PASS/PARTIAL/BLOCKED status and the PHASE:/STATUS:/CHECKPOINT: response format.

## Out of scope
- Text extraction/OCR execution and character-level span provenance (Phase 04) — inventory only estimates OCR need.
- Case-candidate segmentation and case creation (Phase 05).
- Duplicate/version consolidation (Phase 06).
- Search, research UI beyond a minimal upload/queue surface, and any AI processing (Phases 07–08). External AI remains disabled.
- Sending any document to an external service.

## Steps
1. **Decision record & schema** — Write ADR 0004 for the ingestion design; extend the DB schema (upload batches, batch items with per-file status/error, container inventory results, dead-letter fields as needed) via an additive migration; test applying the migration and booting against the migrated database.
2. **Validation core** — Build a pure, well-tested validation module: magic-byte/extension/MIME agreement, size caps, ZIP safety (expansion ratio, nesting depth, path traversal, duplicate paths, executable detection), and corruption checks; every rejection carries a machine-readable reason.
3. **Upload & registration endpoints** — Role-gated upload routes for single/multi-file and ZIP submission that stage original bytes byte-for-byte to private object storage, compute SHA-256, detect duplicates, and register UNREVIEWED containers with full provenance; deny-by-default access rules from Phase 02 apply (per-container checks, 404-not-403, restriction-aware filters).
4. **Batch jobs with failure isolation** — Ingestion and inventory run through the existing resumable job runner, extended with batch progress, per-item retry, cancellation, restart, and dead-letter status; a content-touching job without rights clearance still fails closed.
5. **Inventory analyzer** — Non-destructive per-container inventory (format probing, page counts, text-vs-scan heuristics, header/footer repetition, commercial-source markers, blank/damaged page detection) producing the six diagnostic labels; results stored with provenance, never mutating the original file.
6. **Fixtures & tests** — Generate the required synthetic fixture set (including hostile ZIPs built programmatically in tests, not committed as binaries where avoidable); add unit + integration tests covering every acceptance criterion; run the full api-tests suite and typecheck.
7. **Minimal review-queue surface & close-out** — Expose container/batch listing for the rights-review queue via existing role-gated routes; browser-test any UI touched; write `docs/reports/phase-03-completion.md`, update `docs/status/current-phase.json`, and finish with architect review and the required response format.

Note: preserve all Phase 02 invariants — deny-by-default access, absolute rights-status caps, append-only audit, fail-closed processors, and no mock implementations in production code.

## Relevant files
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/data/containers.ts`
- `artifacts/api-server/src/research/storage/objectStorageAdapter.ts`
- `artifacts/api-server/src/research/testing/fixtureFactory.ts`
- `lib/db/src/schema/research.ts:118-141`
- `docs/PHASES.md`
- `docs/BUILD_PROMPT.md`
- `docs/status/current-phase.json`
- `fixtures/synthetic`

---

## 56. Phase 04: Page-level extraction & OCR adapters

Source: .local/tasks/task-42.md

---
title: Phase 04: Page-level extraction & OCR adapters
---
# Phase 04: Page-Level Extraction & OCR Adapters

## What & Why
Implement Phase 04 (Extraction) of the Judgment Research Platform: page-level text extraction from ingested source containers, with the source page as the smallest immutable provenance unit. Extraction runs behind four separately replaceable adapters (native text extraction, page-image rendering, OCR, layout analysis) so the platform is never coupled to one OCR engine. Follow docs/BUILD_PROMPT.md: read charter/architecture/phase docs first; phase-scope-only; synthetic fixtures only; no external AI services.

## Done looks like
- Every ingested document can be extracted into immutable page records with full provenance (container → page → block → character offsets, coordinates where the format supports them)
- Native-text pages capture page number, text blocks, reading order, bounding boxes/font/style metadata where available, header/footer/column detection, and character offsets
- Scanned pages capture the original page image, OCR text, confidence data, text-region coordinates, rotation, language indication, and processing warnings
- Uncertainty is stored as structured warning codes (ILLEGIBLE_REGION, LOW_OCR_CONFIDENCE, POSSIBLE_MISSING_TEXT, READING_ORDER_UNCERTAIN, PAGE_ROTATION_UNCERTAIN, LANGUAGE_UNCERTAIN) with source coordinates — never guessed replacement text; display may render a visible marker but the record preserves the warning
- A page-review interface shows original page, extracted text, detected blocks, OCR warnings, reviewer corrections, and correction history; corrections never overwrite raw extraction and store raw output, corrected output, reviewer, reason, date, and processor version
- Low-quality pages automatically enter the review queue
- A benchmark of safe (local, no-external-AI) OCR options against synthetic fixtures is run and recorded before the initial OCR adapter is selected, with the choice documented in a decision record
- All tests green (existing 125 preserved), typecheck clean, completion report in docs/reports/ and docs/status/current-phase.json updated

## Out of scope
- Case-candidate segmentation (Phase 05), consolidation (Phase 06), search UI (Phase 07), AI aids (Phase 08)
- Sending any document content to external AI/OCR services
- Processing real restricted legal documents (synthetic fixtures only)

## Steps
1. **ADR + schema** — Decision record for the extraction architecture; new `research_*` tables for pages, page images, text blocks, extraction runs (processor version, adapter identity, checksums), warnings, and page corrections (append-only version history); migration tested for apply + boot.
2. **Adapter contracts** — Extend the adapter registry with four independent interfaces: native text extractor, page-image renderer, OCR engine, layout analyzer; each versioned, disable-safe (unconfigured adapter routes work to human review, never fakes output).
3. **OCR benchmark** — Evaluate available safe local OCR options (e.g. Tesseract-based engines runnable in this environment) against synthetic scanned fixtures; record accuracy/confidence/rotation handling results in a benchmark report and select the initial adapter via the ADR.
4. **Extraction pipeline** — Resumable, idempotent extraction jobs per container: detect native-text vs scanned pages, run the appropriate adapter chain, persist immutable page records with provenance and structured warnings, route low-quality pages to review, respect rights gating (fail closed).
5. **Page-review interface** — Staff-only review screens showing original page image, extracted text, detected blocks, warnings, and correction history; corrections stored as new versions alongside untouched raw output, with atomic audit events.
6. **Fixtures + tests** — New synthetic fixtures: clean native text, two-column text, rotated scans, faint scans, page numbers, repeated headers, footnotes, tables, mixed languages, blank pages; tests covering traceability, raw-output preservation, correction versioning, review routing, and no-silent-guessing; browser-based testing of the review UI.
7. **Close-out** — Formatting/typecheck/full test run; completion report in docs/reports/; update docs/status/current-phase.json to Phase 05 next.

Note: critical architectural constraints — the source page is immutable once extracted; corrections are append-only versions; uncertainty is preserved as structured warnings with coordinates, never replaced with guessed text; all four adapters must remain independently swappable.

## Relevant files
- `docs/BUILD_PROMPT.md`
- `docs/PHASES.md`
- `docs/ARCHITECTURE.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-03-completion.md`
- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/ingestion/service.ts`
- `artifacts/api-server/src/research/storage/objectStorageAdapter.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `lib/db/src/schema/research.ts`
- `fixtures/synthetic/README.md`

---

## 57. Phase 05: Multi-Case Segmentation Engine

Source: .local/tasks/task-46.md

# Phase 05: Multi-Case Segmentation Engine

## What & Why

The extraction phase left every ingested container as a flat sequence of
pages and text blocks. Phase 05 adds deterministic case-boundary detection:
a segmentation processor scans the extracted blocks for 24 independently
weighted signal types, scores the evidence at every candidate boundary
location, classifies each location into one of five strength tiers, and
proposes zero, one, or many case candidates per container — never declaring
a verified case. Uncertain or conflicting boundaries route to human review.
No AI, no guessing, full provenance.

## Done looks like

- `POST /api/research/containers/:id/segmentation` starts a background
  `container.segment` job; container moves `TEXT_EXTRACTED →
  SEGMENTATION_PENDING` (rights-gated, idempotent).
- After the job runs, every proposed candidate is stored with its start
  boundary, end boundary, all detected signals, composite score, strength
  classification, and review status.
- Containers with only `STRONG_BOUNDARY_CANDIDATE` or
  `MODERATE_BOUNDARY_CANDIDATE` boundaries (no conflicts, no uncertain
  signals) move to `SEGMENTATION_PROPOSED`; all others move to
  `SEGMENTATION_REVIEW_REQUIRED`.
- A container with zero extractable content (no judgments) produces zero
  candidates and moves to `SEGMENTATION_PROPOSED` — the "no judgment"
  outcome is explicit, not a failure.
- A server-rendered segmentation review UI at
  `GET /api/research/containers/:id/segmentation-review` lists candidates,
  boundaries, signal evidence, and a review decision form.
- All 10 golden fixtures pass their `.expected.json` acceptance gates
  (true starts detected, true ends detected, no incorrect auto-approval,
  all pages classified).
- Full api-server test suite green; `pnpm run typecheck` clean.
- Completion report written; `current-phase.json` updated to phase 05
  complete / next phase 06.

## Out of scope

- Merging candidates into verified cases (Phase 06 Consolidation).
- Cross-file candidate spans (designed for but not implemented this phase).
- Publisher/editorial content screening (Phase 06).
- Search indexing, AI aids (Phases 07–08).
- Uniform disable-safe routing for non-OCR adapters (documented Phase 04
  limitation; still deferred).

## Steps

### 1. ADR 0006 + schema migration

Write `docs/decisions/0006-phase-05-segmentation.md` documenting the
signal vocabulary, the five strength tiers, the scoring rules (additive
weighted integer score, documented thresholds, explicitly NOT a
probability), and the multi-table schema design. Then author additive
migration `lib/db/sql/migrations/0007-phase05-segmentation.sql` adding:

- **`research_segmentation_runs`** — one row per `container.segment` job
  attempt (container id, job id, processor version, adapter identity,
  status, created/finished timestamps). Unique on `(container_id,
  run_key)` where run key is `segment-<sha16>-<version>-j<job_id>`.
- **`research_boundary_signals`** — one row per detected signal instance:
  `(run_id, page_id, block_id nullable, signal_type, signal_value,
  supporting_text, score_contribution integer, processor_version)`.
  `signal_type` is a checked enum of the 24 types. Index on
  `(run_id, page_id)`.
- **`research_case_boundaries`** — one row per proposed boundary location:
  `(run_id, page_id, block_id nullable, boundary_role TEXT — "start" |
  "end", strength TEXT — five tiers, composite_score integer, conflicting
  signal_count integer, review_status TEXT — "auto_accepted" |
  "review_required" | "reviewed" | "rejected", reviewed_by nullable,
  reviewed_at nullable)`. A boundary is `auto_accepted` only when strength
  is `STRONG_BOUNDARY_CANDIDATE` with no conflicting signals.
- **`research_case_candidate_boundaries`** join table — links a candidate
  row to its start boundary and end boundary (both `research_case_boundaries`
  ids). One candidate has exactly one start and one end boundary.
- Augment the existing **`research_case_candidates`** table with columns:
  `run_id` (FK → `research_segmentation_runs`), `strength TEXT`,
  `page_count integer`, `review_status TEXT`, `reviewed_by nullable`,
  `reviewed_at nullable`. The old `spans`/`detail` JSONB columns are kept
  for backward compatibility but the new schema is canonical. Add
  `uniqueIndex` on `(run_id, start_boundary_id)`.
- Widen `research_audit_events.entity_type` enum to include
  `"segmentation_run"` and `"case_candidate"`.

Update `lib/db/src/schema/research.ts` with typed Drizzle table definitions.
Run `pnpm --filter @workspace/db run push` to apply.

### 2. Signal detector (pure function, independently testable)

Create `artifacts/api-server/src/research/segmentation/signalDetector.ts`.

Implement a pure `detectSignals(pages, blocks) → DetectedSignal[]` function
that scans extracted page/block records and emits one `DetectedSignal`
record per matched signal instance. Implement all 24 signal types:

| # | Signal type constant | Detection method |
|---|---|---|
| 1 | `NEW_CASE_TITLE` | Regex: known title patterns (`[YEAR] court-ref [N]`, `[N] MLJ`, etc.) |
| 2 | `NEW_PARTY_CONFIGURATION` | `v.` / `lwn.` between title-case noun phrases |
| 3 | `NEUTRAL_CITATION` | `[YEAR] court-code N` pattern |
| 4 | `REPORT_CITATION` | `[YEAR] N MLJ N`, `N CLJ N`, `N AMR N`, etc. |
| 5 | `COURT_HEADING` | Known court names as block headings |
| 6 | `PROCEEDING_NUMBER` | `Guaman Sivil`, `Kes No`, `Civil Suit`, `Criminal Appeal`, etc. |
| 7 | `CORAM_HEADING` | "Coram:", "Presided by:", "Before:" |
| 8 | `JUDGE_HEADING` | `JC`, `J`, `FCJ`, `CJ` suffix in heading context |
| 9 | `DECISION_DATE` | Date in heading or near judgment text |
| 10 | `JUDGMENT_HEADING` | "Judgment", "Penghakiman", "Award", section heading |
| 11 | `PARAGRAPH_RESET` | Paragraph numbers restart from 1 or \[1\] |
| 12 | `PAGE_NUMBER_RESTART` | Page footer/header number resets to 1 |
| 13 | `CLOSING_ORDER` | "IT IS ORDERED", "DIPERINTAHKAN", "dismissed with costs" |
| 14 | `JUDICIAL_SIGNATURE` | "Signed:", "Sgd:", judge name + date block |
| 15 | `ABRUPT_METADATA_CHANGE` | Block-level metadata field (court, year) changes sharply |
| 16 | `ABRUPT_SEMANTIC_CHANGE` | Cosine distance heuristic across adjacent blocks (no AI) |
| 17 | `TYPOGRAPHY_CHANGE` | Font size / style change detected in block metadata |
| 18 | `PUBLISHER_DIVIDER` | Repeated horizontal rule / asterisk / em-dash divider |
| 19 | `BLANK_DIVIDER_PAGE` | Page with zero text blocks or only whitespace |
| 20 | `REPEATED_TITLE_IN_QUOTATION` | Same title text found inside a quotation block (anti-signal) |
| 21 | `ADMINISTRATIVE_MATERIAL` | Index / table-of-contents / cause list page patterns |
| 22 | `INCOMPLETE_CASE_END` | File ends without a closing order or signature |
| 23 | `MULTI_PAGE_GAP` | Page number jump (≥3 pages) suggesting missing pages |
| 24 | `PUBLISHER_ATTRIBUTION` | Publisher name/address/copyright block (editorial material) |

Each `DetectedSignal` carries: `pageId`, `blockId?`, `signalType`,
`signalValue` (matched text or metric), `supportingText` (surrounding
context), `scoreContribution` (positive = boundary evidence; negative =
anti-signal e.g. `REPEATED_TITLE_IN_QUOTATION`), `processorVersion`.

Document scoring weights in the ADR and in a co-located
`SCORING_RULES.md`. The score is a **deterministic integer** — document
it explicitly as not a calibrated probability.

### 3. Candidate composer (boundary scoring + classification)

Create `artifacts/api-server/src/research/segmentation/candidateComposer.ts`.

Implement `composeCandidate(signals: DetectedSignal[], pageRange) →
BoundaryProposal`:

- **Aggregate** signals by page location into per-page scores.
- **Classify** each candidate boundary location:
  - `STRONG_BOUNDARY_CANDIDATE` — score ≥ `STRONG_THRESHOLD` (documented),
    no conflicting signals.
  - `MODERATE_BOUNDARY_CANDIDATE` — score ≥ `MODERATE_THRESHOLD`, ≤ 1
    conflicting signal.
  - `WEAK_BOUNDARY_CANDIDATE` — score ≥ `WEAK_THRESHOLD`, ≤ 2 conflicting
    signals. **Cannot be auto-accepted.**
  - `CONFLICTING_BOUNDARY` — conflicting signals exceed 2 or score is
    positive but conflicting signals exceed positive signals. Routes to
    review.
  - `NO_BOUNDARY` — score below `WEAK_THRESHOLD`. Not recorded as a
    boundary row.
- **Enforce**: a boundary proposal requires at least two independent signals
  OR one strong signal above a higher threshold. A single weak signal alone
  produces `NO_BOUNDARY`.
- For every container, **all source pages must be classified**: pages covered
  by a candidate span are assigned to that candidate; pages between
  candidates or at the start/end with no signals are recorded as
  `unassigned_pages` in the run record (not silently dropped).
- The function is a pure TypeScript function; no DB calls. Fully testable
  without a database.

### 4. Segmentation pipeline processor

Create `artifacts/api-server/src/research/segmentation/pipeline.ts`.

Register a `container.segment` processor:

- **Rights gate**: fail-closed — abort if container's `rights_status` is
  not `RIGHTS_APPROVED`.
- **Input**: fetch all `research_source_pages` + `research_text_blocks` +
  `research_page_extractions` for the container from the latest extraction
  run.
- **Run identity**: `segment-<sha16(content_sha256)>-<SEGMENT_VERSION>-j<job.id>`
  — each job attempt owns a fresh segmentation run (same pattern as Phase
  04 extraction run identity). Mid-run retries reuse the same job row and
  resume the same run.
- **Idempotent outputs**: signals and boundaries are inserted with
  `ON CONFLICT DO NOTHING` keyed on `(run_id, page_id, signal_type,
  signal_value)` for signals and `(run_id, page_id, boundary_role)` for
  boundaries.
- **Signal detection**: call `detectSignals()`.
- **Candidate composition**: call `composeCandidate()` for each proposed
  span. Insert `research_segmentation_runs`, `research_boundary_signals`,
  `research_case_boundaries`, and `research_case_candidates` rows.
- **Unassigned page recording**: pages not covered by any candidate span
  are recorded in `research_segmentation_runs.detail` JSONB as
  `unassigned_pages: number[]`.
- **Review routing**: if any boundary is `WEAK_BOUNDARY_CANDIDATE` or
  `CONFLICTING_BOUNDARY`, raise `ReviewRequiredSignal` (→
  `SEGMENTATION_REVIEW_REQUIRED`) with a structured reason listing boundary
  ids. Otherwise transition to `SEGMENTATION_PROPOSED`.
- **Zero-candidate case**: a container that yields no boundaries transitions
  to `SEGMENTATION_PROPOSED` with an empty candidates list — not a failure
  and not review-required.
- **Audit**: every candidate insert fires an audit event
  `(entity_type: "case_candidate", kind: "proposed")` in the same
  transaction.
- **Transformation record**: the segmentation run records a
  `research_transformations` row `(kind: "segmentation", description:
  "Proposed N case candidates from M pages")`.

### 5. Routes + segmentation review UI

Add staff-only routes under `artifacts/api-server/src/research/routes/segmentation.ts`:

- `POST /api/research/containers/:id/segmentation` — enqueue
  `container.segment` job, respond 202 with `{ jobId }`.  Requires container
  to be in `TEXT_EXTRACTED` or `SEGMENTATION_REVIEW_REQUIRED`.
- `GET /api/research/containers/:id/candidates` — list all candidates for the
  container with strength, score, page range, and review status.
- `GET /api/research/containers/:id/candidates/:candidateId` — full candidate
  detail: boundaries, all detected signals (with supporting text), conflicting
  signals, unassigned pages in run.
- `GET /api/research/containers/:id/segmentation-review` — server-rendered
  HTML staff review UI showing the candidate list, per-candidate boundary
  evidence, signal table, and a review decision form.
- `POST /api/research/containers/:id/candidates/:candidateId/review` — staff
  accept/reject/flag decision (append-only, atomic audit event; no candidate
  row mutation — status updated only on the `review_status` column, raw
  signal/boundary records never overwritten).

All routes: deny-by-default (Clerk staff role); 403 for unauthenticated.
Register routes in `artifacts/api-server/src/research/routes/index.ts`.

### 6. Golden fixtures + acceptance tests

**Fixtures** in `fixtures/synthetic/segmentation/` — ten deterministic plain-text
files generated by a script
`artifacts/api-server/scripts/generate-segmentation-fixtures.ts`, each with a
corresponding `<name>.expected.json`. The ten fixtures:

| File | Content |
|---|---|
| `single-case.txt` | One judgment, clean signals |
| `two-case.txt` | Two judgments with a publisher divider |
| `ten-case.txt` | Ten judgments, mixed signal density |
| `thirty-case.txt` | Thirty judgments (stress test) |
| `admin-between-cases.txt` | Administrative/cause-list pages between two judgments |
| `quoted-titles.txt` | Repeated case titles inside cited quotations |
| `no-neutral-citation.txt` | Judgments identified only by parties + court |
| `page-restart.txt` | Page number restarts mid-file (two booklets bound together) |
| `incomplete-final-case.txt` | Last judgment has no closing order or signature |
| `no-judgment.txt` | Administrative/index document only |

Each `.expected.json` specifies:
```json
{
  "candidateCount": N,
  "candidates": [
    {
      "startPage": N, "startBlock": N,
      "endPage": N, "endBlock": N,
      "reviewRequired": bool,
      "startStrength": "STRONG_BOUNDARY_CANDIDATE | ...",
      "endStrength": "..."
    }
  ],
  "unassignedPages": [...],
  "nonCaseMaterialPages": [...]
}
```

**`phase05.test.ts`** (alongside existing phase test files):

- One test per golden fixture: run the full pipeline against a seeded
  container, drain the job queue, compare output against `.expected.json`.
- Explicit acceptance-gate tests:
  - All true case starts detected.
  - All true case ends detected.
  - No `WEAK_BOUNDARY_CANDIDATE` or `CONFLICTING_BOUNDARY` boundary is
    `auto_accepted`.
  - No source page disappears (page count in = page count classified + unassigned).
  - `no-judgment.txt`: zero candidates, state `SEGMENTATION_PROPOSED`, no
    review required.
  - `quoted-titles.txt`: repeated titles inside quotations do NOT generate
    spurious candidates (anti-signal test).
  - `incomplete-final-case.txt`: incomplete boundary routes to review.
  - Re-run from `SEGMENTATION_REVIEW_REQUIRED` creates a fresh run (same
    per-job-attempt key pattern as Phase 04).
  - Idempotency: re-running on an already-`SEGMENTATION_PROPOSED` container
    is refused with `INVALID_STATE`.
  - Staff routes: 202 start, 200 list, 200 detail, 403 unauthenticated,
    200 review UI HTML.
  - Review submission: decision recorded with audit event; raw signals/
    boundaries unchanged.

All pre-existing tests must remain passing.

### 7. Close-out

Following `docs/BUILD_PROMPT.md`:

- Run full check: `pnpm run typecheck`, `pnpm --filter @workspace/api-server run test`.
- Browser-test the segmentation review UI with a real Clerk-authenticated
  staff session: navigate to review UI, verify candidate list and signal
  evidence, submit a review decision, confirm audit event created.
- Write `docs/reports/phase-05-completion.md` (all BUILD_PROMPT sections).
- Update `docs/status/current-phase.json` → phase 05 complete, next 06
  Consolidation.
- Respond with `PHASE: / STATUS: / CHECKPOINT:` structure per
  `docs/BUILD_PROMPT.md`.

## Relevant files

- `docs/BUILD_PROMPT.md`
- `docs/PHASES.md`
- `docs/PROCESSING_STATES.md`
- `docs/ARCHITECTURE.md`
- `docs/PROJECT_CHARTER.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-04-completion.md`
- `docs/decisions/0005-phase-04-extraction.md`
- `lib/db/src/schema/research.ts`
- `lib/db/sql/migrations/0006-phase04-extraction.sql`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/extraction/pipeline.ts`
- `artifacts/api-server/src/research/routes/extraction.ts`
- `artifacts/api-server/src/research/routes/reviewUi.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/testing/testDb.ts`
- `artifacts/api-server/src/research/phase04.test.ts`
- `fixtures/synthetic/single-judgment.txt`
- `fixtures/synthetic/thirty-case.txt`
- `fixtures/synthetic/repeated-headers.txt`
- `fixtures/synthetic/blank-pages.txt`
- `fixtures/synthetic/empty-container.txt`


---

## 58. Phase 06: Segmentation Validation, Human Review & Cross-File Reconstruction

Source: .local/tasks/task-49.md

---
title: Phase 06: Segmentation Validation, Human Review & Cross-File Reconstruction
---
# Phase 06: Segmentation Validation, Human Review & Cross-File Reconstruction

## What & Why

Phase 05 produced case-candidate proposals with boundary strength scores.
Phase 06 adds three layers on top of that:

1. **Coherence & contradiction checks** — Automated structural analysis of
   each candidate evaluating nine coherence dimensions and nine contradiction
   types. Candidates with contradictions route to review; clean candidates
   advance to `EDITORIAL_REVIEW_PENDING`.

2. **Human-review interface** — A full reviewer surface with eleven
   audited actions (move boundary, split, merge, mark non-case / incomplete,
   approve, reject, request reprocessing, etc.). Every action is an
   append-only transformation row with an atomic audit event.

3. **Cross-file relationship detection and reconstruction** — Detect and
   record the eight cross-file relationship types between candidates across
   containers (continuation, duplicate, version, related appeal). A
   confirmed cross-file merge requires explicit human approval; no automatic
   merges where material differences exist.

This phase corresponds to Phase 06 "Consolidation" in `docs/PHASES.md`.

## Done looks like

- A `container.validate` job runs automatically after segmentation
  (`SEGMENTATION_PROPOSED` → `SEGMENTATION_PENDING` → re-enters validation).
  Every candidate receives a structured coherence result record with pass/fail
  per check.
- Candidates with any `CONTRADICTION` result route to
  `SEGMENTATION_REVIEW_REQUIRED`; clean candidates advance their container
  to `EDITORIAL_REVIEW_PENDING`.
- A reviewer can exercise all eleven review actions from the segmentation
  review UI; every action is recorded in `research_candidate_review_actions`
  and `research_audit_events` in the same transaction.
- Boundary moves, splits, and merges are stored as new candidate records
  (with lineage pointers to the original), never as overwrites.
- Cross-file relationships are stored in `research_cross_file_relationships`
  with provenance and evidence. `CONFIRMED_CONTINUATION` and cross-file
  merges are gated on human approval.
- A reviewer can assemble one case from spans across multiple containers by
  linking confirmed continuations, producing a `research_cross_file_spans`
  record.
- All seven synthetic cross-file test scenarios pass their acceptance gates.
- Full api-server suite green; `pnpm run typecheck` clean.
- Completion report and updated `current-phase.json` (phase 06 complete,
  next 07 Search).

## Out of scope

- Publisher/editorial material isolation enforcement beyond flagging
  (deferred to the editorial-review path that already exists in the state
  machine).
- Search indexing (Phase 07).
- AI aids (Phase 08).
- Verified-case creation (that is the human act in
  `JUDGMENT_VERIFICATION_PENDING`; this phase only prepares candidates for
  it).

## Steps

### 1. ADR 0007 + schema migration

Write `docs/decisions/0007-phase-06-validation-review-cross-file.md`
documenting the coherence check vocabulary, the reviewer action model,
the cross-file relationship types, and the database design.

Author additive migration `lib/db/sql/migrations/0009-phase06-validation.sql`
adding:

**`research_candidate_coherence_checks`** — one row per check per
candidate per validation run:
- `candidate_id` FK → `research_case_candidates`
- `validation_run_id` FK → new `research_validation_runs` table
- `check_type TEXT` — one of the 18 check constants (9 coherence +
  9 contradiction; see Step 2)
- `result TEXT` — `PASS | FAIL | UNCERTAIN | NOT_APPLICABLE`
- `detail JSONB` — structured evidence (which pages, which blocks,
  what was found)
- `processor_version TEXT`
- `created_at TIMESTAMPTZ`
- Unique on `(validation_run_id, candidate_id, check_type)`.

**`research_validation_runs`** — one row per `container.validate` job
attempt:
- `container_id`, `job_id`, `run_key`, `processor_version`,
  `status TEXT` (RUNNING | COMPLETE | REVIEW_REQUIRED),
  `created_at`, `finished_at`.
- Unique on `(container_id, run_key)`.

**`research_candidate_review_actions`** — append-only log of all
reviewer actions on a candidate:
- `id SERIAL PRIMARY KEY`
- `candidate_id` FK → `research_case_candidates`
- `action_type TEXT` — one of eleven constants:
  `MOVE_BOUNDARY | SPLIT | MERGE | MARK_NON_CASE | MARK_INCOMPLETE |
   APPROVE | REJECT | REQUEST_REPROCESSING | LINK_CONTINUATION |
   LINK_DUPLICATE | LINK_RELATED`
- `actor TEXT` — reviewer identity
- `detail JSONB` — action-specific payload (e.g. new page for
  MOVE_BOUNDARY; target candidate id for MERGE; relationship type for
  LINK_*)
- `transformation_id` FK → `research_transformations` (every action
  creates a transformation row)
- `created_at TIMESTAMPTZ`
- Index on `(candidate_id, created_at)`.

**`research_cross_file_relationships`** — declared relationships between
candidates across containers:
- `id SERIAL PRIMARY KEY`
- `source_candidate_id` FK → `research_case_candidates`
- `target_candidate_id` FK → `research_case_candidates`
- `relationship_type TEXT` — one of eight constants:
  `POSSIBLE_CONTINUATION | CONFIRMED_CONTINUATION |
   POSSIBLE_DUPLICATE | EXACT_DUPLICATE |
   ALTERNATIVE_VERSION | CORRECTED_VERSION |
   RELATED_APPEAL | UNRELATED`
- `evidence JSONB` — detected signals supporting the relationship
- `confirmed_by TEXT nullable` — populated only when a human confirms
- `confirmed_at TIMESTAMPTZ nullable`
- `created_at TIMESTAMPTZ`
- Unique on `(source_candidate_id, target_candidate_id,
  relationship_type)`.

**`research_cross_file_spans`** — multi-container span assembly for a
single logical case (requires human approval to create):
- `id SERIAL PRIMARY KEY`
- `created_by TEXT` — reviewer who assembled the span
- `approved_by TEXT nullable`
- `approved_at TIMESTAMPTZ nullable`
- `status TEXT` — `PROPOSED | APPROVED | REJECTED`
- `created_at TIMESTAMPTZ`

**`research_cross_file_span_segments`** — ordered segments of a
cross-file span:
- `span_id` FK → `research_cross_file_spans`
- `candidate_id` FK → `research_case_candidates`
- `segment_order INTEGER` — 1-based ordering within the span
- Unique on `(span_id, candidate_id)`.

Update `lib/db/src/schema/research.ts` with typed Drizzle table
definitions. Run `pnpm --filter @workspace/db run push`.

### 2. Coherence & contradiction checker (pure functions)

Create `artifacts/api-server/src/research/validation/coherenceChecker.ts`.

Implement a pure `checkCoherence(candidate, pages, blocks) →
CoherenceResult[]` function. The eighteen check types:

**Coherence checks (all must pass for a candidate to auto-advance):**

| Constant | Tests for |
|---|---|
| `COHERENT_CASE_IDENTITY` | Consistent case title / citation across the span |
| `COHERENT_COURT` | Same court name throughout |
| `COHERENT_PARTIES` | Party names consistent (not unrelated changes) |
| `COHERENT_CITATION` | One primary citation (neutral or report) |
| `COHERENT_JUDGE` | Same coram / judge throughout |
| `COHERENT_NARRATIVE` | Procedural text follows a recognisable judgment arc |
| `COHERENT_PARAGRAPHS` | Paragraph sequence is monotonically increasing |
| `COHERENT_DISPUTE` | Substantive dispute is present and of one type |
| `COHERENT_CONCLUSION` | A dispositive conclusion is present |

**Contradiction checks (any FAIL routes to review):**

| Constant | Flags when |
|---|---|
| `NO_MIXED_COURTS` | Different court names appear inside one segment |
| `NO_UNRELATED_PARTY_CHANGE` | Party names change to completely unrelated names mid-span |
| `NO_MULTIPLE_DECISIONS` | Two independent dispositive orders exist in one span |
| `NO_REPEATED_ENDINGS` | Closing order / judicial signature appears more than once |
| `NO_NEW_PROCEEDING_MID_SPAN` | New proceeding number begins inside the span |
| `HAS_BEGINNING` | The span's start page carries case-start signals |
| `HAS_ENDING` | The span's end page carries case-end signals (or flagged incomplete) |
| `SEQUENTIAL_PARAGRAPHS` | No paragraph-number discontinuity ≥ 10 |
| `NO_SOURCE_PAGE_GAP` | No gap in `page_number` sequence within the candidate's pages |

Each `CoherenceResult` carries: `checkType`, `result` (`PASS | FAIL |
UNCERTAIN | NOT_APPLICABLE`), `detail` (evidence pages, blocks, found
values), `processorVersion`.

A result of `UNCERTAIN` routes to review. `NOT_APPLICABLE` is used when
the check cannot run (e.g. `COHERENT_CITATION` on a candidate from a file
with no detectable citations).

All functions are pure TypeScript — no DB calls — so they can be tested
in isolation without a database.

### 3. Cross-file relationship detector (pure function)

Create
`artifacts/api-server/src/research/validation/crossFileDetector.ts`.

Implement `detectCrossFileRelationships(candidateA, candidateB, pagesA,
pagesB, blocksA, blocksB) → CandidateRelationship | null`:

- **POSSIBLE_CONTINUATION** — `candidateA` ends without a closing order
  AND `candidateB` begins with matching parties/court but no new case
  header. Requires human confirmation.
- **CONFIRMED_CONTINUATION** — only set by human action; never auto-set.
- **POSSIBLE_DUPLICATE** — title + court + date overlap ≥ 80% textual
  similarity (Jaccard on tokens). Requires human confirmation.
- **EXACT_DUPLICATE** — content sha-256 of extracted text matches.
  Auto-proposed; human confirms.
- **ALTERNATIVE_VERSION** — same citation, materially different text
  (edit distance > 10%). Auto-proposed.
- **CORRECTED_VERSION** — same citation, one candidate has a correction
  annotation referencing the other. Human decision.
- **RELATED_APPEAL** — one candidate's text references the other's
  citation as the lower-court decision. Auto-proposed.
- **UNRELATED** — explicit human declaration that two candidates are
  not related (used to close false positives).

The function emits a `CandidateRelationship` with `relationshipType`,
`evidence` (matching signals), `confidenceNote` (descriptive, not a
probability). Confirmed/rejected states are set only via reviewer actions
(Step 5), never by the detector.

Run detection across all candidate pairs within the same batch (same
`source_batch` field on containers). Cross-batch detection is out of
scope this phase.

### 4. Validation pipeline processor

Create `artifacts/api-server/src/research/validation/pipeline.ts`.

Register a `container.validate` processor:

- **Trigger**: fired automatically when `startValidation(containerId,
  actor)` is called. The segmentation pipeline calls `startValidation`
  at the end of a successful segmentation run (so validation starts as
  soon as candidates are proposed, without requiring a separate HTTP
  call). The state transition is `SEGMENTATION_PROPOSED →
  SEGMENTATION_PENDING` before enqueue; the processor transitions to
  `EDITORIAL_REVIEW_PENDING` on success or stays/returns to
  `SEGMENTATION_REVIEW_REQUIRED` on contradictions.
- **Rights gate**: same fail-closed pattern as prior phases.
- **Run identity**: `validate-<sha16>-<VALIDATE_VERSION>-j<job.id>`.
- **Coherence run**: for each candidate in the container, run
  `checkCoherence()`, insert `research_candidate_coherence_checks` rows
  (idempotent via `ON CONFLICT DO NOTHING`).
- **Cross-file detection**: for each pair of candidates in the same
  source batch, call `detectCrossFileRelationships()`, insert
  `research_cross_file_relationships` rows for POSSIBLE_* types
  (idempotent). Never insert CONFIRMED_* or EXACT_DUPLICATE without
  human action.
- **Review routing**: if any candidate has a `FAIL` or `UNCERTAIN`
  coherence result, raise `ReviewRequiredSignal` (→
  `SEGMENTATION_REVIEW_REQUIRED`). Otherwise transition container to
  `EDITORIAL_REVIEW_PENDING`.
- **Zero-candidate containers**: containers with zero candidates skip
  coherence checks and go directly to `EDITORIAL_REVIEW_PENDING`.
- **Transformation record**: `(kind: "validation", description:
  "Checked N candidates, F contradictions found")`.
- **Audit event**: `(entity_type: "container", event: "validation-run",
  detail: { candidateCount, failCount, uncertainCount })`.

### 5. Reviewer action endpoints

Add staff-only routes under
`artifacts/api-server/src/research/routes/candidateReview.ts`.

For each of the eleven reviewer actions, one POST endpoint. All share
the same transaction pattern: insert `research_candidate_review_actions`
row → insert `research_transformations` row → `recordAuditEvent` →
apply structural side-effect (if any) → respond 200/201.

| Endpoint | Action | Side-effect |
|---|---|---|
| `POST /candidates/:id/review/approve` | `APPROVE` | Set `review_status = 'reviewed'` on candidate and its boundaries |
| `POST /candidates/:id/review/reject` | `REJECT` | Set `review_status = 'rejected'`; record reason |
| `POST /candidates/:id/review/reprocess` | `REQUEST_REPROCESSING` | Enqueue `container.validate` job again |
| `POST /candidates/:id/review/move-boundary` | `MOVE_BOUNDARY` | Validate new page is within container; insert new `research_case_boundaries` row for the new page; update `research_case_candidate_boundaries` join; record lineage in detail |
| `POST /candidates/:id/review/split` | `SPLIT` | Validate split page; insert two new candidate rows with status `proposed` and lineage; mark original `rejected`; auto-trigger coherence checks on new candidates |
| `POST /candidates/:id/review/merge` | `MERGE` | Validate adjacency; insert one new candidate spanning both; mark both originals `rejected`; auto-trigger coherence checks; body must carry `targetCandidateId` |
| `POST /candidates/:id/review/mark-non-case` | `MARK_NON_CASE` | Set `status = 'non_case'` on candidate; record reason |
| `POST /candidates/:id/review/mark-incomplete` | `MARK_INCOMPLETE` | Set `status = 'incomplete'` on candidate; record reason |
| `POST /candidates/:id/review/link-continuation` | `LINK_CONTINUATION` | Body: `{ targetCandidateId, confirmed: bool }`. Insert/update cross-file relationship row to POSSIBLE_ or CONFIRMED_CONTINUATION. CONFIRMED requires `confirmed: true`. |
| `POST /candidates/:id/review/link-duplicate` | `LINK_DUPLICATE` | Body: `{ targetCandidateId, type: POSSIBLE_DUPLICATE | EXACT_DUPLICATE | ALTERNATIVE_VERSION | CORRECTED_VERSION }`. |
| `POST /candidates/:id/review/link-related` | `LINK_RELATED` | Body: `{ targetCandidateId, type: RELATED_APPEAL | UNRELATED }`. |

All endpoints: deny-by-default, require `legal_reviewer`, `administrator`,
or `owner` role; 403 for unauthenticated.

### 6. Cross-file span assembly endpoints

Add under `artifacts/api-server/src/research/routes/candidateReview.ts`:

- `POST /cross-file-spans` — Create a proposed span: body
  `{ candidateIds: number[], note: string }`. Validates all candidates
  exist, belong to rights-approved containers, are not already in an
  approved span. Inserts `research_cross_file_spans` (status:
  `PROPOSED`) + `research_cross_file_span_segments` ordered by
  container's original page sequence.
- `POST /cross-file-spans/:id/approve` — Approve (requires `administrator`
  or `owner`). Flips status to `APPROVED`; records audit event; inserts
  transformation row.
- `POST /cross-file-spans/:id/reject` — Flip to `REJECTED`; record reason.
- `GET /cross-file-spans` — List all spans with status, candidate ids,
  container ids.
- `GET /cross-file-spans/:id` — Full span detail: segments in order,
  candidate summaries, coherence results, relationship evidence.

### 7. Segmentation review UI — extended

Extend the existing server-rendered review UI
(`artifacts/api-server/src/research/routes/reviewUi.ts` or a new
`segmentationReviewUi.ts`) at
`GET /api/research/containers/:id/segmentation-review` to include:

- **Coherence panel per candidate** — a table of 18 checks showing
  PASS / FAIL / UNCERTAIN / N/A with the detail evidence expandable.
- **Reviewer action panel** — buttons and forms for each of the eleven
  actions (rendered as a form that POSTs to the appropriate endpoint).
  Actions that create new candidates (split, merge) show a confirmation
  prompt with the new span.
- **Cross-file relationship panel** — list of detected POSSIBLE_*
  relationships for this container's candidates, with "Confirm" /
  "Reject" buttons wired to the link-* endpoints.
- **Audit trail** — the last 20 `research_candidate_review_actions` rows
  for the container's candidates, newest first.

All UI forms use the existing Clerk staff session cookie — no new auth.

### 8. Synthetic fixtures + acceptance tests

**Seven cross-file test fixtures** in `fixtures/synthetic/cross-file/`.
Generate with a script
`artifacts/api-server/scripts/generate-cross-file-fixtures.ts`:

| Fixture pair | Scenario |
|---|---|
| `split-a.txt` + `split-b.txt` | One case split across two containers |
| `similar-unrelated-a.txt` + `similar-unrelated-b.txt` | Two cases with similar but distinct party names and courts |
| `continuation-with-repeated-page-a.txt` + `continuation-with-repeated-page-b.txt` | Continuation where the last page of A is repeated as the first page of B |
| `missing-middle-a.txt` + `missing-middle-b.txt` | A single case split across three containers where the middle one is absent |
| `corrected-original.txt` + `corrected-replacement.txt` | Same citation, replacement has added "Corrigendum" heading |
| `duplicate-scan-clean.txt` + `duplicate-scan-ocr.txt` | Same judgment, one native PDF, one OCR scan with confidence variations |
| `false-continuation-a.txt` + `false-continuation-b.txt` | Superficially similar party names produce POSSIBLE_CONTINUATION that a reviewer marks UNRELATED |

Each pair has a `<scenario>.expected.json` specifying: expected
relationship types detected, which require human confirmation, expected
coherence check results.

**`phase06.test.ts`** alongside existing phase tests:

Acceptance-gate tests:

- Coherence checks: each of the 18 check types passes a unit test
  with a synthetic page/block set (pure function test, no DB).
- Contradiction detection: for each contradiction type, a fixture
  containing a candidate with that contradiction fails the relevant
  check.
- Review action integrity:
  - `MOVE_BOUNDARY` to a page outside the container is rejected 400.
  - `SPLIT` produces two new candidates with total page coverage = original.
  - `MERGE` produces one candidate spanning both originals; originals
    are `rejected`.
  - `APPROVE` + `REJECT` are idempotent (second call is a no-op with
    409).
  - Every action inserts exactly one transformation row and one audit
    event.
- Cross-file: `split-a` + `split-b` scenario produces
  `POSSIBLE_CONTINUATION`; human `link-continuation` with
  `confirmed: true` produces `CONFIRMED_CONTINUATION`; span assembly
  succeeds; approval succeeds.
- Cross-file: `false-continuation` scenario produces
  `POSSIBLE_CONTINUATION` that reviewer marks `UNRELATED`; no span is
  created.
- No automatic merge: `duplicate-scan` scenario produces
  `POSSIBLE_DUPLICATE` or `EXACT_DUPLICATE` but state remains
  `SEGMENTATION_REVIEW_REQUIRED` until human approves span.
- All source pages are classified (covered by a candidate or explicitly
  unassigned) after validation.
- Staff-only gate: all review-action endpoints return 403 for
  unauthenticated requests.

### 9. Close-out

Follow `docs/BUILD_PROMPT.md`:

- Run `pnpm run typecheck` + `pnpm --filter @workspace/api-server run test`.
- Browser-test the extended segmentation review UI: log in as a staff
  reviewer, inspect a candidate with a contradiction, use the
  MOVE_BOUNDARY and APPROVE actions, verify audit trail, verify the
  cross-file relationship panel.
- Write `docs/reports/phase-06-completion.md`.
- Update `docs/status/current-phase.json` → phase 06 complete, next
  07 Search & Research UI.
- Respond with `PHASE: / STATUS: / CHECKPOINT:` structure.

## Relevant files

- `docs/BUILD_PROMPT.md`
- `docs/PHASES.md`
- `docs/PROCESSING_STATES.md`
- `docs/ARCHITECTURE.md`
- `docs/PROJECT_CHARTER.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-05-completion.md`
- `docs/decisions/0006-phase-05-segmentation.md`
- `lib/db/src/schema/research.ts`
- `lib/db/sql/migrations/0007-phase05-segmentation.sql`
- `lib/db/sql/migrations/0008-phase05-candidate-idempotency.sql`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/segmentation/pipeline.ts`
- `artifacts/api-server/src/research/segmentation/candidateComposer.ts`
- `artifacts/api-server/src/research/segmentation/signalDetector.ts`
- `artifacts/api-server/src/research/routes/segmentation.ts`
- `artifacts/api-server/src/research/routes/reviewUi.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/testing/testDb.ts`
- `artifacts/api-server/src/research/phase05.test.ts`
- `fixtures/synthetic/segmentation/`

---

## 59. Phase 07: Publisher-Content Isolation & Verified Judicial Text

Source: .local/tasks/task-53.md

---
title: Phase 07: Publisher-Content Isolation & Verified Judicial Text
---
# Phase 07 — Publisher-Content Isolation & Verified Judicial Text

## What & Why

Separate judicially-issued text from suspected publisher-created editorial
material. This is a core platform invariant stated in `replit.md` and
`docs/ARCHITECTURE.md` but not yet enforced at the data level. Phase 06
deferred automatic scrubbing; Phase 07 delivers it.

The state machine already defines `EDITORIAL_REVIEW_PENDING →
EDITORIAL_REVIEW_REQUIRED → JUDGMENT_VERIFICATION_PENDING → VERIFIED`, and
`validation/pipeline.ts` already transitions containers into
`EDITORIAL_REVIEW_PENDING` after coherence validation. Phase 07 implements
the content of those states.

## Done looks like

- Every page section of a container is classified with one of:
  `VERIFIED_JUDICIAL_TEXT`, `PROBABLE_JUDICIAL_TEXT`,
  `SUSPECTED_PUBLISHER_EDITORIAL`, `ADMINISTRATIVE_METADATA`,
  `SOURCE_ARTIFACT`, `UNKNOWN`, `MANUAL_REVIEW_REQUIRED`.
- The classifier uses all required detection signals (page location, layout,
  font changes, heading patterns, repeated headers/footers, branding markers,
  editorial vocabulary, court-document conventions, paragraph continuity,
  authorship context, prior reviewer decisions).
- The required safeguards are enforced: a section cannot be excluded solely
  because it appears before "Judgment", contains a summary, contains
  catchword-like wording, appears as a footnote, or uses bold headings.
  Court-issued summaries, judicial footnotes, judicial headings, and judicial
  annexures may remain VERIFIED_JUDICIAL_TEXT.
- `SUSPECTED_PUBLISHER_EDITORIAL` sections are held separately from verified
  judicial text, the full-text index, embeddings, AI prompts, AI summaries,
  classification models, and quotation tools — enforced by a single
  `isolationGate` function that all downstream consumers must call.
- The completeness checker catches: missing first/last page, incomplete
  opening/ending sentence, skipped paragraph numbers, duplicate paragraphs,
  missing orders/schedules/annexures, unreadable pages, multiple judgments
  accidentally combined.
- A verified judgment record is created only when: all approved judicial
  source spans are present, source refs, original page refs, and paragraph
  identifiers are recorded, a text checksum is computed, unresolved
  non-critical warnings are listed, and there are zero critical integrity
  warnings.
- Reviewer endpoints allow classification overrides and editorial approval
  before proceeding to verification.
- Excluded sections remain auditable via `research_transformations`.
- All included paragraphs retain source provenance.
- Incomplete cases (critical integrity warnings present) cannot reach VERIFIED.
- Judicial text is never silently rewritten.
- 196 existing tests continue to pass; new isolation tests are added.

## Out of scope

- Search adapter implementation (to become Phase 08).
- Research workspace portal UI (later phase).
- Embedding generation.
- AI research aids (later phase).
- Sentence-level character diffing inside a section.

## Steps

1. **ADR + phase redefinition** — Write `docs/decisions/0008-phase-07-publisher-content-isolation.md` recording the redefinition of Phase 07 from "Search & Research UI" to "Publisher-Content Isolation and Verified Judicial Text". Update `docs/PHASES.md` and `docs/status/current-phase.json`.

2. **DB schema: page sections table** — Add `research_page_sections` to `lib/db/src/schema/research.ts`: container_id (FK), page_id (FK, nullable — some sections span a full page), span_start_char / span_end_char (nullable — character offsets within the page's extracted text), classification (text enum, not null), confidence (real, 0–1), detector_version (text), reviewer_id (FK → research_users, nullable), reviewer_decision (text, nullable), reviewer_decided_at (timestamptz, nullable), isolation_applied (boolean, default false), notes (text, nullable), created_at. Index on (container_id, page_id).

3. **DB schema: editorial runs table** — Add `research_editorial_runs`: container_id (FK, not null), processor_version (text), section_count (int), uncertain_count (int), critical_warning_count (int), non_critical_warning_count (int), created_at.

4. **DB schema: verified judgments table** — Add `research_verified_judgments` to hold the full verified judgment record: candidate_id (FK → research_case_candidates, unique), approved_judicial_spans (jsonb — array of {containerId, pageId, spanStart, spanEnd}), source_refs (jsonb — array of {containerId, originalName}), original_page_refs (jsonb — array of page numbers), paragraph_identifiers (jsonb — array of paragraph labels), verified_by (text, not null), verified_at (timestamptz, not null), text_checksum (text, SHA-256 of all judicial text in order), critical_integrity_warnings (jsonb — must be empty array for VERIFIED), unresolved_non_critical_warnings (jsonb), created_at. A row here only exists when container is VERIFIED.

5. **Migration** — Generate and apply the Drizzle migration for all three new tables. Run `pnpm --filter @workspace/db run push` in dev.

6. **Section classifier (pure function)** — Create `artifacts/api-server/src/research/isolation/sectionClassifier.ts`. Input: page text, page metadata (page number, total pages, blocks/layout info from `research_page_blocks`). Output: `SectionClassification[]` with classification, confidence, supporting evidence text, and detector version. Implement the required detection signals: (a) page location heuristics — first/last pages are higher-risk for editorial framing but this alone is not exclusion grounds; (b) repeated header/footer patterns across pages; (c) branding markers (publisher name/logo patterns, ISBN, series titles, "All rights reserved", prices); (d) editorial vocabulary ("Headnotes", "Editorial Note", "Publisher's Summary", "Catchwords:", "Key Terms"); (e) court-document conventions (cause number, coram block, appearances block, date-of-judgment line, "JUDGMENT OF THE COURT" patterns); (f) paragraph continuity (numbered paragraph sequences signal judicial text); (g) font-change indicators from block metadata. Implement all safeguards: summary-like content, catchword-like wording, footnote position, bold headings, and pre-"Judgment" position cannot alone produce SUSPECTED_PUBLISHER_EDITORIAL — each requires corroborating signal evidence.

7. **Completeness checker (pure function)** — Create `artifacts/api-server/src/research/isolation/completenessChecker.ts`. Input: ordered judicial sections for a candidate with their page refs. Output: `{criticalWarnings: Warning[], nonCriticalWarnings: Warning[]}` where each warning has a code and description. Critical checks: missing first page, missing final page, incomplete opening sentence (no recognisable case-opening pattern), incomplete ending (no judgment dispositif or ending pattern), multiple judgments accidentally combined (conflicting case numbers/coram). Non-critical checks: skipped paragraph numbers, duplicate paragraph numbers, possible missing orders, possible missing schedules/annexures referenced in body, unreadable pages in span.

8. **Isolation gate** — Create `artifacts/api-server/src/research/isolation/isolationGate.ts`. Export a single `applyIsolationGate(sections: SectionClassification[]): SectionClassification[]` that keeps only VERIFIED_JUDICIAL_TEXT and PROBABLE_JUDICIAL_TEXT, strips everything else, and records a log-level note for each excluded section. This function must be called by any code path returning full-text content, and later by search indexing and AI prompt construction.

9. **Editorial processor (job)** — Create `artifacts/api-server/src/research/isolation/editorialProcessor.ts`, job kind `container.editorial_classify`. The processor: fetches all page extractions and block metadata for the container's active candidate pages; calls `sectionClassifier` for each page; persists `research_page_sections` rows (idempotent: ON CONFLICT DO NOTHING); creates a `research_editorial_runs` row; records a `research_transformations` row for every section classified as SUSPECTED_PUBLISHER_EDITORIAL or ADMINISTRATIVE_METADATA; if any section is MANUAL_REVIEW_REQUIRED or confidence < threshold, transitions container to EDITORIAL_REVIEW_REQUIRED and opens a `research_review_items` row; otherwise transitions to JUDGMENT_VERIFICATION_PENDING.

10. **Auto-enqueue editorial job** — In `validation/pipeline.ts`, after the transition to `EDITORIAL_REVIEW_PENDING`, enqueue a `container.editorial_classify` job (idempotent key: `editorial:${containerId}:${runId}`) in the same transaction.

11. **Editorial review routes** — Create `artifacts/api-server/src/research/routes/editorial.ts` and register it in `routes/index.ts`. Endpoints (all staff-gated):
    - `GET /api/research/containers/:id/sections` — list all research_page_sections for the container, grouped by page.
    - `PATCH /api/research/containers/:id/sections/:sectionId` — reviewer overrides classification; updates reviewer_id / reviewer_decision / reviewer_decided_at / isolation_applied; records a research_transformations row.
    - `POST /api/research/containers/:id/editorial-review/complete` — reviewer marks all editorial issues resolved; validates no remaining MANUAL_REVIEW_REQUIRED sections; transitions container EDITORIAL_REVIEW_REQUIRED → EDITORIAL_REVIEW_PENDING → JUDGMENT_VERIFICATION_PENDING.
    - `GET /api/research/containers/:id/judicial-text` — returns only isolation-gated (VERIFIED + PROBABLE) sections in page order, with provenance per section.
    - `POST /api/research/containers/:id/verify` — staff reviewer submits verification; runs completeness checker against gated sections; if critical warnings exist returns 422 with warning list (container stays in JUDGMENT_VERIFICATION_PENDING); if none, builds the `research_verified_judgments` record, computes text checksum, transitions container to VERIFIED, writes audit event.

12. **Synthetic fixtures** — Create fixtures in `fixtures/synthetic/isolation/`: multi-section judgment with clearly separated publisher headnotes; judgment with a court-issued summary (must NOT be excluded); judgment with judicial footnotes (must NOT be excluded); judgment with both publisher footer branding and judicial text on the same page; judgment with a missing final page (must trigger critical warning); judgment with skipped paragraph numbers (non-critical warning). All `.txt` fixtures paired with `.expected.json` acceptance gates.

13. **Tests** — Create `artifacts/api-server/src/research/phase07.test.ts`. Test: sectionClassifier correctly classifies each fixture scenario; safeguards are enforced (no false exclusion of judicial summaries, footnotes, catchword-adjacent text, bold headings alone); completenessChecker returns correct critical/non-critical warnings per scenario; isolationGate strips only the right sections; editorial processor job creates correct section rows and transitions container state; all five review endpoints (list, override, complete, judicial-text, verify); verify endpoint rejects with 422 when critical warnings remain; verified judgment record is complete and checksummed. All existing 196 tests must still pass.

14. **Completion report + phase status update** — Write `docs/reports/phase-07-completion.md` per `docs/BUILD_PROMPT.md`. Update `docs/status/current-phase.json` to mark Phase 07 complete and Phase 08 (now "Search & Research UI") as next.

## Relevant files

- `artifacts/api-server/src/research/validation/pipeline.ts`
- `artifacts/api-server/src/research/segmentation/signalDetector.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/candidateReview.ts`
- `lib/db/src/schema/research.ts`
- `docs/PHASES.md`
- `docs/status/current-phase.json`
- `docs/PROCESSING_STATES.md`
- `docs/ARCHITECTURE.md`
- `docs/BUILD_PROMPT.md`
- `docs/decisions/0007-phase-06-validation-review-cross-file.md`
- `docs/reports/phase-06-completion.md`
- `fixtures/synthetic/`

---

## 60. Phase 08: Search & Research UI

Source: .local/tasks/task-57.md

---
title: Phase 08: Search & Research UI
---
# Phase 08: Search & Research UI

## What & Why

Deliver usable legal-research access to the verified, isolation-gated judgments
produced by Phase 07. This phase has four interlocking layers:

1. **Case metadata extraction** — structured, provenance-traced metadata for
   every verified judgment (13 defined fields).
2. **Duplicate and version detection** — identify related judgments without
   automatically merging materially different versions.
3. **Full-text search** — PostgreSQL-native FTS over authorised, verified
   judicial text only; publisher editorial text never appears in results.
4. **Judgment viewer** — paragraph-navigable verified text with source-page
   comparison, private annotations, and bookmarks.

The research portals (MyLitAI, MySyalitAI, etc.) will consume these APIs.
The initial viewer phase shows verified judicial text and user notes only;
AI-generated research aids remain deferred to Phase 09.

---

## Done looks like

- Every `research_verified_judgments` row has a corresponding
  `research_case_metadata` row holding up to 13 fields; each field stores:
  extracted value, char-level source reference, confidence category
  (HIGH / MEDIUM / LOW / ABSENT), extraction method (REGEX / STRUCTURAL /
  AI_DISABLED), and reviewer status (UNREVIEWED / CONFIRMED / CORRECTED).
  Fields that cannot be extracted remain absent — no fabricated values.
- `research_duplicate_links` rows exist between verified judgments that share
  citations, party names + court + date, checksums, or paragraph fingerprints.
  Linked judgments remain distinguishable; no automatic merge occurs.
- `GET /api/research/search` accepts keyword, exact phrase, Boolean operators,
  proximity, field filters (court, judge, jurisdiction, statute, date range),
  wildcards, and paragraph-text queries; results include excerpts with paragraph
  IDs and source-page refs; only authorised VERIFIED containers appear.
- Publisher editorial text (`isolation_applied = true` sections) is structurally
  absent from every search result and every search excerpt.
- Judgment viewer endpoints return paragraphs in reading order, source-page
  comparison data, and user-private annotation / bookmark state.
- Browser tests pass all 8 acceptance scenarios (see Steps 13).
- All 249 existing tests remain green; new test count ≥ 310.

---

## Out of scope

- AI-generated research aids (Phase 09).
- Public-facing portal UI — portals call these APIs; the viewer in this phase
  is internal staff tooling.
- Export mechanics (reserved for a later phase).
- Full editorial review UI for `MANUAL_REVIEW_REQUIRED` sections (deferred).
- External search engines (Elasticsearch, OpenSearch) — PostgreSQL FTS only.

---

## Steps

1. **ADR 0009** — Write `docs/decisions/0009-phase-08-search-research-ui.md`
   recording: PostgreSQL FTS as the search engine (no external service),
   metadata field schema and storage model, duplicate-link model, annotation
   and bookmark data model, judgment viewer API design, and indexing strategy.

2. **DB schema and migrations** — Add the following tables (one idempotent
   migration `0014-phase08-search-ui.sql`):
   - `research_case_metadata` — one row per verified judgment; all 13 possible
     fields stored as a JSONB column (`fields`) where each field entry is
     `{ value, sourceRef, confidence, method, reviewerStatus, reviewedBy?,
     reviewedAt? }`. Indexed on `verified_judgment_id`.
   - `research_duplicate_links` — bidirectional pair `(judgment_a_id,
     judgment_b_id)`, signals JSONB (checksumMatch, citationMatch,
     partyCourtDateMatch, judgeMatch, paragraphFingerprintScore), status
     enum (`DETECTED` / `SAME_CASE` / `DIFFERENT_VERSION` / `DISTINCT`),
     reviewer columns.
   - `research_annotations` — per user per verified judgment per paragraph
     (optional anchor); private; text content, highlighted quote, highlight
     start/end chars within paragraph, created_at, updated_at.
   - `research_bookmarks` — per user per verified judgment; created_at.
   - `research_search_index` — one row per paragraph (or metadata-only row
     per judgment); columns: `verified_judgment_id`, `container_id`,
     `paragraph_id` (nullable), `section_id`, `content_tsv` (tsvector),
     `content_text`, `metadata_fields` JSONB (court, judge, jurisdiction,
     citation, parties, date), indexed with GIN on `content_tsv` and BTREE
     on the metadata columns.

3. **Metadata extractor** — Pure function
   `extractCaseMetadata(verifiedJudgment, sections, pageTexts)` in a new
   `research/metadata/` submodule. Extracts all 13 fields using regex and
   structural signals (positional heuristics, coram block, citation patterns,
   date formats). Each field result carries source character range,
   confidence category, and extraction method. Missing fields produce an
   ABSENT entry — never a guess. The 13 fields: case name, neutral citation,
   report citation, court, registry, proceeding number, judges, hearing date,
   decision date, parties, jurisdiction, procedural posture, language.

4. **Metadata processor job** — Background job type
   `container.metadata_extract`; fetches the verified judgment, sections, and
   page texts; calls the extractor; upserts the `research_case_metadata` row.
   Registered at startup. Enqueued automatically after the container reaches
   `VERIFIED` (add to pipeline integration after the verify route succeeds).
   Idempotent: re-running replaces the fields JSONB but records a
   transformation audit row showing the before/after.

5. **Duplicate and version detector** — Pure function
   `detectDuplicates(candidate, corpus)` in `research/metadata/`. Compares:
   SHA-256 checksum (exact match → SAME_CASE signal), neutral and report
   citations (parsed and normalised), party names + court + decision date
   (normalised string similarity), judge names, paragraph-count fingerprint,
   leading-paragraph text similarity (Jaccard or dice on shingles). Returns
   an array of `{ otherJudgmentId, signals, aggregateScore }` objects.
   A score above the SAME_CASE threshold creates a `DETECTED` link;
   materially different versions are never automatically merged.

6. **Duplicate processor job** — Background job type
   `container.duplicate_detect`; runs after `container.metadata_extract`
   completes; calls the detector against all existing VERIFIED judgments;
   upserts `research_duplicate_links` rows. Registered at startup. Idempotent.

7. **PostgreSQL FTS search adapter** — Replace `postgres-search-stub` with
   `postgres-fts` implementing the existing `SearchAdapter` interface.
   Extend the interface minimally to support structured queries (the current
   interface takes a plain `string`; add a typed `StructuredQuery` overload
   that the routes use directly, keeping the plain-string path for
   backward-compatibility). The adapter must:
   - Accept the full query grammar: keyword, exact phrase (quoted), Boolean
     (AND/OR/NOT), proximity (NEAR/n), field filters (court:, judge:,
     jurisdiction:, statute:, section:, date:), wildcards (prefix*),
     paragraph text.
   - Translate to `websearch_to_tsquery` / `phraseto_tsquery` / custom
     `tsquery` as appropriate; apply field-column filters as SQL WHERE
     predicates.
   - Enforce the isolation gate: only rows in `research_search_index` that
     passed `isolation_applied = false` on the originating section are
     indexed; publisher editorial rows are structurally absent.
   - Enforce rights and access: join against `research_rights_records` and
     container processing state (`VERIFIED` only).
   - Return: `{ verifiedJudgmentId, paragraphId?, sectionId, excerpt,
     matchedTermPositions, score, metadata }` per hit.

8. **Search API routes** — New router `research/routes/search.ts` mounted
   on the main research router:
   - `GET /search` — query params: `q` (raw query string parsed by the
     adapter), `court`, `judge`, `jurisdiction`, `statute`, `section`,
     `dateFrom`, `dateTo`, `page`, `perPage`. Response: paginated hit list
     with excerpts. Requires `research` role.
   - `POST /search/index/:containerId` — admin: rebuild the search index for
     one verified container. Requires `administrator` or `owner` role. Enqueues
     a `container.search_index` job.
   - `GET /search/metadata` — autocomplete sources for field filters
     (distinct courts, judges, jurisdictions from indexed metadata).

9. **Judgment viewer routes** — New router `research/routes/viewer.ts`:
   - `GET /judgments/:id` — summary: metadata, duplicate links, stats.
   - `GET /judgments/:id/paragraphs` — ordered paragraph list with paragraph
     IDs, section IDs, source-page refs, and text. Supports `?highlight=term`
     to return match positions within each paragraph.
   - `GET /judgments/:id/pages/:pageNum` — page view: judicial sections for
     the given source-page number, with section classifications.
   - `GET /judgments/:id/source-page/:pageId` — source-page comparison:
     full page text alongside isolation-gated judicial sections, for
     side-by-side review.
   - `GET /judgments/:id/annotations` — caller's private annotations
     (filtered by `research_user_id`).
   - `POST /judgments/:id/annotations` — create annotation; body: paragraph
     id, optional highlight quote + char range, text content.
   - `PATCH /judgments/:id/annotations/:annotationId` — edit text or highlight.
   - `DELETE /judgments/:id/annotations/:annotationId` — delete own annotation.
   - `GET /judgments/:id/bookmarks` — caller's bookmark state for this
     judgment.
   - `PUT /judgments/:id/bookmarks` — toggle bookmark (idempotent upsert /
     delete).
   All routes: require `research` role; access decision checked per container.

10. **Metadata review routes** — Extend or add to `research/routes/viewer.ts`:
    - `GET /judgments/:id/metadata` — all 13 fields with confidence, source
      ref, method, reviewer status.
    - `PATCH /judgments/:id/metadata/:field` — reviewer override: update the
      field's value and set `reviewerStatus: CORRECTED`; write a
      `research_transformations` row. Requires `legal_reviewer` / `administrator`
      / `owner`.
    - `GET /judgments/:id/duplicates` — linked judgments with similarity
      signals and current reviewer status.
    - `PATCH /duplicates/:linkId` — reviewer decision on a duplicate link
      (SAME_CASE / DIFFERENT_VERSION / DISTINCT); write a transformations row.

11. **Search index pipeline** — After `container.metadata_extract` succeeds,
    enqueue `container.search_index`. The `search_index` processor: fetches the
    verified judgment's approved judicial sections and metadata; rebuilds the
    `research_search_index` rows for that judgment (delete-then-insert to keep
    it idempotent); calls `update_search_index_tsvector()` to regenerate the
    `content_tsv` column via a DB trigger or explicit `to_tsvector` call.
    Registered at startup.

12. **Synthetic fixtures** — Add to `fixtures/synthetic/metadata/`:
    - `full-metadata.txt` — judgment containing all 13 extractable fields.
    - `partial-metadata.txt` — judgment with 6 absent fields (stays absent).
    - `duplicate-pair-a.txt` / `duplicate-pair-b.txt` — two sources of the
      same judgment (same citation, different edition text).
    - `version-pair-a.txt` / `version-pair-b.txt` — different-year versions
      of the same case (citation differs in year).
    - `complex-citations.txt` — multiple citation formats in one judgment.

13. **Tests (integration)** — In `phase08.test.ts`:
    - Metadata extractor: all 13 fields; missing-field stays absent; source
      ref points to correct character range.
    - Duplicate detector: checksum match, citation match, party+court+date
      match, paragraph fingerprint match, no-match (score below threshold).
    - Search adapter: keyword query returns hits; exact phrase returns only
      phrase matches; Boolean AND/OR/NOT filters correctly; field filter on
      court/judge/date; wildcard prefix; isolation gate (editorial text absent
      from results); rights gate (restricted container hidden); empty result
      for unknown query.
    - Viewer routes: auth gate (non-research role → 403); paragraph list
      ordered correctly; source-page comparison returns judicial sections only;
      annotation CRUD (create, edit, delete, visibility restricted to owner);
      bookmark toggle (idempotent).
    - Metadata review routes: all 13 fields returned; reviewer override writes
      transformation; duplicate link reviewer decision persisted.
    - Pipeline: after verify, metadata_extract and search_index jobs enqueued
      and processable.
    - All 249 existing tests must remain green.

14. **Browser tests (Playwright)** — Using the existing testing skill, cover
    the 8 acceptance scenarios against the running API:
    1. Login (research user authenticates, receives research role).
    2. Authorised search (verified, rights-approved case returns results).
    3. Restricted search (container with UNREVIEWED rights returns no results).
    4. Open a case (judgment viewer returns paragraphs in order).
    5. Page comparison (source-page endpoint returns judicial sections
       alongside raw page text).
    6. Paragraph navigation (paragraphs have IDs; highlight query returns
       term positions).
    7. Annotation creation (POST creates annotation; GET returns it for the
       same user only).
    8. Unauthorised access attempt (no research role → 401/403).

15. **Phase reports and status update** — Write
    `docs/reports/phase-08-completion.md` (full required structure from
    `docs/BUILD_PROMPT.md`); update `docs/status/current-phase.json` to
    phase 08 complete, `nextPhase` Phase 09 (AI Research Aids). Set
    `/api/research/health` `phase` field to `"08"`.

---

## Relevant files

- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/editorial.ts`
- `artifacts/api-server/src/research/isolation/isolationGate.ts`
- `artifacts/api-server/src/research/isolation/editorialProcessor.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/validation/pipeline.ts`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/auth.ts`
- `artifacts/api-server/src/research/phase07.test.ts`
- `artifacts/api-server/src/research/testing/`
- `lib/db/src/schema/research.ts`
- `lib/db/sql/migrations/`
- `docs/decisions/0008-phase-07-publisher-content-isolation.md`
- `docs/reports/phase-07-completion.md`
- `docs/PHASES.md`
- `docs/BUILD_PROMPT.md`
- `fixtures/synthetic/isolation/`

---

## 61. Document Contribution Portal

Source: .local/tasks/task-5.md

---
title: Document Contribution Portal
---
# Document Contribution Portal

## What & Why
Let legal professionals contribute soft-copy cause papers and legal documents to strengthen the whole AI Portals ecosystem. Contributions are stored at scale, organized by category, and turned into a curated, searchable knowledge base that the apps can draw on to improve their proficiency and familiarity with real Malaysian legal documents.

Important architectural reality: the 7 apps are separate external deployments. This task builds the full supply side on THIS project — collection, large-volume storage, categorization, text extraction, curation, and a read API that exposes the approved corpus. Actually wiring each external app to consume the corpus (RAG/fine-tuning inside those apps) is out of scope here because it must be done inside each app.

## Done looks like
- Anyone can open a "Contribute" page from the landing page, fill in their name/email, pick one or more categories, and upload documents of ANY file format (PDF, DOC/DOCX, images, scans, ZIP, etc.).
- Multiple large files can be uploaded in one go without hitting a small size cap; storage scales to large volumes (object storage, not the DB).
- Each upload is recorded with contributor info, chosen category, original filename, size, format, and a status.
- Uploaded documents show a clear on-screen confirmation and a note that contributions are reviewed before being adopted into the knowledge base.
- Admin dashboard gets a "Contributions" section listing every submission, filterable by category and status, with the ability to download the original file and to change status (Pending -> Approved/Adopted -> Rejected).
- When a document is marked Adopted, its extracted text becomes part of a searchable knowledge base, and a read-only API endpoint can return approved/adopted corpus entries (title, category, extracted text, source metadata) so any app can consume it later.
- Text is auto-extracted where the format allows (PDF, DOCX, plain text); formats that can't be parsed are still stored and downloadable, just flagged as "not text-extracted".

## Out of scope
- Modifying the external apps (mylitai.life, mysyalitai.life, mycorpai.life, myconveyai.life, mycrimai.life, myccblitai.life, myaccidentai.life) to actually query/train on the corpus. That is separate work inside each app.
- Automatic model fine-tuning / retraining. We build the curated corpus + API; consumption is the apps' responsibility.
- Authentication/accounts for contributors (open submission with name/email, consistent with the existing open admin). Can be added later.
- OCR of scanned image-only PDFs (store + flag; OCR can be a later enhancement).

## Steps
1. **Provision object storage** — Set up App Storage (GCS-backed) for large-volume, any-format file storage, and wire the presigned-URL upload endpoints and object-serving routes into the API server.
2. **Contributions data model** — Add a `contributions` table capturing contributor name/email, category, original filename, content type, size, object storage path, extracted-text field, extraction status, and review status; regenerate the API layer from the OpenAPI spec.
3. **Contribution API** — Add endpoints to create a contribution record (after upload), list/filter contributions (admin), update status, and a read-only "knowledge base" endpoint returning approved/adopted entries with extracted text for downstream app consumption.
4. **Server-side text extraction** — On contribution create (or on adopt), extract text from supported formats (PDF, DOCX, TXT) into the extracted-text field; mark unsupported formats as not-extracted but keep them stored/downloadable.
5. **Public Contribute page** — Add a branded "Contribute" page/section to the landing page: contributor details, category picker (aligned to the app domains: Litigation, Syariah, Corporate Secretary, Conveyancing, Criminal, Corp/Comm/Banking, Accident & PI, plus a General/Other), multi-file any-format uploader with progress, and a clear confirmation + review-notice message. Add a nav/CTA entry point to it.
6. **Admin Contributions view** — Add a "Contributions" page to the admin dashboard to browse/filter by category and status, download original files, and change review status (including "Adopt into knowledge base").

## Relevant files
- `artifacts/api-server/src/routes/index.ts`
- `artifacts/api-server/src/routes/admin/index.ts`
- `artifacts/api-server/src/routes/admin/subscribers.ts`
- `lib/db/src/schema/index.ts`
- `lib/db/src/schema/subscribers.ts`
- `lib/api-spec/openapi.yaml`
- `lib/api-spec/orval.config.ts`
- `artifacts/landing-page/src/pages/home.tsx`
- `artifacts/landing-page/src/pages/admin/subscribers.tsx`
- `artifacts/landing-page/src/components/admin/layout.tsx`
- `artifacts/landing-page/src/components/apps-grid.tsx`

---

## 62. Fix test cleanup so FK failures can't hide real bugs

Source: .local/tasks/test-cleanup-fk-order.md

# Fix test cleanup so FK failures can't hide real bugs

## What & Why
Three test files (phase05, phase06, stress) currently fail during their cleanup steps because child tables are deleted after parent tables, violating foreign key constraints:
- `research_cross_file_relationships` must be deleted before `research_case_candidates`
- `research_candidate_coherence_checks` must be deleted before `research_case_candidates`
- `research_editorial_runs` must be deleted before `research_source_containers`

When cleanup throws, the test runner reports a suite-level error that looks like a real failure, which makes it easy to overlook genuine regressions hiding underneath.

## Done looks like
- All three test files complete cleanup without FK errors
- Test output shows passes/failures for the actual test assertions only, not cleanup noise
- Deleting child-table rows (cross_file_relationships, coherence_checks, editorial_runs) happens before their parent rows in every cleanup block

## Out of scope
- Changing test assertions or test logic (cleanup only)
- Switching to isolated schemas (that pattern is already used in stateMachines.test.ts and is not needed here)

## Steps
1. **Audit cleanup blocks** — in phase05.test.ts, phase06.test.ts, and stress.test.ts, find every `afterEach`/`afterAll` cleanup block that deletes from `researchCaseCandidates` or `researchSourceContainers`.
2. **Delete child rows first** — before deleting candidates, delete from `researchCrossFileRelationships` and `researchCandidateCoherenceChecks` where `candidateId` is in the tracked set; before deleting containers, delete from `researchEditorialRuns` where `containerId` is in the tracked set.
3. **Verify** — run the full test suite and confirm the three files no longer produce suite-level FK errors.

## Relevant files
- `artifacts/api-server/src/research/phase05.test.ts`
- `artifacts/api-server/src/research/phase06.test.ts`
- `artifacts/api-server/src/research/stress.test.ts`
