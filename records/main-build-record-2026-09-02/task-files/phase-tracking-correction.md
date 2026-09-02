# Phase Tracking Correction (Phases 08–14)

## What & Why

The phase discipline requires each phase to end with a completion report in `docs/reports/` and an update to `docs/status/current-phase.json`. Phases 08–14 were implemented and tested by task agents — 488 tests pass, the pilot acceptance gate passes — but none of these required completion artefacts were produced. `current-phase.json` is frozen at phase 07. `PHASES.md` does not define phases 10–14. No ADRs exist for phases 09–14. Any operator or future agent reading the tracking files will believe the platform is at phase 07 and risk re-implementing or breaking work that already exists.

This task writes the missing documentation only. No code changes.

## Done looks like

- `docs/PHASES.md` defines all phases 00–14 with accurate scope descriptions.
- `docs/reports/` contains completion reports for phases 08–14, each covering: objective, deliverables (key modules/tables/routes), state machine changes, test counts, key design decisions, and the PHASE:/STATUS:/CHECKPOINT: footer.
- `docs/decisions/` contains ADRs 0010–0015 for phases 09–14 (phase 08 already has ADR 0009).
- `docs/status/current-phase.json` shows phase 14 as the latest completed phase.
- `docs/PRODUCTION_READINESS.md` includes a brief note that the phase tracking was stale at initial writing and has been corrected by this task.

## Out of scope

- Code changes of any kind.
- New tests.
- Changes to any research platform source files.
- Writing production readiness documentation (Task #93 already completed that).

## Steps

1. **Read the evidence** — For each phase 08–14, read the corresponding task plan in `.local/tasks/` and the test file in `artifacts/api-server/src/research/phase*.test.ts` to extract deliverables and design decisions.

2. **Extend PHASES.md** — Add table rows for phases 10–14. Phase 09 (AI Research Aids / Quotations) is listed but its scope may need clarification. Phases 10–14 are: Authorities & Legislation, Research Workspace, Audit Hardening, Exports & Retention, Security Hardening, Controlled Pilot.

3. **Write phase completion reports (phases 08–14)** — One report per phase in `docs/reports/phase-08-completion.md` through `docs/reports/phase-14-completion.md`. Base each report on the test file assertions and the task plan's "Done looks like" section.

4. **Write ADRs (phases 09–14)** — One ADR per phase in `docs/decisions/0010-phase-09-*.md` through `docs/decisions/0015-phase-14-*.md`. Each ADR documents the key design decisions that future maintainers need to be consistent with.

5. **Update current-phase.json** — Set phase to "14", status to "complete", completedAt to the date the pilot passed (2026-07-29), and report to "docs/reports/phase-14-completion.md". Record previous phase as 13.

6. **Amend PRODUCTION_READINESS.md** — Add a one-sentence note to the header area: "Phase tracking was stale (frozen at phase 07) at the time of initial writing; corrected by the phase-tracking-correction task (2026-07-30)."

## Relevant files

- `.local/tasks/phase-08-search-research-ui.md`
- `.local/tasks/phase09-quotations-citations.md`
- `.local/tasks/phase10-ai-headnotes-analysis.md`
- `.local/tasks/phase11a-authorities-legislation.md`
- `.local/tasks/phase11b-research-workspace.md`
- `.local/tasks/phase12a-audit-events.md`
- `.local/tasks/phase12b-exports.md`
- `.local/tasks/phase12c-retention-deletion.md`
- `.local/tasks/phase12d-security.md`
- `.local/tasks/phase14-controlled-pilot.md`
- `artifacts/api-server/src/research/phase08.test.ts`
- `artifacts/api-server/src/research/phase09.test.ts`
- `artifacts/api-server/src/research/phase10.test.ts`
- `artifacts/api-server/src/research/phase11a.test.ts`
- `artifacts/api-server/src/research/phase11b.test.ts`
- `artifacts/api-server/src/research/phase12a.test.ts`
- `artifacts/api-server/src/research/phase12b.test.ts`
- `artifacts/api-server/src/research/phase12c.test.ts`
- `artifacts/api-server/src/research/phase12d-security.test.ts`
- `artifacts/api-server/src/research/pilot.test.ts`
- `docs/status/current-phase.json`
- `docs/PHASES.md`
- `docs/decisions/0009-phase-08-search-research-ui.md`
- `docs/PRODUCTION_READINESS.md`
