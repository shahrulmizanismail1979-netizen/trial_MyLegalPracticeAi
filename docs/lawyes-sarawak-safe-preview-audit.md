# LAWYes Sarawak Safe Preview Audit

**Review date:** 30 August 2026
**Release state:** Safe Preview only
**Production publication:** Not performed

## Scope completed

- Merged the dual Sarawak and preview fixtures into one canonical dataset.
- Redesigned the opening experience to show exactly four primary actions with clear progressive disclosure.
- Built a streamlined Legal Search with basic defaults and advanced fields behind a toggle.
- Created a guided Draft Document flow spanning template selection, intake, readiness checks, and local export.
- Created a safe Matter setup demonstration flow simulating task organization without persistent storage.
- Consolidated verification information, coverage statistics, and methodology into a single Verification view.
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

Each pack provides guided intake fields, required facts and exhibits, filing/service checks, source references and a local DOCX export. These are labelled as access records or verification-required practitioner-review templates rather than approved court forms.

## Items awaiting verification

- Full paragraph-level editorial treatment of Sarawak-origin judgments.
- Current registry-specific forms, fees, filing channels, hearing directions and service practices.
- Instrument-level amendment checks for estate, probate and advocates materials.
- Publicly accessible current professional practice materials.
- Matter-specific NCR and community-custom authorities.

## Verification completed

- Landing-page TypeScript check: passed.
- LAWYes fixture tests: 7 passed.
- Landing-page production build: passed.
- Desktop browser test at 1440 x 1000: passed.
- Mobile browser test at 390 x 844: passed with a single-column layout, four-item bottom navigation and 390/390 document/viewport width.
- Opening four-action workspace, basic/advanced search, empty/reset state, access-record export guard, selected-report details, guided drafting, four-step demonstration matter flow, six Practice Centre categories, Sources & Verification, keyboard focus and browser Back: passed.
- Published-report TXT (6,212 bytes) and DOCX (9,352 bytes), result CSV (2,238 bytes) and JSON (28,430 bytes), and drafting-pack TXT (887 bytes) and DOCX (2,931 bytes): passed.
- Report-specific official judgment link UI regression test: 1 passed.
- Browser console: no errors.
- Source and runtime isolation: passed; no preview-originated application API, storage, authentication, upload, billing, AI, persistence or write requests.
- Existing API regression workflow: 1,067 tests passed across 102 files.

## Existing unrelated failure

- The configured multi-portal E2E workflow fails in its pre-existing MyCorpLegalAI draft test because `Practitioner` is not found after sign-in. The failure is outside `/lawyes-safe-preview`; this task did not modify that portal.

## Production-release risks

1. The Safe Preview is static and intentionally not connected to production data or subscriber sessions.
2. A production release must not treat source discovery as publication approval.
3. Sarawak reports require full-judgment review, paragraph verification, legal-editor approval and rights approval.
4. Registry procedures, fees, forms and timelines require current official confirmation before being presented as operational instructions.
5. DOCX packs are guided practitioner-review templates, not approved registry forms.
6. The jurisdiction model must be carried into the authenticated shared API and portal applications only after separate access-control and practice-scope testing.

## Recommendation

Keep this version in Safe Preview for practitioner review. The UX has been simplified for busy practitioners. The next content milestone should be a small, high-quality set of full Sarawak judgments converted into paragraph-verified, lawyer-reviewed reports, followed by instrument-by-instrument verification of registry forms, fees and deadlines.