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

const KEY = ['matters'];

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
