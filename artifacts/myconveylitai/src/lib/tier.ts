// Frontend mirror of the backend tier model (artifacts/api-server/src/lib/access.ts).
// Used purely for UX gating — the backend is always the source of truth and will
// reject under-entitled requests regardless of what the UI allows.
import type { AiMode } from '@/contexts/AppContext';

export type Tier = 'free' | 'student' | 'practitioner' | 'firm';

export const TIER_RANK: Record<Tier, number> = {
  free: 0,
  student: 1,
  practitioner: 2,
  firm: 3,
};

export const TIER_LABELS: Record<Tier, string> = {
  free: 'Free',
  student: 'Student',
  practitioner: 'Practitioner',
  firm: 'Firm',
};

export function hasTier(current: Tier | undefined | null, min: Tier): boolean {
  if (!current) return false;
  return TIER_RANK[current] >= TIER_RANK[min];
}

// The only two AI tools available on the Student tier (with a daily cap).
export const STUDENT_TOOLS: AiMode[] = ['tutor', 'caseresearch'];

/** Minimum tier required to use a given AI tool. */
export function requiredTierForTool(mode: AiMode): Tier {
  return STUDENT_TOOLS.includes(mode) ? 'student' : 'practitioner';
}

// Feature gates.
export const EXPORT_MIN_TIER: Tier = 'practitioner';
export const AUDIO_MIN_TIER: Tier = 'firm';
