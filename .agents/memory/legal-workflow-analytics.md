---
name: Fail-closed legal workflow analytics
description: Privacy boundary for checkout and legal-workflow custom analytics.
---

Custom legal-workflow analytics must use a central, fail-closed contract that allowlists event names, property keys, enum values, booleans, and bounded numeric counts. Unknown events and properties are dropped. Potentially attacker- or server-controlled categories are normalized before tracking.

**Why:** Type-level primitive restrictions do not prevent access codes, emails, matter labels, legal instructions, filenames, connector identities, or other free-form strings from being sent. Legal workflow analytics must remain useful without becoming a shadow client-data store.

**How to apply:** Add any new event to the shared runtime contract first. Prefer controlled workflow dimensions and aggregate counts. Never add raw identifiers or user-authored/server-returned free text; map changing categories to a short allowlist with an `unknown` bucket.