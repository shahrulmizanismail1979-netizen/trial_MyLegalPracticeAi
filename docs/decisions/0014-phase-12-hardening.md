# ADR 0014 — Phases 12a–12d: Audit Hardening, Exports, Retention & Security

**Status:** Accepted  
**Phase:** 12 (sub-phases 12a, 12b, 12c, 12d)  
**Date:** 2026-07-27

## Context

With the research and workspace features complete (Phases 08–11b), the platform needed four hardening passes before a controlled pilot could be authorised:

- **12a** — extend audit coverage to every security-relevant action
- **12b** — implement real permission-gated exports (replacing the stub)
- **12c** — implement per-layer deletion with an honest deletion manifest
- **12d** — dependency audit, SAST scan, and a 13-category security test suite

These were delivered as four sub-phases with separate test files but a unified hardening goal. This ADR records the key design decisions across all four.

## Decisions

### D1 (12a) — `sanitiseForAudit` is unconditional

The text-leak guard runs on every metadata payload before insertion into `research_audit_events`. It is not opt-in per call site and cannot be bypassed. Any string value longer than 500 characters is removed. This makes it structurally impossible for restricted judgment text to appear in audit logs.

### D2 (12a) — 19 event types in a const enum

All event action strings live in `research/domain/auditEvents.ts` as a TypeScript const enum. This makes incomplete instrumentation a compile-time error: a call to `recordAuditEvent` with an unlisted action is rejected by the type checker.

### D3 (12b) — Provenance tagging is mandatory per section

Every section in every exported format carries a provenance tag. There is no "untagged" content. The five tags cover all content origins: `[VERIFIED JUDICIAL TEXT]`, `[AI-GENERATED]`, `[USER-AUTHORED]`, `[UNVERIFIED]`, `[RIGHTS-RESTRICTED — content omitted]`.

### D4 (12b) — Rights-restricted export returns 200 with stubs, not 403

Returning 403 for a restricted export leaks that the document exists. The export always succeeds; restricted sections are replaced with `[RIGHTS-RESTRICTED — content omitted]`. The caller can confirm the document exists and is restricted without seeing its content.

### D5 (12c) — `backupConfirmed: false` is a structural invariant

The deletion manifest always includes `backupConfirmed: false` with the note `"Backup deletion must be confirmed separately by the backup operator."` This field cannot be set to `true` by the application. Backup deletion is out-of-band and requires a separate confirmation by the backup operator.

### D6 (12c) — Partial failure is a valid, non-rolling-back outcome

Layer deletions that fail are recorded as `status: "failed"` in the manifest. Already-completed layers are not rolled back (some layer deletions are irreversible). The API returns 200 with the partial manifest.

### D7 (12d) — Path-traversal guard at the adapter layer

`validateStorageKey(key)` is applied in the object storage adapter, not just at route boundaries. Any key containing `..` or starting with `/` is rejected regardless of how the call reached the adapter.

### D8 (12d) — CSRF via `Content-Type: application/json` enforcement

All state-mutating routes require JSON content type. Form-encoded POST requests without a CSRF token receive 415. This is sufficient for a JSON API and avoids the complexity of synchronising CSRF tokens with a stateless API.

### D9 (12d) — Upload filename allowlist not blocklist

Uploaded filenames are validated against `[A-Za-z0-9._-]` after basename extraction. Unknown characters are rejected by default. A blocklist would require anticipating all attack patterns; an allowlist is safer by construction.

## Consequences

- `research/domain/auditEvents.ts` — 19-type const enum.
- `research/export/` — six format renderers; provenance labeller.
- `research/retention/deletionService.ts` — 9 layer kinds.
- `research_deletion_manifests` table.
- `validateStorageKey` in object storage adapter.
- Phase 12a–12d test suites: 18 + 22 + 15 + 32 = 87 new tests; 436 total.
- Security findings documented in `.local/tasks/security-findings.md`.

## Supersedes

Nothing. Extends ADR 0013.
