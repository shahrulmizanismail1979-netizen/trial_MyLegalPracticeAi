---
name: Microsoft Entra SSO across portals
description: How the shared Microsoft sign-in works and gotchas when touching portal auth
---

Shared OAuth lives on api-server at `/auth` (registered as an extra service path in its artifact.toml). Flow: `/auth/microsoft/login?app=<slug>` → Microsoft → `/auth/callback` → short-lived `ms_ticket` JWT (signed with SESSION_SECRET) → redirect to the portal login page → portal POSTs the ticket to its own `/sso` endpoint, which reuses the app's existing access-code login logic. Links live in `microsoft_links` (email, app, access_code, unique(email, app)).

**Why:** every portal has a different session mechanism (express-session, JWT, cookies, bearer tokens), so credentials must be issued by each app's own endpoint — the shared callback only proves the Microsoft identity.

**How to apply:**
- New portals: add slug → login-path in `APP_LOGIN_PATHS` (src/microsoft/index.ts) and an `/sso` route reusing the login helper.
- Gotcha: default-deny middleware (e.g. conveyGate PUBLIC_PATHS) must allowlist the new sso path or it 401s.
- Gotcha: lit's auth router is mounted at `/auth`, so its endpoints are `/api/lit/auth/*`; the lit sso route accepts both `lit` and `lit-irac` tickets.
- Redirect URI is computed from the request host; each domain used for login must be a registered redirect URI in the Azure app.
