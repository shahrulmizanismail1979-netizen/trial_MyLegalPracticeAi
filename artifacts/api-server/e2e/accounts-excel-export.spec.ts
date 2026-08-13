import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

/**
 * E2E: MyLawFirmAI — Accounts Excel export
 *
 * 1. Pre-authenticates as manager via POST /api/firm/auth/manager.
 * 2. Navigates to /mylawfirmai/accounts, clicks the Reports tab, clicks
 *    "Download Excel".
 * 3. Saves the downloaded .xlsx and parses it with ExcelJS to verify:
 *    - filename is accounts-report-<year>.xlsx
 *    - three worksheets with correct names
 *    - each sheet has a frozen header row (ySplit: 1, state: "frozen")
 *    - header row is bold, white text, dark blue fill
 *    - totals/last row is bold
 *    - every column has an explicit width > 0
 *    - totals row values match the live API report data
 * 4. No "Excel export failed" error toast is visible.
 */

test.setTimeout(60_000);

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = "http://localhost:80";

async function apiGet(url: string, cookie: string) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { Cookie: cookie },
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.json() as Promise<Record<string, unknown>>;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

// ── Test ──────────────────────────────────────────────────────────────────────

test("Download Excel produces a correctly structured .xlsx matching API data", async ({
  page,
  context,
}) => {
  const masterCode = process.env.MASTER_ACCESS_CODE;
  if (!masterCode) throw new Error("MASTER_ACCESS_CODE env var is required");

  // The Excel export dialog defaults: Jan 1 → current month of current year.
  const now = new Date();
  const fromYM = `${now.getFullYear()}-01`;
  const toYM   = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const rangeLabel = fromYM === toYM ? fromYM : `${fromYM} to ${toYM}`;
  const expectedFilename = `accounts-report-${fromYM}_${toYM}.xlsx`;

  // ── 1. Manager API auth — sets httpOnly session cookie in the browser ──────
  const loginRes = await page.request.post("/api/firm/auth/manager", {
    data: { passcode: masterCode },
  });
  expect(loginRes.ok()).toBeTruthy();

  // Grab the cookie string so we can call the API directly too.
  const cookieHeader = (await context.cookies())
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  // ── 2. Fetch expected report data from the API (date-range params) ─────────
  const [plResp, expResp, trustResp] = await Promise.all([
    apiGet(`/api/firm/accounts/reports/pl?from=${fromYM}&to=${toYM}`, cookieHeader) as Promise<{
      pl: Array<{ month: string; income: number; expense: number; net: number }>;
      totalIncome: number; totalExpense: number; netProfit: number;
    }>,
    apiGet(`/api/firm/accounts/reports/expenses?from=${fromYM}&to=${toYM}`, cookieHeader) as Promise<{
      breakdown: Array<{ category: string; total: number }>; grandTotal: number;
    }>,
    apiGet("/api/firm/accounts/reports/trust", cookieHeader) as Promise<{
      ledgers: Array<{ clientName: string; matterRef?: string; balance: number }>;
      totalBalance: number;
    }>,
  ]);

  // ── 3. Navigate to Accounts > Reports and open the export dialog ──────────
  await page.goto("/mylawfirmai/accounts");

  // Accounts page requires manager; if StaffGate still visible, fill it.
  const passcodeInput = page.locator('input[type="password"]');
  if (await passcodeInput.isVisible().catch(() => false)) {
    await passcodeInput.fill(masterCode);
    await passcodeInput.press("Enter");
  }

  await page.waitForSelector('[role="tablist"]', { timeout: 20_000 });
  await page.getByRole("tab", { name: /reports/i }).click();

  // "Download Excel" now opens a date-range dialog; click it to open.
  const downloadBtn = page.getByRole("button", { name: /download excel/i });
  await downloadBtn.waitFor({ timeout: 10_000 });
  await expect(downloadBtn).toBeEnabled();
  await downloadBtn.click();

  // Wait for the Export Date Range dialog to appear.
  await page.waitForSelector('text=Export Date Range', { timeout: 10_000 });

  // The dialog defaults are already set (Jan → current month). Click "Export Excel".
  const [download] = await Promise.all([
    context.waitForEvent("download", { timeout: 45_000 }),
    page.getByRole("button", { name: /export excel/i }).click(),
  ]);

  // ── 4. Filename ───────────────────────────────────────────────────────────
  expect(download.suggestedFilename()).toBe(expectedFilename);

  // ── 5. Save and parse the downloaded file with ExcelJS ───────────────────
  const tmpPath = path.join(os.tmpdir(), `accounts-report-e2e.xlsx`);
  await download.saveAs(tmpPath);
  expect(fs.existsSync(tmpPath)).toBe(true);
  expect(fs.statSync(tmpPath).size).toBeGreaterThan(0);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tmpPath);

  // ── 6. Sheet count and names ──────────────────────────────────────────────
  expect(wb.worksheets).toHaveLength(3);
  expect(wb.worksheets[0].name).toBe(`P&L ${rangeLabel}`);
  expect(wb.worksheets[1].name).toBe("Expense Breakdown");
  expect(wb.worksheets[2].name).toBe("Trust Balances");

  // ── 7. Per-sheet structural assertions ───────────────────────────────────
  for (const ws of wb.worksheets) {
    // Freeze pane
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const view = ws.views[0] as any;
    expect(view?.ySplit, `${ws.name}: ySplit`).toBe(1);
    expect(view?.state, `${ws.name}: freeze state`).toBe("frozen");

    // Header row: bold, white text, dark blue fill
    const h = ws.getRow(1);
    expect(h.font?.bold, `${ws.name}: header bold`).toBe(true);
    expect(h.font?.color?.argb, `${ws.name}: header text color`).toBe("FFFFFFFF");
    expect(
      (h.fill as { fgColor?: { argb?: string } })?.fgColor?.argb,
      `${ws.name}: header bg`,
    ).toBe("FF002147");

    // Totals row: bold
    const last = ws.getRow(ws.rowCount);
    expect(last.font?.bold, `${ws.name}: totals bold`).toBe(true);

    // Column widths
    expect(ws.columnCount, `${ws.name}: has columns`).toBeGreaterThan(0);
    for (let c = 1; c <= ws.columnCount; c++) {
      expect(ws.getColumn(c).width ?? 0, `${ws.name} col ${c}: width`).toBeGreaterThan(0);
    }
  }

  // ── 8. P&L sheet: data rows and totals match API ──────────────────────────
  const plWs = wb.worksheets[0];
  // Row 1 = header; last = TOTAL; middle = monthly data
  expect(plWs.rowCount - 2).toBe(plResp.pl.length);
  const plTotalsRow = plWs.getRow(plWs.rowCount);
  expect(Number(plTotalsRow.getCell(2).value)).toBeCloseTo(plResp.totalIncome, 1);
  expect(Number(plTotalsRow.getCell(3).value)).toBeCloseTo(plResp.totalExpense, 1);
  expect(Number(plTotalsRow.getCell(4).value)).toBeCloseTo(plResp.netProfit, 1);

  // ── 9. Expense Breakdown sheet: grand total matches API ───────────────────
  const expWs = wb.worksheets[1];
  const expTotalsRow = expWs.getRow(expWs.rowCount);
  expect(Number(expTotalsRow.getCell(2).value)).toBeCloseTo(expResp.grandTotal, 1);

  // ── 10. Trust Balances sheet: total trust matches API ─────────────────────
  const trustWs = wb.worksheets[2];
  const trustTotalsRow = trustWs.getRow(trustWs.rowCount);
  expect(Number(trustTotalsRow.getCell(3).value)).toBeCloseTo(trustResp.totalBalance, 1);

  // ── 11. No error toast ────────────────────────────────────────────────────
  await page.waitForTimeout(1_000);
  const toasts = page.locator('[data-variant="destructive"]');
  const toastCount = await toasts.count();
  if (toastCount > 0) {
    const txt = await toasts.first().textContent();
    expect(txt).not.toContain("Excel export failed");
  }

  // Cleanup temp file
  fs.unlinkSync(tmpPath);
});
