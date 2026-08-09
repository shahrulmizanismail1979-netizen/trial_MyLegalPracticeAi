---
name: Portal matter-files port pattern
description: Durable tenancy decisions when porting the matter-file workflow into another portal
---
Rule: in a portal whose master-code sessions have no DB row, lazily upsert a synthetic, permanently-inactive access-code row and use its id as the matter tenant.
**Why:** matter tables FK to the portal's access-code table; master sessions otherwise have no tenant id, and an active synthetic row would be a bypass credential.
**How to apply:** put the upsert in the tenant middleware; keep the foreign-matterId 404 guarantee on every matter-scoped route including filing saved work; deadline triggers must fit the portal's practice area, not be copied across; new tables ship via an idempotent boot-time ensure (there is no migration runner and drizzle push is unsafe here), and the committed lib/db dist declarations must be rebuilt whenever schema exports change or api-server typecheck breaks.
