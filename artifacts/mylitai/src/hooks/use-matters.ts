import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Matter {
  id: number;
  title: string;
  clientName: string | null;
  actingFor: string | null;
  plaintiff: string | null;
  defendant: string | null;
  matterType: string | null;
  court: string | null;
  suitNo: string | null;
  claimAmount: string | null;
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

export interface UpcomingDeadline extends MatterDeadline {
  matterTitle: string;
  suitNo: string | null;
}

export interface DeadlineTrigger {
  trigger: string;
  label: string;
  description: string;
  rules: { title: string; category: string; basis: string; notes?: string }[];
}

export interface ComputedDeadline {
  title: string;
  category: string;
  dueDate: string;
  basis: string;
  notes?: string;
}

export type MatterInput = Partial<Omit<Matter, 'id' | 'createdAt' | 'updatedAt'>> & {
  title?: string;
};

export type DeadlineInput = {
  title: string;
  dueDate: string;
  category?: string;
  basis?: string;
  notes?: string;
  status?: string;
};

// ── New: AI Case Intelligence types ──────────────────────────────────────────

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
  item_text: string;
  done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface StageHistoryEntry {
  id: number;
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
}

export interface TimeEntry {
  id: number;
  description: string;
  minutes: number;
  rate_usd: string | null;
  entry_date: string;
  created_at: string;
}

export interface TimeEntriesResponse {
  entries: TimeEntry[];
  totalMinutes: number;
}

export interface MatterClient {
  id: number;
  name: string;
  ic_or_company: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/lit/matters${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new ApiError(
      (msg as { error?: string }).error || `Request failed (${res.status})`,
      res.status,
    );
  }
  return res.json();
}

async function apiClients(path: string, init?: RequestInit) {
  const res = await fetch(`/api/lit/clients${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new ApiError(
      (msg as { error?: string }).error || `Request failed (${res.status})`,
      res.status,
    );
  }
  return res.json();
}

export { ApiError };

const KEY = ['matters'];
const upcomingKey = ['matters', 'upcoming'];
const clientsKey = ['lit-clients'];

// ── Core matter hooks ─────────────────────────────────────────────────────────

export function useMatters(status?: string) {
  return useQuery<Matter[]>({
    queryKey: status ? [...KEY, 'list', status] : [...KEY, 'list'],
    queryFn: () => api(status ? `?status=${encodeURIComponent(status)}` : ''),
  });
}

export function useMatter(id: number | null) {
  return useQuery<MatterDetail>({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => api(`/${id}`),
    enabled: id != null,
  });
}

export function useUpcomingDeadlines(days = 60) {
  return useQuery<UpcomingDeadline[]>({
    queryKey: [...upcomingKey, days],
    queryFn: () => api(`/deadlines/upcoming?days=${days}`),
  });
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

export function useMatterWork(matterId: number | null) {
  return useQuery<MatterWorkItem[]>({
    queryKey: [...KEY, 'work', matterId],
    queryFn: () => api(`/${matterId}/work`),
    enabled: matterId != null,
  });
}

export function useDeadlineTriggers() {
  return useQuery<DeadlineTrigger[]>({
    queryKey: [...KEY, 'triggers'],
    queryFn: () => api('/deadline-triggers'),
    staleTime: Infinity,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
}

export function useCreateMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MatterInput): Promise<Matter> =>
      api('', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & MatterInput): Promise<Matter> =>
      api(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number): Promise<{ success: boolean }> =>
      api(`/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useComputeDeadlines() {
  return useMutation({
    mutationFn: ({
      matterId,
      trigger,
      triggerDate,
    }: {
      matterId: number;
      trigger: string;
      triggerDate: string;
    }): Promise<ComputedDeadline[]> =>
      api(`/${matterId}/deadlines/compute`, {
        method: 'POST',
        body: JSON.stringify({ trigger, triggerDate }),
      }),
  });
}

export function useAddDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matterId,
      ...input
    }: { matterId: number } & DeadlineInput): Promise<MatterDeadline> =>
      api(`/${matterId}/deadlines`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAddDeadlinesBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matterId,
      deadlines,
    }: {
      matterId: number;
      deadlines: DeadlineInput[];
    }): Promise<MatterDeadline[]> =>
      api(`/${matterId}/deadlines/bulk`, {
        method: 'POST',
        body: JSON.stringify({ deadlines }),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matterId,
      id,
      ...patch
    }: { matterId: number; id: number } & Partial<DeadlineInput>): Promise<MatterDeadline> =>
      api(`/${matterId}/deadlines/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, id }: { matterId: number; id: number }): Promise<{ success: boolean }> =>
      api(`/${matterId}/deadlines/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(qc),
  });
}

export const DEADLINE_CATEGORY_META: Record<string, { label: string; color: string }> = {
  limitation: { label: 'Limitation', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  appearance: { label: 'Appearance', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  pleading: { label: 'Pleading', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  interlocutory: { label: 'Interlocutory', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  hearing: { label: 'Hearing', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  enforcement: { label: 'Enforcement', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  appeal: { label: 'Appeal', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  custom: { label: 'Custom', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

export function categoryMeta(cat: string) {
  return DEADLINE_CATEGORY_META[cat] ?? DEADLINE_CATEGORY_META.custom;
}

/** Days from today until the date (negative = overdue). */
export function daysUntil(iso: string): number {
  const due = new Date(iso);
  const now = new Date();
  const d0 = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const n0 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d0 - n0) / 86400000);
}

// ── AI Insights hooks ─────────────────────────────────────────────────────────

export function useAIInsights(matterId: number | null) {
  return useQuery<CaseInsights>({
    queryKey: [...KEY, 'ai-insights', matterId],
    queryFn: () => api(`/${matterId}/ai-insights`),
    enabled: matterId != null,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useRefreshInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matterId: number): Promise<CaseInsights> =>
      api(`/${matterId}/ai-insights?refresh=1`),
    onSuccess: (data, matterId) => {
      qc.setQueryData([...KEY, 'ai-insights', matterId], data);
    },
  });
}

// ── Checklist hooks ───────────────────────────────────────────────────────────

export function useChecklist(matterId: number | null) {
  return useQuery<ChecklistItem[]>({
    queryKey: [...KEY, 'checklist', matterId],
    queryFn: () => api(`/${matterId}/checklist`),
    enabled: matterId != null,
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, item_text }: { matterId: number; item_text: string }): Promise<ChecklistItem> =>
      api(`/${matterId}/checklist`, { method: 'POST', body: JSON.stringify({ item_text }) }),
    onSuccess: (_data, { matterId }) => {
      qc.invalidateQueries({ queryKey: [...KEY, 'checklist', matterId] });
    },
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, itemId, done }: { matterId: number; itemId: number; done: boolean }): Promise<ChecklistItem> =>
      api(`/${matterId}/checklist/${itemId}`, { method: 'PATCH', body: JSON.stringify({ done }) }),
    onSuccess: (_data, { matterId }) => {
      qc.invalidateQueries({ queryKey: [...KEY, 'checklist', matterId] });
    },
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, itemId }: { matterId: number; itemId: number }): Promise<{ success: boolean }> =>
      api(`/${matterId}/checklist/${itemId}`, { method: 'DELETE' }),
    onSuccess: (_data, { matterId }) => {
      qc.invalidateQueries({ queryKey: [...KEY, 'checklist', matterId] });
    },
  });
}

// ── Stage history hooks ───────────────────────────────────────────────────────

export function useStageHistory(matterId: number | null) {
  return useQuery<StageHistoryEntry[]>({
    queryKey: [...KEY, 'stage-history', matterId],
    queryFn: () => api(`/${matterId}/stage-history`),
    enabled: matterId != null,
  });
}

export function useAdvanceStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, stage }: { matterId: number; stage: string }): Promise<{ success: boolean; status: string }> =>
      api(`/${matterId}/status`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
    onSuccess: (_data, { matterId }) => {
      qc.invalidateQueries({ queryKey: [...KEY, 'detail', matterId] });
      qc.invalidateQueries({ queryKey: [...KEY, 'stage-history', matterId] });
      qc.invalidateQueries({ queryKey: [...KEY, 'list'] });
    },
  });
}

// ── Time recording hooks ──────────────────────────────────────────────────────

export function useTimeEntries(matterId: number | null) {
  return useQuery<TimeEntriesResponse>({
    queryKey: [...KEY, 'time-entries', matterId],
    queryFn: () => api(`/${matterId}/time-entries`),
    enabled: matterId != null,
  });
}

export function useAddTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matterId,
      ...input
    }: {
      matterId: number;
      description: string;
      minutes: number;
      rate_usd?: string | null;
      entry_date?: string;
    }): Promise<TimeEntry> =>
      api(`/${matterId}/time-entries`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: (_data, { matterId }) => {
      qc.invalidateQueries({ queryKey: [...KEY, 'time-entries', matterId] });
    },
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, entryId }: { matterId: number; entryId: number }): Promise<{ success: boolean }> =>
      api(`/${matterId}/time-entries/${entryId}`, { method: 'DELETE' }),
    onSuccess: (_data, { matterId }) => {
      qc.invalidateQueries({ queryKey: [...KEY, 'time-entries', matterId] });
    },
  });
}

// ── Client management hooks ───────────────────────────────────────────────────

export function useClients() {
  return useQuery<MatterClient[]>({
    queryKey: clientsKey,
    queryFn: () => apiClients(''),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      ic_or_company?: string;
      phone?: string;
      email?: string;
      notes?: string;
    }): Promise<MatterClient> => apiClients('', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKey }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Partial<Omit<MatterClient, 'id' | 'created_at'>>): Promise<MatterClient> =>
      apiClients(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKey }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number): Promise<{ success: boolean }> =>
      apiClients(`/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientsKey }),
  });
}
