---
name: Team-bundle seat limits
description: Durable rules for per-code concurrent-seat enforcement across portals
---

# Team-bundle seat limits

Rules:
- A NULL seat cap always means legacy behavior (no restriction). Only team
  bundles with a real licensed seat count get a cap — never default
  individual plans into one.
- Enforcement must be per-request and router-level: every authenticated
  request on EVERY product route refreshes the caller's seat and fails
  closed (including on registry/DB errors for capped codes). Login-only
  claiming lets active devices age out of the inactivity TTL and
  oversubscribes.
- Capacity decisions must be atomic per code (advisory lock in one
  transaction), and idle sessions past the TTL must be swept both at login
  and when validated per-request.
- Every path that creates or re-creates a portal access record — sync,
  login-time recovery/self-heal, backfill — must explicitly set or clear the
  cap, or a recovered bundle code silently becomes uncapped.
- "All portals" means all of them: audit every portal a bundle advertises
  (including ones with unrelated auth models) before claiming coverage.

**Why:** each rule above corresponds to a real enforcement bypass caught in
review (login-only refresh, non-atomic check-then-insert, fail-open catch
blocks, uncapped recovery, an entire portal missed).

**How to apply:** new portal login paths (code login AND SSO) claim a seat;
auth middlewares refresh/validate it; logouts release it. Device-fingerprint
seat keys (IP+UA) are approximate — shared office NAT collides.
