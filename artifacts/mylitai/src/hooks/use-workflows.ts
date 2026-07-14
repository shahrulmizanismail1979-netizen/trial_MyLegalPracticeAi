import { useQuery } from "@tanstack/react-query";

export function useListWorkflows() {
  return useQuery({
    queryKey: ["/api/lit/workflows"],
    queryFn: async () => {
      const res = await fetch("/api/lit/workflows");
      if (!res.ok) throw new Error("Failed to fetch workflows");
      return res.json();
    },
  });
}

export function useGetWorkflow(id: string | number) {
  return useQuery({
    queryKey: ["/api/lit/workflows", id],
    queryFn: async () => {
      const res = await fetch(`/api/lit/workflows/${id}`);
      if (!res.ok) throw new Error("Failed to fetch workflow");
      return res.json();
    },
    enabled: !!id,
  });
}
