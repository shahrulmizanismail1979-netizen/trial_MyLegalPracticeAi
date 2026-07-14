import { useQuery } from "@tanstack/react-query";

export function useListTheoryTopics(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["/api/lit/theory", params],
    queryFn: async () => {
      const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
      const res = await fetch(`/api/lit/theory${qs}`);
      if (!res.ok) throw new Error("Failed to fetch theory topics");
      return res.json();
    },
  });
}

export function useGetTheoryTopic(id: string | number) {
  return useQuery({
    queryKey: ["/api/lit/theory", id],
    queryFn: async () => {
      const res = await fetch(`/api/lit/theory/${id}`);
      if (!res.ok) throw new Error("Failed to fetch theory topic");
      return res.json();
    },
    enabled: !!id,
  });
}
