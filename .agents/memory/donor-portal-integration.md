---
name: Donor-app portal integration
description: Lessons from importing an external app (MySyalitAI) into the monorepo as a new portal
---
- pg_dump renames: renaming tables with a prefix does NOT rename constraint/index names; the originals collide with existing tables' constraints, so PKs/uniques/FKs silently fail on import — re-add them with prefixed constraint names after import.
- **Why:** constraint names are global-ish per schema; import errors are easy to miss among noise.
- createArtifact enforces a max-artifact limit (7); existing projects can exceed it. Workaround: hand-write `.replit-artifact/artifact.toml` (copy a sibling portal, unique port) and validate via `verifyAndReplaceArtifactToml` — this registers the workflow/proxy route.
- Donor schemas live under `lib/db/src/schema/<prefix>/` exported via a package.json subpath (e.g. `@workspace/db/sya`), kept OUT of the main barrel and drizzle push config so drizzle-kit never tries to manage them.
- Ported AI/chat routes must get auth + per-user ownership scoping — donor apps are often single-tenant and ship unauthenticated conversation CRUD.

## Post-review checklist for new portals
- New portal must be added in THREE provisioning places or purchases silently skip it: `APP_NAME_BY_URL` (landing card URL → app name), `ALL_APP_NAMES` (bundles), and the `sync*/deactivate*` wiring in `syncPortalAccessCodes`/`deactivatePortalAccessCodes`.
- Audit every donor mutation route for missing auth: TaskRadar's `POST /users` accepted a `role` field with no manager gate → staff could self-escalate to manager. Any route that can create/alter privileged rows needs the manager-session check.
- Donor-port typecheck error floods usually root in ONE bad module path — fix the FIRST error, not the tail.

Empty prod content DBs: each portal ported from a donor app has reference-content tables that exist only in dev — production shows an all-zero dashboard after deploy. Fix pattern: export dev rows to a `<portal>-content-seed.json` and add a boot-time `seed<Portal>Content()` (skip non-empty tables, jsonb_populate_recordset + ON CONFLICT DO NOTHING, setval sequence bump), called best-effort in api-server index.ts. Done for sya and crim; expect the same report for other portals.

IRAC portal (mylitai-irac): its client irac-api.ts shipped with donor-era root paths (/api/auth, /api/oral, /api/theory...) while everything is mounted at /api/lit/*; also server chat expects `litMessages`, not `messages`. Symptom: Practice-menu features dead + logout "something went wrong" in prod. When auditing a donor port, curl-probe every client base path against the shared proxy.
