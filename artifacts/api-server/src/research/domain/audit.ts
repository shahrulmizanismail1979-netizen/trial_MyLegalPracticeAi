import { db, researchAuditEvents } from "@workspace/db";
import { logger } from "../../lib/logger";
import type { DbClient } from "./types";
import { sanitiseForAudit } from "./auditEvents";

// Audit events are written in the SAME transaction as the state change they
// describe — callers must pass the transaction handle, never the global db.
// For non-transactional events (access logs, search, etc.) use emitAuditEvent.

export async function recordAuditEvent(
  dbc: DbClient,
  event: {
    entityType:
      | "container"
      | "job"
      | "upload_batch"
      | "batch_item"
      | "page_extraction"
      | "segmentation_run"
      | "case_candidate"
      | "editorial_run"
      | "page_section"
      | "judgment"
      | "quotation"
      | "ai_provider"
      | "ai_run"
      | "search"
      | "user";
    entityId: number;
    event: string;
    fromState?: string | null;
    toState?: string | null;
    actor?: string;
    detail?: Record<string, unknown>;
  },
): Promise<void> {
  await dbc.insert(researchAuditEvents).values({
    entityType: event.entityType,
    entityId: event.entityId,
    event: event.event,
    fromState: event.fromState ?? null,
    toState: event.toState ?? null,
    actor: event.actor ?? "system",
    // Always sanitise detail to prevent long strings (e.g. judgment text)
    // leaking into audit logs.
    detail: sanitiseForAudit(event.detail ?? {}),
  });
}

/**
 * Fire-and-forget audit event using the global db connection.
 * Used for non-transactional events (document access, search, AI calls, etc.)
 * where atomicity with the business action is not required.
 * Errors are swallowed — audit failures must never break the main request.
 */
export async function emitAuditEvent(event: {
  entityType:
    | "container"
    | "job"
    | "upload_batch"
    | "batch_item"
    | "page_extraction"
    | "segmentation_run"
    | "case_candidate"
    | "editorial_run"
    | "page_section"
    | "judgment"
    | "quotation"
    | "ai_provider"
    | "ai_run"
    | "search"
    | "user";
  entityId: number;
  event: string;
  fromState?: string | null;
  toState?: string | null;
  actor?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await recordAuditEvent(db, event);
  } catch (err) {
    // Audit failures are logged but never propagated.
    logger.warn({ err, auditEvent: event.event, entityType: event.entityType }, "Audit event write failed");
  }
}
