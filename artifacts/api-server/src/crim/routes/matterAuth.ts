import type { Request, Response, NextFunction } from "express";
import { db, crimAccessCodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Code string for the synthetic row that backs a MASTER_ACCESS_CODE session.
// The row is created inactive so it can never be logged into via the normal
// /auth/verify path — it exists purely so master sessions have a tenant id to
// own matter files.
const MASTER_ROW_CODE = "MASTER-OVERRIDE-CRIM";

let masterRowId: number | null = null;

async function resolveMasterRowId(): Promise<number> {
  if (masterRowId) return masterRowId;
  const [existing] = await db
    .select({ id: crimAccessCodesTable.id })
    .from(crimAccessCodesTable)
    .where(eq(crimAccessCodesTable.code, MASTER_ROW_CODE));
  if (existing) {
    masterRowId = existing.id;
    return existing.id;
  }
  const [created] = await db
    .insert(crimAccessCodesTable)
    .values({
      code: MASTER_ROW_CODE,
      label: "Master override (synthetic — not loginable)",
      isActive: false,
      tier: "full",
    })
    .onConflictDoNothing()
    .returning({ id: crimAccessCodesTable.id });
  if (created) {
    masterRowId = created.id;
    return created.id;
  }
  // Lost a race — read the winner.
  const [row] = await db
    .select({ id: crimAccessCodesTable.id })
    .from(crimAccessCodesTable)
    .where(eq(crimAccessCodesTable.code, MASTER_ROW_CODE));
  masterRowId = row!.id;
  return row!.id;
}

export type AuthedRequest = Request & { accessCodeId: number };

/**
 * Resolves the tenant (access code id) for matter/saved-work routes. Runs
 * after the crim requireAuth middleware, so the session is already verified.
 * Master sessions (no DB row) are mapped onto a synthetic inactive row.
 */
export async function requireMatterTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sess = req.session as unknown as Record<string, unknown> | undefined;
  if (!sess || sess.authenticated !== true) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  let accessCodeId = sess.accessCodeId as number | undefined;
  if (!accessCodeId && sess.isMaster === true) {
    try {
      accessCodeId = await resolveMasterRowId();
    } catch {
      res.status(500).json({ error: "Auth check failed" });
      return;
    }
  }
  if (!accessCodeId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  (req as AuthedRequest).accessCodeId = accessCodeId;
  next();
}

export function tenantOf(req: Request): number {
  return (req as AuthedRequest).accessCodeId;
}
