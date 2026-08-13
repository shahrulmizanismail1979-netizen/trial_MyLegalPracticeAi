/**
 * MyLawFirmAi — Accounts module routes
 * Mounted under /accounts (within the firm session gate).
 *
 * Implements:
 *   - Office account: income & expense entries, running ledger
 *   - Client trust ledger: per-client ledgers, hard no-negative guard
 *   - Voucher PDFs: OR / PV / JV printable
 *   - Reports: P&L, expense breakdown, trust balances, cashflow, PDF export
 *
 * All routes require a valid manager session (requireManagerSession).
 */
import { Router, type IRouter } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import { z } from "zod/v4";
import PDFDocument from "pdfkit";
import {
  db,
  officeEntriesTable,
  clientLedgersTable,
  clientEntriesTable,
} from "../db";
import { requireManagerSession } from "../lib/managerSession";

// ── Boot-time schema ───────────────────────────────────────────────────────────

export async function ensureAccountsTables(): Promise<void> {
  // All monetary amounts are stored as integer sen (1 sen = 1/100 RM) to avoid
  // IEEE-754 double-precision errors in comparisons, aggregations, and arithmetic.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS firm_accounts_office_entries (
      id          serial PRIMARY KEY,
      type        text NOT NULL CHECK (type IN ('income','expense')),
      category    text NOT NULL,
      description text NOT NULL,
      amount      bigint NOT NULL CHECK (amount > 0),
      entry_date  text NOT NULL,
      reference   text,
      created_by  integer REFERENCES firm_users(id),
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS firm_acc_office_date_idx ON firm_accounts_office_entries(entry_date)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS firm_acc_office_type_idx ON firm_accounts_office_entries(type)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS firm_accounts_client_ledgers (
      id           serial PRIMARY KEY,
      client_name  text NOT NULL,
      matter_ref   text,
      balance      bigint NOT NULL DEFAULT 0,
      notes        text,
      created_by   integer REFERENCES firm_users(id),
      created_at   timestamptz NOT NULL DEFAULT now(),
      updated_at   timestamptz NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS firm_accounts_client_entries (
      id          serial PRIMARY KEY,
      ledger_id   integer NOT NULL REFERENCES firm_accounts_client_ledgers(id) ON DELETE CASCADE,
      type        text NOT NULL CHECK (type IN ('deposit','disbursement','transfer_to_office')),
      description text NOT NULL,
      amount      bigint NOT NULL CHECK (amount > 0),
      entry_date  text NOT NULL,
      reference   text,
      created_by  integer REFERENCES firm_users(id),
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS firm_acc_client_ledger_idx ON firm_accounts_client_entries(ledger_id)`);

  // ── Expense budgets ────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS firm_accounts_budgets (
      id          serial PRIMARY KEY,
      year        integer NOT NULL,
      month       integer NOT NULL CHECK (month >= 1 AND month <= 12),
      category    text NOT NULL,
      budget_sen  bigint NOT NULL CHECK (budget_sen >= 0),
      created_by  integer REFERENCES firm_users(id),
      updated_at  timestamptz NOT NULL DEFAULT now(),
      UNIQUE (year, month, category)
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS firm_acc_budgets_ym_idx ON firm_accounts_budgets(year, month)`);

  // ── Migration: convert existing double-precision columns to bigint sen ─────
  // Safe because the tables are new (no user-visible history yet) and float
  // values like 5000.0 map cleanly to 500000 sen. This runs at every boot but
  // is a no-op once columns are already bigint.
  await db.execute(sql`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'firm_accounts_office_entries'
          AND column_name = 'amount'
          AND data_type IN ('double precision','real','numeric')
      ) THEN
        ALTER TABLE firm_accounts_office_entries
          ALTER COLUMN amount TYPE bigint
            USING ROUND(amount * 100)::bigint;
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'firm_accounts_client_ledgers'
          AND column_name = 'balance'
          AND data_type IN ('double precision','real','numeric')
      ) THEN
        ALTER TABLE firm_accounts_client_ledgers
          ALTER COLUMN balance TYPE bigint
            USING ROUND(balance * 100)::bigint;
      END IF;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'firm_accounts_client_entries'
          AND column_name = 'amount'
          AND data_type IN ('double precision','real','numeric')
      ) THEN
        ALTER TABLE firm_accounts_client_entries
          ALTER COLUMN amount TYPE bigint
            USING ROUND(amount * 100)::bigint;
      END IF;
    END $$
  `);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function requireMgr(
  req: import("express").Request,
  res: import("express").Response,
): Promise<number | null> {
  const uid = await requireManagerSession(req);
  if (uid == null) {
    res.status(403).json({ error: "Manager authentication required." });
    return null;
  }
  return uid;
}

function paramInt(raw: string | string[] | undefined): number {
  const s = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return parseInt(s, 10);
}

/** Convert RM (from user input) → sen for storage. */
const rmToSen = (rm: number): number => Math.round(rm * 100);
/** Convert sen (from DB) → RM for API responses. */
const senToRm = (sen: number): number => sen / 100;
/** Format a sen amount as "RM X.XX" for error messages. */
const MYR = (sen: number) => `RM ${(sen / 100).toFixed(2)}`;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Map DB office entry: convert amount sen → RM for response. */
const officeRm = (e: typeof officeEntriesTable.$inferSelect) => ({
  ...e, amount: senToRm(e.amount),
});
/** Map DB client entry: convert amount sen → RM for response. */
const clientRm = (e: typeof clientEntriesTable.$inferSelect) => ({
  ...e, amount: senToRm(e.amount),
});
/** Map DB client ledger: convert balance sen → RM for response. */
const ledgerRm = (l: typeof clientLedgersTable.$inferSelect) => ({
  ...l, balance: senToRm(l.balance),
});

// ── Zod schemas ────────────────────────────────────────────────────────────────

const OFFICE_INCOME_CATEGORIES = [
  "professional_fees","consultation_fees","court_fees_recovered",
  "disbursements_recovered","interest_income","client_trust_transfer","other_income",
] as const;

const OFFICE_EXPENSE_CATEGORIES = [
  "salary_expense","rent_expense","utilities","telephone","legal_publications",
  "court_filing_fees","professional_indemnity","transportation","entertainment",
  "advertising","office_supplies","miscellaneous",
] as const;

const OfficeEntryBody = z.object({
  type:        z.enum(["income","expense"]),
  category:    z.string().min(1).max(80),
  description: z.string().min(1).max(500),
  amount:      z.number().positive(),
  entryDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference:   z.string().max(100).optional(),
});

const ClientLedgerBody = z.object({
  clientName: z.string().min(1).max(200),
  matterRef:  z.string().max(100).optional(),
  notes:      z.string().max(500).optional(),
});

const ClientEntryBody = z.object({
  type:        z.enum(["deposit","disbursement","transfer_to_office"]),
  description: z.string().min(1).max(500),
  amount:      z.number().positive(),
  entryDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference:   z.string().max(100).optional(),
});

const BudgetUpsertBody = z.object({
  year:     z.number().int().min(2000).max(2100),
  month:    z.number().int().min(1).max(12),
  category: z.string().min(1).max(80),
  budget:   z.number().min(0),  // RM — 0 means "remove / no limit"
});

// ── Router ─────────────────────────────────────────────────────────────────────

const router: IRouter = Router();

// ══════════════════════════════════════════════════════════════════════════════
// EXPENSE BUDGETS
// ══════════════════════════════════════════════════════════════════════════════

/** GET /accounts/budgets?year=&month= — return all budgets for a month/year */
router.get("/accounts/budgets", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const now   = new Date();
  const year  = parseInt(String(req.query.year  ?? now.getFullYear()), 10);
  const month = parseInt(String(req.query.month ?? now.getMonth() + 1), 10);
  if (Number.isNaN(year) || Number.isNaN(month)) {
    res.status(400).json({ error: "Invalid year or month" });
    return;
  }
  const rows = await db.execute(sql`
    SELECT category, budget_sen FROM firm_accounts_budgets
    WHERE year = ${year} AND month = ${month}
  `);
  const budgets: Record<string, number> = {};
  for (const r of (rows as unknown as { rows: { category: string; budget_sen: string }[] }).rows) {
    budgets[r.category] = senToRm(parseInt(r.budget_sen, 10) || 0);
  }
  res.json({ year, month, budgets });
});

/** PUT /accounts/budgets — upsert a single category budget */
router.put("/accounts/budgets", async (req, res): Promise<void> => {
  const uid = await requireMgr(req, res);
  if (uid == null) return;
  const b = BudgetUpsertBody.safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: b.error.message }); return; }
  const { year, month, category, budget } = b.data;
  const budgetSen = rmToSen(budget);

  if (budgetSen === 0) {
    await db.execute(sql`
      DELETE FROM firm_accounts_budgets
      WHERE year = ${year} AND month = ${month} AND category = ${category}
    `);
  } else {
    await db.execute(sql`
      INSERT INTO firm_accounts_budgets (year, month, category, budget_sen, created_by, updated_at)
      VALUES (${year}, ${month}, ${category}, ${budgetSen}, ${uid}, now())
      ON CONFLICT (year, month, category)
      DO UPDATE SET budget_sen = EXCLUDED.budget_sen, updated_at = now()
    `);
  }
  res.json({ year, month, category, budget });
});

// ══════════════════════════════════════════════════════════════════════════════
// OFFICE ACCOUNT
// ══════════════════════════════════════════════════════════════════════════════

/** GET /accounts/office/entries?month=&year= */
router.get("/accounts/office/entries", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const now   = new Date();
  const month = String(parseInt(String(req.query.month ?? now.getMonth() + 1), 10)).padStart(2, "0");
  const year  = String(req.query.year ?? now.getFullYear());
  const prefix = `${year}-${month}`;
  const rawEntries = await db
    .select()
    .from(officeEntriesTable)
    .where(sql`entry_date LIKE ${prefix + "-%"}`)
    .orderBy(desc(officeEntriesTable.entryDate), desc(officeEntriesTable.id));
  const entries = rawEntries.map(officeRm);
  // Totals computed in sen first (exact integer) then converted to RM.
  const totalIncomeSen  = rawEntries.filter(e => e.type === "income").reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalExpenseSen = rawEntries.filter(e => e.type === "expense").reduce((s, e) => s + (e.amount ?? 0), 0);
  res.json({
    entries,
    totalIncome:  senToRm(totalIncomeSen),
    totalExpense: senToRm(totalExpenseSen),
    net:          senToRm(totalIncomeSen - totalExpenseSen),
  });
});

/** POST /accounts/office/entries */
router.post("/accounts/office/entries", async (req, res): Promise<void> => {
  const uid = await requireMgr(req, res);
  if (uid == null) return;
  const b = OfficeEntryBody.safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: b.error.message }); return; }
  const [row] = await db
    .insert(officeEntriesTable)
    .values({
      type:        b.data.type,
      category:    b.data.category,
      description: b.data.description,
      amount:      rmToSen(b.data.amount),  // store as integer sen
      entryDate:   b.data.entryDate,
      reference:   b.data.reference ?? null,
      createdBy:   uid,
    })
    .returning();
  res.status(201).json(officeRm(row));
});

/** DELETE /accounts/office/entries/:id
 *
 * Transfer-generated entries (reference = "JV-CA-XXXXXX") are immutable:
 * deleting one leg of a double-entry would leave the client ledger debited
 * without a matching office credit, violating the Solicitors' Account Rules.
 * Those entries can only be reversed by posting an equal-and-opposite manual
 * correction entry; the UI shows this error so the manager knows why.
 */
router.delete("/accounts/office/entries/:id", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const id = paramInt(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [entry] = await db.select().from(officeEntriesTable).where(eq(officeEntriesTable.id, id));
  if (!entry) { res.status(404).json({ error: "Entry not found." }); return; }
  if (entry.reference?.startsWith("JV-CA-")) {
    res.status(409).json({
      error: "This entry was automatically generated by a client trust transfer and cannot be deleted directly. Post a correction entry to reverse it.",
      code: "IMMUTABLE_JV_ENTRY",
    });
    return;
  }
  await db.delete(officeEntriesTable).where(eq(officeEntriesTable.id, id));
  res.json({ deleted: true, id });
});

/** GET /accounts/office/categories — predefined category lists */
router.get("/accounts/office/categories", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  res.json({ income: OFFICE_INCOME_CATEGORIES, expense: OFFICE_EXPENSE_CATEGORIES });
});

// ══════════════════════════════════════════════════════════════════════════════
// CLIENT TRUST LEDGERS
// ══════════════════════════════════════════════════════════════════════════════

/** GET /accounts/client/ledgers */
router.get("/accounts/client/ledgers", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const rawLedgers = await db.select().from(clientLedgersTable).orderBy(desc(clientLedgersTable.updatedAt));
  res.json({ ledgers: rawLedgers.map(ledgerRm) });
});

/** POST /accounts/client/ledgers */
router.post("/accounts/client/ledgers", async (req, res): Promise<void> => {
  const uid = await requireMgr(req, res);
  if (uid == null) return;
  const b = ClientLedgerBody.safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: b.error.message }); return; }
  const [row] = await db
    .insert(clientLedgersTable)
    .values({ clientName: b.data.clientName, matterRef: b.data.matterRef ?? null, notes: b.data.notes ?? null, createdBy: uid, balance: 0 })
    .returning();
  res.status(201).json(row);
});

/** GET /accounts/client/ledgers/:id */
router.get("/accounts/client/ledgers/:id", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const id = paramInt(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [ledger] = await db.select().from(clientLedgersTable).where(eq(clientLedgersTable.id, id));
  if (!ledger) { res.status(404).json({ error: "Client ledger not found." }); return; }
  const rawEntries = await db
    .select()
    .from(clientEntriesTable)
    .where(eq(clientEntriesTable.ledgerId, id))
    .orderBy(desc(clientEntriesTable.entryDate), desc(clientEntriesTable.id));
  res.json({ ledger: ledgerRm(ledger), entries: rawEntries.map(clientRm) });
});

/** POST /accounts/client/ledgers/:id/entries — with no-negative guard */
router.post("/accounts/client/ledgers/:id/entries", async (req, res): Promise<void> => {
  const uid = await requireMgr(req, res);
  if (uid == null) return;
  const ledgerId = paramInt(req.params.id);
  if (Number.isNaN(ledgerId)) { res.status(400).json({ error: "Invalid ledger id" }); return; }
  const b = ClientEntryBody.safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: b.error.message }); return; }
  const { type } = b.data;
  const amountSen = rmToSen(b.data.amount);  // convert RM → sen for all arithmetic
  const isDebit = type === "disbursement" || type === "transfer_to_office";

  let entry: typeof clientEntriesTable.$inferSelect | null = null;
  let ledgerBalanceSen = 0;

  try {
    await db.transaction(async (tx) => {
      // Lock the ledger row to prevent concurrent overdraft.
      const locked = await tx.execute(sql`
        SELECT balance FROM firm_accounts_client_ledgers
        WHERE id = ${ledgerId} FOR UPDATE
      `);
      const row = (locked as unknown as { rows: { balance: string | number }[] }).rows[0];
      if (!row) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });

      // PostgreSQL bigint comes back as string from the pg driver.
      ledgerBalanceSen = typeof row.balance === "string"
        ? parseInt(row.balance, 10)
        : (row.balance as number);

      if (isDebit && ledgerBalanceSen < amountSen) {
        throw Object.assign(
          new Error("INSUFFICIENT_BALANCE"),
          { code: "INSUFFICIENT_BALANCE", availableSen: ledgerBalanceSen },
        );
      }

      const deltaSen    = isDebit ? -amountSen : amountSen;
      const newBalanceSen = ledgerBalanceSen + deltaSen;

      const [e] = await tx
        .insert(clientEntriesTable)
        .values({
          ledgerId,
          type:        b.data.type,
          description: b.data.description,
          amount:      amountSen,           // stored as integer sen
          entryDate:   b.data.entryDate,
          reference:   b.data.reference ?? null,
          createdBy:   uid,
        })
        .returning();
      entry = e;

      await tx
        .update(clientLedgersTable)
        .set({ balance: newBalanceSen, updatedAt: new Date() })
        .where(eq(clientLedgersTable.id, ledgerId));

      ledgerBalanceSen = newBalanceSen;

      // Double-entry: a trust→office transfer must also create a matching
      // income entry in the office ledger so the office P&L and cashflow
      // reports reflect the funds received. Both sides are written atomically
      // in this same transaction; the JV voucher ref ties them together for
      // auditability.
      if (b.data.type === "transfer_to_office" && e) {
        const jvRef = `JV-CA-${String(e.id).padStart(6, "0")}`;
        await tx.insert(officeEntriesTable).values({
          type:        "income",
          category:    "client_trust_transfer",
          description: `Trust transfer from client account — ${b.data.description}`,
          amount:      amountSen,           // same sen amount
          entryDate:   b.data.entryDate,
          reference:   jvRef,
          createdBy:   uid,
        });
      }
    });
  } catch (err: unknown) {
    const e = err as { code?: string; availableSen?: number };
    if (e?.code === "NOT_FOUND") {
      res.status(404).json({ error: "Client ledger not found." });
      return;
    }
    if (e?.code === "INSUFFICIENT_BALANCE") {
      res.status(422).json({
        error: `Insufficient client balance. Available: ${MYR(e.availableSen ?? 0)}.`,
        available: senToRm(e.availableSen ?? 0),
      });
      return;
    }
    throw err;
  }

  res.status(201).json({ entry: entry ? clientRm(entry) : null, newBalance: senToRm(ledgerBalanceSen) });
});

// ══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Generate all YYYY-MM keys between two YYYY-MM strings (inclusive).
 */
function monthsInRange(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const keys: string[] = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return keys;
}

/** Validate & normalise a YYYY-MM query param. Returns null if invalid. */
function parseYM(raw: string | string[] | undefined): string | null {
  const s = Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
  return /^\d{4}-\d{2}$/.test(s) ? s : null;
}

/** GET /accounts/reports/pl?year=&from=YYYY-MM&to=YYYY-MM
 *  `from`/`to` take priority; `year` is the fallback (full calendar year). */
router.get("/accounts/reports/pl", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;

  const fromParam = parseYM(req.query.from as string | undefined);
  const toParam   = parseYM(req.query.to   as string | undefined);

  let fromYM: string;
  let toYM:   string;

  if (fromParam && toParam && fromParam <= toParam) {
    fromYM = fromParam;
    toYM   = toParam;
  } else {
    const year = String(req.query.year ?? new Date().getFullYear());
    fromYM = `${year}-01`;
    toYM   = `${year}-12`;
  }

  const rows = await db.execute(sql`
    SELECT
      SUBSTRING(entry_date, 1, 7) AS month,
      type,
      SUM(amount) AS total
    FROM firm_accounts_office_entries
    WHERE entry_date >= ${fromYM + "-01"}
      AND SUBSTRING(entry_date, 1, 7) <= ${toYM}
    GROUP BY month, type
    ORDER BY month
  `);

  const monthKeys = monthsInRange(fromYM, toYM);
  const bySen: Record<string, { income: number; expense: number }> = {};
  for (const k of monthKeys) bySen[k] = { income: 0, expense: 0 };

  for (const r of (rows as unknown as { rows: { month: string; type: string; total: string }[] }).rows) {
    const slot = bySen[r.month];
    if (!slot) continue;
    const amtSen = parseInt(r.total, 10) || 0;
    if (r.type === "income") slot.income += amtSen;
    else slot.expense += amtSen;
  }

  const pl = Object.entries(bySen).map(([month, v]) => ({
    month,
    income:  senToRm(v.income),
    expense: senToRm(v.expense),
    net:     senToRm(v.income - v.expense),
  }));
  const totalIncomeSen  = Object.values(bySen).reduce((s, v) => s + v.income, 0);
  const totalExpenseSen = Object.values(bySen).reduce((s, v) => s + v.expense, 0);
  res.json({
    from: fromYM, to: toYM,
    // keep `year` for backward compat when a full year is requested
    year: fromYM.slice(0, 4),
    pl,
    totalIncome:  senToRm(totalIncomeSen),
    totalExpense: senToRm(totalExpenseSen),
    netProfit:    senToRm(totalIncomeSen - totalExpenseSen),
  });
});

/** GET /accounts/reports/expenses?year=&month=&from=YYYY-MM&to=YYYY-MM
 *  `from`/`to` take priority; `year`+`month` (or just `year`) is the fallback. */
router.get("/accounts/reports/expenses", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;

  const fromParam = parseYM(req.query.from as string | undefined);
  const toParam   = parseYM(req.query.to   as string | undefined);

  let whereClause: ReturnType<typeof sql>;

  if (fromParam && toParam && fromParam <= toParam) {
    whereClause = sql`entry_date >= ${fromParam + "-01"} AND SUBSTRING(entry_date, 1, 7) <= ${toParam}`;
  } else {
    const year  = String(req.query.year ?? new Date().getFullYear());
    const month = req.query.month ? String(req.query.month).padStart(2, "0") : null;
    const prefix = month ? `${year}-${month}` : year;
    whereClause = sql`entry_date LIKE ${prefix + "%"}`;
  }

  const rows = await db.execute(sql`
    SELECT category, SUM(amount) AS total
    FROM firm_accounts_office_entries
    WHERE type = 'expense'
      AND ${whereClause}
    GROUP BY category
    ORDER BY total DESC
  `);
  const breakdown = (rows as unknown as { rows: { category: string; total: string }[] }).rows.map(r => ({
    category:   r.category,
    total:      senToRm(parseInt(r.total, 10) || 0),
    budget:     null as number | null,
    overBudget: false,
  }));

  // Attach budgets when a single month is selected
  const singleMonth = fromParam && toParam && fromParam === toParam
    ? fromParam                                          // "YYYY-MM" from range params
    : (!fromParam && req.query.month)                   // legacy ?year=&month= form
      ? `${req.query.year ?? new Date().getFullYear()}-${String(req.query.month).padStart(2, "0")}`
      : null;

  if (singleMonth) {
    const [ymYear, ymMonth] = singleMonth.split("-").map(Number);
    const budgetRows = await db.execute(sql`
      SELECT category, budget_sen FROM firm_accounts_budgets
      WHERE year = ${ymYear} AND month = ${ymMonth}
    `);
    const budgetMap: Record<string, number> = {};
    for (const r of (budgetRows as unknown as { rows: { category: string; budget_sen: string }[] }).rows) {
      budgetMap[r.category] = senToRm(parseInt(r.budget_sen, 10) || 0);
    }
    for (const item of breakdown) {
      if (budgetMap[item.category] != null) {
        item.budget     = budgetMap[item.category]!;
        item.overBudget = item.total > item.budget;
      }
    }
  }

  const grandTotal = breakdown.reduce((s, v) => s + v.total, 0);
  res.json({ breakdown, grandTotal });
});

/** GET /accounts/reports/trust — all client ledger balances */
router.get("/accounts/reports/trust", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const rawLedgers2 = await db.select().from(clientLedgersTable).orderBy(desc(clientLedgersTable.balance));
  const totalBalanceSen = rawLedgers2.reduce((s, l) => s + (l.balance ?? 0), 0);
  res.json({ ledgers: rawLedgers2.map(ledgerRm), totalBalance: senToRm(totalBalanceSen) });
});

/** GET /accounts/reports/cashflow?months=12 — last N months net cashflow */
router.get("/accounts/reports/cashflow", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const months = Math.min(parseInt(String(req.query.months ?? "12"), 10) || 12, 36);
  const rows = await db.execute(sql`
    SELECT
      SUBSTRING(entry_date, 1, 7) AS month,
      type,
      SUM(amount) AS total
    FROM firm_accounts_office_entries
    WHERE entry_date >= to_char(NOW() - INTERVAL '1 month' * ${months}, 'YYYY-MM') || '-01'
    GROUP BY month, type
    ORDER BY month
  `);
  // Accumulate in integer sen, convert to RM at the end.
  const bySenCf: Record<string, { month: string; income: number; expense: number }> = {};
  for (const r of (rows as unknown as { rows: { month: string; type: string; total: string }[] }).rows) {
    if (!bySenCf[r.month]) bySenCf[r.month] = { month: r.month, income: 0, expense: 0 };
    const amtSen = parseInt(r.total, 10) || 0;
    if (r.type === "income") bySenCf[r.month].income += amtSen;
    else bySenCf[r.month].expense += amtSen;
  }
  let cumulativeSen = 0;
  const cashflow = Object.values(bySenCf).map(v => {
    const netSen = v.income - v.expense;
    cumulativeSen += netSen;
    return {
      month:      v.month,
      income:     senToRm(v.income),
      expense:    senToRm(v.expense),
      net:        senToRm(netSen),
      cumulative: senToRm(cumulativeSen),
    };
  });
  res.json({ cashflow });
});

// ══════════════════════════════════════════════════════════════════════════════
// VOUCHER PDF
// ══════════════════════════════════════════════════════════════════════════════

/** GET /accounts/voucher/office/:id/pdf — office entry voucher */
router.get("/accounts/voucher/office/:id/pdf", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const id = paramInt(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [entry] = await db.select().from(officeEntriesTable).where(eq(officeEntriesTable.id, id));
  if (!entry) { res.status(404).json({ error: "Entry not found." }); return; }

  const voucherType = entry.type === "income" ? "OFFICIAL RECEIPT" : "PAYMENT VOUCHER";
  const voucherRef  = `${entry.type === "income" ? "OR" : "PV"}-${String(entry.id).padStart(6,"0")}`;

  const buf = await generateVoucherPDF({
    voucherType, voucherRef,
    date:        entry.entryDate,
    description: entry.description,
    category:    entry.category,
    reference:   entry.reference ?? undefined,
    amount:      senToRm(entry.amount),   // PDF helper expects RM
    isCredit:    entry.type === "income",
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${voucherRef}.pdf"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(buf);
});

/** GET /accounts/voucher/client/:id/pdf — client trust entry voucher */
router.get("/accounts/voucher/client/:id/pdf", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const id = paramInt(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [entry] = await db.select().from(clientEntriesTable).where(eq(clientEntriesTable.id, id));
  if (!entry) { res.status(404).json({ error: "Entry not found." }); return; }
  const [ledger] = await db.select().from(clientLedgersTable).where(eq(clientLedgersTable.id, entry.ledgerId));

  const voucherTypeMap: Record<string, string> = {
    deposit:            "OFFICIAL RECEIPT (CLIENT ACCOUNT)",
    disbursement:       "PAYMENT VOUCHER (CLIENT ACCOUNT)",
    transfer_to_office: "JOURNAL VOUCHER (TRANSFER)",
  };
  const prefixMap: Record<string, string> = { deposit: "OR-CA", disbursement: "PV-CA", transfer_to_office: "JV-CA" };
  const voucherType = voucherTypeMap[entry.type] ?? "VOUCHER";
  const voucherRef  = `${prefixMap[entry.type] ?? "VR"}-${String(entry.id).padStart(6,"0")}`;
  const isCredit    = entry.type === "deposit";

  const buf = await generateVoucherPDF({
    voucherType, voucherRef,
    date:        entry.entryDate,
    description: entry.description,
    category:    `Client Account — ${entry.type.replace(/_/g," ")}`,
    reference:   entry.reference ?? undefined,
    amount:      senToRm(entry.amount),   // PDF helper expects RM
    isCredit,
    clientName:  ledger?.clientName,
    matterRef:   ledger?.matterRef ?? undefined,
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${voucherRef}.pdf"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(buf);
});

/** GET /accounts/reports/expenses/pdf?year=&month= — expense breakdown PDF */
router.get("/accounts/reports/expenses/pdf", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const year  = String(req.query.year ?? new Date().getFullYear());
  const month = req.query.month ? String(req.query.month).padStart(2, "0") : null;
  const prefix = month ? `${year}-${month}` : year;
  const rows = await db.execute(sql`
    SELECT category, SUM(amount) AS total
    FROM firm_accounts_office_entries
    WHERE type = 'expense' AND entry_date LIKE ${prefix + "%"}
    GROUP BY category ORDER BY total DESC
  `);
  const breakdown = (rows as unknown as { rows: { category: string; total: string }[] }).rows.map(r => ({
    category: r.category, total: senToRm(parseInt(r.total, 10) || 0),
  }));
  const grandTotal = breakdown.reduce((s, v) => s + v.total, 0);
  const label = month ? `${MONTHS[parseInt(month) - 1]} ${year}` : String(year);
  const buf = await generateExpensesPDF({ label, breakdown, grandTotal });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="expenses-${prefix}.pdf"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(buf);
});

/** GET /accounts/reports/trust/pdf — trust balances PDF */
router.get("/accounts/reports/trust/pdf", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const rawL = await db.select().from(clientLedgersTable).orderBy(desc(clientLedgersTable.balance));
  const totalBalanceSen2 = rawL.reduce((s, l) => s + (l.balance ?? 0), 0);
  const buf = await generateTrustPDF({
    ledgers:      rawL.map(ledgerRm),
    totalBalance: senToRm(totalBalanceSen2),
  });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="trust-balances-${new Date().toISOString().slice(0,10)}.pdf"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(buf);
});

/** GET /accounts/reports/cashflow/pdf?months= — cashflow PDF */
router.get("/accounts/reports/cashflow/pdf", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const months = Math.min(parseInt(String(req.query.months ?? "12"), 10) || 12, 36);
  const rows = await db.execute(sql`
    SELECT SUBSTRING(entry_date, 1, 7) AS month, type, SUM(amount) AS total
    FROM firm_accounts_office_entries
    WHERE entry_date >= to_char(NOW() - INTERVAL '1 month' * ${months}, 'YYYY-MM') || '-01'
    GROUP BY month, type ORDER BY month
  `);
  const bySenPdf: Record<string, { month: string; income: number; expense: number }> = {};
  for (const r of (rows as unknown as { rows: { month: string; type: string; total: string }[] }).rows) {
    if (!bySenPdf[r.month]) bySenPdf[r.month] = { month: r.month, income: 0, expense: 0 };
    const amtSen = parseInt(r.total, 10) || 0;
    if (r.type === "income") bySenPdf[r.month].income += amtSen;
    else bySenPdf[r.month].expense += amtSen;
  }
  let cumulativeSen2 = 0;
  const cashflow = Object.values(bySenPdf).map(v => {
    const netSen = v.income - v.expense;
    cumulativeSen2 += netSen;
    return {
      month:      v.month,
      income:     senToRm(v.income),
      expense:    senToRm(v.expense),
      net:        senToRm(netSen),
      cumulative: senToRm(cumulativeSen2),
    };
  });
  const buf = await generateCashflowPDF({ cashflow, months });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="cashflow-${months}m.pdf"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(buf);
});

/** GET /accounts/reports/pl/pdf?year= — P&L report PDF */
router.get("/accounts/reports/pl/pdf", async (req, res): Promise<void> => {
  if (await requireMgr(req, res) == null) return;
  const year = String(req.query.year ?? new Date().getFullYear());

  // Fetch the same P&L data
  const rows = await db.execute(sql`
    SELECT SUBSTRING(entry_date,1,7) AS month, type, SUM(amount) AS total
    FROM firm_accounts_office_entries
    WHERE entry_date LIKE ${year + "-%"}
    GROUP BY month, type ORDER BY month
  `);
  const byMonthSen: Record<string, { income: number; expense: number }> = {};
  for (let m = 1; m <= 12; m++) byMonthSen[`${year}-${String(m).padStart(2,"0")}`] = { income: 0, expense: 0 };
  for (const r of (rows as unknown as { rows: { month: string; type: string; total: string }[] }).rows) {
    if (!byMonthSen[r.month]) continue;
    const amtSen = parseInt(r.total, 10) || 0;  // bigint sen from DB
    if (r.type === "income") byMonthSen[r.month].income += amtSen;
    else byMonthSen[r.month].expense += amtSen;
  }
  const pl = Object.entries(byMonthSen).map(([month, v]) => ({
    month, income: senToRm(v.income), expense: senToRm(v.expense), net: senToRm(v.income - v.expense),
  }));
  const totalIncome  = pl.reduce((s, v) => s + v.income, 0);
  const totalExpense = pl.reduce((s, v) => s + v.expense, 0);

  const buf = await generatePlPDF({ year, pl, totalIncome, totalExpense });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="pl-report-${year}.pdf"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(buf);
});

// ── PDF helpers ────────────────────────────────────────────────────────────────

interface VoucherData {
  voucherType: string;
  voucherRef:  string;
  date:        string;
  description: string;
  category:    string;
  reference?:  string;
  amount:      number;
  isCredit:    boolean;
  clientName?: string;
  matterRef?:  string;
}

function generateVoucherPDF(data: VoucherData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A5", margin: 40 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fw = doc.page.width - 80;
    const accentColor = "#1a3a5c";
    const lineGray    = "#e0e0e0";

    // Header band
    doc.rect(40, 40, fw, 50).fill(accentColor);
    doc.fillColor("#ffffff").fontSize(13).font("Helvetica-Bold").text("MyLawFirmAi", 52, 50);
    doc.fillColor("#c8d8e8").fontSize(8).font("Helvetica").text(data.voucherType, 52, 66);
    doc.fillColor("#ffffff").fontSize(9).font("Helvetica-Bold").text(data.voucherRef, 40, 60, { align: "right", width: fw });

    const y0 = 108;
    const rowH = 22;
    const labelW = 100;

    const field = (label: string, value: string, y: number) => {
      doc.fillColor("#555").fontSize(8).font("Helvetica").text(label, 40, y, { width: labelW });
      doc.fillColor("#111").fontSize(9).font("Helvetica-Bold").text(value, 148, y, { width: fw - labelW - 8 });
      doc.moveTo(40, y + rowH - 2).lineTo(40 + fw, y + rowH - 2).strokeColor(lineGray).lineWidth(0.5).stroke();
    };

    field("Date",        data.date,        y0);
    field("Category",    data.category.replace(/_/g," ").replace(/\b\w/g, c => c.toUpperCase()), y0 + rowH);
    field("Description", data.description, y0 + rowH * 2);
    if (data.clientName) field("Client", data.clientName, y0 + rowH * 3);
    if (data.matterRef)  field("Matter Ref", data.matterRef, y0 + rowH * 4);
    if (data.reference)  field("Reference", data.reference, y0 + rowH * (data.clientName ? 5 : 3));

    // Amount box
    const amtY = y0 + rowH * 7;
    doc.rect(40, amtY, fw, 38).fillColor(data.isCredit ? "#e8f5e9" : "#fff3e0").stroke();
    doc.fillColor(data.isCredit ? "#2e7d32" : "#b71c1c").fontSize(11).font("Helvetica-Bold")
      .text(data.isCredit ? "RECEIVED /" : "PAID /", 52, amtY + 6)
      .text(data.isCredit ? "DITERIMA" : "DIBAYAR", 52, amtY + 18);
    doc.fillColor("#111").fontSize(18).font("Helvetica-Bold")
      .text(`RM ${data.amount.toFixed(2)}`, 40, amtY + 10, { align: "right", width: fw - 12 });

    // Signature line
    const sigY = amtY + 55;
    doc.moveTo(40, sigY).lineTo(160, sigY).strokeColor("#555").lineWidth(0.5).stroke();
    doc.fillColor("#777").fontSize(7).font("Helvetica").text("Authorised Signature / Tandatangan", 40, sigY + 4);

    doc.moveTo(fw - 60, sigY).lineTo(fw + 40, sigY).strokeColor("#555").lineWidth(0.5).stroke();
    doc.fillColor("#777").fontSize(7).font("Helvetica").text("Received by / Diterima oleh", fw - 60, sigY + 4);

    doc.fillColor("#999").fontSize(6).text(`Generated by MyLawFirmAi · ${new Date().toLocaleDateString("en-MY")}`, 40, doc.page.height - 30, { align: "center", width: fw });

    doc.end();
  });
}

// ── Expense breakdown PDF ──────────────────────────────────────────────────────

interface ExpenseBreakdownRow { category: string; total: number; }
interface ExpensesPDFData { label: string; breakdown: ExpenseBreakdownRow[]; grandTotal: number; }

function generateExpensesPDF(data: ExpensesPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const fw = doc.page.width - 100;
    const blue = "#1a3a5c";
    doc.rect(50, 50, fw, 55).fill(blue);
    doc.fillColor("#fff").fontSize(18).font("Helvetica-Bold").text("MyLawFirmAi", 62, 60);
    doc.fillColor("#c8d8e8").fontSize(10).font("Helvetica").text(`Expense Breakdown — ${data.label}`, 62, 82);
    doc.fillColor("#fff").fontSize(9).text(`Generated ${new Date().toLocaleDateString("en-MY")}`, 50, 84, { align: "right", width: fw });
    const y0 = 128;
    const col = [50, 340, 460];
    doc.rect(50, y0, fw, 20).fill("#2d5a8e");
    doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
    doc.text("Category", col[0] ?? 50, y0 + 6, { width: 280 });
    doc.text("Amount (RM)", col[1] ?? 340, y0 + 6, { width: 110, align: "right" });
    doc.text("%", col[2] ?? 460, y0 + 6, { width: 55, align: "right" });
    let y = y0 + 22;
    data.breakdown.forEach((row, i) => {
      if (i % 2 === 0) doc.rect(50, y - 2, fw, 18).fill("#f5f7fb").stroke();
      const pct = data.grandTotal > 0 ? ((row.total / data.grandTotal) * 100).toFixed(1) : "0";
      doc.fillColor("#111").fontSize(8).font("Helvetica")
        .text(row.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), col[0] ?? 50, y, { width: 280 });
      doc.fillColor("#c62828").text(row.total.toFixed(2), col[1] ?? 340, y, { width: 110, align: "right" });
      doc.fillColor("#555").text(`${pct}%`, col[2] ?? 460, y, { width: 55, align: "right" });
      y += 18;
    });
    doc.rect(50, y, fw, 22).fill(blue).stroke();
    doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold")
      .text("TOTAL", col[0] ?? 50, y + 6, { width: 280 })
      .text(data.grandTotal.toFixed(2), col[1] ?? 340, y + 6, { width: 110, align: "right" });
    doc.fillColor("#888").fontSize(7).font("Helvetica")
      .text("This report is computer-generated and does not require a signature.", 50, y + 38, { align: "center", width: fw });
    doc.end();
  });
}

// ── Trust balances PDF ─────────────────────────────────────────────────────────

interface TrustLedgerRow { id: number; clientName: string; matterRef?: string | null; balance: number; }
interface TrustPDFData { ledgers: TrustLedgerRow[]; totalBalance: number; }

function generateTrustPDF(data: TrustPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const fw = doc.page.width - 100;
    const blue = "#1a3a5c";
    const dateStr = new Date().toLocaleDateString("en-MY");
    doc.rect(50, 50, fw, 55).fill(blue);
    doc.fillColor("#fff").fontSize(18).font("Helvetica-Bold").text("MyLawFirmAi", 62, 60);
    doc.fillColor("#c8d8e8").fontSize(10).font("Helvetica").text(`Client Trust Account Balances — as at ${dateStr}`, 62, 82);
    const y0 = 128;
    const col = [50, 240, 370, 460];
    doc.rect(50, y0, fw, 20).fill("#2d5a8e");
    doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
    doc.text("Client",      col[0] ?? 50,  y0 + 6, { width: 180 });
    doc.text("Matter Ref",  col[1] ?? 240, y0 + 6, { width: 120 });
    doc.text("Balance (RM)", col[2] ?? 370, y0 + 6, { width: 120, align: "right" });
    let y = y0 + 22;
    data.ledgers.forEach((l, i) => {
      if (i % 2 === 0) doc.rect(50, y - 2, fw, 18).fill("#f5f7fb").stroke();
      doc.fillColor("#111").fontSize(8).font("Helvetica")
        .text(l.clientName,          col[0] ?? 50,  y, { width: 180 })
        .text(l.matterRef ?? "—",   col[1] ?? 240, y, { width: 120 });
      doc.fillColor(l.balance > 0 ? "#2e7d32" : "#555").font("Helvetica-Bold")
        .text(l.balance.toFixed(2), col[2] ?? 370, y, { width: 120, align: "right" });
      y += 18;
    });
    doc.rect(50, y, fw, 22).fill(blue).stroke();
    doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold")
      .text("TOTAL TRUST FUNDS HELD", col[0] ?? 50, y + 6, { width: 300 })
      .text(data.totalBalance.toFixed(2), col[2] ?? 370, y + 6, { width: 120, align: "right" });
    doc.fillColor("#888").fontSize(7).font("Helvetica")
      .text("Solicitors' Account Rules — Client Trust Account Statement. Computer-generated; no signature required.", 50, y + 38, { align: "center", width: fw });
    doc.end();
  });
}

// ── Cashflow PDF ───────────────────────────────────────────────────────────────

interface CashflowRow { month: string; income: number; expense: number; net: number; cumulative: number; }
interface CashflowPDFData { cashflow: CashflowRow[]; months: number; }

function generateCashflowPDF(data: CashflowPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const fw = doc.page.width - 100;
    const blue = "#1a3a5c";
    doc.rect(50, 50, fw, 55).fill(blue);
    doc.fillColor("#fff").fontSize(18).font("Helvetica-Bold").text("MyLawFirmAi", 62, 60);
    doc.fillColor("#c8d8e8").fontSize(10).font("Helvetica").text(`Cashflow Statement — Last ${data.months} Months`, 62, 82);
    doc.fillColor("#fff").fontSize(9).text(`Generated ${new Date().toLocaleDateString("en-MY")}`, 50, 84, { align: "right", width: fw });
    const y0 = 128;
    const col = [50, 170, 290, 380, 460];
    doc.rect(50, y0, fw, 20).fill("#2d5a8e");
    doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
    doc.text("Month",         col[0] ?? 50,  y0 + 6, { width: 110 });
    doc.text("Income (RM)",   col[1] ?? 170, y0 + 6, { width: 110, align: "right" });
    doc.text("Expense (RM)",  col[2] ?? 290, y0 + 6, { width: 80,  align: "right" });
    doc.text("Net (RM)",      col[3] ?? 380, y0 + 6, { width: 70,  align: "right" });
    doc.text("Cumul. (RM)",   col[4] ?? 460, y0 + 6, { width: 70,  align: "right" });
    let y = y0 + 22;
    data.cashflow.forEach((row, i) => {
      if (i % 2 === 0) doc.rect(50, y - 2, fw, 18).fill("#f5f7fb").stroke();
      const monthLabel = (MONTHS[(parseInt(row.month.slice(5)) || 1) - 1] ?? "") + " " + row.month.slice(0, 4);
      doc.fillColor("#111").fontSize(8).font("Helvetica").text(monthLabel, col[0] ?? 50, y, { width: 110 });
      doc.fillColor("#1565c0").text(row.income.toFixed(2),   col[1] ?? 170, y, { width: 110, align: "right" });
      doc.fillColor("#c62828").text(row.expense.toFixed(2),  col[2] ?? 290, y, { width: 80,  align: "right" });
      doc.fillColor(row.net >= 0 ? "#2e7d32" : "#c62828").font("Helvetica-Bold")
        .text(row.net.toFixed(2), col[3] ?? 380, y, { width: 70, align: "right" });
      doc.fillColor(row.cumulative >= 0 ? "#2e7d32" : "#c62828")
        .text(row.cumulative.toFixed(2), col[4] ?? 460, y, { width: 70, align: "right" });
      y += 18;
    });
    if (data.cashflow.length === 0) {
      doc.fillColor("#888").fontSize(9).font("Helvetica").text("No cashflow data for this period.", 50, y + 8, { align: "center", width: fw });
    } else {
      const last = data.cashflow[data.cashflow.length - 1];
      doc.rect(50, y, fw, 22).fill(blue).stroke();
      doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold")
        .text("CUMULATIVE NET", col[0] ?? 50, y + 6, { width: 320 })
        .text((last?.cumulative ?? 0).toFixed(2), col[4] ?? 460, y + 6, { width: 70, align: "right" });
    }
    doc.fillColor("#888").fontSize(7).font("Helvetica")
      .text("This report is computer-generated and does not require a signature.", 50, y + 38, { align: "center", width: fw });
    doc.end();
  });
}

interface PlRow { month: string; income: number; expense: number; net: number; }
interface PlPDFData { year: string; pl: PlRow[]; totalIncome: number; totalExpense: number; }

function generatePlPDF(data: PlPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fw   = doc.page.width - 100;
    const blue = "#1a3a5c";

    doc.rect(50, 50, fw, 55).fill(blue);
    doc.fillColor("#fff").fontSize(18).font("Helvetica-Bold").text("MyLawFirmAi", 62, 60);
    doc.fillColor("#c8d8e8").fontSize(10).font("Helvetica").text(`Profit & Loss Statement — ${data.year}`, 62, 82);
    doc.fillColor("#fff").fontSize(9).text(`Generated ${new Date().toLocaleDateString("en-MY")}`, 50, 84, { align: "right", width: fw });

    // Table header
    const y0 = 128;
    const col = [50, 180, 310, 440];
    doc.rect(50, y0, fw, 20).fill("#2d5a8e");
    doc.fillColor("#fff").fontSize(8).font("Helvetica-Bold");
    ["Month", "Income (RM)", "Expense (RM)", "Net (RM)"].forEach((h, i) => {
      doc.text(h, col[i] ?? 50, y0 + 6, { width: 120, align: i === 0 ? "left" : "right" });
    });

    let y = y0 + 22;
    data.pl.forEach((row, i) => {
      const monthLabel = MONTHS[(parseInt(row.month.slice(5)) || 1) - 1] + " " + data.year;
      if (i % 2 === 0) doc.rect(50, y - 2, fw, 18).fill("#f5f7fb").stroke();
      doc.fillColor("#111").fontSize(8).font("Helvetica")
        .text(monthLabel,                      col[0] ?? 50, y, { width: 120 });
      doc.fillColor("#1565c0")
        .text(row.income.toFixed(2),   col[1] ?? 180, y, { width: 120, align: "right" });
      doc.fillColor("#c62828")
        .text(row.expense.toFixed(2),  col[2] ?? 310, y, { width: 120, align: "right" });
      doc.fillColor(row.net >= 0 ? "#2e7d32" : "#c62828").font("Helvetica-Bold")
        .text(row.net.toFixed(2),      col[3] ?? 440, y, { width: 100, align: "right" });
      y += 18;
    });

    // Totals
    doc.rect(50, y, fw, 22).fill(blue).stroke();
    doc.fillColor("#fff").fontSize(9).font("Helvetica-Bold")
      .text("TOTAL",                            col[0] ?? 50, y + 6, { width: 120 })
      .text(data.totalIncome.toFixed(2),         col[1] ?? 180, y + 6, { width: 120, align: "right" })
      .text(data.totalExpense.toFixed(2),        col[2] ?? 310, y + 6, { width: 120, align: "right" })
      .text((data.totalIncome - data.totalExpense).toFixed(2), col[3] ?? 440, y + 6, { width: 100, align: "right" });

    doc.fillColor("#888").fontSize(7).font("Helvetica")
      .text("This report is computer-generated and does not require a signature.", 50, y + 38, { align: "center", width: fw });

    doc.end();
  });
}

export default router;
