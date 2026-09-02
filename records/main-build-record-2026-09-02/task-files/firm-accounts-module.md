# Firm Accounts Module in MyLawFirmAi

## What & Why
Law firms in Malaysia must keep an office account and a separate client (trust) account under the Solicitors' Account Rules. MyLawFirmAi has no accounting at all. This adds an Accounts section: office ledger, client account ledger, expenses, receipts and reports.

## Done looks like
- Office account: record income (bills paid, other income) and expenses (rent, salaries, utilities, disbursements) with categories; running ledger and monthly view
- Client account: per-client trust ledger — money in (deposits from client), money out (disbursements, transfers to office when billed), with a hard rule that a client ledger can never go negative and office/client funds are never mixed
- Receipts/payment vouchers printable as PDF
- Reports: monthly profit & loss, expense breakdown, client-account balances list, simple cashflow — viewable on screen and exportable
- Manager-only access; works end to end in the browser

## Out of scope
- Bank feed integration and auto-reconciliation
- Statutory audit filing formats
- Payroll postings (HR module owns payroll; accounts records the salary expense manually or via a summary entry)

## Steps
1. **Ledger schema & routes** — Office ledger, client trust ledgers, categories and vouchers in the firm schema; enforce the no-negative-client-ledger and no-mixing rules at the API level; manager-session gated
2. **Reports** — P&L, expense breakdown, trust balances, cashflow endpoints with PDF export
3. **Frontend Accounts section** — Accounts area in MyLawFirmAi: office ledger, client ledgers, add income/expense/receipt forms, reports dashboard with charts
4. **End-to-end verification** — Post entries, attempt an overdrawn client ledger (must be blocked), generate reports and PDFs in the browser

## Relevant files
- `artifacts/api-server/src/firm/index.ts`
- `artifacts/api-server/src/firm/routes/index.ts`
- `artifacts/mylawfirmai/src/pages/dashboard.tsx`
