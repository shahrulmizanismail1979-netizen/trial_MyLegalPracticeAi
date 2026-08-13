// React-query hooks + fetch helpers for the conveyancing matter-files feature.
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

// ── Case intelligence types ───────────────────────────────────────────────────

export interface CaseNextStep {
  action: string;
  suggestedDeadline?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface CaseRiskAssessment {
  rating: 'Low' | 'Medium' | 'High';
  keyStrengths: string[];
  keyWeaknesses: string[];
}

export interface CaseInsights {
  nextSteps: CaseNextStep[];
  caseSummary: string;
  riskAssessment: CaseRiskAssessment;
  cachedAt: string;
  expiresAt: string;
}

export interface ChecklistItem {
  id: number;
  text: string;
  done: boolean;
  position: number;
  createdAt: string;
}

export interface TimeEntry {
  id: number;
  description: string;
  minutes: number;
  rate_usd: number | null;
  entry_date: string;
  created_at: string;
}

export interface TimeEntriesResult {
  entries: TimeEntry[];
  totalMinutes: number;
}

export interface StageHistoryItem {
  id: number;
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
}

export interface CaseClient {
  id: number;
  name: string;
  ic_number: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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

async function clientsApi<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/convey/clients${path}`, {
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
    } catch { /* ignore */ }
    throw new ApiError(msg || `Request failed (${res.status})`, res.status);
  }
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

// ── Stage management ───────────────────────────────────────────────────────────

export function useStageHistory(matterId: number | null) {
  return useQuery<StageHistoryItem[]>({
    queryKey: [...KEY, 'stage-history', matterId],
    queryFn: () => api<StageHistoryItem[]>(`/matters/${matterId}/stage-history`),
    enabled: matterId != null,
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) =>
      api(`/matters/${id}/status`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── AI insights ────────────────────────────────────────────────────────────────

export function useAiInsights(matterId: number | null, enabled = true) {
  return useQuery<CaseInsights>({
    queryKey: [...KEY, 'ai-insights', matterId],
    queryFn: () => api<CaseInsights>(`/matters/${matterId}/ai-insights`),
    enabled: enabled && matterId != null,
    staleTime: 1000 * 60 * 60 * 6,
    retry: 1,
  });
}

export interface IntakeBriefing {
  parties: {
    client: string | null;
    opponent: string | null;
    counsel: string | null;
    others: string[];
  };
  keyFacts: string[];
  legalIssues: string[];
  initialActions: Array<{ action: string; priority: 'high' | 'medium' | 'low' }>;
  generatedAt: string;
}

export function useRefreshAiInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matterId: number): Promise<CaseInsights> =>
      api<CaseInsights>(`/matters/${matterId}/ai-insights?refresh=1`),
    onSuccess: (_data, matterId) => {
      qc.invalidateQueries({ queryKey: [...KEY, 'ai-insights', matterId] });
    },
  });
}

// ── Checklist ──────────────────────────────────────────────────────────────────

export function useChecklist(matterId: number | null) {
  return useQuery<ChecklistItem[]>({
    queryKey: [...KEY, 'checklist', matterId],
    queryFn: () => api<ChecklistItem[]>(`/matters/${matterId}/checklist`),
    enabled: matterId != null,
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, text }: { matterId: number; text: string }) =>
      api(`/matters/${matterId}/checklist`, { method: 'POST', body: JSON.stringify({ text }) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, itemId, done, text }: { matterId: number; itemId: number; done?: boolean; text?: string }) =>
      api(`/matters/${matterId}/checklist/${itemId}`, { method: 'PATCH', body: JSON.stringify({ done, text }) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, itemId }: { matterId: number; itemId: number }) =>
      api(`/matters/${matterId}/checklist/${itemId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Time recording ─────────────────────────────────────────────────────────────

export function useTimeEntries(matterId: number | null) {
  return useQuery<TimeEntriesResult>({
    queryKey: [...KEY, 'time', matterId],
    queryFn: () => api<TimeEntriesResult>(`/matters/${matterId}/time-entries`),
    enabled: matterId != null,
  });
}

export function useLogTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, ...input }: { matterId: number; description: string; minutes: number; entry_date: string }) =>
      api(`/matters/${matterId}/time-entries`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, entryId }: { matterId: number; entryId: number }) =>
      api(`/matters/${matterId}/time-entries/${entryId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Clients ────────────────────────────────────────────────────────────────────

export function useClients() {
  return useQuery<CaseClient[]>({
    queryKey: [...KEY, 'clients'],
    queryFn: () => clientsApi<CaseClient[]>(''),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; company_name?: string; email?: string; phone?: string; notes?: string }) =>
      clientsApi('', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: number) =>
      clientsApi(`/${clientId}`, { method: 'DELETE' }),
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

export function useIntakeBriefing(matterId: number | null) {
  return useQuery<IntakeBriefing>({
    queryKey: [...KEY, 'intake-briefing', matterId],
    queryFn: () => api<IntakeBriefing>(`/matters/${matterId}/intake-briefing`),
    enabled: matterId != null,
    staleTime: Infinity,
    retry: false,
  });
}

export function useGenerateIntakeBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matterId: number): Promise<IntakeBriefing> =>
      api<IntakeBriefing>(`/matters/${matterId}/intake-briefing/generate`, { method: 'POST' }),
    onSuccess: (data, matterId) => {
      qc.setQueryData([...KEY, 'intake-briefing', matterId], data);
    },
  });
}
