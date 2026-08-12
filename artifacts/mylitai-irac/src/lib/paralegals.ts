import type { AIProvider } from "@/lib/irac-api";

// User-facing personas for the three AI engines. The underlying provider is
// never surfaced to practitioners — they simply choose a "paralegal" whose
// described strengths suit the task.
// Paralegal 1 → OpenAI, Paralegal 2 → Gemini, Paralegal 3 → Perplexity.
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
  perplexity: {
    name: "Paralegal 3",
    role: "The investigator",
    strengths:
      "Built around live web search — every answer draws on current sources with linked references, strong for fast-moving areas and fact-finding across the open web.",
    weaknesses:
      "Leans on what it finds online, so its drafting is plainer — pair it with Paralegal 1 when you need polished prose.",
  },
};
