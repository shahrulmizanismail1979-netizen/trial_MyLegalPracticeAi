---
name: Regression-safe delivery
description: Project-wide rule for preserving already-working customer flows while adding or fixing features.
---

Every feature change or bug fix must include a regression pass over the adjacent customer flows it could affect. A change is not complete when the new path works if an existing paid, authenticated, saved-data, export, or portal path is broken; if validation is blocked, report it as blocked rather than presenting it as finished.

**Why:** Repeated cross-portal changes have caused previously working paths to regress, which creates customer disruption and makes the creator pay twice for work that should have remained settled.

**How to apply:** Before delivery, identify the changed boundary, run the smallest meaningful browser/API checks for the new path and its neighboring paths, inspect workflow and browser logs, and do not recommend publishing until the relevant checks are green or the remaining blocker is explicit.