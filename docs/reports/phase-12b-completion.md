# Phase 12b Completion Report — Permission-Controlled Exports

**Date:** 2026-07-27  
**Phase:** 12b  
**Status:** COMPLETE

---

## Objective

Implement real, permission-gated export across six formats for verified judgment analysis — replacing the export stub — with provenance tagging on every content section and rights-restricted content stubs.

---

## Deliverables

### Export Module (`research/export/`)

| File | Responsibility |
|---|---|
| `exportService.ts` | `buildExport(judgmentId, format, scope, role)` → `{ contentType, filename, buffer }`; rights gate at top; calls format-specific renderer |
| `provenanceLabeller.ts` | `labelSection(text, provenance)` — prepends one of five provenance tags to any content block |
| `renderers/json.ts` | Structured `{ judgment, sections }` export; provenance per section |
| `renderers/markdown.ts` | Sections as Markdown headings + paragraphs with inline provenance tags |
| `renderers/csv.ts` | One row per AI proposition: field, content, confidence, provenance, judgment_citation |
| `renderers/bibliography.ts` | OSCOLA-style citation per authority from `research_authorities`; treatment label; plain text |
| `renderers/docx.ts` | DOCX via `docx` package; sections as Heading 1 / Normal paragraphs; provenance tags in italic |
| `renderers/pdf.ts` | PDF via `pdfkit`; title page with citation metadata; provenance tags in grey italic |

**5 provenance tags:** `[VERIFIED JUDICIAL TEXT]`, `[AI-GENERATED]`, `[USER-AUTHORED]`, `[UNVERIFIED]`, `[RIGHTS-RESTRICTED — content omitted]`.

**6 supported formats:** `docx`, `pdf`, `csv`, `json`, `markdown`, `bibliography`.

**4 scope options:** `full`, `judgment_only`, `analysis_only`, `annotations`.

---

### Rights Gate

At the top of `buildExport`, `assertExportAllowed` is called against the container rights record. If rights status is not in the approved set (OFFICIAL_COURT_SOURCE, PUBLIC_OR_OPEN_LICENCE_SOURCE, PRIVATE_PROCESSING_APPROVED, USER_OWNED_OR_AUTHORISED), all text sections are replaced with `[RIGHTS-RESTRICTED — content omitted]`; the export still succeeds but carries only citation metadata.

---

### API Routes

- `POST /api/research/containers/:id/exports` — accepts `{ format, scope }`; streams generated file with `Content-Disposition` header
- `GET /api/research/containers/:id/exports/history` — last 50 EXPORT_REQUESTED audit events for this container (admin/owner only)

---

### Key Design Decisions

1. **Provenance is mandatory per section** — every rendered section carries a provenance tag; no content can appear in an export without a tag identifying its origin.
2. **Rights-restricted export still succeeds** — returning a 403 on restricted export would leak information about what content exists; instead the export succeeds with stubs, enabling the caller to know the document exists and is restricted without seeing its text.
3. **No external dependencies for JSON/Markdown/CSV/bibliography** — plain string construction; only DOCX and PDF use npm packages, keeping the format-fallback surface small.
4. **Audit hook on every export** — `EXPORT_REQUESTED` with format and scope (no text) is always written, including for rights-restricted exports.

---

## Tests (`phase12b.test.ts`)

**22 new tests; 389 total tests across all phases.**

Coverage: per-format smoke tests (all 6 formats return 200 with non-empty buffer); provenance tag present in JSON, Markdown, CSV, bibliography outputs; rights-restricted: text replaced with stub, export still 200; invalid format → 400; invalid scope → 400; unauthenticated → 403; export history route returns recent events; export history is owner/admin-only (researcher → 403); `scope=judgment_only` excludes AI propositions; `scope=analysis_only` excludes judicial text; EXPORT_REQUESTED audit event recorded on successful export; container with no verified judgment → 422.

---

## PHASE: 12b | STATUS: complete | CHECKPOINT: 2026-07-27
