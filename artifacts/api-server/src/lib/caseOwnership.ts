/**
 * Portal-agnostic matter ownership verification.
 *
 * Checks whether a given matter row belongs to the caller, using the portal's
 * own matter table. This prevents cross-tenant injection into shared tables
 * (case_checklists, case_time_entries, etc.) when a caller supplies an
 * arbitrary matter ID.
 *
 * Owner-key format per portal:
 *   lit, crim, corp, ccb  →  String(access_code_id)    e.g. "42"
 *   convey                →  String(user_id)            e.g. "7"
 *   acc                   →  String(owner_id)           e.g. "42"
 *   sya                   →  "{ownerType}:{ownerId}"    e.g. "code:42"
 */
import { pool } from "@workspace/db";
import type { Portal } from "./caseStages";

export async function verifyMatterOwnership(
  portal: Portal,
  matterId: number,
  ownerKey: string,
): Promise<boolean> {
  if (Number.isNaN(matterId) || matterId <= 0) return false;
  if (!ownerKey) return false;

  try {
    if (portal === "sya") {
      // owner key is "{ownerType}:{ownerId}"
      const colon = ownerKey.indexOf(":");
      if (colon < 0) return false;
      const ownerType = ownerKey.slice(0, colon);
      const ownerId = parseInt(ownerKey.slice(colon + 1), 10);
      if (Number.isNaN(ownerId)) return false;
      const { rows } = await pool.query(
        `SELECT 1 FROM sya_matters WHERE id = $1 AND owner_type = $2 AND owner_id = $3 LIMIT 1`,
        [matterId, ownerType, ownerId],
      );
      return rows.length > 0;
    }

    // All other portals: single integer FK column
    const ownerCol =
      portal === "convey" ? "user_id" : portal === "acc" ? "owner_id" : "access_code_id";
    const ownerId = parseInt(ownerKey, 10);
    if (Number.isNaN(ownerId)) return false;
    const { rows } = await pool.query(
      `SELECT 1 FROM ${portal}_matters WHERE id = $1 AND ${ownerCol} = $2 LIMIT 1`,
      [matterId, ownerId],
    );
    return rows.length > 0;
  } catch {
    // DB errors fail closed — deny access rather than grant it
    return false;
  }
}
