import crypto from "node:crypto";
import { logger } from "./logger";

/**
 * Server-managed secret for manager authentication.
 *
 * MANAGER_PASSCODE is retained for backwards-compatible callers, but the
 * portal's active manager gate uses MASTER_ACCESS_CODE via masterCode.ts.
 * There is deliberately no built-in credential when this variable is absent.
 */

export function getManagerPasscode(): string {
  const configured = process.env.MANAGER_PASSCODE?.trim();
  if (!configured) {
    logger.warn(
      "MANAGER_PASSCODE is not set; legacy manager-token callers are disabled.",
    );
    return "";
  }
  return configured;
}

const TOKEN_VERSION = "v1";

function signingKey(): string {
  const configured =
    process.env.FIRM_STORAGE_TOKEN_SECRET?.trim() ||
    process.env.MANAGER_SESSION_SECRET?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (!configured) {
    throw new Error(
      "Firm storage signing is unavailable: configure FIRM_STORAGE_TOKEN_SECRET.",
    );
  }
  return crypto
    .createHmac("sha256", "mylawfirm-storage-upload-token")
    .update(configured)
    .digest("hex");
}

function signature(workspaceId: number, objectId: string): string {
  return crypto
    .createHmac("sha256", signingKey())
    .update(`${TOKEN_VERSION}:${workspaceId}:${objectId}`)
    .digest("base64url");
}

/** Build the opaque, workspace-bound name used for a newly issued upload. */
export function createFirmUploadObjectName(
  workspaceId: number,
  objectId: string,
): string {
  if (!Number.isSafeInteger(workspaceId) || workspaceId < 0) {
    throw new Error("Invalid firm workspace id.");
  }
  return `firm/${workspaceId}/uploads/${objectId}.${signature(workspaceId, objectId)}`;
}

/**
 * Validate that an upload path was minted by this server for this workspace.
 * The HMAC is deliberately carried inside the existing objectPath field so the
 * browser upload/attachment contract does not change.
 */
export function isFirmUploadObjectPath(
  objectPath: string,
  workspaceId: number,
): boolean {
  const match = /^\/objects\/firm\/(\d+)\/uploads\/([0-9a-f-]{36})\.([A-Za-z0-9_-]+)$/.exec(
    objectPath,
  );
  if (!match || Number(match[1]) !== workspaceId) return false;
  const actual = Buffer.from(match[3]);
  const expected = Buffer.from(signature(workspaceId, match[2]));
  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

/** Pre-isolation paths are private owner-workspace data, never subscriber data. */
export function isLegacyOwnerObjectPath(objectPath: string): boolean {
  return (
    objectPath.startsWith("/objects/uploads/") &&
    !objectPath.includes("..") &&
    !objectPath.includes("\\")
  );
}
