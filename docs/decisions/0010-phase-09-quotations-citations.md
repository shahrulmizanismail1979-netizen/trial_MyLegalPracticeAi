# ADR 0010 — Phase 09: Exact Quotations & Citation Tools

**Status:** Accepted  
**Phase:** 09  
**Date:** 2026-07-25

## Context

Phase 08 produced verified judicial text accessible through the judgment viewer. Lawyers and researchers need to lift exact passages and format them as citations for academic writing and court preparation. The key design constraints are:

1. A quoted passage must be provably accurate — byte-level integrity against the verified judicial text.
2. Alterations (omissions, insertions) must be tracked without destroying the original selection.
3. Citation formatting must never invent metadata that has not been verified.
4. Export must be role-gated.

## Decisions

### D1 — Byte-level integrity check, hard rejection

`verifyQuotationSelection(judgmentId, paragraphId, start, end, text)` reconstructs the paragraph from approved judicial spans, slices at the stated offsets, and compares byte-for-byte against the submitted text. A mismatch is a hard rejection with a structured error — not a warning, not a silent acceptance. This makes provenance guarantees enforceable at the data layer, not just by convention.

### D2 — `sourceChanged` flag on read (not rejection)

When a quotation is read and the current paragraph checksum differs from the stored checksum, `sourceChanged: true` is returned. The quotation is not automatically invalidated — corrections are reviewed by humans. But the caller is always informed of the discrepancy.

### D3 — Alteration tracking via child table, not field mutation

Each alteration is a separate row in `research_quotation_alterations`. The original text and offsets are never overwritten. The presence of any alteration row flips the parent's `kind` to `"altered"`. This preserves the full alteration history and prevents an altered quotation from being re-submitted as exact.

### D4 — Citation formatter renders placeholders, not guesses

If a required metadata field (neutral citation, reporter citation) is absent from verified case metadata and has not been supplied by an authorised reviewer, the template renders `"REPORTER CITATION NOT VERIFIED"` — a visible placeholder. The formatter accepts no fallback values from unverified sources.

### D5 — Six built-in citation style templates

`neutral-citation-first`, `oscola`, `malaysian`, `bluebook`, `academic-footnote`, `bibliography`. These cover the primary use cases for Malaysian legal practice and academic publication. Custom user-defined styles are deferred to a future phase.

### D6 — Export gated at researcher role

The export provenance bundle requires researcher role or above. Guest role is refused with 403. This is consistent with the platform's minimum-privilege policy.

## Consequences

- Two new DB tables: `research_quotations`, `research_quotation_alterations`.
- Quotations module: `research/quotations/integrity.ts`, `research/quotations/service.ts`, `research/quotations/citationFormatter.ts`.
- Phase 09 is the foundation for Phase 10's AI evidence anchoring (which reuses the byte-level integrity logic).
- Target: ≥ 312 tests (289 existing + 23 new).

## Supersedes

Nothing. Extends ADR 0009.
