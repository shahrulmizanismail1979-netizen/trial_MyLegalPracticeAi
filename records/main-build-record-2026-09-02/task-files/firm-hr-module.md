# Firm HR Module in MyLawFirmAi

## What & Why
MyLawFirmAi manages staff tasks and meetings, but has no human-resources functions. Law firms need employee records, leave, attendance and payroll basics. This adds an HR section to MyLawFirmAi for managers.

## Done looks like
- Employee records: personal details, position, employment dates, salary, EPF/SOCSO/income-tax reference numbers, emergency contact, employment documents
- Leave management: Malaysian leave types (annual, medical, maternity/paternity, unpaid), balances, staff apply → manager approves/rejects, calendar view
- Attendance: simple clock-in/out or daily presence record, monthly summary
- Payroll basics: monthly payslip generation with gross salary, EPF/SOCSO/EIS/PCB statutory deductions at current Malaysian rates, net pay; payslip PDF download
- All manager-only areas locked to the manager session; staff see only their own records, leave and payslips
- Works end to end in the browser

## Out of scope
- Bank payment file generation / actual salary disbursement
- Performance reviews (existing goals/insights features remain)

## Steps
1. **HR schema & routes** — Employee, leave, attendance and payroll tables in the firm schema; routes split into manager-only and self-service, mounted behind the existing manager/staff session gates
2. **Payroll calculations** — Statutory deduction calculators (EPF, SOCSO, EIS, PCB simplified) with rates kept in one editable config; payslip PDF
3. **Frontend HR section** — New HR area in MyLawFirmAi: employees, leave (apply/approve + calendar), attendance, payroll runs & payslips
4. **End-to-end verification** — Manager and staff flows tested in the browser; cross-staff access must be denied

## Relevant files
- `artifacts/api-server/src/firm/index.ts`
- `artifacts/api-server/src/firm/routes/users.ts`
- `artifacts/mylawfirmai/src/pages/dashboard.tsx`
