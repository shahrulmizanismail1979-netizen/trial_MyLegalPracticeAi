---
name: Stripe connector mode changes
description: Reauthorizing an existing Stripe connection may preserve its original test/live mode.
---

## The rule
Reauthorizing an existing Stripe connection may preserve the mode selected during its original authorization rather than switching between test and live mode.

**Why:** Reauthorization can reuse stored connection state. Repeated reconnect attempts are therefore not reliable evidence that the mode changed.

**How to apply:** Verify Stripe mode from a safe, non-secret API property rather than inspecting or recording credential material. If the mode is wrong, use the supported connection/secret repair flow; never paste or persist keys, key fragments, account identities, or alert recipients in project memory.
