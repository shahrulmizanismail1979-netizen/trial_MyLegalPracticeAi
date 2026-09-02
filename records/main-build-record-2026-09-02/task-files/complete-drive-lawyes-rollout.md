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