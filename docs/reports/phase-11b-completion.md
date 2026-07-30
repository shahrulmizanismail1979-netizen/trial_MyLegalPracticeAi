# Phase 11b Completion Report — Research Workspace

**Date:** 2026-07-26  
**Phase:** 11b  
**Status:** COMPLETE

---

## Objective

Give researchers, lecturers, and students personal organisation tools layered on top of the case collection: folders, saved searches, reading lists, quotation collections, case-comparison tables, and authorities tables — all with cross-user isolation and role-based permission splits.

---

## Deliverables

### Database Migrations (`0018-phase11b-workspace.sql`)

Nine new tables (plus extensions to two existing tables):

| Table | Purpose |
|---|---|
| `research_folders` | Per-user folders; kind enum (research/course/matter); course and matter kinds blocked for student role |
| `research_folder_items` | Junction: folder ↔ judgment (unique per pair) |
| `research_saved_searches` | Per-user saved query + filter JSON; private to owner |
| `research_reading_lists` | Per-user ordered lists; `shared_with_students` flag controls student visibility |
| `research_reading_list_items` | Ordered items in a reading list; `read_at` timestamp for mark-as-read |
| `research_quotation_collections` | Named collections of validated passages per user |
| `research_quotations` (workspace) | Saved passage from `research_ai_propositions.validated_passages`; label; collection FK |
| `research_comparison_tables` | Named table: up to 10 judgment IDs + field names; rendered on read |
| `research_authorities_tables` | Named table scoped to judgment IDs; populated from Phase 11a tables on read; always includes disclaimer |

**Extended tables:** `research_bookmarks` gains `label` and `folder_id`; `research_annotations` gains `char_start`, `char_end`, `tags` JSONB.

---

### Workspace Module (`research/workspace/`)

| Service | Responsibility |
|---|---|
| `folderService.ts` | CRUD + folder items; kind enforcement (student → research only); list applies container view gate per item |
| `savedSearchService.ts` | Save/list/delete; re-run endpoint executes stored query against search service |
| `readingListService.ts` | CRUD; reorder; mark-as-read; `shared_with_students` flag checked for student callers |
| `quotationCollectionService.ts` | Save passage from proposition ID; list collections and quotations; plain-text export |
| `comparisonTableService.ts` | Create/update/delete; read assembles comparison grid from approved AI propositions |
| `authoritiesTableService.ts` | Create/update/delete; read queries Phase 11a tables; always includes collection-limitation disclaimer |

---

### API Routes (`research/routes/workspace.ts`)

Full CRUD routes for all workspace entity types under `/api/research/`. All reads enforce the underlying container view gate before returning judgment content.

---

### Key Design Decisions

1. **All workspace reads enforce the container gate** — workspace items are pointers to judgments; the container access decision is re-evaluated on every workspace read, not cached at save time.
2. **Cross-user isolation enforced at DB layer** — all queries include a `WHERE owner_id = researchUserId` predicate; no service-layer filtering on top of a full-table fetch.
3. **Authorities table disclaimer is non-optional** — every authorities table read includes the collection-limitation disclaimer string regardless of how many judgments the table covers.
4. **Student role cannot create course or matter folders** — enforced at the service layer; student callers receive 403 on attempt.

---

## Tests (`phase11b.test.ts`)

**13 new tests; 349 total tests across all phases.**

Coverage: folder CRUD; cross-user isolation (user B cannot see user A's private folder); student blocked from course-folder creation; student CAN create research folders; shared reading list visible to student; non-shared reading list invisible to student; saved search create + list + delete; quotation collection create + quotation save + list; quotation plain-text export; comparison table render (one judgment, one field → grid); authorities table returns disclaimer; annotation visibility toggle (`is_public` controls other-user visibility); bookmark upsert + list.

---

## PHASE: 11b | STATUS: complete | CHECKPOINT: 2026-07-26
