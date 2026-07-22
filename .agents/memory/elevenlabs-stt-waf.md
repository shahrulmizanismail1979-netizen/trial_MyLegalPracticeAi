---
name: ElevenLabs STT via connector proxy — WAF blocks inline uploads
description: Why all speech-to-text calls must use cloud_storage_url staging instead of inline multipart file bytes.
---

**Rule:** Never send audio bytes inline as a multipart `file` field to `/v1/speech-to-text` through the Replit ElevenLabs connector proxy. Stage the recording in private object storage (sidecar signed PUT) and pass a signed GET URL as the `cloud_storage_url` form field instead. Shared helper: `stageRecordingForStt` in the api-server lib.

**Why:** Cloudflare's WAF in front of the proxy blocks compressed formats (MP3/MP4/webm) with a 403 "Just a moment" bot challenge regardless of size, UA, or boundary tweaks; WAV sometimes passes, which makes the failure look intermittent. Verified July 2026.

**How to apply:** Any new STT call site (any portal) must use the staging helper with `finally { cleanup() }`. Also remember prod needs the ElevenLabs connection bound to the Repl (account-level connection isn't enough) — a republish is required after binding.
