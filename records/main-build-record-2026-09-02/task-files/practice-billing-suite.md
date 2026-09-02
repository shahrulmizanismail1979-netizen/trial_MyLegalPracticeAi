# Time, Billing & Invoicing Across All Portals

## What & Why
Lawyers need to record billable time and fees on each matter and turn them into professional invoices for clients. Today the portals track matters and some time-log stubs, but there is no fee/rate system, no invoice lifecycle, and no legal-fee ledger anywhere. This adds a shared time-and-billing engine used by every practice portal (MyLitAI, MyCrimAI, MySyariahAI, MyCCBLitAI, MyAccidentAI, MyConveyLitAI, MyCorpLegalAI).

## Done looks like
- On any matter, a lawyer can log time entries (date, activity, minutes, rate) and record fixed fees & disbursements
- A billing tab per matter shows running totals (professional fees, disbursements, taxes)
- Lawyer can generate an invoice (draft → issued → paid/partly-paid), with firm/client details, itemized lines, and download it as a professional PDF
- A portal-level "Billing" page lists all invoices with status and aged-receivables summary
- Works end to end in the browser on every portal, scoped per subscriber (and master code)

## Out of scope
- Online payment collection from clients (Stripe checkout for the firm's own clients)
- Double-entry accounting (covered by the firm accounts task)

## Steps
1. **Shared billing engine** — Central library that creates the billing tables (time entries, fee items, invoices, invoice lines) with per-portal owner scoping following the existing shared matter-files/case-intelligence pattern; boot-ensured tables via direct SQL
2. **Routes per portal** — Mount billing routes behind each portal's auth, with the per-portal owner-column mapping (follow the case-ownership checklist so nothing fails closed)
3. **Invoice PDF export** — Server-side professional invoice PDF and billing-summary PDF (this supersedes the earlier billing-summary-PDF idea)
4. **Portal UI** — Matter billing tab + portal-level Billing page in each of the 7 practice portals, consistent design per portal theme
5. **End-to-end verification** — Curl-level auth checks on every portal, plus browser test on at least two portals; full api-tests run

## Relevant files
- `artifacts/api-server/src/lib/matterFiles.ts`
- `artifacts/api-server/src/lib/caseIntelligence.ts`
- `artifacts/api-server/src/lit/routes/matters.ts`
- `artifacts/api-server/src/utils/docxExport.ts`
