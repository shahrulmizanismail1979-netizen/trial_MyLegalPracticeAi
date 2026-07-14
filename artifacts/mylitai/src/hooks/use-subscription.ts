import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface SubscriptionStatus {
  active: boolean;
  comped: boolean;
  status: string | null;
  hasCustomer: boolean;
}

const KEY = ['subscription-status'];

export function useSubscription() {
  return useQuery<SubscriptionStatus>({
    queryKey: KEY,
    queryFn: async () => {
      const res = await fetch('/api/lit/billing/status', { credentials: 'include' });
      if (!res.ok) {
        return { active: false, comped: false, status: null, hasCustomer: false };
      }
      return res.json();
    },
  });
}

export function useRefreshSubscription() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
}
