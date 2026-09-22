---
name: Managed workflow name collisions
description: Legacy workflow entries can compete with automatically managed artifact workflows under the same name.
---

Do not keep legacy `.replit` workflows named identically to managed artifact services.

**Why:** Both processes can start, yet status and removal operations resolve to the managed service. The managed service then reports a port collision or moves to another port while the duplicate remains alive. Removing by name is rejected as an attempt to remove the managed service.

**How to apply:** Preserve the artifact manifest, remove only the duplicate legacy workflow blocks through schema-validated `.replit` replacement, stop the identified duplicate processes, and restart the managed service. Do not recreate a replacement workflow.

Do not infer a portal outage from a failed duplicate start alone. Surviving process trees can still serve healthy previews even when there are no duplicate workflow blocks in the current configuration.

**Why:** Post-merge relaunches have reported EADDRINUSE while every existing portal still returned successful responses. Broadly restarting those listeners would disrupt working development sessions.

**How to apply:** Probe the actual artifact paths and inspect listener ownership first. Preserve healthy services unless a specific code change requires reloading them; distinguish runtime availability from the status of the latest start attempt.