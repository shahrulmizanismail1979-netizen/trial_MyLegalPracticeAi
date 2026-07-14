import { useQuery } from "@tanstack/react-query";

export function useListTerms(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["/api/lit/terminology", params],
    queryFn: async () => {
      const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
      const res = await fetch(`/api/lit/terminology${qs}`);
      if (!res.ok) throw new Error("Failed to fetch terms");
      return res.json();
    },
  });
}

export function useGetTerm(id: string | number) {
  return useQuery({
    queryKey: ["/api/lit/terminology", id],
    queryFn: async () => {
      const res = await fetch(`/api/lit/terminology/${id}`);
      if (!res.ok) throw new Error("Failed to fetch term");
      return res.json();
    },
    enabled: !!id,
  });
}
