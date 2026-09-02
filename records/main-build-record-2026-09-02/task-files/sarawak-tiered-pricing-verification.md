# Sarawak Tiered Firm Pricing

## What & Why
Update Project Sarawak 20 so the first 20 law-firm/lawyer subscriptions cost RM69 per month, then offer verified Advocates Association of Sarawak firms an uncapped RM99 per month package with one shared access code and three active seats. Add credible eligibility details for both advocates and chambering students so programme places are reserved for the intended Sarawak legal community without making payment unreliable.

## Done looks like
- The first 20 firm/lawyer places display and charge RM69 per month; the chambering cohort remains RM49 per month.
- Once all 20 founding firm places are paid or validly reserved, the page automatically offers the RM99 per month AAS firm package instead of showing the firm option as simply sold out.
- The RM99 package is available only after AAS eligibility is confirmed and allows one firm access code with up to three active seats across the included LAWYes portals.
- Firm verification uses the official AAS-directory identity fields: advocate full name, registered firm name, and practice location, with practising-certificate or AAS reference accepted as supporting information rather than an invented mandatory membership-number format.
- Chambering verification collects legal name, pupil master, registered firm, pupillage commencement date, AAS branch, and Notice of Pupillage acknowledgement; a CMS petition/case number is optional when one has already been issued.
- Applicants receive clear correction or review messaging when details cannot be confirmed, and no ineligible AAS checkout is created or charged.
- Stripe checkout, webhook replay, cancellation, expired reservations, cohort transition, and three-seat access remain idempotent and protected by automated payment and browser regression tests.

## Out of scope
- Repricing or migrating existing RM49 Project Sarawak 20 subscriptions.
- Changing the 20-place chambering cap or its RM49 monthly price.
- Inventing an AAS membership-number standard that the Association does not publicly expose.
- Building a general membership-verification product outside this Sarawak campaign.

## Steps
1. **Model versioned programme plans** -- Preserve legacy subscriptions while adding explicit RM69 founding-firm, RM49 chambering, and RM99 post-cap AAS firm plans with independent pricing, capacity, and seat entitlements.
2. **Add eligibility records and contracts** -- Persist normalized advocate, firm, location, and pupillage evidence separately from Stripe data, with validation, duplicate protection, privacy controls, and a review state for details that cannot be conclusively matched.
3. **Implement safe cohort transition** -- Keep advisory-lock capacity protection for the founding 20 and expose the AAS three-seat package only after those places are fully allocated, without counting the uncapped package against the founding cohort.
4. **Harden Stripe lifecycle** -- Resolve dedicated MYR recurring prices by immutable plan metadata and amount, bind verified eligibility to idempotent checkout requests, and make webhook provisioning, cancellation, expiry, and delayed completion safe for all old and new plans.
5. **Provision three-seat access** -- Issue one shared AAS firm access code with a three-active-seat limit across the included portals while keeping founding-firm and chambering entitlements unchanged.
6. **Update the campaign experience** -- Present the new prices, live transition, eligibility fields, verification feedback, three-license terms, founding-rate wording, success state, and subscription-management paths clearly on desktop and mobile.
7. **Verify end to end** -- Add focused concurrency, price-selection, eligibility, transition, provisioning, webhook, and seat-limit tests, regenerate API clients, run existing payment-access regressions, and browser-test checkout payloads without creating a real charge.

**Critical constraints:** Existing LAWYes Stripe catalog and subscribers must remain unchanged; old Sarawak RM49 sessions must stay recognizable; sensitive professional identifiers must never be logged or copied into Stripe metadata; no access is provisioned until a paid session is bound to the correct verified plan.

## Relevant files
- `artifacts/api-server/src/lib/sarawak20.ts`
- `artifacts/api-server/src/lib/provisioning.ts`
- `artifacts/api-server/src/routes/stripe.ts`
- `artifacts/api-server/src/stripeClient.ts`
- `artifacts/sarawak20/src/pages/landing.tsx`
- `artifacts/sarawak20/src/pages/success.tsx`
- `artifacts/sarawak20/src/pages/manage.tsx`
- `lib/api-spec/openapi.yaml`
- `lib/db/src/schema/sarawak20.ts`
- `lib/db/sql/migrations/0031-sarawak20-reservations.sql`
- `artifacts/api-server/src/lib/sarawak20.test.ts`
- `artifacts/api-server/src/routes/payment-access-regression.test.ts`
