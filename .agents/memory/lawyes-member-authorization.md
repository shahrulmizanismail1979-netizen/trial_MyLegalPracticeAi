---
name: LAWYes member authorization
description: Durable security boundaries for named member identities layered over legacy access-code tenants.
---

Named LAWYes members are additive identities inside the existing access-code tenant. A personal member session must remain on grant-aware LAWYes and linked-conversation routes; it must not inherit tenant-wide specialist APIs merely because the session also carries the tenant access-code ID. Tenant administration does not imply matter access: even a named tenant owner needs an explicit per-matter grant.

**Why:** The access-code ID preserves canonical tenant ownership, but legacy specialist routes interpret it as full-tenant authority. Letting a named session call those routes would bypass per-matter grants for files, outputs, and other resources.

**How to apply:** Any new route available to named members must resolve the member on every request, require an explicit matter grant and role, and return not-found for inaccessible resources. Legacy shared-code sessions retain their existing behavior.

Personal sign-in codes are hash-backed credentials and are never eligible for Microsoft access-code linking or any other plaintext credential store.

**Why:** The Microsoft link table stores legacy access codes as text. Linking a personal code there would silently create a reusable plaintext copy even though the member credential table stores only hashes.

**How to apply:** Keep personal codes on the normal LAWYes sign-in path, reject them before all SSO link writes, and redact/disable any matching value found after a partial rollout. Future identity integrations should link by member ID or a dedicated opaque binding, never by replaying the personal code.