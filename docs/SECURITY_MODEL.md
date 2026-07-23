# Security Model — Judgment Research Platform

## Principles

1. **Private by default.** The research platform is not public. Every
   `/api/research` route requires staff authentication (the platform serves
   internal research across the eight portals; end-subscriber access is a
   later, explicitly-designed phase).
2. **Rights gating precedes access.** No source content is served, indexed,
   or processed beyond registration until its rights status permits it
   (see `RIGHTS_MODEL.md`). All files begin `UNREVIEWED`.
3. **Restricted data never enters logs.** Log lines may carry container ids,
   checksums, job ids, and states — never judgment text, file contents, or
   personal data extracted from documents.
4. **Secrets** are stored in Replit Secrets (environment variables). No
   credentials in code, fixtures, or docs.
5. **Real restricted case files are excluded from source control and test
   fixtures.** Only synthetic fixtures are committed (`fixtures/synthetic`).
   `fixtures/golden` holds curated _expected outputs_ derived from synthetic
   inputs only. `.gitignore` blocks common document formats elsewhere under
   `fixtures/`.
6. **Storage is private.** Containers are staged in the private object
   storage directory; no public ACLs; access is mediated by the API with
   authentication and rights checks.
7. **Destructive migrations require explicit approval.** Schema changes are
   additive by default; anything destructive needs a recorded decision in
   `docs/decisions/` and user approval.

## Phase 00 Enforcement

- `/api/research` is mounted behind the existing staff auth middleware.
- `research_source_containers.rights_status` defaults to `UNREVIEWED` at the
  database level.
- Job payloads carry references (ids, keys), not content.
- The AI adapter is disabled; no data can flow to AI providers.
