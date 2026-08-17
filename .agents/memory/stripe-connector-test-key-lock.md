---
name: Stripe connector locked to test keys
description: The Replit Stripe connector persistently stores sk_test_ credentials; ProposeIntegration reconnects do not replace them with live keys.
---

## The rule
The Replit Stripe connector (`connection:conn_stripe_01KWPR0TQ6BY8FYPP961E6CVPP`) returns `sk_test_51Tp...` on every `getStripeCredentials()` call, regardless of how many times `ProposeIntegration` is used to reconnect it. At least two reconnect attempts were made and both preserved the test key.

**Why:** The Stripe OAuth flow during `ProposeIntegration` for an existing connection reuses stored credentials rather than re-running the full OAuth. If the original authorization was done in Stripe test mode, the connector stays on test keys permanently until a fresh OAuth grants live-mode access.

## How to apply
- Do NOT rely on ProposeIntegration to switch the connector from test → live mode.
- The only reliable fix is `STRIPE_SECRET_KEY` env var set to a valid `sk_live_51...` key (107 chars).
- The `stripeClient.ts` validation already accepts `sk_live_` or `sk_test_` prefixes; anything else falls back to the connector.
- The user's `STRIPE_SECRET_KEY` currently contains `mk_1U2s0...` (27 chars) — a Payhip API key, not a Stripe key. This is silently rejected and falls back to the connector (test mode).

## User context
- The Stripe account IS active with live keys visible at dashboard.stripe.com/apikeys (Standard keys → Secret key shows `sk_live_...fq0T`).
- The account is Payhip-managed ("Yfassociates / Payhip" in the Stripe dashboard header).
- The user kept entering their Payhip API key (`mk_` format) instead of the Stripe secret key because they were navigating Payhip's settings, not Stripe's.
- To get the correct key: Standard keys section → "Secret key" row → three-dot menu → "Reveal live key" → copy the full ~107-char value.

## Production side effect
- Production deployed code sends a test-mode alert email to `shahrulmizanismail1979@gmail.com` on boot.
- The `alert_delivery_attempts` table was missing in production at last check (needs migration via direct SQL or redeploy).
