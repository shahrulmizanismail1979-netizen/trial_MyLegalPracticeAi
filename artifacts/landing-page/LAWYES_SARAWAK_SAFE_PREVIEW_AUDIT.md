# LAWYes Sarawak Safe Preview audit

**Review date:** 31 August 2026
**Release boundary:** Static Safe Preview only. No production API, database, Drive, upload, billing, subscriber entitlement, or local-storage changes.

## Sources reviewed

The fixture records direct HTTPS links, source type, jurisdiction, rights status, last-verified date, editorial status, audit notes, what can be found, access requirements, verification steps, usage limits, and change history for:

1. Sarawak LawNet legislation and subsidiary-legislation index.
2. Sarawak Judiciary E-Court gateway.
3. e-Kehakiman Sabah and Sarawak judgment and registrar gateway.
4. Sarawak Advocates Community System gateway.
5. Sarawak Land and Survey Department gateway.
6. Native Courts of Sarawak gateway.
7. Advocates Association of Sarawak public gateway.
8. Malaysian Judiciary eJudgment gateway.
9. A publicly accessible Kuching High Court judgment copy via INSTUN Pintu.

The preview does not infer a rule, procedure, fee, form, deadline, or legal outcome merely because a gateway or document is accessible.

## Verified-current additions

- Seven official/public source records were reachable and recorded as verified-current on the review date.
- One professional-association gateway was intermittent and remains verification-required.
- Sarawak LawNet is exposed as the legislation discovery source, but every individual instrument still requires an item-level currency and amendment check.
- National and federal material remains available and visibly distinct from Sarawak-specific material.

## Reports

- Two existing Sabah and Sarawak e-Kehakiman reports remain published because their source, paragraph support, and human approval are recorded.
- Zero Sarawak-specific substantive reports are published in this preview.
- The Kuching land judgment and Native Court pathway are access records only. They remain blocked from substantive report export pending official provenance, stable paragraph mapping, complete report-schema review, and lawyer approval.
- No AI editorial draft is represented as lawyer-reviewed or published.

## Practice coverage

The structured Sarawak discovery model covers six specified Practice Centre categories: Civil Litigation, Criminal Litigation, Conveyancing & Land, NCR & Native Law, Probate & Estates, and Professional Practice.

Each category now includes suitable-use boundaries, explicit limits, a staged workflow, examples, source notes, updated/verification metadata, and gap notices. Each practice card remains verification-required: it is a source-discovery path, not a completeness or legal-content claim.

The opening remains limited to one natural-language instruction field and four primary actions. Detailed practice material, source histories, filters, and audit information are progressively disclosed after entry.

## Practical packs and precedents

Three practitioner-review templates are included:

- Civil application / affidavit pack.
- Criminal representation / bail / mitigation pack.
- Sarawak land / NCR transaction pack.

Each pack includes pack-specific required intake, facts/exhibits, jurisdiction and registry checks, cause-paper or working-document structure, filing/service readiness prompts, editable notes, source references, risk flags, uncertainty prompts, known gaps, examples, and TXT/DOCX/print export. Civil and criminal packs have no land-specific defaults. All displayed safeguards and required fields must be completed before generation. Every generated result is an editable practitioner-review template with a source and unresolved-gap manifest; none is presented as an approved court form or filing instruction.

## Search and matter workflow

- Search opens on the complete 20-record preview inventory, with exact Sarawak, Sabah & Sarawak, and Malaysia jurisdiction modes plus guided queries and a deterministic two-report lawyer-reviewed view.
- Query, filters, selected report, selected materials, pack, Practice Centre, and workflow steps are represented in validated URL state. Invalid values are discarded; reload and browser Back/Forward restore meaningful state without one history entry per keystroke.
- Copy, TXT, DOCX, JSON, and print actions provide visible and assistive-technology feedback, including explicit clipboard failure states.
- Matter confirmation requires an internal reference, client reference, purpose, verification acknowledgement, and at least one resolved fixture material. Confirmation carries the entered details and selected materials into a local manifest, with Search and Draft handoffs.
- Matter and draft state remains in memory/URL only. Nothing is uploaded, persisted, authenticated, billed, or sent to an AI service.

## Verification gaps

- Individual Sarawak instruments, amendments, subsidiary legislation, Gazettes, practice directions, forms, fees, timelines, and registry requirements need item-level review.
- No Sarawak-specific substantive case report has cleared all publication gates.
- Appellate and subsequent treatment must be verified per report before publication.
- Land category, title status, NCR status, native custom, consent, instrument, and transaction consequences are not inferred by the decision tree.
- Professional-association source availability and currency require re-checking.
- The preview does not claim complete corpus, publisher equivalence, or production readiness.

## Validation record

The implementation passed:

- 26 focused Vitest checks covering canonical inventories, publication gates, nested guidance depth, provenance, guided taxonomies, exact/all-jurisdiction behavior, editorial-status mapping, pack-specific defaults, matter manifests, URL normalization/round-tripping, forged terminal-state normalization, exports, and recursive static-isolation scanning.
- Landing-page TypeScript checking and production build.
- Ten permanent Playwright regressions covering the four-action opening and Enter handoff, validated deep links and safe terminal-state reloads, guided search/reset/material selection, guarded draft generation and manifests, matter validation/confirmation/handoffs/download, browser Back, all six Practice Centre categories, category-specific disclosures, honest source-action labels, source verification guidance, and 390 px overflow/bottom-navigation safety.
- A complete browser test drive at 1440 × 1000 and 390 × 844 covering all four journeys, all three drafting packs, all six Practice Centre categories, source disclosures, keyboard focus, report pinpoints, clipboard/download feedback, URL restoration, browser Back, and mobile reader open/close.
- Browser checks confirmed the two-report lawyer-reviewed filter, a report-specific official judgment URL, visible citation-copy feedback, and visible/focusable paragraph targets from report pinpoints.
- Source-code and browser isolation checks found no preview-originated application API, storage, account, upload, payment, AI, persistence or server-write request.
- Existing API regressions: 1,067 tests passed across 102 files.

Some intermediate local Playwright reruns were interrupted by the container's Chromium thread/PID ceiling while unrelated development previews were active. After enough development-only thread capacity was released, the final ten-test file passed 10/10 with one worker. The configured aggregate multi-portal E2E workflow still records its pre-existing MyCorpLegalAI draft failure because the expected `Practitioner` text is absent after sign-in; that failure is outside `/lawyes-safe-preview` and this work did not alter that portal.

## Production-release risks

This work must not be promoted as production legal content without a separate source audit, lawyer review, rights confirmation, authenticated permissions test, tenant-isolation test, and production release approval. Production data and subscriber entitlements were intentionally not touched.