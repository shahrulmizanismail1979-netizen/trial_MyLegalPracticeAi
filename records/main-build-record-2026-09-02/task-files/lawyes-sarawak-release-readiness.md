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