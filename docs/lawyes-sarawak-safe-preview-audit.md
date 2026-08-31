# LAWYes Sarawak Safe Preview Audit

**Review date:** 31 August 2026
**Release state:** Safe Preview only
**Production publication:** Not performed

## Scope completed

- Merged the dual Sarawak and preview fixtures into one canonical dataset.
- Redesigned the opening experience to show exactly four primary actions with clear progressive disclosure.
- Built a guided Legal Search with an explicit all-jurisdictions default, three exact-jurisdiction modes, guided queries, a deterministic lawyer-reviewed view, advanced fields behind a toggle, validated deep links, selected materials, report-specific source links, pinpoint focus, and visible copy/export feedback.
- Created a guided Draft Document flow spanning three pack-specific intakes, required safeguards, source/uncertainty/gap manifests, practitioner-review warnings, browser Back, and local TXT/DOCX/print actions.
- Created a safe Matter setup demonstration that requires at least one resolved material, carries matter/client/task details into confirmation, supports Search/Draft handoffs and local TXT/JSON exports, and never persists.
- Consolidated structured verification information, coverage statistics, source access requirements, verification steps, usage notes, change histories, and methodology into a single Verification view.
- Ensured a mobile-first responsive layout with four-item sticky bottom navigation and no horizontal overflow.
- Preserved the Safe Preview boundary: no authentication, application API, database, storage, upload, billing, AI, local-storage or server-write integration.

## Sources reviewed

The preview relies on the canonical official or authoritative-source records including:

1. Sarawak LawNet legislation and subsidiary-legislation index.
2. Sarawak Judiciary E-Court gateway.
3. e-Kehakiman Sabah and Sarawak judgment collection.
4. Sarawak Advocates Community System gateway.
5. Sarawak Land and Survey Department.
6. Native Courts of Sarawak official portal.
7. Advocates Association of Sarawak public gateway.
8. Malaysian Judiciary eJudgment gateway.

Seven source records are marked verified-current. The professional-association gateway and the publicly accessible Kuching judgment copy remain verification-required; neither is upgraded by this redesign.

## Case reports and access records

- Total Safe Preview case inventory: 20.
- Lawyer-reviewed substantive preview reports: 2.
- Total access-only records: 18.

The substantive reports are provided as reviewed examples. The remaining records remain access records because the full judgments have not yet been reviewed to the paragraph, counsel, authority, order and appellate-treatment standard required for a LAWYes substantive report.

## Drafting and precedent packs

1. Civil application / affidavit pack.
2. Criminal representation / bail / mitigation pack.
3. Sarawak land / NCR transaction pack.

Each pack provides pack-specific required intake fields, facts and exhibits, filing/service checks, source references, uncertainty prompts, known-gap notices, required acknowledgements, and local TXT/DOCX/print actions. Civil and criminal packs have no land-specific defaults. Generation is blocked until required intake and every displayed safeguard are complete. These remain verification-required practitioner-review templates rather than approved court forms.

## Items awaiting verification

- Full paragraph-level editorial treatment of Sarawak-origin judgments.
- Current registry-specific forms, fees, filing channels, hearing directions and service practices.
- Instrument-level amendment checks for estate, probate and advocates materials.
- Publicly accessible current professional practice materials.
- Matter-specific NCR and community-custom authorities.

## Verification completed

- Landing-page TypeScript check and production build: passed.
- LAWYes fixture, URL-state, terminal-state normalization, publication, manifest, provenance, and recursive isolation tests: 26 passed.
- Dedicated LAWYes Playwright regression file: 10 passed with one worker.
- Desktop browser test at 1440 x 1000: passed.
- Mobile browser test at 390 x 844: passed with a single-column layout, four-item bottom navigation, reader open/close, and 390/390 document/viewport width.
- Opening four-action workspace and Enter handoff, guided/basic/advanced search, exact/all-jurisdiction behavior, empty/reset state, access-record distinction, two-report lawyer-reviewed view, report-specific source, pinpoint focus, citation feedback, all three guarded drafting packs, local Matter confirmation and handoffs, all six Practice Centre categories, structured source verification, keyboard focus, deep-link reload, and browser Back: passed.
- TXT, DOCX, JSON, and print actions expose visible/assistive success or failure feedback; Playwright confirmed the Matter TXT download.
- Browser console: no errors.
- Source and runtime isolation: passed; no preview-originated application API, storage, authentication, upload, billing, AI, persistence or write requests.
- Existing API regression workflow: 1,067 tests passed across 102 files.

## Existing unrelated failure

- Some intermediate browser reruns reached the container's Chromium thread/PID ceiling while unrelated development previews were active. After enough development-only thread capacity was released, the final dedicated ten-test file passed 10/10 with one worker.
- The configured aggregate multi-portal E2E workflow still records its pre-existing MyCorpLegalAI draft failure because `Practitioner` is not found after sign-in. The failure is outside `/lawyes-safe-preview`; this task did not modify that portal.

## Production-release risks

1. The Safe Preview is static and intentionally not connected to production data or subscriber sessions.
2. A production release must not treat source discovery as publication approval.
3. Sarawak reports require full-judgment review, paragraph verification, legal-editor approval and rights approval.
4. Registry procedures, fees, forms and timelines require current official confirmation before being presented as operational instructions.
5. DOCX packs are guided practitioner-review templates, not approved registry forms.
6. The jurisdiction model must be carried into the authenticated shared API and portal applications only after separate access-control and practice-scope testing.

## Recommendation

Keep this version in Safe Preview for practitioner review. The UX has been simplified for busy practitioners. The next content milestone should be a small, high-quality set of full Sarawak judgments converted into paragraph-verified, lawyer-reviewed reports, followed by instrument-by-instrument verification of registry forms, fees and deadlines.