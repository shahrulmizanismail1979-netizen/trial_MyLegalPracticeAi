import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = "/api/sya/matters";

export interface Matter {
  id: number;
  title: string;
  clientName: string | null;
  actingFor: string | null;
  plaintiff: string | null;
  defendant: string | null;
  matterType: string | null;
  court: string | null;
  caseNo: string | null;
  claimAmount: string | null;
  workflowId: number | null;
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
  caseNo: string | null;
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

export interface MatterWorkItem {
  id: number;
  matterId: number;
  kind: string;
  title: string;
  matter: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export type MatterInput = Partial<
  Omit<Matter, "id" | "createdAt" | "updatedAt">
> & {
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

// ── AI Intelligence types ─────────────────────────────────────────────────────

export interface CaseNextStep {
  action: string;
  suggestedDeadline?: string;
  priority: "high" | "medium" | "low";
}

export interface CaseInsights {
  nextSteps: CaseNextStep[];
  caseSummary: string;
  riskAssessment: {
    rating: "Low" | "Medium" | "High";
    keyStrengths: string[];
    keyWeaknesses: string[];
  };
  cachedAt: string;
  expiresAt: string;
}

export interface StageHistoryItem {
  id: number;
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
}

export interface ChecklistItem {
  id: number;
  item_text: string;
  done: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TimeEntry {
  id: number;
  description: string;
  minutes: number;
  rate_usd: string | null;
  entry_date: string;
  created_at: string;
}

export interface TimeEntriesResult {
  entries: TimeEntry[];
  totalMinutes: number;
}

export interface ClientItem {
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

// ── Chronology / case events ──────────────────────────────────────────────────

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

// ── Syariah stages (matches PORTAL_STAGES.sya in backend) ────────────────────
export const SYA_STAGES = [
  "Pengajuan",
  "Perbicaraan",
  "Penghakiman",
  "Rayuan",
  "Selesai",
];

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
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

async function clientsApi(path: string, init?: RequestInit) {
  const res = await fetch(`/api/sya/clients${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
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

const KEY = ["sya-matters"];

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
}

// ── Matter CRUD ───────────────────────────────────────────────────────────────

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

export function useUpcomingDeadlines(days = 60) {
  return useQuery<UpcomingDeadline[]>({
    queryKey: [...KEY, "upcoming", days],
    queryFn: () => api(`/deadlines/upcoming?days=${days}`),
  });
}

export function useMatterWork(matterId: number | null) {
  return useQuery<MatterWorkItem[]>({
    queryKey: [...KEY, "work", matterId],
    queryFn: () => api(`/${matterId}/work`),
    enabled: matterId != null,
  });
}

export function useDeadlineTriggers() {
  return useQuery<DeadlineTrigger[]>({
    queryKey: [...KEY, "triggers"],
    queryFn: () => api("/deadline-triggers"),
    staleTime: Infinity,
  });
}

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

export function useFileWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matterId,
      ...input
    }: {
      matterId: number;
      kind?: string;
      title: string;
      content: string;
      inputJson?: unknown;
    }): Promise<MatterWorkItem> =>
      api(`/${matterId}/work`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matterId,
      id,
    }: {
      matterId: number;
      id: number;
    }): Promise<{ success: boolean }> =>
      api(`/${matterId}/work/${id}`, { method: "DELETE" }),
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
        method: "POST",
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
      api(`/${matterId}/deadlines`, { method: "POST", body: JSON.stringify(input) }),
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
        method: "POST",
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
      api(`/${matterId}/deadlines/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteDeadline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matterId,
      id,
    }: {
      matterId: number;
      id: number;
    }): Promise<{ success: boolean }> =>
      api(`/${matterId}/deadlines/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── AI Case Intelligence ──────────────────────────────────────────────────────

export function useAiInsights(matterId: number | null) {
  return useQuery<CaseInsights>({
    queryKey: [...KEY, "ai-insights", matterId],
    queryFn: () => api(`/${matterId}/ai-insights`),
    enabled: matterId != null,
    staleTime: 6 * 60 * 60 * 1000,
  });
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
    mutationFn: ({ matterId, stage }: { matterId: number; stage: string }): Promise<{ success: boolean; status: string }> =>
      api(`/${matterId}/status`, { method: "PATCH", body: JSON.stringify({ stage }) }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Checklist ────────────────────────────────────────────────────────────────

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
    mutationFn: ({ matterId, item_text }: { matterId: number; item_text: string }): Promise<ChecklistItem> =>
      api(`/${matterId}/checklist`, { method: "POST", body: JSON.stringify({ item_text }) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matterId,
      itemId,
      done,
      item_text,
    }: { matterId: number; itemId: number; done?: boolean; item_text?: string }): Promise<ChecklistItem> =>
      api(`/${matterId}/checklist/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify({ done, item_text }),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, itemId }: { matterId: number; itemId: number }): Promise<{ success: boolean }> =>
      api(`/${matterId}/checklist/${itemId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Time recording ────────────────────────────────────────────────────────────

export function useTimeEntries(matterId: number | null) {
  return useQuery<TimeEntriesResult>({
    queryKey: [...KEY, "time-entries", matterId],
    queryFn: () => api(`/${matterId}/time-entries`),
    enabled: matterId != null,
  });
}

export function useAddTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      matterId,
      description,
      minutes,
      rate_usd,
      entry_date,
    }: {
      matterId: number;
      description: string;
      minutes: number;
      rate_usd?: number | null;
      entry_date?: string;
    }): Promise<TimeEntry> =>
      api(`/${matterId}/time-entries`, {
        method: "POST",
        body: JSON.stringify({ description, minutes, rate_usd, entry_date }),
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ matterId, entryId }: { matterId: number; entryId: number }): Promise<{ success: boolean }> =>
      api(`/${matterId}/time-entries/${entryId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Clients ──────────────────────────────────────────────────────────────────

export function useClients() {
  return useQuery<ClientItem[]>({
    queryKey: [...KEY, "clients"],
    queryFn: () => clientsApi(""),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ClientItem>): Promise<ClientItem> =>
      clientsApi("", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "clients"] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Partial<ClientItem>): Promise<ClientItem> =>
      clientsApi(`/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "clients"] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number): Promise<{ success: boolean }> =>
      clientsApi(`/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, "clients"] }),
  });
}

export function useMatterClients(matterId: number | null) {
  return useQuery<ClientItem[]>({
    queryKey: [...KEY, "matter-clients", matterId],
    queryFn: () => api(`/${matterId}/clients`),
    enabled: matterId != null,
  });
}

export function useLinkClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, matterId }: { clientId: number; matterId: number }): Promise<{ success: boolean }> =>
      clientsApi(`/${clientId}/link-matter`, { method: "POST", body: JSON.stringify({ matterId }) }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUnlinkClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, matterId }: { clientId: number; matterId: number }): Promise<{ success: boolean }> =>
      clientsApi(`/${clientId}/link-matter/${matterId}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}

// ── Chronology / case events ──────────────────────────────────────────────────

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
    mutationFn: ({ matterId, eventId }: { matterId: number; eventId: number }): Promise<{ success: boolean }> =>
      api(`/${matterId}/events/${eventId}`, { method: "DELETE" }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: [...KEY, "events", v.matterId] }),
  });
}

// ── AI case review ─────────────────────────────────────────────────────────────

export function useCaseReview() {
  return useMutation({
    mutationFn: (matterId: number): Promise<{ review: string }> =>
      api(`/${matterId}/review`, { method: "POST", body: JSON.stringify({}) }),
  });
}

// ── Metadata / utilities ──────────────────────────────────────────────────────

/** Syariah matter categories (matterType values). */
export const SYA_MATTER_TYPES: {
  value: string;
  en: string;
  bm: string;
}[] = [
  { value: "cerai_fasakh", en: "Divorce (Cerai / Fasakh / Taklik / Khulu')", bm: "Perceraian (Cerai / Fasakh / Taklik / Khulu')" },
  { value: "nafkah", en: "Maintenance (Nafkah)", bm: "Nafkah" },
  { value: "hadhanah", en: "Custody (Hadhanah)", bm: "Hadhanah (Penjagaan Anak)" },
  { value: "harta_sepencarian", en: "Matrimonial Property (Harta Sepencarian)", bm: "Harta Sepencarian" },
  { value: "mutaah", en: "Mut'ah", bm: "Mut'ah" },
  { value: "faraid", en: "Inheritance (Faraid)", bm: "Faraid (Pusaka)" },
  { value: "wasiat_hibah_wakaf", en: "Wasiat / Hibah / Wakaf", bm: "Wasiat / Hibah / Wakaf" },
  { value: "mal_lain", en: "Other Mal (Civil) Matter", bm: "Kes Mal Lain" },
  { value: "jenayah_syariah", en: "Syariah Criminal", bm: "Jenayah Syariah" },
  { value: "lain", en: "Other", bm: "Lain-lain" },
];

export function matterTypeLabel(value: string | null, mode: string): string {
  if (!value) return "";
  const t = SYA_MATTER_TYPES.find((x) => x.value === value);
  if (!t) return value;
  return mode === "bm" ? t.bm : t.en;
}

export const SYA_COURTS = [
  "Mahkamah Rendah Syariah",
  "Mahkamah Tinggi Syariah",
  "Mahkamah Rayuan Syariah",
  "Mahkamah Syariah Wilayah Persekutuan",
];

/**
 * Suggest the procedural workflow matching a matter type by matching keywords
 * against the workflow's English title. Returns the workflow id or null.
 */
const WORKFLOW_KEYWORDS: Record<string, string[]> = {
  cerai_fasakh: ["divorce", "cerai", "fasakh", "talak", "khulu"],
  nafkah: ["nafkah", "maintenance", "alimony"],
  hadhanah: ["custody", "hadhanah", "child"],
  harta_sepencarian: ["matrimonial", "harta", "sepencarian"],
  mutaah: ["mutaah", "mut'ah"],
  faraid: ["faraid", "inheritance", "estate", "pusaka"],
  wasiat_hibah_wakaf: ["wasiat", "hibah", "wakaf", "will", "trust", "waqf"],
  jenayah_syariah: ["jenayah", "criminal", "syariah criminal", "kesalahan"],
};

export function suggestWorkflowId(
  matterType: string | null | undefined,
  workflows: Array<{ id: number; titleEn?: string; titleBm?: string }> | undefined,
): number | null {
  if (!matterType || !workflows?.length) return null;
  const keywords = WORKFLOW_KEYWORDS[matterType] ?? [];
  if (!keywords.length) return null;
  const match = workflows.find((w) => {
    const title = ((w.titleEn ?? "") + " " + (w.titleBm ?? "")).toLowerCase();
    return keywords.some((k) => title.includes(k));
  });
  return match?.id ?? null;
}

export const DEADLINE_CATEGORY_META: Record<string, { label: string; bm: string; color: string }> = {
  mal: { label: "Mal", bm: "Mal", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  jenayah: { label: "Criminal", bm: "Jenayah", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  faraid: { label: "Faraid", bm: "Faraid", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  perbicaraan: { label: "Hearing", bm: "Perbicaraan", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  rayuan: { label: "Appeal", bm: "Rayuan", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  custom: { label: "Custom", bm: "Lain", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
};

export function categoryMeta(cat: string, mode = "en") {
  const m = DEADLINE_CATEGORY_META[cat] ?? DEADLINE_CATEGORY_META.custom;
  return { ...m, label: mode === "bm" ? m.bm : m.label };
}

/** Days from today until the date (negative = overdue). */
export function daysUntil(iso: string): number {
  const due = new Date(iso);
  const now = new Date();
  const d0 = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const n0 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((d0 - n0) / 86400000);
}
