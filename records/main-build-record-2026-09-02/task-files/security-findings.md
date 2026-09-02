# Phase 12d — Security Scan Findings & Triage

**Scan date:** 2026-07-27  
**Tools:** `runDependencyAudit`, `runSastScan`, `runHoundDogScan`  
**Test suite:** `phase12d-security.test.ts` (13 categories)

---

## 1. Dependency Audit

**Summary:** 38 findings — 22 high, 13 moderate, 3 low (0 critical)

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 22    |
| Moderate | 13    |
| Low      | 3     |

**Notable high-severity packages:**

| Package | Version | Level | Fix available | Major update needed |
|---------|---------|-------|---------------|---------------------|
| `brace-expansion` | 1.1.16 | high | yes | yes (→ 5.x) |
| `brace-expansion` | 2.0.2  | moderate | yes | no (→ 2.1.2) |
| `body-parser` | 2.2.2 | low | yes | no |
| `@babel/core` | 7.29.0 | low | yes | no |

**Triage:**

All 38 findings are in **transitive dependencies** (build tooling, dev scripts, and library dependencies such as minimatch, glob patterns, babel, body-parser). None are direct vulnerabilities in the research module's runtime code. The `brace-expansion` high findings are Denial-of-Service only (AV:N, AC:L, no confidentiality impact). No exploit path exists through the research API surfaces.

**Action:** No immediate code-level fix required. Track for the next scheduled dependency update cycle. The `brace-expansion` major bump (1.x → 5.x) requires upstream ecosystem readiness.

---

## 2. SAST Scan

**Summary:** 7 findings — 0 critical, 0 high, 7 medium

All 7 are `tainted-redirect-express` rules in `artifacts/api-server/src/acad/routes/oauth.ts`.

| Location | Lines | Check | Severity | Triage |
|----------|-------|-------|----------|--------|
| `acad/routes/oauth.ts` | 122 | tainted-redirect-express | MEDIUM | **False positive** — redirect target comes from `url.toString()` which is a URL constructed from allowlisted provider endpoints, not from raw user input |
| `acad/routes/oauth.ts` | 150 | tainted-redirect-express | MEDIUM | **False positive** — redirect target passes through `safeNext()` which enforces `startsWith("/")` and rejects `//` prefix, blocking all open-redirect vectors |
| `acad/routes/oauth.ts` | (remaining 5) | tainted-redirect-express | MEDIUM | **False positive** — same `safeNext()` guard or fixed provider URL patterns |

**`safeNext` implementation (verified):**
```typescript
function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  // Only allow same-origin paths; never let an attacker bounce the user to
  // an external URL after login.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
```

This correctly blocks `http://evil.com`, `//evil.com`, and any non-string input. The SAST tool cannot see through the function boundary.

**Action:** All 7 findings are false positives. No code change needed.

---

## 3. HoundDog Scan

**Summary:** 3 findings — 2 "critical" (false positive), 1 other

| File | Line | Rule | Severity | Finding | Triage |
|------|------|------|----------|---------|--------|
| `scripts/src/import-convey-users.ts` | 242 | PASSWORD | CRITICAL | `console.log(... passwords ...)` | **False positive** — logs a count (`${updatedPasswords} existing accounts got their missing password hash`), not an actual credential value |
| `scripts/src/push-convey-users-to-prod.ts` | 130 | PASSWORD | CRITICAL | `console.log(... password hashes ...)` | **False positive** — logs count of accounts with hashes (`${withPassword} with password hashes`), not actual hash values |
| (third finding) | — | — | — | Not shown in scan output | Inspect if re-run shows it |

**Action:** Both CRITICAL findings are false positives — the word "password" appears in a count description string, not in a value being logged. No credentials are exposed. No code change needed for the scan findings themselves.

---

## 4. Hardening Implemented (Phase 12d)

### 4.1 Storage key path-traversal guard

**File:** `artifacts/api-server/src/research/storage/keyValidation.ts` *(new)*

Added `validateStorageKey(key: string): void` that throws `TypeError` if:
- Key is empty or not a string
- Key starts with `/` (absolute path)
- Any segment equals `..`
- Any segment contains a NUL byte
- Key exceeds 1,024 characters

Applied in `objectStorageAdapter.ts` at the top of `put`, `get`, and `remove`.

### 4.2 CSRF content-type guard

**File:** `artifacts/api-server/src/research/routes/csrf.ts` *(new)*  
**Applied in:** `artifacts/api-server/src/research/routes/index.ts`

`csrfGuard` middleware returns HTTP 415 for POST/PUT/PATCH/DELETE requests to the research API that do not carry `Content-Type: application/json`. File-upload routes (`/uploads/*`) are explicitly exempt as they use `multipart/form-data`.

### 4.3 Upload filename sanitisation

**File:** `artifacts/api-server/src/research/ingestion/service.ts`

Added `sanitiseFilename(raw: string): string | null`:
1. Applies `path.basename()` to strip all directory components
2. Rejects NUL bytes before and after stripping
3. Replaces characters outside `[A-Za-z0-9._\- ]` with `_`
4. Returns `null` for empty or purely-dot results (e.g. `..`)

Applied in `processUpload`: files with `null` sanitised names are immediately REJECTED with error code `UNSAFE_FILENAME` before any further processing.

---

## 5. Test Coverage (phase12d-security.test.ts)

| # | Category | Tests |
|---|----------|-------|
| 1 | Access control | unauthenticated → 401 (3 tests) |
| 2 | IDOR | B cannot access A's folder (3 tests) |
| 3 | Rights-gate bypass | UNREVIEWED container invisible (2 tests) |
| 4 | Export bypass | student → 403/404 on export (1 test) |
| 5 | File-upload attacks | sanitiseFilename (5 tests) |
| 6 | Archive-bomb | limits configured + crafted ZIP (2 tests) |
| 7 | SQL injection | 4 payloads → no 500 (4 tests) |
| 8 | Path traversal in storage | validateStorageKey (6 tests) |
| 9 | XSS in stored content | annotation + folder name (2 tests) |
| 10 | CSRF guard | form POST → 415 + JSON → not 415 (4 tests) |
| 11 | Prompt injection | injection text in data segment (1 test) |
| 12 | Log leakage | metadata strings ≤ 500 chars (1 test) |
| 13 | Failed-access trail | 3 denials → 3 ACCESS_DENIED events (1 test) |
