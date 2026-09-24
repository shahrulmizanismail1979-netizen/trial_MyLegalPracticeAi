---
name: Portal access-code sync
description: Any path that confirms a subscriber must sync their code to ALL portal tables via syncPortalAccessCodes
---

Rule: every path that creates or confirms a subscriber (Stripe provisioning, admin create/update/confirm) must call the unified `syncPortalAccessCodes()` so the code works on every portal in the plan; a startup backfill covers historical rows.

**Why:** codes used to sync only for 4 of 7 portals and only on the Stripe path — admin-created codes silently failed at portal logins. Also, app-name lists can contain variants ("MyLitAI" AND "MyLitAI (Versi 2)"), so inclusion checks must match all variants, not one literal name.

Spelling variants: admin UI historically saved "MyAccidentAi", "MyCorpCommBankLitAi", "MyConveyAI" while sync checked canonical "MyAccidentAI", "MyCCBLitAI", "MyConveyLitAI" — sync silently skipped those portals. Fix: `normalizeAppNames()` canonicalizes before persisting, and include checks accept both spellings as a safety net.

Legacy gap: old prod subscriber rows have an EMPTY `apps` array (created before per-app tracking), so the boot backfill and sync skip them — their codes exist in `subscribers` but not in any portal table, producing "Invalid access code" on re-login. Fix pattern: portal logins should self-heal — on a missing/inactive/expired code row, look up the code in `subscribers`; if confirmed + unexpired and apps includes the portal OR is empty, upsert via the portal's sync fn and proceed (implemented in sya auth; replicate for other portals if reported).

**How to apply:** when adding a new portal or a new subscriber-mutation path, extend `syncPortalAccessCodes` and its per-app include check; never re-add per-path sync blocks.

Portal destination is a separate diagnostic from provisioning.

**Why:** A reported MyCrimAI trial rejection coincided with checkout linking to the independently hosted mycrimai.life, while recent production subscribers all had active integrated portal rows. Repairing provisioning would not fix a customer visiting the other installation.

**How to apply:** Check the actual destination and production mirror state before changing authentication. Route integrated purchases to the integrated portal; do not assume legacy custom domains share its database or redirect automatically.

Keep legacy checkout URL aliases mapped to their historical entitlement names even when navigation moves to integrated paths.

**Why:** Old Stripe sessions can return after a link correction; changing the product identity as well as the destination risks granting the wrong portal or losing access. Standalone customers must not be migrated implicitly.

**How to apply:** Canonicalize navigation separately from entitlement metadata. Customer delivery links must use the verified published origin, never a workspace development domain.
