# Fix test cleanup so FK failures can't hide real bugs

## What & Why
Three test files (phase05, phase06, stress) currently fail during their cleanup steps because child tables are deleted after parent tables, violating foreign key constraints:
- `research_cross_file_relationships` must be deleted before `research_case_candidates`
- `research_candidate_coherence_checks` must be deleted before `research_case_candidates`
- `research_editorial_runs` must be deleted before `research_source_containers`

When cleanup throws, the test runner reports a suite-level error that looks like a real failure, which makes it easy to overlook genuine regressions hiding underneath.

## Done looks like
- All three test files complete cleanup without FK errors
- Test output shows passes/failures for the actual test assertions only, not cleanup noise
- Deleting child-table rows (cross_file_relationships, coherence_checks, editorial_runs) happens before their parent rows in every cleanup block

## Out of scope
- Changing test assertions or test logic (cleanup only)
- Switching to isolated schemas (that pattern is already used in stateMachines.test.ts and is not needed here)

## Steps
1. **Audit cleanup blocks** — in phase05.test.ts, phase06.test.ts, and stress.test.ts, find every `afterEach`/`afterAll` cleanup block that deletes from `researchCaseCandidates` or `researchSourceContainers`.
2. **Delete child rows first** — before deleting candidates, delete from `researchCrossFileRelationships` and `researchCandidateCoherenceChecks` where `candidateId` is in the tracked set; before deleting containers, delete from `researchEditorialRuns` where `containerId` is in the tracked set.
3. **Verify** — run the full test suite and confirm the three files no longer produce suite-level FK errors.

## Relevant files
- `artifacts/api-server/src/research/phase05.test.ts`
- `artifacts/api-server/src/research/phase06.test.ts`
- `artifacts/api-server/src/research/stress.test.ts`
