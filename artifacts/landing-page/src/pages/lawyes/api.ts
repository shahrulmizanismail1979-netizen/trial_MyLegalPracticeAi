import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Matter {
  id: string;
  title: string;
  reference?: string;
  status: string;
}

export interface ResourceItem {
  id: string;
  title?: string;
  name?: string;
  item_text?: string;
  description?: string;
  date?: string;
  createdAt?: string;
  uri?: string;
}

export interface WorkspaceAggregate {
  matter: Matter;
  documents: ResourceItem[];
  uploads: ResourceItem[];
  conversations: ResourceItem[];
  tasks: ResourceItem[];
  checklists: ResourceItem[];
  deadlines: ResourceItem[];
  events: ResourceItem[];
  research: ResourceItem[];
  drafts: ResourceItem[];
  outputs: ResourceItem[];
}

export interface Citation {
  title: string;
  uri: string;
}

export interface Verification {
  status: string;
  verified: boolean;
  guidance?: string;
}

export interface InstructionResponse {
  content: string;
  research?: string;
  citations: Citation[];
  verification: Verification;
  capabilities: string[];
  savedWork?: boolean;
  saveCreated?: boolean;
}

// Ensure 401 triggers auth reset if needed
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { ...options, credentials: "include" });
  if (res.status === 401) {
    window.dispatchEvent(new Event("lawyes:unauthorized"));
    throw new Error("Unauthorized");
  }
  if (res.status === 402) {
    throw new Error("Payment Required: Subscription expired or requires renewal.");
  }
  if (res.status === 429) {
    throw new Error("Quota Exceeded: You have reached your usage limit.");
  }
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json();
}

export function useLawyesMatters() {
  return useQuery<Matter[]>({
    queryKey: ["lawyes", "matters"],
    queryFn: () => fetchWithAuth("/api/lit/lawyes/matters"),
    retry: false
  });
}

export function useLawyesMatter(id?: string) {
  return useQuery<WorkspaceAggregate>({
    queryKey: ["lawyes", "matters", id, "workspace"],
    queryFn: () => fetchWithAuth(`/api/lit/lawyes/matters/${id}/workspace`),
    enabled: !!id,
    retry: false
  });
}

export function useLawyesInstruct(matterId: string) {
  return useMutation<InstructionResponse, Error, { instruction: string }>({
    mutationFn: (data) =>
      fetchWithAuth(`/api/lit/lawyes/matters/${matterId}/instructions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  });
}

export function useLawyesSaveOutput(matterId: string) {
  const queryClient = useQueryClient();
  return useMutation<any, Error, { title: string; kind: string; content: string; instruction?: string; citations?: Citation[]; verification?: Verification; idempotencyKey?: string }>({
    mutationFn: (data) =>
      fetchWithAuth(`/api/lit/lawyes/matters/${matterId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lawyes", "matters", matterId, "workspace"] });
    }
  });
}
