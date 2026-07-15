const API_BASE = "/api/sya";

let currentGate: string | null = null;
export function setApiGate(g: string | null) { currentGate = g; }
export function getApiGate(): string | null { return currentGate; }

function withGate(path: string): string {
  if (!currentGate) return path;
  const sep = path.includes("?") ? "&" : "?";
  // Detail-by-id endpoints are not gated (a result the user opened should always
  // resolve). List + categories endpoints ARE gated so each gate shows its own
  // content and its own category facets.
  if (/\/\d+$/.test(path)) return path;
  if (path.includes("gate=")) return path;
  return `${path}${sep}gate=${currentGate}`;
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${withGate(path)}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  provisions: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return fetchApi<any[]>(`/provisions${qs}`);
    },
    categories: () => fetchApi<any[]>("/provisions/categories"),
    get: (id: number) => fetchApi<any>(`/provisions/${id}`),
  },
  cases: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return fetchApi<any[]>(`/cases${qs}`);
    },
    categories: () => fetchApi<any[]>("/cases/categories"),
    get: (id: number) => fetchApi<any>(`/cases/${id}`),
  },
  causePapers: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return fetchApi<any[]>(`/cause-papers${qs}`);
    },
    get: (id: number) => fetchApi<any>(`/cause-papers/${id}`),
    draft: (body: { templateTitleBm: string; templateTitleEn: string; templateBm: string; fieldValues: Record<string, string>; additionalContext?: string }) => {
      return fetch(`${API_BASE}/cause-papers/draft`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
  },
  workflows: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return fetchApi<any[]>(`/workflows${qs}`);
    },
    get: (id: number) => fetchApi<any>(`/workflows/${id}`),
  },
  glossary: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return fetchApi<any[]>(`/glossary${qs}`);
    },
    get: (id: number) => fetchApi<any>(`/glossary/${id}`),
  },
  legislation: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return fetchApi<any[]>(`/legislation${qs}`);
    },
    get: (id: number) => fetchApi<any>(`/legislation/${id}`),
  },
  quranicVerses: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return fetchApi<any[]>(`/quranic-verses${qs}`);
    },
    categories: () => fetchApi<any[]>("/quranic-verses/categories"),
    get: (id: number) => fetchApi<any>(`/quranic-verses/${id}`),
  },
  fatwas: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return fetchApi<any[]>(`/fatwas${qs}`);
    },
    categories: () => fetchApi<any[]>("/fatwas/categories"),
    get: (id: number) => fetchApi<any>(`/fatwas/${id}`),
  },
  practiceDirections: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params)}` : "";
      return fetchApi<any[]>(`/practice-directions${qs}`);
    },
    // List/categories/states are gate-scoped automatically by withGate(); the
    // detail-by-id endpoint stays ungated so an opened result always resolves.
    categories: () => fetchApi<any[]>("/practice-directions/categories"),
    states: () => fetchApi<string[]>("/practice-directions/states"),
    get: (id: number) => fetchApi<any>(`/practice-directions/${id}`),
  },
  analyzer: {
    analyze: (situation: string, language: string) => {
      return fetch(`${API_BASE}/analyzer/analyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation, language }),
      });
    },
    stats: () => fetchApi<any>("/analyzer/all-references"),
  },
  admin: {
    getStats: () => fetchApi<any>("/admin/stats"),
    listCodes: () => fetchApi<any[]>("/admin/access-codes"),
    createCode: (data: { name: string; role: string; customCode?: string }) =>
      fetchApi<any>("/admin/access-codes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    toggleCode: (id: number) =>
      fetchApi<any>(`/admin/access-codes/${id}/toggle`, { method: "PATCH" }),
    deleteCode: (id: number) =>
      fetchApi<void>(`/admin/access-codes/${id}`, { method: "DELETE" }),
  },
  dashboard: {
    stats: () => fetchApi<any>("/dashboard/stats"),
    caseDistribution: () => fetchApi<any[]>("/dashboard/case-distribution"),
  },
  smartSearch: {
    search: (query: string, language: string) => {
      return fetch(`${API_BASE}/smart-search`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, language }),
      });
    },
  },
  caseAnalysis: {
    predict: (data: { caseType: string; facts: string; parties?: string; reliefSought?: string; language: string }) => {
      return fetch(`${API_BASE}/case-analysis/predict`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
  },
  documentGenerator: {
    types: () => fetchApi<any[]>("/document-generator/types"),
    generate: (data: { documentType: string; language: string; details: Record<string, string> }) => {
      return fetch(`${API_BASE}/document-generator/generate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
  },
  kitab: {
    list: () => fetchApi<any[]>("/kitab/list"),
    get: (id: number) => fetchApi<any>(`/kitab/${id}`),
    analyze: (data: { query: string; kitabIds?: number[]; language: string }) => {
      return fetch(`${API_BASE}/kitab/analyze`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
  },
  billing: {
    packages: () => fetchApi<any>("/billing/packages"),
    checkout: (tier: string) =>
      fetchApi<{ url: string }>("/billing/checkout", {
        method: "POST",
        body: JSON.stringify({
          tier,
          successUrl: `${window.location.origin}${import.meta.env.BASE_URL}account?checkout=success`,
          cancelUrl: `${window.location.origin}${import.meta.env.BASE_URL}pricing?checkout=cancelled`,
        }),
      }),
    portal: () =>
      fetchApi<{ url: string }>("/billing/portal", {
        method: "POST",
        body: JSON.stringify({
          returnUrl: `${window.location.origin}${import.meta.env.BASE_URL}account`,
        }),
      }),
    sync: () => fetchApi<any>("/billing/sync", { method: "POST" }),
  },
  voice: {
    voices: () => fetchApi<any>("/voice/voices"),
    tts: (text: string, voiceId?: string) =>
      fetch(`${API_BASE}/voice/tts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId }),
      }),
    stt: (audioBase64: string, mimeType: string) =>
      fetchApi<{ text: string }>("/voice/stt", {
        method: "POST",
        body: JSON.stringify({ audio: audioBase64, mimeType }),
      }),
  },
  gemini: {
    listConversations: () => fetchApi<any[]>("/gemini/conversations"),
    createConversation: (title: string) =>
      fetchApi<any>("/gemini/conversations", {
        method: "POST",
        body: JSON.stringify({ title }),
      }),
    getConversation: (id: number) => fetchApi<any>(`/gemini/conversations/${id}`),
    deleteConversation: (id: number) =>
      fetch(`${API_BASE}/gemini/conversations/${id}`, {
        method: "DELETE",
        credentials: "include",
      }),
    sendMessage: (conversationId: number, content: string) => {
      return fetch(`${API_BASE}/gemini/conversations/${conversationId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    },
  },
};
