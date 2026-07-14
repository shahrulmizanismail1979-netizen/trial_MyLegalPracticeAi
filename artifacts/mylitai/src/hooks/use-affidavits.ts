import { useQuery } from '@tanstack/react-query';

export type DocCategory = 'affidavit' | 'supporting';

export interface AffidavitField {
  key: string;
  label: string;
  long?: boolean;
  placeholder?: string;
}

export interface AffidavitType {
  id: string;
  name: string;
  category: DocCategory;
  basis: string;
  description: string;
  whenToUse: string;
  hasExhibits: boolean;
  caveats: string[];
}

interface TypesResponse {
  types: AffidavitType[];
  fields: AffidavitField[];
}

export function useAffidavitTypes() {
  return useQuery<TypesResponse>({
    queryKey: ['affidavits', 'types'],
    queryFn: async () => {
      const res = await fetch('/api/lit/affidavits/types', { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });
}
