# Phase 10 Completion Report — AI-Generated Headnotes & Case Analysis

**Date:** 2026-07-26  
**Phase:** 10  
**Status:** COMPLETE

---

## Objective

Add a fully governed AI pipeline that generates structured headnotes, catchwords, and case analysis from verified judgments — disabled by default, evidence-anchored to verified judicial text, subject to human review before publication, and structurally isolated from the corpus.

---

## Deliverables

### Database Migrations (`0016-phase10-ai-analysis.sql`)

Three new tables:

| Table | Purpose |
|---|---|
| `research_ai_providers` | Provider config: name (gemini/openai), enabled flag, approved model settings, admin who enabled; disabled by default |
| `research_ai_analysis_runs` | One run per judgment × schema-version × model-version; status machine DRAFT→REVIEWING→APPROVED/REJECTED; stores raw output, reviewer info, prompt/model versions |
| `research_ai_propositions` | One row per proposition; field name, content, supporting paragraph IDs, validated passages JSONB, confidence category, uncertainty label, review status |

---

### Analysis Module (`research/analysis/`)

| File | Responsibility |
|---|---|
| `schema.ts` | Zod schema for the 17-field structured output; used for parse-and-validate on every raw model response |
| `inputBuilder.ts` | `buildAnalysisInput(judgmentId)` — assembles prompt from verified judicial text, approved metadata (13 permitted fields only), generation schema, and model settings; logs every included/excluded field for audit; never includes publisher-supplied metadata or editorial material |
| `generator.ts` | `runAiAnalysis(judgmentId, providerId)` — calls provider with strict JSON output schema; validates each proposition's paragraph references and passages byte-for-byte via Phase 09 integrity logic; propositions failing evidence validation marked INSUFFICIENT_EVIDENCE; AI quotation mismatches excluded before storage |
| `processor.ts` | Job processor `container.ai_analysis`; gates on `analysisPermitted === true` and a provider being enabled; stores run + propositions + raw response in object storage; fails with coded error (not silent fallback) on gate failure |

**17 output fields:** catchwords, proceduralPosture, materialFacts, legalIssues, materialSubmissions, holdingPerIssue, reasoning, possibleRatiodecidendi, possibleObiterDicta, orders, statutesConsidered, casesConsidered, significance, summary50, summary150, detailedBrief, teachingNote.

---

### API Routes (`research/routes/analysis.ts`)

- `POST /api/research/judgments/:id/analysis` — trigger analysis (researcher+ role + `analyse` access); enqueues job
- `GET /api/research/judgments/:id/analysis` — latest approved run (DRAFT for reviewers); always includes mandatory disclaimer
- `GET /api/research/analysis/:runId` — full run detail with all propositions
- `PATCH /api/research/analysis/:runId/review` — legal_reviewer+ approve/reject run or individual propositions

**Mandatory disclaimer on every response:** `"AI-GENERATED RESEARCH AID — NOT PART OF THE JUDGMENT — VERIFY AGAINST THE JUDICIAL TEXT."`

**Admin routes (`research/routes/aiAdmin.ts`):**
- `GET/POST/PATCH /api/research/admin/ai-providers` — provider management (administrator/owner only)

---

### Key Design Decisions

1. **Disabled by default** — `isEnabled()` returns false until an administrator explicitly enables a provider via the admin API. No AI calls can occur in a fresh deployment.
2. **Evidence validation before storage** — every proposition's paragraph IDs are validated against the judgment's `paragraphIdentifiers`, and every supporting passage is checked byte-for-byte. Propositions that fail are rejected before the run is stored, not flagged after.
3. **AI output is structurally separate from the corpus** — it is impossible to write AI analysis output into the `researchVerifiedJudgments` or `researchPageSections` tables; the schema enforces separation.
4. **Publisher content categorically excluded from AI input** — the input boundary builder excludes any metadata field with `publisher_supplied` method; the exclusion is logged to the audit trail.
5. **Uncertainty labels applied automatically** — `NOT_STATED_IN_VERIFIED_JUDGMENT`, `INSUFFICIENT_EVIDENCE`, `RATIO_OBITER_REVIEW_REQUIRED` applied by the validation step; human review required before any proposition is promoted.

---

## Tests (`phase10.test.ts`)

**12 new tests; 324 total tests across all phases.**

Coverage (all against stub provider with canned responses): invented fact rejected as INSUFFICIENT_EVIDENCE; inferred unexpressed holding gets NOT_STATED_IN_VERIFIED_JUDGMENT; submission vs decision confusion flagged HUMAN_REVIEW_REQUIRED; ratio misclassification gets RATIO_OBITER_REVIEW_REQUIRED; inaccurate quotation rejected before storage; unsupported metadata reference validation failure; publisher material excluded from AI input (audit log records exclusion); AI output isolation (schema separation test).

---

## PHASE: 10 | STATUS: complete | CHECKPOINT: 2026-07-26
