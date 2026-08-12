---
name: Per-seat AI quota identity
description: Why device-fingerprint rate-limit keys fail for team bundles and the signed seat-cookie pattern that replaces them
---

# Per-seat AI quota identity

Rule: never key a per-lawyer quota on IP + user-agent alone — lawyers in one office share NAT and browser builds, so fingerprints collide and team-bundle members silently share one bucket. Cookie-based portals must key on a server-issued, HMAC-signed seat cookie; a seat only counts when the client PRESENTED it (a seat minted on the current request must not become the key, or cookie-less scripts get a fresh bucket every request — they fall back to the fingerprint).

**Why:** completion review rejected fingerprint-only keying as a false guarantee of per-lawyer quotas.

**How to apply:** any new AI limiter for a shared-access-code portal should run the seat-ensure middleware before the limiter and prefer the presented seat id over the device fingerprint; session-based portals can keep using the express session ID.
