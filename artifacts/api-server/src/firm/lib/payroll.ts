/**
 * Malaysian statutory payroll calculations (2024 rates).
 * Rates kept here in one editable config so they can be updated when
 * the government revises them without touching business logic.
 *
 * DISCLAIMER: PCB uses a simplified progressive-tax estimate based on
 * standard individual relief (RM 9,000). Real PCB uses the official
 * LHDN monthly deduction tables which account for spouse relief,
 * child relief, etc. This approximation is suitable for indicative
 * payslips only; firms should validate against LHDN tables.
 */

import PDFDocument from "pdfkit";

// ── Rate config ────────────────────────────────────────────────────────────────

/** Employee EPF contribution rate (11 % of gross, no ceiling). */
const EPF_EMPLOYEE_RATE = 0.11;
/** Employer EPF rate for employees with gross ≤ RM 5,000. */
const EPF_EMPLOYER_RATE_LOW = 0.13;  // 13 %
/** Employer EPF rate for employees with gross > RM 5,000. */
const EPF_EMPLOYER_RATE_HIGH = 0.12; // 12 %
const EPF_EMPLOYER_THRESHOLD = 5_000;

/** SOCSO employee contribution rate (0.5 %, wage ceiling RM 5,000). */
const SOCSO_RATE_EMPLOYEE = 0.005;
/** SOCSO employer contribution rate (1.75 %, wage ceiling RM 5,000). */
const SOCSO_RATE_EMPLOYER = 0.0175;
const SOCSO_CEILING = 5_000;

/** EIS contribution rate for both employee and employer (0.2 %, ceiling RM 5,000). */
const EIS_RATE = 0.002;
const EIS_CEILING = 5_000;

/** Standard individual tax relief used in the simplified PCB estimate. */
const PCB_STANDARD_RELIEF = 9_000;

// YA 2024 progressive income tax bands.
// Each entry: { lower bound (exclusive), rate for this band, cumulative tax at lower bound }
const TAX_BANDS: { limit: number; rate: number; tax: number }[] = [
  { limit:         5_000, rate: 0.000, tax:          0 },
  { limit:        20_000, rate: 0.010, tax:          0 },
  { limit:        35_000, rate: 0.030, tax:        150 },
  { limit:        50_000, rate: 0.080, tax:        600 },
  { limit:        70_000, rate: 0.130, tax:      1_800 },
  { limit:       100_000, rate: 0.210, tax:      4_400 },
  { limit:       250_000, rate: 0.240, tax:     10_700 },
  { limit:       400_000, rate: 0.245, tax:     46_700 },
  { limit:       600_000, rate: 0.250, tax:     83_450 },
  { limit:     1_000_000, rate: 0.260, tax:    133_450 },
  { limit: Infinity,      rate: 0.280, tax:    237_450 },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function progressiveTax(income: number): number {
  if (income <= 0) return 0;
  for (let i = TAX_BANDS.length - 1; i >= 0; i--) {
    const lower = i === 0 ? 0 : TAX_BANDS[i - 1].limit;
    if (income > lower) {
      return round2(TAX_BANDS[i].tax + (income - lower) * TAX_BANDS[i].rate);
    }
  }
  return 0;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface PayrollResult {
  grossSalary:   number;
  epfEmployee:   number;
  epfEmployer:   number;
  socsoEmployee: number;
  socsoEmployer: number;
  eisEmployee:   number;
  eisEmployer:   number;
  pcb:           number;
  totalDeductions: number;
  netPay:        number;
}

export function calcPayroll(grossSalary: number): PayrollResult {
  const g = Math.max(0, grossSalary);

  // EPF (no wage ceiling)
  const epfEmployee = round2(g * EPF_EMPLOYEE_RATE);
  const epfEmployer = round2(
    g * (g > EPF_EMPLOYER_THRESHOLD ? EPF_EMPLOYER_RATE_HIGH : EPF_EMPLOYER_RATE_LOW),
  );

  // SOCSO (wage ceiling RM 5,000)
  const soscoBasis  = Math.min(g, SOCSO_CEILING);
  const socsoEmployee = round2(soscoBasis * SOCSO_RATE_EMPLOYEE);
  const socsoEmployer = round2(soscoBasis * SOCSO_RATE_EMPLOYER);

  // EIS (wage ceiling RM 5,000)
  const eisBasis    = Math.min(g, EIS_CEILING);
  const eisEmployee = round2(eisBasis * EIS_RATE);
  const eisEmployer = round2(eisBasis * EIS_RATE);

  // PCB – simplified estimate
  const annualChargeable = Math.max(0, g * 12 - epfEmployee * 12 - PCB_STANDARD_RELIEF);
  const pcb = round2(progressiveTax(annualChargeable) / 12);

  const totalDeductions = round2(epfEmployee + socsoEmployee + eisEmployee + pcb);
  const netPay          = round2(g - totalDeductions);

  return {
    grossSalary: round2(g),
    epfEmployee, epfEmployer,
    socsoEmployee, socsoEmployer,
    eisEmployee, eisEmployer,
    pcb,
    totalDeductions,
    netPay,
  };
}

// ── Payslip PDF ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function rm(n: number): string {
  return `RM ${n.toFixed(2)}`;
}

export interface PayslipPDFOptions {
  firmName:        string;
  employeeName:    string;
  employeeTitle:   string | null;
  employeePosition: string | null;
  epfNumber:       string | null;
  socsoNumber:     string | null;
  month:           number;
  year:            number;
  result:          PayrollResult;
}

export function generatePayslipPDF(opts: PayslipPDFOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { firmName, employeeName, employeeTitle, employeePosition,
            epfNumber, socsoNumber, month, year, result } = opts;

    const primary = "#1a365d";
    const light   = "#e8f0fa";
    const W = 495; // usable width

    // ── Header ──
    doc.rect(50, 50, W, 60).fill(primary);
    doc.fillColor("white").fontSize(18).font("Helvetica-Bold")
       .text(firmName, 60, 62, { width: W - 20 });
    doc.fontSize(11).font("Helvetica")
       .text(`PAYSLIP — ${MONTH_NAMES[month]} ${year}`, 60, 85);

    doc.fillColor("#333");

    // ── Employee info ──
    let y = 128;
    doc.rect(50, y, W, 55).fill(light);
    doc.fillColor("#333").fontSize(10).font("Helvetica-Bold")
       .text("EMPLOYEE DETAILS", 60, y + 6);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Name: ${employeeName}`,  60,       y + 20);
    doc.text(`Position: ${employeePosition ?? employeeTitle ?? "—"}`, 60, y + 34);
    doc.text(`EPF No: ${epfNumber ?? "—"}`,    310, y + 20);
    doc.text(`SOCSO No: ${socsoNumber ?? "—"}`, 310, y + 34);

    y += 68;

    // ── Earnings ──
    const drawSectionHeader = (label: string, yy: number) => {
      doc.rect(50, yy, W, 18).fill(primary);
      doc.fillColor("white").fontSize(9).font("Helvetica-Bold")
         .text(label, 55, yy + 5);
      doc.fillColor("#333");
    };
    const drawRow = (label: string, amount: string, yy: number, shade: boolean) => {
      if (shade) doc.rect(50, yy, W, 16).fill("#f5f7fb");
      doc.fillColor("#333").font("Helvetica").fontSize(10)
         .text(label, 60, yy + 3, { width: 300 });
      doc.text(amount, 60, yy + 3, { width: W - 20, align: "right" });
    };

    drawSectionHeader("EARNINGS", y);
    y += 20;
    drawRow("Basic Salary", rm(result.grossSalary), y, false);
    y += 18;
    drawRow("TOTAL EARNINGS", rm(result.grossSalary), y, true);
    doc.font("Helvetica-Bold");
    y += 22;

    // ── Deductions ──
    drawSectionHeader("DEDUCTIONS (EMPLOYEE)", y);
    y += 20;
    let shade = false;
    const deductions: [string, number][] = [
      ["EPF (Employees' Provident Fund) – 11%", result.epfEmployee],
      ["SOCSO (Perkeso) – 0.5%", result.socsoEmployee],
      ["EIS (Employment Insurance System) – 0.2%", result.eisEmployee],
      ["PCB (Monthly Tax Deduction) – Estimated", result.pcb],
    ];
    for (const [label, amount] of deductions) {
      drawRow(label, rm(amount), y, shade);
      y += 18;
      shade = !shade;
    }
    drawRow("TOTAL DEDUCTIONS", rm(result.totalDeductions), y, true);
    doc.font("Helvetica-Bold");
    y += 22;

    // ── Employer contributions ──
    drawSectionHeader("EMPLOYER CONTRIBUTIONS (FOR INFORMATION ONLY)", y);
    y += 20;
    shade = false;
    const empContribs: [string, number][] = [
      ["EPF (Employer) – 12%/13%", result.epfEmployer],
      ["SOCSO (Employer) – 1.75%",  result.socsoEmployer],
      ["EIS (Employer) – 0.2%",     result.eisEmployer],
    ];
    for (const [label, amount] of empContribs) {
      drawRow(label, rm(amount), y, shade);
      y += 18;
      shade = !shade;
    }
    y += 6;

    // ── Net Pay ──
    doc.rect(50, y, W, 36).fill(primary);
    doc.fillColor("white").fontSize(13).font("Helvetica-Bold")
       .text("NET PAY", 60, y + 10);
    doc.text(rm(result.netPay), 60, y + 10, { width: W - 20, align: "right" });
    y += 44;

    // ── Footer ──
    doc.fillColor("#888").fontSize(8).font("Helvetica")
       .text(
         "PCB is a simplified estimate. Statutory rates current as of 2024. "
         + "Verify against official LHDN tables. This payslip is system-generated.",
         50, y, { width: W },
       );

    doc.end();
  });
}
