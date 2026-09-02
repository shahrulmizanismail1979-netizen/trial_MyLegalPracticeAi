# Phase 14 — Controlled Pilot with Authorised Documents

## What & Why

Before any full-corpus import, a small controlled pilot must validate that every pipeline step operates correctly, that no case is silently lost or silently approved, and that the rights, audit, and review systems enforce their stated guarantees on real processing runs.

The pilot uses a five-container synthetic set whose processing rights have been reviewed. Each container exercises a specific edge case (dense multi-case, scanned, duplicate, incomplete, cross-file split). The pilot must complete all eighteen workflow steps for each container and produce a written acceptance report before full import is authorised.

This task builds the infrastructure the pilot needs that is not yet complete, generates the pilot file set, and defines the report template. It does **not** import the full collection.

## Done looks like

- A five-container pilot corpus exists in `fixtures/pilot-corpus/` with `MANIFEST.json` describing each file's declared variant.
- All eighteen workflow steps can be executed for each container through the existing admin UI and API without hitting a "not implemented" gap.
- Cross-file case linking (cases that span two containers) is reviewable in the boundary-review UI.
- Publisher-editorial content is flagged and isolated before a container reaches `VERIFIED`.
- The complete-judgment verification step checks that each candidate has a non-empty header, body, and terminus — containers with incomplete candidates are held at `JUDGMENT_VERIFICATION_PENDING` until a reviewer resolves them.
- A quotation-integrity check is runnable per container: it samples quoted strings from a candidate and confirms they appear verbatim in the source pages.
- The audit-review endpoint lists every audit event for a container in chronological order, filterable by stage, readable by staff.
- After all containers pass acceptance, a pilot report is generated at `pilot-report.md` covering all fifteen fields specified in the brief.
- The pilot acceptance gate (six conditions) is documented as a checklist in the report, with each condition marked pass or fail and any failures described.

## Out of scope

- Full collection import.
- Live AI processing (the AI gate remains a reviewed permission; AI steps in the pilot are recorded as "not executed — permission not granted" in the report).
- New storage backends or deployment topology changes.
- Changes to the Stripe or subscriber-access systems.

## Steps

1. **Pilot corpus generator** — Write `scripts/src/generate-pilot-corpus.ts` to produce exactly five source files: (a) a native-text PDF holding ~30 cases, (b) a native-text PDF holding 4 cases, (c) a simulated-scanned PDF (no text layer) holding 1 case, (d) a file that is a duplicate of file (b)'s first case, (e) two files together holding one case split across the file boundary. Output to `fixtures/pilot-corpus/` with a `MANIFEST.json` describing each file's declared variant, expected case count, and rights status. No commercial materials.

2. **Cross-file relationship review** — Extend the boundary-review UI to surface cross-file relationships (`research_relationships` table). When two containers share a `SPLIT_CASE` relationship, the review screen shows both sides side-by-side and provides an "Approve split" or "Reject split" action. Wire to the existing state machine so approval unblocks both containers.

3. **Publisher-content isolation check** — Add a `publisherContentCheck` step that runs after segmentation: it scans candidate boundaries for known editorial patterns (court reporter headers, index pages, table-of-contents pages) using heuristics. Containers with flagged editorial content move to `EDITORIAL_REVIEW_REQUIRED`; the review UI presents each flagged block with "Mark as editorial (exclude)" or "Mark as judgment (include)" actions. Containers that pass automatically continue.

4. **Complete-judgment verification logic** — Implement the completeness checker in `research/isolation/completenessChecker.ts`: each candidate must have a detectable citation header, a non-zero body word count, and a detected terminus (judgment footer or "I so order" pattern). Candidates that fail any check are flagged `INCOMPLETE`; the container stays at `JUDGMENT_VERIFICATION_PENDING` until a reviewer either approves or rejects each flagged candidate.

5. **Quotation-integrity endpoint** — Add `POST /api/research/containers/:id/quotation-check`: given a candidate ID, it extracts up to ten quoted strings from the candidate text and searches for each verbatim in the container's source pages. Returns a JSON result with found/not-found status per quote. The boundary-review UI shows a "Run quotation check" button per candidate that calls this endpoint and displays results inline.

6. **Audit-review endpoint and UI** — Add `GET /api/research/containers/:id/audit`: returns all `research_audit_events` for the container ordered by `created_at`, with optional `?stage=` filter (upload, rights, extraction, segmentation, verification, search, export). Wire a read-only "Audit trail" tab into the existing container detail view in the admin UI.

7. **Pilot report generator** — Write `scripts/src/generate-pilot-report.ts`: queries the live database for the five pilot containers by `source_batch = 'pilot-v1'`, counts source files received, case candidates detected, verified judgments, false boundaries, missed boundaries, OCR defects, missing pages, duplicates found, editorial corrections, rights restrictions, AI evidence failures (always 0 for this pilot), and exports `pilot-report.md` with the acceptance checklist (six conditions) marked pass/fail. Runs as `pnpm --filter @workspace/scripts exec tsx ./src/generate-pilot-report.ts`.

8. **Integration test for pilot workflow** — Add `artifacts/api-server/src/research/pilot.test.ts`: uploads the five pilot files, runs the full pipeline (ingest → rights → inventory → extraction → segmentation → editorial check → verification → search index), asserts each container reaches `SEARCHABLE` or a documented hold state, and asserts no container is silently skipped. Runs within the existing `pnpm --filter @workspace/api-server run test` suite.

## Relevant files

- `artifacts/api-server/src/research/segmentation/pipeline.ts`
- `artifacts/api-server/src/research/domain/containerStateMachine.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/isolation/completenessChecker.ts`
- `artifacts/api-server/src/research/routes/reviewUi.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/ingestion/service.ts`
- `artifacts/api-server/src/research/search/searchIndexProcessor.ts`
- `artifacts/api-server/src/research/export/exportService.ts`
- `artifacts/api-server/src/research/stress.test.ts`
- `scripts/src/generate-stress-corpus.ts`
- `scripts/package.json`
