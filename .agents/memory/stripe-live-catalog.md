---
name: Stripe live-mode catalog self-seeding
description: Live Stripe account started with zero MLPA products; how checkout resolves prices and why catalog tiers never trust the DB cache.
---

The business originally ran entirely in Stripe test mode. When switching to the live key, the live account had **no MLPA products/prices at all** (only unrelated products from the user's other projects: AssessHub, LEXPROMPT — in MYR). Every checkout returned "Pricing is not configured yet".

**Rule:** For tiers defined in BUNDLE_TIER_CATALOG or CORE_TIER_CATALOG (single $25, bundle $79 USD/mo), `/api/stripe/checkout` must resolve prices via `ensureBundleTierPrice` (live Stripe search + exact-amount match + idempotent auto-create) and never via the local `stripe.*` DB cache.
**Why:** The DB cache can hold stale test-mode price IDs or mistagged products with the wrong amount — customers could be charged incorrectly or checkout 503s.
**How to apply:** New sellable tiers need a catalog entry with the canonical USD amount; the DB cache path is only for legacy/uncataloged tiers.

**Redirect allowlists:** every appUrl the landing page can send must exist in THREE places or purchases break: `ALLOWED_APP_REDIRECTS` (stripe.ts), `APP_NAME_BY_URL` (provisioning.ts — otherwise the customer PAYS but gets no portal entitlement), and `ALLOWED_REDIRECTS` (landing checkout-success.tsx). Keep them in sync; relative portal paths (e.g. /mysyariahai/) map to canonical app buckets (MySyalitAI etc.).
