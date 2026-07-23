# AI Web Books Landing Page & Admin Dashboard

## Overview

pnpm workspace monorepo with a landing page for AI Web Books (6 AI-powered legal reference web books for Malaysian professionals) and an admin dashboard for managing subscriptions, kohorts, pricing, and discount vouchers.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

- `/` — Landing page showcasing all 6 AI Web Book apps with pricing and payment info
- `/admin` — Admin dashboard (Overview, Subscribers, Kohorts, Pricing, Vouchers)

## Apps

1. MyLitAI (mylitai.life) — Litigation
2. MySyalitAI (mysyalitai.life) — Syariah Litigation
3. MyCorpAI (mycorpai.life) — Corporate Secretary
4. MyConveyAI (myconveyai.life) — Conveyancing
5. MyCrimAI (mycrimai.replit.app) — Criminal Law
6. MyCCBLitAI (my-ccb-lit-ai.replit.app) — Construction Law (CCB)

## Database Tables

- `subscribers` — Track buyers/subscribers with payment status
- `kohorts` — Manage subscription batches (slots, pricing)
- `pricing` — Standard per-app pricing
- `vouchers` — Discount voucher codes
- `activity` — Activity log for audit trail

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Judgment Research Platform (persistent rules)

A private legal judgment research and knowledge-management platform lives in this monorepo (module: `artifacts/api-server/src/research/`, tables: `research_*`, docs: `/docs`, fixtures: `/fixtures`). It will serve the 8 legal portals. These rules are persistent:

- **Source-container model**: a file is a source container that may contain zero, one, or many legal cases. A case may originate from one complete source span, multiple spans in one file, spans across multiple files, or multiple alternative source versions. A SOURCE FILE IS A CONTAINER. IT IS NOT AUTOMATICALLY A CASE.
- **Provenance**: every extracted character, paragraph, case candidate, metadata field, quotation, and AI proposition must be traceable to its source.
- **Uncertainty**: uncertain processing results are routed to human review. Preserve uncertainty — never replace it with guessed content.
- **Judicial-text integrity**: judicial text is preserved faithfully. Any correction, normalisation, exclusion, merge, or split is recorded as a reviewable transformation (`research_transformations`).
- **Publisher-content isolation**: suspected publisher-created editorial material is isolated from verified judicial text, search indexes, embeddings, summaries, AI prompts, classifications, and citation analysis.
- **Rights gating**: all source files begin as `UNREVIEWED`. Access and processing depend on the applicable rights status (see `docs/RIGHTS_MODEL.md`).
- **AI behaviour**: AI output is a separate research aid. Every substantive AI proposition requires paragraph-level supporting evidence. AI adapters are disabled by default.
- **Engineering behaviour**: TypeScript throughout; new modules require tests; existing passing tests must remain passing; destructive migrations require explicit approval; errors are recorded and surfaced; background jobs are resumable and idempotent; restricted data is excluded from logs; secrets live in Replit Secrets; real restricted case files are excluded from source control and test fixtures (only synthetic fixtures in `fixtures/synthetic`).
- **Phase discipline**: implement only the active phase (see `docs/PHASES.md` and `docs/status/current-phase.json`) and stop after producing the completion report in `docs/reports/`.
- **Build workflow**: every research-platform phase build follows `docs/BUILD_PROMPT.md` (universal build prompt: read charter/architecture/phase docs first, phase-scope-only, no mocks in production, synthetic fixtures, full checks before completion, completion report + PHASE:/STATUS:/CHECKPOINT: response format).
