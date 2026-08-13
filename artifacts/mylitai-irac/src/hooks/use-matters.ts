import { useRef } from 'react';
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
}

export type MatterDetail = Matter & { deadlines: MatterDeadline[] };

export type MatterInput = Partial<Omit<Matter, 'id' | 'createdAt' | 'updatedAt'>> & { title?: string };

export interface MatterWorkItem {
  id: number;
  kind: string;
  title: string;
  matter: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

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

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/lit/matters${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error((msg as { error?: string }).error || `Request failed (${res.status})`);
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
    throw new Error((msg as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json();
}

const KEY = ['matters'];
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

export function useMatterWork(matterId: number | null) {
  return useQuery<MatterWorkItem[]>({
    queryKey: [...KEY, 'work', matterId],
    queryFn: () => api(`/${matterId}/work`),
    enabled: matterId != null,
  });
}

export function useCreateMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MatterInput): Promise<Matter> =>
      api('', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export async function fileWorkIntoMatter(input: {
  kind: string;
  title: string;
  matter: string;
  matterId: number;
  content: string;
}) {
  const res = await fetch('/api/lit/saved-work', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error((msg as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function daysUntil(iso: string): number {
  const now = new Date();
  const due = new Date(iso);
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

// ── AI Insights hooks ─────────────────────────────────────────────────────────

const AI_POLL_INTERVAL_MS = 12_000;        // 12 s between polls
const AI_POLL_TIMEOUT_MS  = 3 * 60 * 1000; // give up after 3 min

export function useAIInsights(matterId: number | null) {
  const startedAt = useRef(Date.now());
  return useQuery<CaseInsights>({
    queryKey: [...KEY, 'ai-insights', matterId],
    queryFn: () => api(`/${matterId}/ai-insights`),
    enabled: matterId != null,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    // Auto-poll while the briefing is still being generated by the background
    // job, stopping as soon as content arrives or 3 minutes have elapsed.
    refetchInterval: (query) => {
      if (query.state.data) return false;
      if (Date.now() - startedAt.current > AI_POLL_TIMEOUT_MS) return false;
      return AI_POLL_INTERVAL_MS;
    },
  });
}

export const AI_BRIEFING_POLL_TIMEOUT_MS = AI_POLL_TIMEOUT_MS;

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

export function useIntakeBriefing(matterId: number | null) {
  return useQuery<IntakeBriefing>({
    queryKey: [...KEY, 'intake-briefing', matterId],
    queryFn: () => api(`/${matterId}/intake-briefing`),
    enabled: matterId != null,
    staleTime: Infinity,
    retry: false,
  });
}

export function useGenerateIntakeBriefing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matterId: number): Promise<IntakeBriefing> =>
      api(`/${matterId}/intake-briefing/generate`, { method: 'POST' }),
    onSuccess: (data, matterId) => {
      qc.setQueryData([...KEY, 'intake-briefing', matterId], data);
    },
  });
}
