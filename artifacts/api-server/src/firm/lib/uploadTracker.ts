import { pool } from "@workspace/db";
import { sql, type SQL } from "drizzle-orm";

/**
 * Persistent, single-use grants for firm evidence uploads.
 *
 * The table is shared with the case portals. Firm rows are isolated by their
 * portal, purpose and owner key, so a grant from another product (or user)
 * cannot be consumed here.
 */
export const MAX_PENDING_PER_USER = 5;
const PORTAL = "firm";
const PURPOSE = "firm-evidence";
const PENDING_TTL_MINUTES = 30;

function ownerKey(workspaceId: number, userId: number): string {
  return `${workspaceId}:${userId}`;
}

/**
 * Atomically reserve one of the uploader's pending slots.
 *
 * The transaction-scoped advisory lock makes the count-and-insert sequence
 * safe across processes and autoscaled instances. Returns false when the cap
 * has already been reached.
 */
export async function trackPendingUpload(
  workspaceId: number,
  userId: number,
  objectPath: string,
): Promise<boolean> {
  const owner = ownerKey(workspaceId, userId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`${PORTAL}:${PURPOSE}:${owner}`],
    );
    const countResult = await client.query<{ pending_count: string }>(
      `SELECT count(*)::text AS pending_count
         FROM case_pending_uploads
        WHERE portal = $1 AND owner_key = $2 AND purpose = $3
          AND status = 'pending' AND expires_at > now()`,
      [PORTAL, owner, PURPOSE],
    );
    if (Number(countResult.rows[0]?.pending_count ?? 0) >= MAX_PENDING_PER_USER) {
      await client.query("ROLLBACK");
      return false;
    }

    const inserted = await client.query(
      `INSERT INTO case_pending_uploads
         (portal, owner_key, object_path, purpose, status, expires_at)
       VALUES ($1, $2, $3, $4, 'pending',
               now() + ($5 * interval '1 minute'))
       ON CONFLICT (object_path) DO NOTHING`,
      [PORTAL, owner, objectPath, PURPOSE, PENDING_TTL_MINUTES],
    );
    if (inserted.rowCount !== 1) {
      throw new Error("Could not persist the firm upload grant.");
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Remove only expired grant rows; backing objects are handled elsewhere. */
export async function cleanupStaleUploads(
  workspaceId: number,
  userId: number,
): Promise<void> {
  await pool.query(
    `DELETE FROM case_pending_uploads
      WHERE portal = $1 AND owner_key = $2 AND purpose = $3
        AND status = 'pending' AND expires_at <= now()`,
    [PORTAL, ownerKey(workspaceId, userId), PURPOSE],
  );
}

/** Query the live database so process restarts cannot reset the pending cap. */
export async function getPendingCount(
  workspaceId: number,
  userId: number,
): Promise<number> {
  const result = await pool.query<{ pending_count: string }>(
    `SELECT count(*)::text AS pending_count
       FROM case_pending_uploads
      WHERE portal = $1 AND owner_key = $2 AND purpose = $3
        AND status = 'pending' AND expires_at > now()`,
    [PORTAL, ownerKey(workspaceId, userId), PURPOSE],
  );
  return Number(result.rows[0]?.pending_count ?? 0);
}

type GrantTransaction = {
  execute(query: SQL): Promise<unknown>;
};

/**
 * Consume an exact, unexpired grant using the caller's transaction.
 *
 * Callers must insert the evidence row in that same transaction. If their
 * insert fails, PostgreSQL rolls this DELETE back and the grant remains usable.
 */
export async function markUploadClaimed(
  tx: GrantTransaction,
  workspaceId: number,
  userId: number,
  objectPath: string,
): Promise<boolean> {
  const result = await tx.execute(sql`
    DELETE FROM case_pending_uploads
     WHERE portal = ${PORTAL}
       AND owner_key = ${ownerKey(workspaceId, userId)}
       AND purpose = ${PURPOSE}
       AND status = 'pending'
       AND object_path = ${objectPath}
       AND expires_at > now()
     RETURNING id
  `);
  return ((result as { rows?: unknown[] }).rows?.length ?? 0) === 1;
}