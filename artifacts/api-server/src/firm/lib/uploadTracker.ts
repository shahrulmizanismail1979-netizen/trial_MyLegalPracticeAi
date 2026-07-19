/**
 * In-memory tracker for presigned upload URLs that have been issued but not
 * yet claimed (i.e. the corresponding evidence record has not been saved).
 *
 * Purpose: prevent storage abuse by limiting how many unclaimed upload slots
 * a single user can hold open at once.  A URL is considered "claimed" when
 * the evidence route that calls markUploadClaimed() completes.  Entries older
 * than PENDING_TTL_MS are evicted automatically on the next call per user.
 *
 * This tracker is intentionally in-memory — unclaimed URLs expire naturally
 * (presigned URLs have their own TTL on the storage side) and restarting the
 * server evicts all pending entries, which is acceptable.
 */

export const MAX_PENDING_PER_USER = 5;
const PENDING_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface PendingEntry {
  objectPath: string;
  issuedAt: number;
}

const pendingUploads = new Map<number, PendingEntry[]>();

/**
 * Record that a presigned upload URL was issued for the given user/objectPath.
 * Call this immediately after minting the upload URL.
 */
export function trackPendingUpload(userId: number, objectPath: string): void {
  const entries = pendingUploads.get(userId) ?? [];
  entries.push({ objectPath, issuedAt: Date.now() });
  pendingUploads.set(userId, entries);
}

/**
 * Remove entries that have exceeded the TTL for the given user.
 * Call this before checking getPendingCount() to ensure stale entries are
 * not counted against the user's limit.
 */
export async function cleanupStaleUploads(userId: number): Promise<void> {
  const entries = pendingUploads.get(userId);
  if (!entries) return;
  const now = Date.now();
  const fresh = entries.filter((e) => now - e.issuedAt < PENDING_TTL_MS);
  if (fresh.length === 0) {
    pendingUploads.delete(userId);
  } else {
    pendingUploads.set(userId, fresh);
  }
}

/**
 * Return the number of active (non-expired) pending upload entries for a user.
 * Always call cleanupStaleUploads() first.
 */
export function getPendingCount(userId: number): number {
  return pendingUploads.get(userId)?.length ?? 0;
}

/**
 * Mark an upload as claimed (the evidence record has been persisted).
 * Call this from the evidence creation route after successfully saving the
 * evidence record so the slot is freed immediately rather than waiting for TTL.
 */
export function markUploadClaimed(userId: number, objectPath: string): void {
  const entries = pendingUploads.get(userId);
  if (!entries) return;
  const filtered = entries.filter((e) => e.objectPath !== objectPath);
  if (filtered.length === 0) {
    pendingUploads.delete(userId);
  } else {
    pendingUploads.set(userId, filtered);
  }
}
