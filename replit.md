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
