import { useQuery } from "@tanstack/react-query";
import {
  getTheoryTopics,
  getTheoryTopic,
  getLegalCases,
  getLegalCase,
  getWorkflows,
  getWorkflow,
  getForms,
  getForm,
  getCostSchedules,
  getCompendium,
  getTerms,
  getTerm,
  type TheoryTopic,
  type LegalCase,
  type Workflow,
  type LegalForm,
  type CostSchedule,
  type CompendiumResponse,
  type GlossaryTerm,
  getPracticeDirections,
  getBarCouncilRulings,
  type PracticeDirection,
  type BarCouncilRuling,
} from "@/lib/irac-api";

// ─── Theory ──────────────────────────────────────────────────────────────────
export function useTheoryTopics() {
  return useQuery<TheoryTopic[]>({
    queryKey: ["theory"],
    queryFn: getTheoryTopics,
  });
}

export function useTheoryTopic(id: number | string | null) {
  return useQuery<TheoryTopic>({
    queryKey: ["theory", id],
    queryFn: () => getTheoryTopic(id!),
    enabled: id != null && id !== "",
  });
}

// ─── Jurisprudence (case law) ─────────────────────────────────────────────────
export function useLegalCases(search?: string) {
  return useQuery<LegalCase[]>({
    queryKey: ["jurisprudence", search ?? ""],
    queryFn: () => getLegalCases(search),
  });
}

export function useLegalCase(id: number | string | null) {
  return useQuery<LegalCase>({
    queryKey: ["jurisprudence", id],
    queryFn: () => getLegalCase(id!),
    enabled: id != null && id !== "",
  });
}

// ─── Workflows ────────────────────────────────────────────────────────────────
export function useWorkflows() {
  return useQuery<Workflow[]>({
    queryKey: ["workflows"],
    queryFn: getWorkflows,
  });
}

export function useWorkflow(id: number | string | null) {
  return useQuery<Workflow>({
    queryKey: ["workflows", id],
    queryFn: () => getWorkflow(id!),
    enabled: id != null && id !== "",
  });
}

// ─── Forms (cause papers) ─────────────────────────────────────────────────────
export function useForms() {
  return useQuery<LegalForm[]>({
    queryKey: ["forms"],
    queryFn: getForms,
  });
}

export function useForm(id: number | string | null) {
  return useQuery<LegalForm>({
    queryKey: ["forms", id],
    queryFn: () => getForm(id!),
    enabled: id != null && id !== "",
  });
}

// ─── Costs & fees ─────────────────────────────────────────────────────────────
export function useCostSchedules() {
  return useQuery<CostSchedule[]>({
    queryKey: ["costs"],
    queryFn: getCostSchedules,
  });
}

// ─── Compendium of Personal Injury Awards (quantum) ───────────────────────────
export function useCompendium() {
  return useQuery<CompendiumResponse>({
    queryKey: ["compendium"],
    queryFn: getCompendium,
  });
}

// ─── Terminology (glossary) ───────────────────────────────────────────────────
export function useTerms(search?: string, letter?: string) {
  return useQuery<GlossaryTerm[]>({
    queryKey: ["terminology", search ?? "", letter ?? ""],
    queryFn: () => getTerms(search, letter),
  });
}

export function useTerm(id: number | string | null) {
  return useQuery<GlossaryTerm>({
    queryKey: ["terminology", id],
    queryFn: () => getTerm(id!),
    enabled: id != null && id !== "",
  });
}

// ─── Practice directions & court circulars ───────────────────────────────────
export function usePracticeDirections(search?: string) {
  return useQuery<PracticeDirection[]>({
    queryKey: ["practice-directions", search ?? ""],
    queryFn: () => getPracticeDirections(search),
  });
}

// ─── Bar Council rules & rulings ──────────────────────────────────────────────
export function useBarCouncilRulings(search?: string) {
  return useQuery<BarCouncilRuling[]>({
    queryKey: ["bar-council-rulings", search ?? ""],
    queryFn: () => getBarCouncilRulings(search),
  });
}
