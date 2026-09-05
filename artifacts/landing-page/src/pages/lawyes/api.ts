import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Matter {
  id: number;
  title: string;
  reference?: string;
  status: string;
}

export interface ResourceItem {
  id: string;

  title?: string;

  name?: string;

  item_text?: string;

  description?: string;

  date?: string;

  createdAt?: string;

  uri?: string;

  contentType?: string;

  extractionMetadata?: {
    kind: "image" | "audio" | "video";
    confidence: number | null;
    warnings: string[];
    provenance: { timestamps: Array<{ startSec: number; text: string }> };
  };

  evidenceVerified?: boolean;

  extractedText?: string;

  content?: string;
}

export interface WorkspaceAggregate {
  matter: Matter;
  documents: ResourceItem[];
  uploads: ResourceItem[];
  conversations: ResourceItem[];
  tasks: ResourceItem[];
  checklists: ResourceItem[];
  deadlines: ResourceItem[];
  events: ResourceItem[];
  emails: ResourceItem[];
  research: ResourceItem[];
  drafts: ResourceItem[];
  outputs: ResourceItem[];
  permissions: {
    role: LawyesRole;
    canWrite: boolean;
    canUseConnectors: boolean;
  };
}

export interface GmailMessage {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  to: string;
  date?: string | null;
  snippet: string;
  imported: boolean;
}
export type LawyesRole = "owner" | "editor" | "viewer";
export interface Citation {
  title: string;
  uri: string;
  origin?: "internal_verified" | "web";
  verified?: boolean;
  judgmentId?: number;
  citation?: string | null;
  court?: string | null;
  decisionDate?: string | null;
  verifiedAt?: string;
  rightsStatus?: string;
  pinpoints?: Array<{
    paragraphRef: string;
    pageNumber: number;
    text: string;
  }>;
}

export interface Verification {
  status: string;
  verified: boolean;
  guidance?: string;
}

export interface InstructionResponse {
  content: string;
  research?: string;
  citations: Citation[];
  verification: Verification;
  capabilities: string[];
  researchMode: "verified_library" | "web";
  savedWork?: ResourceItem | null;
  saveCreated?: boolean;
}

export interface GoogleConnectionStatus {
  configured: boolean;
  connected: boolean;
  account?: {
    email: string;
    displayName?: string | null;
    connectedAt: string;
    gmail: boolean;
    drive: boolean;
  } | null;
}

// Ensure 401 triggers auth reset if needed
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { ...options, credentials: "include", cache: "no-store" });
  if (res.status === 401) {
    window.dispatchEvent(new Event("lawyes:unauthorized"));
    throw new Error("Unauthorized");
  }
  if (res.status === 402) {
    throw new Error("Payment Required: Subscription expired or requires renewal.");
  }
  if (res.status === 429) {
    throw new Error("Quota Exceeded: You have reached your usage limit.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: unknown } | null;
    throw new Error(typeof body?.error === "string" ? body.error : `API error: ${res.status}`);
  }
  if (res.status === 204) return undefined;
  return res.json();
}

const base = "/api/lit/lawyes";
export function useLawyesMatters() {
  return useQuery<Matter[]>({
    queryKey: ["lawyes", "matters"],
    queryFn: () => fetchWithAuth("/api/lit/lawyes/matters"),
    retry: false
  });
}

export function useLawyesGoogleConnection() {
  return useQuery<GoogleConnectionStatus>({
    queryKey: ["lawyes", "google-connection"],
    queryFn: () => fetchWithAuth("/api/lit/lawyes/google/status"),
    retry: false,
  });
}

export function useDisconnectLawyesGoogle() {
  const queryClient = useQueryClient();
  return useMutation<{ disconnected: boolean }, Error>({
    mutationFn: () => fetchWithAuth("/api/lit/lawyes/google/connection", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lawyes", "google-connection"] }),
  });
}

export function useLawyesMatter(id?: string) {
  return useQuery<WorkspaceAggregate>({
    queryKey: ["lawyes", "matters", id, "workspace"],
    queryFn: () => fetchWithAuth(`/api/lit/lawyes/matters/${id}/workspace`),
    enabled: !!id,
    retry: false
  });
}

export function useLawyesInstruct(matterId: string) {
  const invalidate = useInvalidateLawyes();
  return useMutation<InstructionResponse, Error, { instruction: string; researchMode: "verified_library" | "web" }>({
    mutationFn: (data) =>
      fetchWithAuth(`/api/lit/lawyes/matters/${matterId}/instructions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useLawyesSaveOutput(matterId: string) {
  const invalidate = useInvalidateLawyes();
  return useMutation<{ work: ResourceItem; created: boolean }, Error, { title: string; kind: string; content: string; instruction?: string; citations?: Citation[]; verification?: Verification; idempotencyKey?: string }>({
    mutationFn: (data) =>
      fetchWithAuth(`/api/lit/lawyes/matters/${matterId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: invalidate,
  });
}

export function useLawyesGmailSearch(matterId: string) {
  return useMutation<GmailSearchResponse, Error, { q: string; pageToken?: string }>({
    mutationFn: ({ q, pageToken }) => {
      const params = new URLSearchParams({ q });
      if (pageToken) params.set("pageToken", pageToken);
      return fetchWithAuth(`/api/lit/lawyes/matters/${matterId}/google/gmail/messages?${params}`);
    },
  });
}
export function useLawyesMembers(enabled = true) {
  return useQuery<LawyesMember[]>({
    queryKey: ["lawyes", "members"],
    queryFn: () => fetchWithAuth(`${base}/members`),
    enabled,
    retry: false,
  });
}

export async function uploadLawyesEvidence(matterId: string, file: File) {
  const issued = await fetchWithAuth(`/api/lit/lawyes/matters/${matterId}/evidence/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const uploaded = await fetch(issued.uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploaded.ok) throw new Error("The evidence file could not be uploaded.");
  return fetchWithAuth(`/api/lit/lawyes/matters/${matterId}/evidence/analyse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      objectPath: issued.objectPath,
      fileName: file.name,
      contentType: file.type,
    }),
  });
}

export function useConfirmLawyesEvidence(matterId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => fetchWithAuth(
      `/api/lit/lawyes/matters/${matterId}/evidence/${documentId}/confirm`,
      { method: "POST" },
    ),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: ["lawyes", "matters", matterId, "workspace"],
    }),
  });
}

export interface LawyesGrant {
  id: number;
  accessCodeId: number;
  matterId: number;
  memberId: number;
  role: LawyesRole;
  createdAt: string;
  updatedAt: string;
}

function useInvalidateLawyes() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ["lawyes", "identity"] }),
    queryClient.invalidateQueries({ queryKey: ["lawyes", "members"] }),
    queryClient.invalidateQueries({ queryKey: ["lawyes", "matters"] }),
    queryClient.invalidateQueries({ queryKey: ["lawyes", "grants"] }),
    queryClient.invalidateQueries({ queryKey: ["lawyes", "audit"] }),
  ]);
}

export function useLawyesRemoveGrant(matterId?: string) {
  const invalidate = useInvalidateLawyes();
  return useMutation<void, Error, number>({
    mutationFn: (memberId) => fetchWithAuth(`${base}/matters/${matterId}/grants/${memberId}`, {
      method: "DELETE",
    }),
    onSuccess: invalidate,
  });
}

export function useLawyesIdentity() {
  return useQuery<LawyesIdentity>({
    queryKey: ["lawyes", "identity"],
    queryFn: () => fetchWithAuth(`${base}/identity`),
    retry: false,
  });
}

export function useLawyesSetGrant(matterId?: string) {
  const invalidate = useInvalidateLawyes();
  return useMutation<LawyesGrant, Error, { memberId: number; role: LawyesRole }>({
    mutationFn: (data) => fetchWithAuth(`${base}/matters/${matterId}/grants`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: invalidate,
  });
}

export function useLawyesInvite() {
  const invalidate = useInvalidateLawyes();
  return useMutation<InviteResponse, Error, { name: string; email?: string; role: LawyesRole }>({
    mutationFn: (data) => fetchWithAuth(`${base}/invite`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: invalidate,
  });
}

export interface LawyesIdentity {
  accessCodeId: number;
  memberId: number | null;
  role: LawyesRole;
  legacyOwner: boolean;
  member: Pick<LawyesMember, "id" | "name" | "email" | "role"> | null;
  capabilities: {
    manageMembers: boolean;
    manageMatterGrants: boolean;
    useConnectors: boolean;
  };
}

export interface LawyesAuditEvent {
  id: number;
  actorMemberId: number | null;
  action: string;
  resourceType: string;
  resourceId: string;
  details: { fromRole?: string | null; toRole?: string | null; role?: string | null };
  createdAt: string;
}

export interface InviteResponse {
  member: LawyesMember;
  personalCode: string;
}

export function useLawyesRevokeMember() {
  const invalidate = useInvalidateLawyes();
  return useMutation<LawyesMember, Error, number>({
    mutationFn: (memberId) => fetchWithAuth(`${base}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useLawyesUpdateMember() {
  const invalidate = useInvalidateLawyes();
  return useMutation<LawyesMember, Error, { memberId: number; role: LawyesRole }>({
    mutationFn: ({ memberId, ...data }) => fetchWithAuth(`${base}/members/${memberId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    }),
    onSuccess: invalidate,
  });
}

export function useLawyesGrants(matterId?: string) {
  return useQuery<LawyesGrant[]>({
    queryKey: ["lawyes", "grants", matterId],
    queryFn: () => fetchWithAuth(`${base}/matters/${matterId}/grants`),
    enabled: !!matterId,
    retry: false,
  });
}

export function useLawyesAudit(enabled = true) {
  return useQuery<LawyesAuditEvent[]>({
    queryKey: ["lawyes", "audit"],
    queryFn: () => fetchWithAuth(`${base}/audit`),
    enabled,
    retry: false,
  });
}

export interface LawyesMember {
  id: number;
  name: string;
  email: string | null;
  role: LawyesRole;
  revokedAt: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface GmailSearchResponse {
  account: string;
  messages: GmailMessage[];
  nextPageToken?: string | null;
}

export function useLawyesGmailImport(matterId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ createdCount: number }, Error, { messageIds: string[] }>({
    mutationFn: (data) => fetchWithAuth(
      `/api/lit/lawyes/matters/${matterId}/google/gmail/import`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    ),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: ["lawyes", "matters", matterId, "workspace"],
    }),
  });
}

export interface DriveExportPreview {
  confirmationToken: string;
  expiresAt: string;
  destination: { account: string; folderId: string; folderName: string };
  files: Array<{ outputId: number; name: string }>;
  confirmationRequired: true;
}

export function useLawyesDriveConfirm(matterId: string) {
  return useMutation<
    { destination: string; account: string; retryable: boolean; files: Array<{ outputId: number; id: string; name: string; status: string; webViewLink?: string }> },
    Error,
    { confirmationToken: string; confirmed: true }
  >({
    mutationFn: (data) => fetchWithAuth(
      `/api/lit/lawyes/matters/${matterId}/google/drive/export-confirm`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    ),
  });
}

export function useLawyesDrivePreview(matterId: string) {
  return useMutation<DriveExportPreview, Error, { outputIds: number[] }>({
    mutationFn: (data) => fetchWithAuth(
      `/api/lit/lawyes/matters/${matterId}/google/drive/export-preview`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    ),
  });
}
