---
name: Artifact-aware publish preflight
description: How to reproduce multi-artifact publish builds locally without false environment failures.
---

A plain recursive workspace build does not inject each artifact's service environment. Web builds that require `PORT` and `BASE_PATH` can therefore fail locally even though Replit publishing supplies those values correctly.

**Why:** A deployment repair initially appeared to expose additional build failures, but the reported missing environment variables and root-path asset error came from the generic local command rather than the source or publish configuration.

**How to apply:** Run the workspace typecheck normally. For production-build verification, execute each registered artifact's configured build command with the `PORT` and `BASE_PATH` declared for that artifact instead of sharing one generic environment across all web packages.