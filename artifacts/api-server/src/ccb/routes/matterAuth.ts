import type { Response } from "express";
import { db, ccbAccessCodes } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Master/static-code sessions (MASTER_ACCESS_CODE, demo/env codes) have no
 * per-subscriber DB row, so requirePractitioner resolves them to a null
 * ccbAccessCodeId. That left them unable to own matter files ("Matter files
 * require a subscriber access code").
 *
 * To fix that without weakening isolation for real subscribers, we back each
 * static code with its own synthetic access-code row. The row is created
 * INACTIVE so it can never be logged into via /auth/verify — it exists purely
 * to give the static session a stable tenant id to own matter files. Each
 * distinct static code (e.g. master vs demo) gets its own row, so their matter
 * files stay isolated from each other and from every real subscriber.
 */

// Prefix for synthetic rows. The real code is appended so master and demo
// codes never collide on the unique `code` column.
const SYNTHETIC_PREFIX = "MASTER-OVERRIDE-CCB:";

// Cache resolved ids per code for the lifetime of the process.
const syntheticIdByCode = new Map<string, number>();

async function resolveSyntheticRowId(staticCode: string): Promise<number> {
  const cached = syntheticIdByCode.get(staticCode);
  if (cached) return cached;

  const rowCode = `${SYNTHETIC_PREFIX}${staticCode}`;

  const [existing] = await db
    .select({ id: ccbAccessCodes.id })
    .from(ccbAccessCodes)
    .where(eq(ccbAccessCodes.code, rowCode));
  if (existing) {
    syntheticIdByCode.set(staticCode, existing.id);
    return existing.id;
  }

  const [created] = await db
    .insert(ccbAccessCodes)
    .values({
      code: rowCode,
      label: "Master/static override (synthetic — not loginable)",
      active: false,
    })
    .onConflictDoNothing()
    .returning({ id: ccbAccessCodes.id });
  if (created) {
    syntheticIdByCode.set(staticCode, created.id);
    return created.id;
  }

  // Lost a race with a concurrent insert — read the winner.
  const [row] = await db
    .select({ id: ccbAccessCodes.id })
    .from(ccbAccessCodes)
    .where(eq(ccbAccessCodes.code, rowCode));
  syntheticIdByCode.set(staticCode, row!.id);
  return row!.id;
}

/**
 * Returns the tenant (access code id) that should own matter files for the
 * current request. Real subscribers use their resolved ccbAccessCodeId;
 * master/static-code sessions are mapped onto a synthetic per-code row.
 * Returns undefined only if the session has neither — i.e. it is not a valid
 * practitioner session (requirePractitioner should already have rejected it).
 */
export async function resolveMatterTenantId(
  res: Response,
): Promise<number | undefined> {
  const id = res.locals["ccbAccessCodeId"];
  if (typeof id === "number") return id;

  const staticCode = res.locals["ccbStaticCode"];
  if (typeof staticCode === "string" && staticCode.length > 0) {
    return resolveSyntheticRowId(staticCode);
  }

  return undefined;
}
