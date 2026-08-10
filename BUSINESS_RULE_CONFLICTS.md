# BUSINESS_RULE_CONFLICTS.md

Audit date: 2026-08-10. Scope: pricing/entitlement rules displayed vs implemented across landing page, backend, Stripe, and admin tooling.

## 1. Rules displayed on the live website (landing page)

Source: `artifacts/landing-page/src/components/pricing.tsx`

| Plan | Price | Terms |
|---|---|---|
| Free Trial | $0 for 7 days, then $25/mo | Card required, auto-bills unless cancelled, exactly 1 portal |
| Single App | $25/mo | 1 portal, unlimited use, 1 user |
| Complete Bundle | $79/mo | All 7 portals, 1 user (line-through $175, "save $96 / 48%") |

Portal picker (7 choices): MyLitAI, MySyalitAI, MyCorpAI, MyConveyAI, MyCrimAI, MyCCBLitAI, MyAccidentAI.

## 2. Rules implemented in the backend

Source: `artifacts/api-server/src/routes/stripe.ts`

- Tiers accepted: `bundle | single | standard`. Prices come from the synced `stripe.products` / `stripe.prices` DB tables (product metadata `tier`, newest active price) — **no hardcoded amounts** (good: single source of truth is Stripe).
- Checkout forces USD, adaptive pricing disabled (intentional per owner preference).
- 7-day Stripe trial applied only when `trial=true` **and** tier=`single`.
- Native Stripe promotion codes enabled (`allow_promotion_codes: true`).

## 3. Contradictions found

| # | Severity | Conflict | Detail |
|---|---|---|---|
| C1 | P2 | **Admin pricing table is dead configuration** | `routes/admin/pricing.ts` + admin UI store RM-denominated, per-app, annual-duration prices (`standardPrice`, `durationYears`). Stripe checkout ignores this table entirely. Editing it has no effect on what customers pay. Risk: owner edits admin pricing believing it changes checkout. |
| C2 | P2 | **Voucher redemption gap** | Contribution approval issues "1 month free" voucher codes (`routes/admin/contributions.ts`) stored in the local `vouchers` table, but there is no customer-facing redemption flow, and these local codes are not provably registered as Stripe promotion codes. A contributor may receive a code they cannot use at checkout. |
| C3 | P3 | **Bundle "7 portals" vs 8 apps in backend** | `provisioning.ts` `ALL_APP_NAMES` contains 8 apps including MyLawFirmAi; landing bundle claims 7. MyLawFirmAI is intentionally not in the portal picker (sold separately), but bundle provisioning mapping should be confirmed to grant exactly the 7 advertised portals. |
| C4 | P3 | **`standard` tier accepted but never displayed** | Backend accepts tier `standard` with no landing-page card. Harmless if no Stripe product carries that metadata, but it is an unadvertised purchase path. |
| C5 | P3 | **Savings figures are static copy** | "$175 / save $96 / 48%" are hardcoded strings, not derived from actual Stripe prices. If Stripe prices change, the landing copy silently lies. |
| C6 | P3 | **Currency selector vs USD checkout** | Landing shows converted prices in selectable currency; checkout always charges USD (intentional, see memory: adaptive pricing disabled by owner request). Displayed converted price may not match the charged amount. Consider a "billed in USD" note at checkout. |

## 4. Legacy models NOT present (verified absent)

- **Model A (RM29/mo, RM1/RM3 per-prompt)**: no implementation or references anywhere in the repo. Pay-as-you-go/usage billing does not exist.
- **ToyyibPay**: zero references in the codebase. Not implemented, not partially implemented. If ToyyibPay is an intended channel, it is a business-rule gap requiring a decision, not a defect.

## 5. Recommended single source of truth

Model B (currently displayed) is the implemented reality. Recommended actions:
1. Keep Stripe products/prices as the sole source of pricing truth (already the case for checkout).
2. Either delete or clearly relabel the admin RM pricing table (C1) as informational.
3. Decide voucher mechanics: either create real Stripe coupons/promotion codes on contribution approval, or build a local redemption flow (C2).
4. Derive landing "savings" copy from the live `/api/stripe/products` endpoint (C5).
