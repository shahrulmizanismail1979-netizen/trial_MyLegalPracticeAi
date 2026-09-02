# Central Case Home Across Portals

## What & Why
Make the case or matter—not a collection of separate AI tools—the main working unit across every practitioner legal portal that already handles client matters. Current 2026 legal-workflow research emphasizes centralized matter dashboards, clear task ownership, critical-date visibility, document context, reduced duplicate entry, and human-reviewed AI inside the normal workflow. The project already has most of these ingredients, but they are fragmented across tabs and implemented unevenly by portal.

This task creates one consistent “Case Home” experience for MyAccidentAI, MyLitAI/MyLitAI IRAC, MyCrimAI, MySyariahAI, MyCorpLegalAI, MyCorpCommBankLitAI, and MyConveyLitAI. Each portal keeps its practice-specific terminology and tools while sharing a faster common workflow.

## Done looks like
- Active matters and “continue working” actions are prominent from each practitioner portal’s main workspace
- Every matter opens to a useful Case Home showing the current stage, next deadline, outstanding tasks, latest activity, key people, and the most relevant next action
- Lawyers can create and assign matter tasks with an owner, due date, priority, status, and short note
- One chronological timeline combines stage changes, deadlines, task activity, uploads, saved documents, notes, and filed AI outputs
- Launching an AI tool from a matter carries the matter context into editable fields, and the reviewed result can be filed back into the same matter without re-entering details
- Filed AI work records its source tool and time so lawyers can distinguish generated work from uploaded or manually authored documents
- The baseline experience is consistent and mobile-usable across all included portals, while practice-specific workflows remain intact
- Existing tenant and access-code ownership rules continue to isolate one subscriber’s matters, tasks, documents, and AI outputs from another’s

## Out of scope
- Turning MyLawFirmAI, MyLawAcad, the public landing page, or research-admin into case-work portals
- External email, calendar, document-management, or court-filing integrations
- Automatic legal decisions, automatic court filing, or unreviewed AI output treated as final legal work
- Replacing billing, accounting, HR, research-ingestion, or assessment workflows

## Steps
1. **Define the shared Case Home contract** -- Consolidate the existing matter, deadline, stage, saved-work, and client capabilities behind a consistent cross-portal summary, and add matter tasks plus a unified activity feed.
2. **Build the reusable Case Home experience** -- Present next action, critical dates, tasks, people, documents, and timeline in a clear hierarchy that works on desktop and mobile.
3. **Make AI actions matter-aware** -- Preserve matter context when opening relevant AI tools, keep pre-filled details editable, and let reviewed outputs return to the originating matter with clear provenance.
4. **Roll out to every practitioner portal** -- Apply the common baseline to Accident, Lit/IRAC, Criminal, Syariah, Corporate Legal, Corporate/Commercial/Banking Litigation, and Conveyancing while retaining each practice area’s terminology and specialist tools.
5. **Verify real lawyer workflows and isolation** -- Test create/open/continue flows, task and deadline updates, timeline ordering, AI-to-matter filing, mobile usability, and cross-subscriber access controls in representative portals.

## Relevant files
- `artifacts/api-server/src/lib/attachCaseIntelligence.ts`
- `artifacts/api-server/src/lib/matterFiles.ts`
- `artifacts/mylitai/src/pages/MatterDetail.tsx`
- `artifacts/mylitai/src/hooks/use-matters.ts`
- `artifacts/mylitai-irac/src/pages/MatterFile.tsx`
- `artifacts/mycrimai/src/pages/matter-detail.tsx`
- `artifacts/mysyariahai/src/pages/matter-detail.tsx`
- `artifacts/myconveylitai/src/pages/MatterDetail.tsx`
- `artifacts/myaccidentai/src/components/MatterPicker.tsx`
- `artifacts/mycorplegalai/src/components/MatterPicker.tsx`
- `artifacts/myccblitai/src/components/MatterPicker.tsx`