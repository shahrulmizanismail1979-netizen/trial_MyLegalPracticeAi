---
name: Portal matter files pattern
description: Durable lessons for replicating per-user stores (matter files) across portals — ownership scoping, table creation, routing.
---

- **Ownership scoping:** if a portal's session identifies users by (accountType, userId) where ids come from different serial spaces (access-code logins vs email logins, master-code sentinels), any per-user table must be scoped by BOTH owner_type and owner_id — id alone collides across account types. Portals with a single owner space can use one owner column.
  **Why:** id-only scoping silently exposes one account type's rows to another with the same numeric id.
  **How to apply:** check the target portal's session shape before copying a sibling portal's schema.
- **Table creation:** new tables go in via direct SQL `CREATE TABLE IF NOT EXISTS` at boot — never drizzle push (rename trap). The boot ensure must be AWAITED before the server listens and fail startup on error; fire-and-forget lets early requests race table creation ("relation does not exist").
- **Routing trap:** routers mounted on a shared top-level router with no path prefix must scope auth middleware to their own paths, never a bare `router.use(authGuard)` — that blocks every other portal's routes.
- **Master/static codes:** codes resolving to no per-subscriber identity cannot own rows; deny such features explicitly (403 with a clear message) rather than letting inserts fail.
- **Deadline calculators** are per-domain trigger templates with jurisdiction caveats (state enactments differ); portals without a domain template use manual/bulk deadlines only.
