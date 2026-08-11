// MyAccidentAI seat allocation — atomic per access code.
//
// Accident predates the shared portal_code_seats registry and keeps its own
// access_code_usage table (matter tenancy is keyed by it), so team-bundle
// seat enforcement here makes that mechanism atomic and TTL-bounded instead
// of migrating it:
//  - the whole stale-cleanup → capacity-check → insert runs in one
//    transaction under a per-code advisory lock, so concurrent logins can
//    never exceed maxUsers;
//  - usage rows expire after SEAT_TTL_MS of inactivity (usedAt doubles as
//    last-seen and is refreshed on every authenticated request), so
//    abandoned sessions free their seat;
//  - access_codes.currentUsers is recomputed from live usage rows on every
//    allocation, so the display counter cannot drift.
import crypto from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { db, accessCodesTable, accessCodeUsageTable } from "@workspace/db";
import { SEAT_TTL_MS } from "../lib/seatLimits";
import { logger } from "../lib/logger";

/**
 * Atomically claim an Accident seat. Returns the new session id, or
 * `{ ok: false }` when all licensed seats are held by active sessions.
 */
export async function allocateAccidentSession(params: {
  accessCodeId: number;
  maxUsers: number;
}): Promise<{ ok: true; sessionId: string } | { ok: false }> {
  const { accessCodeId } = params;
  const limit = Math.max(1, params.maxUsers);
  const sessionId = crypto.randomUUID();
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`seats:accident:${accessCodeId}`}))`,
    );
    // Expire abandoned sessions first so they free their seat.
    const cutoff = new Date(Date.now() - SEAT_TTL_MS);
    await tx
      .delete(accessCodeUsageTable)
      .where(
        and(
          eq(accessCodeUsageTable.accessCodeId, accessCodeId),
          lt(accessCodeUsageTable.usedAt, cutoff),
        ),
      );
    const active = await tx
      .select({ id: accessCodeUsageTable.id })
      .from(accessCodeUsageTable)
      .where(eq(accessCodeUsageTable.accessCodeId, accessCodeId));
    if (active.length >= limit) {
      // Keep the display counter honest even when the login is rejected.
      await tx
        .update(accessCodesTable)
        .set({ currentUsers: active.length })
        .where(eq(accessCodesTable.id, accessCodeId));
      return { ok: false as const };
    }
    await tx.insert(accessCodeUsageTable).values({ accessCodeId, sessionId });
    await tx
      .update(accessCodesTable)
      .set({ currentUsers: active.length + 1 })
      .where(eq(accessCodesTable.id, accessCodeId));
    return { ok: true as const, sessionId };
  });
}

/**
 * Refresh a session's last-seen time (usedAt) so actively used sessions
 * never age out of the inactivity TTL. Best-effort; fire-and-forget safe.
 */
export async function touchAccidentUsage(sessionId: string): Promise<void> {
  try {
    await db
      .update(accessCodeUsageTable)
      .set({ usedAt: new Date() })
      .where(eq(accessCodeUsageTable.sessionId, sessionId));
  } catch (err) {
    logger.error({ err }, "Failed to refresh accident session activity");
  }
}
