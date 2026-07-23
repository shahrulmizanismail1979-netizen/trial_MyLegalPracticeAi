import { researchAuditEvents } from "@workspace/db";
import type { DbClient } from "./types";

// Audit events are written in the SAME transaction as the state change they
// describe — callers must pass the transaction handle, never the global db.

export async function recordAuditEvent(
  dbc: DbClient,
  event: {
    entityType: "container" | "job" | "upload_batch" | "batch_item";
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
    detail: event.detail ?? {},
  });
}
