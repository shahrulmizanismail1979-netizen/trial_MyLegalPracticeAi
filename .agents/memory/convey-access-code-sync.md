---
name: MyConveyLitAI access-code sync & auth secrets
description: Why landing purchases and the hosted convey app share one access code, and the fail-closed rule for its auth secrets.
---

## One access code across both systems
A conveyancing purchase on the landing page also unlocks the hosted MyConveyLitAI app by upserting a convey user keyed by the same access code the subscriber receives by email.
**Why:** one code per customer — no second credential to manage or email.
**How to apply:** keep the sync idempotent and best-effort (provisioning must never fail because of it), and never copy Stripe billing IDs onto synced users — landing billing stays owned by the subscribers table so the convey app's own Stripe reconciliation ignores them.

## Rebrand is display-only
The stored app name for the conveyancing product stays "MyConveyAI" so admin stats and filters remain one bucket; only user-facing strings say MyConveyLitAI.

## Auth secrets fail closed in production
The uploaded legacy app shipped hardcoded credential fallbacks (admin password, master access code, JWT secret). These now fail closed in production: missing secrets disable the affected endpoints or refuse startup; insecure defaults exist only in development.
**Why:** architect review flagged the defaults as publicly compromiseable.
**How to apply:** never reintroduce credential fallbacks that are active in production. Required secrets (ADMIN_PASSWORD, MASTER_ACCESS_CODE, SESSION_SECRET) are set in Replit Secrets.
