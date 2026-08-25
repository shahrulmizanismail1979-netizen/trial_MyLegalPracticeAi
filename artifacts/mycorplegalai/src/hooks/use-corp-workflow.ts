import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "./use-matters";

const API_BASE = import.meta.env.VITE_API_URL || "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}/api/corp/matters${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    ...init,
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new ApiError(
      (msg as { error?: string }).error || `Request failed (${res.status})`,
      res.status,
    );
  }
  if (res.status === 204) return undefined;
  return res.json();
}

export const WORKFLOW_KEY = ["corp-workflow"];

export interface Obligation {
  id: number;
  matter_id: number;
  title: string;
  authority: string | null;
  owner_name: string | null;
  due_date: string | null;
  status: string; 
  risk: string | null; 
  evidence_note: string | null;
  source_reference: string | null;
  deadline_id: number | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionItem {
  id: number;
  matter_id: number;
  title: string;
  item_type: string;
  counterparty: string | null;
  target_date: string | null;
  status: string; 
  version_label: string | null;
  deviation: string | null;
  fallback_position: string | null;
  approval_status: string; 
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  deadline_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ReviewState {
  reviewer_name: string | null;
  evidence_status: "needs_review" | "verified";
  assumptions: string | null;
  finalised: boolean;
}

export interface CorpWorkflowState {
  obligations: Obligation[];
  transactions: TransactionItem[];
  review: ReviewState | null;
}

export function useCorpWorkflow(matterId: number) {
  return useQuery<CorpWorkflowState>({
    queryKey: [...WORKFLOW_KEY, matterId],
    queryFn: () => api(`/${matterId}/workflow`),
  });
}

// Obligation hooks
export function useCreateObligation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, ...data }: any) => api(`/${matterId}/workflow/obligations`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: [...WORKFLOW_KEY, v.matterId] }),
  });
}
export function useUpdateObligation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, id, ...data }: any) => api(`/${matterId}/workflow/obligations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: [...WORKFLOW_KEY, v.matterId] }),
  });
}
export function useDeleteObligation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, id }: any) => api(`/${matterId}/workflow/obligations/${id}`, { method: "DELETE" }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: [...WORKFLOW_KEY, v.matterId] }),
  });
}

// Transaction hooks
export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, ...data }: any) => api(`/${matterId}/workflow/transactions`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: [...WORKFLOW_KEY, v.matterId] }),
  });
}
export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, id, ...data }: any) => api(`/${matterId}/workflow/transactions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: [...WORKFLOW_KEY, v.matterId] }),
  });
}
export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, id }: any) => api(`/${matterId}/workflow/transactions/${id}`, { method: "DELETE" }),
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: [...WORKFLOW_KEY, v.matterId] }),
  });
}

// Review hooks
export function useUpdateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, ...data }: any) => api(`/${matterId}/workflow/review`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (review, variables) => {
      qc.setQueryData([...WORKFLOW_KEY, variables.matterId], (old: CorpWorkflowState | undefined) =>
        old ? { ...old, review } : old,
      );
    },
  });
}
