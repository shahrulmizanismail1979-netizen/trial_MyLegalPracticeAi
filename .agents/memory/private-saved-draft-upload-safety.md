---
name: Private saved-draft upload safety
description: Security and lifecycle rules for direct-to-storage generated drafts.
---

Generated drafts uploaded with a presigned URL must never be served as active
inline content, regardless of uploaded MIME metadata. Confirming a stored draft
must atomically consume its owner- and purpose-bound grant and create the
idempotency-keyed saved-work record. A retry or concurrent duplicate must
return the winning record and remove the losing object.

**Why:** A presigned upload accepts arbitrary bytes. Trusting stored content
type can create same-origin stored XSS; non-atomic confirmation and duplicate
uploads otherwise create inconsistent rows or permanently orphan private data.

**How to apply:** Force reopen/download responses to plaintext attachment with
`nosniff`; use a database unique request key plus conflict-safe insert; retain
pending confirmation details across client retries; delete redundant objects
after a duplicate conflict and sweep expired unused grants.