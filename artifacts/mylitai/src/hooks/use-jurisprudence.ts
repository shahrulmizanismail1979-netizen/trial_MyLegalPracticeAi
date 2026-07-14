import { useQuery } from "@tanstack/react-query";

export function useListCases(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["/api/lit/jurisprudence", params],
    queryFn: async () => {
      const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
      const res = await fetch(`/api/lit/jurisprudence${qs}`);
      if (!res.ok) throw new Error("Failed to fetch cases");
      return res.json();
    },
  });
}

export function useGetCase(id: string | number) {
  return useQuery({
    queryKey: ["/api/lit/jurisprudence", id],
    queryFn: async () => {
      const res = await fetch(`/api/lit/jurisprudence/${id}`);
      if (!res.ok) throw new Error("Failed to fetch case");
      return res.json();
    },
    enabled: !!id,
  });
}
