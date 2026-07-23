# ADR 0001 — Bootstrap the platform inside the existing monorepo

- **Date**: 2026-07-22
- **Status**: Accepted

## Context

The judgment research platform must eventually serve the eight existing legal
portals (MyLitAI, MyLitAI IRAC, MySyalitAI, MyCorpLegalAI, MyConveyLitAI,
MyCrimAI, MyCCBLitAI, MyAccidentAI), which already share one Express API
server, one PostgreSQL database, and common auth (per-portal codes, Microsoft
SSO, master access code).

## Decision

Build the platform as a `research` module inside `artifacts/api-server`
(mounted at `/api/research`), with `research_`-prefixed tables in the shared
`@workspace/db` schema, rather than as a separate application.

- Initial job queue: database-backed (`research_jobs`), replaceable later.
- Storage, OCR, search, and AI providers sit behind replaceable adapters.
- AI is disabled by default.

## Consequences

- Portals can integrate research features without cross-service auth.
- Table prefixing (`research_`) avoids collisions in the shared database.
- The module keeps strict submodule boundaries (web/data/processing/storage/
  AI) so it can be extracted into its own service later if scale requires.
