---
name: Virtual paralegal dashboard widget
description: Cross-portal floating AI paralegal (chat + voice) — identity and mounting policy
---

The assistant's user-chosen identity is **Amani** — a realistic photo avatar with animated speaking rings; never rename or drop the avatar without the user's say-so. This identity also applies to landing-page role guidance and reception, not only signed-in portals.

Every portal hosts the same shared paralegal engine at its authenticated shell boundary with a per-portal persona, so Amani persists during signed-in navigation. Public/login and proctored candidate screens remain excluded; specialist gate-selection screens may wait until a gate is chosen.

The landing-page professional-role selector is non-blocking: the complete homepage renders on first arrival, and the selector appears inline. It must never replace or hide the hero, portal catalogue, pricing, bundles, trust content, or Amani reception. Its Amani role-guidance control stays inline below the desktop breakpoint so it cannot cover mobile hero actions; desktop may use the fixed launcher.

**Why:** the shared AI rate limiter must never see unauthenticated requests, and voice/TTS is paid — it needs its own per-owner throttle. A full-screen persona gate previously made the established homepage and Amani appear removed.

**How to apply:** when adding a portal, mount behind auth at the shared shell/layout rather than an individual dashboard, with a fail-closed owner key. Reuse the shared Amani portrait on landing assistants. In MySyariahAI-style post-login gate flows, explicitly redirect an authenticated `/login` URL after gate selection or the protected router can render its 404. Test the role-guidance dialog by its accessible name; do not mistake the separate always-visible Amani Reception section for a dialog that failed to close. Master-override sessions often have no code row, so the owner-key resolver needs an explicit master fallback or master users get 401 only in the paralegal. Preserve SSE cancellation when the browser disconnects, and surface voice-throttle 429 responses as Amani's friendly “taking a short break” chat message rather than silently swallowing them.
