# Phase 11a Completion Report — Authorities & Legislation Extraction

**Date:** 2026-07-26  
**Phase:** 11a  
**Status:** COMPLETE

---

## Objective

Structure the raw "cases considered" and "statutes considered" propositions produced by Phase 10's AI analysis into searchable, reviewable authority and legislation records — with treatment labels, supporting evidence, and an intra-collection citation graph. This is the data layer that powers Phase 11b's authorities tables and any future citator features.

---

## Deliverables

### Database Migrations (`0017-phase11a-authorities.sql`)

Two new tables:

| Table | Purpose |
|---|---|
| `research_authorities` | Structured authority record per approved AI run: case name, citation, source paragraph ID, proposition FK, treatment label (14-label vocabulary + UNCLEAR), treatment evidence, review status, reviewer columns |
| `research_legislation_refs` | Structured legislation ref per approved AI run: statute, provision, jurisdiction, source paragraph ID, mode of use (5 modes), supporting passage, proposition FK |

---

### Authorities Module (`research/authorities/`)

| File | Responsibility |
|---|---|
| `extractor.ts` | `extractAuthorities(runId)` — reads casesConsidered propositions from approved run; parses case name + citation (regex-first, heuristic fallback); assigns treatment label by matching content against label keywords with passage evidence requirement; any match without clear textual evidence → UNCLEAR + review item; idempotent via ON CONFLICT DO NOTHING on (run_id, proposition_id) |
| `legislationExtractor.ts` | `extractLegislation(runId)` — reads statutesConsidered propositions; parses statute, provision, jurisdiction; assigns mode from content signals; same idempotency pattern |
| `citationGraph.ts` | `getCitationGraph(judgmentId)` — queries outbound authorities and inbound citation matches across the collection; always returns `{ outbound, inbound, disclaimer }` where disclaimer is the fixed collection-limitation string; never claims any case is good law |

**14 treatment labels:** applied, followed, approved, overruled, distinguished, doubted, considered, explained, not-followed, departed-from, endorsed, noted, discussed, UNCLEAR.

**5 legislation modes:** applied, interpreted, mentioned, challenged, constitutionality_considered.

---

### API Routes (`research/routes/authorities.ts`)

- `GET /api/research/judgments/:id/authorities` — extracted authorities with review-queue counts; non-leak 404 container gate
- `PATCH /api/research/authorities/:id/review` — approve/reject treatment label (owner/administrator/legal_reviewer only); writes transformation row
- `GET /api/research/judgments/:id/legislation` — extracted legislation refs
- `GET /api/research/judgments/:id/citation-graph` — inbound/outbound links with disclaimer

---

### Key Design Decisions

1. **Treatment evidence gate** — a treatment label is only assigned when clear textual evidence exists in the proposition content; ambiguous matches produce UNCLEAR and enter the review queue rather than silently receiving a guess.
2. **Citation graph is collection-scoped** — the graph only contains links to documents in the private collection; it never claims a case is good law; the disclaimer is structurally part of every response.
3. **All jobs are idempotent and re-runnable** — `ON CONFLICT DO NOTHING` on the proposition FK means re-running extraction never duplicates records.
4. **Non-leak 404 policy** — unauthorised callers receive 404, not 403, so the existence of a container is not disclosed.

---

## Tests (`phase11a.test.ts`)

**12 new tests; 336 total tests across all phases.**

Coverage: `parseCaseFromContent` (X v Y + citation; Re X case name); `detectTreatment` (keyword + valid passage → specific label; keyword without valid passage → UNCLEAR; no keyword → UNCLEAR); `extractAuthorities` (UNCLEAR treatment creates review item; idempotent on re-run); `extractLegislation` (statute + provision + mode); citation graph (outbound + disclaimer always present); authorities route (guest gets 404; legal_reviewer with access gets 200 + disclaimer).

---

## PHASE: 11a | STATUS: complete | CHECKPOINT: 2026-07-26
