import { useQuery } from '@tanstack/react-query';

export interface AppealCausePaper {
  id: string;
  name: string;
  basis: string;
  description: string;
}

export interface AppealStep {
  label: string;
  offsetDays: number;
  category: string;
  basis: string;
  notes?: string;
}

export interface AppealPathway {
  id: string;
  name: string;
  shortName: string;
  fromForum: string;
  toForum: string;
  summary: string;
  leaveRequired: boolean;
  leaveNote: string;
  prerequisites: string[];
  causePapers: AppealCausePaper[];
  anchorLabel: string;
  timeline: AppealStep[];
  caveats: string[];
}

export interface ForumTier {
  id: 'magistrates' | 'sessions' | 'high-court';
  name: string;
  statute: string;
  min: number | null;
  max: number | null;
  scope: string;
}

export interface ForumResult {
  amount: number;
  forum: ForumTier;
  rationale: string;
  note: string;
}

interface PathwaysResponse {
  pathways: AppealPathway[];
  forumTiers: ForumTier[];
}

export function useAppealPathways() {
  return useQuery<PathwaysResponse>({
    queryKey: ['appeals', 'pathways'],
    queryFn: async () => {
      const res = await fetch('/api/lit/appeals/pathways', { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });
}

export async function routeForum(amount: number): Promise<ForumResult> {
  const res = await fetch(`/api/lit/appeals/forum?amount=${encodeURIComponent(amount)}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error((msg as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json();
}

/** Turn a pathway's timeline into deadline rows anchored to a chosen date. */
export function appealTimelineToDeadlines(pathway: AppealPathway, anchorIso: string) {
  const anchor = new Date(anchorIso);
  return pathway.timeline.map((step) => {
    const due = new Date(anchor.getTime());
    due.setDate(due.getDate() + step.offsetDays);
    return {
      title: `${pathway.shortName}: ${step.label}`,
      dueDate: due.toISOString(),
      category: step.category,
      basis: step.basis,
      notes: step.notes,
    };
  });
}
