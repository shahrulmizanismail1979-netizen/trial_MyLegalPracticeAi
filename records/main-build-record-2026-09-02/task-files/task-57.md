---
title: Phase 08: Search & Research UI
---
# Phase 08: Search & Research UI

## What & Why

Deliver usable legal-research access to the verified, isolation-gated judgments
produced by Phase 07. This phase has four interlocking layers:

1. **Case metadata extraction** — structured, provenance-traced metadata for
   every verified judgment (13 defined fields).
2. **Duplicate and version detection** — identify related judgments without
   automatically merging materially different versions.
3. **Full-text search** — PostgreSQL-native FTS over authorised, verified
   judicial text only; publisher editorial text never appears in results.
4. **Judgment viewer** — paragraph-navigable verified text with source-page
   comparison, private annotations, and bookmarks.

The research portals (MyLitAI, MySyalitAI, etc.) will consume these APIs.
The initial viewer phase shows verified judicial text and user notes only;
AI-generated research aids remain deferred to Phase 09.

---

## Done looks like

- Every `research_verified_judgments` row has a corresponding
  `research_case_metadata` row holding up to 13 fields; each field stores:
  extracted value, char-level source reference, confidence category
  (HIGH / MEDIUM / LOW / ABSENT), extraction method (REGEX / STRUCTURAL /
  AI_DISABLED), and reviewer status (UNREVIEWED / CONFIRMED / CORRECTED).
  Fields that cannot be extracted remain absent — no fabricated values.
- `research_duplicate_links` rows exist between verified judgments that share
  citations, party names + court + date, checksums, or paragraph fingerprints.
  Linked judgments remain distinguishable; no automatic merge occurs.
- `GET /api/research/search` accepts keyword, exact phrase, Boolean operators,
  proximity, field filters (court, judge, jurisdiction, statute, date range),
  wildcards, and paragraph-text queries; results include excerpts with paragraph
  IDs and source-page refs; only authorised VERIFIED containers appear.
- Publisher editorial text (`isolation_applied = true` sections) is structurally
  absent from every search result and every search excerpt.
- Judgment viewer endpoints return paragraphs in reading order, source-page
  comparison data, and user-private annotation / bookmark state.
- Browser tests pass all 8 acceptance scenarios (see Steps 13).
- All 249 existing tests remain green; new test count ≥ 310.

---

## Out of scope

- AI-generated research aids (Phase 09).
- Public-facing portal UI — portals call these APIs; the viewer in this phase
  is internal staff tooling.
- Export mechanics (reserved for a later phase).
- Full editorial review UI for `MANUAL_REVIEW_REQUIRED` sections (deferred).
- External search engines (Elasticsearch, OpenSearch) — PostgreSQL FTS only.

---

## Steps

1. **ADR 0009** — Write `docs/decisions/0009-phase-08-search-research-ui.md`
   recording: PostgreSQL FTS as the search engine (no external service),
   metadata field schema and storage model, duplicate-link model, annotation
   and bookmark data model, judgment viewer API design, and indexing strategy.

2. **DB schema and migrations** — Add the following tables (one idempotent
   migration `0014-phase08-search-ui.sql`):
   - `research_case_metadata` — one row per verified judgment; all 13 possible
     fields stored as a JSONB column (`fields`) where each field entry is
     `{ value, sourceRef, confidence, method, reviewerStatus, reviewedBy?,
     reviewedAt? }`. Indexed on `verified_judgment_id`.
   - `research_duplicate_links` — bidirectional pair `(judgment_a_id,
     judgment_b_id)`, signals JSONB (checksumMatch, citationMatch,
     partyCourtDateMatch, judgeMatch, paragraphFingerprintScore), status
     enum (`DETECTED` / `SAME_CASE` / `DIFFERENT_VERSION` / `DISTINCT`),
     reviewer columns.
   - `research_annotations` — per user per verified judgment per paragraph
     (optional anchor); private; text content, highlighted quote, highlight
     start/end chars within paragraph, created_at, updated_at.
   - `research_bookmarks` — per user per verified judgment; created_at.
   - `research_search_index` — one row per paragraph (or metadata-only row
     per judgment); columns: `verified_judgment_id`, `container_id`,
     `paragraph_id` (nullable), `section_id`, `content_tsv` (tsvector),
     `content_text`, `metadata_fields` JSONB (court, judge, jurisdiction,
     citation, parties, date), indexed with GIN on `content_tsv` and BTREE
     on the metadata columns.

3. **Metadata extractor** — Pure function
   `extractCaseMetadata(verifiedJudgment, sections, pageTexts)` in a new
   `research/metadata/` submodule. Extracts all 13 fields using regex and
   structural signals (positional heuristics, coram block, citation patterns,
   date formats). Each field result carries source character range,
   confidence category, and extraction method. Missing fields produce an
   ABSENT entry — never a guess. The 13 fields: case name, neutral citation,
   report citation, court, registry, proceeding number, judges, hearing date,
   decision date, parties, jurisdiction, procedural posture, language.

4. **Metadata processor job** — Background job type
   `container.metadata_extract`; fetches the verified judgment, sections, and
   page texts; calls the extractor; upserts the `research_case_metadata` row.
   Registered at startup. Enqueued automatically after the container reaches
   `VERIFIED` (add to pipeline integration after the verify route succeeds).
   Idempotent: re-running replaces the fields JSONB but records a
   transformation audit row showing the before/after.

5. **Duplicate and version detector** — Pure function
   `detectDuplicates(candidate, corpus)` in `research/metadata/`. Compares:
   SHA-256 checksum (exact match → SAME_CASE signal), neutral and report
   citations (parsed and normalised), party names + court + decision date
   (normalised string similarity), judge names, paragraph-count fingerprint,
   leading-paragraph text similarity (Jaccard or dice on shingles). Returns
   an array of `{ otherJudgmentId, signals, aggregateScore }` objects.
   A score above the SAME_CASE threshold creates a `DETECTED` link;
   materially different versions are never automatically merged.

6. **Duplicate processor job** — Background job type
   `container.duplicate_detect`; runs after `container.metadata_extract`
   completes; calls the detector against all existing VERIFIED judgments;
   upserts `research_duplicate_links` rows. Registered at startup. Idempotent.

7. **PostgreSQL FTS search adapter** — Replace `postgres-search-stub` with
   `postgres-fts` implementing the existing `SearchAdapter` interface.
   Extend the interface minimally to support structured queries (the current
   interface takes a plain `string`; add a typed `StructuredQuery` overload
   that the routes use directly, keeping the plain-string path for
   backward-compatibility). The adapter must:
   - Accept the full query grammar: keyword, exact phrase (quoted), Boolean
     (AND/OR/NOT), proximity (NEAR/n), field filters (court:, judge:,
     jurisdiction:, statute:, section:, date:), wildcards (prefix*),
     paragraph text.
   - Translate to `websearch_to_tsquery` / `phraseto_tsquery` / custom
     `tsquery` as appropriate; apply field-column filters as SQL WHERE
     predicates.
   - Enforce the isolation gate: only rows in `research_search_index` that
     passed `isolation_applied = false` on the originating section are
     indexed; publisher editorial rows are structurally absent.
   - Enforce rights and access: join against `research_rights_records` and
     container processing state (`VERIFIED` only).
   - Return: `{ verifiedJudgmentId, paragraphId?, sectionId, excerpt,
     matchedTermPositions, score, metadata }` per hit.

8. **Search API routes** — New router `research/routes/search.ts` mounted
   on the main research router:
   - `GET /search` — query params: `q` (raw query string parsed by the
     adapter), `court`, `judge`, `jurisdiction`, `statute`, `section`,
     `dateFrom`, `dateTo`, `page`, `perPage`. Response: paginated hit list
     with excerpts. Requires `research` role.
   - `POST /search/index/:containerId` — admin: rebuild the search index for
     one verified container. Requires `administrator` or `owner` role. Enqueues
     a `container.search_index` job.
   - `GET /search/metadata` — autocomplete sources for field filters
     (distinct courts, judges, jurisdictions from indexed metadata).

9. **Judgment viewer routes** — New router `research/routes/viewer.ts`:
   - `GET /judgments/:id` — summary: metadata, duplicate links, stats.
   - `GET /judgments/:id/paragraphs` — ordered paragraph list with paragraph
     IDs, section IDs, source-page refs, and text. Supports `?highlight=term`
     to return match positions within each paragraph.
   - `GET /judgments/:id/pages/:pageNum` — page view: judicial sections for
     the given source-page number, with section classifications.
   - `GET /judgments/:id/source-page/:pageId` — source-page comparison:
     full page text alongside isolation-gated judicial sections, for
     side-by-side review.
   - `GET /judgments/:id/annotations` — caller's private annotations
     (filtered by `research_user_id`).
   - `POST /judgments/:id/annotations` — create annotation; body: paragraph
     id, optional highlight quote + char range, text content.
   - `PATCH /judgments/:id/annotations/:annotationId` — edit text or highlight.
   - `DELETE /judgments/:id/annotations/:annotationId` — delete own annotation.
   - `GET /judgments/:id/bookmarks` — caller's bookmark state for this
     judgment.
   - `PUT /judgments/:id/bookmarks` — toggle bookmark (idempotent upsert /
     delete).
   All routes: require `research` role; access decision checked per container.

10. **Metadata review routes** — Extend or add to `research/routes/viewer.ts`:
    - `GET /judgments/:id/metadata` — all 13 fields with confidence, source
      ref, method, reviewer status.
    - `PATCH /judgments/:id/metadata/:field` — reviewer override: update the
      field's value and set `reviewerStatus: CORRECTED`; write a
      `research_transformations` row. Requires `legal_reviewer` / `administrator`
      / `owner`.
    - `GET /judgments/:id/duplicates` — linked judgments with similarity
      signals and current reviewer status.
    - `PATCH /duplicates/:linkId` — reviewer decision on a duplicate link
      (SAME_CASE / DIFFERENT_VERSION / DISTINCT); write a transformations row.

11. **Search index pipeline** — After `container.metadata_extract` succeeds,
    enqueue `container.search_index`. The `search_index` processor: fetches the
    verified judgment's approved judicial sections and metadata; rebuilds the
    `research_search_index` rows for that judgment (delete-then-insert to keep
    it idempotent); calls `update_search_index_tsvector()` to regenerate the
    `content_tsv` column via a DB trigger or explicit `to_tsvector` call.
    Registered at startup.

12. **Synthetic fixtures** — Add to `fixtures/synthetic/metadata/`:
    - `full-metadata.txt` — judgment containing all 13 extractable fields.
    - `partial-metadata.txt` — judgment with 6 absent fields (stays absent).
    - `duplicate-pair-a.txt` / `duplicate-pair-b.txt` — two sources of the
      same judgment (same citation, different edition text).
    - `version-pair-a.txt` / `version-pair-b.txt` — different-year versions
      of the same case (citation differs in year).
    - `complex-citations.txt` — multiple citation formats in one judgment.

13. **Tests (integration)** — In `phase08.test.ts`:
    - Metadata extractor: all 13 fields; missing-field stays absent; source
      ref points to correct character range.
    - Duplicate detector: checksum match, citation match, party+court+date
      match, paragraph fingerprint match, no-match (score below threshold).
    - Search adapter: keyword query returns hits; exact phrase returns only
      phrase matches; Boolean AND/OR/NOT filters correctly; field filter on
      court/judge/date; wildcard prefix; isolation gate (editorial text absent
      from results); rights gate (restricted container hidden); empty result
      for unknown query.
    - Viewer routes: auth gate (non-research role → 403); paragraph list
      ordered correctly; source-page comparison returns judicial sections only;
      annotation CRUD (create, edit, delete, visibility restricted to owner);
      bookmark toggle (idempotent).
    - Metadata review routes: all 13 fields returned; reviewer override writes
      transformation; duplicate link reviewer decision persisted.
    - Pipeline: after verify, metadata_extract and search_index jobs enqueued
      and processable.
    - All 249 existing tests must remain green.

14. **Browser tests (Playwright)** — Using the existing testing skill, cover
    the 8 acceptance scenarios against the running API:
    1. Login (research user authenticates, receives research role).
    2. Authorised search (verified, rights-approved case returns results).
    3. Restricted search (container with UNREVIEWED rights returns no results).
    4. Open a case (judgment viewer returns paragraphs in order).
    5. Page comparison (source-page endpoint returns judicial sections
       alongside raw page text).
    6. Paragraph navigation (paragraphs have IDs; highlight query returns
       term positions).
    7. Annotation creation (POST creates annotation; GET returns it for the
       same user only).
    8. Unauthorised access attempt (no research role → 401/403).

15. **Phase reports and status update** — Write
    `docs/reports/phase-08-completion.md` (full required structure from
    `docs/BUILD_PROMPT.md`); update `docs/status/current-phase.json` to
    phase 08 complete, `nextPhase` Phase 09 (AI Research Aids). Set
    `/api/research/health` `phase` field to `"08"`.

---

## Relevant files

- `artifacts/api-server/src/research/adapters.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/editorial.ts`
- `artifacts/api-server/src/research/isolation/isolationGate.ts`
- `artifacts/api-server/src/research/isolation/editorialProcessor.ts`
- `artifacts/api-server/src/research/processing/handlers.ts`
- `artifacts/api-server/src/research/validation/pipeline.ts`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/auth.ts`
- `artifacts/api-server/src/research/phase07.test.ts`
- `artifacts/api-server/src/research/testing/`
- `lib/db/src/schema/research.ts`
- `lib/db/sql/migrations/`
- `docs/decisions/0008-phase-07-publisher-content-isolation.md`
- `docs/reports/phase-07-completion.md`
- `docs/PHASES.md`
- `docs/BUILD_PROMPT.md`
- `fixtures/synthetic/isolation/`