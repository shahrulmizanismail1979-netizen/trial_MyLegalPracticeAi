import { useQuery } from '@tanstack/react-query';

export interface CausePaper {
  id: string;
  name: string;
  basis: string;
  description: string;
  preAction?: boolean;
}

export interface RecoveryTimelineStep {
  label: string;
  offsetDays: number;
  category: string;
  basis: string;
  notes?: string;
}

export interface RecoveryTrack {
  id: string;
  name: string;
  shortName: string;
  debtor: 'individual' | 'company' | 'any';
  summary: string;
  whenToUse: string[];
  prerequisites: string[];
  causePapers: CausePaper[];
  anchorLabel: string;
  timeline: RecoveryTimelineStep[];
  caveats: string[];
}

export interface DueDiligenceItem {
  id: string;
  label: string;
  detail: string;
  source: string;
}

interface PathwaysResponse {
  tracks: RecoveryTrack[];
  dueDiligence: DueDiligenceItem[];
}

export function useRecoveryPathways() {
  return useQuery<PathwaysResponse>({
    queryKey: ['banking-recovery', 'pathways'],
    queryFn: async () => {
      const res = await fetch('/api/lit/banking-recovery/pathways', { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });
}

const DEBTOR_LABEL: Record<RecoveryTrack['debtor'], string> = {
  individual: 'Individual debtor',
  company: 'Company debtor',
  any: 'Any debtor',
};

export function debtorLabel(d: RecoveryTrack['debtor']) {
  return DEBTOR_LABEL[d];
}

/** Turn a track's timeline into deadline rows anchored to a chosen date. */
export function timelineToDeadlines(track: RecoveryTrack, anchorIso: string) {
  const anchor = new Date(anchorIso);
  return track.timeline.map((step) => {
    const due = new Date(anchor.getTime());
    due.setDate(due.getDate() + step.offsetDays);
    return {
      title: `${track.shortName}: ${step.label}`,
      dueDate: due.toISOString(),
      category: step.category,
      basis: step.basis,
      notes: step.notes,
    };
  });
}
