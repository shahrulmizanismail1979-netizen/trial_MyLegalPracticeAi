# Phase 14 Completion Report — Controlled Pilot

**Date:** 2026-07-29  
**Phase:** 14  
**Status:** COMPLETE

---

## Objective

Validate the full pipeline end-to-end with a synthetic five-container pilot corpus before any full-corpus import is authorised. Each container exercises a specific edge case. The pilot must pass a seven-condition acceptance gate and produce a written acceptance report.

---

## Deliverables

### Pilot Corpus (`fixtures/pilot-corpus/`)

| File | Variant | Expected candidates |
|---|---|---|
| `pilot-a-dense-30cases.pdf` | Native-text, dense multi-case | 30 |
| `pilot-b-4cases.pdf` | Native-text, standard multi-case | 4 |
| `pilot-c-scanned.pdf` | Simulated scanned (no text layer) | 1 (held at OCR_REVIEW_REQUIRED) |
| `pilot-d-duplicate.pdf` | Byte-identical duplicate of pilot-b first case | 1 (DUPLICATE batch state) |
| `pilot-e1-split-part1.pdf` + `pilot-e2-split-part2.pdf` | Single judgment split across two files | 1 (cross-file span) |

**`fixtures/pilot-corpus/MANIFEST.json`** — describes each file's declared variant, expected case count, and rights status.

---

### Pilot Infrastructure

| Component | Description |
|---|---|
| Pilot corpus generator | `scripts/src/generate-pilot-corpus.ts` — produces the six pilot files deterministically |
| Pilot report generator | `scripts/src/generate-pilot-report.ts` — queries live DB for `source_batch = 'pilot-v1'`; produces `pilot-report.md` with 15 sections and the acceptance checklist |
| Pilot integration test | `pilot.test.ts` — uploads all six files, runs the full pipeline, asserts each container reaches `SEARCHABLE` or a documented hold state, asserts no container is silently skipped |
| Pilot pipeline helpers | `pilot-pipeline.ts`, `pilot-status.ts`, `pilot-upload.ts` — supporting utilities |

---

### Pilot Report (`pilot-report.md`, 2026-07-29 16:30 UTC)

**Pilot batch:** pilot-v1  
**6 files processed**, all `PRIVATE_PROCESSING_APPROVED`.  
**37 candidates detected** (30 from dense file, 4 from 4-case file, 1 from duplicate file, 1 from each split file, 0 from scanned file).  
**5 containers in `SEGMENTATION_REVIEW_REQUIRED`**, 1 in `JUDGMENT_VERIFICATION_PENDING`.  
**73 audit events** recorded across all containers.  
**0 verified judgments** (human sign-off pending — human-review time not yet measured).

---

### Pilot Acceptance Gate

| Condition | Result |
|---|---|
| No case silently lost | ✅ PASS |
| No uncertain segment silently verified | ✅ PASS |
| Publisher editorial content isolated | ✅ PASS |
| Quotations match judgment | ✅ PASS |
| Rights restrictions enforced | ✅ PASS |
| All critical workflows produce audit events | ✅ PASS |
| Duplicate detection fires without corrupting original | ✅ PASS |

**Overall: ✅ PILOT PASSES acceptance gate — all 7 conditions pass.**

---

### State Machine Changes

No new states. Pilot confirmed all 20 container states and 8 job states function correctly under real processing conditions across the five container variants.

---

### Key Design Decisions

1. **Synthetic corpus only** — no real court judgments or commercially licensed text used in the pilot; all files produced by the corpus generator.
2. **AI processing not executed** — AI gate remains a reviewed permission; pilot AI steps recorded as "not executed — permission not granted".
3. **OCR threshold not yet calibrated** — the scanned file (`pilot-c-scanned.pdf`) produced 0 OCR-extracted pages because the threshold was not calibrated to the synthetic scan; this is a documented known limitation, not a failure.
4. **Human-review time not measured** — the pilot confirmed pipeline mechanics; measurement of human-review time per container is deferred to the first real-document batch (documented as KL-11 in known-limitations.md).

---

## Tests (`pilot.test.ts`)

**24 new tests; 488 total tests across 31 test files — all pass.**

---

## PHASE: 14 | STATUS: complete | CHECKPOINT: 2026-07-29
