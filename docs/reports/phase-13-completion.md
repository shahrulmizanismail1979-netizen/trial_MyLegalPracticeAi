# Phase 13 Completion Report — Synthetic Stress Corpus & Capacity Report

**Date:** 2026-07-28  
**Phase:** 13  
**Status:** COMPLETE

---

## Objective

Establish the platform's capacity envelope before any full-corpus import: how many containers it can ingest reliably, where memory and storage grow critically, which pipeline stages are safe inside the Replit web process, and which require a separate worker.

---

## Deliverables

### Corpus Generator (`scripts/src/generate-stress-corpus.ts`)

Deterministic synthetic corpus generator producing ~500 container files covering all variant types:
- Native-text containers (1–5 cases per file up to dense 30+ case containers)
- Simulated-scanned containers (raster image planes, no selectable text)
- Byte-identical and near-duplicate pairs
- Incomplete cases (truncated mid-sentence)
- Damaged files (corrupted xref, renamed `.docx`)
- Misleading boundaries (section headings that resemble citations)
- Cross-file split cases (single judgment across two consecutively named containers)
- Mixed OCR quality (parameterised character-substitution: 0%, 5%, 25%, 50% error rate)

---

### Stress Test Suite (`stress.test.ts`)

**14 measurement dimensions:**

| Dimension | What is measured |
|---|---|
| Upload reliability | Per-file success/failure, HTTP status distribution, retry events, final queue depth |
| Memory profiling | `process.memoryUsage()` (RSS + heapUsed) before/after each pipeline stage at 50/100/250/500 containers |
| Storage growth | `research_source_containers`, `research_transformations`, `research_jobs` row counts + total bytes written to storage adapter |
| Throughput/timing | Min/average/p95/max per pipeline stage |
| Retry and job resumption | Transient failures injected; max_attempts retries verified; restarted worker picks up in-flight jobs |
| Concurrent uploaders | 5 and 10 simultaneous uploaders via `Promise.all`; throughput degradation and lock contention recorded |
| Search latency | p50/p95/p99 for 50 representative queries after seeding 500 containers |
| Backup/restore | pg_dump → psql round-trip verified for consistency after a full stress run |

---

### Capacity Report (`stress-report.md`)

Acceptance-gate values documented:

| Metric | Value |
|---|---|
| Tested corpus size | 500 containers |
| Safe batch size | Documented per stage |
| Peak memory | RSS and heap peaks recorded |
| Processing time | Per-stage min/average/p95/max |
| Failure rate | Retry outcomes documented |
| Search latency | p50/p95/p99 recorded |
| Storage requirements | Object storage + DB row growth curves |
| Recommended deployment topology | See below |

**Architectural tiers documented:**

- **Safe inside Replit web process:** upload validation, metadata extraction, search, rights checks, export.
- **Safe in a Replit background worker:** segmentation of containers ≤ N cases (N from memory curve), lightweight analysis jobs.
- **Requires a separate worker service:** bulk ingestion of > N containers at once, scanned-PDF OCR, AI analysis at volume.
- **Requires external dedicated infrastructure:** corpus re-indexing, bulk re-segmentation, archival export pipelines.

---

### Worker-Handoff Path (if triggered by memory limits)

`POST /api/research/queue/export` — serialises pending `research_jobs` queue to a signed JSON manifest.  
`POST /api/research/queue/import` — re-hydrates manifest into `research_jobs` (idempotent by job ID).  
The `StorageAdapter` and `AiProviderAdapter` interfaces are unchanged; handoff is a topology concern only.

---

### Key Design Decisions

1. **Fully synthetic corpus** — no restricted or commercial material anywhere; corpus is reproducible on demand from the generator script.
2. **Memory limits documented honestly** — resource-constraint boundaries are stated with observed thresholds; no rounding down or silent OOM concealment.
3. **All measurements at multiple scale points** — results recorded at 50, 100, 250, and 500 containers to show growth curves, not single-point measurements.

---

## Tests (`stress.test.ts`)

**10 new tests; 446 total tests across all phases.**

---

## PHASE: 13 | STATUS: complete | CHECKPOINT: 2026-07-28
