# Phase 11a: Authorities & Legislation Extraction

## What & Why
The AI analysis (Phase 10) already identifies cases and statutes considered in a judgment, but stores them only as raw proposition text. Phase 11a structures that raw text into searchable, reviewable authority and legislation records — with treatment labels, supporting evidence, and a citation graph limited to the private collection.

This is the data layer that powers the Workspace's authorities tables (Phase 11b) and any future citator features.

## Done looks like
- Every approved AI analysis run can be processed to extract structured authority records (case name, citation, paragraph ref, treatment label, supporting passage, proposition link)
- Every approved AI analysis run can be processed to extract structured legislation refs (statute, provision, jurisdiction, paragraph ref, mode of use, supporting passage)
- Treatment labels come from the fixed vocabulary; any label without clear textual evidence is flagged as `UNCLEAR` and enters the review queue
- A `GET /judgments/:id/authorities` endpoint returns extracted authorities for a judgment (role-gated, same non-leak 404 policy)
- A `GET /judgments/:id/legislation` endpoint returns extracted legislation refs
- A `GET /judgments/:id/citation-graph` endpoint returns inbound/outbound authority links limited to documents in the collection, with the disclaimer text visible in the response
- All three extraction jobs are idempotent and re-runnable
- Tests: extraction from realistic proposition text, treatment-label evidence gate, unclear-treatment → review-queue path, citation-graph limitation disclaimer present, legislation mode assignment; all via stub data, no live AI

## Out of scope
- UI for browsing authorities (Phase 11b)
- Extracting authorities from documents not yet in the AI analysis pipeline
- Cross-collection citator or "good law" verdicts

## Steps
1. **DB schema — authorities** — Add `research_authorities` table: `id`, `judgment_id` (FK), `run_id` (FK), `case_name`, `citation`, `source_paragraph_id`, `proposition_id` (FK to `research_ai_propositions`), `treatment` (enum of 14 labels + `UNCLEAR`), `treatment_evidence` (text), `review_status` (`pending_review` | `approved` | `rejected`), `reviewer_email`, `reviewed_at`, `created_at`. Add migration.
2. **DB schema — legislation refs** — Add `research_legislation_refs` table: `id`, `judgment_id` (FK), `run_id` (FK), `statute`, `provision`, `jurisdiction`, `source_paragraph_id`, `mode` (enum: `applied` | `interpreted` | `mentioned` | `challenged` | `constitutionality_considered`), `supporting_passage` (text), `proposition_id` (FK), `created_at`. Add to migration.
3. **Extraction service — authorities** — `extractAuthorities(runId)`: reads `casesConsidered` propositions from the approved run, parses each into `case_name` + `citation` (regex-first, fallback heuristic), assigns treatment label by matching content against label keywords with passage evidence requirement; any match lacking clear textual evidence → `UNCLEAR` + enqueue review item. Idempotent via `ON CONFLICT DO NOTHING` on `(run_id, proposition_id)`.
4. **Extraction service — legislation** — `extractLegislation(runId)`: reads `statutesConsidered` propositions, parses statute name + provision + jurisdiction, assigns mode from content signals. Same idempotency pattern.
5. **Citation graph service** — `getCitationGraph(judgmentId)`: queries `research_authorities` for all `judgment_id = X` rows (outbound) and all rows where `citation` matches any known citation string in the collection (inbound). Returns `{ outbound, inbound, disclaimer }` where `disclaimer` is the fixed collection-limitation string. The graph never claims a case is good law.
6. **Routes** — Add `GET /judgments/:id/authorities` (returns list + review-queue counts), `PATCH /authorities/:id/review` (approve/reject treatment label, owner/administrator/legal_reviewer only), `GET /judgments/:id/legislation`, `GET /judgments/:id/citation-graph`. All use the existing non-leak 404 container gate.
7. **Tests** — Verify: realistic `casesConsidered` proposition → correct case_name, citation, treatment label with evidence; proposition with ambiguous treatment → `UNCLEAR` + review item created; legislation proposition → correct statute/provision/mode; citation graph inbound/outbound links correct; disclaimer present; treatment review PATCH enforces container gate.

## Relevant files
- `lib/db/src/schema/research.ts`
- `lib/db/sql/migrations/` (latest: 0016-phase10-ai-analysis.sql)
- `artifacts/api-server/src/research/analysis/schema.ts`
- `artifacts/api-server/src/research/analysis/service.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/analysis.ts`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
