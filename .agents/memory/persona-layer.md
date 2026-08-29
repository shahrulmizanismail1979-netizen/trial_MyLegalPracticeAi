---
name: Shared professional-persona layer
description: Platform-wide persona (practitioner/inhouse/academic) keyed to access codes; front door on landing page
---

The platform has one shared persona layer (`user_personas` table, `/api/personas` lookup/save) implementing the "intelligent front door" directive: practitioner / inhouse / academic experiences over one engine.

Rules:
- Persona identity key = normalized (uppercased) access code — codes are platform-global because one provisioning pipeline syncs the same code to every portal registry. MASTER_ACCESS_CODE is explicitly rejected as an identity.
- `accessCodeExists` must check ACTIVE + unexpired per registry (column names differ: `is_active` vs lit `status='active'` vs ccb `active`). Endpoints take raw codes, so they share `loginRateLimit` like portal logins.
- Landing page front door: persona stored in localStorage `legal_persona`; SSR prerender renders Home, so PersonaProvider must be in BOTH App.tsx and entry-server.tsx, and localStorage access must be window-guarded. Checkout returns (`?session_id=`) must bypass the front door gate or new subscribers never see their access code.

- All portals share one origin (path routing), so any persona cached in localStorage is a cross-portal AND cross-subscriber surface on shared browsers: every portal logout/session-expiry path must clear it, and a login for a different code must invalidate it.
- Persona writes are session-bound server-side: updating an existing persona requires a portal session resolving to the same access code (per-portal resolvers; bearer portals must send their token); unauthenticated body-code writes are create-only, to keep the landing front-door onboarding working.

**Why:** code review found code-enumeration/overwrite and a checkout-hidden regression on the first cut; these guards fix them.
**How to apply:** any new consumer of persona (portal logins adopting persona, settings "switch professional mode") should reuse `/api/personas` and these rules — don't invent per-portal persona storage.
