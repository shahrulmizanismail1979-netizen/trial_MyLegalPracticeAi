import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";
import { recordCaseEvent, updateCaseEventBySource, deleteCaseEventBySource } from "../../lib/caseEvents";

type OwnerRequest = Request & { corpOwnerId: number };

const OBLIGATION_STATUSES = ["open", "at_risk", "fulfilled", "not_applicable"] as const;
const TRANSACTION_STATUSES = ["open", "blocked", "complete"] as const;
const APPROVAL_STATUSES = ["not_required", "pending", "approved", "rejected"] as const;

function ownerOf(req: Request): number {
  return (req as OwnerRequest).corpOwnerId;
}

function requireOwner(req: Request, res: Response, next: () => void): void {
  const ownerId = res.locals.accessCodeId;
  if (typeof ownerId !== "number") {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  (req as OwnerRequest).corpOwnerId = ownerId;
  next();
}

function matterIdOf(req: Request): number | null {
  const matterId = Number(req.params.matterId);
  return Number.isInteger(matterId) && matterId > 0 ? matterId : null;
}

function cleanText(value: unknown, max = 5000): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value.trim().slice(0, max) : undefined;
}

function cleanDate(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return value;
}

function dateOnly(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

async function ownedMatter(matterId: number, ownerId: number): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM corp_matters WHERE id = $1 AND access_code_id = $2 LIMIT 1",
    [matterId, ownerId],
  );
  return result.rows.length > 0;
}

async function mirrorWorkflowDeadline(
  matterId: number,
  ownerId: number,
  deadlineId: number | null,
  title: string,
  dueDate: string | null,
  category: "compliance" | "closing",
  deadlineStatus: "pending" | "completed",
): Promise<number | null> {
  if (!dueDate) {
    await deleteWorkflowDeadline(deadlineId, matterId, ownerId);
    return null;
  }
  if (deadlineId) {
    await pool.query(
      `UPDATE corp_matter_deadlines
       SET title = $1, due_date = $2::date, category = $3, status = $4, updated_at = now()
       WHERE id = $5 AND matter_id = $6 AND access_code_id = $7`,
      [title, dueDate, category, deadlineStatus, deadlineId, matterId, ownerId],
    );
    return deadlineId;
  }
  const result = await pool.query(
    `INSERT INTO corp_matter_deadlines
       (matter_id, access_code_id, title, due_date, category, status, notes)
     VALUES ($1, $2, $3, $4::date, $5, $6, 'Created from corporate workflow tracker')
     RETURNING id`,
    [matterId, ownerId, title, dueDate, category, deadlineStatus],
  );
  return Number(result.rows[0]?.id ?? 0) || null;
}

async function deleteWorkflowDeadline(deadlineId: number | null, matterId: number, ownerId: number) {
  if (!deadlineId) return;
  await pool.query(
    "DELETE FROM corp_matter_deadlines WHERE id = $1 AND matter_id = $2 AND access_code_id = $3",
    [deadlineId, matterId, ownerId],
  );
}

export function createCorpWorkflowRouter(): IRouter {
  const router: IRouter = Router({ mergeParams: true });
  router.use(requireOwner);
  router.use(async (req, res, next) => {
    if (req.method === "GET" || req.path === "/review") return next();
    const matterId = matterIdOf(req);
    const ownerId = ownerOf(req);
    const review = matterId
      ? await pool.query(
          "SELECT finalised FROM corp_matter_reviews WHERE matter_id = $1 AND access_code_id = $2",
          [matterId, ownerId],
        )
      : { rows: [] };
    if (review.rows[0]?.finalised) {
      res.status(409).json({ error: "This workflow is finalised and cannot be changed" });
      return;
    }
    next();
  });

  router.get("/", async (req, res) => {
    const matterId = matterIdOf(req);
    const ownerId = ownerOf(req);
    if (!matterId) {
      res.status(400).json({ error: "Invalid matter id" });
      return;
    }
    if (!(await ownedMatter(matterId, ownerId))) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }
    const [obligations, transactions, reviews] = await Promise.all([
      pool.query(
        `SELECT id, matter_id, title, authority, owner_name, due_date, status, risk,
                evidence_note, source_reference, deadline_id, verified_by, verified_at,
                created_at, updated_at
         FROM corp_compliance_obligations
         WHERE matter_id = $1 AND access_code_id = $2
         ORDER BY due_date NULLS LAST, id`,
        [matterId, ownerId],
      ),
      pool.query(
        `SELECT id, matter_id, title, item_type, counterparty, target_date, status,
                version_label, deviation, fallback_position, approval_status, approved_by,
                approved_at, notes, deadline_id, created_at, updated_at
         FROM corp_transaction_items
         WHERE matter_id = $1 AND access_code_id = $2
         ORDER BY target_date NULLS LAST, id`,
        [matterId, ownerId],
      ),
      pool.query(
        `SELECT id, reviewer_name, evidence_status, assumptions, finalised, finalised_at,
                created_at, updated_at
         FROM corp_matter_reviews
         WHERE matter_id = $1 AND access_code_id = $2
         ORDER BY updated_at DESC LIMIT 1`,
        [matterId, ownerId],
      ),
    ]);
    res.json({
      obligations: obligations.rows,
      transactions: transactions.rows,
      review: reviews.rows[0] ?? null,
    });
  });

  router.post("/obligations", async (req, res) => {
    const matterId = matterIdOf(req);
    const ownerId = ownerOf(req);
    if (!matterId || !(await ownedMatter(matterId, ownerId))) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }
    const title = cleanText(req.body?.title, 300);
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const dueDate = cleanDate(req.body?.due_date) ?? null;
    const status = OBLIGATION_STATUSES.includes(req.body?.status) ? req.body.status : "open";
    const result = await pool.query(
      `INSERT INTO corp_compliance_obligations
         (matter_id, access_code_id, title, authority, owner_name, due_date, status, risk,
          evidence_note, source_reference)
       VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10)
       RETURNING *`,
      [
        matterId, ownerId, title, cleanText(req.body?.authority, 300) ?? null,
        cleanText(req.body?.owner_name, 200) ?? null, dueDate, status,
        cleanText(req.body?.risk, 100) ?? "medium",
        cleanText(req.body?.evidence_note, 5000) ?? null,
        cleanText(req.body?.source_reference, 500) ?? null,
      ],
    );
    const row = result.rows[0];
    const deadlineId = await mirrorWorkflowDeadline(matterId, ownerId, null, title, dueDate, "compliance", status === "fulfilled" ? "completed" : "pending");
    if (deadlineId) {
      await pool.query(
        "UPDATE corp_compliance_obligations SET deadline_id = $1 WHERE id = $2 AND access_code_id = $3",
        [deadlineId, row.id, ownerId],
      );
      row.deadline_id = deadlineId;
    }
    void recordCaseEvent("corp", matterId, String(ownerId), {
      event_date: dueDate ?? new Date().toISOString().slice(0, 10),
      title: `Compliance obligation added: ${title}`,
      kind: "deadline",
      source: `compliance-obligation:${row.id}`,
    });
    res.status(201).json(row);
  });

  router.patch("/obligations/:id", async (req, res) => {
    const matterId = matterIdOf(req);
    const ownerId = ownerOf(req);
    const id = Number(req.params.id);
    if (!matterId || !Number.isInteger(id) || !(await ownedMatter(matterId, ownerId))) {
      res.status(404).json({ error: "Obligation not found" });
      return;
    }
    const current = await pool.query(
      "SELECT * FROM corp_compliance_obligations WHERE id = $1 AND matter_id = $2 AND access_code_id = $3",
      [id, matterId, ownerId],
    );
    if (!current.rows[0]) {
      res.status(404).json({ error: "Obligation not found" });
      return;
    }
    const body = req.body ?? {};
    const values = [
      cleanText(body.title, 300),
      cleanText(body.authority, 300),
      cleanText(body.owner_name, 200),
      cleanDate(body.due_date),
      OBLIGATION_STATUSES.includes(body.status) ? body.status : undefined,
      cleanText(body.risk, 100),
      cleanText(body.evidence_note, 5000),
      cleanText(body.source_reference, 500),
      cleanText(body.verified_by, 200),
    ];
    const result = await pool.query(
      `UPDATE corp_compliance_obligations
       SET title = COALESCE($1, title), authority = COALESCE($2, authority),
           owner_name = COALESCE($3, owner_name), due_date = COALESCE($4::date, due_date),
           status = COALESCE($5, status), risk = COALESCE($6, risk),
           evidence_note = COALESCE($7, evidence_note), source_reference = COALESCE($8, source_reference),
           verified_by = COALESCE($9, verified_by),
           verified_at = CASE WHEN $5 = 'fulfilled' THEN now() ELSE verified_at END,
           updated_at = now()
       WHERE id = $10 AND matter_id = $11 AND access_code_id = $12
       RETURNING *`,
      [...values, id, matterId, ownerId],
    );
    const row = result.rows[0];
    const deadlineId = await mirrorWorkflowDeadline(matterId, ownerId, row.deadline_id, row.title, dateOnly(row.due_date), "compliance", row.status === "fulfilled" ? "completed" : "pending");
    if (deadlineId !== row.deadline_id) {
      await pool.query("UPDATE corp_compliance_obligations SET deadline_id = $1 WHERE id = $2", [deadlineId, id]);
      row.deadline_id = deadlineId;
    }
    void updateCaseEventBySource("corp", matterId, String(ownerId), `compliance-obligation:${id}`, {
      event_date: dateOnly(row.due_date) ?? undefined,
      title: `Compliance obligation: ${row.title}`,
    });
    res.json(row);
  });

  router.delete("/obligations/:id", async (req, res) => {
    const matterId = matterIdOf(req);
    const ownerId = ownerOf(req);
    const id = Number(req.params.id);
    const result = matterId && Number.isInteger(id)
      ? await pool.query(
          "DELETE FROM corp_compliance_obligations WHERE id = $1 AND matter_id = $2 AND access_code_id = $3 RETURNING deadline_id",
          [id, matterId, ownerId],
        )
      : { rows: [] };
    if (!result.rows[0]) {
      res.status(404).json({ error: "Obligation not found" });
      return;
    }
    await deleteWorkflowDeadline(result.rows[0].deadline_id, matterId!, ownerId);
    void deleteCaseEventBySource("corp", matterId!, String(ownerId), `compliance-obligation:${id}`);
    res.json({ success: true });
  });

  router.post("/transactions", async (req, res) => {
    const matterId = matterIdOf(req);
    const ownerId = ownerOf(req);
    if (!matterId || !(await ownedMatter(matterId, ownerId))) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }
    const title = cleanText(req.body?.title, 300);
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const targetDate = cleanDate(req.body?.target_date) ?? null;
    const status = TRANSACTION_STATUSES.includes(req.body?.status) ? req.body.status : "open";
    const approvalStatus = APPROVAL_STATUSES.includes(req.body?.approval_status) ? req.body.approval_status : "pending";
    const result = await pool.query(
      `INSERT INTO corp_transaction_items
        (matter_id, access_code_id, title, item_type, counterparty, target_date, status,
         version_label, deviation, fallback_position, approval_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        matterId, ownerId, title, cleanText(req.body?.item_type, 80) ?? "contract",
        cleanText(req.body?.counterparty, 300) ?? null, targetDate, status,
        cleanText(req.body?.version_label, 100) ?? "v1",
        cleanText(req.body?.deviation, 5000) ?? null,
        cleanText(req.body?.fallback_position, 5000) ?? null,
        approvalStatus, cleanText(req.body?.notes, 5000) ?? null,
      ],
    );
    const row = result.rows[0];
    const deadlineId = await mirrorWorkflowDeadline(matterId, ownerId, null, `Closing: ${title}`, targetDate, "closing", status === "complete" ? "completed" : "pending");
    if (deadlineId) {
      await pool.query("UPDATE corp_transaction_items SET deadline_id = $1 WHERE id = $2", [deadlineId, row.id]);
      row.deadline_id = deadlineId;
    }
    void recordCaseEvent("corp", matterId, String(ownerId), {
      event_date: targetDate ?? new Date().toISOString().slice(0, 10),
      title: `Transaction item added: ${title}`,
      kind: "deadline",
      source: `transaction-item:${row.id}`,
    });
    res.status(201).json(row);
  });

  router.patch("/transactions/:id", async (req, res) => {
    const matterId = matterIdOf(req);
    const ownerId = ownerOf(req);
    const id = Number(req.params.id);
    if (!matterId || !Number.isInteger(id)) {
      res.status(404).json({ error: "Transaction item not found" });
      return;
    }
    const current = await pool.query(
      "SELECT * FROM corp_transaction_items WHERE id = $1 AND matter_id = $2 AND access_code_id = $3",
      [id, matterId, ownerId],
    );
    if (!current.rows[0]) {
      res.status(404).json({ error: "Transaction item not found" });
      return;
    }
    const body = req.body ?? {};
    const result = await pool.query(
      `UPDATE corp_transaction_items
       SET title = COALESCE($1::text, title), item_type = COALESCE($2::text, item_type),
           counterparty = COALESCE($3::text, counterparty), target_date = COALESCE($4::date, target_date),
           status = COALESCE($5::text, status), version_label = COALESCE($6::text, version_label),
           deviation = COALESCE($7::text, deviation), fallback_position = COALESCE($8::text, fallback_position),
           approval_status = COALESCE($9::text, approval_status),
           approved_by = CASE WHEN $9::text = 'approved' THEN COALESCE($10::text, approved_by) ELSE approved_by END,
           approved_at = CASE WHEN $9::text = 'approved' THEN now() ELSE approved_at END,
           notes = COALESCE($11::text, notes), updated_at = now()
       WHERE id = $12 AND matter_id = $13 AND access_code_id = $14
       RETURNING *`,
      [
        cleanText(body.title, 300), cleanText(body.item_type, 80), cleanText(body.counterparty, 300),
        cleanDate(body.target_date), TRANSACTION_STATUSES.includes(body.status) ? body.status : undefined,
        cleanText(body.version_label, 100), cleanText(body.deviation, 5000),
        cleanText(body.fallback_position, 5000),
        APPROVAL_STATUSES.includes(body.approval_status) ? body.approval_status : undefined,
        cleanText(body.approved_by, 200), cleanText(body.notes, 5000), id, matterId, ownerId,
      ],
    );
    const row = result.rows[0];
    const deadlineId = await mirrorWorkflowDeadline(matterId, ownerId, row.deadline_id, `Closing: ${row.title}`, dateOnly(row.target_date), "closing", row.status === "complete" ? "completed" : "pending");
    if (deadlineId !== row.deadline_id) {
      await pool.query("UPDATE corp_transaction_items SET deadline_id = $1 WHERE id = $2", [deadlineId, id]);
      row.deadline_id = deadlineId;
    }
    void updateCaseEventBySource("corp", matterId, String(ownerId), `transaction-item:${id}`, {
      event_date: dateOnly(row.target_date) ?? undefined,
      title: `Transaction item: ${row.title}`,
    });
    res.json(row);
  });

  router.delete("/transactions/:id", async (req, res) => {
    const matterId = matterIdOf(req);
    const ownerId = ownerOf(req);
    const id = Number(req.params.id);
    const result = matterId && Number.isInteger(id)
      ? await pool.query(
          "DELETE FROM corp_transaction_items WHERE id = $1 AND matter_id = $2 AND access_code_id = $3 RETURNING deadline_id",
          [id, matterId, ownerId],
        )
      : { rows: [] };
    if (!result.rows[0]) {
      res.status(404).json({ error: "Transaction item not found" });
      return;
    }
    await deleteWorkflowDeadline(result.rows[0].deadline_id, matterId!, ownerId);
    void deleteCaseEventBySource("corp", matterId!, String(ownerId), `transaction-item:${id}`);
    res.json({ success: true });
  });

  router.put("/review", async (req, res) => {
    const matterId = matterIdOf(req);
    const ownerId = ownerOf(req);
    if (!matterId || !(await ownedMatter(matterId, ownerId))) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }
    const finalised = req.body?.finalised === true;
    const evidenceStatus = cleanText(req.body?.evidence_status, 80) ?? "needs_review";
    if (finalised && evidenceStatus !== "verified") {
      res.status(400).json({ error: "Evidence must be verified before finalisation" });
      return;
    }
    const existing = await pool.query(
      "SELECT finalised FROM corp_matter_reviews WHERE matter_id = $1 AND access_code_id = $2",
      [matterId, ownerId],
    );
    if (existing.rows[0]?.finalised) {
      res.status(409).json({ error: "This workflow is finalised and cannot be changed" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO corp_matter_reviews
        (matter_id, access_code_id, reviewer_name, evidence_status, assumptions, finalised, finalised_at)
       VALUES ($1,$2,$3,$4,$5,$6,CASE WHEN $6 THEN now() ELSE NULL END)
       ON CONFLICT (matter_id, access_code_id) DO UPDATE SET
         reviewer_name = EXCLUDED.reviewer_name, evidence_status = EXCLUDED.evidence_status,
         assumptions = EXCLUDED.assumptions, finalised = EXCLUDED.finalised,
         finalised_at = EXCLUDED.finalised_at, updated_at = now()
       RETURNING *`,
      [
        matterId, ownerId, cleanText(req.body?.reviewer_name, 200) ?? null, evidenceStatus,
        cleanText(req.body?.assumptions, 10000) ?? null, finalised,
      ],
    );
    res.json(result.rows[0]);
  });

  return router;
}

export async function ensureCorpWorkflowTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS corp_compliance_obligations (
      id serial PRIMARY KEY,
      matter_id integer NOT NULL REFERENCES corp_matters(id) ON DELETE CASCADE,
      access_code_id integer NOT NULL REFERENCES corp_access_codes(id) ON DELETE CASCADE,
      title text NOT NULL,
      authority text,
      owner_name text,
      due_date date,
      status text NOT NULL DEFAULT 'open',
      risk text NOT NULL DEFAULT 'medium',
      evidence_note text,
      source_reference text,
      deadline_id integer,
      verified_by text,
      verified_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS corp_compliance_obligations_owner_idx
      ON corp_compliance_obligations (access_code_id, matter_id);
    CREATE TABLE IF NOT EXISTS corp_transaction_items (
      id serial PRIMARY KEY,
      matter_id integer NOT NULL REFERENCES corp_matters(id) ON DELETE CASCADE,
      access_code_id integer NOT NULL REFERENCES corp_access_codes(id) ON DELETE CASCADE,
      title text NOT NULL,
      item_type text NOT NULL DEFAULT 'contract',
      counterparty text,
      target_date date,
      status text NOT NULL DEFAULT 'open',
      version_label text NOT NULL DEFAULT 'v1',
      deviation text,
      fallback_position text,
      approval_status text NOT NULL DEFAULT 'pending',
      approved_by text,
      approved_at timestamptz,
      notes text,
      deadline_id integer,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS corp_transaction_items_owner_idx
      ON corp_transaction_items (access_code_id, matter_id);
    CREATE TABLE IF NOT EXISTS corp_matter_reviews (
      id serial PRIMARY KEY,
      matter_id integer NOT NULL REFERENCES corp_matters(id) ON DELETE CASCADE,
      access_code_id integer NOT NULL REFERENCES corp_access_codes(id) ON DELETE CASCADE,
      reviewer_name text,
      evidence_status text NOT NULL DEFAULT 'needs_review',
      assumptions text,
      finalised boolean NOT NULL DEFAULT false,
      finalised_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (matter_id, access_code_id)
    );
  `);
  logger.info("corporate workflow tables ensured");
}