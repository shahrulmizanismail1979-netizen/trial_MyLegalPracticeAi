---
name: MyLawFirmAi workspace ownership
description: Owner-approved treatment of legacy records and subscriber confidentiality boundaries.
---

All pre-isolation MyLawFirmAi records belong to the platform owner's private
workspace. Each subscribing firm's records must be separate. Never distribute
legacy records to subscribers or infer historical ownership from task assignees.

**Why:** The owner explicitly selected this treatment when the release review
found that subscription codes previously opened a shared dataset.

**How to apply:** Preserve legacy data and owner access during schema changes.
Derive the subscriber workspace from authenticated subscription identity, not
request parameters. Keep manager authorization separate from the shared staff
access code. The owner's connected Drive/mail accounts are not subscriber-firm
accounts and must not receive subscriber documents automatically.