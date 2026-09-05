---
name: Reviewed external exports
description: Safety and idempotency rules for exporting approved matter work to third-party storage.
---

Any external export that requires user review must bind confirmation to an immutable snapshot of the exact filenames and content revisions reviewed. Multi-file exports must persist each remote file's completion and an opaque provider-side identity as soon as it succeeds.

**Why:** Re-reading mutable work at confirmation can export content the lawyer never reviewed. Treating a multi-file write as one all-or-nothing request can duplicate confidential files after a partial or ambiguous provider failure.

**How to apply:** Before any provider write, compare current content against the reviewed snapshot and require a new review if it changed. On retry, skip completed items and search by the persisted opaque provider tag before creating an incomplete file.