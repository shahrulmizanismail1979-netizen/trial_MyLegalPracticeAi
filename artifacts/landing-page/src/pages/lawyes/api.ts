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
  contentType?: string;
  extractionMetadata?: {
    kind: "image" | "audio" | "video";
    confidence: number | null;
    warnings: string[];
    provenance: { timestamps: Array<{ startSec: number; text: string }> };
  };
  evidenceVerified?: boolean;
  extractedText?: string;
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

export interface GoogleConnectionStatus {
  configured: boolean;
  connected: boolean;
  account?: {
    email: string;
    displayName?: string | null;
    connectedAt: string;
    gmail: boolean;
    drive: boolean;
  } | null;
}

// Ensure 401 triggers auth reset if needed
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { ...options, credentials: "include", cache: "no-store" });
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
    const body = await res.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === "string" ? body.error : `API error: ${res.status}`);
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

export function useLawyesGoogleConnection() {
  return useQuery<GoogleConnectionStatus>({
    queryKey: ["lawyes", "google-connection"],
    queryFn: () => fetchWithAuth("/api/lit/lawyes/google/status"),
    retry: false,
  });
}

export function useDisconnectLawyesGoogle() {
  const queryClient = useQueryClient();
  return useMutation<{ disconnected: boolean }, Error>({
    mutationFn: () => fetchWithAuth("/api/lit/lawyes/google/connection", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lawyes", "google-connection"] }),
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

export async function uploadLawyesEvidence(matterId: string, file: File) {
  const issued = await fetchWithAuth(`/api/lit/lawyes/matters/${matterId}/evidence/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const uploaded = await fetch(issued.uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploaded.ok) throw new Error("The evidence file could not be uploaded.");
  return fetchWithAuth(`/api/lit/lawyes/matters/${matterId}/evidence/analyse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      objectPath: issued.objectPath,
      fileName: file.name,
      contentType: file.type,
    }),
  });
}

export function useConfirmLawyesEvidence(matterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => fetchWithAuth(
      `/api/lit/lawyes/matters/${matterId}/evidence/${documentId}/confirm`,
      { method: "POST" },
    ),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: ["lawyes", "matters", matterId, "workspace"],
    }),
  });
}
