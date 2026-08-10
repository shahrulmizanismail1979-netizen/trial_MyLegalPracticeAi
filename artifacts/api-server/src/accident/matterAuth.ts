import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { accessCodesTable, accessCodeUsageTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { isMasterToken } from "../routes/accident";

/**
 * Ownership / tenant resolution for the MyAccidentAI matter-file routes.
 *
 * MyAccidentAI authenticates by a `session_id` cookie:
 *   - a normal access-code login inserts a row in access_code_usage keyed by
 *     session id; the owning access code is access_code_usage.access_code_id.
 *   - a MASTER_ACCESS_CODE login issues a signed HMAC token with no DB row.
 *
 * Matter rows FK to access_codes(id), so a master session has no tenant id of
 * its own. Following the portal-matter-files pattern we lazily upsert a
 * synthetic, permanently-INACTIVE access-code row and use its id as the master
 * tenant. The row is inactive so it can never be used as a login credential.
 */

const MASTER_ROW_CODE = "MASTER-OVERRIDE-ACCIDENT";

let masterRowId: number | null = null;

async function resolveMasterRowId(): Promise<number> {
  if (masterRowId) return masterRowId;
  const [existing] = await db
    .select({ id: accessCodesTable.id })
    .from(accessCodesTable)
    .where(eq(accessCodesTable.code, MASTER_ROW_CODE));
  if (existing) {
    masterRowId = existing.id;
    return existing.id;
  }
  const [created] = await db
    .insert(accessCodesTable)
    .values({
      code: MASTER_ROW_CODE,
      label: "Master override (synthetic — not loginable)",
      isActive: false,
      maxUsers: 0,
    })
    .onConflictDoNothing()
    .returning({ id: accessCodesTable.id });
  if (created) {
    masterRowId = created.id;
    return created.id;
  }
  // Lost a race — read the winner.
  const [row] = await db
    .select({ id: accessCodesTable.id })
    .from(accessCodesTable)
    .where(eq(accessCodesTable.code, MASTER_ROW_CODE));
  masterRowId = row!.id;
  return row!.id;
}

export type AuthedRequest = Request & { accidentOwnerId: number };

export async function requireMatterTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionId: string | undefined = req.cookies?.session_id;
  if (!sessionId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  let ownerId: number | undefined;
  try {
    if (isMasterToken(sessionId)) {
      ownerId = await resolveMasterRowId();
    } else {
      const [usage] = await db
        .select({ accessCodeId: accessCodeUsageTable.accessCodeId })
        .from(accessCodeUsageTable)
        .where(eq(accessCodeUsageTable.sessionId, sessionId));
      ownerId = usage?.accessCodeId;
    }
  } catch {
    res.status(500).json({ error: "Auth check failed" });
    return;
  }

  if (typeof ownerId !== "number") {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  (req as AuthedRequest).accidentOwnerId = ownerId;
  next();
}

export function ownerOf(req: Request): number {
  return (req as AuthedRequest).accidentOwnerId;
}
