# Case Law Search UI in All Portals

## What & Why
Once the portal case law API exists, every portal app (MyLitAI, MyCrimAI, MySyariahAI, MyLitAI IRAC, MyConveyLitAI, MyCCBLitAI, MyCorpLegalAI, MyAccidentAI) needs a "Case Law" section where subscribers can search and read cases with headnotes and catchwords — exactly as they appear in a printed law report. This task builds a shared React component and wires it into each portal's navigation.

## Done looks like
- Every portal has a "Case Law" nav item (or tab) that opens a full-text search interface
- The search bar supports keyword search; results show: citation, case name, court, date, and catchwords
- Clicking a case opens a full case view styled like a law report: catchwords at the top, numbered headnotes, then the full judgment text with paragraph numbers
- The case viewer has a "Copy Citation" button and a "Save to Matter File" button (saves the case to the current portal's matter file if one is open)
- The UI is consistent with each portal's existing design system (uses the portal's own colours/components)

## Out of scope
- Annotation or highlighting of judgment text (future)
- Downloading/exporting cases as PDF (future)
- AI-powered case comparison or summarisation (separate AI tools already exist per portal)

## Steps
1. **Shared case law API client** — Add typed fetch helpers for `/api/cases/search` and `/api/cases/:id` to a shared location usable by all portal frontends (or duplicate per portal if they don't share a package). Include pagination state management.
2. **CaseLawSearch component** — Build a reusable React component: search bar + filter dropdowns (court, date range), result list cards (citation, case name, court, date, catchwords summary), and loading/empty/error states.
3. **CaseViewer component** — Build a full case view: catchwords block at top (styled as law report header), numbered headnotes section, judgment text paragraphs with numbers, sidebar with all metadata (parties, court, citation, judges, date). Add "Copy Citation" and "Save to Matter File" actions.
4. **Wire into each portal** — Add a "Case Law" nav link and route to each of the 8 portal apps, rendering the CaseLawSearch/CaseViewer components. Use each portal's existing layout and auth wrapper.
5. **Matter file integration** — In portals that have matter files (MyLitAI, MyCrimAI, MySyariahAI, MyLitAI IRAC, MyConveyLitAI, MyCorpLegalAI), implement "Save to Matter File" by posting the case citation + headnotes to the existing matter file attachment endpoint.

## Relevant files
- `artifacts/mylitai/src/`
- `artifacts/mycrimai/src/`
- `artifacts/mysyariahai/src/`
- `artifacts/mylitai-irac/src/`
- `artifacts/myconveylitai/src/`
- `artifacts/myccblitai/src/`
- `artifacts/mycorplegalai/src/`
- `artifacts/myaccidentai/src/`
