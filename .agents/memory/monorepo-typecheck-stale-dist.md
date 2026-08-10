---
name: Stale project-reference declarations break workspace typecheck
description: lib/* packages emit declaration-only dist via composite tsconfig; if dist goes stale, tsc reports phantom missing exports from @workspace/db.
---

# Stale project-reference declarations

## The rule
`lib/db` (and other lib packages) use `composite: true` + `emitDeclarationOnly` with `outDir: dist`, but have **no build script** — declarations only regenerate via `tsc -b`. When schema files are added without rebuilding, dependents typecheck against stale `dist/*.d.ts` and report phantom errors like `Module '"@workspace/db"' has no exported member 'crimMatters'` even though runtime (esbuild, bundles from src) works fine.

**Why:** package.json `exports` point at `src/*.ts`, but TS project references resolve types from the composite `dist` output.

**How to apply:** run `npx tsc -b` from the workspace root (or `npx tsc -b lib/db`) before trusting typecheck results; if you see "no exported member" errors for symbols that clearly exist in `lib/db/src/schema`, rebuild first.
