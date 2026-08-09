import { Router, type IRouter, type Request, type Response } from "express";
import { db, crimMatters, crimMatterDeadlines, crimSavedWork } from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireMatterTenant, tenantOf } from "./matterAuth";
import { computeCrimDeadlines, CRIM_DEADLINE_TRIGGERS } from "../lib/crimDeadlines";
import { attachCaseIntelligence, triggerChecklistGeneration } from "../../lib/attachCaseIntelligence";

const router: IRouter = Router();

router.use(requireMatterTenant);

const MAX_NOTES = 20_000;

// Fetch a matter and assert it belongs to the caller. Foreign or nonexistent
// matter ids are indistinguishable: both 404.
async function getOwnedMatter(req: Request, res: Response, idParam: string) {
  const accessCodeId = tenantOf(req);
  const id = parseInt(idParam, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid matter id" });
    return undefined;
  }
  const [row] = await db
    .select()
    .from(crimMatters)
    .where(and(eq(crimMatters.id, id), eq(crimMatters.accessCodeId, accessCodeId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Matter not found" });
    return undefined;
  }
  return row;
}

// ── Static / aggregate routes (must precede "/:id") ──────────────────────────

router.get("/deadline-triggers", (_req, res) => {
  res.json(CRIM_DEADLINE_TRIGGERS);
});

router.get("/deadlines/upcoming", async (req, res) => {
  const accessCodeId = tenantOf(req);
  const days = Math.min(Math.max(parseInt(String(req.query.days ?? "60"), 10) || 60, 1), 365);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + days);
  const rows = await db
    .select({
      id: crimMatterDeadlines.id,
      matterId: crimMatterDeadlines.matterId,
      title: crimMatterDeadlines.title,
      dueDate: crimMatterDeadlines.dueDate,
      category: crimMatterDeadlines.category,
      status: crimMatterDeadlines.status,
      basis: crimMatterDeadlines.basis,
      notes: crimMatterDeadlines.notes,
      matterTitle: crimMatters.title,
      caseNo: crimMatters.caseNo,
    })
    .from(crimMatterDeadlines)
    .innerJoin(crimMatters, eq(crimMatterDeadlines.matterId, crimMatters.id))
    .where(
      and(
        eq(crimMatterDeadlines.accessCodeId, accessCodeId),
        eq(crimMatterDeadlines.status, "pending"),
      ),
    )
    .orderBy(asc(crimMatterDeadlines.dueDate));
  const horizonMs = horizon.getTime();
  res.json(rows.filter((r) => new Date(r.dueDate).getTime() <= horizonMs));
});

// ── Matter CRUD ──────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const accessCodeId = tenantOf(req);
  const { status } = req.query;
  const where =
    status && typeof status === "string"
      ? and(eq(crimMatters.accessCodeId, accessCodeId), eq(crimMatters.status, status))
      : eq(crimMatters.accessCodeId, accessCodeId);
  const rows = await db
    .select()
    .from(crimMatters)
    .where(where)
    .orderBy(desc(crimMatters.updatedAt));
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const deadlines = await db
    .select()
    .from(crimMatterDeadlines)
    .where(eq(crimMatterDeadlines.matterId, matter.id))
    .orderBy(asc(crimMatterDeadlines.dueDate));
  res.json({ ...matter, deadlines });
});

function normaliseMatterBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const strFields = [
    "title",
    "fileRef",
    "clientName",
    "accusedName",
    "charge",
    "court",
    "caseNo",
    "stage",
    "status",
  ];
  for (const f of strFields) {
    const v = body[f];
    if (typeof v === "string") out[f] = v.slice(0, 500);
  }
  if (typeof body.notes === "string") out.notes = body.notes.slice(0, MAX_NOTES);
  if (body.workflowId !== undefined) {
    if (body.workflowId === null || body.workflowId === "") out.workflowId = null;
    else {
      const n = Number(body.workflowId);
      if (Number.isInteger(n)) out.workflowId = n;
    }
  }
  return out;
}

router.post("/", async (req, res) => {
  const accessCodeId = tenantOf(req);
  const data = normaliseMatterBody(req.body ?? {});
  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const [row] = await db
    .insert(crimMatters)
    .values({ ...(data as object), accessCodeId, title: (data.title as string).trim() })
    .returning();
  triggerChecklistGeneration(
    "crim",
    row.id,
    String(accessCodeId),
    row.title,
    row.charge ?? null,
  );
  res.status(201).json(row);
});

router.patch("/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const data = normaliseMatterBody(req.body ?? {});
  const [row] = await db
    .update(crimMatters)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(eq(crimMatters.id, matter.id))
    .returning();
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  await db.delete(crimMatters).where(eq(crimMatters.id, matter.id));
  res.json({ success: true });
});

// ── Linked saved work ────────────────────────────────────────────────────────

router.get("/:id/work", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const accessCodeId = tenantOf(req);
  const rows = await db
    .select()
    .from(crimSavedWork)
    .where(
      and(
        eq(crimSavedWork.matterId, matter.id),
        eq(crimSavedWork.accessCodeId, accessCodeId),
      ),
    )
    .orderBy(desc(crimSavedWork.updatedAt));
  res.json(rows);
});

// ── Deadlines ────────────────────────────────────────────────────────────────

router.get("/:id/deadlines", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const rows = await db
    .select()
    .from(crimMatterDeadlines)
    .where(eq(crimMatterDeadlines.matterId, matter.id))
    .orderBy(asc(crimMatterDeadlines.dueDate));
  res.json(rows);
});

// Preview the standard deadlines a criminal-procedure trigger produces — a
// pure calculator, not a write.
router.post("/:id/deadlines/compute", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const { trigger, triggerDate } = req.body ?? {};
  if (typeof trigger !== "string" || typeof triggerDate !== "string") {
    res.status(400).json({ error: "trigger and triggerDate are required" });
    return;
  }
  res.json(computeCrimDeadlines(trigger, triggerDate));
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

router.post("/:id/deadlines", async (req, res) => {
  const accessCodeId = tenantOf(req);
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
    .insert(crimMatterDeadlines)
    .values({
      ...(data as { title: string; dueDate: Date }),
      matterId: matter.id,
      accessCodeId,
    })
    .returning();
  res.status(201).json(row);
});

router.post("/:id/deadlines/bulk", async (req, res) => {
  const accessCodeId = tenantOf(req);
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const items = Array.isArray(req.body?.deadlines) ? req.body.deadlines : [];
  const values = items
    .map((it: Record<string, unknown>) => normaliseDeadlineBody(it))
    .filter((d: Record<string, unknown>) => d.title && d.dueDate)
    .map((d: Record<string, unknown>) => ({
      ...(d as { title: string; dueDate: Date }),
      matterId: matter.id,
      accessCodeId,
    }));
  if (values.length === 0) {
    res.status(400).json({ error: "no valid deadlines provided" });
    return;
  }
  const rows = await db.insert(crimMatterDeadlines).values(values).returning();
  res.status(201).json(rows);
});

router.patch("/:id/deadlines/:did", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const did = parseInt(req.params.did as string, 10);
  if (Number.isNaN(did)) {
    res.status(400).json({ error: "Invalid deadline id" });
    return;
  }
  const data = normaliseDeadlineBody(req.body ?? {});
  const [row] = await db
    .update(crimMatterDeadlines)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(
      and(
        eq(crimMatterDeadlines.id, did),
        eq(crimMatterDeadlines.matterId, matter.id),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Deadline not found" });
    return;
  }
  res.json(row);
});

router.delete("/:id/deadlines/:did", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const did = parseInt(req.params.did as string, 10);
  if (Number.isNaN(did)) {
    res.status(400).json({ error: "Invalid deadline id" });
    return;
  }
  const [row] = await db
    .delete(crimMatterDeadlines)
    .where(
      and(
        eq(crimMatterDeadlines.id, did),
        eq(crimMatterDeadlines.matterId, matter.id),
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
// Adds: GET /:id/ai-insights, GET /:id/stage-history, PATCH /:id/status,
// GET/POST/PATCH/DELETE /:id/checklist, GET/POST/DELETE /:id/time-entries

attachCaseIntelligence({
  router,
  portal: "crim",
  getOwnerKey: (req) => {
    try {
      return String(tenantOf(req));
    } catch {
      return null;
    }
  },
  getMatter: (req, res, id) => getOwnedMatter(req, res, id),
});

export default router;
