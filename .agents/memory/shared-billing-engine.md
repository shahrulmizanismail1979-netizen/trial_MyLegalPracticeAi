---
name: Shared billing engine
description: Cross-portal time/fees/invoicing pattern (case_* billing tables, route rules, invoice locking)
---

All-portal billing lives in the shared case-intelligence layer (mounted once, every portal's matter router gets it).

- Tables are keyed by (portal, owner_key); every query must include both. Matter-level routes go through verifyMatterOwnership first.
- **Route-collision rule:** owner-level routes on a portal matter router must use ≥2 path segments (e.g. `/billing/invoices`, `/billing/settings`) or they collide with each portal's `GET /:id` matter route.
- Invoice numbers allocate transactionally by locking the (portal, owner_key) row in `case_billing_settings` (`next_invoice_no`).
- **Every invoice lifecycle transition (issue/void/delete/payment) must run in a transaction with `SELECT ... FOR UPDATE` on the invoice and re-check status on the locked row** — the initial ownership fetch is stale. Void is prohibited once any payment exists; overpayment rejected; billed time entries can't be deleted (`invoice_id IS NULL` predicate in the shared time-entry DELETE, 409 otherwise).
- Frontend is a shared package (`@workspace/billing-ui`, paralegal-widget pattern): portals pass a `request(path, init) => raw Response` wrapper bound to their matters API base with their own auth (cookie vs Bearer). Currency RM.
- CCB master-code sessions get 403 on all matter files (portal-wide pre-existing rule) — billing follows it; only real subscriber codes can bill there.
- pg returns DATE columns as JS Date objects — aging-bucket math must use `new Date(v).getTime()`, not string diffing.
