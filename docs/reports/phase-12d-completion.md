# Phase 12d Completion Report — Security Hardening

**Date:** 2026-07-28  
**Phase:** 12d  
**Status:** COMPLETE

---

## Objective

Confirm no unresolved critical or high dependency vulnerabilities; harden the platform against the 13 attack categories in the acceptance gate; produce a security findings report.

---

## Deliverables

### Dependency Audit and SAST Scan

- `pnpm audit` run across the workspace; no unresolved critical or high severity findings.
- Replit `runDependencyAudit`, `runSastScan`, and `runHoundDogScan` run; results documented in `.local/tasks/security-findings.md`.
- All critical/high findings resolved; medium and below documented with mitigations.

---

### Security Hardening Code Changes

**CSRF guard** — all state-mutating routes (POST/PUT/PATCH/DELETE) under `/api/research` enforce `Content-Type: application/json`; form-encoded POST requests without JSON content type receive 415.

**Path-traversal guard** — `validateStorageKey(key)` added to the object storage adapter; rejects any key containing `..` or starting with `/`; applied to all storage get/put/delete calls and any route that accepts a storage key from the caller.

**Upload validation hardening** — file-registration route validates: filename characters (only `[A-Za-z0-9._-]` after basename extraction), declared size within configurable maximum, content type in the allowed-list of MIME types.

---

### Security Test Suite (`phase12d-security.test.ts`)

**13 test categories:**

| # | Category | Test assertion |
|---|---|---|
| 1 | Access control | Unauthenticated requests to all gated routes → 401, not 200 or 500 |
| 2 | IDOR | Researcher B cannot access researcher A's folders/annotations/collections via guessed IDs |
| 3 | Rights-gate bypass | Container with non-approved rights status cannot be exported, downloaded, or viewed even with known judgmentId |
| 4 | Export bypass | Student cannot reach export endpoint requiring owner/admin; rights-restricted export omits text body |
| 5 | File-upload attacks | Path-traversal filename, oversized declared size, ZIP-bomb content hash rejected with 400-level error |
| 6 | Archive bomb | Polyglot/recursive archive rejected at validation; no server OOM |
| 7 | SQL injection | Query containing SQL metacharacters returns empty result set, not 500 |
| 8 | Path traversal in storage keys | `validateStorageKey` rejects keys containing `..` or absolute paths → 400 |
| 9 | XSS in stored content | Annotation/folder names with `<script>` stored as literal text, returned as JSON; no `text/html` from API |
| 10 | CSRF | Form-encoded POST to research API → 415 |
| 11 | Prompt injection | Injected text in judgment is treated as data; analysis run completes without adopting instructions (mock LLM) |
| 12 | Log leakage | Full verified judgment text absent from all `metadata` fields in DOCUMENT_ACCESSED audit event |
| 13 | Failed-access audit trail | Three consecutive denied access attempts each produce ACCESS_DENIED events with correct actor and entity |

---

### Security Findings Report (`.local/tasks/security-findings.md`)

Documents scanner tool versions, finding counts by severity, per-finding triage notes, and all code changes made in response.

---

### Key Design Decisions

1. **Path-traversal guard at the adapter layer** — validation applied in the storage adapter, not just at the route level, so no code path can bypass it by calling the adapter directly.
2. **Upload filename allowlist not blocklist** — only `[A-Za-z0-9._-]` characters are permitted after basename extraction; this is safer than a blocklist because it rejects unknown attack characters by default.
3. **CSRF via Content-Type enforcement, not tokens** — the research API is a JSON API; requiring `Content-Type: application/json` is sufficient and avoids the complexity of synchronising CSRF tokens with a stateless API.
4. **Prompt injection treated as data** — the AI input boundary builder (Phase 10) places user-controlled content in a strict data slot within the system prompt; injected instructions are never interpreted as prompt commands.

---

## Tests (`phase12d-security.test.ts`)

**32 new tests; 436 total tests across all phases.**

---

## PHASE: 12d | STATUS: complete | CHECKPOINT: 2026-07-28
