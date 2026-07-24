# ADR 0008 — Phase 07: Publisher-Content Isolation & Verified Judicial Text

**Date**: 2026-07-24  
**Status**: Accepted  
**Supersedes**: The Phase 07 entry in `docs/PHASES.md` (was "Search & Research UI")

---

## Context

Phase 06 (ADR 0007) completed duplicate/version resolution and cross-file
reconstruction but explicitly deferred "automatic scrubbing" of publisher-
created editorial material:

> "Publisher-content isolation is partially implemented: the
> NO_PUBLISHER_CONTENT check flags suspected editorial material with UNCERTAIN,
> routing it to human review. Automatic scrubbing is out of scope for Phase 06."

The state machine already defines the full pipeline path through
`EDITORIAL_REVIEW_PENDING → EDITORIAL_REVIEW_REQUIRED →
JUDGMENT_VERIFICATION_PENDING → VERIFIED`, and `validation/pipeline.ts`
already transitions containers into `EDITORIAL_REVIEW_PENDING` at the end of
coherence validation. Phase 07 implements the content of those states.

The original Phase 07 ("Search & Research UI") is deferred to Phase 08; the
original Phase 08 ("AI Research Aids") becomes Phase 09. Both remain
unchanged in scope.

---

## Decision

Phase 07 delivers publisher-content isolation and judgment verification:

### 1. Section classification

Every page of a container's candidate span is classified at the section (block)
level into one of seven categories:

| Classification                  | Meaning                                                         |
| ------------------------------- | --------------------------------------------------------------- |
| `VERIFIED_JUDICIAL_TEXT`        | High-confidence court-issued text                               |
| `PROBABLE_JUDICIAL_TEXT`        | Likely judicial; insufficient corroborating publisher evidence  |
| `SUSPECTED_PUBLISHER_EDITORIAL` | High-confidence publisher-created editorial material            |
| `ADMINISTRATIVE_METADATA`       | Table of contents, cause lists, indexes                         |
| `SOURCE_ARTIFACT`               | Cover pages, spine text, bibliographic metadata                 |
| `UNKNOWN`                       | Insufficient signals to classify                                |
| `MANUAL_REVIEW_REQUIRED`        | Conflicting signals; human reviewer must decide                 |

### 2. Detection signals

The classifier uses: page location, layout, font changes, heading patterns,
repeated headers/footers, branding markers (publisher name, ISBN, copyright,
price), editorial vocabulary ("Headnotes", "Editorial Note",
"Publisher's Summary"), court-document conventions (cause number, coram block,
appearances block, judgment heading, numbered paragraph sequences), paragraph
continuity, and prior reviewer decisions.

### 3. Mandatory safeguards

A section **must not** be classified as `SUSPECTED_PUBLISHER_EDITORIAL` solely
because it:

- appears before the word "Judgment";
- contains a summary;
- contains catchword-like wording;
- appears in a footnote position;
- uses bold headings.

Each such feature requires at least one corroborating publisher-attribution
signal (branding markers, ISBN, copyright notice, price, explicit editorial
vocabulary unambiguous in a court-document context).

Court-issued summaries, judicial footnotes, judicial headings, and judicial
annexures are classified as `VERIFIED_JUDICIAL_TEXT` or
`PROBABLE_JUDICIAL_TEXT`.

### 4. Isolation enforcement

`SUSPECTED_PUBLISHER_EDITORIAL` sections are held separately from:
- the verified judicial text view;
- the full-text search index;
- embeddings;
- AI prompts and AI summaries;
- classification models;
- quotation tools.

A single `applyIsolationGate()` function enforces this; all downstream
consumers must call it.

### 5. Completeness verification

Before a container may reach `VERIFIED`, a completeness checker tests:

**Critical (blocking):** missing first page, missing final page, incomplete
opening sentence, incomplete ending (no dispositif), multiple judgments
accidentally combined.

**Non-critical (recorded as warnings):** skipped paragraph numbers, duplicate
paragraph numbers, possible missing orders/schedules/annexures, unreadable
pages, page number gaps.

### 6. Verified judgment record

A `research_verified_judgments` row is created only when:
- all approved judicial source spans are present;
- source refs, original page refs, and paragraph identifiers are recorded;
- a SHA-256 text checksum of the ordered judicial text is computed;
- unresolved non-critical warnings are listed;
- zero critical integrity warnings remain.

No container may reach `VERIFIED` while a critical integrity warning is
unresolved.

### 7. Database tables added

| Table                           | Purpose                                           |
| ------------------------------- | ------------------------------------------------- |
| `research_page_sections`        | One row per classified section within a page      |
| `research_editorial_runs`       | One row per editorial classification pass         |
| `research_verified_judgments`   | Full verified judgment record (one per candidate) |

### 8. Phase redefinition

| Phase | New name                                                |
| ----- | ------------------------------------------------------- |
| 07    | Publisher-Content Isolation & Verified Judicial Text    |
| 08    | Search & Research UI (previously 07)                    |
| 09    | AI Research Aids (previously 08)                        |

---

## Consequences

- `SUSPECTED_PUBLISHER_EDITORIAL` sections are auditable via
  `research_transformations` but never silently discarded.
- Paragraphs with confirmed judicial classification retain page-level source
  provenance.
- Incomplete cases (critical warnings) cannot be verified.
- The isolation gate is a structural prerequisite for search indexing and AI
  prompting, now safely deferred to Phase 08/09.
- The state machine (`CONTAINER_TRANSITIONS`) requires no changes — the
  states already exist.
