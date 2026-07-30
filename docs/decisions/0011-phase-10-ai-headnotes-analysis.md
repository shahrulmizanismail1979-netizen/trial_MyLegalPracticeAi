# ADR 0011 — Phase 10: AI-Generated Headnotes & Case Analysis

**Status:** Accepted  
**Phase:** 10  
**Date:** 2026-07-26

## Context

The platform's verified corpus is now searchable and quotable. Researchers want AI-generated headnotes and case analysis to accelerate their work. The tension is between research productivity and the platform's core commitments: AI output must never be confused with the judicial record; publisher editorial material must not enter the AI input; every AI proposition must be traceable to the verified text.

## Decisions

### D1 — AI is disabled by default; explicit admin approval required

`isEnabled()` returns false in a fresh deployment. An administrator must explicitly enable a provider via the admin API, recording the model settings and the approving admin's identity. This means no AI calls can occur accidentally, and the enabling decision is auditable.

### D2 — Strict input boundary: verified judicial text + approved metadata only

`buildAnalysisInput(judgmentId)` assembles the prompt from:
- Verified judicial text reconstructed via Phase 09 `reconstructJudicialText`
- Approved rows from `research_case_metadata` for the 13 permitted field names only
- The approved generation schema
- Administrator-approved model settings

The builder categorically excludes publisher-supplied metadata, editorial summaries, and any section with `isolation_applied = true`. Every included/excluded field is logged to the audit trail.

### D3 — Evidence validation before storage, not after

Every proposition's supporting paragraph IDs are validated against `judgment.paragraphIdentifiers` and every supporting passage is checked byte-for-byte using Phase 09 integrity logic. Propositions that fail are marked `INSUFFICIENT_EVIDENCE` before the run is stored. AI quotation mismatches are excluded before storage. This means a stored proposition is always evidence-anchored — there is no "unverified propositions pending review" state for evidence.

### D4 — AI output is structurally separate from the corpus

The schema makes it impossible to write AI output into `researchVerifiedJudgments` or `researchPageSections`. The separation is enforced by table structure, not by convention or application-layer checks.

### D5 — Mandatory disclaimer on every analysis response

Every response from `GET /judgments/:id/analysis` includes the string: `"AI-GENERATED RESEARCH AID — NOT PART OF THE JUDGMENT — VERIFY AGAINST THE JUDICIAL TEXT."` This is a non-optional field in the response schema.

### D6 — Status machine: DRAFT → REVIEWING → APPROVED / REJECTED

AI-generated analysis cannot be published without passing through human review. The status machine enforces this: a DRAFT run is only visible to reviewers; APPROVED runs are visible to researchers. There is no automatic approval path.

### D7 — Uncertainty labels applied by the validation step

`NOT_STATED_IN_VERIFIED_JUDGMENT`, `INSUFFICIENT_EVIDENCE`, `LEGAL_CLASSIFICATION_UNCERTAIN`, `RATIO_OBITER_REVIEW_REQUIRED`, `HUMAN_REVIEW_REQUIRED` are applied based on evidence-validation outcomes, not by reviewer judgement. A reviewer approves or rejects; they do not assign uncertainty labels.

## Consequences

- Three new DB tables: `research_ai_providers`, `research_ai_analysis_runs`, `research_ai_propositions`.
- Analysis module: `research/analysis/` (schema.ts, inputBuilder.ts, generator.ts, processor.ts).
- Admin routes: `research/routes/aiAdmin.ts`.
- Analysis routes: `research/routes/analysis.ts`.
- Phase 11a (Authorities) depends on approved AI runs from this phase.
- Target: ≥ 324 tests (312 existing + 12 new).

## Supersedes

Nothing. Extends ADR 0010.
