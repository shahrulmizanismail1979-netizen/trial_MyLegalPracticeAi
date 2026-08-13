import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { sql, and, asc, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  syaMattersTable,
  syaMatterDeadlinesTable,
  syaSavedWorkTable,
} from "@workspace/db/sya";
import { requireAuth } from "../../lib/auth";
import {
  computeSyaDeadlines,
  SYA_DEADLINE_TRIGGERS,
} from "../../lib/syariahDeadlines";
import { logger } from "../../../lib/logger";
import { attachCaseIntelligence, triggerChecklistGeneration, triggerIntakeBriefing } from "../../../lib/attachCaseIntelligence";

const router: IRouter = Router();

// ── Boot-time table ensure ───────────────────────────────────────────────────
// New tables are created via direct SQL (drizzle push proposes unsafe renames
// in this schema). This ensure also creates them in production on next deploy.
export async function ensureSyaMatterTables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sya_matters (
      id serial PRIMARY KEY,
      owner_type text NOT NULL,
      owner_id integer NOT NULL,
      title text NOT NULL,
      client_name text,
      acting_for text,
      plaintiff text,
      defendant text,
      matter_type text,
      court text,
      case_no text,
      claim_amount numeric(14,2),
      workflow_id integer,
      status text NOT NULL DEFAULT 'active',
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_sya_matters_owner ON sya_matters (owner_type, owner_id);
    CREATE TABLE IF NOT EXISTS sya_matter_deadlines (
      id serial PRIMARY KEY,
      matter_id integer NOT NULL REFERENCES sya_matters(id) ON DELETE CASCADE,
      owner_type text NOT NULL,
      owner_id integer NOT NULL,
      title text NOT NULL,
      due_date timestamptz NOT NULL,
      category text NOT NULL DEFAULT 'custom',
      status text NOT NULL DEFAULT 'pending',
      basis text,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_sya_matter_deadlines_owner ON sya_matter_deadlines (owner_type, owner_id);
    CREATE TABLE IF NOT EXISTS sya_saved_work (
      id serial PRIMARY KEY,
      owner_type text NOT NULL,
      owner_id integer NOT NULL,
      matter_id integer REFERENCES sya_matters(id) ON DELETE CASCADE,
      kind text NOT NULL,
      title text NOT NULL,
      matter text,
      input_json jsonb,
      content text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_sya_saved_work_owner ON sya_saved_work (owner_type, owner_id);
  `);
}

ensureSyaMatterTables().catch((err) =>
  logger.error({ err }, "Failed to ensure sya matter tables"),
);

// ── Ownership helpers ────────────────────────────────────────────────────────
// Sya sessions identify the caller by (accountType, userId); "code" ids and
// "email" ids are separate serial spaces, so rows are scoped by both.
interface Owner {
  ownerType: string;
  ownerId: number;
}

function getOwner(req: Request): Owner {
  return {
    ownerType: req.session.accountType ?? "code",
    ownerId: req.session.userId as number,
  };
}

router.use(requireAuth as (req: Request, res: Response, next: NextFunction) => void);

const MAX_NOTES = 20_000;
const MAX_CONTENT = 500_000;

function ownerCond(o: Owner) {
  return and(
    eq(syaMattersTable.ownerType, o.ownerType),
    eq(syaMattersTable.ownerId, o.ownerId),
  );
}

// Fetch a matter and assert it belongs to the caller.
async function getOwnedMatter(req: Request, res: Response, idParam: string) {
  const owner = getOwner(req);
  const id = parseInt(idParam, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid matter id" });
    return undefined;
  }
  const [row] = await db
    .select()
    .from(syaMattersTable)
    .where(and(eq(syaMattersTable.id, id), ownerCond(owner)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Matter not found" });
    return undefined;
  }
  return row;
}

// ── Static / aggregate routes (must precede "/:id") ──────────────────────────

router.get("/matters/deadline-triggers", (_req, res) => {
  res.json(SYA_DEADLINE_TRIGGERS);
});

router.get("/matters/deadlines/upcoming", async (req, res) => {
  const owner = getOwner(req);
  const days = Math.min(
    Math.max(parseInt(String(req.query.days ?? "60"), 10) || 60, 1),
    365,
  );
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + days);
  const rows = await db
    .select({
      id: syaMatterDeadlinesTable.id,
      matterId: syaMatterDeadlinesTable.matterId,
      title: syaMatterDeadlinesTable.title,
      dueDate: syaMatterDeadlinesTable.dueDate,
      category: syaMatterDeadlinesTable.category,
      status: syaMatterDeadlinesTable.status,
      basis: syaMatterDeadlinesTable.basis,
      notes: syaMatterDeadlinesTable.notes,
      matterTitle: syaMattersTable.title,
      caseNo: syaMattersTable.caseNo,
    })
    .from(syaMatterDeadlinesTable)
    .innerJoin(
      syaMattersTable,
      eq(syaMatterDeadlinesTable.matterId, syaMattersTable.id),
    )
    .where(
      and(
        eq(syaMatterDeadlinesTable.ownerType, owner.ownerType),
        eq(syaMatterDeadlinesTable.ownerId, owner.ownerId),
        eq(syaMatterDeadlinesTable.status, "pending"),
      ),
    )
    .orderBy(asc(syaMatterDeadlinesTable.dueDate));
  const horizonMs = horizon.getTime();
  res.json(rows.filter((r) => new Date(r.dueDate).getTime() <= horizonMs));
});

// ── Matter CRUD ──────────────────────────────────────────────────────────────

router.get("/matters", async (req, res) => {
  const owner = getOwner(req);
  const { status } = req.query;
  const where =
    status && typeof status === "string"
      ? and(ownerCond(owner), eq(syaMattersTable.status, status))
      : ownerCond(owner);
  const rows = await db
    .select()
    .from(syaMattersTable)
    .where(where)
    .orderBy(desc(syaMattersTable.updatedAt));
  res.json(rows);
});

router.get("/matters/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const deadlines = await db
    .select()
    .from(syaMatterDeadlinesTable)
    .where(eq(syaMatterDeadlinesTable.matterId, matter.id))
    .orderBy(asc(syaMatterDeadlinesTable.dueDate));
  res.json({ ...matter, deadlines });
});

function normaliseMatterBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const strFields = [
    "title",
    "clientName",
    "actingFor",
    "plaintiff",
    "defendant",
    "matterType",
    "court",
    "caseNo",
    "status",
  ];
  for (const f of strFields) {
    const v = body[f];
    if (typeof v === "string") out[f] = v.slice(0, 500);
  }
  if (typeof body.notes === "string") out.notes = body.notes.slice(0, MAX_NOTES);
  if (
    body.claimAmount !== undefined &&
    body.claimAmount !== null &&
    body.claimAmount !== ""
  ) {
    const n = Number(body.claimAmount);
    if (!Number.isNaN(n)) out.claimAmount = String(n);
  } else if (body.claimAmount === null || body.claimAmount === "") {
    out.claimAmount = null;
  }
  if (body.workflowId !== undefined) {
    if (body.workflowId === null || body.workflowId === "") out.workflowId = null;
    else {
      const n = Number(body.workflowId);
      if (Number.isInteger(n)) out.workflowId = n;
    }
  }
  return out;
}

router.post("/matters", async (req, res) => {
  const owner = getOwner(req);
  const data = normaliseMatterBody(req.body ?? {});
  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const [row] = await db
    .insert(syaMattersTable)
    .values({
      ...(data as object),
      ...owner,
      title: (data.title as string).trim(),
    })
    .returning();
  triggerChecklistGeneration(
    "sya",
    row.id,
    `${owner.ownerType}:${owner.ownerId}`,
    row.title,
    (row as unknown as Record<string, unknown>).matterType as string | null,
  );
  if (req.body?.hasDocuments === true) {
    triggerIntakeBriefing("sya", row.id, `${owner.ownerType}:${owner.ownerId}`, row as unknown as Record<string, unknown>);
  }
  res.status(201).json(row);
});

router.patch("/matters/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const data = normaliseMatterBody(req.body ?? {});
  const [row] = await db
    .update(syaMattersTable)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(eq(syaMattersTable.id, matter.id))
    .returning();
  res.json(row);
});

router.delete("/matters/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  await db.delete(syaMattersTable).where(eq(syaMattersTable.id, matter.id));
  res.json({ success: true });
});

// ── Filed documents (saved work) ─────────────────────────────────────────────

router.get("/matters/:id/work", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const owner = getOwner(req);
  const rows = await db
    .select()
    .from(syaSavedWorkTable)
    .where(
      and(
        eq(syaSavedWorkTable.matterId, matter.id),
        eq(syaSavedWorkTable.ownerType, owner.ownerType),
        eq(syaSavedWorkTable.ownerId, owner.ownerId),
      ),
    )
    .orderBy(desc(syaSavedWorkTable.updatedAt));
  res.json(rows);
});

// File a draft/document into a matter.
router.post("/matters/:id/work", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const owner = getOwner(req);
  const { kind, title, content, inputJson } = req.body ?? {};
  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  const [row] = await db
    .insert(syaSavedWorkTable)
    .values({
      ...owner,
      matterId: matter.id,
      kind: typeof kind === "string" && kind ? kind.slice(0, 50) : "draft",
      title: title.trim().slice(0, 500),
      matter: matter.title,
      inputJson: inputJson ?? null,
      content: content.slice(0, MAX_CONTENT),
    })
    .returning();
  res.status(201).json(row);
});

router.delete("/matters/:id/work/:wid", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const wid = parseInt(req.params.wid as string, 10);
  if (Number.isNaN(wid)) {
    res.status(400).json({ error: "Invalid work id" });
    return;
  }
  const [row] = await db
    .delete(syaSavedWorkTable)
    .where(
      and(
        eq(syaSavedWorkTable.id, wid),
        eq(syaSavedWorkTable.matterId, matter.id),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json({ success: true });
});

// ── Deadlines ────────────────────────────────────────────────────────────────

router.get("/matters/:id/deadlines", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const rows = await db
    .select()
    .from(syaMatterDeadlinesTable)
    .where(eq(syaMatterDeadlinesTable.matterId, matter.id))
    .orderBy(asc(syaMatterDeadlinesTable.dueDate));
  res.json(rows);
});

// Preview the standard deadlines a trigger produces — a pure calculator.
router.post("/matters/:id/deadlines/compute", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const { trigger, triggerDate } = req.body ?? {};
  if (typeof trigger !== "string" || typeof triggerDate !== "string") {
    res.status(400).json({ error: "trigger and triggerDate are required" });
    return;
  }
  res.json(computeSyaDeadlines(trigger, triggerDate));
});

function normaliseDeadlineBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (typeof body.title === "string") out.title = body.title.slice(0, 500);
  if (typeof body.category === "string") out.category = body.category.slice(0, 50);
  if (typeof body.basis === "string") out.basis = body.basis.slice(0, 500);
  if (typeof body.notes === "string") out.notes = body.notes.slice(0, MAX_NOTES);
  if (typeof body.status === "string") out.status = body.status.slice(0, 20);
  if (typeof body.dueDate === "string") {
    const d = new Date(body.dueDate);
    if (!Number.isNaN(d.getTime())) out.dueDate = d;
  }
  return out;
}

router.post("/matters/:id/deadlines", async (req, res) => {
  const owner = getOwner(req);
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const data = normaliseDeadlineBody(req.body ?? {});
  if (!data.title) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (!data.dueDate) {
    res.status(400).json({ error: "a valid dueDate is required" });
    return;
  }
  const [row] = await db
    .insert(syaMatterDeadlinesTable)
    .values({
      ...(data as { title: string; dueDate: Date }),
      matterId: matter.id,
      ...owner,
    })
    .returning();
  res.status(201).json(row);
});

// Bulk-add an array of deadlines (used after previewing computed deadlines).
router.post("/matters/:id/deadlines/bulk", async (req, res) => {
  const owner = getOwner(req);
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const items = Array.isArray(req.body?.deadlines) ? req.body.deadlines : [];
  const values = items
    .map((it: Record<string, unknown>) => normaliseDeadlineBody(it))
    .filter((d: Record<string, unknown>) => d.title && d.dueDate)
    .map((d: Record<string, unknown>) => ({
      ...(d as { title: string; dueDate: Date }),
      matterId: matter.id,
      ...owner,
    }));
  if (values.length === 0) {
    res.status(400).json({ error: "no valid deadlines provided" });
    return;
  }
  const rows = await db.insert(syaMatterDeadlinesTable).values(values).returning();
  res.status(201).json(rows);
});

router.patch("/matters/:id/deadlines/:did", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const did = parseInt(req.params.did as string, 10);
  if (Number.isNaN(did)) {
    res.status(400).json({ error: "Invalid deadline id" });
    return;
  }
  const data = normaliseDeadlineBody(req.body ?? {});
  const [row] = await db
    .update(syaMatterDeadlinesTable)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(
      and(
        eq(syaMatterDeadlinesTable.id, did),
        eq(syaMatterDeadlinesTable.matterId, matter.id),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Deadline not found" });
    return;
  }
  res.json(row);
});

router.delete("/matters/:id/deadlines/:did", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const did = parseInt(req.params.did as string, 10);
  if (Number.isNaN(did)) {
    res.status(400).json({ error: "Invalid deadline id" });
    return;
  }
  const [row] = await db
    .delete(syaMatterDeadlinesTable)
    .where(
      and(
        eq(syaMatterDeadlinesTable.id, did),
        eq(syaMatterDeadlinesTable.matterId, matter.id),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Deadline not found" });
    return;
  }
  res.json({ success: true });
});

// ── AI Case Intelligence ─────────────────────────────────────────────────────
// Uses pathPrefix "/matters" because this router mounts its routes as
// /matters/:id (unlike lit/crim which mount at the router root).

attachCaseIntelligence({
  router,
  portal: "sya",
  pathPrefix: "/matters",
  getOwnerKey: (req) => {
    const userId = req.session.userId;
    const accountType = req.session.accountType ?? "code";
    if (typeof userId !== "number") return null;
    return `${accountType}:${userId}`;
  },
  getMatter: (req, res, id) => getOwnedMatter(req, res, id),
});

export default router;
