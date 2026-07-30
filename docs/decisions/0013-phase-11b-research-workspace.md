# ADR 0013 — Phase 11b: Research Workspace

**Status:** Accepted  
**Phase:** 11b  
**Date:** 2026-07-26

## Context

Phase 11a produced a structured authorities layer. Researchers, lecturers, and students now need personal organisation tools: folders, saved searches, reading lists, quotation collections, comparison tables, and authorities tables. The design constraints are cross-user isolation (user A must never see user B's private items), role-based permission splits (student vs. lecturer vs. researcher), and the invariant that workspace reads must always re-check the underlying container view gate.

## Decisions

### D1 — Container gate re-evaluated on every workspace read

Workspace items are stored as pointers (judgment IDs). The container access decision is re-evaluated on every workspace read, not cached at the time the item was saved. This means a rights revocation (e.g. container quarantined) immediately takes effect for all workspace reads pointing to that container.

### D2 — Cross-user isolation enforced at DB layer

All queries include `WHERE owner_id = researchUserId` directly in the SQL predicate. There is no service-layer filtering on top of a full-table fetch. This makes the isolation enforceable by inspection and immune to service-layer bugs.

### D3 — Authorities table disclaimer is structural, not optional

Every authorities table read includes the collection-limitation disclaimer string from Phase 11a's `getCitationGraph`. The service never returns an authorities table without it, regardless of how many judgments the table covers.

### D4 — Student role: research folders only

Students can create `research` kind folders. They are blocked from creating `course` and `matter` folders. This is enforced at the service layer (403 on attempt), not by a UI affordance alone.

### D5 — Lecturer `shared_with_students` flag, not full ACL

Lecturers can share reading lists and folders with students via a boolean flag. Full ACL sharing (per-user, per-folder grants) is deferred. This keeps the permission model simple for the initial release.

### D6 — Quotation collections save validated passages, not raw text

Quotation collection items are saved by proposition ID and char offsets into a validated passage from `research_ai_propositions.validated_passages`. They are not arbitrary text strings. This maintains the provenance chain from workspace item → AI proposition → verified judicial text.

## Consequences

- Nine new DB tables (see phase-11b-completion.md).
- Two extended tables: `research_bookmarks` gains `label`, `folder_id`; `research_annotations` gains `char_start`, `char_end`, `tags`.
- Workspace module: `research/workspace/`.
- Routes: `research/routes/workspace.ts`.
- Target: ≥ 349 tests (336 existing + 13 new).

## Supersedes

Nothing. Extends ADR 0012.
