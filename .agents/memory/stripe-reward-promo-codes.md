---
name: Stripe promo codes for one-off rewards
description: v22 API shape for promotion codes and the safe issuance pattern for reward vouchers tied to a DB row.
---

- In stripe-node v22, `promotionCodes.create` requires `promotion: { type: "coupon", coupon: <id> }`; the older top-level `coupon` param fails.
- **Why:** the top-level shape silently looks right but Stripe rejects it; cost multiple attempts to discover.

Safe issuance pattern when a reward code is tied to a DB row (e.g. one code per approved contribution):
- Derive the code deterministically from the row id (hash) so retries reuse the same code.
- Atomically claim issuance first with a conditional `UPDATE ... WHERE code IS NULL RETURNING`, so concurrent requests can't double-issue.
- Pass Stripe `idempotencyKey`s keyed by the row id; deterministic codes keep the keys valid across retries.
- On Stripe failure, release the claim (reset the column) and fail the request so the approval can be retried.
- **How to apply:** any future "earn a discount code" flow (referrals, testimonials, etc.) should copy this claim → Stripe (idempotent) → mirror pattern.
