---
name: Stripe cancellation must revoke portal access
description: Rules for revoking multi-portal access when a Stripe subscription ends
---

Rule: any Stripe subscription end (deleted, or updated to canceled/unpaid/incomplete_expired) must deactivate the subscriber's access code in every portal table, and cancelled subscribers must never be re-activated by replayed checkout webhooks or success-page polls.

**Why:** originally only checkout.session.completed was handled — cancelled trial users kept access forever; and re-provisioning an existing subscriber re-activated codes, so a replayed webhook could undo a cancellation.

**How to apply:** in provisioning, run portal deactivation on every cancellation delivery (idempotent, before the status check) so partial failures are retried; skip syncPortalAccessCodes when paymentStatus is "cancelled"; handle both customer.subscription.deleted and terminal customer.subscription.updated statuses. Portal "active" columns differ per portal (isActive / active / status active-inactive).
