---
name: Stripe invoice.upcoming null-id webhook crash
description: Stripe's invoice.upcoming webhook has id=null (preview object), causing a NOT NULL constraint crash in stripe-replit-sync that returns HTTP 400 and risks disabling the webhook endpoint.
---

# Stripe invoice.upcoming null-id webhook crash

## The rule
The `invoice.upcoming` Stripe webhook event delivers a preview invoice object with `id = null`. The `stripe-replit-sync` library's `handleInvoiceEvent` tries to upsert this into `stripe.invoices` (which has `id NOT NULL`), throwing a PostgreSQL error code `23502`. This causes the webhook handler to return HTTP 400 to Stripe, which retries the event indefinitely.

**Why:** Stripe sends `invoice.upcoming` before every subscription billing cycle as a notification (not a real invoice). The library can't store it.

## How to apply
In `artifacts/api-server/src/app.ts` webhook route:
- Wrap `WebhookHandlers.processWebhook` in a try/catch
- Catch specifically pg error code `23502` (not_null_violation) and log a warning instead of rethrowing
- Always run `handleStripeEventForProvisioning` regardless of sync errors
- Return HTTP 200 for the null-id case so Stripe stops retrying

The `handleStripeEventForProvisioning` is separate from `processWebhook` — they must not share the same try/catch or a sync error will block provisioning.

## Symptom pattern
- Production logs show: `null value in column "id" of relation "invoices" violates not-null constraint`
- Followed by: `Stripe webhook processing error`
- Followed by repeated webhook retries from Stripe
- New subscribers who pay may not receive access codes (webhook endpoint gets flagged as failing)
