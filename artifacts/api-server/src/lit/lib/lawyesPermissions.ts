import type { Request, Response } from "express";
import {
  db,
  litLawyesAuditEvents,
  litLawyesMatterGrants,
  litLawyesMembers,
  type LitLawyesRole,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";

export type LawyesIdentity = {
  accessCodeId: number;
  memberId: number | null;
  role: LitLawyesRole;
  legacyOwner: boolean;
};

export function lawyesIdentity(req: Request, res?: Response): LawyesIdentity {
  const session = req.session as unknown as { accessCodeId?: number; memberId?: number };
  const memberId = (res?.locals["litMemberId"] as number | undefined) ?? session.memberId ?? null;
  return {
    accessCodeId: Number((req as Request & { accessCodeId?: number }).accessCodeId
      ?? res?.locals["litAccessCodeId"] ?? session.accessCodeId),
    memberId,
    role: memberId
      ? ((res?.locals["litMemberRole"] as LitLawyesRole | undefined) ?? "viewer")
      : "owner",
    legacyOwner: !memberId,
  };
}

export function roleAllows(actual: LitLawyesRole, needed: LitLawyesRole): boolean {
  const level = { viewer: 0, editor: 1, owner: 2 };
  return level[actual] >= level[needed];
}

export async function matterRole(
  identity: LawyesIdentity,
  matterId: number,
): Promise<LitLawyesRole | null> {
  // Tenant administration and matter access are separate boundaries. Only the
  // legacy shared-code owner keeps implicit access to every tenant matter;
  // every named member (including tenant admins) needs an explicit grant.
  if (identity.legacyOwner) return "owner";
  const [grant] = await db.select({ role: litLawyesMatterGrants.role })
    .from(litLawyesMatterGrants).where(and(
      eq(litLawyesMatterGrants.accessCodeId, identity.accessCodeId),
      eq(litLawyesMatterGrants.memberId, identity.memberId!),
      eq(litLawyesMatterGrants.matterId, matterId),
    )).limit(1);
  return (grant?.role as LitLawyesRole | undefined) ?? null;
}

export async function writeAudit(
  identity: LawyesIdentity,
  action: string,
  resourceType: string,
  resourceId: string | number,
  details: Record<string, unknown> = {},
): Promise<void> {
  // Explicit allow-list: audit records can never become a side channel for case data.
  const safe: Record<string, string | null> = {};
  for (const key of ["fromRole", "toRole", "role"] as const) {
    const value = details[key];
    if (value === null || value === "owner" || value === "editor" || value === "viewer") {
      safe[key] = value as string | null;
    }
  }
  await db.insert(litLawyesAuditEvents).values({
    accessCodeId: identity.accessCodeId,
    actorMemberId: identity.memberId,
    action: action.slice(0, 100),
    resourceType: resourceType.slice(0, 100),
    resourceId: String(resourceId).slice(0, 100),
    details: safe,
  });
}

export async function activeTenantMember(accessCodeId: number, memberId: number) {
  const [member] = await db.select().from(litLawyesMembers).where(and(
    eq(litLawyesMembers.id, memberId),
    eq(litLawyesMembers.accessCodeId, accessCodeId),
  )).limit(1);
  return member && !member.revokedAt ? member : null;
}