import { logger } from "./logger";

/**
 * Server-managed secret for manager authentication.
 *
 * MANAGER_PASSCODE: required to unlock manager mode (routes/auth.ts). Follows
 * the SESSION_SECRET pattern — if the operator configured the env var that
 * value is used; otherwise the shared default is used and the operator is
 * warned via the logger so the configuration gap is visible in production.
 */

let _managerPasscode: string | null = null;

// Default manager passcode used when MANAGER_PASSCODE is unset. Consumed by
// routes/auth.ts to unlock manager mode.
const DEFAULT_MANAGER_PASSCODE = "240680";

export function getManagerPasscode(): string {
  if (process.env.MANAGER_PASSCODE) {
    return process.env.MANAGER_PASSCODE;
  }
  if (!_managerPasscode) {
    _managerPasscode = DEFAULT_MANAGER_PASSCODE;
    logger.warn(
      "MANAGER_PASSCODE is not set. Falling back to the shared default passcode. " +
        "Set MANAGER_PASSCODE in Replit Secrets (Secrets tab) for a stable, private value.",
    );
  }
  return _managerPasscode;
}
