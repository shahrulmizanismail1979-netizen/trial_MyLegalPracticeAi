---
name: zod hoisting breaks @hookform/resolvers@3
description: How a hoisted zod v4 from another workspace lib broke resolvers@3 typechecks, and the packageExtensions fix
---

# zod hoisting vs @hookform/resolvers@3

**Rule:** if `@hookform/resolvers@3` typecheck suddenly fails at every `zodResolver` call site with zod v4 type errors, the cause is a *hoisted* zod v4 from some other workspace package, not the app's own deps. Fix it in `pnpm-workspace.yaml` with `packageExtensions` giving `@hookform/resolvers@3` an optional `zod` peer dependency, then `pnpm install`.

**Why:** resolvers@3 imports zod internally without declaring it, so it resolves whatever zod pnpm hoisted. Adding a zod v4 dependency anywhere in the monorepo (e.g. an AI integration lib) can silently flip which zod resolvers sees. Upgrading resolvers to v5 or bumping the app's zod both cascaded into more type errors and were reverted — the peer-dependency extension is the minimal, stable fix.

**How to apply:** on any new "zodResolver is not assignable" style failure in a Vite app after adding/updating an unrelated lib, check `pnpm why zod`, then confirm the `packageExtensions` block still exists in `pnpm-workspace.yaml`.
