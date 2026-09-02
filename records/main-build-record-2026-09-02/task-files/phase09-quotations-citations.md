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
