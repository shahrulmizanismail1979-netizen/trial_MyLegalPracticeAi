# Launch Project Sarawak 20

## What & Why
Create a completely separate, public Project Sarawak 20 campaign app at /sarawak20/ without changing or interrupting the current LAWYes website. The app will translate the supplied campaign artwork into a polished responsive landing page and provide a real first-come, first-served Stripe subscription channel for two founding cohorts: the first 20 paid law firms/lawyers and the first 20 paid chambering students.

The approved founding offer is RM49 per month for every participant, cancellable anytime. The founding price is protected for 12 months while the subscription remains active. Each cohort has its own 20-place cap; a place is secured by completed payment, not by an unverified form submission.

## Done looks like
- A new standalone Project Sarawak 20 web artifact opens at /sarawak20/ and the existing LAWYes landing page is unchanged
- The visual direction follows the supplied navy, Sarawak green, white, and orange campaign artwork, with strong mobile and desktop presentation
- The page clearly explains the co-development programme, Sarawak-practice focus, founding-partner benefits, eligibility, RM49 monthly price, cancellation terms, and 12-month founding-rate protection
- Visitors choose either Law Firm / Lawyer or Chambering Student and can see trustworthy remaining-place information for that cohort
- Each cohort accepts no more than 20 active paid participants, including under concurrent checkout attempts
- Repeated clicks, abandoned or expired checkouts, duplicate webhooks, failed payments, and cancellations cannot leak or over-allocate places
- Successful Stripe checkout provisions access through the existing LAWYes access-code flow, shows a clear confirmation, and provides subscription-management access
- Once a cohort is full, checkout is disabled with a clear sold-out or waitlist-style message; cancellations safely make a place available again
- The programme uses its own MYR 49.00 monthly Stripe catalog entry and does not alter existing USD prices or checkout behavior
- Public campaign routes are crawlable with appropriate title, description, Open Graph artwork, structured data, robots, sitemap, and prerendered content
- Focused API, payment, concurrency, cancellation, responsive, accessibility, and end-to-end browser checks pass

## Out of scope
- Replacing, restyling, or rerouting the existing LAWYes landing page
- Building the future Sarawak Practice Mode product features themselves; the page presents these as co-development programme outcomes rather than already-complete functionality
- Multi-seat firm administration beyond one founding subscription/place per checkout
- Increasing either founding cohort beyond 20 without a later product decision
- Alternative payment providers or manual bank-transfer enrollment

## Steps
1. **Create the standalone campaign artifact** — Bootstrap and register a React-Vite app for /sarawak20/, copy the supplied programme artwork into its own public assets, and establish independent routing, metadata, and prerendering.
2. **Design the campaign experience** — Build a responsive, conversion-focused page with campaign hero, programme story, founding benefits, eligibility tracks, transparent terms, live cohort status, FAQs, and strong but non-coercive checkout actions.
3. **Add programme catalog and availability contracts** — Extend the shared API contract with dedicated read and checkout operations for the two Sarawak cohorts while preserving every existing checkout caller and USD catalog response.
4. **Enforce first-paid cohort limits** — Add a concurrency-safe reservation and enrollment ledger so active paid subscriptions plus unexpired checkout reservations can never exceed 20 per cohort.
5. **Integrate Stripe checkout and lifecycle events** — Provision an isolated MYR 49 monthly programme product, create idempotent checkout sessions, consume or release reservations from Stripe events, and reuse existing access-code activation and deactivation flows.
6. **Complete success and cancellation journeys** — Show verified checkout confirmation, access instructions, cohort status, and customer-portal management while ensuring cancellation frees exactly one place and revokes access exactly once.
7. **Protect existing products with regression coverage** — Test parallel 20/21 checkout behavior, expiry, duplicate delivery, failure cleanup, cancellation reuse, mobile/desktop accessibility, existing USD checkout invariants, and a real browser journey through both cohort choices.
8. **Verify and present the new app** — Restart affected workflows, inspect logs, capture responsive screenshots, verify the original landing page is unchanged, and present the new artifact for review.

## Critical architectural constraints
- The two 20-place limits must be enforced server-side under database locking; client-side counters are informational only.
- Stripe remains the source of truth for products and prices, while programme reservations and cohort membership live in application tables.
- The programme MYR catalog is separate from the current USD-only LAWYes catalog and must not enable adaptive currency conversion on existing products.
- A checkout reservation expires and releases automatically; only a completed paid subscription becomes an active founding place.
- Marketing copy must distinguish available programme benefits from future Sarawak Practice Mode features being shaped with founding participants.

## Relevant files
- `attached_assets/bf7a5c9e-36f7-47c9-8d6e-f16eba951516_1787900306121.png`
- `artifacts/landing-page/package.json`
- `artifacts/landing-page/vite.config.ts`
- `artifacts/landing-page/src/main.tsx`
- `artifacts/landing-page/src/entry-server.tsx`
- `artifacts/landing-page/prerender.mjs`
- `artifacts/api-server/src/routes/stripe.ts`
- `artifacts/api-server/src/lib/provisioning.ts`
- `artifacts/api-server/src/app.ts`
- `lib/db/src/schema/kohorts.ts`
- `lib/db/src/schema/subscribers.ts`
- `lib/api-spec/openapi.yaml`
- `pnpm-workspace.yaml`
