---
name: Shared case-ownership owner columns
description: Adding a portal to the shared matter intelligence requires wiring its owner column into verifyMatterOwnership
---
Rule: `verifyMatterOwnership` (api-server lib/caseOwnership.ts) builds `${portal}_matters` queries with a per-portal owner column (convey→user_id, sya→owner_type+owner_id, acc→owner_id, default access_code_id). A new portal whose matter table uses a different owner column MUST get an explicit branch.

**Why:** When MyAccidentAI's acc_matters (owner_id) was added, the default access_code_id query threw, failed closed, and all checklist/time-entry POSTs returned 404 despite valid ownership — while tests of the core matter routes still passed, hiding the break.

**How to apply:** When porting matter files to a new portal, add the owner-column branch AND authenticated integration tests for the attached case-intelligence routes (checklist POST, time-entry POST, cross-tenant 404), not just the core matter CRUD.
