import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { aiUsageTable } from "@workspace/db/schema";
import { and, eq, gte, count } from "drizzle-orm";
import { hasTier, effectiveTier, STUDENT_DAILY_AI_LIMIT, type Tier } from "../lib/access";

// Paths under /convey that anyone (even logged-out) may call.
const PUBLIC_PATHS = new Set<string>([
  "/convey/auth",
  "/convey/auth/sso",
  "/convey/signup",
  "/convey/plans",
]);

// Paths that only require a logged-in user (no specific tier).
const AUTH_ONLY_PATHS = new Set<string>([
  "/convey/me",
  "/convey/checkout",
  "/convey/portal",
  "/convey/billing-sync",
]);

// AI tools available from the Student tier upward (subject to a daily cap).
const STUDENT_AI_PATHS = new Set<string>([
  "/convey/chat",
  "/convey/case-research",
]);

// Firm-only features.
const FIRM_PATHS = new Set<string>([
  "/convey/tts",
]);

function deny(res: Response, requiredTier: Tier, currentTier: Tier) {
  res.status(402).json({ error: "upgrade_required", requiredTier, currentTier });
}

/**
 * Server-side paywall for all POST /convey/* endpoints. Default-deny: any AI
 * tool not explicitly listed elsewhere requires the Practitioner tier.
 */
export async function conveyGate(req: Request, res: Response, next: NextFunction) {
  // Only police /convey/* routes (this router also sees /admin, /health requests).
  if (!req.path.startsWith("/convey/")) return next();
  // Content browsing & metadata are GETs and not gated here.
  if (req.method === "GET") return next();
  const path = req.path;

  if (PUBLIC_PATHS.has(path)) return next();

  const user = req.currentUser;
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (AUTH_ONLY_PATHS.has(path)) return next();

  const current = effectiveTier(user);

  if (FIRM_PATHS.has(path)) {
    if (!hasTier(user, "firm")) return deny(res, "firm", current);
    return next();
  }

  if (STUDENT_AI_PATHS.has(path)) {
    if (!hasTier(user, "student")) return deny(res, "student", current);
    // Enforce the daily cap for Student-tier accounts only.
    if (current === "student") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      try {
        const rows = await db
          .select({ c: count() })
          .from(aiUsageTable)
          .where(and(eq(aiUsageTable.userId, user.id), gte(aiUsageTable.createdAt, todayStart)));
        const used = Number(rows[0]?.c ?? 0);
        if (used >= STUDENT_DAILY_AI_LIMIT) {
          res.status(429).json({
            error: "daily_limit_reached",
            limit: STUDENT_DAILY_AI_LIMIT,
            message: `You have reached your Student plan limit of ${STUDENT_DAILY_AI_LIMIT} AI queries today. Upgrade to Practitioner for unlimited access.`,
          });
          return;
        }
      } catch (e) {
        req.log?.error({ err: e }, "daily cap check failed");
      }
    }
    return next();
  }

  // Default: every other POST /convey/* (the other AI tools + export-docx) needs Practitioner+.
  if (!hasTier(user, "practitioner")) return deny(res, "practitioner", current);
  return next();
}
