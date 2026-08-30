# LAWYes Sarawak Safe Preview audit

**Review date:** 30 August 2026
**Release boundary:** Static Safe Preview only. No production API, database, Drive, upload, billing, subscriber entitlement, or local-storage changes.

## Sources reviewed

The fixture records direct HTTPS links, source type, jurisdiction, rights status, last-verified date, editorial status, and audit notes for:

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

Each practice card is verification-required. It is a source-discovery path, not a completeness or legal-content claim.

## Practical packs and precedents

Three practitioner-review templates are included:

- Civil application / affidavit pack.
- Criminal representation / bail / mitigation pack.
- Sarawak land / NCR transaction pack.

Each pack includes guided intake, facts/exhibits, jurisdiction and registry checks, cause-paper or working-document structure, filing/service readiness prompts, editable notes, source references, risk flags, and TXT/DOCX/print-ready PDF export. No template is presented as an approved court form or filing instruction.

## Verification gaps

- Individual Sarawak instruments, amendments, subsidiary legislation, Gazettes, practice directions, forms, fees, timelines, and registry requirements need item-level review.
- No Sarawak-specific substantive case report has cleared all publication gates.
- Appellate and subsequent treatment must be verified per report before publication.
- Land category, title status, NCR status, native custom, consent, instrument, and transaction consequences are not inferred by the decision tree.
- Professional-association source availability and currency require re-checking.
- The preview does not claim complete corpus, publisher equivalence, or production readiness.

## Validation record

The implementation passed:

- Seven fixture tests covering publication gates, provenance, search aliases, jurisdiction, exports, and isolation.
- Landing-page TypeScript checking and production build.
- Desktop 1440 × 1000 and mobile 390 × 844 browser checks covering the four-action opening, progressive search filters, empty/reset states, report selection, guided drafting, the demonstration matter flow, six Practice Centre categories, Sources & Verification, browser Back, keyboard focus and horizontal overflow.
- Browser download events confirmed non-empty published-report TXT (6,212 bytes) and DOCX (9,352 bytes), result CSV (2,238 bytes) and JSON (28,430 bytes), and drafting-pack TXT (887 bytes) and DOCX (2,931 bytes).
- A permanent browser regression test confirms that a selected published report exposes its report-specific official judgment URL, separately from the generic source-register gateway.
- Source-code and browser isolation checks found no preview-originated application API, storage, account, upload, payment, AI, persistence or server-write request.
- Existing API regressions: 1,067 tests passed across 102 files.

The configured multi-portal E2E workflow still fails in the pre-existing MyCorpLegalAI draft test because the expected `Practitioner` text is absent after sign-in. The failure is outside `/lawyes-safe-preview` and this work did not alter that portal.

## Production-release risks

This work must not be promoted as production legal content without a separate source audit, lawyer review, rights confirmation, authenticated permissions test, tenant-isolation test, and production release approval. Production data and subscriber entitlements were intentionally not touched.