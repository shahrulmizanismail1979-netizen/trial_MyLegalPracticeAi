# Phase 04 OCR Benchmark — Safe Local Engines

- **Date**: 2026-07-23
- **Constraint**: no document content may leave the machine (no external
  AI/OCR services). Only locally-runnable engines were considered.
- **Fixtures**: synthetic scanned pages in `fixtures/synthetic/extraction/`
  (rendered at 200 dpi from `native-clean.pdf`, then degraded): clean,
  rotated (~2.4° skew), faint (washed-out/low-contrast), noisy (Gaussian
  noise, grayscale). Ground truth: `scan-ground-truth.txt`.
- **Method**: `artifacts/api-server/scripts/ocr-benchmark.ts` — character
  accuracy = 1 − Levenshtein distance / ground-truth length after whitespace
  normalisation; wall-clock time per page.

## Candidates

| Engine | Availability | Notes |
| --- | --- | --- |
| Tesseract 5.5.0 | Nix system package | 129 languages incl. `eng` and `msa` (Malay); TSV word confidences; OSD orientation/script detection |
| GNU Ocrad 0.27 | Nix system package | Latin-only, no confidence output, no rotation handling |
| GOCR 0.52 | Nix system package | Latin-only, no confidence output, no rotation handling |
| tesseract.js (WASM) | npm | **Excluded**: fetches trained language data from a CDN at runtime by default; same underlying engine as native Tesseract but slower, with an added network dependency that conflicts with the local-only constraint |
| Cloud OCR (Azure/Google/AWS) | — | **Excluded by policy**: document content must not leave the machine |

## Results

| Engine | Fixture | Char accuracy | Time (ms) |
|---|---|---|---|
| tesseract (eng, psm 3) | scan-clean.png | 98.8% | 4908 |
| tesseract (eng, psm 3) | scan-rotated.png | 97.9% | 4115 |
| tesseract (eng, psm 3) | scan-faint.png | 99.3% | 4467 |
| tesseract (eng, psm 3) | scan-noisy.png | 99.1% | 4417 |
| tesseract (eng+msa, psm 3) | scan-clean.png | 98.8% | 8526 |
| tesseract (eng+msa, psm 3) | scan-rotated.png | 97.7% | 6565 |
| tesseract (eng+msa, psm 3) | scan-faint.png | 99.1% | 7396 |
| tesseract (eng+msa, psm 3) | scan-noisy.png | 98.8% | 8455 |
| ocrad | scan-clean.png | 95.6% | 550 |
| ocrad | scan-rotated.png | 91.6% | 536 |
| ocrad | scan-faint.png | 94.4% | 518 |
| ocrad | scan-noisy.png | 94.7% | 550 |
| gocr | scan-clean.png | 89.8% | 615 |
| gocr | scan-rotated.png | 73.1% | 632 |
| gocr | scan-faint.png | 88.4% | 589 |
| gocr | scan-noisy.png | 88.4% | 629 |

Additional observations:

- Tesseract TSV output provides per-word confidence (`scan-faint.png`:
  n=69 words, mean 88.3, min 18.9) — this is what powers the
  `LOW_OCR_CONFIDENCE` / `ILLEGIBLE_REGION` warnings with coordinates.
  Neither ocrad nor gocr reports confidence at all.
- Tesseract OSD (`--psm 0`) reports orientation and script with confidence
  values; low orientation confidence feeds `PAGE_ROTATION_UNCERTAIN`.
- gocr degrades badly on rotation (73.1%); ocrad loses ~4 points. Tesseract
  handles the 2.4° skew internally (97.9%).
- `eng+msa` costs ~1.6–2× time for identical accuracy on English text; it is
  the right default for this platform's bilingual (English/Bahasa Melayu)
  corpus, and language selection stays configurable per run.

## Selection

**Tesseract 5.5 (`eng+msa`, `--psm 3`, TSV output)** is selected as the
initial OCR adapter: highest accuracy on every degraded fixture, the only
candidate with word-level confidence and coordinates (required for
structured warnings), orientation/script detection, and Malay support.
Recorded in ADR 0005. The adapter interface keeps the engine replaceable.
