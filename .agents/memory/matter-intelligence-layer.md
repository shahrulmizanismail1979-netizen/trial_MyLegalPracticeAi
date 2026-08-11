---
name: Shared matter-intelligence layer
description: How cross-portal matter capabilities (chronology, AI review, client linking) are mounted and tenant-scoped
---

New capabilities that should appear on ALL matter portals belong in `src/lib/` as a router builder mounted inside `attachCaseIntelligence` — that single mount point covers lit/crim/sya/acc directly and corp/ccb via matterFiles' call, so one change lands on six portals.

**Rules learned:**
- Every supporting-table query (saved work, deadlines) must be owner-scoped IN ADDITION to the up-front `verifyMatterOwnership` gate. Matter-id-only queries were flagged as a cross-tenant disclosure risk (rows can carry foreign matter ids). Owner columns mirror the matter tables: lit/crim/corp/ccb → access_code_id, acc → owner_id, convey → user_id, sya → owner_type + owner_id (owner key "type:id").
- **Why:** ownership gate proves the matter is yours, not that every row pointing at that matter is.
- Client directory is the shared `case_clients` table (makeClientsRouter) for every portal EXCEPT lit (own lit_clients with clientId on lit_matters). Matter linking lives in `case_client_matters` (FK → case_clients, cascade on client delete; stale links after matter delete are tolerated — matter-scoped reads 404).
- Before building a "new" shared capability, grep caseClients.ts/lib for an existing implementation — a parallel table (portal_clients) was nearly shipped alongside case_clients, which would have given users two conflicting client lists.
- Review router paths must be prefix-relative (`/:id/review`), since attachCaseIntelligence pathPrefix is "" on some portals and "/matters" on others.
