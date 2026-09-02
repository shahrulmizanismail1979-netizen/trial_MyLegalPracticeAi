# Close corporate legal workflow gaps

## What & Why

Bring the highest-risk practitioner needs identified in the Malaysia corporate-legal research into one coherent workflow milestone. The existing app has strong matter and secure-draft foundations, but corporate work still lacks a complete chain from intake through evidence, approval, execution, and follow-up.

## Done looks like

- Every supported MyCorpLegalAI drafting flow clearly carries matter context and lets a user save the completed work to the correct matter without losing ownership, status, or exportability.
- A corporate compliance workspace can track an obligation against an entity/matter, required evidence, responsible owner, verification state, filing/disclosure deadline, and completion history.
- Contract and transaction work supports a canonical document, version/deviation history, approval state, closing actions, and post-signing obligations rather than only one-shot generation.
- AI-assisted work visibly records sources or supplied evidence, assumptions, missing facts, reviewer status, and final approval state; client-facing/export actions cannot silently present unreviewed work as final.
- Matter deadlines support reminder and escalation states with clear overdue/blocked visibility.
- Existing ownership and privacy protections remain intact, and the changed flows have focused API/UI/e2e coverage.

## Out of scope

- Replacing the existing legal research corpus or adding unsupported legal content.
- Building a full e-billing, external-counsel panel, or procurement integration in this milestone.
- Claiming that any AI output is legal advice or automatically correct.
- Redesigning every portal’s visual language; other portals should consume shared behavior where practical, but MyCorpLegalAI is the primary delivery surface.

## Steps

1. **Normalize matter context and filing** — Trace every supported corporate AI tool from input through completion, export, and save; close paths that lose matter context or allow an unlinked completed work product, while preserving retry-safe private storage and owner scoping.
2. **Add an evidence-led compliance slice** — Implement a reusable corporate obligation record and UI for a first high-value workflow such as beneficial ownership/e-BOS, including entity, evidence checklist, owner, verification, due date, status history, and explicit “not legal advice / verify current rule” boundaries.
3. **Add contract/transaction follow-through** — Extend matter work with canonical document/version metadata, deviation or issue records, approval decisions, closing checklist items, and post-closing actions; keep drafting tools as assistance rather than treating generated text as completion.
4. **Enforce AI review and provenance** — Persist supplied evidence, assumptions, missing-fact markers, source/provenance metadata where available, reviewer identity/status, and finalisation state; gate final exports or matter filing according to the chosen review policy and make incomplete/interrupted generation explicit.
5. **Complete deadline reminders and escalation** — Build on the existing deadline model to provide reminder status, overdue/blocked states, ownership escalation, and an observable delivery path without leaking matter data across tenants.
6. **Verify the end-to-end flows** — Add focused backend tests and browser coverage for matter save, compliance evidence, approval/review gates, contract follow-through, deadline escalation, privacy boundaries, and retry/concurrency behavior; run typechecks and the relevant workflows before completion.

## Relevant files

- `artifacts/mycorplegalai/src/pages/MatterDetailPage.tsx`
- `artifacts/mycorplegalai/src/pages/ToolDetailPage.tsx`
- `artifacts/mycorplegalai/src/components/SaveToMatterPanel.tsx`
- `artifacts/mycorplegalai/src/hooks/use-saved-work.ts`
- `artifacts/mycorplegalai/src/hooks/use-matters.ts`
- `artifacts/mycorplegalai/src/data/ai-tools-data.ts`
- `artifacts/api-server/src/lib/matterFiles.ts`
- `artifacts/api-server/src/lib/caseIntakeBriefing.ts`
- `artifacts/api-server/src/lib/attachCaseIntelligence.ts`
- `artifacts/api-server/src/lib/caseEvents.ts`
- `artifacts/api-server/src/corp/routes/legal/index.ts`
- `lib/db/src/schema/matter-files.ts`