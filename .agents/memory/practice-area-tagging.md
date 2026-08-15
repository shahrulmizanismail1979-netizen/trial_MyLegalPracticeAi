---
name: Practice-area scoping for portal case-law search
description: Policy decisions behind /api/cases practice-area enforcement
---
Practice-area scope is enforced server-side from `req.portalAuth.type` — the `practiceArea` query param is only honored for unrestricted identities (master, acad). All practice portals (lit/crim/corp/ccb/accident/convey/sya) are locked to their area on both search and case detail (404, not 403); convey/sya see empty results until matching Drive content is ingested — that's intentional.

**Why:** client-supplied filters are trivially tampered with; the requirement is an access boundary, not a UI convenience. Reviewer ruling: "no content yet" is not a reason to leave a portal unrestricted.

**How to apply:** untagged (NULL practice_area) cases are invisible to scoped portals by design (strict equality). Adding a new practice folder to Drive needs a pattern in the classify mapping AND, if a portal should be locked to it, an entry in the portal→area map in the cases route. Schema/backfill runs as an idempotent boot ensure (direct SQL), consistent with the project's no-drizzle-push migration pattern.
