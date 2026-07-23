# Phase 04 Completion Report — Page-Level Extraction & OCR Adapters

- **Phase**: 04 (Extraction)
- **Date**: 2026-07-23
- **Status**: PASS

## Objective

Extract every ingested source container into immutable page-level records
with full provenance (container → extraction run → page → block →
character offsets), behind four independently replaceable adapters
(native text extraction, page-image rendering, OCR, layout analysis).
Uncertainty is preserved as structured warnings — never guessed text.
Low-quality pages route automatically to human review, and a staff-only
page-review UI supports append-only corrections. No external AI/OCR
services; synthetic fixtures only.

## Implementation Summary

1. **OCR benchmark & decision record** — Local-only benchmark
   (`artifacts/api-server/scripts/ocr-benchmark.ts`) of tesseract, ocrad,
   and gocr against synthetic scanned fixtures, recorded in
   `docs/reports/phase-04-ocr-benchmark.md`. Tesseract (eng+msa) selected;
   full architecture in ADR 0005
   (`docs/decisions/0005-phase-04-extraction.md`).
2. **Schema & migration** — Additive migration
   `lib/db/sql/migrations/0006-phase04-extraction.sql` adds
   `research_extraction_runs` (processor version, adapter identities,
   checksums, status), `research_source_pages` (immutable page unit),
   `research_page_extractions` (mode NATIVE/OCR, raw text, image
   sha/storage key, OCR confidence, rotation, language), 
   `research_text_blocks` (reading order, bounding boxes, block types,
   char offsets), `research_page_warnings` (structured codes with
   coordinates), and `research_page_corrections` (append-only versions).
   Audit `entityType` widened with `page_extraction`.
3. **Adapter contracts & implementations** — Registry extended with four
   independent, versioned, disable-safe interfaces: native text extractor
   and page renderer (poppler: `pdftotext`/`pdftoppm` via
   `extraction/popplerAdapters.ts`), OCR engine
   (`extraction/tesseractOcr.ts`, eng+msa, TSV confidence, rotation via
   OSD), layout analyzer (`extraction/layoutAnalyzer.ts`: column
   detection, reading-order reconstruction, header/footer heuristics).
   A disabled adapter routes work to review (`OCR_REVIEW_REQUIRED` +
   `POSSIBLE_MISSING_TEXT`), never fakes output.
4. **Extraction pipeline** — `extraction/pipeline.ts`: resumable,
   idempotent `container.extract` jobs (rights-gated, fail-closed).
   Per-page native-vs-scanned detection; native pages get blocks,
   reading order, coordinates, contiguous character offsets; scanned
   pages get stored page image (sha-256 provenance), OCR text,
   confidences, rotation, language indication. Quality thresholds:
   mean confidence <70 ⇒ `LOW_OCR_CONFIDENCE` + review; word
   confidence <40 ⇒ `ILLEGIBLE_REGION`; a page accumulating ≥2
   structured warnings routes to review even when mean confidence is
   high. Reruns after review resolution use rerun-safe idempotency
   keys (a new job per finished attempt), and the state machine only
   advances when a job was actually enqueued — a deduplicated request
   can never strand a container. All uncertainty stored as structured warning codes
   (ILLEGIBLE_REGION, LOW_OCR_CONFIDENCE, POSSIBLE_MISSING_TEXT,
   READING_ORDER_UNCERTAIN, PAGE_ROTATION_UNCERTAIN,
   LANGUAGE_UNCERTAIN) with coordinates; raw output is immutable. Every
   run records a reviewable `extraction` transformation.
   Storage keys are always the canonical keys returned by the storage
   adapter (fixes a latent prefix mismatch against real object storage).
5. **Routes & page-review UI** — `routes/extraction.ts` (staff-only,
   deny-by-default): start extraction (202), list pages, page detail
   (raw text, blocks, warnings, correction history), original page-image
   stream, append-only corrections (raw output never overwritten;
   reviewer, reason, date, processor version, atomic audit event).
   `routes/reviewUi.ts` serves the server-rendered review screen at
   `GET /api/research/containers/:id/review-ui`.
6. **Health** — research health endpoint reports phase "04" and the
   status of all four extraction adapters.

## Fixtures (all synthetic, `fixtures/synthetic/extraction/`)

Generated deterministically by
`artifacts/api-server/scripts/generate-extraction-fixtures.ts`:
native-clean, native-two-column, native-footnotes-tables,
native-mixed-language, native-blank-pages PDFs; scanned-judgment.pdf;
clean/faint/noisy/rotated scan PNGs with `scan-ground-truth.txt`.
No real judgments; nothing leaves the machine.

## Proof tests

| Acceptance criterion | Test |
|---|---|
| Native extraction: immutable pages, blocks, contiguous char offsets, transformation recorded | `phase04.test.ts` native suite |
| Idempotency: re-running extraction creates no duplicate pages | `phase04.test.ts` idempotency test |
| OCR path: page image stored with sha provenance, OCR text/confidence, threshold-based review routing | `phase04.test.ts` OCR suite |
| Disabled OCR adapter ⇒ review routing with `POSSIBLE_MISSING_TEXT`, empty raw text, no guessed content | `phase04.test.ts` OCR-disabled test |
| Two-column reading-order reconstruction | `phase04.test.ts` layout test |
| Web layer: 202 start, pages/detail/image, corrections v1→v2 append-only, audit, review-ui HTML, guest 403s | `phase04.test.ts` supertest suite |

## Verification

- Full api-server suite: **17 files, 133 tests, all passing**
  (125 pre-existing preserved; 8 new).
- `pnpm run typecheck`: clean across the workspace.
- Migration applied to the dev database; server boots against it.
- **Browser test (real Chromium, Clerk-authenticated staff user)**:
  navigated to the review UI, verified page list (OCR mode), original
  scanned page image, raw OCR text, blocks/warnings panels, submitted a
  correction and verified it in the correction history — all passed.

## Invariants preserved

Deny-by-default access, rights gating (fail-closed content-touching
jobs), append-only audit, source-container principle, judicial-text
integrity (raw extraction immutable; corrections are versions),
uncertainty preserved as structured warnings (no guessed text), no
external AI/OCR calls, no mocks in production code, synthetic fixtures
only.

## Rights or licensing implications

None new. Extraction jobs run only on rights-approved containers; page
images and text inherit the container's rights status; restricted
content never appears in logs (keys and sizes only).

## Rollback instructions

Revert the Phase 04 code and drop the five `research_*` extraction
tables added by `0006-phase04-extraction.sql`
(`research_page_corrections`, `research_page_warnings`,
`research_text_blocks`, `research_page_extractions`,
`research_source_pages`, `research_extraction_runs`). The migration is
additive; earlier phases are unaffected.

## Out of scope (deferred as planned)

Case-candidate segmentation (Phase 05), duplicate/version consolidation
(Phase 06), search UI (Phase 07), AI aids (Phase 08).

## Recommended next phase

Phase 05 — Case-candidate segmentation over the extracted page/block
records.
