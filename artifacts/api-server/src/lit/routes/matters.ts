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
  type LitMatterPreparationState,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireSubscription } from "./billing";
import {
  computeDeadlines,
  DEADLINE_TRIGGERS,
} from "../lib/litigationDeadlines";
import { attachCaseIntelligence, triggerChecklistGeneration, triggerIntakeBriefing } from "../../lib/attachCaseIntelligence";
import { recordCaseEvent, updateCaseEventBySource, deleteCaseEventBySource } from "../../lib/caseEvents";
import { ensureMatterPreparationSchema } from "../lib/ensureMatterPreparationSchema";

const router: IRouter = Router();

// Test imports mount the Express app without running src/index.ts. Await the
// same additive ensure here so every served request has a compatible schema.
const preparationSchemaReady = ensureMatterPreparationSchema();
router.use(async (_req, _res, next) => {
  await preparationSchemaReady;
  next();
});

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
const MAX_BENCHMARKS = 100;

const EMPTY_PREPARATION_STATE: LitMatterPreparationState = {
  issues: "",
  evidence: "",
  relief: "",
  filingReadiness: {},
  benchmarks: [],
  practiceChecklists: {},
  causePaperPacks: {},
};

function booleanMap(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, checked]) => key.length <= 100 && typeof checked === "boolean")
      .slice(0, 500),
  );
}

function nestedBooleanMap(value: unknown): Record<string, Record<string, boolean>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.length <= 100)
      .slice(0, 100)
      .map(([key, items]) => [key, booleanMap(items)]),
  );
}

function preparationState(value: unknown): LitMatterPreparationState {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const benchmarks = Array.isArray(raw.benchmarks)
    ? raw.benchmarks
      .filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
      .slice(0, MAX_BENCHMARKS)
      .flatMap((item) => {
        const fields = ["caseName", "citation", "proposition", "pinpoint", "sourceUrl"] as const;
        if (!Number.isSafeInteger(item.id) || (item.id as number) < 1 || fields.some((field) => typeof item[field] !== "string")) return [];
        return [{
          id: item.id as number,
          caseName: (item.caseName as string).slice(0, 500),
          citation: (item.citation as string).slice(0, 500),
          proposition: (item.proposition as string).slice(0, MAX_NOTES),
          pinpoint: (item.pinpoint as string).slice(0, 500),
          sourceUrl: (item.sourceUrl as string).slice(0, 2_000),
        }];
      })
    : [];
  return {
    ...EMPTY_PREPARATION_STATE,
    issues: typeof raw.issues === "string" ? raw.issues.slice(0, MAX_NOTES) : "",
    evidence: typeof raw.evidence === "string" ? raw.evidence.slice(0, MAX_NOTES) : "",
    relief: typeof raw.relief === "string" ? raw.relief.slice(0, MAX_NOTES) : "",
    filingReadiness: booleanMap(raw.filingReadiness),
    benchmarks,
    practiceChecklists: nestedBooleanMap(raw.practiceChecklists),
    causePaperPacks: nestedBooleanMap(raw.causePaperPacks),
  };
}

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

// ── Matter preparation state ─────────────────────────────────────────────────
// This deliberately lives outside the general matter PATCH so preparation saves
// cannot accidentally change substantive matter metadata.
router.get("/:id/preparation", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  res.json(preparationState(matter.preparationState));
});

router.patch("/:id/preparation", async (req, res) => {
  const matter = await getOwnedMatter(req, res, req.params.id as string);
  if (!matter) return;
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    res.status(400).json({ error: "Preparation state must be an object" });
    return;
  }
  const current = preparationState(matter.preparationState);
  const incoming = body as Record<string, unknown>;
  // Practice views save one workflow key at a time. Merge those maps so a
  // concurrent save for another practice workflow cannot erase its progress.
  const patch = preparationState({
    ...current,
    ...incoming,
    practiceChecklists: {
      ...current.practiceChecklists,
      ...(incoming.practiceChecklists && typeof incoming.practiceChecklists === "object" && !Array.isArray(incoming.practiceChecklists)
        ? incoming.practiceChecklists
        : {}),
    },
    causePaperPacks: {
      ...current.causePaperPacks,
      ...(incoming.causePaperPacks && typeof incoming.causePaperPacks === "object" && !Array.isArray(incoming.causePaperPacks)
        ? incoming.causePaperPacks
        : {}),
    },
  });
  const [row] = await db
    .update(litMatters)
    .set({ preparationState: patch, updatedAt: new Date() })
    .where(and(eq(litMatters.id, matter.id), eq(litMatters.accessCodeId, matter.accessCodeId)))
    .returning({ preparationState: litMatters.preparationState });
  res.json(preparationState(row?.preparationState));
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
  if (req.body?.hasDocuments === true) {
    triggerIntakeBriefing("lit", row.id, String(accessCodeId), row as unknown as Record<string, unknown>);
  }
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

// ── Chronology ↔ Diary linking ────────────────────────────────────────────────
// A deadline entered in the Diary should also surface in the matter Chronology
// (as a kind="deadline" event) and vice-versa. We reuse the existing
// case_events table; the link is marked with source="deadline:<id>" so the two
// stay in sync and can be cleaned up without touching unrelated events.
const DEADLINE_EVENT_SOURCE = (deadlineId: number) => `deadline:${deadlineId}`;

// Parse a chronology event's `source` back into its linked deadline id, or null
// if the event isn't paired with a diary deadline.
function parseDeadlineSource(source: unknown): number | null {
  if (typeof source !== "string" || !source.startsWith("deadline:")) return null;
  const id = parseInt(source.slice("deadline:".length), 10);
  return Number.isNaN(id) ? null : id;
}

function toIsoDate(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

// Mirror a Diary deadline into the matter's chronology (best-effort, never
// throws). Keeps the two views consistent per matter.
async function mirrorDeadlineToChronology(
  matterId: number,
  ownerKey: string,
  deadline: { id: number; title: string; dueDate: unknown; basis?: string | null; notes?: string | null },
): Promise<void> {
  const iso = toIsoDate(deadline.dueDate);
  if (!iso) return;
  const parts = [deadline.basis, deadline.notes].filter((p): p is string => !!p && typeof p === "string");
  await recordCaseEvent("lit", matterId, ownerKey, {
    event_date: iso,
    title: deadline.title,
    kind: "deadline",
    source: DEADLINE_EVENT_SOURCE(deadline.id),
    description: parts.length ? parts.join(" — ") : null,
  });
}

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
  // Surface this deadline in the matter's chronology too (best-effort).
  await mirrorDeadlineToChronology(matter.id, String(accessCodeId), {
    id: row.id,
    title: row.title,
    dueDate: row.dueDate,
    basis: (row as unknown as Record<string, unknown>).basis as string | null,
    notes: (row as unknown as Record<string, unknown>).notes as string | null,
  });
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
  // Mirror each new deadline into the matter's chronology (best-effort).
  await Promise.all(
    rows.map((row) =>
      mirrorDeadlineToChronology(matter.id, String(accessCodeId), {
        id: row.id,
        title: row.title,
        dueDate: row.dueDate,
        basis: (row as unknown as Record<string, unknown>).basis as string | null,
        notes: (row as unknown as Record<string, unknown>).notes as string | null,
      }),
    ),
  );
  res.status(201).json(rows);
});

router.patch("/:id/deadlines/:did", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
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
  // Keep the mirrored chronology event in step with the edited deadline.
  const parts = [
    (row as unknown as Record<string, unknown>).basis,
    (row as unknown as Record<string, unknown>).notes,
  ].filter((p): p is string => !!p && typeof p === "string");
  await updateCaseEventBySource("lit", matter.id, String(accessCodeId), DEADLINE_EVENT_SOURCE(row.id), {
    event_date: toIsoDate(row.dueDate) ?? undefined,
    title: row.title,
    description: parts.length ? parts.join(" — ") : null,
  });
  res.json(row);
});

router.delete("/:id/deadlines/:did", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
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
  // Remove the mirrored chronology event for this deadline.
  await deleteCaseEventBySource("lit", matter.id, String(accessCodeId), DEADLINE_EVENT_SOURCE(row.id));
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
  // Chronology ↔ Diary is kept bidirectional through the shared "deadline:<id>"
  // source marker. Both hooks and the diary routes write to their counterpart
  // table DIRECTLY (never through the other's HTTP route), so the two never
  // loop. A pair is durable regardless of which side originated it.
  caseEventHooks: {
    // Chronology → Diary (create): a deadline logged directly in the matter
    // Chronology also appears in the Deadline Diary. Events already mirrored
    // FROM a diary deadline carry a "deadline:<id>" source and are skipped.
    // Returns the new "deadline:<id>" so the router stamps it onto the event,
    // establishing the reciprocal link for later edits/deletes.
    onEventCreated: async (matterId, ownerKey, event) => {
      if (event.kind !== "deadline") return;
      if (parseDeadlineSource(event.source) !== null) return; // already linked / mirrored from diary
      const iso = toIsoDate(event.event_date);
      if (!iso) return;
      const accessCodeId = parseInt(ownerKey, 10);
      if (Number.isNaN(accessCodeId)) return;
      const title = typeof event.title === "string" ? event.title : "";
      if (!title.trim()) return;
      const [row] = await db
        .insert(litMatterDeadlines)
        .values({
          matterId,
          accessCodeId,
          title: title.trim(),
          dueDate: new Date(iso),
          category: "custom",
          notes: typeof event.description === "string" ? event.description : null,
        })
        .returning();
      if (!row) return;
      return DEADLINE_EVENT_SOURCE(row.id);
    },
    // Chronology → Diary (edit): mirror the event's changes onto its linked
    // deadline. Writes directly to the table, so no diary→chronology re-sync.
    onEventUpdated: async (matterId, ownerKey, event) => {
      const deadlineId = parseDeadlineSource(event.source);
      if (deadlineId === null) return;
      const accessCodeId = parseInt(ownerKey, 10);
      if (Number.isNaN(accessCodeId)) return;
      const iso = toIsoDate(event.event_date);
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof event.title === "string" && event.title.trim()) set.title = event.title.trim();
      if (iso) set.dueDate = new Date(iso);
      if (event.description !== undefined) {
        set.notes = typeof event.description === "string" ? event.description : null;
      }
      await db
        .update(litMatterDeadlines)
        .set(set)
        .where(
          and(
            eq(litMatterDeadlines.id, deadlineId),
            eq(litMatterDeadlines.matterId, matterId),
            eq(litMatterDeadlines.accessCodeId, accessCodeId),
          ),
        );
    },
    // Chronology → Diary (delete): remove the linked deadline. Direct delete,
    // so the diary's own delete path (which clears the event) is not invoked.
    onEventDeleted: async (matterId, ownerKey, event) => {
      const deadlineId = parseDeadlineSource(event.source);
      if (deadlineId === null) return;
      const accessCodeId = parseInt(ownerKey, 10);
      if (Number.isNaN(accessCodeId)) return;
      await db
        .delete(litMatterDeadlines)
        .where(
          and(
            eq(litMatterDeadlines.id, deadlineId),
            eq(litMatterDeadlines.matterId, matterId),
            eq(litMatterDeadlines.accessCodeId, accessCodeId),
          ),
        );
    },
  },
});

export default router;
