# ADR 0005 — Phase 04: Page-Level Extraction & OCR Adapters

- **Date**: 2026-07-23
- **Status**: Accepted
- **Phase**: 04 (Extraction)

## Context

Ingested source containers (Phase 03) must be extracted into page-level text
with full provenance. The charter requires: the source page as the smallest
immutable provenance unit; uncertainty preserved as structured warnings,
never guessed text; corrections as append-only versions; and no document
content ever leaving the machine (no external AI/OCR).

## Decisions

### 1. Four independent, replaceable adapters

The adapter registry (`research/adapters.ts`) gains four extraction
interfaces, each versioned and independently swappable:

| Adapter | Interface | Initial implementation |
| --- | --- | --- |
| Native text extraction | `NativeTextExtractorAdapter` | Poppler `pdftotext -bbox-layout` (word boxes per page) + plain-text passthrough for `text/plain` |
| Page-image rendering | `PageImageRendererAdapter` | Poppler `pdftoppm` (200 dpi PNG) |
| OCR | `OcrAdapter` (reworked) | Tesseract 5.5, `eng+msa`, `--psm 3`, TSV output (word confidences + coordinates); OSD for orientation |
| Layout analysis | `LayoutAnalyzerAdapter` | In-repo TypeScript analyzer over word boxes: reading order, column detection, header/footer detection, block grouping |

An unconfigured/disabled adapter never fakes output: work that needs it is
routed to human review (`ReviewRequiredSignal`), exactly like the Phase 00
OCR stub.

**OCR engine selection** follows the benchmark in
`docs/reports/phase-04-ocr-benchmark.md`: Tesseract beat ocrad and gocr on
every degraded fixture (97.7–99.3% vs 73.1–95.6%) and is the only local
engine with word-level confidence, coordinates, orientation detection, and
Malay (`msa`) support. tesseract.js and all cloud OCR were excluded (runtime
network dependency / content leaves the machine).

### 2. Data model — immutable pages, append-only corrections

New/extended `research_*` tables (migration `0006-phase04-extraction.sql`):

- `research_source_pages` (existing) remains page identity, unique
  `(container_id, page_number)`.
- `research_extraction_runs` — one row per extraction execution of a
  container: job linkage, processor version, the exact adapter set (names +
  versions) as jsonb, source checksum, page count, status. Unique
  `(container_id, run_key)` makes re-execution idempotent.
- `research_page_extractions` — the immutable extraction record per page per
  run: mode (`NATIVE` | `OCR`), raw text (never edited afterwards),
  container-level character offsets (`char_start`/`char_end`), page-image
  storage key + SHA-256, OCR mean confidence, detected rotation, detected
  languages, provenance. Unique `(run_id, page_id)`.
- `research_page_blocks` — detected text blocks per page extraction: type
  (paragraph/header/footer/footnote/table/column…), text, bounding box,
  character offsets within the page, reading order, column index, font
  metadata where the format supplies it, confidence.
- `research_page_warnings` — structured uncertainty:
  `ILLEGIBLE_REGION`, `LOW_OCR_CONFIDENCE`, `POSSIBLE_MISSING_TEXT`,
  `READING_ORDER_UNCERTAIN`, `PAGE_ROTATION_UNCERTAIN`,
  `LANGUAGE_UNCERTAIN` — each with source coordinates and detail. Warnings
  are data, not text: extracted text never contains guessed replacements.
- `research_page_corrections` — append-only versions: raw output reference,
  corrected text, reviewer, reason, processor version, timestamp. Unique
  `(page_extraction_id, version)`; corrections never overwrite the raw
  extraction row.

### 3. Pipeline behaviour

- `container.extract` is a content-touching, rights-gated processor
  (fail-closed, Phase 02 rules), resumable and idempotent: pages already
  extracted for the same run key are skipped on re-execution.
- Per-page mode detection: pages with a native text layer use the native
  extractor; image-only pages are rendered and OCR'd. The original page
  image is stored for every OCR'd page.
- Quality gates: mean OCR confidence below threshold, low-confidence word
  clusters, uncertain rotation/language, or empty text on a non-blank page
  emit warnings; any page with warnings at/above review severity routes the
  container to `OCR_REVIEW_REQUIRED` and opens a review item. Blank pages
  are recorded as blank (POSSIBLE_MISSING_TEXT only when inconsistent with
  inventory expectations).
- Container states follow the existing machine:
  `EXTRACTION_PENDING → TEXT_EXTRACTED` or `→ OCR_REVIEW_REQUIRED`
  (re-entering via review resolution).

### 4. Review surface

Staff-only routes and UI: page list per container, page detail (original
image via signed access, raw text, blocks, warnings, correction history),
and `POST` correction (append-only version + atomic audit event).

## Consequences

- OCR runs in-process via the system Tesseract binary; deployments must
  include the `tesseract` Nix dependency (already added to the environment).
- Poppler utilities (`pdftotext`, `pdftoppm`) become runtime dependencies of
  extraction; both ship in the platform runtime path.
- Adapter identity + version is recorded on every run, so a future engine
  swap is fully traceable.
