/**
 * Thin fetch helpers for the Research Admin API.
 * All endpoints live under /api/research-admin/ (no Clerk; password-gated).
 */

// The Vite base path is e.g. "/research-admin/" — the API server is at the
// root /api/ prefix on the shared Replit proxy so we always use absolute paths.
const API_BASE = "/api/research-admin";

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  return res.json() as Promise<T>;
}

export type AuthMe = { authed: boolean };
export type Stats = {
  totalDriveAssets: number;
  approved: number;
  restricted: number;
  rightsReview: number;
  needsOfficialSource: number;
  published: number;
  failed: number;
  pending: number;
  queuedJobs: number;
  failedJobs: number;
  latestInventoryRun: InventoryRun | null;
};

export type InventoryRun = {
  id: number;
  rootFolderId: string;
  startedAt: string;
  completedAt: string | null;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  totalItems: number;
  totalFolders: number;
  totalBytes: number;
  errorMessage: string | null;
  actorId: string | null;
  createdAt: string;
};

export type DriveAsset = {
  id: number;
  driveFileId: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  createdTime: string | null;
  modifiedTime: string | null;
  folderPath: string | null;
  intakeSubject: string | null;
  contributorFolder: string | null;
  dateFolder: string | null;
  md5Checksum: string | null;
  inventoryTimestamp: string;
  sourceClassification:
    | "OFFICIAL_JUDGMENT"
    | "COURT_AUTHORISED_COPY"
    | "EXPRESSLY_LICENSED_SOURCE"
    | "COMMERCIAL_PUBLISHER_REPORT"
    | "UNKNOWN_SOURCE";
  rightsStatus:
    | "RESTRICTED_REFERENCE_ONLY"
    | "NEEDS_OFFICIAL_SOURCE"
    | "RIGHTS_REVIEW_REQUIRED"
    | "APPROVED";
  processingStatus: string;
  errorStatus: string | null;
  parentFolderId: string | null;
  inventoryRunId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DriveAssetsPage = {
  total: number;
  limit: number;
  offset: number;
  assets: DriveAsset[];
};

export type ResearchJob = {
  id: number;
  kind: string;
  status: string;
  idempotencyKey: string | null;
  payload: unknown;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
};

export type JobsPage = {
  total: number;
  limit: number;
  offset: number;
  jobs: ResearchJob[];
};

export type AuditEvent = {
  id: number;
  action: string;
  entityType: string | null;
  entityId: number | null;
  actor: string | null;
  detail: unknown;
  createdAt: string;
};

export type AuditPage = {
  total: number;
  limit: number;
  offset: number;
  events: AuditEvent[];
};

export type QueueStats = Record<string, number>;

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (password: string) =>
    apiFetch<{ ok: boolean }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () => apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: () => apiFetch<AuthMe>("/auth/me"),
};

// ── Stats ─────────────────────────────────────────────────────────────────────

export const statsApi = {
  get: () => apiFetch<Stats>("/stats"),
};

// ── Drive Inventory ───────────────────────────────────────────────────────────

export const inventoryApi = {
  start: () =>
    apiFetch<{ runId: number; status: string }>("/drive/inventory/start", {
      method: "POST",
    }),
  status: () => apiFetch<InventoryRun | null>("/drive/inventory/status"),
  runs: () => apiFetch<InventoryRun[]>("/drive/inventory/runs"),
};

// ── Drive Assets ──────────────────────────────────────────────────────────────

export const assetsApi = {
  list: (params: {
    limit?: number;
    offset?: number;
    rightsStatus?: string;
    processingStatus?: string;
    sourceClassification?: string;
    search?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    if (params.rightsStatus) qs.set("rightsStatus", params.rightsStatus);
    if (params.processingStatus) qs.set("processingStatus", params.processingStatus);
    if (params.sourceClassification) qs.set("sourceClassification", params.sourceClassification);
    if (params.search) qs.set("search", params.search);
    return apiFetch<DriveAssetsPage>(`/drive/assets?${qs}`);
  },
  get: (id: number) => apiFetch<DriveAsset>(`/drive/assets/${id}`),
  updateRights: (id: number, rightsStatus: DriveAsset["rightsStatus"]) =>
    apiFetch<DriveAsset>(`/drive/assets/${id}/rights`, {
      method: "PATCH",
      body: JSON.stringify({ rightsStatus }),
    }),
};

// ── Queue ─────────────────────────────────────────────────────────────────────

export const queueApi = {
  list: (params: { limit?: number; offset?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    if (params.status) qs.set("status", params.status);
    return apiFetch<JobsPage>(`/queue?${qs}`);
  },
  stats: () => apiFetch<QueueStats>("/queue/stats"),
};

// ── Errors ────────────────────────────────────────────────────────────────────

export const errorsApi = {
  list: (params: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    return apiFetch<DriveAssetsPage>(`/errors?${qs}`);
  },
};

// ── Audit ─────────────────────────────────────────────────────────────────────

export const auditApi = {
  list: (params: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    return apiFetch<AuditPage>(`/audit?${qs}`);
  },
};
