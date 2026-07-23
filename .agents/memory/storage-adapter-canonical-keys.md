---
name: Storage adapter canonical keys
description: Research-platform storage adapters may prefix keys; always persist the key returned by put(), never the input key.
---

The research StorageAdapter contract: `put(key, bytes)` returns the canonical storage key, and the real object-storage adapter prefixes it with `<PRIVATE_OBJECT_DIR>/research/`. `get()` expects that full canonical key.

**Why:** The extraction pipeline once persisted the raw input key instead of the returned key. Tests passed (the in-memory adapter echoes the key back) but every fetch against real object storage 404'd (`STORAGE_FETCH_FAILED`).

**How to apply:** Anywhere research code stores bytes and records a key in the DB, save the value returned by `storage.put(...)`. When adding tests for storage-key round-trips, remember the memory adapter cannot catch prefix mismatches — verify against the real adapter's contract.
