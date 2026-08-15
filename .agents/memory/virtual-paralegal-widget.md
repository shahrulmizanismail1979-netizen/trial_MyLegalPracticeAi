---
name: Virtual paralegal dashboard widget
description: Cross-portal floating AI paralegal (chat + ElevenLabs voice) — shared engine, per-portal mounts, master-session owner-key traps
---

The assistant's user-chosen identity is **Amani** — a realistic photo avatar (`lib/paralegal-widget/src/amani-avatar.jpg`, default `assistantName="Amani"`) with animated speaking rings synced to TTS playback. This identity was once lost in a checkpoint rollback and had to be recovered from git history; never rename or drop the avatar without the user's say-so.

Every portal dashboard hosts the shared floating paralegal: backend `attachVirtualParalegal` (api-server lib) mounted at `<portal>/paralegal` behind each portal's real auth; frontend `@workspace/paralegal-widget` lib takes a `request(path, init)` wrapper that carries the portal's auth (cookie vs Bearer).

**Why:** one engine + persona per portal; the shared aiRateLimit inside must never see unauthenticated requests, and TTS is paid — /speak has its own per-owner per-minute throttle.

**How to apply:**
- New portals: mount behind auth, provide fail-closed `getOwnerKey`.
- TRAP: master-override sessions often have NO code row/local id — getOwnerKey must add an explicit master/static fallback (crim `session.isMaster`, accident `isMasterToken`, ccb static codes resolve to null → device key), or master users get 401 "Not authenticated" from the paralegal only.
- Chat SSE stops generating on client disconnect (res 'close' flag) — keep that when editing the stream loop.
