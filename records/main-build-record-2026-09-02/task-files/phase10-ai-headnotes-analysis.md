# Phase 10: AI-Generated Headnotes & Case Analysis

## What & Why
Add a fully governed AI pipeline that generates structured headnotes, catchwords, and case analysis from verified judgments. AI is disabled by default; an administrator must enable an approved provider before any generation runs. Every output is schema-validated, evidence-anchored to the verified judicial text, and subject to a human review workflow before it can be published. Publisher-supplied editorial material is categorically excluded from the AI input boundary.

## Done looks like
- An administrator can enable/disable an AI provider and configure approved model settings via the admin API; AI is off by default
- A `POST /api/research/judgments/:id/analysis` endpoint triggers AI analysis when the rights record permits it (`analysisPermitted === true`) and a provider is enabled; guests and unauthenticated callers are blocked
- The AI pipeline receives only: verified judicial text (reconstructed via Phase 09 `reconstructJudicialText`), approved case metadata (approved rows from `researchCaseMetadata` for the allowed fields only), the approved generation schema, and administrator-approved model settings — nothing else
- The pipeline produces schema-validated structured output for all 17 fields: catchwords, procedural posture, material facts, legal issues, parties' material submissions, holding on each issue, reasoning, possible ratio decidendi, possible obiter dicta, orders, statutes considered, cases considered, significance, 50-word summary, 150-word summary, detailed case brief, teaching note
- Every substantive proposition in the output carries: proposition ID, supporting paragraph IDs (validated against the judgment's `paragraphIdentifiers`), exact supporting passages (validated byte-for-byte against the judicial text using Phase 09 integrity logic), confidence category, and review status — propositions without valid evidence are rejected before the run is stored
- Every AI-generated quotation is checked against the verified judgment text; quotations that do not match exactly are rejected
- Uncertainty labels are applied automatically where appropriate: `NOT_STATED_IN_VERIFIED_JUDGMENT`, `INSUFFICIENT_EVIDENCE`, `LEGAL_CLASSIFICATION_UNCERTAIN`, `RATIO_OBITER_REVIEW_REQUIRED`, `HUMAN_REVIEW_REQUIRED`
- Each analysis run has a status machine: DRAFT → REVIEWING → APPROVED / REJECTED, with full revision history, prompt version, model version, creation date, and evidence-validation result stored on every run
- `GET /api/research/judgments/:id/analysis` returns the latest approved run (or DRAFT for reviewers); every response includes the mandatory disclaimer: `"AI-GENERATED RESEARCH AID — NOT PART OF THE JUDGMENT — VERIFY AGAINST THE JUDICIAL TEXT."`
- A reviewer (legal_reviewer or above) can approve or reject individual propositions and the run as a whole via `PATCH /api/research/analysis/:runId/review`
- Eight synthetic-judgment test cases confirm the acceptance gates: unsupported propositions rejected, broken paragraph references rejected, publisher editorial material excluded from input, AI output never written into the judicial-text field, exact-quotation mismatches rejected, and all tests pass

## Out of scope
- Frontend UI (API-only, same as all prior phases)
- Bulk/batch generation across multiple judgments (single-judgment trigger only)
- Fine-tuning or custom model training
- Automatic approval without human review
- Integration with external publishers or citation databases
- Retrieval-augmented generation across multiple judgments

## Steps

1. **AI provider configuration** — Create `research_ai_providers` table storing provider name (gemini/openai), enabled flag, approved model settings (model name, temperature, max tokens), created/updated timestamps, and the admin email that approved it. Add admin routes `GET/POST/PATCH /api/research/admin/ai-providers` gated to `administrator` and `owner` roles. Provider is disabled by default; explicit admin enable is required.

2. **Analysis schema and DB tables** — Create `research_ai_analysis_runs` (one per judgment × schema-version × model-version; fields: judgment_id, provider_id, prompt_version, model_version, raw_output JSONB, status, reviewer_email, review_notes, created_at, approved_at) and `research_ai_propositions` (one row per proposition: run_id, proposition_id UUID, field_name, content text, supporting_paragraph_ids text[], validated_passages JSONB, confidence_category, uncertainty_label, review_status). Add zod schema for the full 17-field structured output used for parse-and-validate on the raw model response.

3. **Input boundary builder** — Implement `buildAnalysisInput(judgmentId)` that assembles the AI prompt from: (a) verified judicial text reconstructed via `reconstructJudicialText`, (b) approved `researchCaseMetadata` rows filtered to the 13 permitted field names only, (c) the approved generation schema, (d) provider model settings. The builder must enforce that it never includes suspected publisher headnotes (any metadata field whose extraction method is `publisher_supplied` or whose source is a non-judicial-text page section), publisher catchwords, editorial summaries, or restricted metadata. The builder logs every included/excluded field for audit.

4. **AI generation and structured-output validation** — Implement `runAiAnalysis(judgmentId, providerId)` that calls the approved provider with a strict JSON output schema, parses the response with zod, rejects the entire run if the top-level structure is invalid, then validates each proposition's supporting paragraph IDs against `judgment.paragraphIdentifiers` and each supporting passage against the reconstructed judicial text (byte-for-byte using Phase 09 `verifyQuotationSelection` logic). Propositions that fail evidence validation are marked `INSUFFICIENT_EVIDENCE` and their `review_status` is set to `rejected`; if more than half of propositions in a critical field (ratio, holding) fail, the whole run is set to status `DRAFT` with a critical warning. AI-generated quotations that fail exact-match are excluded from the run output.

5. **Job processor** — Register a `container.ai_analysis` job processor. It gates on `analysisPermitted === true` from the rights record and on a provider being enabled. It calls `runAiAnalysis`, stores the run and all propositions, stores the full raw model response in object storage (keyed by run ID), and transitions the run to status `DRAFT`. If the rights check fails or no provider is enabled, the job fails with a clear coded error (not a silent fallback).

6. **Analysis routes** — Add to the research router: `POST /api/research/judgments/:id/analysis` (requires researcher+ role + `analyse` container access — enqueues the analysis job), `GET /api/research/judgments/:id/analysis` (requires `view` access — returns latest approved run for most roles, latest DRAFT for reviewers; always includes the disclaimer string), `GET /api/research/analysis/:runId` (full run detail with all propositions), `PATCH /api/research/analysis/:runId/review` (legal_reviewer+ only — approve/reject the run or individual propositions, records reviewer email and timestamp).

7. **Tests — synthetic ambiguous judgments** — Write `phase10.test.ts` with eight test cases using synthetic judgments crafted to trigger model failure modes, all run against real Gemini or a stub provider that replays canned responses to avoid live API calls in CI:
   - *Invented fact*: judgment contains no statement about damages; model output claiming a damages figure is rejected as `INSUFFICIENT_EVIDENCE`
   - *Inferred unexpressed holding*: judgment deliberates but issues no explicit ruling; holding proposition gets `NOT_STATED_IN_VERIFIED_JUDGMENT`
   - *Submission vs decision confusion*: model confuses a party's submission with the court's holding; proposition review_status is flagged `HUMAN_REVIEW_REQUIRED`
   - *Ratio misclassification*: long obiter passage is misclassified as ratio; run stored with `RATIO_OBITER_REVIEW_REQUIRED` on that proposition
   - *Inaccurate quotation*: model returns a near-miss quotation with one word changed; quotation is rejected before storage
   - *Unsupported metadata*: model uses metadata that was not in the approved input; paragraph reference validation fails and proposition is rejected
   - *Publisher material exclusion*: input boundary builder is called with a judgment whose metadata includes a `publisher_supplied` field; the field is excluded and the audit log records the exclusion
   - *AI output isolation*: attempt to write an analysis result into the `selectedText` field of a quotation is structurally impossible (schema separation test)

## Relevant files
- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/research/quotations/integrity.ts`
- `artifacts/api-server/src/research/quotations/service.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/viewer.ts`
- `lib/db/sql/migrations/0015-phase09-quotations.sql`
