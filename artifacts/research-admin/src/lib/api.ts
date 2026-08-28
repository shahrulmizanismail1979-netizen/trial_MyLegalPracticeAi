/**
 * Thin fetch helpers for the Research Admin API.
 * Editorial preparation uses /api/research-admin/ (password-gated). Legal
 * sign-off and publication use the separate Clerk-gated research API.
 */

// The Vite base path is e.g. "/research-admin/" — the API server is at the
// root /api/ prefix on the shared Replit proxy so we always use absolute paths.
const API_BASE = "/api/research-admin";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly failures: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readApiError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null) as {
    error?: unknown; code?: unknown; failures?: unknown;
  } | null;
  const failures = Array.isArray(body?.failures)
    ? body.failures.filter((failure): failure is string => typeof failure === "string")
    : [];
  const message = typeof body?.error === "string" && body.error
    ? body.error
    : failures.join(": ") || `HTTP ${res.status}`;
  return new ApiError(message, res.status, typeof body?.code === "string" ? body.code : undefined, failures);
}

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
    throw await readApiError(res);
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

export type DriveProcessingStatus =
  | "PENDING"
  | "RIGHTS_PENDING"
  | "RIGHTS_APPROVED"
  | "RIGHTS_REJECTED"
  | "INGESTION_QUEUED"
  | "INGESTION_RUNNING"
  | "INGESTION_COMPLETE"
  | "EXTRACTION_QUEUED"
  | "EXTRACTION_RUNNING"
  | "EXTRACTION_COMPLETE"
  | "SEGMENTATION_QUEUED"
  | "SEGMENTATION_RUNNING"
  | "SEGMENTATION_COMPLETE"
  | "REVIEW_QUEUED"
  | "REVIEW_IN_PROGRESS"
  | "REVIEW_COMPLETE"
  | "PUBLICATION_QUEUED"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

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
  processingStatus: DriveProcessingStatus;
  pipelineError: string | null;
  errorStatus: string | null;
  sourceBatchItemId: number | null;
  parentFolderId: string | null;
  inventoryRunId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type PipelineRunStatus = {
  running: boolean;
  startedAt: string | null;
  total: number;
  queued: number;
  skipped: number;
  failed: number;
  completed: number;
  currentAssetId: number | null;
  errors: { assetId: number; message: string }[];
} | null;

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
  bulkUpdateRights: (
    rightsStatus: Exclude<DriveAsset["rightsStatus"], "RIGHTS_REVIEW_REQUIRED">,
    sourceClassification?: string,
  ) =>
    apiFetch<{ updated: number; ingestionQueued: number }>("/drive/assets/bulk-rights", {
      method: "POST",
      body: JSON.stringify({ rightsStatus, sourceClassification }),
    }),
  /** Reject a single RESTRICTED_REFERENCE_ONLY asset (sets processingStatus=CANCELLED). */
  rejectRestricted: (id: number, reason?: string) =>
    apiFetch<DriveAsset>(`/drive/assets/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),
  /**
   * Bulk approve or reject RESTRICTED_REFERENCE_ONLY assets.
   * approve: sets rightsStatus=APPROVED and queues ingestion.
   * reject:  sets processingStatus=CANCELLED (queued for deletion).
   * ids: optional allowlist — when omitted, ALL restricted assets are targeted.
   */
  bulkRestricted: (action: "approve" | "reject", reason?: string, ids?: number[]) =>
    apiFetch<{ action: string; updated: number; ingestionQueued?: number }>("/drive/assets/bulk-restricted", {
      method: "POST",
      body: JSON.stringify({ action, reason, ...(ids ? { ids } : {}) }),
    }),
};

// ── Headnotes & Catchwords ────────────────────────────────────────────────────

export type HeadnoteStatus = "ai_draft" | "accepted" | "rejected";

export type Headnote = {
  id: number;
  judgmentId: number;
  number: number;
  text: string;
  paragraphRef: string | null;
  status: HeadnoteStatus;
  processorVersion: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Catchword = {
  id: number;
  judgmentId: number;
  sortOrder: number;
  catchwordLine: string;
  status: HeadnoteStatus;
  processorVersion: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HeadnotesDetail = {
  judgmentId: number;
  caseName: string | null;
  containerId: number;
  headnotes: Headnote[];
  catchwords: Catchword[];
};

export type HeadnotesListItem = { judgmentId: number; caseName: string | null };
export type HeadnotesListPage = {
  total: number;
  limit: number;
  offset: number;
  items: HeadnotesListItem[];
};

export const headnotesApi = {
  list: (params: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set("limit", String(params.limit));
    if (params.offset != null) qs.set("offset", String(params.offset));
    return apiFetch<HeadnotesListPage>(`/headnotes?${qs}`);
  },
  get: (judgmentId: number) => apiFetch<HeadnotesDetail>(`/headnotes/${judgmentId}`),
  updateHeadnote: (judgmentId: number, id: number, body: { text?: string; paragraphRef?: string; status?: HeadnoteStatus }) =>
    apiFetch<Headnote>(`/headnotes/${judgmentId}/headnotes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  updateCatchword: (judgmentId: number, id: number, body: { catchwordLine?: string; status?: HeadnoteStatus }) =>
    apiFetch<Catchword>(`/headnotes/${judgmentId}/catchwords/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  acceptAll: (judgmentId: number) =>
    apiFetch<{ acceptedHeadnotes: number; acceptedCatchwords: number }>(
      `/headnotes/${judgmentId}/accept-all`,
      { method: "POST" },
    ),
  regenerate: (judgmentId: number) =>
    apiFetch<{ queued: boolean; judgmentId: number }>(
      `/headnotes/${judgmentId}/regenerate`,
      { method: "POST" },
    ),
};

// ── Drive Pipeline ────────────────────────────────────────────────────────────

export const pipelineApi = {
  start: () =>
    apiFetch<{ started: boolean; status: PipelineRunStatus }>("/drive/pipeline/start", {
      method: "POST",
    }),
  status: () => apiFetch<PipelineRunStatus>("/drive/pipeline/status"),
  sync: () => apiFetch<{ updated: number }>("/drive/pipeline/sync", { method: "POST" }),
  ingestAsset: (id: number) =>
    apiFetch<{ queued: boolean; skipped: boolean; reason?: string; errorMessage?: string }>(
      `/drive/assets/${id}/ingest`,
      { method: "POST" },
    ),
};

// ── Container Rights Approval ─────────────────────────────────────────────────

export type BulkContainerApprovalStatus = {
  running: boolean;
  startedAt: string | null;
  total: number;
  approved: number;
  skipped: number;
  failed: number;
  completed: number;
  currentContainerId: number | null;
  errors: { containerId: number; message: string }[];
} | null;

export const containerApprovalApi = {
  status: () =>
    apiFetch<BulkContainerApprovalStatus>("/drive/containers/approve-rights/status"),
  start: () =>
    apiFetch<{ started: boolean; total?: number; reason?: string; status?: BulkContainerApprovalStatus }>(
      "/drive/containers/approve-rights",
      { method: "POST" },
    ),
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

// ── LAWYes editorial reports ─────────────────────────────────────────────────
// Editorial preparation is password-admin scoped; legal actions below remain
// deliberately served by the Clerk-gated research API.
const RESEARCH_API_BASE = "/api/research";
async function researchFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${RESEARCH_API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    throw await readApiError(res);
  }
  return res.json() as Promise<T>;
}

export type LawyesReportState = "Draft" | "AI-assisted" | "Lawyer reviewed" | "Published";
export type LawyesParagraph = { id: number; paragraph_key: string; ordinal: number; text: string; source_checksum: string };
export type LawyesSection = { id: number; kind: string; heading: string; body: string; sort_order: number };
export type LawyesProposition = { id: number; section_id: number; proposition: string; material: boolean };
export type LawyesPinpoint = { id: number; proposition_id: number; paragraph_id: number; supporting_passage: string | null };
export type LawyesReview = { id: number; reviewer_id: number; decision: "approved" | "changes_requested"; legally_trained: boolean; source_checked: boolean; pinpoints_checked: boolean; missing_fields_checked: boolean; notes: string | null; created_at: string };
export type LawyesRevision = { id: number; revision: number; from_state: string | null; to_state: LawyesReportState; snapshot: unknown; reason: string; actor: string; created_at: string };
export type LawyesReport = {
  id: number; judgment_id: number; container_id: number; state: LawyesReportState; current_revision: number;
  title: string; source_url: string; source_verified_at: string | null; source_rights_record_id: number | null;
  lawyer_reviewed_at: string | null; published_at: string | null; created_at: string; updated_at: string;
  paragraphs: LawyesParagraph[]; sections: LawyesSection[]; propositions: LawyesProposition[];
  pinpoints: LawyesPinpoint[]; assignments: Array<{ id: number; assignee_id: number; role: string; status: string; assigned_at: string }>;
  reviews: LawyesReview[]; revisions: LawyesRevision[];
};

/**
 * The workbench endpoint has evolved independently of the admin endpoint.
 * Keep optional relationship collections safe at this boundary so a partial
 * or older response cannot break the editorial screen while it is rendering.
 */
export function normalizeLawyesReport(payload: LawyesReport): LawyesReport {
  const report = payload as LawyesReport & Partial<Pick<LawyesReport,
    "paragraphs" | "sections" | "propositions" | "pinpoints" | "assignments" | "reviews" | "revisions"
  >>;
  const array = <T>(value: T[] | null | undefined): T[] => Array.isArray(value) ? value : [];
  return {
    ...report,
    paragraphs: array(report.paragraphs),
    sections: array(report.sections),
    propositions: array(report.propositions),
    pinpoints: array(report.pinpoints),
    assignments: array(report.assignments),
    reviews: array(report.reviews),
    revisions: array(report.revisions),
  };
}

export const editorialApi = {
  // Password-session queue, read, and non-legal editorial changes stay on the
  // research-admin API. It cannot create a reviewer record or publish.
  get: (id: number) => apiFetch<LawyesReport>(`/editorial/reports/${id}/workbench`).then(normalizeLawyesReport),
  create: (body: { judgmentId: number; title: string; sourceUrl: string }) =>
    apiFetch<LawyesReport>("/editorial/reports", { method: "POST", body: JSON.stringify(body) }).then(normalizeLawyesReport),
  materializeParagraphs: (id: number) =>
    apiFetch<{ inserted: number }>(`/editorial/reports/${id}/paragraphs/materialize`, { method: "POST" }),
  addSection: (id: number, body: { kind: string; heading: string; body: string; sortOrder: number; propositions: Array<{ proposition: string; material: boolean; paragraphIds: number[] }> }) =>
    apiFetch<LawyesSection>(`/editorial/reports/${id}/sections`, { method: "POST", body: JSON.stringify(body) }),
  /** Clerk-authenticated legal act; server derives and verifies the identity. */
  addReview: (id: number, body: { reviewerId: number; decision: "approved" | "changes_requested"; sourceChecked: boolean; pinpointsChecked: boolean; missingFieldsChecked: boolean; notes?: string }) =>
    researchFetch<LawyesReview>(`/reports/${id}/reviews`, { method: "POST", body: JSON.stringify(body) }),
  assign: (id: number, body: { assigneeId: number; role: "editor" | "lawyer_reviewer" }) =>
    researchFetch<unknown>(`/reports/${id}/assignments`, { method: "POST", body: JSON.stringify(body) }),
  transition: (id: number, toState: LawyesReportState, reason: string) =>
    researchFetch<LawyesReport>(`/reports/${id}/transitions`, { method: "POST", body: JSON.stringify({ toState, reason }) }).then(normalizeLawyesReport),
};

export type ResearchStaffSession = {
  role: "owner" | "administrator" | "legal_reviewer" | string | null;
  researchUserId: number | null;
};
export const researchStaffApi = {
  me: () => researchFetch<ResearchStaffSession>("/me"),
};
