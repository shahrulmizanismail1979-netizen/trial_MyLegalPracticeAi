import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { sql, and, asc, desc, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { accMatters, accMatterDeadlines, accSavedWork } from "@workspace/db/schema";
import { requireMatterTenant, ownerOf } from "./matterAuth";
import { computeAccDeadlines, ACC_DEADLINE_TRIGGERS } from "./lib/accidentDeadlines";
import { logger } from "../lib/logger";
import {
  attachCaseIntelligence,
  triggerChecklistGeneration,
} from "../lib/attachCaseIntelligence";

const router: IRouter = Router();

const MAX_NOTES = 20_000;
const MAX_CONTENT = 500_000;
const MAX_INPUT_JSON = 200_000;

// ── Boot-time table ensure ───────────────────────────────────────────────────
// New tables are created via direct SQL (drizzle push proposes unsafe renames
// in this schema — see the rename-trap memory). Awaited before the server
// listens so early requests can never race table creation.
let ensured: Promise<void> | null = null;

export function ensureAccMatterTables(): Promise<void> {
  if (!ensured) {
    ensured = db
      .execute(sql`
        CREATE TABLE IF NOT EXISTS acc_matters (
          id serial PRIMARY KEY,
          owner_id integer NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
          title text NOT NULL,
          file_ref text,
          client_name text,
          acting_for text,
          plaintiff text,
          defendant text,
          matter_type text,
          court text,
          case_no text,
          claim_amount numeric(14,2),
          status text NOT NULL DEFAULT 'open',
          notes text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_acc_matters_owner ON acc_matters (owner_id);
        CREATE TABLE IF NOT EXISTS acc_matter_deadlines (
          id serial PRIMARY KEY,
          matter_id integer NOT NULL REFERENCES acc_matters(id) ON DELETE CASCADE,
          owner_id integer NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
          title text NOT NULL,
          due_date timestamptz NOT NULL,
          category text NOT NULL DEFAULT 'custom',
          status text NOT NULL DEFAULT 'pending',
          basis text,
          notes text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_acc_matter_deadlines_matter ON acc_matter_deadlines (matter_id);
        CREATE INDEX IF NOT EXISTS idx_acc_matter_deadlines_owner ON acc_matter_deadlines (owner_id);
        CREATE TABLE IF NOT EXISTS acc_saved_work (
          id serial PRIMARY KEY,
          owner_id integer NOT NULL REFERENCES access_codes(id) ON DELETE CASCADE,
          matter_id integer,
          kind text NOT NULL,
          title text NOT NULL,
          matter text,
          input_json jsonb,
          content text NOT NULL DEFAULT '',
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_acc_saved_work_owner ON acc_saved_work (owner_id);
      `)
      .then(() => {
        logger.info("acc matter tables ensured");
      })
      .catch((err) => {
        ensured = null; // allow retry
        logger.error({ err }, "Failed to ensure acc matter tables");
        throw err;
      });
  }
  return ensured;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
router.use(
  requireMatterTenant as (req: Request, res: Response, next: NextFunction) => void,
);

// ── Ownership helpers ─────────────────────────────────────────────────────────
async function getOwnedMatter(req: Request, res: Response, idParam: string) {
  const ownerId = ownerOf(req);
  const id = parseInt(idParam, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid matter id" });
    return undefined;
  }
  const [row] = await db
    .select()
    .from(accMatters)
    .where(and(eq(accMatters.id, id), eq(accMatters.ownerId, ownerId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Matter not found" });
    return undefined;
  }
  return row;
}

// ── Static / aggregate routes (must precede "/matters/:id") ───────────────────

router.get("/matters/deadline-triggers", (_req, res) => {
  res.json(ACC_DEADLINE_TRIGGERS);
});

router.get("/matters/deadlines/upcoming", async (req, res) => {
  const ownerId = ownerOf(req);
  const days = Math.min(
    Math.max(parseInt(String(req.query.days ?? "60"), 10) || 60, 1),
    365,
  );
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + days);
  const rows = await db
    .select({
      id: accMatterDeadlines.id,
      matterId: accMatterDeadlines.matterId,
      title: accMatterDeadlines.title,
      dueDate: accMatterDeadlines.dueDate,
      category: accMatterDeadlines.category,
      status: accMatterDeadlines.status,
      basis: accMatterDeadlines.basis,
      notes: accMatterDeadlines.notes,
      matterTitle: accMatters.title,
      caseNo: accMatters.caseNo,
    })
    .from(accMatterDeadlines)
    .innerJoin(accMatters, eq(accMatterDeadlines.matterId, accMatters.id))
    .where(
      and(
        eq(accMatterDeadlines.ownerId, ownerId),
        eq(accMatterDeadlines.status, "pending"),
      ),
    )
    .orderBy(asc(accMatterDeadlines.dueDate));
  const horizonMs = horizon.getTime();
  res.json(rows.filter((r) => new Date(r.dueDate).getTime() <= horizonMs));
});

// ── Matter CRUD ────────────────────────────────────────────────────────────────

router.get("/matters", async (req, res) => {
  const ownerId = ownerOf(req);
  const { status } = req.query;
  const where =
    status && typeof status === "string"
      ? and(eq(accMatters.ownerId, ownerId), eq(accMatters.status, status))
      : eq(accMatters.ownerId, ownerId);
  const rows = await db
    .select()
    .from(accMatters)
    .where(where)
    .orderBy(desc(accMatters.updatedAt));
  res.json(rows);
});

router.get("/matters/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const deadlines = await db
    .select()
    .from(accMatterDeadlines)
    .where(eq(accMatterDeadlines.matterId, matter.id))
    .orderBy(asc(accMatterDeadlines.dueDate));
  res.json({ ...matter, deadlines });
});

function normaliseMatterBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const strFields = [
    "title",
    "fileRef",
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
  return out;
}

router.post("/matters", async (req, res) => {
  const ownerId = ownerOf(req);
  const data = normaliseMatterBody(req.body ?? {});
  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const [row] = await db
    .insert(accMatters)
    .values({
      ...(data as object),
      ownerId,
      title: (data.title as string).trim(),
    })
    .returning();
  triggerChecklistGeneration(
    "acc",
    row.id,
    String(ownerId),
    row.title,
    row.matterType ?? null,
  );
  res.status(201).json(row);
});

router.patch("/matters/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const data = normaliseMatterBody(req.body ?? {});
  const [row] = await db
    .update(accMatters)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(eq(accMatters.id, matter.id))
    .returning();
  res.json(row);
});

router.delete("/matters/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  await db.delete(accMatters).where(eq(accMatters.id, matter.id));
  res.json({ success: true });
});

// ── Filed documents (saved work linked to a matter) ───────────────────────────

router.get("/matters/:id/work", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const ownerId = ownerOf(req);
  const rows = await db
    .select()
    .from(accSavedWork)
    .where(
      and(eq(accSavedWork.matterId, matter.id), eq(accSavedWork.ownerId, ownerId)),
    )
    .orderBy(desc(accSavedWork.updatedAt));
  res.json(rows);
});

router.post("/matters/:id/work", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const ownerId = ownerOf(req);
  const { kind, title, content, inputJson } = req.body ?? {};
  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }
  if (content.length > MAX_CONTENT) {
    res.status(413).json({ error: "content too large" });
    return;
  }
  if (inputJson != null && JSON.stringify(inputJson).length > MAX_INPUT_JSON) {
    res.status(413).json({ error: "inputJson too large" });
    return;
  }
  const [row] = await db
    .insert(accSavedWork)
    .values({
      ownerId,
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
    .delete(accSavedWork)
    .where(and(eq(accSavedWork.id, wid), eq(accSavedWork.matterId, matter.id)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json({ success: true });
});

// ── Deadlines ──────────────────────────────────────────────────────────────────

router.get("/matters/:id/deadlines", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const rows = await db
    .select()
    .from(accMatterDeadlines)
    .where(eq(accMatterDeadlines.matterId, matter.id))
    .orderBy(asc(accMatterDeadlines.dueDate));
  res.json(rows);
});

router.post("/matters/:id/deadlines/compute", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const { trigger, triggerDate } = req.body ?? {};
  if (typeof trigger !== "string" || typeof triggerDate !== "string") {
    res.status(400).json({ error: "trigger and triggerDate are required" });
    return;
  }
  res.json(computeAccDeadlines(trigger, triggerDate));
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
  const ownerId = ownerOf(req);
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
    .insert(accMatterDeadlines)
    .values({
      ...(data as { title: string; dueDate: Date }),
      matterId: matter.id,
      ownerId,
    })
    .returning();
  res.status(201).json(row);
});

router.post("/matters/:id/deadlines/bulk", async (req, res) => {
  const ownerId = ownerOf(req);
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const items = Array.isArray(req.body?.deadlines) ? req.body.deadlines : [];
  const values = items
    .map((it: Record<string, unknown>) => normaliseDeadlineBody(it))
    .filter((d: Record<string, unknown>) => d.title && d.dueDate)
    .map((d: Record<string, unknown>) => ({
      ...(d as { title: string; dueDate: Date }),
      matterId: matter.id,
      ownerId,
    }));
  if (values.length === 0) {
    res.status(400).json({ error: "no valid deadlines provided" });
    return;
  }
  const rows = await db.insert(accMatterDeadlines).values(values).returning();
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
    .update(accMatterDeadlines)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(
      and(
        eq(accMatterDeadlines.id, did),
        eq(accMatterDeadlines.matterId, matter.id),
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
    .delete(accMatterDeadlines)
    .where(
      and(
        eq(accMatterDeadlines.id, did),
        eq(accMatterDeadlines.matterId, matter.id),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Deadline not found" });
    return;
  }
  res.json({ success: true });
});

// ── Saved work (standalone, may or may not link to a matter) ──────────────────

router.get("/saved-work", async (req, res) => {
  const ownerId = ownerOf(req);
  const { kind } = req.query;
  const where =
    kind && typeof kind === "string"
      ? and(eq(accSavedWork.ownerId, ownerId), eq(accSavedWork.kind, kind))
      : eq(accSavedWork.ownerId, ownerId);
  const rows = await db
    .select()
    .from(accSavedWork)
    .where(where)
    .orderBy(desc(accSavedWork.updatedAt));
  res.json(rows);
});

router.get("/saved-work/:id", async (req, res) => {
  const ownerId = ownerOf(req);
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(accSavedWork)
    .where(and(eq(accSavedWork.id, id), eq(accSavedWork.ownerId, ownerId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.post("/saved-work", async (req, res) => {
  const ownerId = ownerOf(req);
  const { kind, title, matter, inputJson, content, matterId } = req.body ?? {};
  if (!kind || typeof kind !== "string") {
    res.status(400).json({ error: "kind is required" });
    return;
  }
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (typeof content === "string" && content.length > MAX_CONTENT) {
    res.status(413).json({ error: "content too large" });
    return;
  }
  if (inputJson != null && JSON.stringify(inputJson).length > MAX_INPUT_JSON) {
    res.status(413).json({ error: "inputJson too large" });
    return;
  }
  // If linking to a matter, verify the caller owns it (no cross-tenant attach).
  let linkedMatterId: number | null = null;
  if (typeof matterId === "number") {
    const [owned] = await db
      .select({ id: accMatters.id })
      .from(accMatters)
      .where(and(eq(accMatters.id, matterId), eq(accMatters.ownerId, ownerId)))
      .limit(1);
    if (!owned) {
      res.status(404).json({ error: "matter not found" });
      return;
    }
    linkedMatterId = owned.id;
  }
  const [row] = await db
    .insert(accSavedWork)
    .values({
      ownerId,
      matterId: linkedMatterId,
      kind,
      title: title.slice(0, 300),
      matter:
        typeof matter === "string" && matter.trim() ? matter.slice(0, 300) : null,
      inputJson: inputJson ?? null,
      content: typeof content === "string" ? content : "",
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/saved-work/:id", async (req, res) => {
  const ownerId = ownerOf(req);
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { title, matter, content, inputJson } = req.body ?? {};
  if (typeof content === "string" && content.length > MAX_CONTENT) {
    res.status(413).json({ error: "content too large" });
    return;
  }
  if (
    inputJson !== undefined &&
    inputJson != null &&
    JSON.stringify(inputJson).length > MAX_INPUT_JSON
  ) {
    res.status(413).json({ error: "inputJson too large" });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof title === "string") updates.title = title.slice(0, 300);
  if (typeof matter === "string")
    updates.matter = matter.trim() ? matter.slice(0, 300) : null;
  if (typeof content === "string") updates.content = content;
  if (inputJson !== undefined) updates.inputJson = inputJson;
  const [row] = await db
    .update(accSavedWork)
    .set(updates)
    .where(and(eq(accSavedWork.id, id), eq(accSavedWork.ownerId, ownerId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/saved-work/:id", async (req, res) => {
  const ownerId = ownerOf(req);
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .delete(accSavedWork)
    .where(and(eq(accSavedWork.id, id), eq(accSavedWork.ownerId, ownerId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ success: true });
});

// ── AI Case Intelligence ─────────────────────────────────────────────────────
// Adds ai-insights, stage-history, status, checklist and time-entries, all
// under the "/matters" prefix and scoped by owner id.
attachCaseIntelligence({
  router,
  portal: "acc",
  pathPrefix: "/matters",
  getOwnerKey: (req) => {
    try {
      return String(ownerOf(req));
    } catch {
      return null;
    }
  },
  getMatter: (req, res, id) => getOwnedMatter(req, res, id),
});

export default router;
