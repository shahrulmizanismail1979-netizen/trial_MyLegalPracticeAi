---
name: Signed cookie / cookie-parser interaction
description: When cookieParser is initialised with SESSION_SECRET, verified signed cookies are moved to req.signedCookies and deleted from req.cookies — any auth middleware that reads req.cookies will miss them.
---

# Signed cookie / cookie-parser interaction

## The rule
Any middleware or route handler that reads portal session cookies (`lit.sid`, `crim.sid`, `sya.sid`, `acad.sid`) must check `req.signedCookies[name]` **first** (already-decoded session ID), then fall back to manual HMAC verification of `req.cookies[name]` only if `req.signedCookies` doesn't have it.

## Why
`app.ts` mounts `cookieParser(process.env.SESSION_SECRET ?? "dev-cookie-secret")`. When cookie-parser receives a signed cookie (value starts with `s:`) and successfully verifies it:
- The **decoded** session ID goes into `req.signedCookies["lit.sid"]`
- The entry is **deleted** from `req.cookies["lit.sid"]`

Code that only reads `req.cookies["lit.sid"]` will find `undefined` for any valid signed cookie when SESSION_SECRET is set. This causes 401 for legitimately authenticated sessions.

## How to apply
- `requireAnyPortalAuth` middleware (`middlewares/requireAnyPortalAuth.ts`): fixed via `getSessionCookieSid()` helper that checks `req.signedCookies` first.
- `trySessionCookieAuth` in `routes/shared-uploads.ts`: fixed with the same signedCookies-first pattern.
- Any future portal auth code that reads session cookies must follow the same pattern.

The plain `session_id` cookie used by MyAccidentAI is **not** a signed cookie (no `s:` prefix), so it always stays in `req.cookies` — no change needed there.
