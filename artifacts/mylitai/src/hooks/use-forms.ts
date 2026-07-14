import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useListForms() {
  return useQuery({
    queryKey: ["/api/lit/forms"],
    queryFn: async () => {
      const res = await fetch("/api/lit/forms");
      if (!res.ok) throw new Error("Failed to fetch forms");
      return res.json();
    },
  });
}

export function useGetForm(id: string | number) {
  return useQuery({
    queryKey: ["/api/lit/forms", id],
    queryFn: async () => {
      const res = await fetch(`/api/lit/forms/${id}`);
      if (!res.ok) throw new Error("Failed to fetch form");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useDraftForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: unknown) => {
      const res = await fetch("/api/lit/forms/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to draft form");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/lit/forms"] }),
  });
}
