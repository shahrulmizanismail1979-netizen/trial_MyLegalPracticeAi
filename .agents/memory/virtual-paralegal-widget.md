---
name: Virtual paralegal dashboard widget
description: Cross-portal floating AI paralegal (chat + voice) — identity and mounting policy
---

The assistant's user-chosen identity is **Amani** — a realistic photo avatar with animated speaking rings; never rename or drop the avatar without the user's say-so.

Every portal dashboard hosts the same shared paralegal engine, mounted behind each portal's real auth with a per-portal persona.

**Why:** the shared AI rate limiter must never see unauthenticated requests, and voice/TTS is paid — it needs its own per-owner throttle.

**How to apply:** when adding a portal, mount behind auth with a fail-closed owner key; master-override sessions often have no code row, so the owner-key resolver needs an explicit master fallback or master users get 401 only in the paralegal.
