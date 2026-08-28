---
name: stripe-replit-sync bundling & credentials
description: Two non-obvious gotchas when using stripe-replit-sync in the esbuild-bundled api-server.
---

# stripe-replit-sync integration gotchas

Two issues bit us setting up Stripe recurring subscriptions in the api-server (esbuild-bundled ESM single file).

## 1. Must externalize `stripe-replit-sync` in esbuild

`runMigrations()` locates its own SQL migration files via the package's `__dirname`
(`path.resolve(__dirname, "./migrations")`). When esbuild bundles the package into our
`dist/index.mjs`, and our `build.mjs` banner sets `globalThis.__dirname` to the bundle dir,
that lookup resolves to the wrong folder. The migration then **silently skips** (logs
"Stripe schema ready" but creates only the empty `stripe` schema, no tables). First real
Stripe API call then fails with `relation "stripe.accounts" does not exist`.

**Fix:** add `"stripe-replit-sync"` to the esbuild `external` array so Node loads it from
node_modules with its own correct `__dirname`.

**How to apply:** any bundled server package that reads sibling files via `__dirname` must be
externalized, not bundled — especially when a banner overrides `globalThis.__dirname`.

## 2. Replit connector settings field is `secret`, not `secret_key`

The Replit connector v2 endpoint (and `listConnections('stripe')`) returns settings with keys
`secret` / `publishable` / `webhook_secret` — NOT `secret_key`. The stripe skill's template
code reads `settings.secret_key`, which is always undefined, throwing "Stripe integration not
connected or missing secret key" even when healthy.

**Fix:** read `settings.secret ?? settings.secret_key` for the API key; webhook secret is
`settings.webhook_secret`.

## 3. `runMigrations` config has no `schema` option

`MigrationConfig` is only `{ databaseUrl, ssl?, logger? }`. The skill template passes
`schema: 'stripe'` but that is not a valid prop — drop it. The schema name is fixed to `stripe`
inside the package.

## 4. `syncBackfill()` with no args silently syncs nothing

The no-arg default sets `object` to a function reference (library bug), which matches no
switch case — it resolves "successfully" and logs "synced" but writes zero rows. Price/product
changes made in Stripe then never reach the local `stripe` schema.

**Fix:** always call `syncBackfill({ object: "all" })`.

**How to apply:** if Stripe dashboard/API changes aren't visible in `stripe.*` tables after a
server restart despite a "synced" log line, check the backfill call has an explicit object.

## Security: Stripe return URLs

Checkout `success_url`/`cancel_url` must be built from the server's own domain
(`REPLIT_DOMAINS`), never from the request `Origin` header — a public checkout endpoint that
trusts `Origin` is an open-redirect/phishing vector.

## 5. Managed webhook secret must remain canonical

When production uses `findOrCreateManagedWebhook()`, leave `stripeWebhookSecret` empty on new
`StripeSync` instances. The library then loads the current secret from
`stripe._managed_webhooks`.

**Why:** Recreating a managed endpoint rotates its signing secret. A static environment value
then becomes stale and causes every valid Stripe event to fail signature verification.

**How to apply:** Finish managed-webhook setup before accepting requests, and let
`processWebhook()` resolve the stored managed secret rather than forcing an environment copy.
