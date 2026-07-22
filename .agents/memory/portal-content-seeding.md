---
name: Portal content boot-seeding
description: How portal reference-content tables get populated and how to recover missing donor data
---

Rule: every ported portal's reference-content tables should self-populate on api-server boot via a `seedXxxContent()` that seeds each table ONLY when it is empty (best-effort, wired in api-server boot alongside the others).

**Why:** donor-app ports repeatedly arrived with empty content tables in both dev and prod (the port copies schema/code but not data), producing empty dashboards until manually noticed.

**How to apply:**
- If a donor app's data is missing, look for its original seed script in the attached archive; extract the dataset by running the seed with a stubbed `db` (insert().values() collects rows) after stripping imports/exports, then dump to a JSON file next to the portal's seed module.
- Seed via typed drizzle inserts in chunks (~25 rows) — avoids jsonb column-name/camelCase mismatch issues from the raw-SQL jsonb_populate_recordset pattern when the JSON uses drizzle field names.
- Production is read-only from dev; it fills itself on the next publish, so remind the user to republish.
- Some "library" sections are static in-code compendia (e.g. lit Quantum of Damages, 21 categories) — not DB-backed, no seeding needed.
