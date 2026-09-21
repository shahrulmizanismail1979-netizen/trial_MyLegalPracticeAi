---
name: Chat isolation and upload submitter binding
description: How CCB/Lit chat isolation works and how research uploads are bound to submitters.
---

## Upload submitter binding (research platform)

`research_source_containers.uploaded_by` (nullable TEXT) — populated by the ingest processor by looking up `research_upload_batches.uploaded_by` from the batch record. Null for containers created before migration 0022.

**Why:** Without the column, there was no way to enforce per-submitter access on pre-verified containers or audit who uploaded what.

**How to apply:** In the ingest processor, call `getBatch(item.batchId, dbc)` after loading the batch item to get `uploadedBy`, then pass it to `registerContainer({ ..., uploadedBy })`.

---

## CCB chat isolation

Ownership denial must be side-effect-free: authorize the parent within the deleting statement or transaction before deleting child messages.

**Why:** A rejected cross-tenant DELETE can still erase another user's messages if children are deleted before the owner-scoped parent check. A 404 response alone does not prove isolation.

**How to apply:** Prefer an owner-scoped parent deletion with an established cascade. Regression tests must confirm the owner's conversation and messages remain intact after a foreign DELETE, alongside successful owner deletion.

`ccb_conversations.access_code_id` (nullable INTEGER FK → ccb_access_codes.id, ON DELETE CASCADE) — added by migration 0023.

`requirePractitioner` in `ccb/routes/auth.ts` resolves the access code to a DB row ID and stores it on `res.locals["ccbAccessCodeId"]` (null for static/admin codes).

All conversation CRUD in `ccb/routes/gemini.ts` filters by `accessCodeId` when non-null. Admin (null) sees all.

**Pattern:** `callerAccessCodeId(res)` helper reads `res.locals["ccbAccessCodeId"]`. Filter is `accessId !== null ? eq(ccbConversations.accessCodeId, accessId) : undefined`.

---

## Lit chat isolation

`lit_conversations.access_code_id` (nullable INTEGER FK → lit_access_codes.id, ON DELETE CASCADE) — added by migration 0023.

`requireLitAuth` exported from `lit/routes/auth.ts` — session-based, checks `req.session.accessCodeId`, does a per-request DB re-check for expiry (portal-expiry-enforcement rule), stores on `res.locals["litAccessCodeId"]`.

Applied in `lit/routes/index.ts` as `router.use("/gemini", requireLitAuth, geminiRouter)`.

**Why gemini routes had no auth before:** The lit router index mounted gemini without any middleware wrapper. requireLitAuth was added specifically for this.
