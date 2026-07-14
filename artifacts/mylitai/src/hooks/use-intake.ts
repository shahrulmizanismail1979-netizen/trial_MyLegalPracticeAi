import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface ConflictMatch {
  name: string;
  matchedAgainst: string;
  source: 'matter' | 'intake';
  role: string;
  reference: string | null;
}

export interface IntakeRecord {
  id: number;
  matterId: number | null;
  clientName: string;
  clientType: string;
  idNumber: string | null;
  contact: string | null;
  actingFor: string | null;
  matterDescription: string | null;
  adverseParties: string | null;
  sourceOfFunds: string | null;
  pep: string;
  riskRating: string;
  conflictStatus: string;
  conflictMatches: ConflictMatch[] | null;
  amlaNotes: string | null;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConflictResult {
  status: 'clear' | 'potential';
  matches: ConflictMatch[];
  screened: string[];
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/lit/intake${path}`, {
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

const KEY = ['intake'];

export function useIntakeRecords() {
  return useQuery<IntakeRecord[]>({
    queryKey: [...KEY, 'list'],
    queryFn: () => api(''),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
}

export type IntakeInput = Partial<Omit<IntakeRecord, 'id' | 'createdAt' | 'updatedAt' | 'conflictMatches'>> & {
  clientName?: string;
  conflictMatches?: ConflictMatch[] | null;
};

export function useConflictCheck() {
  return useMutation({
    mutationFn: ({ clientName, adverseParties }: { clientName: string; adverseParties?: string }): Promise<ConflictResult> =>
      api('/conflict-check', { method: 'POST', body: JSON.stringify({ clientName, adverseParties }) }),
  });
}

export function useCreateIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: IntakeInput): Promise<IntakeRecord> =>
      api('', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & IntakeInput): Promise<IntakeRecord> =>
      api(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteIntake() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number): Promise<{ success: boolean }> =>
      api(`/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(qc),
  });
}

export const RISK_META: Record<string, { label: string; color: string }> = {
  low: { label: 'Low risk', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  medium: { label: 'Medium risk', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  high: { label: 'High risk', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

export const CONFLICT_META: Record<string, { label: string; color: string }> = {
  'not-run': { label: 'Not screened', color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  clear: { label: 'No conflict', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  potential: { label: 'Potential conflict', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  conflict: { label: 'Conflict', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};

export const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  cleared: { label: 'Cleared to act', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  declined: { label: 'Declined', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
};
