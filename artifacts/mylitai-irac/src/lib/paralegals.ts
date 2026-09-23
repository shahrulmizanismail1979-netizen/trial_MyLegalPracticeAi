import type { AIProvider } from "@/lib/irac-api";

// User-facing personas for the three AI engines. The underlying provider is
// never surfaced to practitioners — they simply choose a "paralegal" whose
// described strengths suit the task.
// Paralegal 1 → OpenAI, Paralegal 2 → Gemini, Paralegal 3 → Anthropic Claude.
export interface ParalegalProfile {
  name: string;
  role: string;
  strengths: string;
  weaknesses: string;
}

export const PARALEGALS: Record<AIProvider, ParalegalProfile> = {
  openai: {
    name: "Paralegal 1",
    role: "The drafter",
    strengths:
      "Polished, persuasive writing with tightly structured arguments and confident reasoning — ideal for affidavits, submissions and advocacy practice.",
    weaknesses:
      "Works from trained knowledge rather than live sources, so always check any authorities it names before you rely on them.",
  },
  gemini: {
    name: "Paralegal 2",
    role: "The researcher",
    strengths:
      "Searches current sources and supports answers with verifiable, linked citations — strong for points of law that must be checked against authority.",
    weaknesses:
      "More measured and concise in style, and can take a little longer while it verifies its sources.",
  },
  anthropic: {
    name: "Paralegal 3",
    role: "The analyst",
    strengths:
      "Careful analysis of lengthy, complex material with clear explanations and nuanced reasoning — strong for reviewing documents and testing arguments.",
    weaknesses:
      "Does not guarantee live web research or source citations, so verify every authority against current primary sources before relying on it.",
  },
};
