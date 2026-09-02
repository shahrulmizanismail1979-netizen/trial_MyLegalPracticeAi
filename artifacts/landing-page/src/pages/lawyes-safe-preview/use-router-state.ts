import { useEffect, useState, useCallback } from "react";
import {
  type Jurisdiction,
  GUIDED_SEARCH_TAXONOMY,
  REPORTS,
  PRACTICE_CENTRES,
  PLAYBOOKS
} from "@/fixtures/lawyes-preview";
import { CAPABILITY_REGISTRY } from "@/fixtures/lawyes-skills";

export type ViewState = "home" | "search" | "draft" | "matter" | "practice" | "verification" | "skills";

// Defines the shape of our serializable state
export type RouterState = {
  view: ViewState;
  q: string;
  jurisdiction: Jurisdiction | "";
  court: string;
  practiceArea: string;
  status: string;
  sort: string;
  reportId: string;
  playbook: string;
  practiceCentre: string;
  capabilityId: string;
  selectedMaterials: string; // comma separated IDs
  clientRef: string;
  matterName: string;
  matterTask: string;
  matterInstructions: string;
  draftStep: number;
  matterStep: number;
};

export const defaultState: RouterState = {
  view: "home",
  q: "",
  jurisdiction: "",
  court: "",
  practiceArea: "",
  status: "",
  sort: "sarawak",
  reportId: "",
  playbook: "",
  practiceCentre: "",
  capabilityId: "",
  selectedMaterials: "",
  clientRef: "",
  matterName: "",
  matterTask: "",
  matterInstructions: "",
  draftStep: 1,
  matterStep: 1,
};

export function sanitizeUrlState(state: Partial<RouterState>, fromUrl: boolean = false): RouterState {
  const result = { ...defaultState };

  const validViews = ["home", "search", "draft", "matter", "practice", "verification", "skills"];
  result.view = validViews.includes(state.view as string) ? (state.view as ViewState) : "home";

  if (state.q) result.q = state.q;

  if (typeof state.jurisdiction === "string" && GUIDED_SEARCH_TAXONOMY.jurisdictions.some(j => j.id === state.jurisdiction)) {
    result.jurisdiction = state.jurisdiction;
  }

  if (state.court && (GUIDED_SEARCH_TAXONOMY.courts as readonly string[]).includes(state.court)) {
    result.court = state.court;
  }

  if (state.practiceArea && (GUIDED_SEARCH_TAXONOMY.subjectAreas as readonly string[]).includes(state.practiceArea)) {
    result.practiceArea = state.practiceArea;
  }

  if (state.status && (GUIDED_SEARCH_TAXONOMY.verificationStatuses as readonly string[]).includes(state.status)) {
    result.status = state.status;
  }

  if (state.sort && ["sarawak", "date", "court", "status", "title"].includes(state.sort)) {
    result.sort = state.sort;
  }

  if (state.reportId && REPORTS.some(r => r.id === state.reportId)) {
    result.reportId = state.reportId;
  }

  if (state.playbook && PLAYBOOKS.some(p => p.id === state.playbook)) {
    result.playbook = state.playbook;
  }

  if (state.practiceCentre && PRACTICE_CENTRES.some(c => c.id === state.practiceCentre)) {
    result.practiceCentre = state.practiceCentre;
  }

  if (state.capabilityId && CAPABILITY_REGISTRY.some((capability) => capability.id === state.capabilityId)) {
    result.capabilityId = state.capabilityId;
  }

  if (state.selectedMaterials) {
    const ids = state.selectedMaterials.split(",").filter(id => REPORTS.some(r => r.id === id));
    result.selectedMaterials = ids.join(",");
  }

  if (state.clientRef) result.clientRef = state.clientRef;
  if (state.matterName) result.matterName = state.matterName;
  if (state.matterTask) result.matterTask = state.matterTask;
  if (state.matterInstructions) result.matterInstructions = state.matterInstructions;

  if (state.draftStep) {
    const num = Number(state.draftStep);
    result.draftStep = !isNaN(num) && num >= 1 && num <= 3 ? num : 1;
    if (fromUrl && result.draftStep === 3) {
      result.draftStep = result.playbook ? 2 : 1;
    }
  }

  if (state.matterStep) {
    const num = Number(state.matterStep);
    result.matterStep = !isNaN(num) && num >= 1 && num <= 2 ? num : 1;
    if (fromUrl && result.matterStep === 2) {
      result.matterStep = 1;
    }
  }

  return result;
}

export function parseUrlState(searchParams: URLSearchParams): RouterState {
  const partial: Partial<RouterState> = {};
  for (const [k, v] of searchParams.entries()) {
    if (v) {
      if (k === "draftStep" || k === "matterStep") {
        (partial as any)[k] = parseInt(v, 10);
      } else {
        (partial as any)[k] = v;
      }
    }
  }
  return sanitizeUrlState(partial, true);
}

export function serializeUrlState(state: RouterState): URLSearchParams {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) {
    if (v && v !== defaultState[k as keyof RouterState]) {
      if (k === "draftStep" && v === 3) {
        params.set(k, state.playbook ? "2" : "1");
      } else if (k === "matterStep" && v === 2) {
        params.set(k, "1");
      } else {
        params.set(k, String(v));
      }
    }
  }
  return params;
}

export function useRouterState() {
  const [state, setState] = useState<RouterState>(() => {
    if (typeof window === "undefined") return defaultState;
    // A document reload must rebuild from the sanitized URL, never from
    // history.state: terminal workflow state is deliberately in-memory only.
    return parseUrlState(new URLSearchParams(window.location.search));
  });

  const updateState = useCallback((updates: Partial<RouterState>, replace = false) => {
    setState((current) => {
      const next = sanitizeUrlState({ ...current, ...updates });

      const nextParams = serializeUrlState(next);
      const newSearch = nextParams.toString();
      const url = newSearch ? `?${newSearch}` : window.location.pathname;

      if (replace) {
        window.history.replaceState({ lawyesSync: true, lawyesState: next }, "", url);
      } else {
        window.history.pushState({ lawyesSync: true, lawyesState: next }, "", url);
      }
      
      return next;
    });
  }, []);

  const navigate = useCallback((view: ViewState, params?: Partial<RouterState>) => {
    updateState({ view, ...params });
    window.scrollTo({ top: 0 });
  }, [updateState]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.lawyesState) {
        setState(e.state.lawyesState);
      } else {
        setState(parseUrlState(new URLSearchParams(window.location.search)));
      }
    };
    window.addEventListener("popstate", handlePopState);

    const params = serializeUrlState(state);
    const normalizedUrl = params.size ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({ lawyesSync: true, lawyesState: state }, "", normalizedUrl);

    return () => window.removeEventListener("popstate", handlePopState);
  }, [state]); // Include state so initial replace uses latest

  return { state, updateState, navigate };
}

