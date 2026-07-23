# Phases — Judgment Research Platform

The agent implements **only the active phase** and stops after producing the
completion report in `docs/reports/` and updating
`docs/status/current-phase.json`.

| Phase | Name                                             | Scope                                                                                                                                                                                                                                                                                         |
| ----- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00    | Bootstrap                                        | Persistent docs, module architecture, `research_*` schema, adapter registry, DB-backed job queue skeleton, synthetic fixtures, smoke tests. **No extraction, OCR, segmentation, or AI.**                                                                                                      |
| 01    | Core Architecture, State Machines & Test Harness | Full entity set; 20-state container machine and 8-state job machine (guarded transitions, atomic audit events); processor contract (versioning, idempotency, checksums, structured failures, provenance); DB-isolated test harness, fixture factory, golden files, browser e2e. See ADR 0002. |
| 02    | Ingestion                                        | Upload/registration of folders and ZIP archives; checksum duplicate detection; staging to private storage; rights-review queue UI.                                                                                                                                                            |
| 03    | Extraction                                       | Text extraction from digital documents behind the OCR/extraction adapters; span model; provenance down to character ranges.                                                                                                                                                                   |
| 04    | Segmentation                                     | Case-candidate detection inside containers (zero/one/many per file, splits across files); human review of candidates.                                                                                                                                                                         |
| 05    | Consolidation                                    | Duplicate/version resolution; merge/split as reviewable transformations; publisher-content isolation enforcement.                                                                                                                                                                             |
| 06    | Search & Research UI                             | Search adapter implementation; research workspace surfaced to the portals.                                                                                                                                                                                                                    |
| 07    | AI Research Aids                                 | Evidence-backed AI propositions (paragraph-level citations); AI remains a separate layer, disabled by default.                                                                                                                                                                                |

Phase boundaries are strict: later-phase functionality must not be smuggled
into an earlier phase. Changes to this table require a decision record in
`docs/decisions/` (Phase 01's redefinition is recorded in
`docs/decisions/0002-phase-01-redefined-core-architecture.md`).
