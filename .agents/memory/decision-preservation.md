---
name: Decision preservation
description: How to preserve explicit project decisions across long, multi-agent sessions.
---

Treat an explicit user decision, correction, or “keep this changed” instruction as a hard project constraint. Do not restore an older behavior because it is familiar, appears in an older task, or seems like a generic best practice. If current code conflicts with the decision, surface the conflict before changing it.

**Why:** Long sessions are summarized and task-agent merges can change the code between turns. Reconstructing intent from the latest files or an old plan can silently reintroduce behavior the user deliberately rejected.

**How to apply:** Before editing, review the durable decision record and current task state, make a short invariant checklist, search the code for the old behavior, and verify after editing that the settled behavior still holds. When evidence conflicts, ask one focused question rather than silently choosing.