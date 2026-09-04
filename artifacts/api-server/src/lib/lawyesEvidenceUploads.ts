import { pool } from "@workspace/db";
import { ObjectNotFoundError, ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const objectStorage = new ObjectStorageService();
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export type EvidenceUploadClaim = {
  id: number;
  objectPath: string;
  ownerKey: string;
  matterId: number;
};

export async function issueLawyesEvidenceUpload(ownerKey: string, matterId: number) {
  const uploadURL = await objectStorage.getObjectEntityUploadURL();
  const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
  await pool.query(
    `INSERT INTO case_pending_uploads
      (portal, owner_key, matter_id, object_path, purpose, status, expires_at)
     VALUES ('lit', $1, $2, $3, 'lawyes-evidence', 'pending', now() + interval '30 minutes')
     ON CONFLICT (object_path) DO NOTHING`,
    [ownerKey, matterId, objectPath],
  );
  return { uploadURL, objectPath };
}

export async function claimLawyesEvidenceUpload(
  ownerKey: string,
  matterId: number,
  objectPath: string,
): Promise<EvidenceUploadClaim | null> {
  const result = await pool.query<{ id: number; object_path: string }>(
    `UPDATE case_pending_uploads
        SET status = 'processing', claimed_at = now(),
            expires_at = now() + interval '2 hours'
      WHERE object_path = $1 AND portal = 'lit' AND owner_key = $2 AND matter_id = $3
        AND purpose = 'lawyes-evidence' AND status = 'pending' AND expires_at > now()
      RETURNING id, object_path`,
    [objectPath, ownerKey, matterId],
  );
  const row = result.rows[0];
  return row ? { id: row.id, objectPath: row.object_path, ownerKey, matterId } : null;
}

export async function cleanupClaimedLawyesEvidence(
  claim: EvidenceUploadClaim,
): Promise<void> {
  const marked = await pool.query(
    `UPDATE case_pending_uploads
        SET status = 'cleanup', expires_at = now()
      WHERE id = $1 AND portal = 'lit' AND owner_key = $2
        AND object_path = $3 AND matter_id = $4
        AND purpose = 'lawyes-evidence' AND status = 'processing'
      RETURNING id`,
    [claim.id, claim.ownerKey, claim.objectPath, claim.matterId],
  );
  if (marked.rowCount === 0) return;
  let objectRemoved = false;
  try {
    const file = await objectStorage.getObjectEntityFile(claim.objectPath);
    await file.delete({ ignoreNotFound: true });
    objectRemoved = true;
  } catch (err) {
    if (err instanceof ObjectNotFoundError) objectRemoved = true;
    else logger.warn({ claimId: claim.id }, "Lawyes evidence object cleanup will be retried");
  }
  if (objectRemoved) {
    await pool.query(
      `DELETE FROM case_pending_uploads
        WHERE id = $1 AND portal = 'lit' AND owner_key = $2
          AND object_path = $3 AND matter_id = $4
          AND purpose = 'lawyes-evidence' AND status = 'cleanup'`,
      [claim.id, claim.ownerKey, claim.objectPath, claim.matterId],
    );
  }
}

export async function sweepExpiredLawyesEvidenceUploads(): Promise<number> {
  const expired = await pool.query<{
    id: number;
    owner_key: string;
    matter_id: number;
    object_path: string;
  }>(
    `WITH candidates AS (
       SELECT id
         FROM case_pending_uploads
        WHERE portal = 'lit' AND purpose = 'lawyes-evidence'
          AND (expires_at < now() OR status = 'cleanup')
        ORDER BY id
        FOR UPDATE SKIP LOCKED
        LIMIT 100
     )
     UPDATE case_pending_uploads pending
        SET status = 'cleanup'
       FROM candidates
      WHERE pending.id = candidates.id
      RETURNING pending.id, pending.owner_key, pending.matter_id, pending.object_path`,
  );
  let removed = 0;
  for (const row of expired.rows) {
    let objectRemoved = false;
    try {
      const file = await objectStorage.getObjectEntityFile(row.object_path);
      await file.delete({ ignoreNotFound: true });
      objectRemoved = true;
    } catch (err) {
      if (err instanceof ObjectNotFoundError) objectRemoved = true;
      else logger.warn({ claimId: row.id }, "Expired Lawyes evidence cleanup will be retried");
    }
    if (!objectRemoved) continue;
    const deleted = await pool.query(
      `DELETE FROM case_pending_uploads
        WHERE id = $1 AND owner_key = $2 AND object_path = $3
          AND matter_id = $4
          AND portal = 'lit' AND purpose = 'lawyes-evidence' AND status = 'cleanup'`,
      [row.id, row.owner_key, row.object_path, row.matter_id],
    );
    removed += deleted.rowCount ?? 0;
  }
  return removed;
}

let sweepStarted = false;
export async function startLawyesEvidenceUploadSweepWorker(): Promise<void> {
  if (sweepStarted) return;
  sweepStarted = true;
  await sweepExpiredLawyesEvidenceUploads();
  setInterval(() => {
    void sweepExpiredLawyesEvidenceUploads().catch(() => {
      logger.warn("Lawyes evidence upload sweep failed");
    });
  }, SWEEP_INTERVAL_MS).unref?.();
  logger.info("Lawyes evidence upload sweep worker started");
}

export { objectStorage as lawyesEvidenceObjectStorage };