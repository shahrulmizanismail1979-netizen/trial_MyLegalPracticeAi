---
name: MyConveyLitAI access-code sync & auth secrets
description: How landing purchases unlock the hosted convey app, and the fail-closed auth secret rules for its admin/master login.
---

## One access code across both systems
A landing-page purchase whose apps include MyConveyAI/MyConveyLitAI upserts a convey `users` row keyed by the unique `access_code`, so the emailed landing code also logs in to the hosted app (firm tier, active).
**Why:** one code per customer, no second credential; upsert is idempotent and best-effort so provisioning can never fail because of the sync.
**How to apply:** never set `stripeCustomerId`/`stripeSubscriptionId` on synced users — landing billing is owned by the `subscribers` table, and leaving these null keeps the convey app's own Stripe reconciliation from touching them. `users.access_code` must stay nullable (legacy rows).

## Canonical app name stays "MyConveyAI"
`APP_NAME_BY_URL` maps `"/myconveylitai/"` → `"MyConveyAI"` so admin stats/filters stay on one bucket despite the rebrand; only display strings say MyConveyLitAI.

## Auth secrets fail closed in production
`ADMIN_PASSWORD` and `MASTER_ACCESS_CODE` have insecure dev-only fallbacks (`admin2024`, `240680`). In production (NODE_ENV=production) missing secrets disable convey admin endpoints (503) and skip master-account seeding; the default admin seed is dev-only too.
**Why:** the uploaded legacy app shipped hardcoded credentials; architect review flagged them as publicly compromiseable.
**How to apply:** never reintroduce credential fallbacks that are active in production; both secrets are now set in Replit Secrets.
