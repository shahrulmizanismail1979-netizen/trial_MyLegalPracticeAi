/**
 * Case Home: a single endpoint that returns a rich, normalized summary of one
 * matter for the "Case Home" dashboard page.
 *
 * Route (relative to where attachCaseIntelligence mounts it):
 *   GET {P}/:id/case-home
 *
 * The response includes:
 *   - matter: normalized matter metadata
 *   - stages / currentStage / stageIndex
 *   - nextDeadline
 *   - outstandingTasks / tasks (all tasks for the matter)
 *   - latestActivity
 *   - people (linked clients)
 *   - documents
 *   - timeline: a unified, deterministic newest-first list of events drawn from
 *       case_events, stage changes, deadlines, tasks, saved work, and documents
 *   - nextAction: overdue/high task → next deadline → open checklist → stage
 *
 * SECURITY: every supporting query scopes by portal + owner_key. Auth/ownership
 * failures fail closed (401/404). Optional supporting tables (e.g. deadlines)
 * have their queries caught to empty arrays so a missing table never breaks the
 * response.
 */
import type { IRouter, Request, Response } from "express";
import { pool } from "@workspace/db";
import { PORTAL_STAGES, type Portal } from "./caseStages";
import { logger } from "./logger";

type MatterRow = Record<string, unknown>;
type GetOwnerKey = (req: Request, res: Response) => string | null;
type GetMatter = (req: Request, res: Response, id: string) => Promise<MatterRow | undefined>;

// ── Per-portal owner predicate (mirrors caseBriefing.ts helper) ─────────────

function portalOwnerPredicate(
  portal: Portal,
  ownerKey: string,
  firstParamIndex: number,
): { clause: string; params: Array<string | number> } | null {
  if (portal === "sya") {
    const colon = ownerKey.indexOf(":");
    if (colon < 0) return null;
    const ownerId = parseInt(ownerKey.slice(colon + 1), 10);
    if (Number.isNaN(ownerId)) return null;
    return {
      clause: `owner_type = $${firstParamIndex} AND owner_id = $${firstParamIndex + 1}`,
      params: [ownerKey.slice(0, colon), ownerId],
    };
  }
  const ownerCol =
    portal === "convey" ? "user_id" : portal === "acc" ? "owner_id" : "access_code_id";
  const ownerId = parseInt(ownerKey, 10);
  if (Number.isNaN(ownerId)) return null;
  return { clause: `${ownerCol} = $${firstParamIndex}`, params: [ownerId] };
}

// ── Normalized matter metadata ───────────────────────────────────────────────

function normalizeMatter(row: MatterRow): Record<string, unknown> {
  // Exclude raw owner FK columns and keep useful fields
  const EXCLUDED = /^(access_code_id|owner_id|owner_type|user_id|tenant_id)$/;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (EXCLUDED.test(k)) continue;
    out[k] = v;
  }
  return out;
}

// ── Timeline entry type ──────────────────────────────────────────────────────

export interface TimelineEntry {
  /** Deterministic sort key — ISO timestamp string */
  ts: string;
  kind: string;
  title: string;
  description?: string | null;
  source?: string | null;
  /** Provenance for filed AI work */
  tool?: string | null;
  /** The originating table/feature */
  origin:
    | "event"
    | "stage"
    | "deadline"
    | "task"
    | "saved-work"
    | "document";
  /** Extra payload fields (date, status, priority, etc.) */
  meta?: Record<string, unknown>;
}

function isoTs(v: unknown): string {
  if (!v) return new Date(0).toISOString();
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? new Date(0).toISOString() : d.toISOString();
}

// ── Next-action derivation ───────────────────────────────────────────────────

type NextAction =
  | { source: "task"; label: string; reason: "overdue" | "high" | "open"; taskId: number }
  | { source: "deadline"; label: string; due_date: string }
  | { source: "checklist"; label: string }
  | { source: "stage"; label: string };

// ── Route builder ─────────────────────────────────────────────────────────────

export function attachCaseHome(opts: {
  router: IRouter;
  portal: Portal;
  pathPrefix?: string;
  getOwnerKey: GetOwnerKey;
  getMatter: GetMatter;
}): void {
  const { router, portal, getOwnerKey, getMatter } = opts;
  const P = opts.pathPrefix ?? "";
  const stages = PORTAL_STAGES[portal];

  router.get(`${P}/:id/case-home`, async (req: Request, res: Response) => {
    const ownerKey = getOwnerKey(req, res);
    if (!ownerKey) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    // Ownership-verifying matter fetch (sends error response if not found)
    const matterRow = await getMatter(req, res, req.params.id as string);
    if (!matterRow) return;

    const matterId = matterRow.id as number;

    try {
      // ── Run all supporting queries in parallel, catching optional ones ─────

      const [
        stageHistoryResult,
        checklistResult,
        eventsResult,
        tasksResult,
        deadlineResult,
        savedWorkResult,
        documentsResult,
        clientsResult,
      ] = await Promise.all([
        // Stage history (shared table, scoped by portal + matter_id)
        pool
          .query(
            `SELECT id, from_stage, to_stage, changed_at FROM case_stage_history
             WHERE portal = $1 AND matter_id = $2
             ORDER BY changed_at DESC LIMIT 50`,
            [portal, matterId],
          )
          .catch(() => ({ rows: [] })),

        // Checklist (shared, scoped by portal + matter_id + owner_key)
        pool
          .query(
            `SELECT id, item_text, done, position FROM case_checklists
             WHERE portal = $1 AND matter_id = $2 AND owner_key = $3
             ORDER BY position, id`,
            [portal, matterId, ownerKey],
          )
          .catch(() => ({ rows: [] })),

        // Case events (shared, scoped by portal + matter_id + owner_key)
        pool
          .query(
            `SELECT id, event_date, title, description, kind, source, created_at
             FROM case_events
             WHERE portal = $1 AND matter_id = $2 AND owner_key = $3
             ORDER BY event_date DESC, created_at DESC LIMIT 100`,
            [portal, matterId, ownerKey],
          )
          .catch(() => ({ rows: [] })),

        // Tasks (shared, scoped by portal + matter_id + owner_key)
        pool
          .query(
            `SELECT id, title, assignee, due_date, priority, status, note, created_at, updated_at
             FROM case_tasks
             WHERE portal = $1 AND matter_id = $2 AND owner_key = $3
             ORDER BY
               CASE WHEN status IN ('done','cancelled') THEN 1 ELSE 0 END,
               CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
               due_date NULLS LAST, id`,
            [portal, matterId, ownerKey],
          )
          .catch(() => ({ rows: [] })),

        // All relevant matter deadlines (portal table, scoped by portal owner
        // predicate). Fetched in full so they can populate both nextDeadline and
        // the unified timeline; capped at a reasonable limit.
        (async () => {
          const pred = portalOwnerPredicate(portal, ownerKey, 2);
          if (!pred) return { rows: [] };
          return pool
            .query(
              `SELECT id, title, due_date, status FROM ${portal}_matter_deadlines
               WHERE matter_id = $1 AND ${pred.clause}
               ORDER BY due_date ASC LIMIT 100`,
              [matterId, ...pred.params],
            )
            .catch(() => ({ rows: [] }));
        })(),

        // Saved work (portal table, scoped by portal owner predicate)
        (async () => {
          const pred = portalOwnerPredicate(portal, ownerKey, 2);
          if (!pred) return { rows: [] };
          return pool
            .query(
              `SELECT id, title, kind, created_at, updated_at,
                      input_json
               FROM ${portal}_saved_work
               WHERE matter_id = $1 AND ${pred.clause}
               ORDER BY created_at DESC LIMIT 20`,
              [matterId, ...pred.params],
            )
            .catch(() => ({ rows: [] }));
        })(),

        // Documents (shared, scoped by portal + owner_key + matter_id)
        pool
          .query(
            `SELECT id, file_name, content_type, category, doc_date, size_bytes, created_at
             FROM case_documents
             WHERE portal = $1 AND owner_key = $2 AND matter_id = $3
             ORDER BY COALESCE(doc_date, created_at::date) DESC, id DESC
             LIMIT 50`,
            [portal, ownerKey, matterId],
          )
          .catch(() => ({ rows: [] })),

        // Linked clients (shared case_clients, scoped by portal + owner_key)
        pool
          .query(
            `SELECT cc.id, cc.name, cc.email, cc.phone, cc.company_name, cc.ic_number
             FROM case_clients cc
             INNER JOIN case_matter_clients cmc
               ON cmc.client_id = cc.id AND cmc.portal = cc.portal AND cmc.owner_key = cc.owner_key
             WHERE cmc.portal = $1 AND cmc.owner_key = $2 AND cmc.matter_id = $3`,
            [portal, ownerKey, matterId],
          )
          .catch(() => ({ rows: [] })),
      ]);

      const stageHistory = stageHistoryResult.rows as Array<{
        id: number;
        from_stage: string | null;
        to_stage: string;
        changed_at: string;
      }>;
      const checklist = checklistResult.rows as Array<{
        id: number;
        item_text: string;
        done: boolean;
        position: number;
      }>;
      const events = eventsResult.rows as Array<{
        id: number;
        event_date: string;
        title: string;
        description: string | null;
        kind: string;
        source: string | null;
        created_at: string;
      }>;
      // Normalize tasks: PostgreSQL 'date' columns come back as Date objects from node-postgres
      const tasks = (tasksResult.rows as Array<Record<string, unknown>>).map((t) => ({
        id: t.id as number,
        title: t.title as string,
        assignee: (t.assignee as string | null) ?? null,
        due_date: t.due_date != null
          ? new Date(t.due_date as string | Date).toISOString().slice(0, 10)
          : null,
        priority: t.priority as string,
        status: t.status as string,
        note: (t.note as string | null) ?? null,
        created_at: t.created_at as string,
        updated_at: t.updated_at as string,
      }));
      // Normalize deadlines: due_date comes back from node-postgres as a Date
      // object (timestamptz) or string depending on the driver/column.
      const deadlineRows = (deadlineResult.rows as Array<Record<string, unknown>>).map((d) => ({
        id: d.id as number,
        title: d.title as string,
        due_date: d.due_date != null ? new Date(d.due_date as string | Date).toISOString() : null,
        status: (d.status as string | null) ?? "",
      }));
      const DEADLINE_OPEN_STATUSES = new Set(["done", "completed", "met", "closed"]);
      const savedWorkRows = savedWorkResult.rows as Array<{
        id: number;
        title: string;
        kind: string;
        created_at: string;
        updated_at: string;
        input_json: Record<string, unknown> | null;
      }>;
      const documents = documentsResult.rows as Array<{
        id: number;
        file_name: string;
        content_type: string | null;
        category: string;
        doc_date: string | null;
        size_bytes: number;
        created_at: string;
      }>;
      const people = clientsResult.rows as Array<Record<string, unknown>>;

      // ── Derived values ───────────────────────────────────────────────────────

      const currentStage = (matterRow.status as string | null) ?? null;
      const stageIndex = currentStage ? stages.indexOf(currentStage) : -1;

      // nextDeadline = earliest still-open deadline (deadlineRows already sorted
      // by due_date ASC).
      const nextOpenDeadline = deadlineRows.find(
        (d) => d.due_date != null && !DEADLINE_OPEN_STATUSES.has(d.status.toLowerCase()),
      );
      const nextDeadline = nextOpenDeadline
        ? {
            title: nextOpenDeadline.title,
            due_date: new Date(nextOpenDeadline.due_date as string).toISOString().slice(0, 10),
            status: nextOpenDeadline.status,
          }
        : null;

      // Outstanding tasks = open or in_progress
      const outstandingTasks = tasks.filter(
        (t) => t.status === "open" || t.status === "in_progress",
      );

      // Latest activity = case_event with the most recent event_date (the
      // query already orders by event_date DESC, created_at DESC so events[0]
      // is always the legally most-recent entry).
      const latestActivity =
        events.length > 0
          ? {
              title: events[0].title,
              kind: events[0].kind,
              event_date: new Date(events[0].event_date).toISOString().slice(0, 10),
              created_at: isoTs(events[0].created_at),
            }
          : null;

      // ── Build unified timeline ───────────────────────────────────────────────

      // Collect the stable source values that the richer origin-specific loops
      // will always emit so we can suppress their generic case_events mirrors.
      // Strategy: task/deadline/saved-work entries are always emitted from their
      // origin rows (richer data, correct ts). Generic case_event entries whose
      // source matches one of these prefixes AND whose backing row still exists
      // are skipped to prevent duplicates. Stage events keep the old "skip origin
      // if already in events" approach because they carry no extra data.
      const taskIds = new Set(tasks.map((t) => `task:${t.id}`));
      const deadlineIds = new Set(deadlineRows.map((d) => `deadline:${d.id}`));
      const savedWorkIds = new Set(savedWorkRows.map((sw) => `saved-work:${sw.id}`));

      const timeline: TimelineEntry[] = [];

      // 1. Case events — emit all events EXCEPT stable mirrors that have a
      //    current backing row (those will be emitted with richer data below).
      //    Stage mirrors also fall through here (deduped via stagedEventSources
      //    in step 2 below), as do filing/hearing/note/etc. with no backing row.
      //
      //    ts = event_date (legally meaningful date), not created_at. Two events
      //    on the same calendar day are broken by created_at via the sort step.
      for (const ev of events) {
        const src = ev.source ?? "";
        // Suppress task/deadline/saved-work mirrors only when the backing row
        // is present; orphaned mirrors (row deleted) stay in the timeline.
        if (
          (ev.kind === "task" && taskIds.has(src)) ||
          (ev.kind === "deadline" && deadlineIds.has(src)) ||
          (ev.kind === "saved-work" && savedWorkIds.has(src))
        ) {
          continue;
        }
        const eventDateIso = isoTs(ev.event_date); // midnight-UTC ISO for the legal date
        timeline.push({
          ts: eventDateIso,
          kind: ev.kind,
          title: ev.title,
          description: ev.description,
          source: ev.source,
          origin: "event",
          // Keep created_at available for tie-breaking in the sort below
          meta: {
            event_date: new Date(ev.event_date).toISOString().slice(0, 10),
            created_at: isoTs(ev.created_at),
          },
        });
      }

      // 2. Stage changes (from stage history, shown as stage events if not
      //    already mirrored into case_events with kind="stage")
      const stagedEventSources = new Set(
        events
          .filter((e) => e.kind === "stage" && e.source?.startsWith("stage:"))
          .map((e) => e.source),
      );
      for (const sh of stageHistory) {
        const stageSource = `stage:${sh.id}`;
        if (!stagedEventSources.has(stageSource)) {
          timeline.push({
            ts: isoTs(sh.changed_at),
            kind: "stage",
            title: sh.from_stage
              ? `Stage changed: ${sh.from_stage} → ${sh.to_stage}`
              : `Stage set to: ${sh.to_stage}`,
            origin: "stage",
            source: stageSource,
            meta: { from_stage: sh.from_stage, to_stage: sh.to_stage },
          });
        }
      }

      // 3. Tasks — always emitted from the current row (richer metadata).
      //    Use updated_at as the timeline ts so edits (status/assignee/priority
      //    changes) bubble to the top; fall back to created_at when equal.
      for (const task of tasks) {
        const taskSource = `task:${task.id}`;
        // ts = updated_at so the entry reflects the most recent change
        const ts = isoTs(task.updated_at ?? task.created_at);
        timeline.push({
          ts,
          kind: "task",
          title: `Task: ${task.title}`,
          description: task.note,
          source: taskSource,
          origin: "task",
          meta: {
            status: task.status,
            priority: task.priority,
            due_date: task.due_date,
            assignee: task.assignee,
          },
        });
      }

      // 3b. Deadlines — always emitted from the current row. ts = due_date so
      //     the entry slots into the chronology at the actual due point.
      for (const dl of deadlineRows) {
        const dlSource = `deadline:${dl.id}`;
        const dueIso = dl.due_date != null ? new Date(dl.due_date).toISOString() : null;
        timeline.push({
          ts: dueIso ?? new Date(0).toISOString(),
          kind: "deadline",
          title: `Deadline: ${dl.title}`,
          origin: "deadline",
          source: dlSource,
          meta: {
            due_date: dueIso != null ? dueIso.slice(0, 10) : null,
            status: dl.status || null,
          },
        });
      }

      // 4. Saved work — always emitted from the current row (richer tool data).
      //    Tool detection: check common input_json keys in priority order;
      //    fall back to a human-readable label derived from the work kind so
      //    filed AI output always identifies its source.
      for (const sw of savedWorkRows) {
        let tool: string;
        if (sw.input_json && typeof sw.input_json === "object") {
          const ij = sw.input_json as Record<string, unknown>;
          const detected =
            (typeof ij.tool === "string" && ij.tool) ||
            (typeof ij.toolName === "string" && ij.toolName) ||
            (typeof ij.sourceTool === "string" && ij.sourceTool) ||
            (typeof ij.source_tool === "string" && ij.source_tool);
          tool = detected || sw.kind;
        } else {
          tool = sw.kind;
        }
        timeline.push({
          ts: isoTs(sw.created_at),
          kind: "saved-work",
          title: sw.title,
          origin: "saved-work",
          source: `saved-work:${sw.id}`,
          tool,
          meta: { work_kind: sw.kind },
        });
      }

      // 5. Uploaded documents
      for (const doc of documents) {
        const docTs = doc.doc_date
          ? isoTs(doc.doc_date + "T00:00:00Z")
          : isoTs(doc.created_at);
        timeline.push({
          ts: docTs,
          kind: "document",
          title: doc.file_name,
          origin: "document",
          source: `document:${doc.id}`,
          meta: {
            category: doc.category,
            content_type: doc.content_type,
            size_bytes: doc.size_bytes,
          },
        });
      }

      // Sort timeline: newest first (deterministic)
      timeline.sort((a, b) => {
        const cmp = b.ts.localeCompare(a.ts);
        if (cmp !== 0) return cmp;
        // Secondary tie-break for generic events sharing the same event_date:
        // use created_at DESC so later-recorded entries still sort higher.
        if (a.origin === "event" && b.origin === "event") {
          const aCreated = (a.meta?.created_at as string | undefined) ?? "";
          const bCreated = (b.meta?.created_at as string | undefined) ?? "";
          const createdCmp = bCreated.localeCompare(aCreated);
          if (createdCmp !== 0) return createdCmp;
        }
        // Tertiary: origin type order for stable cross-origin ordering
        const originOrder = [
          "event",
          "stage",
          "task",
          "deadline",
          "saved-work",
          "document",
        ] as const;
        const aOrd = originOrder.indexOf(a.origin as (typeof originOrder)[number]);
        const bOrd = originOrder.indexOf(b.origin as (typeof originOrder)[number]);
        return aOrd - bOrd;
      });

      // Cap timeline at a reasonable limit
      const TIMELINE_LIMIT = 200;
      const trimmedTimeline = timeline.slice(0, TIMELINE_LIMIT);

      // ── Next action derivation ───────────────────────────────────────────────

      const today = new Date().toISOString().slice(0, 10);
      let nextAction: NextAction;

      // 1. Overdue or high-priority open task
      const overdueTask = outstandingTasks.find(
        (t) => t.due_date !== null && t.due_date < today,
      );
      const highTask = outstandingTasks.find(
        (t) => t.priority === "high" && t.status !== "done" && t.status !== "cancelled",
      );
      if (overdueTask) {
        nextAction = {
          source: "task",
          label: overdueTask.title,
          reason: "overdue",
          taskId: overdueTask.id,
        };
      } else if (highTask) {
        nextAction = {
          source: "task",
          label: highTask.title,
          reason: "high",
          taskId: highTask.id,
        };
      } else if (nextDeadline) {
        nextAction = {
          source: "deadline",
          label: nextDeadline.title,
          due_date: nextDeadline.due_date,
        };
      } else {
        const firstOpenChecklist = checklist.find((c) => !c.done);
        if (firstOpenChecklist) {
          nextAction = { source: "checklist", label: firstOpenChecklist.item_text };
        } else if (stageIndex >= 0 && stageIndex < stages.length - 1) {
          nextAction = { source: "stage", label: `Advance towards ${stages[stageIndex + 1]}` };
        } else {
          nextAction = { source: "stage", label: "No outstanding steps recorded" };
        }
      }

      // ── Assemble response ────────────────────────────────────────────────────

      res.json({
        matter: normalizeMatter(matterRow),
        stages,
        currentStage,
        stageIndex,
        stageCount: stages.length,
        stageHistory,
        nextDeadline,
        outstandingTasks,
        tasks,
        checklist: {
          items: checklist,
          total: checklist.length,
          done: checklist.filter((c) => c.done).length,
        },
        latestActivity,
        people,
        documents,
        savedWork: savedWorkRows.map((sw) => {
          let tool: string | null = null;
          if (sw.input_json && typeof sw.input_json === "object") {
            const ij = sw.input_json as Record<string, unknown>;
            tool =
              typeof ij.tool === "string"
                ? ij.tool
                : typeof ij.toolName === "string"
                  ? ij.toolName
                  : null;
          }
          return {
            id: sw.id,
            title: sw.title,
            kind: sw.kind,
            tool,
            created_at: isoTs(sw.created_at),
          };
        }),
        timeline: trimmedTimeline,
        nextAction,
      });
    } catch (err) {
      logger.error({ err, portal, matterId }, "case-home assembly failed");
      res.status(500).json({ error: "Failed to load case home" });
    }
  });
}
