---
name: Stripe checkout provisioning lessons
description: Pitfalls found building auto access-code provisioning after Stripe checkout (success_url placeholder, connector 429s, race conditions)
---

- **`{CHECKOUT_SESSION_ID}` must stay literal in `success_url`.** Building the URL with `URLSearchParams` percent-encodes the braces and Stripe never substitutes the real session id — the success page receives the literal placeholder. Concatenate the placeholder raw; only `encodeURIComponent` the other params.
  **How to apply:** any time a Stripe success/cancel URL is constructed.

- **Replit connector credential fetches (Stripe, Gmail) can transiently 429** right after checkout when several credential lookups fire in a short window. Wrap webhook-driven provisioning and email sends in retry-with-backoff (e.g. 0s/3-5s/10-15s); treat non-429 4xx as permanent.
  **Why:** a live e2e run saw both webhook provisioning and the customer email fail with 429 on first attempt.

- **Provisioning idempotency needs a DB unique constraint, not read-then-insert.** Both the Stripe webhook and the success-page `session-info` poll provision concurrently; use a UNIQUE column (stripe_subscription_id) + `onConflictDoNothing().returning()` and re-select on conflict. A concurrency test (3 parallel calls → exactly 1 row) guards this.
