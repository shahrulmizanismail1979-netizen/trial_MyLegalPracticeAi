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

const KEY = ["sya-matters"];

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

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
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
];

export const DEADLINE_CATEGORY_META: Record<string, { label: string; color: string }> = {
  kehadiran: { label: "Kehadiran", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  pliding: { label: "Pliding", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  pendengaran: { label: "Pendengaran", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  rayuan: { label: "Rayuan", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  penguatkuasaan: { label: "Penguatkuasaan", color: "text-orange-400 bg-orange-500/10 border-orange-500/20" },
  iddah: { label: "Iddah", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  custom: { label: "Custom", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
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
