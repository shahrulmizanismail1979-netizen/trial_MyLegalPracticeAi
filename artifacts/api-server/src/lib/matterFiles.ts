import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { sql } from "drizzle-orm";
import { db, type MatterFileTables } from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { logger } from "./logger";
import { type Portal } from "./caseStages";
import { makeClientsRouter } from "./caseClients";
import { attachCaseIntelligence, triggerChecklistGeneration, triggerIntakeBriefing } from "./attachCaseIntelligence";
import {
  recordCaseEvent,
  updateCaseEventBySource,
  deleteCaseEventBySource,
} from "./caseEvents";

/**
 * Matter-file route factory for the corporate portals (Task #110), mirroring
 * artifacts/api-server/src/lit/routes/matters.ts + saved-work.ts.
 *
 * Every route is ownership-scoped: matter lookups always AND the owner id, so
 * a foreign matterId yields 404, never someone else's data.
 */

export type GetOwnerId = (req: Request, res: Response) => number | null | undefined;

const MAX_NOTES = 20_000;
const MAX_CONTENT = 500_000;
const MAX_INPUT_JSON = 200_000;

type OwnedRequest = Request & { matterOwnerId: number };

function makeRequireOwner(getOwnerId: GetOwnerId) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ownerId = getOwnerId(req, res);
    if (typeof ownerId !== "number") {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    (req as OwnedRequest).matterOwnerId = ownerId;
    next();
  };
}

function ownerOf(req: Request): number {
  return (req as OwnedRequest).matterOwnerId;
}

function normaliseMatterBody(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  const strFields = [
    "title",
    "clientName",
    "counterparty",
    "matterType",
    "reference",
    "status",
  ];
  for (const f of strFields) {
    const v = body[f];
    if (typeof v === "string") out[f] = v.slice(0, 500);
  }
  if (typeof body.notes === "string") out.notes = body.notes.slice(0, MAX_NOTES);
  return out;
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

export function createMatterFileRouters(
  tables: MatterFileTables,
  getOwnerId: GetOwnerId,
  portal?: Portal,
): { mattersRouter: IRouter; savedWorkRouter: IRouter; clientsRouter: IRouter } {
  const { matters, deadlines, savedWork } = tables;
  const requireOwner = makeRequireOwner(getOwnerId);

  // Convert numeric ownerId to string for shared intelligence tables.
  const getOwnerKey = (req: Request, res: Response): string | null => {
    const id = getOwnerId(req, res);
    return typeof id === "number" ? String(id) : null;
  };

  // Chronology mirroring is only meaningful when the portal is known (the
  // shared case_events table is keyed by portal). When unset these become
  // no-ops so the corp/ccb/convey factory keeps working in isolation.
  const ownerKeyOf = (req: Request): string | null =>
    portal ? String(ownerOf(req)) : null;

  // Format a JS date (or ISO string) to the YYYY-MM-DD event_date the
  // chronology expects. Returns null when unparseable.
  const toEventDate = (value: unknown): string | null => {
    if (value == null) return null;
    const d = value instanceof Date ? value : new Date(value as string | number);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  };

  // Best-effort deadline → chronology mirror. Never throws; failures are logged
  // inside recordCaseEvent. Stable source marker: "deadline:<id>".
  const mirrorDeadlineCreated = (
    req: Request,
    matterId: number,
    deadline: { id: number; title: unknown; dueDate: unknown; status?: unknown },
  ): void => {
    const ownerKey = ownerKeyOf(req);
    if (!ownerKey || !portal) return;
    const eventDate = toEventDate(deadline.dueDate);
    if (!eventDate) return;
    const title = typeof deadline.title === "string" ? deadline.title : "Deadline";
    void recordCaseEvent(portal, matterId, ownerKey, {
      event_date: eventDate,
      title: `Deadline: ${title}`,
      kind: "deadline",
      source: `deadline:${deadline.id}`,
    });
  };

  const mirrorDeadlineUpdated = (
    req: Request,
    matterId: number,
    deadline: { id: number; title: unknown; dueDate: unknown },
  ): void => {
    const ownerKey = ownerKeyOf(req);
    if (!ownerKey || !portal) return;
    const eventDate = toEventDate(deadline.dueDate);
    const title = typeof deadline.title === "string" ? deadline.title : undefined;
    void updateCaseEventBySource(portal, matterId, ownerKey, `deadline:${deadline.id}`, {
      ...(eventDate ? { event_date: eventDate } : {}),
      ...(title !== undefined ? { title: `Deadline: ${title}` } : {}),
    });
  };

  const mirrorDeadlineDeleted = (req: Request, matterId: number, deadlineId: number): void => {
    const ownerKey = ownerKeyOf(req);
    if (!ownerKey || !portal) return;
    void deleteCaseEventBySource(portal, matterId, ownerKey, `deadline:${deadlineId}`);
  };

  // Best-effort saved-work creation → chronology mirror. Stable source marker:
  // "saved-work:<id>". Only fires when the saved work is linked to a matter.
  const mirrorSavedWorkCreated = (
    req: Request,
    matterId: number,
    work: { id: number; title: unknown; kind?: unknown },
  ): void => {
    const ownerKey = ownerKeyOf(req);
    if (!ownerKey || !portal) return;
    const eventDate = toEventDate(new Date());
    if (!eventDate) return;
    const title = typeof work.title === "string" ? work.title : "Saved work";
    void recordCaseEvent(portal, matterId, ownerKey, {
      event_date: eventDate,
      title,
      kind: "saved-work",
      source: `saved-work:${work.id}`,
    });
  };

  // Fetch a matter and assert it belongs to the caller. Foreign / missing
  // matters are indistinguishable: both 404.
  async function getOwnedMatter(req: Request, res: Response, idParam: string) {
    const ownerId = ownerOf(req);
    const id = parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid matter id" });
      return undefined;
    }
    const [row] = await db
      .select()
      .from(matters)
      .where(and(eq(matters.id, id), eq(matters.ownerId, ownerId)))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Matter not found" });
      return undefined;
    }
    return row;
  }

  const mattersRouter: IRouter = Router();
  mattersRouter.use(requireOwner);

  // ── Aggregate routes (must precede "/:id") ────────────────────────────────

  mattersRouter.get("/deadlines/upcoming", async (req, res) => {
    const ownerId = ownerOf(req);
    const days = Math.min(Math.max(parseInt(String(req.query.days ?? "60"), 10) || 60, 1), 365);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);
    const rows = await db
      .select({
        id: deadlines.id,
        matterId: deadlines.matterId,
        title: deadlines.title,
        dueDate: deadlines.dueDate,
        category: deadlines.category,
        status: deadlines.status,
        basis: deadlines.basis,
        notes: deadlines.notes,
        matterTitle: matters.title,
        reference: matters.reference,
      })
      .from(deadlines)
      .innerJoin(matters, eq(deadlines.matterId, matters.id))
      .where(and(eq(deadlines.ownerId, ownerId), eq(deadlines.status, "pending")))
      .orderBy(asc(deadlines.dueDate));
    const horizonMs = horizon.getTime();
    res.json(rows.filter((r) => new Date(r.dueDate).getTime() <= horizonMs));
  });

  // ── Matter CRUD ────────────────────────────────────────────────────────────

  mattersRouter.get("/", async (req, res) => {
    const ownerId = ownerOf(req);
    const { status } = req.query;
    const where =
      status && typeof status === "string"
        ? and(eq(matters.ownerId, ownerId), eq(matters.status, status))
        : eq(matters.ownerId, ownerId);
    const rows = await db.select().from(matters).where(where).orderBy(desc(matters.updatedAt));
    res.json(rows);
  });

  mattersRouter.get("/:id", async (req, res) => {
    const matter = await getOwnedMatter(req, res, req.params.id as string);
    if (!matter) return;
    const rows = await db
      .select()
      .from(deadlines)
      .where(eq(deadlines.matterId, matter.id))
      .orderBy(asc(deadlines.dueDate));
    res.json({ ...matter, deadlines: rows });
  });

  mattersRouter.post("/", async (req, res) => {
    const ownerId = ownerOf(req);
    const data = normaliseMatterBody(req.body ?? {});
    if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const [row] = await db
      .insert(matters)
      .values({ ...(data as { title: string }), ownerId, title: (data.title as string).trim() })
      .returning();
    if (portal) {
      triggerChecklistGeneration(
        portal,
        row.id,
        String(ownerId),
        row.title,
        (row as unknown as Record<string, unknown>).matterType as string | null,
      );
      if (req.body?.hasDocuments === true) {
        triggerIntakeBriefing(portal, row.id, String(ownerId), row as unknown as Record<string, unknown>);
      }
    }
    res.status(201).json(row);
  });

  mattersRouter.patch("/:id", async (req, res) => {
    const matter = await getOwnedMatter(req, res, req.params.id as string);
    if (!matter) return;
    const data = normaliseMatterBody(req.body ?? {});
    const [row] = await db
      .update(matters)
      .set({ ...(data as object), updatedAt: new Date() })
      .where(eq(matters.id, matter.id))
      .returning();
    res.json(row);
  });

  mattersRouter.delete("/:id", async (req, res) => {
    const matter = await getOwnedMatter(req, res, req.params.id as string);
    if (!matter) return;
    // Filed work survives matter deletion (matterId is a soft link), matching
    // the lit behaviour; deadlines cascade in the DB.
    await db.delete(matters).where(eq(matters.id, matter.id));
    res.json({ success: true });
  });

  // ── Linked saved work ──────────────────────────────────────────────────────

  mattersRouter.get("/:id/work", async (req, res) => {
    const matter = await getOwnedMatter(req, res, req.params.id as string);
    if (!matter) return;
    const ownerId = ownerOf(req);
    const rows = await db
      .select()
      .from(savedWork)
      .where(and(eq(savedWork.matterId, matter.id), eq(savedWork.ownerId, ownerId)))
      .orderBy(desc(savedWork.updatedAt));
    res.json(rows);
  });

  // ── Deadlines ──────────────────────────────────────────────────────────────

  mattersRouter.get("/:id/deadlines", async (req, res) => {
    const matter = await getOwnedMatter(req, res, req.params.id as string);
    if (!matter) return;
    const rows = await db
      .select()
      .from(deadlines)
      .where(eq(deadlines.matterId, matter.id))
      .orderBy(asc(deadlines.dueDate));
    res.json(rows);
  });

  mattersRouter.post("/:id/deadlines", async (req, res) => {
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
      .insert(deadlines)
      .values({ ...(data as { title: string; dueDate: Date }), matterId: matter.id, ownerId })
      .returning();
    mirrorDeadlineCreated(req, matter.id, {
      id: row.id as number,
      title: row.title,
      dueDate: row.dueDate,
      status: row.status,
    });
    res.status(201).json(row);
  });

  mattersRouter.post("/:id/deadlines/bulk", async (req, res) => {
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
    const rows = await db.insert(deadlines).values(values).returning();
    for (const row of rows) {
      mirrorDeadlineCreated(req, matter.id, {
        id: row.id as number,
        title: row.title,
        dueDate: row.dueDate,
        status: row.status,
      });
    }
    res.status(201).json(rows);
  });

  mattersRouter.patch("/:id/deadlines/:did", async (req, res) => {
    const matter = await getOwnedMatter(req, res, req.params.id as string);
    if (!matter) return;
    const did = parseInt(req.params.did as string, 10);
    if (Number.isNaN(did)) {
      res.status(400).json({ error: "Invalid deadline id" });
      return;
    }
    const data = normaliseDeadlineBody(req.body ?? {});
    const [row] = await db
      .update(deadlines)
      .set({ ...(data as object), updatedAt: new Date() })
      .where(and(eq(deadlines.id, did), eq(deadlines.matterId, matter.id)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Deadline not found" });
      return;
    }
    mirrorDeadlineUpdated(req, matter.id, {
      id: row.id as number,
      title: row.title,
      dueDate: row.dueDate,
    });
    res.json(row);
  });

  mattersRouter.delete("/:id/deadlines/:did", async (req, res) => {
    const matter = await getOwnedMatter(req, res, req.params.id as string);
    if (!matter) return;
    const did = parseInt(req.params.did as string, 10);
    if (Number.isNaN(did)) {
      res.status(400).json({ error: "Invalid deadline id" });
      return;
    }
    const [row] = await db
      .delete(deadlines)
      .where(and(eq(deadlines.id, did), eq(deadlines.matterId, matter.id)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Deadline not found" });
      return;
    }
    mirrorDeadlineDeleted(req, matter.id, did);
    res.json({ success: true });
  });

  // ── Saved work ─────────────────────────────────────────────────────────────

  const savedWorkRouter: IRouter = Router();
  savedWorkRouter.use(requireOwner);

  savedWorkRouter.get("/", async (req, res) => {
    const ownerId = ownerOf(req);
    const { kind } = req.query;
    const where =
      kind && typeof kind === "string"
        ? and(eq(savedWork.ownerId, ownerId), eq(savedWork.kind, kind))
        : eq(savedWork.ownerId, ownerId);
    const rows = await db.select().from(savedWork).where(where).orderBy(desc(savedWork.updatedAt));
    res.json(rows);
  });

  savedWorkRouter.get("/:id", async (req, res) => {
    const ownerId = ownerOf(req);
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [row] = await db
      .select()
      .from(savedWork)
      .where(and(eq(savedWork.id, id), eq(savedWork.ownerId, ownerId)))
      .limit(1);
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  });

  savedWorkRouter.post("/", async (req, res) => {
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
        .select({ id: matters.id })
        .from(matters)
        .where(and(eq(matters.id, matterId), eq(matters.ownerId, ownerId)))
        .limit(1);
      if (!owned) {
        res.status(404).json({ error: "matter not found" });
        return;
      }
      linkedMatterId = owned.id;
    }
    const [row] = await db
      .insert(savedWork)
      .values({
        ownerId,
        matterId: linkedMatterId,
        kind,
        title: title.slice(0, 300),
        matter: typeof matter === "string" && matter.trim() ? matter.slice(0, 300) : null,
        inputJson: inputJson ?? null,
        content: typeof content === "string" ? content : "",
      })
      .returning();
    if (linkedMatterId != null) {
      mirrorSavedWorkCreated(req, linkedMatterId, {
        id: row.id as number,
        title: row.title,
        kind: row.kind,
      });
    }
    res.status(201).json(row);
  });

  savedWorkRouter.patch("/:id", async (req, res) => {
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
    if (inputJson !== undefined && inputJson != null && JSON.stringify(inputJson).length > MAX_INPUT_JSON) {
      res.status(413).json({ error: "inputJson too large" });
      return;
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof title === "string") updates.title = title.slice(0, 300);
    if (typeof matter === "string") updates.matter = matter.trim() ? matter.slice(0, 300) : null;
    if (typeof content === "string") updates.content = content;
    if (inputJson !== undefined) updates.inputJson = inputJson;
    const [row] = await db
      .update(savedWork)
      .set(updates)
      .where(and(eq(savedWork.id, id), eq(savedWork.ownerId, ownerId)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(row);
  });

  savedWorkRouter.delete("/:id", async (req, res) => {
    const ownerId = ownerOf(req);
    const id = parseInt(req.params.id as string, 10);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [row] = await db
      .delete(savedWork)
      .where(and(eq(savedWork.id, id), eq(savedWork.ownerId, ownerId)))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true });
  });

  // Attach AI case intelligence routes if a portal was provided.
  if (portal) {
    attachCaseIntelligence({
      router: mattersRouter,
      portal,
      getOwnerKey,
      getMatter: (req, res, id) => getOwnedMatter(req, res, id),
    });
  }

  // Client management (shared case_clients table).
  const clientsRouter = makeClientsRouter(portal ?? "corp", getOwnerKey);

  return { mattersRouter, savedWorkRouter, clientsRouter };
}

/**
 * Creates the nine matter-file tables if missing. Uses direct SQL (never
 * drizzle push — it has proposed renaming unrelated tables before). Runs at
 * boot so production gets the tables on the next publish.
 */
export async function ensureMatterFileTables(): Promise<void> {
  const specs: Array<{ prefix: string; ownerCol: string; ownerRef: string }> = [
    { prefix: "corp", ownerCol: "access_code_id", ownerRef: "corp_access_codes(id)" },
    { prefix: "ccb", ownerCol: "access_code_id", ownerRef: "ccb_access_codes(id)" },
    { prefix: "convey", ownerCol: "user_id", ownerRef: "users(id)" },
  ];
  for (const { prefix, ownerCol, ownerRef } of specs) {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS ${prefix}_matters (
        id serial PRIMARY KEY,
        ${ownerCol} integer NOT NULL REFERENCES ${ownerRef} ON DELETE CASCADE,
        title text NOT NULL,
        client_name text,
        counterparty text,
        matter_type text,
        reference text,
        status text NOT NULL DEFAULT 'open',
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ${prefix}_matter_deadlines (
        id serial PRIMARY KEY,
        matter_id integer NOT NULL REFERENCES ${prefix}_matters(id) ON DELETE CASCADE,
        ${ownerCol} integer NOT NULL REFERENCES ${ownerRef} ON DELETE CASCADE,
        title text NOT NULL,
        due_date timestamptz NOT NULL,
        category text NOT NULL DEFAULT 'custom',
        status text NOT NULL DEFAULT 'pending',
        basis text,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ${prefix}_saved_work (
        id serial PRIMARY KEY,
        ${ownerCol} integer NOT NULL REFERENCES ${ownerRef} ON DELETE CASCADE,
        matter_id integer,
        kind text NOT NULL,
        title text NOT NULL,
        matter text,
        input_json jsonb,
        content text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS ${prefix}_matters_owner_idx ON ${prefix}_matters (${ownerCol});
      CREATE INDEX IF NOT EXISTS ${prefix}_matter_deadlines_matter_idx ON ${prefix}_matter_deadlines (matter_id);
      CREATE INDEX IF NOT EXISTS ${prefix}_saved_work_owner_idx ON ${prefix}_saved_work (${ownerCol});
    `));
  }
  logger.info("matter-file tables ensured (corp/ccb/convey)");
}
