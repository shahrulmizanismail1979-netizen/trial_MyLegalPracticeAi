---
name: api-server testing pattern
description: How to write integration tests for the api-server (object storage + pdf-parse + live DB)
---

# api-server integration tests

Tests use vitest + supertest (`pnpm --filter @workspace/api-server run test`, registered as the `api-tests` validation command).

- **Object storage must be mocked.** `../lib/objectStorage` depends on the Replit sidecar (127.0.0.1:1106) + GCS, unavailable/non-deterministic in CI. `vi.mock` it and feed real file bytes from an in-memory registry so the extraction pipeline runs on real buffers.
- **Do NOT mock `pdf-parse`.** It runs fine under vitest un-externalized (it is only externalized in the esbuild bundle because of native @napi-rs/canvas). A hand-built minimal PDF with correct xref offsets is enough for `PDFParse.getText()` to extract.
- **DB is the live `DATABASE_URL`** (no separate test DB). Tag rows with a per-run UUID marker and delete only those rows in `afterAll` to avoid polluting dev data.
- **Why:** the upload → extraction → knowledge-base flow has no other automated coverage; a pdf-parse/bundling regression would otherwise fail silently in production.
