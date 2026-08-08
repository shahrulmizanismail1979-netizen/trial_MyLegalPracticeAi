---
name: Portal matter-file pattern
description: How matter files (matters/deadlines/saved work) are replicated per portal and how ownership must be scoped.
---

Matter files exist in lit (accessCodeId-scoped) and sya (owner_type + owner_id scoped).

**Rule:** when a portal's session identifies users by (accountType, userId) where userId can come from DIFFERENT serial spaces (access-code logins vs email logins, plus `-1` for the master code), any per-user table must be scoped by BOTH owner_type and owner_id — id alone collides across account types. Sya's older sya_conversations scope by userId alone and are exposed to this collision.

**How to apply:** replicating matter files (or any per-user store) into another portal: check that portal's session shape first; if it has accountType/email logins, use the sya owner_type+owner_id pattern (lib/db schema sya/matters.ts), not lit's accessCodeId FK. New tables via direct SQL + boot-time `CREATE TABLE IF NOT EXISTS` ensure in the route module (covers prod on deploy); never drizzle push.

Deadline calculators are per-domain trigger templates (lit: litigationDeadlines.ts; sya: syariahDeadlines.ts with Akta 585/303 periods, weekend roll-forward except substantive iddah). Include practitioner caveats — state enactments differ.
