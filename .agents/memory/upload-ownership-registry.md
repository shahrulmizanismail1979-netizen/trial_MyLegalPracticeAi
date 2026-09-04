---
name: Upload ownership registry must be DB-backed
description: Presigned-upload ownership binding must persist in the DB, not process memory
---

Binding an issued upload object path to its owner and intended parent record (such as a matter) must live in the DB. Long external processing must claim it durably, then atomically attach the result and remove the claim.

**Why:** process-local grants break across restarts. Owner-only grants can be replayed into another record owned by the same user. Deleting after failed ownership creates a cross-tenant IDOR. External work must not hold open or roll back the one-time DB claim.

**How to apply:** never download or delete until an owner-and-parent-bound claim succeeds. Claim before external work; atomically attach and remove on success. On failure/expiry, first mark that exact claim for cleanup; retry storage deletion with a scheduled sweeper.
