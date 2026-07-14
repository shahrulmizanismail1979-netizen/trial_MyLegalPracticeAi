import { useQuery, useMutation } from '@tanstack/react-query';
import { getPathways, getCatalog, getCase, extractDocuments, Pathway, CatalogResult, CaseState, ExtractResult, IntakePayload } from '@/lib/irac-api';

export function usePathways() {
  return useQuery<Pathway[]>({ 
    queryKey: ['pathways'], 
    queryFn: getPathways 
  });
}

export function useCatalog(pathway: string | null) {
  return useQuery<CatalogResult>({ 
    queryKey: ['catalog', pathway], 
    queryFn: () => getCatalog(pathway!), 
    enabled: !!pathway 
  });
}

export function useCase(caseId: string | null) {
  return useQuery<CaseState>({ 
    queryKey: ['case', caseId], 
    queryFn: () => getCase(caseId!), 
    enabled: !!caseId 
  });
}

export function useExtractDocuments() {
  return useMutation<ExtractResult, Error, IntakePayload>({
    mutationFn: (payload) => extractDocuments(payload),
  });
}
