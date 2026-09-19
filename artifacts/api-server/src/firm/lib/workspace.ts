import { AsyncLocalStorage } from "node:async_hooks";
import { eq, type SQL, type AnyColumn } from "drizzle-orm";

const firmWorkspaceStorage = new AsyncLocalStorage<number>();

/**
 * Runs an operation in an explicit firm workspace. Workspace 0 is the legacy
 * owner-private workspace; positive IDs correspond to firm_access_codes.id.
 */
export function runWithFirmWorkspace<T>(
  workspaceId: number,
  fn: () => T,
): T {
  if (!Number.isSafeInteger(workspaceId) || workspaceId < 0) {
    throw new Error("Firm workspace id must be a non-negative safe integer");
  }
  return firmWorkspaceStorage.run(workspaceId, fn);
}

/** Returns the active workspace and deliberately fails closed when unset. */
export function currentFirmWorkspaceId(): number {
  const workspaceId = firmWorkspaceStorage.getStore();
  if (workspaceId === undefined) {
    throw new Error("Firm workspace context is required");
  }
  return workspaceId;
}

/** Builds the mandatory tenant predicate for a workspace-aware Drizzle table. */
export function firmScope<T extends { workspaceId: AnyColumn }>(table: T): SQL {
  return eq(table.workspaceId, currentFirmWorkspaceId());
}

/** Supplies the mandatory tenant value for inserts. */
export function firmValues(): { workspaceId: number } {
  return { workspaceId: currentFirmWorkspaceId() };
}