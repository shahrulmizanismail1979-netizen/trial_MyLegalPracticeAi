/**
 * Shared time & billing engine for all practice portals (Task #192).
 *
 * Mounted once via attachCaseIntelligence so every portal's matter router
 * gets the same routes. All rows are keyed by (portal, owner_key) exactly
 * like the other case_* intelligence tables, and matter access is always
 * verified through verifyMatterOwnership, so a foreign matterId is a 404.
 *
 * Matter-level routes (relative to the matter router):
 *   GET    {P}/:matterId/billing                 — billing summary for a matter
 *   POST   {P}/:matterId/billing/fee-items       — add fixed fee / disbursement
 *   DELETE {P}/:matterId/billing/fee-items/:fid  — remove an unbilled item
 *   POST   {P}/:matterId/billing/invoices        — generate an invoice
 *
 * Owner-level routes (aggregate; ≥2 path segments so they never collide
 * with the portals' GET "/:id" matter route):
 *   GET    {P}/billing/invoices                  — all invoices + receivables summary
 *   GET    {P}/billing/invoices/:invoiceId       — invoice detail (lines + payments)
 *   PATCH  {P}/billing/invoices/:invoiceId       — issue / void / edit draft fields
 *   POST   {P}/billing/invoices/:invoiceId/payments — record a payment
 *   GET    {P}/billing/invoices/:invoiceId/pdf   — professional PDF download
 *   GET    {P}/billing/settings                  — firm billing settings
 *   PUT    {P}/billing/settings                  — update settings
 */
import type { IRouter, Request, Response } from "express";
import { pool } from "@workspace/db";
import PDFDocument from "pdfkit";
import { verifyMatterOwnership } from "./caseOwnership";
import type { Portal } from "./caseStages";
import { logger } from "./logger";

const CURRENCY = "RM";
const MAX_TEXT = 500;
const MAX_LINES = 100;

// ── Schema ────────────────────────────────────────────────────────────────────

export async function ensureBillingTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_fee_items (
      id serial PRIMARY KEY,
      portal text NOT NULL,
      matter_id integer NOT NULL,
      owner_key text NOT NULL,
      kind text NOT NULL DEFAULT 'fee',
      description text NOT NULL,
      amount numeric(12,2) NOT NULL,
      item_date date NOT NULL DEFAULT CURRENT_DATE,
      invoice_id integer,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_case_fee_items_matter ON case_fee_items (portal, matter_id);
    CREATE INDEX IF NOT EXISTS idx_case_fee_items_owner ON case_fee_items (portal, owner_key);

    CREATE TABLE IF NOT EXISTS case_invoices (
      id serial PRIMARY KEY,
      portal text NOT NULL,
      owner_key text NOT NULL,
      matter_id integer NOT NULL,
      invoice_no text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      client_name text,
      client_address text,
      issue_date date,
      due_date date,
      tax_percent numeric(5,2) NOT NULL DEFAULT 0,
      subtotal numeric(12,2) NOT NULL DEFAULT 0,
      tax_amount numeric(12,2) NOT NULL DEFAULT 0,
      total numeric(12,2) NOT NULL DEFAULT 0,
      amount_paid numeric(12,2) NOT NULL DEFAULT 0,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_case_invoices_owner ON case_invoices (portal, owner_key);
    CREATE INDEX IF NOT EXISTS idx_case_invoices_matter ON case_invoices (portal, matter_id);

    CREATE TABLE IF NOT EXISTS case_invoice_lines (
      id serial PRIMARY KEY,
      invoice_id integer NOT NULL REFERENCES case_invoices(id) ON DELETE CASCADE,
      description text NOT NULL,
      quantity numeric(10,2) NOT NULL DEFAULT 1,
      unit_amount numeric(12,2) NOT NULL DEFAULT 0,
      amount numeric(12,2) NOT NULL DEFAULT 0,
      sort_order integer NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS case_invoice_payments (
      id serial PRIMARY KEY,
      invoice_id integer NOT NULL REFERENCES case_invoices(id) ON DELETE CASCADE,
      paid_date date NOT NULL DEFAULT CURRENT_DATE,
      amount numeric(12,2) NOT NULL,
      method text,
      reference text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS case_billing_settings (
      id serial PRIMARY KEY,
      portal text NOT NULL,
      owner_key text NOT NULL,
      firm_name text,
      firm_address text,
      firm_phone text,
      firm_email text,
      default_hourly_rate numeric(10,2),
      tax_percent numeric(5,2) NOT NULL DEFAULT 0,
      invoice_prefix text NOT NULL DEFAULT 'INV',
      next_invoice_no integer NOT NULL DEFAULT 1,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (portal, owner_key)
    );

    CREATE TABLE IF NOT EXISTS case_rate_cards (
      id serial PRIMARY KEY,
      portal text NOT NULL,
      owner_key text NOT NULL,
      activity_type text NOT NULL,
      lawyer_level text NOT NULL,
      rate_usd numeric(10,2) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (portal, owner_key, activity_type, lawyer_level)
    );
    CREATE INDEX IF NOT EXISTS idx_case_rate_cards_owner ON case_rate_cards (portal, owner_key);

    ALTER TABLE case_time_entries ADD COLUMN IF NOT EXISTS invoice_id integer;
    ALTER TABLE case_time_entries ADD COLUMN IF NOT EXISTS activity_type text;
    ALTER TABLE case_time_entries ADD COLUMN IF NOT EXISTS lawyer_level text;
  `);
  logger.info("Billing tables ensured");
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type GetOwnerKey = (req: Request, res: Response) => string | null;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

function money(v: unknown): string {
  return num(v).toFixed(2);
}

function parseDate(v: unknown): string | null {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

async function getSettings(portal: Portal, ownerKey: string) {
  const { rows } = await pool.query(
    `INSERT INTO case_billing_settings (portal, owner_key)
     VALUES ($1, $2)
     ON CONFLICT (portal, owner_key) DO UPDATE SET portal = EXCLUDED.portal
     RETURNING *`,
    [portal, ownerKey],
  );
  return rows[0];
}

async function getRateCards(portal: Portal, ownerKey: string) {
  const { rows } = await pool.query(
    `SELECT * FROM case_rate_cards WHERE portal = $1 AND owner_key = $2 ORDER BY activity_type, lawyer_level`,
    [portal, ownerKey],
  );
  return rows;
}

async function computeStatus(
  invoiceId: number,
  q: { query: (text: string, values?: unknown[]) => Promise<{ rows: Row[] }> } = pool,
): Promise<void> {
  await q.query(
    `UPDATE case_invoices SET
       amount_paid = COALESCE((SELECT SUM(amount) FROM case_invoice_payments WHERE invoice_id = $1), 0),
       updated_at = now()
     WHERE id = $1`,
    [invoiceId],
  );
  await q.query(
    `UPDATE case_invoices SET status = CASE
        WHEN status IN ('draft','void') THEN status
        WHEN amount_paid >= total AND total > 0 THEN 'paid'
        WHEN amount_paid > 0 THEN 'partly_paid'
        ELSE 'issued'
      END, updated_at = now()
     WHERE id = $1`,
    [invoiceId],
  );
}

async function ownedInvoice(portal: Portal, ownerKey: string, idParam: string, res: Response) {
  const id = parseInt(idParam, 10);
  if (Number.isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid invoice id" });
    return undefined;
  }
  const { rows } = await pool.query(
    `SELECT * FROM case_invoices WHERE id = $1 AND portal = $2 AND owner_key = $3`,
    [id, portal, ownerKey],
  );
  if (!rows[0]) {
    res.status(404).json({ error: "Invoice not found" });
    return undefined;
  }
  return rows[0];
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function attachBilling(opts: {
  router: IRouter;
  portal: Portal;
  pathPrefix?: string;
  getOwnerKey: GetOwnerKey;
}): void {
  const { router, portal, getOwnerKey } = opts;
  const P = opts.pathPrefix ?? "";

  const auth = (req: Request, res: Response): string | null => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return null;
    }
    return ownerKey;
  };

  const ownedMatterId = async (
    req: Request,
    res: Response,
    ownerKey: string,
  ): Promise<number | undefined> => {
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0) {
      res.status(400).json({ error: "Invalid matter id" });
      return undefined;
    }
    const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
    if (!owned) {
      res.status(404).json({ error: "Matter not found" });
      return undefined;
    }
    return matterId;
  };

  // ── Owner-level: settings ──────────────────────────────────────────────────

  router.get(`${P}/billing/settings`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const [settings, rateCards] = await Promise.all([
      getSettings(portal, ownerKey),
      getRateCards(portal, ownerKey),
    ]);
    res.json({ ...settings, rateCards });
  });

  // ── Rate card CRUD ─────────────────────────────────────────────────────────

  router.get(`${P}/billing/rate-cards`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    res.json(await getRateCards(portal, ownerKey));
  });

  router.post(`${P}/billing/rate-cards`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const { activityType, lawyerLevel, rateUsd } = req.body ?? {};
    if (!activityType || typeof activityType !== "string" || !activityType.trim()) {
      res.status(400).json({ error: "activityType is required" });
      return;
    }
    if (!lawyerLevel || typeof lawyerLevel !== "string" || !lawyerLevel.trim()) {
      res.status(400).json({ error: "lawyerLevel is required" });
      return;
    }
    const rate = num(rateUsd);
    if (rate <= 0) {
      res.status(400).json({ error: "rateUsd must be greater than zero" });
      return;
    }
    const { rows } = await pool.query(
      `INSERT INTO case_rate_cards (portal, owner_key, activity_type, lawyer_level, rate_usd)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (portal, owner_key, activity_type, lawyer_level)
       DO UPDATE SET rate_usd = EXCLUDED.rate_usd, updated_at = now()
       RETURNING *`,
      [portal, ownerKey, activityType.trim().slice(0, MAX_TEXT), lawyerLevel.trim().slice(0, MAX_TEXT), money(rate)],
    );
    res.status(201).json(rows[0]);
  });

  router.put(`${P}/billing/rate-cards/:cardId`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const cardId = parseInt((req.params as Record<string, string>).cardId ?? "0", 10);
    if (Number.isNaN(cardId) || cardId <= 0) {
      res.status(400).json({ error: "Invalid rate card id" });
      return;
    }
    const { rateUsd } = req.body ?? {};
    const rate = num(rateUsd);
    if (rate <= 0) {
      res.status(400).json({ error: "rateUsd must be greater than zero" });
      return;
    }
    const { rows } = await pool.query(
      `UPDATE case_rate_cards SET rate_usd = $3, updated_at = now()
       WHERE id = $1 AND portal = $2 AND owner_key = $4 RETURNING *`,
      [cardId, portal, money(rate), ownerKey],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Rate card entry not found" });
      return;
    }
    res.json(rows[0]);
  });

  router.delete(`${P}/billing/rate-cards/:cardId`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const cardId = parseInt((req.params as Record<string, string>).cardId ?? "0", 10);
    if (Number.isNaN(cardId) || cardId <= 0) {
      res.status(400).json({ error: "Invalid rate card id" });
      return;
    }
    const { rows } = await pool.query(
      `DELETE FROM case_rate_cards WHERE id = $1 AND portal = $2 AND owner_key = $3 RETURNING id`,
      [cardId, portal, ownerKey],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Rate card entry not found" });
      return;
    }
    res.json({ success: true });
  });

  router.put(`${P}/billing/settings`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    await getSettings(portal, ownerKey);
    const b = req.body ?? {};
    const fields: Array<[string, unknown]> = [];
    for (const [key, col] of [
      ["firmName", "firm_name"],
      ["firmAddress", "firm_address"],
      ["firmPhone", "firm_phone"],
      ["firmEmail", "firm_email"],
      ["invoicePrefix", "invoice_prefix"],
    ] as const) {
      if (typeof b[key] === "string") fields.push([col, String(b[key]).slice(0, MAX_TEXT)]);
    }
    if (b.defaultHourlyRate !== undefined)
      fields.push(["default_hourly_rate", b.defaultHourlyRate === null ? null : money(b.defaultHourlyRate)]);
    if (b.taxPercent !== undefined)
      fields.push(["tax_percent", money(Math.min(Math.max(num(b.taxPercent), 0), 100))]);
    if (fields.length === 0) {
      res.status(400).json({ error: "no valid fields" });
      return;
    }
    const sets = fields.map(([c], i) => `${c} = $${i + 3}`).join(", ");
    const { rows } = await pool.query(
      `UPDATE case_billing_settings SET ${sets}, updated_at = now()
       WHERE portal = $1 AND owner_key = $2 RETURNING *`,
      [portal, ownerKey, ...fields.map(([, v]) => v)],
    );
    res.json(rows[0]);
  });

  // ── Owner-level: invoices list + receivables summary ─────────────────────────

  router.get(`${P}/billing/invoices`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const { rows } = await pool.query(
      `SELECT * FROM case_invoices WHERE portal = $1 AND owner_key = $2
       ORDER BY created_at DESC LIMIT 500`,
      [portal, ownerKey],
    );
    // Unbilled work-in-progress across ALL of this owner's matters: time
    // entries and fee/disbursement items that have not yet been placed on an
    // invoice. This unifies the read path so the portal-level billing view
    // reflects amounts entered in each matter's Billing tab, not just invoices.
    const settings = await getSettings(portal, ownerKey);
    const defaultRate = num(settings.default_hourly_rate);
    const [wipTimeRes, wipFeesRes] = await Promise.all([
      pool.query(
        `SELECT minutes, rate_usd AS rate FROM case_time_entries
         WHERE portal = $1 AND owner_key = $2 AND invoice_id IS NULL`,
        [portal, ownerKey],
      ),
      pool.query(
        `SELECT kind, amount FROM case_fee_items
         WHERE portal = $1 AND owner_key = $2 AND invoice_id IS NULL`,
        [portal, ownerKey],
      ),
    ]);
    let wipTime = 0;
    let wipFees = 0;
    let wipDisb = 0;
    for (const t of wipTimeRes.rows) {
      const rate = t.rate != null ? num(t.rate) : defaultRate;
      wipTime += (num(t.minutes) / 60) * rate;
    }
    for (const f of wipFeesRes.rows) {
      if (f.kind === "disbursement") wipDisb += num(f.amount);
      else wipFees += num(f.amount);
    }
    const wipTotal = wipTime + wipFees + wipDisb;

    const now = Date.now();
    let outstanding = 0;
    const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
    for (const inv of rows) {
      if (inv.status === "issued" || inv.status === "partly_paid") {
        const due = num(inv.total) - num(inv.amount_paid);
        outstanding += due;
        const ref = inv.due_date ?? inv.issue_date;
        const refMs = ref ? new Date(ref as string | Date).getTime() : NaN;
        const days = Number.isFinite(refMs) ? Math.floor((now - refMs) / 86_400_000) : 0;
        if (days <= 0) aging.current += due;
        else if (days <= 30) aging.d30 += due;
        else if (days <= 60) aging.d60 += due;
        else aging.d90 += due;
      }
    }
    res.json({
      invoices: rows,
      summary: {
        currency: CURRENCY,
        outstanding: outstanding.toFixed(2),
        aging: {
          current: aging.current.toFixed(2),
          overdue1to30: aging.d30.toFixed(2),
          overdue31to60: aging.d60.toFixed(2),
          overdue60plus: aging.d90.toFixed(2),
        },
        // Unbilled work-in-progress across all matters (not yet invoiced).
        unbilled: {
          time: wipTime.toFixed(2),
          fees: wipFees.toFixed(2),
          disbursements: wipDisb.toFixed(2),
          total: wipTotal.toFixed(2),
        },
      },
    });
  });

  router.get(`${P}/billing/invoices/:invoiceId`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const inv = await ownedInvoice(portal, ownerKey, req.params.invoiceId as string, res);
    if (!inv) return;
    const [{ rows: lines }, { rows: payments }] = await Promise.all([
      pool.query(`SELECT * FROM case_invoice_lines WHERE invoice_id = $1 ORDER BY sort_order, id`, [inv.id]),
      pool.query(`SELECT * FROM case_invoice_payments WHERE invoice_id = $1 ORDER BY paid_date, id`, [inv.id]),
    ]);
    res.json({ ...inv, lines, payments });
  });

  router.patch(`${P}/billing/invoices/:invoiceId`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const inv = await ownedInvoice(portal, ownerKey, req.params.invoiceId as string, res);
    if (!inv) return;
    const b = req.body ?? {};
    if (b.status !== undefined && b.status !== "issued" && b.status !== "void") {
      res.status(400).json({ error: "status may only be set to 'issued' or 'void'" });
      return;
    }

    // All lifecycle transitions run inside a transaction with the invoice
    // row locked, so concurrent issue/void/delete/payment requests serialize
    // and act on the current (not stale) status.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = (
        await client.query(`SELECT * FROM case_invoices WHERE id = $1 FOR UPDATE`, [inv.id])
      ).rows[0];
      if (!locked) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "Invoice not found" });
        return;
      }

      if (b.status === "issued") {
        if (locked.status !== "draft") {
          await client.query("ROLLBACK");
          res.status(400).json({ error: "Only a draft invoice can be issued" });
          return;
        }
        await client.query(
          `UPDATE case_invoices SET status = 'issued',
             issue_date = COALESCE(issue_date, CURRENT_DATE),
             due_date = COALESCE(due_date, CURRENT_DATE + INTERVAL '30 days'),
             updated_at = now() WHERE id = $1`,
          [inv.id],
        );
      } else if (b.status === "void") {
        const paidCount = (
          await client.query(
            `SELECT COUNT(*)::int AS n FROM case_invoice_payments WHERE invoice_id = $1`,
            [inv.id],
          )
        ).rows[0].n as number;
        if (locked.status === "paid" || paidCount > 0) {
          await client.query("ROLLBACK");
          res.status(400).json({ error: "An invoice with recorded payments cannot be voided; delete its payments first" });
          return;
        }
        if (locked.status === "void") {
          await client.query("ROLLBACK");
          res.status(400).json({ error: "Invoice is already void" });
          return;
        }
        // Release billed items back to unbilled.
        await client.query(`UPDATE case_time_entries SET invoice_id = NULL WHERE invoice_id = $1`, [inv.id]);
        await client.query(`UPDATE case_fee_items SET invoice_id = NULL WHERE invoice_id = $1`, [inv.id]);
        await client.query(
          `UPDATE case_invoices SET status = 'void', updated_at = now() WHERE id = $1`,
          [inv.id],
        );
      }

      // Draft-only field edits (checked against the locked status).
      if (locked.status === "draft" && b.status !== "void") {
        const sets: string[] = [];
        const vals: unknown[] = [];
        const push = (col: string, v: unknown) => {
          vals.push(v);
          sets.push(`${col} = $${vals.length + 1}`);
        };
        if (typeof b.clientName === "string") push("client_name", b.clientName.slice(0, MAX_TEXT));
        if (typeof b.clientAddress === "string") push("client_address", b.clientAddress.slice(0, 2000));
        if (typeof b.notes === "string") push("notes", b.notes.slice(0, 5000));
        if (parseDate(b.issueDate)) push("issue_date", parseDate(b.issueDate));
        if (parseDate(b.dueDate)) push("due_date", parseDate(b.dueDate));
        if (sets.length > 0) {
          await client.query(
            `UPDATE case_invoices SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`,
            [inv.id, ...vals],
          );
        }
      }

      const { rows } = await client.query(`SELECT * FROM case_invoices WHERE id = $1`, [inv.id]);
      await client.query("COMMIT");
      res.json(rows[0]);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  router.delete(`${P}/billing/invoices/:invoiceId`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const inv = await ownedInvoice(portal, ownerKey, req.params.invoiceId as string, res);
    if (!inv) return;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = (
        await client.query(`SELECT * FROM case_invoices WHERE id = $1 FOR UPDATE`, [inv.id])
      ).rows[0];
      if (!locked || locked.status !== "draft") {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Only a draft invoice can be deleted; void it instead" });
        return;
      }
      await client.query(`UPDATE case_time_entries SET invoice_id = NULL WHERE invoice_id = $1`, [inv.id]);
      await client.query(`UPDATE case_fee_items SET invoice_id = NULL WHERE invoice_id = $1`, [inv.id]);
      await client.query(`DELETE FROM case_invoices WHERE id = $1`, [inv.id]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  router.post(`${P}/billing/invoices/:invoiceId/payments`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const inv = await ownedInvoice(portal, ownerKey, req.params.invoiceId as string, res);
    if (!inv) return;
    const amount = num(req.body?.amount);
    if (amount <= 0) {
      res.status(400).json({ error: "amount must be greater than zero" });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = (
        await client.query(`SELECT * FROM case_invoices WHERE id = $1 FOR UPDATE`, [inv.id])
      ).rows[0];
      if (!locked || locked.status === "draft" || locked.status === "void") {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Payments can only be recorded on an issued invoice" });
        return;
      }
      const outstanding = Number(locked.total) - Number(locked.amount_paid);
      if (amount - outstanding > 0.005) {
        await client.query("ROLLBACK");
        res.status(400).json({
          error: `Payment exceeds the outstanding balance of ${Number(outstanding).toFixed(2)}`,
        });
        return;
      }
      await client.query(
        `INSERT INTO case_invoice_payments (invoice_id, paid_date, amount, method, reference)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          inv.id,
          parseDate(req.body?.paidDate) ?? new Date().toISOString().slice(0, 10),
          money(amount),
          typeof req.body?.method === "string" ? req.body.method.slice(0, 100) : null,
          typeof req.body?.reference === "string" ? req.body.reference.slice(0, 200) : null,
        ],
      );
      await computeStatus(inv.id, client);
      const { rows } = await client.query(`SELECT * FROM case_invoices WHERE id = $1`, [inv.id]);
      await client.query("COMMIT");
      res.status(201).json(rows[0]);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  });

  router.get(`${P}/billing/invoices/:invoiceId/pdf`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const inv = await ownedInvoice(portal, ownerKey, req.params.invoiceId as string, res);
    if (!inv) return;
    const [{ rows: lines }, { rows: payments }, settings] = await Promise.all([
      pool.query(`SELECT * FROM case_invoice_lines WHERE invoice_id = $1 ORDER BY sort_order, id`, [inv.id]),
      pool.query(`SELECT * FROM case_invoice_payments WHERE invoice_id = $1 ORDER BY paid_date, id`, [inv.id]),
      getSettings(portal, ownerKey),
    ]);
    try {
      const pdf = await renderInvoicePdf(inv, lines, payments, settings);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${String(inv.invoice_no).replace(/[^\w.-]/g, "_")}.pdf"`,
      );
      res.send(pdf);
    } catch (err) {
      logger.error({ err, portal, invoiceId: inv.id }, "invoice pdf failed");
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // ── Matter-level: billing summary ────────────────────────────────────────────

  router.get(`${P}/:matterId/billing`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const matterId = await ownedMatterId(req, res, ownerKey);
    if (!matterId) return;
    const [{ rows: time }, { rows: fees }, { rows: invoices }, settings, rateCards] = await Promise.all([
      pool.query(
        `SELECT id, description, minutes, rate_usd AS rate, entry_date, invoice_id,
                activity_type, lawyer_level
         FROM case_time_entries WHERE portal = $1 AND matter_id = $2 AND owner_key = $3
         ORDER BY entry_date DESC, id DESC`,
        [portal, matterId, ownerKey],
      ),
      pool.query(
        `SELECT * FROM case_fee_items WHERE portal = $1 AND matter_id = $2 AND owner_key = $3
         ORDER BY item_date DESC, id DESC`,
        [portal, matterId, ownerKey],
      ),
      pool.query(
        `SELECT * FROM case_invoices WHERE portal = $1 AND matter_id = $2 AND owner_key = $3
         ORDER BY created_at DESC`,
        [portal, matterId, ownerKey],
      ),
      getSettings(portal, ownerKey),
      getRateCards(portal, ownerKey),
    ]);
    const defaultRate = num(settings.default_hourly_rate);
    let unbilledTime = 0;
    let unbilledFees = 0;
    let unbilledDisb = 0;
    for (const t of time) {
      if (t.invoice_id == null) {
        const rate = t.rate != null ? num(t.rate) : defaultRate;
        unbilledTime += (num(t.minutes) / 60) * rate;
      }
    }
    for (const f of fees) {
      if (f.invoice_id == null) {
        if (f.kind === "disbursement") unbilledDisb += num(f.amount);
        else unbilledFees += num(f.amount);
      }
    }
    res.json({
      currency: CURRENCY,
      timeEntries: time,
      feeItems: fees,
      invoices,
      settings: { ...settings, rateCards },
      rateCards,
      unbilled: {
        time: unbilledTime.toFixed(2),
        fees: unbilledFees.toFixed(2),
        disbursements: unbilledDisb.toFixed(2),
        total: (unbilledTime + unbilledFees + unbilledDisb).toFixed(2),
      },
    });
  });

  router.post(`${P}/:matterId/billing/fee-items`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const matterId = await ownedMatterId(req, res, ownerKey);
    if (!matterId) return;
    const { description, amount, kind, itemDate } = req.body ?? {};
    if (!description || typeof description !== "string" || !description.trim()) {
      res.status(400).json({ error: "description is required" });
      return;
    }
    const amt = num(amount);
    if (amt <= 0) {
      res.status(400).json({ error: "amount must be greater than zero" });
      return;
    }
    const k = kind === "disbursement" ? "disbursement" : "fee";
    const { rows } = await pool.query(
      `INSERT INTO case_fee_items (portal, matter_id, owner_key, kind, description, amount, item_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        portal,
        matterId,
        ownerKey,
        k,
        description.trim().slice(0, MAX_TEXT),
        money(amt),
        parseDate(itemDate) ?? new Date().toISOString().slice(0, 10),
      ],
    );
    res.status(201).json(rows[0]);
  });

  router.delete(`${P}/:matterId/billing/fee-items/:feeItemId`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const matterId = await ownedMatterId(req, res, ownerKey);
    if (!matterId) return;
    const fid = parseInt((req.params as Record<string, string>).feeItemId ?? "0", 10);
    if (Number.isNaN(fid) || fid <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { rows } = await pool.query(
      `DELETE FROM case_fee_items
       WHERE id = $1 AND portal = $2 AND matter_id = $3 AND owner_key = $4 AND invoice_id IS NULL
       RETURNING id`,
      [fid, portal, matterId, ownerKey],
    );
    if (!rows[0]) {
      res.status(404).json({ error: "Item not found or already billed" });
      return;
    }
    res.json({ success: true });
  });

  // ── Matter-level: generate an invoice ────────────────────────────────────────

  router.post(`${P}/:matterId/billing/invoices`, async (req, res) => {
    const ownerKey = auth(req, res);
    if (!ownerKey) return;
    const matterId = await ownedMatterId(req, res, ownerKey);
    if (!matterId) return;
    const b = req.body ?? {};
    const includeTime = b.includeTime !== false;
    const includeFees = b.includeFees !== false;
    const extraLines = Array.isArray(b.extraLines) ? b.extraLines.slice(0, MAX_LINES) : [];

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Allocate the invoice number under a row lock on the settings row.
      await client.query(
        `INSERT INTO case_billing_settings (portal, owner_key) VALUES ($1, $2)
         ON CONFLICT (portal, owner_key) DO NOTHING`,
        [portal, ownerKey],
      );
      const { rows: srows } = await client.query(
        `UPDATE case_billing_settings SET next_invoice_no = next_invoice_no + 1, updated_at = now()
         WHERE portal = $1 AND owner_key = $2 RETURNING *`,
        [portal, ownerKey],
      );
      const settings = srows[0];
      const seq = settings.next_invoice_no - 1;
      const invoiceNo = `${settings.invoice_prefix || "INV"}-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
      const defaultRate = num(settings.default_hourly_rate);
      const taxPercent =
        b.taxPercent !== undefined
          ? Math.min(Math.max(num(b.taxPercent), 0), 100)
          : num(settings.tax_percent);

      type Line = { description: string; quantity: number; unitAmount: number; amount: number };
      const lines: Line[] = [];
      let billedTimeIds: number[] = [];
      let billedFeeIds: number[] = [];

      if (includeTime) {
        const { rows: time } = await client.query(
          `SELECT id, description, minutes, rate_usd AS rate, entry_date, activity_type, lawyer_level
           FROM case_time_entries
           WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND invoice_id IS NULL
           ORDER BY entry_date, id FOR UPDATE`,
          [portal, matterId, ownerKey],
        );
        for (const t of time) {
          const rate = t.rate != null ? num(t.rate) : defaultRate;
          const hours = num(t.minutes) / 60;
          const meta: string[] = [];
          if (t.activity_type) meta.push(String(t.activity_type));
          if (t.lawyer_level) meta.push(String(t.lawyer_level));
          meta.push(`${num(t.minutes)} min`);
          lines.push({
            description: `${String(t.entry_date).slice(0, 10)} — ${t.description} (${meta.join(", ")})`,
            quantity: Math.round(hours * 100) / 100,
            unitAmount: rate,
            amount: Math.round(hours * rate * 100) / 100,
          });
        }
        billedTimeIds = time.map((t: { id: number }) => t.id);
      }
      if (includeFees) {
        const { rows: fees } = await client.query(
          `SELECT id, kind, description, amount, item_date FROM case_fee_items
           WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND invoice_id IS NULL
           ORDER BY item_date, id FOR UPDATE`,
          [portal, matterId, ownerKey],
        );
        for (const f of fees) {
          lines.push({
            description: `${f.kind === "disbursement" ? "Disbursement" : "Professional fee"}: ${f.description}`,
            quantity: 1,
            unitAmount: num(f.amount),
            amount: num(f.amount),
          });
        }
        billedFeeIds = fees.map((f: { id: number }) => f.id);
      }
      for (const l of extraLines) {
        const qty = l?.quantity !== undefined ? num(l.quantity) : 1;
        const unit = num(l?.unitAmount ?? l?.amount);
        if (!l?.description || typeof l.description !== "string" || unit <= 0 || qty <= 0) continue;
        lines.push({
          description: l.description.slice(0, MAX_TEXT),
          quantity: qty,
          unitAmount: unit,
          amount: Math.round(qty * unit * 100) / 100,
        });
      }

      if (lines.length === 0) {
        await client.query("ROLLBACK");
        res.status(400).json({ error: "Nothing to bill — add time entries, fees or lines first" });
        return;
      }

      const subtotal = lines.reduce((s, l) => s + l.amount, 0);
      const taxAmount = Math.round(subtotal * taxPercent) / 100;
      const total = subtotal + taxAmount;

      const { rows: irows } = await client.query(
        `INSERT INTO case_invoices
           (portal, owner_key, matter_id, invoice_no, status, client_name, client_address,
            due_date, tax_percent, subtotal, tax_amount, total, notes)
         VALUES ($1,$2,$3,$4,'draft',$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        [
          portal,
          ownerKey,
          matterId,
          invoiceNo,
          typeof b.clientName === "string" ? b.clientName.slice(0, MAX_TEXT) : null,
          typeof b.clientAddress === "string" ? b.clientAddress.slice(0, 2000) : null,
          parseDate(b.dueDate),
          money(taxPercent),
          money(subtotal),
          money(taxAmount),
          money(total),
          typeof b.notes === "string" ? b.notes.slice(0, 5000) : null,
        ],
      );
      const invoice = irows[0];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await client.query(
          `INSERT INTO case_invoice_lines (invoice_id, description, quantity, unit_amount, amount, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [invoice.id, l.description, money(l.quantity), money(l.unitAmount), money(l.amount), i],
        );
      }
      if (billedTimeIds.length > 0) {
        await client.query(`UPDATE case_time_entries SET invoice_id = $1 WHERE id = ANY($2::int[])`, [
          invoice.id,
          billedTimeIds,
        ]);
      }
      if (billedFeeIds.length > 0) {
        await client.query(`UPDATE case_fee_items SET invoice_id = $1 WHERE id = ANY($2::int[])`, [
          invoice.id,
          billedFeeIds,
        ]);
      }
      await client.query("COMMIT");
      res.status(201).json(invoice);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      logger.error({ err, portal, matterId }, "invoice creation failed");
      res.status(500).json({ error: "Failed to create invoice" });
    } finally {
      client.release();
    }
  });
}

// ── PDF ───────────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function renderInvoicePdf(
  inv: Row,
  lines: Row[],
  payments: Row[],
  settings: Row,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fmt = (v: unknown) =>
      `${CURRENCY} ${num(v).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const gray = "#555555";
    const accent = "#8a6d2f";

    // Firm header
    doc.fontSize(16).fillColor(accent).font("Helvetica-Bold")
      .text(String(settings.firm_name || "Legal Practice"), { align: "left" });
    doc.moveDown(0.2).fontSize(9).fillColor(gray).font("Helvetica");
    if (settings.firm_address) doc.text(String(settings.firm_address));
    const contact = [settings.firm_phone, settings.firm_email].filter(Boolean).join("  •  ");
    if (contact) doc.text(contact);

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).strokeColor(accent).stroke();
    doc.moveDown(0.8);

    // Title + meta
    const isPaid = inv.status === "paid";
    doc.fontSize(20).fillColor("#111111").font("Helvetica-Bold")
      .text(inv.status === "draft" ? "INVOICE (DRAFT)" : "INVOICE", 50, doc.y);
    doc.fontSize(10).font("Helvetica").fillColor(gray);
    const metaY = doc.y + 6;
    doc.text(`Invoice No: ${inv.invoice_no}`, 50, metaY);
    doc.text(`Date: ${inv.issue_date ? String(inv.issue_date).slice(0, 10) : "—"}`, 50);
    doc.text(`Due: ${inv.due_date ? String(inv.due_date).slice(0, 10) : "—"}`, 50);
    doc.text(`Status: ${String(inv.status).replace("_", " ").toUpperCase()}`, 50);

    // Bill-to block
    doc.fontSize(10).fillColor("#111111").font("Helvetica-Bold").text("BILL TO", 350, metaY);
    doc.font("Helvetica").fillColor(gray)
      .text(String(inv.client_name || "Client"), 350)
      .text(String(inv.client_address || ""), 350, undefined, { width: 195 });

    doc.moveDown(1.5);
    let y = Math.max(doc.y, 230);

    // Table header
    doc.rect(50, y, 495, 20).fill("#f2ede2");
    doc.fillColor("#111111").font("Helvetica-Bold").fontSize(9);
    doc.text("Description", 56, y + 6, { width: 280 });
    doc.text("Qty", 340, y + 6, { width: 50, align: "right" });
    doc.text("Rate", 395, y + 6, { width: 65, align: "right" });
    doc.text("Amount", 465, y + 6, { width: 75, align: "right" });
    y += 24;

    doc.font("Helvetica").fontSize(9).fillColor("#222222");
    for (const l of lines) {
      const h = Math.max(doc.heightOfString(String(l.description), { width: 280 }), 12) + 8;
      if (y + h > 760) {
        doc.addPage();
        y = 50;
      }
      doc.text(String(l.description), 56, y, { width: 280 });
      doc.text(num(l.quantity).toString(), 340, y, { width: 50, align: "right" });
      doc.text(fmt(l.unit_amount), 395, y, { width: 65, align: "right" });
      doc.text(fmt(l.amount), 465, y, { width: 75, align: "right" });
      y += h;
      doc.moveTo(50, y - 4).lineTo(545, y - 4).lineWidth(0.5).strokeColor("#e5e0d5").stroke();
    }

    // Totals
    y += 6;
    if (y > 700) {
      doc.addPage();
      y = 50;
    }
    const totalRow = (label: string, value: string, bold = false) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9)
        .fillColor(bold ? "#111111" : gray);
      doc.text(label, 350, y, { width: 110, align: "right" });
      doc.text(value, 465, y, { width: 75, align: "right" });
      y += bold ? 18 : 14;
    };
    totalRow("Subtotal", fmt(inv.subtotal));
    if (num(inv.tax_percent) > 0) totalRow(`Tax (${num(inv.tax_percent)}%)`, fmt(inv.tax_amount));
    totalRow("Total", fmt(inv.total), true);
    if (num(inv.amount_paid) > 0) {
      totalRow("Paid", fmt(inv.amount_paid));
      totalRow("Balance Due", fmt(num(inv.total) - num(inv.amount_paid)), true);
    }
    if (isPaid) {
      doc.fontSize(14).fillColor("#1a7f37").font("Helvetica-Bold").text("PAID", 56, y - 30);
    }

    // Payments
    if (payments.length > 0) {
      y += 10;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#111111").text("Payments received", 50, y);
      y += 16;
      doc.font("Helvetica").fontSize(9).fillColor(gray);
      for (const p of payments) {
        doc.text(
          `${String(p.paid_date).slice(0, 10)} — ${fmt(p.amount)}${p.method ? ` (${p.method})` : ""}${p.reference ? ` Ref: ${p.reference}` : ""}`,
          50,
          y,
        );
        y += 13;
      }
    }

    // Notes + footer
    if (inv.notes) {
      y += 12;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#111111").text("Notes", 50, y);
      doc.font("Helvetica").fillColor(gray).text(String(inv.notes), 50, y + 12, { width: 495 });
    }
    doc.fontSize(8).fillColor("#999999").text(
      "This invoice was generated electronically and is valid without signature.",
      50,
      790,
      { width: 495, align: "center" },
    );

    doc.end();
  });
}
