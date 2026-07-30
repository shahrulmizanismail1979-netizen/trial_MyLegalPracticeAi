# ADR 0015 — Phase 13 & 14: Stress Corpus and Controlled Pilot

**Status:** Accepted  
**Phase:** 13 (Stress Corpus) and 14 (Controlled Pilot)  
**Date:** 2026-07-28

## Context

After security hardening (Phase 12d), two pre-import validation phases were required before the full corpus could be loaded:

- **Phase 13** — establish the platform's capacity envelope using a 500-container synthetic corpus.
- **Phase 14** — validate the full pipeline end-to-end with a five-container synthetic pilot corpus; produce a signed acceptance report before authorising full-corpus import.

## Decisions

### D1 (13) — Synthetic corpus only; no real or licensed material

The stress corpus is produced by a deterministic generator script (`scripts/src/generate-stress-corpus.ts`). No real court judgments, commercially licensed text, or restricted material is used. The corpus is reproducible on demand and can be committed to source control.

### D2 (13) — Architectural tiers stated at observed thresholds

The capacity report (`stress-report.md`) documents four architectural tiers: Replit web process, Replit background worker, separate worker service, external dedicated infrastructure. Thresholds are stated at observed memory and throughput limits, not rounded down. Silent OOM and concealed resource exhaustion are explicitly prohibited.

### D3 (13) — Worker-handoff path preserves adapter interfaces

If bulk processing exceeds safe memory limits, `POST /queue/export` and `POST /queue/import` serialise and re-hydrate the job queue. The `StorageAdapter` and `AiProviderAdapter` interfaces are unchanged. The handoff is a topology concern, not an API change.

### D4 (14) — Five container variants cover the critical pipeline edge cases

The pilot corpus exercises: dense multi-case (30 candidates), standard multi-case (4 candidates), scanned PDF (OCR path), duplicate upload (duplicate detection), and cross-file split (cross-file reconstruction). This set was chosen to stress every gate in the pipeline rather than to maximise candidate count.

### D5 (14) — Acceptance gate is a formal checklist, not an informal assessment

The pilot report includes a 7-condition acceptance checklist where each condition is marked PASS or FAIL with notes. The gate cannot be "approximately" passed; all 7 conditions must be PASS before full-corpus import is authorised.

### D6 (14) — AI processing excluded from pilot

The AI gate remains a reviewed permission. AI steps are recorded as "not executed — permission not granted" in the report. This keeps the pilot focused on the structural pipeline guarantees and avoids introducing AI provider dependencies into the acceptance gate.

### D7 (14) — Human-review time deferred to first real-document batch

The pilot confirmed pipeline mechanics but did not measure human-review time per container (KL-11 in known-limitations.md). Time measurement is deferred to the first real-document batch, which requires a designated legal reviewer.

## Pilot Acceptance Gate Result

All 7 conditions: ✅ PASS. Pilot batch `pilot-v1` processed 2026-07-29; report at `pilot-report.md`.

## Consequences

- `scripts/src/generate-stress-corpus.ts` — synthetic corpus generator.
- `scripts/src/generate-pilot-corpus.ts` — pilot corpus generator.
- `scripts/src/generate-pilot-report.ts` — pilot report generator.
- `stress.test.ts` — 10 new tests (14 measurement dimensions).
- `pilot.test.ts` — 24 new tests (full pipeline end-to-end for 5 variants).
- `stress-report.md` — capacity envelope report.
- `pilot-report.md` — acceptance report (last updated 2026-07-29 16:30 UTC).
- Total test count after Phase 14: **488 tests across 31 test files — all pass.**

## Supersedes

Nothing. Extends ADR 0014.
