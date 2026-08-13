import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authHeaders } from "@/lib/auth";

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

export type MatterInput = Partial<Omit<Matter, "id" | "createdAt" | "updatedAt">> & {
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

// ── Case intelligence types ────────────────────────────────────────────────────

export interface CaseNextStep {
  action: string;
  suggestedDeadline?: string;
  priority: "high" | "medium" | "low";
}

export interface CaseRiskAssessment {
  rating: "Low" | "Medium" | "High";
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
  matterIds?: number[];
}

export const CASE_EVENT_KINDS = [
  "filing",
  "hearing",
  "correspondence",
  "instruction",
  "deadline",
  "stage",
  "saved-work",
  "note",
  "payment",
  "meeting",
] as const;

export type CaseEventKind = (typeof CASE_EVENT_KINDS)[number];

export interface CaseEvent {
  id: number;
  event_date: string;
  title: string;
  description: string | null;
  kind: string;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseEventInput {
  title: string;
  event_date: string;
  kind: string;
  description?: string;
  source?: string;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/ccb/matters${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
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

async function clientsApi(path: string, init?: RequestInit) {
  const res = await fetch(`/api/ccb/clients${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
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

async function savedWorkApi(path: string, init?: RequestInit) {
  const res = await fetch(`/api/ccb/saved-work${path}`, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
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

const KEY = ["ccb-matters"];

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
}

// ── Matter queries ─────────────────────────────────────────────────────────────

export function useMatters(status?: string) {
  return useQuery<Matter[]>({
    queryKey: status ? [...KEY, "list", status] : [...KEY, "list"],
    queryFn: () => api(status ? `?status=${encodeURIComponent(status)}` : ""),
  });
}

export function useMatter(id: number | null) {
  return useQuery<MatterDetail>({
    queryKey: [...KEY, "detail", id],
    queryFn: () => api(`/${id}`),
    enabled: id != null,
  });
}

export function useMatterWork(matterId: number | null) {
  return useQuery<MatterWorkItem[]>({
    queryKey: [...KEY, "work", matterId],
    queryFn: () => api(`/${matterId}/work`),
    enabled: matterId != null,
  });
}

// ── Matter mutations ───────────────────────────────────────────────────────────

export function useCreateMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MatterInput): Promise<Matter> =>
      api("", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & MatterInput): Promise<Matter> =>
      api(`/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteMatter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number): Promise<{ success: boolean }> =>
      api(`/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Deadline mutations ─────────────────────────────────────────────────────────

export function useAddDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, ...input }: { matterId: number } & DeadlineInput): Promise<MatterDeadline> =>
      api(`/${matterId}/deadlines`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, id, ...patch }: { matterId: number; id: number } & Partial<DeadlineInput>): Promise<MatterDeadline> =>
      api(`/${matterId}/deadlines/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, id }: { matterId: number; id: number }): Promise<{ success: boolean }> =>
      api(`/${matterId}/deadlines/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Stage management ───────────────────────────────────────────────────────────

export function useStageHistory(matterId: number | null) {
  return useQuery<StageHistoryItem[]>({
    queryKey: [...KEY, "stage-history", matterId],
    queryFn: () => api(`/${matterId}/stage-history`),
    enabled: matterId != null,
  });
}

export function useUpdateStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) =>
      api(`/${id}/status`, { method: "PATCH", body: JSON.stringify({ stage }) }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── AI insights ────────────────────────────────────────────────────────────────

export function useAiInsights(matterId: number | null, enabled = true) {
  return useQuery<CaseInsights>({
    queryKey: [...KEY, "ai-insights", matterId],
    queryFn: () => api(`/${matterId}/ai-insights`),
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
  initialActions: Array<{ action: string; priority: "high" | "medium" | "low" }>;
  generatedAt: string;
}

export function useRefreshAiInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (matterId: number): Promise<CaseInsights> =>
      api(`/${matterId}/ai-insights?refresh=1`),
    onSuccess: (_data, matterId) => {
      qc.invalidateQueries({ queryKey: [...KEY, "ai-insights", matterId] });
    },
  });
}

// ── Checklist ──────────────────────────────────────────────────────────────────

export function useChecklist(matterId: number | null) {
  return useQuery<ChecklistItem[]>({
    queryKey: [...KEY, "checklist", matterId],
    queryFn: () => api(`/${matterId}/checklist`),
    enabled: matterId != null,
  });
}

export function useAddChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, text }: { matterId: number; text: string }) =>
      api(`/${matterId}/checklist`, { method: "POST", body: JSON.stringify({ text }) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, itemId, done, text }: { matterId: number; itemId: number; done?: boolean; text?: string }) =>
      api(`/${matterId}/checklist/${itemId}`, { method: "PATCH", body: JSON.stringify({ done, text }) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, itemId }: { matterId: number; itemId: number }) =>
      api(`/${matterId}/checklist/${itemId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Time recording ─────────────────────────────────────────────────────────────

export function useTimeEntries(matterId: number | null) {
  return useQuery<TimeEntriesResult>({
    queryKey: [...KEY, "time", matterId],
    queryFn: () => api(`/${matterId}/time-entries`),
    enabled: matterId != null,
  });
}

export function useLogTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, ...input }: { matterId: number; description: string; minutes: number; entry_date: string }) =>
      api(`/${matterId}/time-entries`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, entryId }: { matterId: number; entryId: number }) =>
      api(`/${matterId}/time-entries/${entryId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Clients ────────────────────────────────────────────────────────────────────

export function useClients() {
  return useQuery<CaseClient[]>({
    queryKey: [...KEY, "clients"],
    queryFn: () => clientsApi(""),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; company_name?: string; email?: string; phone?: string; notes?: string }) =>
      clientsApi("", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: number) =>
      clientsApi(`/${clientId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useMatterClients(matterId: number | null) {
  return useQuery<CaseClient[]>({
    queryKey: [...KEY, "matter-clients", matterId],
    queryFn: () => api(`/${matterId}/clients`),
    enabled: matterId != null,
  });
}

export function useLinkClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, matterId }: { clientId: number; matterId: number }) =>
      clientsApi(`/${clientId}/link-matter`, { method: "POST", body: JSON.stringify({ matterId }) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUnlinkClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, matterId }: { clientId: number; matterId: number }) =>
      clientsApi(`/${clientId}/link-matter/${matterId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Chronology / case events ────────────────────────────────────────────────────

export function useCaseEvents(matterId: number | null) {
  return useQuery<CaseEvent[]>({
    queryKey: [...KEY, "events", matterId],
    queryFn: () => api(`/${matterId}/events`),
    enabled: matterId != null,
  });
}

export function useAddCaseEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, ...input }: { matterId: number } & CaseEventInput): Promise<CaseEvent> =>
      api(`/${matterId}/events`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: [...KEY, "events", v.matterId] }),
  });
}

export function useUpdateCaseEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, eventId, ...patch }: { matterId: number; eventId: number } & Partial<CaseEventInput>): Promise<CaseEvent> =>
      api(`/${matterId}/events/${eventId}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: [...KEY, "events", v.matterId] }),
  });
}

export function useDeleteCaseEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, eventId }: { matterId: number; eventId: number }) =>
      api(`/${matterId}/events/${eventId}`, { method: "DELETE" }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: [...KEY, "events", v.matterId] }),
  });
}

// ── AI case review ───────────────────────────────────────────────────────────────

export function useCaseReview() {
  return useMutation({
    mutationFn: (matterId: number): Promise<{ review: string }> =>
      api(`/${matterId}/review`, { method: "POST", body: JSON.stringify({}) }),
  });
}

// ── Matter briefing (dashboard "My Cases") ───────────────────────────────────────

export interface MatterNextStep {
  source: "deadline" | "checklist" | "stage";
  label: string;
  due_date?: string;
}

export interface MatterBriefing {
  id: number;
  title: string;
  status: string;
  matter_type: string | null;
  updated_at: string;
  stage_index: number;
  stage_count: number;
  checklist_total: number;
  checklist_done: number;
  next_deadline: { title: string; due_date: string } | null;
  overdue_count: number;
  last_event: { title: string; kind: string; event_date: string } | null;
  next_step: MatterNextStep | null;
}

export interface MattersBriefing {
  matters: MatterBriefing[];
  stageCount: number;
  stages: string[];
}

export function useMattersBriefing() {
  return useQuery<MattersBriefing>({
    queryKey: [...KEY, "briefing"],
    queryFn: () => api("/briefing/summary"),
  });
}

export function usePrepareMatter() {
  return useMutation({
    mutationFn: ({ id, step }: { id: number; step?: string }): Promise<{ preparation: string; step: string }> =>
      api(`/${id}/prepare`, { method: "POST", body: JSON.stringify(step ? { step } : {}) }),
  });
}

// ── Saved work ──────────────────────────────────────────────────────────────────

export interface SaveWorkInput {
  kind: string;
  title: string;
  matter?: string | null;
  matterId?: number | null;
  inputJson?: unknown;
  content?: string;
}

export function useSaveWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveWorkInput) =>
      savedWorkApi("", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** File reference like CCB/2026/1234 */
export function generateFileRef(prefix = "CCB"): string {
  const year = new Date().getFullYear();
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}/${year}/${n}`;
}

/** Days from today until the date (negative = overdue). */
export function daysUntil(iso: string): number {
  const due = new Date(iso);
  const now = new Date();
  const d0 = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const n0 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d0 - n0) / 86400000);
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function useIntakeBriefing(matterId: number | null) {
  return useQuery<IntakeBriefing>({
    queryKey: [...KEY, "intake-briefing", matterId],
    queryFn: () => api(`/${matterId}/intake-briefing`),
    enabled: matterId != null,
    staleTime: Infinity,
    retry: false,
  });
}
