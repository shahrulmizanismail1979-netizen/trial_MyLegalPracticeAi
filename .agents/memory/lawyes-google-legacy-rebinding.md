---
name: LAWYes Google legacy rebinding
description: Compatibility and ownership rules for Google connections created before named LAWYes members.
---

Google connections created before LAWYes had named members are bound to the Google subject rather than a member identity. They may be migrated on access only for the legacy shared-code owner, with row locking and immediate re-encryption under the current identity binding. A named member must never inherit or claim one of these historical rows.

**Why:** Existing encrypted rows use an older authenticated-encryption binding. Treating them as current rows makes them unreadable, while broadly reassigning them could transfer a lawyer's Google account to another member.

**How to apply:** Any future change to LAWYes Google identity or token encryption must preserve a narrowly scoped compatibility path for already stored rows, test direct reconnect as well as migration-on-read, and keep cross-member subject conflicts fail-closed.