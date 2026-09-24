---
name: Portal sign-in alert policy
description: Privacy and recovery semantics for passive subscriber sign-in monitoring.
---

Keep sign-in monitoring independent of authentication and provisioning repair; only attribute signals to a uniquely recognized active subscriber entitled to the destination portal.

**Why:** A healthy provisioned row does not prove that sign-in works, and an unverified email or ticket does not prove subscriber identity. Monitoring must never become an authorization dependency.

**How to apply:** Retain only internal identifiers and bounded outcome metadata. Do not infer failure ownership from arbitrary email/password attempts or unverified SSO tickets; for ticket-only SSO, use the linked identity only after the route verifies the ticket. Distinguish quiet-window closure from an observed successful login, and preserve warning cooldown across either closure to avoid repeated alert bursts.