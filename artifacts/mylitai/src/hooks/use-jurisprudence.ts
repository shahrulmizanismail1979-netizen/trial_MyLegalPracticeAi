import { useQuery } from "@tanstack/react-query";

export function useListCases(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["/api/lit/jurisprudence", params],
    queryFn: async () => {
      // Only include params with real values. Passing `{ search: undefined }`
      // straight into URLSearchParams serialises to `?search=undefined`, which
      // the backend then matches against literally — returning zero cases until
      // the user types a real query. Filtering here lets the page load the full
      // list on mount with an empty query.
      const entries = Object.entries(params ?? {}).filter(
        ([, v]) => v !== undefined && v !== null && v !== "",
      );
      const qs = entries.length
        ? "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()
        : "";
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
