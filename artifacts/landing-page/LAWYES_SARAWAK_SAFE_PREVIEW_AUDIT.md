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

- Six official/public gateway records were reachable and recorded as verified-current on the review date.
- One professional-association gateway was intermittent and remains verification-required.
- Sarawak LawNet is exposed as the legislation discovery source, but every individual instrument still requires an item-level currency and amendment check.
- National and federal material remains available and visibly distinct from Sarawak-specific material.

## Reports

- Two existing Sabah and Sarawak e-Kehakiman reports remain published because their source, paragraph support, and human approval are recorded.
- Zero Sarawak-specific substantive reports are published in this preview.
- The Kuching land judgment and Native Court pathway are access records only. They remain blocked from substantive report export pending official provenance, stable paragraph mapping, complete report-schema review, and lawyer approval.
- No AI editorial draft is represented as lawyer-reviewed or published.

## Practice coverage

The structured Sarawak discovery model covers civil, criminal, conveyancing/land, Native law, professional practice, probate/estates, family, employment, commercial/company, insolvency, public law, local government, and state regulatory work.

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
- Desktop and 390 × 844 browser checks covering navigation, jurisdiction switching, empty state, source links, filters, report access, document intake, safe export controls, and horizontal overflow.
- Browser download events confirmed non-empty report TXT/DOCX and drafting-pack TXT/DOCX files with the expected filename extensions.
- A source-code and browser isolation check confirming no network client, application endpoint, storage, account, upload, payment, or server-write integration exists in the preview.

The shared landing-page document loads its existing Google Fonts stylesheet as a presentation asset. No runtime application-data request was observed after the preview loaded.

## Production-release risks

This work must not be promoted as production legal content without a separate source audit, lawyer review, rights confirmation, authenticated permissions test, tenant-isolation test, and production release approval. Production data and subscriber entitlements were intentionally not touched.