import { useCrimCheckSession } from "@workspace/api-client-react";
import {
  entitlementsFor,
  normalizeTier,
  type AiToolId,
  type Entitlements,
  type Tier,
} from "@workspace/entitlements";

/** Maps a workspace AI tool route to its entitlement tool id. */
export const AI_TOOL_PATHS: Record<string, AiToolId> = {
  "/workspace/ai/research": "legal-research",
  "/workspace/ai/case-analyzer": "case-analyzer",
  "/workspace/ai/document-drafter": "document-drafter",
  "/workspace/ai/charge-analyzer": "charge-analyzer",
  "/workspace/ai/cross-examination": "cross-examination",
  "/workspace/ai/sentencing": "sentencing",
  "/workspace/ai/legal-opinion": "legal-opinion",
  "/workspace/ai/case-strategy": "case-strategy",
  "/workspace/ai/appeal-grounds": "appeal-grounds",
  "/workspace/ai/witness-practice": "witness-practice",
  "/workspace/ai/judge-practice": "judge-practice",
};

export interface UseEntitlementsResult {
  isLoading: boolean;
  tier: Tier;
  entitlements: Entitlements;
  hasTool: (toolId: AiToolId) => boolean;
  hasVoice: boolean;
}

/**
 * Reads the current session's subscription tier and derives feature
 * entitlements. Prefers the server-sent entitlements snapshot, falling back to
 * the shared tier map so the client and server never drift.
 */
export function useEntitlements(): UseEntitlementsResult {
  const { data: session, isLoading } = useCrimCheckSession();

  const tier = normalizeTier(session?.tier);
  const serverEnt = session?.entitlements;
  const entitlements: Entitlements = serverEnt
    ? {
        tier: normalizeTier(serverEnt.tier),
        tierName: serverEnt.tierName,
        voice: serverEnt.voice,
        aiTools: serverEnt.aiTools as AiToolId[],
      }
    : entitlementsFor(tier);

  const toolSet = new Set(entitlements.aiTools);

  return {
    isLoading,
    tier,
    entitlements,
    hasTool: (toolId: AiToolId) => toolSet.has(toolId),
    hasVoice: entitlements.voice,
  };
}
