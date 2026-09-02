# Phase 11b: Research Workspace

## What & Why
Researchers, lecturers, and students need personal organisation tools layered on top of the case collection: folders to group judgments, saved searches, reading lists, bookmarks, annotations, quotation collections pulled from validated AI passages, case-comparison tables, and authorities tables drawn from Phase 11a's extracted authorities. Workspace items are owned by a user and access is enforced per role (student access remains separate from lecturer access).

## Done looks like
- **Folders** — users can create research folders, course folders (lecturers only), and matter folders; judgments can be added to / removed from any folder the user owns; folder contents are paginated and filterable
- **Saved searches** — users can save a search query (with filters) and re-run it; saved searches are private to the owner
- **Reading lists** — ordered lists of judgments a user intends to read; items can be reordered and marked as read
- **Bookmarks** — existing `research_bookmarks` table extended with optional label and folder association; full CRUD API
- **Annotations** — existing `research_annotations` table extended with highlight range (char offsets), tags, and a `is_public` visibility toggle already present; full CRUD + list-by-judgment API
- **Quotation collections** — users can save a validated passage (from `research_ai_propositions.validated_passages`) as a named quotation; collections are listable and exportable as plain text
- **Case-comparison tables** — users create a named table, add up to 10 judgments as columns, choose which AI analysis fields to compare as rows; the table is stored as configuration and rendered on read
- **Authorities tables** — users create a named table scoped to one or more judgments; the table is populated from Phase 11a's `research_authorities` and `research_legislation_refs` for those judgments, with treatment labels and review status visible; the collection-limitation disclaimer is always included in the response
- **Permissions** — students cannot create course or matter folders; students cannot see `is_public: false` annotations from other users; lecturers can share reading lists and folders with enrolled students (flag, not full ACL); workspace items always enforce the underlying container view gate before returning judgment content
- Tests cover: folder CRUD, cross-user isolation (user A cannot read user B's private folder), student/lecturer permission split, quotation collection save + list, case-comparison table render, authorities table disclaimer present

## Out of scope
- Full ACL sharing (only the lecturer→student share flag)
- Export to PDF or Word (future)
- Real-time collaborative annotation

## Steps
1. **DB schema — workspace tables** — Add: `research_folders` (`id`, `owner_id`, `kind` enum `research|course|matter`, `name`, `description`, `created_at`); `research_folder_items` (`folder_id`, `judgment_id`, unique); `research_saved_searches` (`id`, `owner_id`, `name`, `query` jsonb, `created_at`); `research_reading_lists` (`id`, `owner_id`, `name`, `shared_with_students` bool, `created_at`); `research_reading_list_items` (`list_id`, `judgment_id`, `position` int, `read_at`, unique); `research_quotation_collections` (`id`, `owner_id`, `name`, `created_at`); `research_quotations` (`id`, `collection_id`, `proposition_id` FK, `passage_text`, `label`, `created_at`); `research_comparison_tables` (`id`, `owner_id`, `name`, `judgment_ids` jsonb, `field_names` jsonb, `created_at`); `research_authorities_tables` (`id`, `owner_id`, `name`, `judgment_ids` jsonb, `created_at`). Extend `research_bookmarks` with `label`, `folder_id`. Extend `research_annotations` with `char_start`, `char_end`, `tags` jsonb. Add migration.
2. **Folder service + routes** — CRUD for folders and folder items; `kind: "course"` and `kind: "matter"` creation blocked for `student` role; list returns judgment summaries with the container view gate applied per item.
3. **Saved-search service + routes** — Save/list/delete saved searches; re-run endpoint that executes the stored query against the existing search service.
4. **Reading-list service + routes** — CRUD for lists and items; reorder endpoint (position swap); mark-as-read endpoint; `shared_with_students` flag controls visibility to students in the same system.
5. **Bookmarks + annotations routes** — Full CRUD on top of the existing tables; extend bookmark with `label`/`folder_id`; extend annotation with `char_start`/`char_end`/`tags`; annotation list filters by `is_public` for non-owner callers.
6. **Quotation collections service + routes** — Save a passage from `research_ai_propositions.validated_passages` by proposition ID and char offsets; list collections and their quotations; plain-text export endpoint.
7. **Case-comparison table service + routes** — Create/update/delete tables (max 10 judgment columns); read endpoint assembles the comparison grid by fetching AI proposition content for each `field_name` × `judgment_id` pair from approved runs; returns structured rows.
8. **Authorities table service + routes** — Create/update/delete tables scoped to judgment IDs; read endpoint queries `research_authorities` and `research_legislation_refs` for the named judgments; always includes the fixed collection-limitation disclaimer; treatment review status visible in output.
9. **Permission enforcement** — All workspace reads enforce the underlying container view gate; `student` role blocked from `course`/`matter` folder creation and from seeing other users' private annotations; lecturer `shared_with_students` flag checked on reading-list reads for student callers.
10. **Tests** — Folder cross-user isolation; student blocked from course-folder creation; quotation save + list; comparison table render with two judgments; authorities table returns disclaimer; annotation visibility toggle.

## Relevant files
- `lib/db/src/schema/research.ts`
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/routes/analysis.ts` (pattern to follow for container gate)
- Phase 11a outputs: `research_authorities`, `research_legislation_refs` tables
