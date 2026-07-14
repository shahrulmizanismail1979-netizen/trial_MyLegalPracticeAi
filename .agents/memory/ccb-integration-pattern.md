---
name: CCB-style JWT auth integration pattern
description: Pattern for integrating a JWT-based app (no express-session) with inline zod validation into the api-server
---

## Pattern: JWT-based app integration (no session middleware)

**Why:** CCB auth uses jsonwebtoken stored in localStorage — unlike crim/lit which use
express-session + connect-pg-simple. No session middleware needed at the router mount.

**How to apply:**
- Mount directly: `router.use("/ccb", ccbRouter)` — no session middleware wrapper
- jsonwebtoken is already a dep of api-server; no new dep needed
- zod IS needed as explicit dep (`pnpm --filter @workspace/api-server add zod`) — api-server
  doesn't use zod directly in its other routes (they use @workspace/api-zod generated schemas)
- Import zod as `from "zod"` (not `from "zod/v4"`) in api-server CCB routes

## DB migration caveat

`drizzle-kit push` uses @clack/prompts TUI — piping stdin doesn't work.
For new tables (not renames), create directly via SQL:
```sql
CREATE TABLE IF NOT EXISTS "ccb_access_codes" (...);
```
Then skip the drizzle-kit push step entirely for those tables.

## Frontend api-client-react removal

When removing @workspace/api-client-react from a copied frontend:
1. Remove dep from package.json
2. Remove tsconfig.json `references` entry for `../../lib/api-client-react`
3. Replace hooks inline with useQuery/useMutation from @tanstack/react-query
4. Check ALL files — layout.tsx often imports useListTools too
