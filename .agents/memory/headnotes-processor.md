---
name: Headnotes & Catchwords processor
description: Pattern for the container.headnotes Gemini processor — idempotency, regeneration, rights gate, and DB upsert flow.
---

# Headnotes & Catchwords Processor

## Pattern
- Job kind: `container.headnotes`
- Processor version: `headnotes@1` (bump when prompt changes — triggers re-draft for pending judgments)
- Auto-enqueued from `searchIndexProcessor.ts` after successful search indexing (fire-and-forget; failure is non-fatal)
- Idempotency key: `container.headnotes:judgment:${judgmentId}:headnotes@1` — fixed per judgment+version

## Rights gate
- `analysisPermitted` must be `true` on the latest rights record for the container. Fails closed.

## Idempotency & regeneration
- Processor skips if `accepted` headnotes already exist for the judgment.
- Re-generation (via admin `/regenerate` endpoint): delete ai_draft headnotes + catchwords + the existing job row, then re-enqueue.
  - This is the ONLY way to regenerate — don't change the idempotency key format; delete the old job row instead.

## DB schema
- `research_headnotes`: judgment_id + number (unique pair), text, paragraph_ref, status (ai_draft/accepted/rejected)
- `research_catchwords`: judgment_id + sort_order, catchword_line, status
- Created via direct SQL (not drizzle push — see drizzle-push-rename-trap.md)

**Why:** Drizzle push renames unrelated tables when adding new ones; always add new research tables via `psql` direct SQL.

## Upsert behavior
- On each AI run: delete existing `ai_draft` rows first, then insert fresh ones.
- `accepted` rows are never deleted by the processor — only by explicit editor rejection.

## Admin review UI
- Route: `/api/research-admin/headnotes/:judgmentId` (GET, PATCH headnotes/:id, PATCH catchwords/:id, POST accept-all, POST regenerate)
- Frontend page: `artifacts/research-admin/src/pages/headnotes-review.tsx`
