---
name: Managed workflow name collisions
description: Legacy workflow entries can compete with automatically managed artifact workflows under the same name.
---

Do not keep legacy `.replit` workflows named identically to managed artifact services.

**Why:** Both processes can start, yet status and removal operations resolve to the managed service. The managed service then reports a port collision or moves to another port while the duplicate remains alive. Removing by name is rejected as an attempt to remove the managed service.

**How to apply:** Preserve the artifact manifest, remove only the duplicate legacy workflow blocks through schema-validated `.replit` replacement, stop the identified duplicate processes, and restart the managed service. Do not recreate a replacement workflow.