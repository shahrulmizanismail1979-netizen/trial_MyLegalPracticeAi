---
name: Paid checkout capacity invariants
description: Safety rules for enforcing a hard sales cap across local reservations and remote payment sessions.
---

Once a remote provider has created a payable checkout session, never release its local capacity merely because attaching the remote session to the local row failed. A delayed completion that reclaims an expired or released row must run under the same cohort lock as new claims and count both paid places and every unexpired checkout reservation.

**Why:** A remote checkout can remain payable after a local write failure or webhook delay. Reallocating its slot, or counting only already-paid rows during reclaim, allows the old checkout and a replacement checkout to exceed the advertised hard cap.

**How to apply:** Separate failures before and after remote checkout creation. Release only before a payable session exists. For completion/reclaim, atomically compare all active allocations against the cap and refuse provisioning when no slot remains.