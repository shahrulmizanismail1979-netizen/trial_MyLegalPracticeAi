// React-query hooks + fetch helpers for the conveyancing matter-files feature.
// All calls go through the shared proxy at `/api/convey/...` and attach the
// bearer token saved at login (same pattern as src/lib/subscription.ts and
// src/lib/exportDocx.ts). We do NOT regenerate the orval api client for these.
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Matter {
  id: number;
  title: string;
  clientName: string | null;
  counterparty: string | null;
  matterType: string | null;
  reference: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatterDeadline {
  id: number;
  matterId: number;
  title: string;
  dueDate: string;
  category: string;
  status: string;
  basis: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatterDetail extends Matter {
  deadlines: MatterDeadline[];
}

export interface MatterWorkItem {
  id: number;
  kind: string;
  title: string;
  matter: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type MatterInput = {
  title?: string;
  clientName?: string | null;
  counterparty?: string | null;
  matterType?: string | null;
  reference?: string | null;
  status?: string;
  notes?: string | null;
};

export type DeadlineInput = {
  title: string;
  dueDate: string;
  category?: string;
  basis?: string;
  notes?: string;
  status?: string;
};

export interface SaveWorkInput {
  kind: string;
  title: string;
  matter?: string | null;
  matterId?: number;
  inputJson?: unknown;
  content: string;
}

// ─── Matter type options (conveyancing transactions) ─────────────────────────
export const MATTER_TYPE_OPTIONS = [
  { value: 'SPA', label: 'Sale & Purchase Agreement' },
  { value: 'Tenancy', label: 'Tenancy / Lease' },
  { value: 'POA', label: 'Power of Attorney' },
  { value: 'Loan/Charge', label: 'Loan / Charge' },
  { value: 'Completion', label: 'Completion' },
  { value: 'Other', label: 'Other' },
];

export const FILE_REF_PREFIX = 'CVY';

/** Auto-generate a matter file reference, e.g. CVY/2026/1234. */
export function generateFileRef(): string {
  const year = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${FILE_REF_PREFIX}/${year}/${n}`;
}

// ─── Fetch plumbing ──────────────────────────────────────────────────────────
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('convey_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/convey${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = (data?.error as string) || msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(msg || `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Query keys ──────────────────────────────────────────────────────────────
const KEY = ['convey-matters'];

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
}

// ─── Matter queries ──────────────────────────────────────────────────────────
export function useMatters(status?: string) {
  return useQuery<Matter[]>({
    queryKey: status ? [...KEY, 'list', status] : [...KEY, 'list'],
    queryFn: () =>
      api<Matter[]>(`/matters${status ? `?status=${encodeURIComponent(status)}` : ''}`),
  });
}

export function useMatter(id: number | null) {
  return useQuery<MatterDetail>({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => api<MatterDetail>(`/matters/${id}`),
    enabled: id != null,
  });
}

export function useMatterWork(matterId: number | null) {
  return useQuery<MatterWorkItem[]>({
    queryKey: [...KEY, 'work', matterId],
    queryFn: () => api<MatterWorkItem[]>(`/matters/${matterId}/work`),
    enabled: matterId != null,
  });
}

// ─── Matter mutations ────────────────────────────────────────────────────────
export function useCreateMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MatterInput): Promise<Matter> =>
      api('/matters', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & MatterInput): Promise<Matter> =>
      api(`/matters/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number): Promise<{ success: boolean }> =>
      api(`/matters/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ─── Deadline mutations ──────────────────────────────────────────────────────
export function useAddDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, ...input }: { matterId: number } & DeadlineInput): Promise<MatterDeadline> =>
      api(`/matters/${matterId}/deadlines`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, id, ...patch }: { matterId: number; id: number } & Partial<DeadlineInput>): Promise<MatterDeadline> =>
      api(`/matters/${matterId}/deadlines/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, id }: { matterId: number; id: number }): Promise<{ success: boolean }> =>
      api(`/matters/${matterId}/deadlines/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ─── Saved work ──────────────────────────────────────────────────────────────
export function useSaveWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveWorkInput): Promise<MatterWorkItem> =>
      api('/saved-work', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function matterTypeLabel(value: string | null): string {
  if (!value) return '';
  return MATTER_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

/** Days from today until the date (negative = overdue). */
export function daysUntil(iso: string): number {
  const due = new Date(iso);
  const now = new Date();
  const d0 = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const n0 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d0 - n0) / 86400000);
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
