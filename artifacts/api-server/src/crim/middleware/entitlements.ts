import { Request, Response, NextFunction } from "express";
import {
  effectiveTier,
  tierHasTool,
  tierHasVoice,
  type AiToolId,
  type Tier,
} from "@workspace/entitlements";

/**
 * Reads the effective tier from the access code attached by requireAuth.
 * Applies grandfathering: codes issued before the cutoff resolve to "full".
 */
export function getTier(res: Response): Tier {
  const row = res.locals.accessCode as
    | { tier?: string; createdAt?: Date | string | null }
    | undefined;
  return effectiveTier(row?.tier, row?.createdAt);
}

/** Gate a route by AI tool entitlement. Must run after requireAuth. */
export function requireTool(toolId: AiToolId) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    const tier = getTier(res);
    if (!tierHasTool(tier, toolId)) {
      res.status(403).json({
        error: "upgrade_required",
        message: "Your plan does not include this tool. Please upgrade to access it.",
        tier,
        toolId,
      });
      return;
    }
    next();
  };
}

/** Gate a route by realistic-voice (ElevenLabs) entitlement. */
export function requireVoice(_req: Request, res: Response, next: NextFunction): void {
  const tier = getTier(res);
  if (!tierHasVoice(tier)) {
    res.status(403).json({
      error: "upgrade_required",
      message:
        "Realistic AI voices are available on the Advocate and Chambers plans. Please upgrade to practise out loud.",
      tier,
    });
    return;
  }
  next();
}

/** Map of AI route sub-paths to their tool id (for path-based gating). */
export const AI_ROUTE_TOOL_MAP: Record<string, AiToolId> = {
  "/ai/legal-research": "legal-research",
  "/ai/analyze-case": "case-analyzer",
  "/ai/draft-document": "document-drafter",
  "/ai/analyze-charge": "charge-analyzer",
  "/ai/cross-examination": "cross-examination",
  "/ai/witness-practice": "witness-practice",
  "/ai/judge-practice": "judge-practice",
  "/ai/sentencing": "sentencing",
  "/ai/legal-opinion": "legal-opinion",
  "/ai/case-strategy": "case-strategy",
  "/ai/appeal-grounds": "appeal-grounds",
};

/** Path-based AI gating middleware: enforces the tool entitlement per route. */
export function gateAiTools(req: Request, res: Response, next: NextFunction): void {
  const toolId = AI_ROUTE_TOOL_MAP[req.path];
  if (!toolId) {
    next();
    return;
  }
  const tier = getTier(res);
  if (!tierHasTool(tier, toolId)) {
    res.status(403).json({
      error: "upgrade_required",
      message: "Your plan does not include this tool. Please upgrade to access it.",
      tier,
      toolId,
    });
    return;
  }
  next();
}
