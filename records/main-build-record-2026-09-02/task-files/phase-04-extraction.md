# Phase 04: Page-Level Extraction & OCR Adapters

## What & Why
Implement Phase 04 (Extraction) of the Judgment Research Platform: page-level text extraction from ingested source containers, with the source page as the smallest immutable provenance unit. Extraction runs behind four separately replaceable adapters (native text extraction, page-image rendering, OCR, layout analysis) so the platform is never coupled to one OCR engine. Follow docs/BUILD_PROMPT.md: read charter/architecture/phase docs first; phase-scope-only; synthetic fixtures only; no external AI services.

## Done looks like
- Every ingested document can be extracted into immutable page records with full provenance (container → page → block → character offsets, coordinates where the format supports them)
- Native-text pages capture page number, text blocks, reading order, bounding boxes/font/style metadata where available, header/footer/column detection, and character offsets
- Scanned pages capture the original page image, OCR text, confidence data, text-region coordinates, rotation, language indication, and processing warnings
- Uncertainty is stored as structured warning codes (ILLEGIBLE_REGION, LOW_OCR_CONFIDENCE, POSSIBLE_MISSING_TEXT, READING_ORDER_UNCERTAIN, PAGE_ROTATION_UNCERTAIN, LANGUAGE_UNCERTAIN) with source coordinates — never guessed replacement text; display may render a visible marker but the record preserves the warning
- A page-review interface shows original page, extracted text, detected blocks, OCR warnings, reviewer corrections, and correction history; corrections never overwrite raw extraction and store raw output, corrected output, reviewer, reason, date, and processor version
- Low-quality pages automatically enter the review queue
- A benchmark of safe (local, no-external-AI) OCR options against synthetic fixtures is run and recorded before the initial OCR adapter is selected, with the choice documented in a decision record
- All tests green (existing 125 preserved), typecheck clean, completion report in docs/reports/ and docs/status/current-phase.json updated

## Out of scope
- Case-candidate segmentation (Phase 05), consolidation (Phase 06), search UI (Phase 07), AI aids (Phase 08)
- Sending any document content to external AI/OCR services
- Processing real restricted legal documents (synthetic fixtures only)

## Steps
1. **ADR + schema** — Decision record for the extraction architecture; new `research_*` tables for pages, page images, text blocks, extraction runs (processor version, adapter identity, checksums), warnings, and page corrections (append-only version history); migration tested for apply + boot.
2. **Adapter contracts** — Extend the adapter registry with four independent interfaces: native text extractor, page-image renderer, OCR engine, layout analyzer; each versioned, disable-safe (unconfigured adapter routes work to human review, never fakes output).
3. **OCR benchmark** — Evaluate available safe local OCR options (e.g. Tesseract-based engines runnable in this environment) against synthetic scanned fixtures; record accuracy/confidence/rotation handling results in a benchmark report and select the initial adapter via the ADR.
4. **Extraction pipeline** — Resumable, idempotent extraction jobs per container: detect native-text vs scanned pages, run the appropriate adapter chain, persist immutable page records with provenance and structured warnings, route low-quality pages to review, respect rights gating (fail closed).
5. **Page-review interface** — Staff-only review screens showing original page image, extracted text, detected blocks, warnings, and correction history; corrections stored as new versions alongside untouched raw output, with atomic audit events.
6. **Fixtures + tests** — New synthetic fixtures: clean native text, two-column text, rotated scans, faint scans, page numbers, repeated headers, footnotes, tables, mixed languages, blank pages; tests covering traceability, raw-output preservation, correction versioning, review routing, and no-silent-guessing; browser-based testing of the review UI.
7. **Close-out** — Formatting/typecheck/full test run; completion report in docs/reports/; update docs/status/current-phase.json to Phase 05 next.

Note: critical architectural constraints — the source page is immutable once extracted; corrections are append-only versions; uncertainty is preserved as structured warnings with coordinates, never replaced with guessed text; all four adapters must remain independently swappable.

## Relevant files
- `docs/BUILD_PROMPT.md`
- `docs/PHASES.md`
- `docs/ARCHITECTURE.md`
- `docs/status/current-phase.json`
- `docs/reports/phase-03-completion.md`
- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/processing/queue.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/ingestion/service.ts`
- `artifacts/api-server/src/research/storage/objectStorageAdapter.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `lib/db/src/schema/research.ts`
- `fixtures/synthetic/README.md`
