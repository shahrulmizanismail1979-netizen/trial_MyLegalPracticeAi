import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db } from "@workspace/db";
import {
  litMatters,
  litMatterDeadlines,
  litSavedWork,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireSubscription } from "./billing";
import {
  computeDeadlines,
  DEADLINE_TRIGGERS,
} from "../lib/litigationDeadlines";
import { attachCaseIntelligence, triggerChecklistGeneration } from "../../lib/attachCaseIntelligence";

const router: IRouter = Router();

function getAccessCodeId(req: Request): number | undefined {
  const sess = req.session as unknown as Record<string, unknown> | undefined;
  if (!sess || sess.authenticated !== true) return undefined;
  return sess.accessCodeId as number | undefined;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const accessCodeId = getAccessCodeId(req);
  if (!accessCodeId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  (req as unknown as Request & { accessCodeId: number }).accessCodeId = accessCodeId;
  next();
}

router.use(requireAuth);

const MAX_NOTES = 20_000;

// Fetch a matter and assert it belongs to the caller. Returns undefined and
// sends the appropriate error response if not found / not owned.
async function getOwnedMatter(req: Request, res: Response, idParam: string) {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const id = parseInt(idParam, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid matter id" });
    return undefined;
  }
  const [row] = await db
    .select()
    .from(litMatters)
    .where(and(eq(litMatters.id, id), eq(litMatters.accessCodeId, accessCodeId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Matter not found" });
    return undefined;
  }
  return row;
}

// ── Static / aggregate routes (must precede "/:id") ──────────────────────────

// The standard ROC-2012 deadline triggers the UI offers.
router.get("/deadline-triggers", (_req, res) => {
  res.json(DEADLINE_TRIGGERS);
});

// Upcoming pending deadlines across all of the user's matters — the at-a-glance
// "clock" for the diary and dashboard.
router.get("/deadlines/upcoming", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const days = Math.min(Math.max(parseInt(String(req.query.days ?? "60"), 10) || 60, 1), 365);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + days);
  // Include overdue items too: everything pending with due date <= horizon.
  const rows = await db
    .select({
      id: litMatterDeadlines.id,
      matterId: litMatterDeadlines.matterId,
      title: litMatterDeadlines.title,
      dueDate: litMatterDeadlines.dueDate,
      category: litMatterDeadlines.category,
      status: litMatterDeadlines.status,
      basis: litMatterDeadlines.basis,
      notes: litMatterDeadlines.notes,
      matterTitle: litMatters.title,
      suitNo: litMatters.suitNo,
    })
    .from(litMatterDeadlines)
    .innerJoin(litMatters, eq(litMatterDeadlines.matterId, litMatters.id))
    .where(
      and(
        eq(litMatterDeadlines.accessCodeId, accessCodeId),
        eq(litMatterDeadlines.status, "pending"),
      ),
    )
    .orderBy(asc(litMatterDeadlines.dueDate));
  const horizonMs = horizon.getTime();
  res.json(rows.filter((r) => new Date(r.dueDate).getTime() <= horizonMs));
});

// ── Matter CRUD ──────────────────────────────────────────────────────────────

router.get("/", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const { status } = req.query;
  const where =
    status && typeof status === "string"
      ? and(eq(litMatters.accessCodeId, accessCodeId), eq(litMatters.status, status))
      : eq(litMatters.accessCodeId, accessCodeId);
  const rows = await db
    .select()
    .from(litMatters)
    .where(where)
    .orderBy(desc(litMatters.updatedAt));
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, (req.params.id as string));
  if (!matter) return;
  const deadlines = await db
    .select()
    .from(litMatterDeadlines)
    .where(eq(litMatterDeadlines.matterId, matter.id))
    .orderBy(asc(litMatterDeadlines.dueDate));
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
    "suitNo",
    "status",
  ];
  for (const f of strFields) {
    const v = body[f];
    if (typeof v === "string") out[f] = v.slice(0, 500);
  }
  if (typeof body.notes === "string") out.notes = body.notes.slice(0, MAX_NOTES);
  if (body.claimAmount !== undefined && body.claimAmount !== null && body.claimAmount !== "") {
    const n = Number(body.claimAmount);
    if (!Number.isNaN(n)) out.claimAmount = String(n);
  } else if (body.claimAmount === null || body.claimAmount === "") {
    out.claimAmount = null;
  }
  return out;
}

router.post("/", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const data = normaliseMatterBody(req.body ?? {});
  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const [row] = await db
    .insert(litMatters)
    .values({ ...(data as object), accessCodeId, title: (data.title as string).trim() })
    .returning();
  triggerChecklistGeneration(
    "lit",
    row.id,
    String(accessCodeId),
    row.title,
    (row as unknown as Record<string, unknown>).matterType as string | null,
  );
  res.status(201).json(row);
});

router.patch("/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, (req.params.id as string));
  if (!matter) return;
  const data = normaliseMatterBody(req.body ?? {});
  const [row] = await db
    .update(litMatters)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(eq(litMatters.id, matter.id))
    .returning();
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const matter = await getOwnedMatter(req, res, (req.params.id as string));
  if (!matter) return;
  await db.delete(litMatters).where(eq(litMatters.id, matter.id));
  res.json({ success: true });
});

// ── Linked saved work ────────────────────────────────────────────────────────

router.get("/:id/work", async (req, res) => {
  const matter = await getOwnedMatter(req, res, (req.params.id as string));
  if (!matter) return;
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const rows = await db
    .select()
    .from(litSavedWork)
    .where(
      and(
        eq(litSavedWork.matterId, matter.id),
        eq(litSavedWork.accessCodeId, accessCodeId),
      ),
    )
    .orderBy(desc(litSavedWork.updatedAt));
  res.json(rows);
});

// ── Deadlines ────────────────────────────────────────────────────────────────

router.get("/:id/deadlines", async (req, res) => {
  const matter = await getOwnedMatter(req, res, (req.params.id as string));
  if (!matter) return;
  const rows = await db
    .select()
    .from(litMatterDeadlines)
    .where(eq(litMatterDeadlines.matterId, matter.id))
    .orderBy(asc(litMatterDeadlines.dueDate));
  res.json(rows);
});

// Preview the standard deadlines a trigger produces — a pure calculator, not a
// write, so it stays open to all logged-in users.
router.post("/:id/deadlines/compute", async (req, res) => {
  const matter = await getOwnedMatter(req, res, (req.params.id as string));
  if (!matter) return;
  const { trigger, triggerDate } = req.body ?? {};
  if (typeof trigger !== "string" || typeof triggerDate !== "string") {
    res.status(400).json({ error: "trigger and triggerDate are required" });
    return;
  }
  res.json(computeDeadlines(trigger, triggerDate));
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

router.post("/:id/deadlines", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const matter = await getOwnedMatter(req, res, String((req.params.id as string)));
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
    .insert(litMatterDeadlines)
    .values({
      ...(data as { title: string; dueDate: Date }),
      matterId: matter.id,
      accessCodeId,
    })
    .returning();
  res.status(201).json(row);
});

// Bulk-add an array of deadlines (used after previewing computed deadlines).
router.post("/:id/deadlines/bulk", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const matter = await getOwnedMatter(req, res, String((req.params.id as string)));
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
  const rows = await db.insert(litMatterDeadlines).values(values).returning();
  res.status(201).json(rows);
});

router.patch("/:id/deadlines/:did", async (req, res) => {
  const matter = await getOwnedMatter(req, res, (req.params.id as string));
  if (!matter) return;
  const did = parseInt((req.params.did as string), 10);
  if (Number.isNaN(did)) {
    res.status(400).json({ error: "Invalid deadline id" });
    return;
  }
  const data = normaliseDeadlineBody(req.body ?? {});
  const [row] = await db
    .update(litMatterDeadlines)
    .set({ ...(data as object), updatedAt: new Date() })
    .where(
      and(
        eq(litMatterDeadlines.id, did),
        eq(litMatterDeadlines.matterId, matter.id),
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
  const matter = await getOwnedMatter(req, res, (req.params.id as string));
  if (!matter) return;
  const did = parseInt((req.params.did as string), 10);
  if (Number.isNaN(did)) {
    res.status(400).json({ error: "Invalid deadline id" });
    return;
  }
  const [row] = await db
    .delete(litMatterDeadlines)
    .where(
      and(
        eq(litMatterDeadlines.id, did),
        eq(litMatterDeadlines.matterId, matter.id),
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
  portal: "lit",
  getOwnerKey: (req) => {
    const accessCodeId = (req as unknown as Request & { accessCodeId?: number }).accessCodeId;
    return accessCodeId ? String(accessCodeId) : null;
  },
  getMatter: (req, res, id) => getOwnedMatter(req, res, id),
});

export default router;
