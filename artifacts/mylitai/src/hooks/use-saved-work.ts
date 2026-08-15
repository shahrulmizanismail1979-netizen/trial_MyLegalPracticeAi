import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface SavedWork {
  id: number;
  kind: string;
  title: string;
  matter: string | null;
  matterId: number | null;
  inputJson: unknown;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveWorkInput {
  kind: string;
  title: string;
  matter?: string | null;
  matterId?: number | null;
  inputJson?: unknown;
  content?: string;
}

const KEY = ['saved-work'];

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/lit/saved-work${path}`, {
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

export function useSavedWork(kind?: string) {
  return useQuery<SavedWork[]>({
    queryKey: kind ? [...KEY, kind] : KEY,
    queryFn: () => apiFetch(kind ? `?kind=${encodeURIComponent(kind)}` : ''),
  });
}

export function useSaveWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveWorkInput): Promise<SavedWork> =>
      apiFetch('', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useUpdateWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Partial<SaveWorkInput>): Promise<SavedWork> =>
      apiFetch(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number): Promise<{ success: boolean }> =>
      apiFetch(`/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Human-readable label + accent for each work kind. */
export const KIND_META: Record<string, { label: string; color: string }> = {
  brief: { label: 'Skeleton Argument', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  analysis: { label: 'Document Analysis', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  limitation: { label: 'Limitation Analysis', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  research: { label: 'Case Law Research', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  pleading: { label: 'Pleadings Review', color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  draft: { label: 'Cause Paper Draft', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
  opinion: { label: 'Legal Opinion', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  crossexam: { label: 'Cross-Exam Plan', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  affidavit: { label: 'Affidavit', color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  quantum: { label: 'Quantum Estimate', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
  bundle: { label: 'Bundle of Authorities', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  hearing: { label: 'Hearing Prep', color: 'text-lime-400 bg-lime-500/10 border-lime-500/20' },
  costs: { label: 'Costs Estimate', color: 'text-green-400 bg-green-500/10 border-green-500/20' },
  settlement: { label: 'Settlement Strategy', color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20' },
  causeofaction: { label: 'Cause of Action', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  oralpractice: { label: 'Oral Advocacy', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  note: { label: 'Note', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

export function kindMeta(kind: string) {
  return KIND_META[kind] ?? { label: kind, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' };
}
