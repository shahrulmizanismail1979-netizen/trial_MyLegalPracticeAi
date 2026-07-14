import { useQuery } from '@tanstack/react-query';

export interface EnforcementMethod {
  id: string;
  name: string;
  shortName: string;
  basis: string;
  debtor: 'individual' | 'company' | 'any';
  summary: string;
  targets: string;
  whenToUse: string[];
  prerequisites: string[];
  pros: string[];
  cons: string[];
  courtFee: string;
}

export interface CostsBasis {
  id: string;
  name: string;
  description: string;
}

interface MethodsResponse {
  methods: EnforcementMethod[];
  costsBases: CostsBasis[];
}

export function useEnforcementMethods() {
  return useQuery<MethodsResponse>({
    queryKey: ['enforcement', 'methods'],
    queryFn: async () => {
      const res = await fetch('/api/lit/enforcement/methods', { credentials: 'include' });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      return res.json();
    },
    staleTime: 1000 * 60 * 10,
  });
}

const DEBTOR_LABEL: Record<EnforcementMethod['debtor'], string> = {
  individual: 'Individual debtor',
  company: 'Company debtor',
  any: 'Any debtor',
};

export function debtorLabel(d: EnforcementMethod['debtor']) {
  return DEBTOR_LABEL[d];
}
