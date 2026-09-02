# Phase 12b: Permission-Controlled Exports

## What & Why
Researchers need to export verified judgment analysis in multiple formats for academic writing, court preparation, and teaching. Currently the export endpoint is a stub that returns a placeholder. Phase 12b implements real, permission-gated export across six formats: DOCX, PDF, CSV, JSON, Markdown, and bibliography. Every exported section must be labelled with its content provenance (verified judicial text / AI-generated / user-authored / unverified / rights-restricted).

## Done looks like
- `POST /api/research/containers/:id/exports` accepts `{ format, scope }` and streams the generated file; the response includes `Content-Disposition` with the appropriate filename.
- Supported formats: `docx`, `pdf`, `csv`, `json`, `markdown`, `bibliography`.
- Scope options: `full` (all sections), `judgment_only` (verified text only), `analysis_only` (AI propositions), `annotations` (user annotations), `authorities` (cited cases + legislation).
- Every section heading or cell includes a provenance tag: one of `[VERIFIED JUDICIAL TEXT]`, `[AI-GENERATED]`, `[USER-AUTHORED]`, `[UNVERIFIED]`, `[RIGHTS-RESTRICTED — content omitted]`.
- Documents whose rights status is not `OFFICIAL_COURT_SOURCE` or `LICENSED` have all text replaced with `[RIGHTS-RESTRICTED — content omitted]`; the export still succeeds but carries only metadata.
- Export events are audited (`EXPORT_REQUESTED` via Phase 12a audit infra).
- `GET /api/research/containers/:id/exports/history` returns the last 50 export events for that container (admin/owner only).
- Tests `phase12b.test.ts` cover: format generation (≥ one test per format), provenance tagging present in output, rights-restricted judgment text is absent from export when rights not approved, unauthenticated user receives 403.

## Out of scope
- Batch export of multiple judgments in a single call (future phase)
- Citation-manager integrations (Zotero, Mendeley)
- Custom export templates
- Print server / server-side rendering to printer (print events are audited but physical print is browser-side)

## Steps
1. **Export service scaffold** — create `research/export/exportService.ts` with a function `buildExport(judgmentId, format, scope, role)` returning `{ contentType, filename, buffer }`. All format renderers call this.
2. **Provenance labelling** — implement a `labelSection(text, provenance)` helper that prepends the appropriate tag to any content block; used by all renderers.
3. **Rights gate** — at the top of `buildExport`, call `assertExportAllowed` (already exists in `domain/gates.ts`). If rights status is not approved, replace all text blocks with the rights-restricted stub; still include metadata (citation, court, date).
4. **JSON renderer** — structured export: `{ judgment: { citation, court, date }, sections: [{ kind, provenance, content }] }`. Easiest format; implement first.
5. **Markdown renderer** — convert sections to Markdown headings + paragraphs with provenance tags inline. Use plain string concatenation, no external library needed.
6. **CSV renderer** — one row per AI proposition: columns `field`, `content`, `confidence`, `provenance`, `judgment_citation`. Use a minimal CSV serialiser (no external lib).
7. **Bibliography renderer** — OSCOLA-style citation string for each cited case from `research_authorities`; one entry per line; includes treatment label. Outputs as plain text with `.bib.txt` extension.
8. **DOCX renderer** — use the `docx` npm package (already in ecosystem or to be installed). Sections map to Heading 1 / Normal paragraphs; provenance tags in italic.
9. **PDF renderer** — use `pdfkit` npm package to produce a minimal PDF: title page with citation metadata, then sections. Provenance tags in grey italic.
10. **Route implementation** — replace the stub in `POST /containers/:id/exports`; add `GET /containers/:id/exports/history` reading audit events for `EXPORT_REQUESTED` on that container.
11. **Audit hook** — emit `EXPORT_REQUESTED` with `{ format, scope, judgmentId }` (no text) via Phase 12a audit helper.
12. **Tests** — `phase12b.test.ts`: per-format smoke tests against a seeded verified judgment; provenance tag assertions; rights-restricted stub present when rights not approved; 403 for unauthenticated; audit event written.

## Relevant files
- `artifacts/api-server/src/research/routes/index.ts:476`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/analysis/generator.ts`
- `lib/db/src/schema/research.ts`
