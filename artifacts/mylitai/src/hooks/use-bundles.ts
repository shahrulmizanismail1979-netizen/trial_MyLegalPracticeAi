import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface BundleDocument {
  id: number;
  bundleId: number;
  section: string | null;
  title: string;
  docType: string;
  docDate: string | null;
  pageCount: number;
  sortOrder: number;
}

export interface IndexItem {
  tab: number;
  id: number;
  section: string | null;
  title: string;
  docType: string;
  docDate: string | null;
  pageCount: number;
  startPage: number;
  endPage: number;
  pageLabel: string;
}

export interface Bundle {
  id: number;
  matterId: number | null;
  title: string;
  bundleType: string;
  court: string | null;
  suitNo: string | null;
  parties: string | null;
  startPage: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BundleDetail extends Bundle {
  documents: BundleDocument[];
  index: { items: IndexItem[]; totalPages: number; lastPage: number };
}

export interface BundleTypesResponse {
  bundleTypes: { id: string; name: string }[];
  docTypes: string[];
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`/api/lit/bundles${path}`, {
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

const KEY = ['bundles'];

export function useBundleTypes() {
  return useQuery<BundleTypesResponse>({
    queryKey: [...KEY, 'types'],
    queryFn: () => api('/types'),
    staleTime: Infinity,
  });
}

export function useBundles(matterId?: number) {
  return useQuery<Bundle[]>({
    queryKey: matterId ? [...KEY, 'list', matterId] : [...KEY, 'list'],
    queryFn: () => api(matterId ? `?matterId=${matterId}` : ''),
  });
}

export function useBundle(id: number | null) {
  return useQuery<BundleDetail>({
    queryKey: [...KEY, 'detail', id],
    queryFn: () => api(`/${id}`),
    enabled: id != null,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
}

export type BundleInput = {
  title?: string;
  bundleType?: string;
  court?: string;
  suitNo?: string;
  parties?: string;
  startPage?: number;
  notes?: string;
  matterId?: number | null;
};

export function useCreateBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BundleInput): Promise<Bundle> =>
      api('', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & BundleInput): Promise<Bundle> =>
      api(`/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number): Promise<{ success: boolean }> =>
      api(`/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(qc),
  });
}

export type DocInput = {
  title: string;
  section?: string;
  docType?: string;
  docDate?: string;
  pageCount?: number;
};

export function useAddDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bundleId, ...input }: { bundleId: number } & DocInput): Promise<BundleDocument> =>
      api(`/${bundleId}/documents`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bundleId, id, ...patch }: { bundleId: number; id: number } & Partial<DocInput>): Promise<BundleDocument> =>
      api(`/${bundleId}/documents/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bundleId, id }: { bundleId: number; id: number }): Promise<{ success: boolean }> =>
      api(`/${bundleId}/documents/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(qc),
  });
}

export function useReorderDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bundleId, order }: { bundleId: number; order: number[] }) =>
      api(`/${bundleId}/reorder`, { method: 'POST', body: JSON.stringify({ order }) }),
    onSuccess: () => invalidate(qc),
  });
}

export const BUNDLE_DOC_TYPE_LABEL: Record<string, string> = {
  pleading: 'Pleading',
  affidavit: 'Affidavit',
  'witness-statement': 'Witness Statement',
  exhibit: 'Exhibit',
  correspondence: 'Correspondence',
  contract: 'Contract',
  authority: 'Authority',
  order: 'Order',
  other: 'Other',
};
