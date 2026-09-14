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
