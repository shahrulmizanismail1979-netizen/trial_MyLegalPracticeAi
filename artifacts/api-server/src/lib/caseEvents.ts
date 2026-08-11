/**
 * Shared per-matter chronology / activity stream for all portals.
 *
 * A single portal-scoped table (case_events) records the timeline of a matter —
 * filings, hearings, correspondence, instructions, deadlines, stage changes,
 * saved work, notes, payments, meetings, etc. Other modules can log events
 * programmatically via recordCaseEvent().
 *
 * All queries scope by portal + matter_id + owner_key so no tenant can read,
 * modify, or delete another tenant's events. Writes additionally verify the
 * matter row itself belongs to the caller via verifyMatterOwnership.
 *
 * Created via direct SQL boot-ensure (ensureCaseEventsTable) — NOT drizzle
 * push (rename trap).
 */
import { Router, type IRouter, type Request, type Response } from "express";
import { pool } from "@workspace/db";
import { logger } from "./logger";
import type { Portal } from "./caseStages";
import { verifyMatterOwnership } from "./caseOwnership";

// ── Boot-ensure DDL ───────────────────────────────────────────────────────────

const DDL = `
CREATE TABLE IF NOT EXISTS case_events (
  id serial PRIMARY KEY,
  portal text NOT NULL,
  matter_id integer NOT NULL,
  owner_key text NOT NULL,
  event_date date NOT NULL,
  title text NOT NULL,
  description text,
  kind text NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_events_matter ON case_events (portal, matter_id, owner_key);
CREATE INDEX IF NOT EXISTS idx_case_events_order ON case_events (portal, matter_id, event_date, created_at);
`;

let ensured: Promise<void> | null = null;

/**
 * Idempotent boot-time DDL for the case_events table. The orchestrator awaits
 * this once at startup before mounting the router.
 */
export function ensureCaseEventsTable(): Promise<void> {
  if (!ensured) {
    ensured = pool
      .query(DDL)
      .then(() => {
        logger.info("Case events table ensured");
      })
      .catch((err) => {
        ensured = null;
        logger.error({ err }, "Failed to ensure case events table");
        throw err;
      });
  }
  return ensured;
}

// ── Validation helpers ─────────────────────────────────────────────────────────

/** Allowed event kinds. Free-form is rejected to keep the timeline consistent. */
export const CASE_EVENT_KINDS = [
  "filing",
  "hearing",
  "correspondence",
  "instruction",
  "deadline",
  "stage",
  "saved-work",
  "note",
  "payment",
  "meeting",
] as const;

export type CaseEventKind = (typeof CASE_EVENT_KINDS)[number];

function isValidKind(kind: unknown): kind is CaseEventKind {
  return typeof kind === "string" && (CASE_EVENT_KINDS as readonly string[]).includes(kind);
}

/** ISO date (YYYY-MM-DD) validator matching caseTimeRecording.ts. */
function isValidDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// ── Programmatic helper ─────────────────────────────────────────────────────────

export interface RecordCaseEventInput {
  event_date: string;
  title: string;
  kind: string;
  source?: string | null;
  description?: string | null;
}

/**
 * Log a case event programmatically from another module (e.g. after an AI tool
 * files its output into a matter, or when a deadline is created).
 *
 * SECURITY: verifies the matter belongs to ownerKey before inserting so a
 * caller cannot orphan events under another tenant's matter. Returns the
 * inserted row, or null if ownership fails or input is invalid. Best-effort:
 * never throws (logs a warning instead) so callers can fire-and-forget.
 */
export async function recordCaseEvent(
  portal: Portal,
  matterId: number,
  ownerKey: string,
  input: RecordCaseEventInput,
): Promise<Record<string, unknown> | null> {
  try {
    if (!ownerKey) return null;
    if (!input || !input.title || typeof input.title !== "string" || !input.title.trim()) {
      return null;
    }
    if (!isValidDate(input.event_date)) return null;
    if (!isValidKind(input.kind)) return null;

    const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
    if (!owned) return null;

    const { rows } = await pool.query(
      `INSERT INTO case_events (portal, matter_id, owner_key, event_date, title, description, kind, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        portal,
        matterId,
        ownerKey,
        input.event_date,
        input.title.trim().slice(0, 500),
        typeof input.description === "string" ? input.description.slice(0, 5000) : null,
        input.kind,
        typeof input.source === "string" ? input.source.slice(0, 200) : null,
      ],
    );
    return rows[0] ?? null;
  } catch (err) {
    logger.warn({ err, portal, matterId }, "recordCaseEvent failed (non-fatal)");
    return null;
  }
}

// ── Route builder ─────────────────────────────────────────────────────────────

/**
 * Returns a router handling GET/POST/PATCH/DELETE for a matter's chronology.
 * Mounts at /:matterId/events relative to each portal's matter router; uses
 * mergeParams: true and reads req.params.matterId.
 *
 * SECURITY: every query includes owner_key to scope reads and writes to the
 * authenticated tenant. POST also verifies the matter row itself belongs to
 * the caller via verifyMatterOwnership before inserting.
 */
export function buildCaseEventsRouter(
  portal: Portal,
  getOwnerKey: (req: Request, res: Response) => string | null,
): IRouter {
  const router: IRouter = Router({ mergeParams: true });

  router.get("/", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0) {
      res.status(400).json({ error: "Invalid matter id" });
      return;
    }
    // Scope by portal + matter_id + owner_key — no cross-tenant reads
    const { rows } = await pool.query(
      `SELECT id, event_date, title, description, kind, source, created_at, updated_at
       FROM case_events
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3
       ORDER BY event_date, created_at, id`,
      [portal, matterId, ownerKey],
    );
    res.json(rows);
  });

  router.post("/", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    if (Number.isNaN(matterId) || matterId <= 0) {
      res.status(400).json({ error: "Invalid matter id" });
      return;
    }
    const { event_date, title, kind, source, description } = req.body ?? {};
    if (!title || typeof title !== "string" || !title.trim()) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    if (!isValidDate(event_date)) {
      res.status(400).json({ error: "event_date is required (YYYY-MM-DD)" });
      return;
    }
    if (!isValidKind(kind)) {
      res.status(400).json({ error: "Invalid kind", allowedKinds: CASE_EVENT_KINDS });
      return;
    }

    // Verify the caller owns this matter before linking an event to it
    const owned = await verifyMatterOwnership(portal, matterId, ownerKey);
    if (!owned) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const { rows } = await pool.query(
      `INSERT INTO case_events (portal, matter_id, owner_key, event_date, title, description, kind, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        portal,
        matterId,
        ownerKey,
        event_date,
        title.trim().slice(0, 500),
        typeof description === "string" ? description.slice(0, 5000) : null,
        kind,
        typeof source === "string" ? source.slice(0, 200) : null,
      ],
    );
    res.status(201).json(rows[0]);
  });

  router.patch("/:eventId", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    const eventId = parseInt((req.params as Record<string, string>).eventId ?? "0", 10);
    if (Number.isNaN(matterId) || Number.isNaN(eventId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const { event_date, title, kind, source, description } = req.body ?? {};
    if (event_date !== undefined && event_date !== null && !isValidDate(event_date)) {
      res.status(400).json({ error: "event_date must be YYYY-MM-DD" });
      return;
    }
    if (kind !== undefined && kind !== null && !isValidKind(kind)) {
      res.status(400).json({ error: "Invalid kind", allowedKinds: CASE_EVENT_KINDS });
      return;
    }
    // Include owner_key in WHERE so a tenant cannot update another's events
    const { rows: updated } = await pool.query(
      `UPDATE case_events
       SET event_date = COALESCE($5, event_date),
           title = COALESCE($6, title),
           description = COALESCE($7, description),
           kind = COALESCE($8, kind),
           source = COALESCE($9, source),
           updated_at = now()
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND id = $4
       RETURNING *`,
      [
        portal,
        matterId,
        ownerKey,
        eventId,
        isValidDate(event_date) ? event_date : null,
        typeof title === "string" && title.trim() ? title.trim().slice(0, 500) : null,
        typeof description === "string" ? description.slice(0, 5000) : null,
        isValidKind(kind) ? kind : null,
        typeof source === "string" ? source.slice(0, 200) : null,
      ],
    );
    if (!updated.length) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    res.json(updated[0]);
  });

  router.delete("/:eventId", async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const matterId = parseInt((req.params as Record<string, string>).matterId ?? "0", 10);
    const eventId = parseInt((req.params as Record<string, string>).eventId ?? "0", 10);
    if (Number.isNaN(matterId) || Number.isNaN(eventId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    // Include owner_key so a tenant cannot delete another's events
    await pool.query(
      `DELETE FROM case_events
       WHERE portal = $1 AND matter_id = $2 AND owner_key = $3 AND id = $4`,
      [portal, matterId, ownerKey, eventId],
    );
    res.json({ success: true });
  });

  return router;
}
