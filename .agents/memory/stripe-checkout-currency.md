---
name: Stripe checkout currency
description: Why checkout must keep Adaptive Pricing disabled (USD only)
---
Checkout sessions must set `adaptive_pricing: { enabled: false }`.

**Why:** Stripe Adaptive Pricing auto-converted the $25 USD price to MYR (~RM105) for Malaysian visitors; the user explicitly wants prices shown in USD only (July 2026 complaint).

**How to apply:** Any new `stripe.checkout.sessions.create` call in this project must include the flag, and marketing copy should not mention MYR conversion.
