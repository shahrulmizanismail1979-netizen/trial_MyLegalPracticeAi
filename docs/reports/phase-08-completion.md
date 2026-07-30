# Phase 08 Completion Report — Search & Research UI

**Date:** 2026-07-25  
**Phase:** 08  
**Status:** COMPLETE

---

## Objective

Deliver usable legal-research access to the verified, isolation-gated judgments produced by Phase 07 through four interlocking layers: structured case metadata extraction, duplicate/version detection, PostgreSQL full-text search, and a judgment viewer with annotations and bookmarks.

---

## Deliverables

### Database Migrations (`0014-phase08-search-ui.sql`)

Five new tables:

| Table | Purpose |
|---|---|
| `research_case_metadata` | 13-field structured metadata per verified judgment; fields stored as JSONB with value, source ref, confidence category, extraction method, reviewer status |
| `research_duplicate_links` | Bidirectional similarity links between verified judgments; three signal types (checksum, citation, paragraph fingerprint); status enum DETECTED/SAME_CASE/DIFFERENT_VERSION/DISTINCT |
| `research_annotations` | Per-user per-judgment per-paragraph private annotations; highlight quote with char offsets; visibility flag |
| `research_bookmarks` | Per-user per-judgment bookmarks; idempotent upsert |
| `research_search_index` | One row per paragraph; GIN-indexed tsvector (English and Malay/simple dictionaries); metadata JSONB for field filters; isolation gate enforced structurally |

---

### Metadata Module (`research/metadata/`)

| File | Responsibility |
|---|---|
| `extractor.ts` | Pure function `extractCaseMetadata(judgment, sections, pageTexts)` — extracts 13 fields using regex and structural signals; ABSENT entries for unextractable fields, never fabricated values |
| `duplicateDetector.ts` | Pure functions `compareJudgments` and `detectAllDuplicates` — checksum, citation, party+court+date, and paragraph fingerprint signals; aggregate score determines link type |
| `metadataProcessor.ts` | Job processor `container.metadata_extract`; idempotent; records before/after transformation row |
| `duplicateProcessor.ts` | Job processor `container.duplicate_detect`; runs after metadata extraction; upserts duplicate links |

**13 metadata fields:** caseName, neutralCitation, reportCitation, court, registry, proceedingNumber, judges, hearingDate, decisionDate, parties, jurisdiction, proceduralPosture, language.

---

### Search Module (`research/search/`)

| File | Responsibility |
|---|---|
| `postgresFtsAdapter.ts` | Replaces the `postgres-search-stub`; implements full SearchAdapter interface; supports keyword, exact phrase, Boolean AND/OR/NOT, field filters (court, judge, date range, jurisdiction), wildcards |
| `searchIndexProcessor.ts` | Job processor `container.search_index`; builds `research_search_index` rows from isolation-gated sections only; publisher editorial text structurally absent |

---

### API Routes

**Search routes (`research/routes/search.ts`):**
- `GET /search` — paginated hits with excerpts; paragraph IDs and source-page refs; rights + isolation gate enforced
- `POST /search/index/:containerId` — admin rebuild
- `GET /search/metadata` — autocomplete for field filters

**Viewer routes (`research/routes/viewer.ts`):**
- `GET /judgments/:id` — summary with metadata and duplicate links
- `GET /judgments/:id/paragraphs` — ordered paragraph list with highlight support
- `GET /judgments/:id/pages/:pageNum` — page view with section classifications
- `GET /judgments/:id/source-page/:pageId` — side-by-side source comparison
- Annotation CRUD and bookmark toggle (private per user)
- Metadata review routes with reviewer override and transformation record

---

### Key Design Decisions

1. **PostgreSQL FTS only** — no external search engine; isolation gate enforced at index build time, not query time, making publisher-editorial leakage structurally impossible.
2. **No auto-merge on duplicates** — duplicate links are detected and stored for human review; judicial text integrity rule prohibits automatic merging.
3. **ABSENT not fabricated** — metadata extractor produces ABSENT entries for fields it cannot extract; no guessed values.
4. **Annotations are private** — no cross-user visibility; access decision checked per-container before any viewer route responds.

---

## Tests (`phase08.test.ts`)

**41 new tests; 289 total tests across all phases.**

Coverage: metadata extractor (all 13 fields, ABSENT for missing, source ref correctness); duplicate detector (checksum/citation/paragraph-fingerprint signals, no-match path); search adapter (keyword, exact phrase, Boolean, field filter, wildcard, isolation gate, rights gate, empty result); viewer routes (auth gate, paragraph order, source-page comparison, annotation CRUD with owner isolation, bookmark toggle); metadata review routes (all 13 fields, reviewer override transformation, duplicate link decision); pipeline (metadata_extract + search_index jobs enqueued after verify).

---

## State Machine Changes

No new states. New pipeline hook: after container reaches `VERIFIED`, the `container.metadata_extract` job is enqueued automatically; after metadata extraction completes, `container.search_index` is enqueued.

---

## Health Endpoint

`/api/research/health` reports phase `"08"`.

---

## PHASE: 08 | STATUS: complete | CHECKPOINT: 2026-07-25
