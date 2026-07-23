---
name: Research segmentation state machine path
description: Valid transition path through segmentation states; common mistake is trying to go PENDING→REVIEW_REQUIRED directly.
---

# Research segmentation state machine path

## The rule
`SEGMENTATION_PENDING` can **only** transition to `SEGMENTATION_PROPOSED`.  
To reach `SEGMENTATION_REVIEW_REQUIRED`, always make it a two-step transition:  
1. `SEGMENTATION_PENDING → SEGMENTATION_PROPOSED`  
2. `SEGMENTATION_PROPOSED → SEGMENTATION_REVIEW_REQUIRED` (within the same transaction)

## Why
The container state machine (`containerStateMachine.ts`) enforces an explicit allowlist. The adjacency list is:
```
SEGMENTATION_PENDING:          ["SEGMENTATION_PROPOSED"]
SEGMENTATION_PROPOSED:         ["SEGMENTATION_REVIEW_REQUIRED", ...]
SEGMENTATION_REVIEW_REQUIRED:  ["SEGMENTATION_PENDING", ...]
```
Attempting `PENDING → REVIEW_REQUIRED` throws `StateTransitionError` and rolls back the whole pipeline transaction, leaving the container stuck in `SEGMENTATION_PENDING`.

## How to apply
- In `segmentation/pipeline.ts`: always call `transitionContainer(id, "SEGMENTATION_PROPOSED", ...)` first, then conditionally call `transitionContainer(id, "SEGMENTATION_REVIEW_REQUIRED", ...)` in the same transaction.
- In tests: `startSegmentation` accepts containers in `SEGMENTATION_REVIEW_REQUIRED` directly — do NOT transition back to `TEXT_EXTRACTED` first (that path is also invalid). Just call `startSegmentation` again from `SEGMENTATION_REVIEW_REQUIRED`.
- Re-run cleanup in afterAll: extraction runs have a FK to source containers (`research_extraction_runs.container_id`). Delete extraction runs before deleting source containers.
