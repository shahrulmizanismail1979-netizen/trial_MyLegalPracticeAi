# Phase 12d: Security Review and Penetration Tests

## What & Why
The research platform handles sensitive legal documents, personal data, AI output, and rights-restricted content. Before the platform can be opened to real researchers, it must pass a structured security review. Phase 12d runs Replit's dependency audit and SAST scanner, then writes a project-specific Vitest/supertest penetration test suite covering all categories specified in the acceptance gate.

## Done looks like
- `pnpm audit` and the Replit security scan tools run without any **unresolved critical or high** severity findings. Medium findings are documented with mitigations; low/info findings are noted.
- A new test file `phase12d-security.test.ts` (and any helpers) exercises every category below and all tests pass:
  - **Access-control** — unauthenticated requests to all gated routes return 401/403, not 200 or 500.
  - **Insecure direct object reference (IDOR)** — researcher A cannot read, modify, or delete researcher B's folders/annotations/collections/comparison tables via guessed numeric IDs.
  - **Rights-gate bypass** — a judgment whose container is in a non-approved rights state cannot be exported, downloaded, or viewed even if the caller knows the `judgmentId`.
  - **Export bypass** — a student cannot access an export endpoint that requires owner/admin role; the export of a rights-restricted judgment omits the text body.
  - **File-upload attacks** — attempting to register a container with a path-traversal filename (`../../etc/passwd`), an oversized declared size, and a ZIP-bomb content hash is rejected with a 400-level error.
  - **Archive-bomb** — uploading a polyglot or recursive archive as a source document is caught at validation (mime-type/content-type check); does not cause server OOM.
  - **SQL injection** — search queries containing SQL metacharacters (`'; DROP TABLE research_users; --`) are safely handled by Drizzle's parameterised queries and return an empty result set (not a 500).
  - **Path traversal in object storage keys** — the storage adapter rejects any key containing `..` or absolute paths; a direct GET with such a key returns 400.
  - **XSS in stored content** — annotation and folder names containing `<script>` tags are stored as literal text and returned as JSON (not executed); no `text/html` content-type is ever returned from API routes without an explicit set.
  - **CSRF** — state-mutating routes (POST/PUT/PATCH/DELETE) require a JSON body with `Content-Type: application/json`; form-encoded POST requests without a CSRF token are rejected.
  - **Prompt injection** — AI analysis requests that include user-controlled text (e.g., judgment text containing `"Ignore previous instructions"`) are passed to the LLM via a fixed system prompt structure and the injected text is treated as data, not instructions. Test asserts the analysis run completes without adopting injected instructions (mock LLM).
  - **Log leakage** — trigger a `DOCUMENT_ACCESSED` event on a judgment, then retrieve the audit log; assert that the full verified judgment text does not appear in any `metadata` field.
  - **Failed access attempts** — three consecutive failed access attempts by a researcher to a forbidden container each produce `ACCESS_DENIED` audit events with correct actor and entity.
- A `security-findings.md` report is written to `.local/tasks/` summarising scanner output, any accepted-risk decisions, and mitigations applied.

## Out of scope
- Full penetration test of the Stripe or Clerk integrations (separate third-party scope)
- OWASP ZAP or browser-based XSS testing (API-only scope)
- Network-layer security (handled by Replit's infrastructure)
- Social-engineering / phishing vectors

## Steps
1. **Dependency audit** — run `pnpm audit` across the workspace; run `runDependencyAudit` via Replit's security tooling. Record all critical/high findings. For each, either apply a fix (package update, `pnpm audit fix`, or override) or document accepted-risk rationale.
2. **SAST scan** — run `runSastScan` and `runHoundDogScan` via Replit's security tooling. Triage results; fix all critical/high; document medium and below.
3. **CSRF guard** — verify existing middleware enforces `Content-Type: application/json` on mutating routes; add enforcement if missing.
4. **Path-traversal guard** — add a storage-key validation function that rejects keys containing `..` or starting with `/`; apply in the object storage adapter and in any route that accepts a storage key from the caller.
5. **Upload validation hardening** — ensure the file-registration route validates: filename characters (allow only `[A-Za-z0-9._-]` after basename extraction), declared size within a configurable maximum, and that the content type is one of an allowed-list of MIME types.
6. **Security test suite** — write `phase12d-security.test.ts` covering all categories from Done looks like. Use supertest against the mounted research router; stub the object storage and LLM calls where needed. Each test should be independently runnable and have a descriptive name matching the attack category.
7. **Security findings report** — after scanner runs and test authoring, write `.local/tasks/security-findings.md` with: scanner tool versions, finding counts by severity, per-finding triage notes, and any code changes made in response.

## Relevant files
- `artifacts/api-server/src/research/routes/index.ts`
- `artifacts/api-server/src/research/routes/uploads.ts`
- `artifacts/api-server/src/research/routes/workspace.ts`
- `artifacts/api-server/src/research/routes/viewer.ts`
- `artifacts/api-server/src/research/domain/gates.ts`
- `artifacts/api-server/src/research/domain/access.ts`
- `artifacts/api-server/src/research/domain/audit.ts`
- `artifacts/api-server/src/research/analysis/generator.ts`
- `.local/skills/security-scan/SKILL.md`
