import {
  db,
  researchRightsRecords,
  researchSourceContainers,
  researchTransformations,
  rightsStatusSchema,
  type ResearchRightsRecord,
} from "@workspace/db";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { recordAuditEvent } from "../domain/audit";
import { transitionContainer } from "../domain/containerStateMachine";
import { EntityNotFoundError, type DbClient } from "../domain/types";

// Rights-review workflow (Phase 02). A formal rights decision appends a
// rights record (all 17 fields), updates the container's mirrored
// rights_status, and writes an audit event + transformation — atomically.
// DO_NOT_RETAIN additionally routes the container to DELETION_PENDING via
// the state machine (never a direct write).

export const RightsDecisionInput = z.object({
  status: rightsStatusSchema,
  reason: z.string().min(1),
  // The 17-field capture:
  source: z.string().min(1), // 1
  dateObtained: z.coerce.date(), // 2
  declaredSourceType: z.string().min(1), // 3
  licenceReference: z.string().nullable().default(null), // 4
  approvedUsers: z.array(z.string()).default([]), // 5
  approvedPurposes: z.array(z.string()).default([]), // 6
  storagePermitted: z.boolean(), // 7
  analysisPermitted: z.boolean(), // 8
  externalProcessingPermitted: z.boolean(), // 9
  studentAccessPermitted: z.boolean(), // 10
  printingPermitted: z.boolean(), // 11
  exportPermitted: z.boolean(), // 12
  retentionPeriod: z.string().nullable().default(null), // 13
  expiryDate: z.coerce.date().nullable().default(null), // 14
  reviewer: z.string().min(1), // 15
  reviewDate: z.coerce.date(), // 16
  notes: z.string().nullable().default(null), // 17
});
export type RightsDecision = z.infer<typeof RightsDecisionInput>;

export async function recordRightsDecision(
  containerId: number,
  decision: RightsDecision,
  opts: { actor: string; dbc?: DbClient },
): Promise<ResearchRightsRecord> {
  const dbc = opts.dbc ?? db;
  return dbc.transaction(async (tx) => {
    // Lock the container row so decision + mirror stay consistent under
    // concurrent reviews.
    const locked = await tx.execute(sql`
      SELECT id, rights_status, processing_state
      FROM research_source_containers
      WHERE id = ${containerId} FOR UPDATE
    `);
    const row = locked.rows[0] as
      | { id: number; rights_status: string; processing_state: string }
      | undefined;
    if (!row) throw new EntityNotFoundError("container", containerId);
    const previousStatus = row.rights_status;

    const [record] = await tx
      .insert(researchRightsRecords)
      .values({
        containerId,
        status: decision.status,
        decidedBy: opts.actor,
        reason: decision.reason,
        source: decision.source,
        dateObtained: decision.dateObtained,
        declaredSourceType: decision.declaredSourceType,
        licenceReference: decision.licenceReference,
        approvedUsers: decision.approvedUsers,
        approvedPurposes: decision.approvedPurposes,
        storagePermitted: decision.storagePermitted,
        analysisPermitted: decision.analysisPermitted,
        externalProcessingPermitted: decision.externalProcessingPermitted,
        studentAccessPermitted: decision.studentAccessPermitted,
        printingPermitted: decision.printingPermitted,
        exportPermitted: decision.exportPermitted,
        retentionPeriod: decision.retentionPeriod,
        expiryDate: decision.expiryDate,
        reviewer: decision.reviewer,
        reviewDate: decision.reviewDate,
        notes: decision.notes,
        detail: {},
      })
      .returning();

    // Mirror the latest status on the container.
    await tx
      .update(researchSourceContainers)
      .set({ rightsStatus: decision.status, updatedAt: new Date() })
      .where(eq(researchSourceContainers.id, containerId));

    // Rights changes are never silent: transformation + audit event, same tx.
    await tx.insert(researchTransformations).values({
      containerId,
      kind: "rights_change",
      detail: {
        from: previousStatus,
        to: decision.status,
        rightsRecordId: record!.id,
        reason: decision.reason,
      },
      actor: opts.actor,
    });
    await recordAuditEvent(tx, {
      entityType: "container",
      entityId: containerId,
      event: "rights-decision",
      fromState: previousStatus,
      toState: decision.status,
      actor: opts.actor,
      detail: { rightsRecordId: record!.id },
    });

    // DO_NOT_RETAIN feeds the deletion path via the state machine.
    if (
      decision.status === "DO_NOT_RETAIN" &&
      row.processing_state !== "DELETION_PENDING" &&
      row.processing_state !== "DELETED"
    ) {
      await transitionContainer(containerId, "DELETION_PENDING", {
        actor: opts.actor,
        detail: { cause: "rights-decision:DO_NOT_RETAIN" },
        dbc: tx,
      });
    }

    return record!;
  });
}

export async function listRightsRecords(
  containerId: number,
  dbc: DbClient = db,
): Promise<ResearchRightsRecord[]> {
  return dbc
    .select()
    .from(researchRightsRecords)
    .where(eq(researchRightsRecords.containerId, containerId))
    .orderBy(desc(researchRightsRecords.id));
}
