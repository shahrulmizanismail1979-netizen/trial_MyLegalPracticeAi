# ADR 0012 — Phase 11a: Authorities & Legislation Extraction

**Status:** Accepted  
**Phase:** 11a  
**Date:** 2026-07-26

## Context

Phase 10 produces AI analysis runs with raw "cases considered" and "statutes considered" propositions. These are unstructured text. Researchers need structured, reviewable authority and legislation records with treatment labels, citation identifiers, and a citation graph that is explicitly limited to the private collection. The risk is that a treatment label assigned without adequate textual evidence misleads researchers about how a case was treated.

## Decisions

### D1 — Treatment evidence gate: unclear without textual basis

A treatment label is only assigned when clear textual evidence exists in the proposition content (keyword match with a supporting passage). Any match without such evidence produces `UNCLEAR` and creates a review item. "Mentioned" (or similar weak treatment) without textual evidence is also `UNCLEAR`. This means the review queue surfaces only genuinely ambiguous cases, and researchers are never silently served a guess.

**14 treatment labels:** applied, followed, approved, overruled, distinguished, doubted, considered, explained, not-followed, departed-from, endorsed, noted, discussed, UNCLEAR.

### D2 — Citation graph is collection-scoped with mandatory disclaimer

`getCitationGraph(judgmentId)` returns only links to documents that exist in the private collection. It never claims a case is good law or that the collection is exhaustive. The disclaimer `{ disclaimer: "..." }` is a mandatory, non-optional field in every citation graph response.

### D3 — All extraction jobs are idempotent

`ON CONFLICT DO NOTHING` on the `(run_id, proposition_id)` unique constraint. Re-running extraction never duplicates records; it is safe to re-run after a partial failure.

### D4 — Non-leak 404 policy on all routes

Unauthorised callers (including authenticated researchers who cannot view the container) receive 404, not 403. This prevents leaking information about the existence of containers or judgments.

### D5 — Five legislation modes (not free-text)

`applied`, `interpreted`, `mentioned`, `challenged`, `constitutionality_considered`. Using a fixed vocabulary prevents the free-form variation that makes legislation-ref searches unreliable.

## Consequences

- Two new DB tables: `research_authorities`, `research_legislation_refs`.
- Authorities module: `research/authorities/` (extractor.ts, legislationExtractor.ts, citationGraph.ts).
- Routes: `research/routes/authorities.ts`.
- Phase 11b's authorities tables depend on this phase's tables.
- Target: ≥ 336 tests (324 existing + 12 new).

## Supersedes

Nothing. Extends ADR 0011.
