import {
  GitBranch,
  UploadCloud,
  ScanSearch,
  PenTool,
  MessageSquareReply,
} from "lucide-react";
import type { TranslationKey } from "@/lib/i18n";

export type JourneyStepKey = "path" | "upload" | "analyze" | "draft" | "reply";

export interface JourneyStepDef {
  key: JourneyStepKey;
  n: string;
  route: string;
  icon: typeof GitBranch;
  titleKey: TranslationKey;
  captionKey: TranslationKey;
}

export const JOURNEY_STEPS: JourneyStepDef[] = [
  { key: "path", n: "01", route: "/", icon: GitBranch, titleKey: "home.step1.title", captionKey: "home.step1.caption" },
  { key: "upload", n: "02", route: "/matter", icon: UploadCloud, titleKey: "home.step2.title", captionKey: "home.step2.caption" },
  { key: "analyze", n: "03", route: "/matter", icon: ScanSearch, titleKey: "home.step3.title", captionKey: "home.step3.caption" },
  { key: "draft", n: "04", route: "/drafting", icon: PenTool, titleKey: "home.step4.title", captionKey: "home.step4.caption" },
  { key: "reply", n: "05", route: "/reply", icon: MessageSquareReply, titleKey: "home.step5.title", captionKey: "home.step5.caption" },
];

export interface JourneySignals {
  pathwayId: string | null;
  caseId: string | null;
  analyzed: boolean;
  drafted: boolean;
  replied: boolean;
}

export type JourneyStepStatus = "done" | "current" | "upcoming";

export function computeProgress(s: JourneySignals): Record<JourneyStepKey, boolean> {
  return {
    path: Boolean(s.pathwayId),
    upload: Boolean(s.caseId),
    analyze: s.analyzed,
    draft: s.drafted,
    reply: s.replied,
  };
}

/**
 * The "current" step is the first one that is not yet complete. If everything is
 * done, the final step (reply) is treated as current.
 */
export function currentStepKey(progress: Record<JourneyStepKey, boolean>): JourneyStepKey {
  const next = JOURNEY_STEPS.find((step) => !progress[step.key]);
  return next ? next.key : JOURNEY_STEPS[JOURNEY_STEPS.length - 1].key;
}

export function stepStatus(
  key: JourneyStepKey,
  progress: Record<JourneyStepKey, boolean>,
): JourneyStepStatus {
  if (progress[key]) return "done";
  if (currentStepKey(progress) === key) return "current";
  return "upcoming";
}
