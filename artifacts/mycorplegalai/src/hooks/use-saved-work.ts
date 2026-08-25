import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface SavedWork {
  id: number;
  kind: string;
  title: string;
  matter: string | null;
  inputJson: unknown;
  content: string;
  objectPath: string | null;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number;
  storageStatus: "inline" | "stored";
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

export interface GeneratedDraftInput {
  kind: string;
  title: string;
  matter: string;
  matterId: number;
  content: string;
  clientRequestId: string;
  pendingUpload?: {
    objectPath: string;
    fileName: string;
  } | null;
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

/**
 * Files a generated document without carrying its text through the application
 * server or PostgreSQL. The request id is supplied by the caller and is reused
 * on retry, so a lost response cannot create a duplicate filed draft.
 */
export async function saveGeneratedDraft(
  input: GeneratedDraftInput,
  onStage?: (stage: string) => void,
  onUploadReady?: (upload: { objectPath: string; fileName: string }) => void,
): Promise<SavedWork> {
  const fileName = `${input.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "draft"}.md`;
  // A response may have been lost after the server committed the filing. Check
  // before issuing another presigned PUT URL so a page reload/retry never
  // creates an orphaned object.
  const token = localStorage.getItem("auth_token");
  const existing = await fetch(
    `${API_BASE}/api/corp/saved-work/request/${encodeURIComponent(input.clientRequestId)}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (existing.ok) return existing.json() as Promise<SavedWork>;
  if (existing.status !== 404) {
    const body = await existing.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || "Could not check the previous save.");
  }

  let prepared = input.pendingUpload ?? null;
  if (!prepared) {
    onStage?.("Preparing secure upload…");
    const grant = await apiFetch("/upload-url", {
      method: "POST",
      body: JSON.stringify({ fileName }),
    }) as { uploadURL: string; objectPath: string };

    onStage?.("Uploading draft securely…");
    const upload = await fetch(grant.uploadURL, {
      method: "PUT",
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
      body: new Blob([input.content], { type: "text/markdown; charset=utf-8" }),
    });
    if (!upload.ok) {
      throw new Error(`The secure upload failed (${upload.status}). Please retry.`);
    }
    prepared = { objectPath: grant.objectPath, fileName };
    onUploadReady?.(prepared);
  }

  onStage?.("Confirming the matter filing…");
  return apiFetch("", {
    method: "POST",
    body: JSON.stringify({
      kind: input.kind,
      title: input.title,
      matter: input.matter,
      matterId: input.matterId,
      objectPath: prepared.objectPath,
      fileName: prepared.fileName,
      contentType: "text/markdown; charset=utf-8",
      clientRequestId: input.clientRequestId,
    }),
  });
}

export async function fetchSavedWorkContent(id: number): Promise<string> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}/api/corp/saved-work/${id}/content`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error((msg as { error?: string }).error || `Could not open draft (${res.status})`);
  }
  return res.text();
}

export async function downloadSavedWork(id: number, fallbackFilename: string): Promise<void> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}/api/corp/saved-work/${id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error((msg as { error?: string }).error || `Could not download draft (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fallbackFilename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
