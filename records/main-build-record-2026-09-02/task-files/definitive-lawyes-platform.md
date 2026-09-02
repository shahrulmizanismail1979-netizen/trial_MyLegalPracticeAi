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
