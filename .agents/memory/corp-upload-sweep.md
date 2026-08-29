---
name: Corp upload expiry cleanup
description: Durable rules for cleaning expired direct-upload registry rows and their storage objects.
---

Expired upload cleanup must remove the storage object before deleting its registry row. Treat an object-not-found result as successful cleanup, because abandoned presigned uploads may never create an object. Retain the row when storage returns a genuine transient failure so a later scheduled sweep can retry.

**Why:** Deleting the row first loses the only retry record, while treating every storage error as success can retain sensitive corporate documents indefinitely.

**How to apply:** Use the same object-first ordering for both scheduled cleanup and opportunistic pruning, and keep exactly one periodic scheduler in the API process in addition to the boot sweep.