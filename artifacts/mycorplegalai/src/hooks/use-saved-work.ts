import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface SavedWork {
  id: number;
  kind: string;
  title: string;
  matter: string | null;
  inputJson: unknown;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveWorkInput {
  kind: string;
  title: string;
  matter?: string | null;
  matterId?: number | null;
  inputJson?: unknown;
  content?: string;
}

const KEY = ["saved-work"];

async function apiFetch(path: string, init?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}/api/corp/saved-work${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...init,
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error((msg as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function useSavedWork(kind?: string) {
  return useQuery<SavedWork[]>({
    queryKey: kind ? [...KEY, kind] : KEY,
    queryFn: () => apiFetch(kind ? `?kind=${encodeURIComponent(kind)}` : ""),
  });
}

export function useSaveWork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveWorkInput): Promise<SavedWork> =>
      apiFetch("", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
