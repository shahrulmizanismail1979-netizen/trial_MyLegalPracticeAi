import {
  db,
  researchSourceContainers,
  researchRightsRecords,
  type ResearchRole,
  type ResearchSourceContainer,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  decideAccess,
  isSearchVisible,
  type AccessAction,
  type AccessDecision,
  type AccessRestrictions,
} from "./access";
import { recordAuditEvent } from "./audit";
import { AuditAction } from "./auditEvents";
import { EntityNotFoundError, type DbClient } from "./types";

// Enforcement gates (Phase 02). Every gate resolves the container's current
// rights status + latest rights record and answers via decideAccess — the
// single access-decision function. Denials on restricted resources are
// recorded as audit events.

export class AccessDeniedError extends Error {
  readonly code = "ACCESS_DENIED" as const;
  constructor(
    readonly action: AccessAction,
    readonly reason: string,
    readonly containerId: number,
  ) {
    super(`Access denied: ${action} on container ${containerId} (${reason})`);
    this.name = "AccessDeniedError";
  }
}

/** Latest rights record → record-level restrictions for decideAccess. */
export async function getRestrictions(
  containerId: number,
  dbc: DbClient = db,
): Promise<AccessRestrictions> {
  const [latest] = await dbc
    .select()
    .from(researchRightsRecords)
    .where(eq(researchRightsRecords.containerId, containerId))
    .orderBy(desc(researchRightsRecords.id))
    .limit(1);
  if (!latest) return {};
  return {
    studentAccessPermitted: latest.studentAccessPermitted,
    exportPermitted: latest.exportPermitted,
    printingPermitted: latest.printingPermitted,
    externalProcessingPermitted: latest.externalProcessingPermitted,
    expired:
      latest.expiryDate !== null && latest.expiryDate.getTime() < Date.now(),
  };
}

/**
 * Decide an action against a live container (loads rights status, processing
 * state, and latest record restrictions). Denials on restricted resources
 * write an audit event.
 */
export async function checkContainerAccess(
  containerId: number,
  role: ResearchRole | null,
  action: AccessAction,
  opts: { actor?: string; dbc?: DbClient; audit?: boolean } = {},
): Promise<{ decision: AccessDecision; container: ResearchSourceContainer }> {
  const dbc = opts.dbc ?? db;
  const [container] = await dbc
    .select()
    .from(researchSourceContainers)
    .where(eq(researchSourceContainers.id, containerId));
  if (!container) throw new EntityNotFoundError("container", containerId);
  const restrictions = await getRestrictions(containerId, dbc);
  const decision = decideAccess({
    role,
    rightsStatus: container.rightsStatus,
    processingState: container.processingState,
    action,
    restrictions,
  });
  if (!decision.allowed && opts.audit !== false) {
    await recordAuditEvent(dbc, {
      entityType: "container",
      entityId: containerId,
      event: AuditAction.ACCESS_DENIED,
      actor: opts.actor ?? (role ? `role:${role}` : "unauthenticated"),
      detail: {
        action,
        reason: decision.reason,
        rightsStatus: container.rightsStatus,
        processingState: container.processingState,
      },
    });
  }
  return { decision, container };
}

/** Throwing form for processors and services. */
export async function assertContainerAccess(
  containerId: number,
  role: ResearchRole | null,
  action: AccessAction,
  opts: { actor?: string; dbc?: DbClient } = {},
): Promise<ResearchSourceContainer> {
  const { decision, container } = await checkContainerAccess(
    containerId,
    role,
    action,
    opts,
  );
  if (!decision.allowed) {
    throw new AccessDeniedError(action, decision.reason, containerId);
  }
  return container;
}

/**
 * Search-listing gate: filters a container list down to what the given role
 * may see in search results. Quarantined/held/restricted containers never
 * appear, regardless of role, and record-level restrictions (e.g. expired
 * rights records) are enforced per container.
 */
export async function filterSearchVisible(
  containers: ResearchSourceContainer[],
  role: ResearchRole | null,
  dbc: DbClient = db,
): Promise<ResearchSourceContainer[]> {
  const visible: ResearchSourceContainer[] = [];
  for (const c of containers) {
    if (!isSearchVisible(c.rightsStatus, c.processingState)) continue;
    const restrictions = await getRestrictions(c.id, dbc);
    const decision = decideAccess({
      role,
      rightsStatus: c.rightsStatus,
      processingState: c.processingState,
      action: "search",
      restrictions,
    });
    if (decision.allowed) visible.push(c);
  }
  return visible;
}

/**
 * External-AI / external-processing submission gate. There is NO external
 * call behind this in Phase 02 — the gate exists so later phases must pass
 * through it. It structurally refuses EXTERNAL_AI_RESTRICTED, DO_NOT_PROCESS,
 * and anything else the rights caps forbid, and audits every refusal.
 */
export async function assertExternalAiSubmissionAllowed(
  containerId: number,
  role: ResearchRole | null,
  opts: { actor?: string; dbc?: DbClient } = {},
): Promise<ResearchSourceContainer> {
  return assertContainerAccess(containerId, role, "external_ai", opts);
}

/**
 * Export gate: rights caps + express approval recorded in the latest rights
 * record (exportPermitted === true) are both required.
 */
export async function assertExportAllowed(
  containerId: number,
  role: ResearchRole | null,
  opts: { actor?: string; dbc?: DbClient } = {},
): Promise<ResearchSourceContainer> {
  return assertContainerAccess(containerId, role, "export", opts);
}
