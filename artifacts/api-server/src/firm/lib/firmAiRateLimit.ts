import rateLimit from "express-rate-limit";
import type { Request } from "express";
import {
  MANAGER_COOKIE,
  STAFF_COOKIE,
  verifySession,
} from "./managerSession";

const MAX = parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE ?? "60", 10);

/**
 * Extracts a stable per-subscriber key for MyLawFirmAI routes.
 *
 * Firm auth uses signed httpOnly cookies:
 *   fm_mgr  — manager session carrying the manager user id
 *   fm_staff — staff session carrying the access-code row id (or sentinel 0
 *              for master-code / manager-granted staff sessions)
 *
 * Master/sentinel (codeId === 0) sessions are admin-only, so they are grouped
 * into a shared bucket — they should never approach the rate limit in normal
 * use. All other sessions are keyed per-subscriber.
 */
function firmKey(req: Request): string {
  const cookies = req.cookies as Record<string, string | undefined>;

  // Manager cookie: verified → key by manager user id.
  const managerUid = verifySession(cookies[MANAGER_COOKIE]);
  if (managerUid != null && managerUid !== 0) {
    return `firm-mgr:${managerUid}`;
  }

  // Staff cookie: verified → key by access-code row id.
  const staffCodeId = verifySession(cookies[STAFF_COOKIE]);
  if (staffCodeId != null && staffCodeId !== 0) {
    return `firm-staff:${staffCodeId}`;
  }

  // Master/sentinel sessions or unverified cookies — shared admin bucket.
  return "__firm_master__";
}

/**
 * Per-subscriber AI rate limit for MyLawFirmAI AI-generation endpoints.
 * Reads the server-signed session cookies set by the firm's auth flow.
 */
export const firmAiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: MAX,
  keyGenerator: firmKey,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please try again shortly." },
});
