# ADR 0009 — Phase 08: Search & Research UI

**Status**: Accepted  
**Phase**: 08  
**Date**: 2026-07-24

## Context

Phase 07 produced verified judicial text in `research_verified_judgments`. Phase 08 makes that corpus findable and inspectable:

1. **Case metadata extraction** — structured 13-field metadata per verified judgment, each field carrying a value, source reference (page/character span), confidence, extraction method, and reviewer status.
2. **Duplicate / version detection** — checksum, citation, and paragraph-fingerprint matching across judgments; detected links are flagged for human review only — no auto-merge.
3. **PostgreSQL full-text search** — replaces the no-op `postgres-search-stub`; isolation gate enforced structurally (only `VERIFIED_JUDICIAL_TEXT` sections enter the search index).
4. **Judgment viewer routes** — read-only, access-gated routes for reading paragraphs, comparing source pages, and managing per-user annotations and bookmarks.

## Decisions

### D1 — Metadata fields (13)
`caseName`, `neutralCitation`, `reportCitation`, `court`, `registry`, `proceedingNumber`, `judges`, `hearingDate`, `decisionDate`, `parties`, `jurisdiction`, `proceduralPosture`, `language`.

Each field record carries: `fieldName`, `value` (JSONB), `sourceRef` (page id + char start/end), `confidence` (0–1), `method` (`regex` | `heuristic`), `reviewerStatus` (`pending` | `approved` | `rejected`).

Multiple records per field are permitted (alternative extractions). The active record is the latest non-rejected one.

### D2 — Duplicate detector: no auto-merge
Detected duplicate/version links are stored in `research_duplicate_links` and routed to human review. Auto-merge is prohibited (judicial-text integrity rule).

Three signal types, each independently scored:
- `checksum` — SHA-256 of ordered judicial text (exact duplicate)
- `citation` — neutral or report citation match
- `paragraph_fingerprint` — Jaccard similarity of paragraph-level 5-gram fingerprints

A link's `linkType` is one of: `EXACT_DUPLICATE`, `POSSIBLE_DUPLICATE`, `ALTERNATIVE_VERSION`, `POSSIBLE_CONTINUATION`, `RELATED_APPEAL`.

### D3 — Isolation gate enforced structurally in the search index
Only sections classified `VERIFIED_JUDICIAL_TEXT` or `PROBABLE_JUDICIAL_TEXT` (with `isolationApplied = true`) contribute text to the `research_search_index.document` tsvector. `SUSPECTED_PUBLISHER_EDITORIAL`, `ADMINISTRATIVE_METADATA`, and `SOURCE_ARTIFACT` sections are excluded at index time, making leakage structurally impossible.

### D4 — PostgreSQL FTS (English and Malay dictionaries)
Search index uses `to_tsvector('english', text)` for the majority of content. A separate `document_ms` column uses `to_tsvector('simple', text)` for Malay/romanised legal terms where the English stemmer is inappropriate.

Queries are handled via `websearch_to_tsquery` (keyword/phrase/Boolean) and `ts_rank_cd` for ranking. Field-level filters (court, date range, judge) are pushed as SQL predicates before the text-rank step.

### D5 — Viewer routes are read-only and access-gated
All viewer routes require an authenticated research session and pass through `checkContainerAccess(..., "view")`. Annotations and bookmarks are scoped per `research_user_id`. There are no public viewer URLs.

### D6 — New processors and job kinds
- `container.metadata_extract` — runs after `JUDGMENT_VERIFICATION_COMPLETE`; idempotent by `(judgmentId, processorVersion)`.
- `container.duplicate_detect` — runs after metadata extraction; compares across all verified judgments; idempotent by `(judgmentId, processorVersion)`.
- `container.search_index` — runs after editorial pass; only indexes isolated judicial text; idempotent by `(judgmentId, processorVersion)`.

## Consequences

- Three new DB tables: `research_case_metadata`, `research_duplicate_links`, `research_annotations`, `research_bookmarks`, `research_search_index`.
- `postgres-search-stub` in `adapters.ts` is replaced by a real PostgreSQL FTS adapter that reads `research_search_index`.
- Health route updated: `phase: "08"`.
- Target: ≥ 310 tests (249 existing + ≥ 61 new).

## Supersedes
Nothing. Extends ADR 0008.
