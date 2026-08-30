# LAWYes Sarawak Safe Preview Audit

**Review date:** 30 August 2026  
**Release state:** Safe Preview only  
**Production publication:** Not performed  

## Scope completed

- Added a first-class Sarawak jurisdiction pathway and jurisdiction selector.
- Added a dedicated Sarawak Practice Centre for legislation, official sources, updates, playbooks, precedent packs, registries and agencies.
- Added Sarawak-aware search terms for legislation, NCR, land classifications, Native Courts, registries, professional practice and Bahasa Malaysia terminology.
- Added visible source type, jurisdiction, currency, last-verified date and editorial state to each Sarawak source record.
- Added mobile and desktop navigation for the Practice Centre, source-led research and Matter Studio.
- Preserved the Safe Preview boundary: no authentication, application API, database, storage, upload, billing, AI, local-storage or server-write integration.

## Sources reviewed

The preview contains 12 curated official or authoritative-source records:

1. Sarawak LawNet statutes and Government Gazette gateway.
2. Sarawak LawNet public law list.
3. Land Code (Chapter 81, 1958 Edition) official online compilation.
4. Administration of Estates Ordinance, 1933 access record.
5. Administration of Estates (Probate and Letters of Administration) Rules, 2023 access record.
6. Advocates Ordinance, 1953 access record.
7. e-Kehakiman Sabah and Sarawak judgment collection.
8. e-Kehakiman Roll of Advocates and practising-certificate services.
9. Native Courts of Sarawak official portal.
10. Native Court of Appeal judgment gateway.
11. Sarawak Land and Survey Department.
12. Sarawak court administration and registry directory.

The official online Land Code compilation states that it incorporates amendments up to 31 December 2024. The preview displays that date and does not imply later amendments have been ruled out.

## Verified-current materials added

- 8 records are identified as verified official source gateways or documents.
- 4 records remain access records because provision-level currency, forms or amendment position still require editorial verification.
- Every record has an HTTPS source link, source type, jurisdiction, currency statement, last-verified date and editorial state.
- No registry fee, filing deadline, local custom, form requirement or procedural proposition was generated without a direct verified source.

## Case reports and access records

- Total Safe Preview case inventory: 22.
- Lawyer-reviewed substantive preview reports: 2.
- Sarawak-specific substantive lawyer-reviewed reports added in this pass: 0.
- New Sarawak-origin official-collection access records added: 4.
- Total access-only records: 20.

The two existing substantive reports are Malaysia preview reports and are not represented as a completed Sarawak report collection. The four new Sarawak records remain access records because the full judgments have not yet been reviewed to the paragraph, counsel, authority, order and appellate-treatment standard required for a LAWYes substantive report.

## Practical playbooks added

1. Civil interlocutory application.
2. Bail and criminal representation preparation.
3. Sarawak land transaction and registration.
4. Native-law jurisdiction triage.
5. Sarawak professional-practice file opening.

Each playbook contains a jurisdiction check, staged workflow, source links and explicit risk flags. Verification-required playbooks do not state fees, filing deadlines or guaranteed outcomes.

## Drafting and precedent packs added

1. Sarawak civil affidavit pack.
2. Bail, representation and mitigation pack.
3. Sarawak transfer, charge and caveat pack.
4. Sarawak probate and administration pack.

Each pack provides guided intake fields, required facts and exhibits, filing/service checks, source references and a local DOCX export. These are labelled as access records or verification-required practitioner-review templates rather than approved court forms.

## Items awaiting verification

- Full paragraph-level editorial treatment of Sarawak-origin judgments.
- Current registry-specific forms, fees, filing channels, hearing directions and service practices for Kuching, Sibu, Bintulu, Miri and other registries.
- Instrument-level amendment checks for the estate, probate and advocates materials.
- Publicly accessible current Advocates Association of Sarawak practice materials.
- Practice directions and circulars that can be tied to a stable official source.
- Sarawak-specific family, employment, commercial, company, insolvency, public-law, local-government and state-regulatory practitioner propositions.
- Matter-specific NCR and community-custom authorities; no custom should be generalised across communities.

## Verification completed

- Landing-page TypeScript check: passed.
- Sarawak and LAWYes fixture tests: 7 passed.
- Landing-page production build: passed.
- Desktop browser test: passed.
- 390 x 844 mobile browser test: passed.
- Jurisdiction selector: passed.
- Practice Centre section navigation: passed.
- NCR search returning the Land Code: passed.
- Source metadata and official links: passed.
- Source audit download: passed.
- Source-led research showing 22 records: passed.
- Matter Studio deterministic draft and checklist: passed.
- Browser console: no errors.
- Runtime API/write-request check: passed; no application API or write requests observed.
- Existing API regression workflow: 1,067 tests passed across 102 files.

## Existing unrelated failures

- The configured E2E workflow still fails in the pre-existing MyCorpLegalAI draft test because the text `Practitioner` is not found after sign-in. This failure is outside the Safe Preview files and was not caused or altered by this work.
- The MyLitAI IRAC development workflow reports an existing port-in-use failure.

## Production-release risks

1. The Safe Preview is static and intentionally not connected to production data or subscriber sessions.
2. A production release must not treat source discovery as publication approval.
3. Sarawak reports require full-judgment review, paragraph verification, legal-editor approval and rights approval.
4. Registry procedures, fees, forms and timelines require current official confirmation before being presented as operational instructions.
5. DOCX packs are guided practitioner-review templates, not approved registry forms.
6. The jurisdiction model must be carried into the authenticated shared API and portal applications only after separate access-control and practice-scope testing.
7. Production release should remain blocked until a human reviewer signs off the content inventory and the unrelated E2E failure is understood.

## Recommendation

Keep this version in Safe Preview for practitioner review. The next content milestone should be a small, high-quality set of full Sarawak judgments converted into paragraph-verified, lawyer-reviewed reports, followed by instrument-by-instrument verification of registry forms, fees and deadlines.