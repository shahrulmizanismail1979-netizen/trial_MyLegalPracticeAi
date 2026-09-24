/** Pure check shared by bounded admin diagnostics; never return credentials. */
export function portalRowAccessible(row: {
  isActive?: boolean | null;
  status?: string | null;
  expiresAt?: Date | null;
} | undefined, now = new Date()): boolean {
  return !!row && row.isActive !== false &&
    (row.status == null || row.status === "active") &&
    (!row.expiresAt || row.expiresAt > now);
}