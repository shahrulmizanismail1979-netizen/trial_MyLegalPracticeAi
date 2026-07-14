import { useQuery } from "@tanstack/react-query";

export function useListCostSchedules() {
  return useQuery({
    queryKey: ["/api/lit/costs"],
    queryFn: async () => {
      const res = await fetch("/api/lit/costs");
      if (!res.ok) throw new Error("Failed to fetch cost schedules");
      return res.json();
    },
  });
}

export function useCalculateStampDuty(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ["/api/lit/costs/stamp-duty", params],
    queryFn: async () => {
      const qs = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
      const res = await fetch(`/api/lit/costs/stamp-duty${qs}`);
      if (!res.ok) throw new Error("Failed to calculate stamp duty");
      return res.json();
    },
    enabled: !!params,
  });
}
