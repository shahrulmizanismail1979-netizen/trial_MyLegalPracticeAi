// IRAC Litigation Engine — API client.
// The shared API server is mounted at the ABSOLUTE root path `/api` (a separate
// proxy service), so we call `/api/lit/irac/...` directly. Do NOT prefix with the
// artifact base path (import.meta.env.BASE_URL) — that would wrongly become
// `/irac/api/...` and miss the API server.

const API_BASE = "/api/lit/irac";

// ─── AI provider selection ────────────────────────────────────────────────────
// The effective provider is resolved by the React provider-context
// (user override → admin default → gemini) and pushed here. Every AI request
// from this client carries it in the body so the server honours it. Defaults to
// gemini so behaviour is unchanged until something explicitly switches it.
export type AIProvider = "gemini" | "openai";

let currentProvider: AIProvider = "gemini";

export function setApiProvider(provider: AIProvider): void {
  currentProvider = provider === "openai" ? "openai" : "gemini";
}

export function getApiProvider(): AIProvider {
  return currentProvider;
}

// Merge the active provider into an outgoing request body without clobbering an
// explicit per-call provider.
function withProvider(body: Record<string, unknown>): Record<string, unknown> {
  return { provider: currentProvider, ...body };
}

export interface Pathway {
  id: string;
  label: string;
  blurb: string;
  court: string;
  keyLegislation: string[];
}

export interface CaseFileMeta {
  name: string;
  source: string;
  chars: number;
  truncated: boolean;
}

export interface ExtractResult {
  caseId: string;
  pathway: string;
  files: CaseFileMeta[];
  totalChars: number;
  documentCount: number;
}

export interface DocItem {
  id: string;
  label: string;
}

export interface DocCategory {
  id: string;
  label: string;
  description: string;
  items: DocItem[];
}

export interface CatalogResult {
  pathway: string;
  categories: DocCategory[];
}

export interface Citation {
  title: string;
  uri: string;
}

export interface CaseState {
  caseId: string;
  pathway: string;
  files: CaseFileMeta[];
  totalChars: number;
  stages: {
    issues: boolean;
    rules: boolean;
    application: boolean;
    opinion: boolean;
  };
  issues?: string;
  rules?: string;
  application?: string;
  opinion?: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((msg as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function getPathways(): Promise<Pathway[]> {
  return getJson<Pathway[]>(`${API_BASE}/pathways`);
}

export function getCatalog(pathway: string): Promise<CatalogResult> {
  return getJson<CatalogResult>(`${API_BASE}/catalog?pathway=${encodeURIComponent(pathway)}`);
}

export function getCase(caseId: string): Promise<CaseState> {
  return getJson<CaseState>(`${API_BASE}/case/${encodeURIComponent(caseId)}`);
}

export interface PasteTextItem {
  label?: string;
  content: string;
}

export interface IntakePayload {
  files?: File[];
  pasteTexts?: PasteTextItem[];
  urls?: string[];
  pathway: string;
  /** When set, append the materials to an existing matter instead of creating a new one. */
  caseId?: string;
}

/**
 * Submit case materials of any kind: documents (PDF/DOCX/TXT/MD/RTF/CSV/images,
 * and ZIP archives), audio & video recordings (transcribed), pasted text notes,
 * and web links (fetched & read). Pass `caseId` to append to an existing matter.
 */
export async function extractDocuments(payload: IntakePayload): Promise<ExtractResult> {
  const { files = [], pasteTexts = [], urls = [], pathway, caseId } = payload;
  const form = new FormData();
  for (const f of files) form.append("files", f);
  form.append("pathway", pathway);
  if (pasteTexts.length) form.append("pasteTexts", JSON.stringify(pasteTexts));
  if (urls.length) form.append("urls", JSON.stringify(urls));
  if (caseId) form.append("caseId", caseId);
  const res = await fetch(`${API_BASE}/extract`, { method: "POST", body: form });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((msg as { error?: string }).error || `Upload failed (${res.status})`);
  }
  return res.json() as Promise<ExtractResult>;
}

export interface StreamHandlers {
  onContent: (chunk: string) => void;
  onCitations?: (citations: Citation[]) => void;
  onDone?: (info: { disclaimer?: string; groundingWarning?: boolean }) => void;
  onError?: (message: string) => void;
}

export type IracStage = "issues" | "research" | "application" | "opinion";

interface StreamControl {
  cancel: () => void;
}

async function streamSSE(
  path: string,
  body: Record<string, unknown>,
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withProvider(body)),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    handlers.onError?.("Network error. Please try again.");
    return;
  }

  if (!res.ok || !res.body) {
    const msg = await res.json().catch(() => ({ error: res.statusText }));
    handlers.onError?.((msg as { error?: string }).error || `Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const data = JSON.parse(payload);
          if (data.error) {
            handlers.onError?.(data.error);
            continue;
          }
          if (typeof data.content === "string") handlers.onContent(data.content);
          if (Array.isArray(data.citations)) handlers.onCitations?.(data.citations);
          if (data.done)
            handlers.onDone?.({
              disclaimer: data.disclaimer,
              groundingWarning: Boolean(data.groundingWarning),
            });
        } catch {
          // ignore malformed chunk
        }
      }
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      handlers.onError?.("Stream interrupted. Please try again.");
    }
  }
}

/** Run an IRAC pipeline stage (Issues / Research / Application / Opinion). Returns a cancel handle. */
export function runStage(
  stage: IracStage,
  caseId: string,
  handlers: StreamHandlers,
  extra: Record<string, unknown> = {},
): StreamControl {
  const controller = new AbortController();
  void streamSSE(`/${stage}`, { caseId, ...extra }, handlers, controller.signal);
  return { cancel: () => controller.abort() };
}

export interface DraftParams {
  category: string;
  docType: string;
  pathway: string;
  mode: "sample" | "draft" | "reply";
  caseId?: string;
  opponentCaseId?: string;
  instructions?: string;
  /** Extracted text of a user-supplied sample/template the AI should follow. */
  templateText?: string;
}

export interface TemplateResult {
  name: string;
  text: string;
  chars: number;
  truncated: boolean;
}

/**
 * Upload a single sample/template document and get its extracted text back so it
 * can be passed to `runDraft` as `templateText`. The file is the user's own
 * precedent, so its text is returned to the client.
 */
export async function extractTemplate(file: File): Promise<TemplateResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/extract-template`, { method: "POST", body: form });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((msg as { error?: string }).error || `Upload failed (${res.status})`);
  }
  return res.json() as Promise<TemplateResult>;
}

/**
 * Generate an annotated sample precedent (mode: "sample"), a tailored draft from
 * the active matter (mode: "draft"), or a responsive document to the opposing
 * party's uploaded document (mode: "reply").
 */
export function runDraft(params: DraftParams, handlers: StreamHandlers): StreamControl {
  const controller = new AbortController();
  void streamSSE("/draft", { ...params }, handlers, controller.signal);
  return { cancel: () => controller.abort() };
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

/**
 * Send a turn to the per-pathway expert paralegal chat. `messages` is the full
 * conversation so far (the server is stateless); the assistant reply streams
 * back through `handlers`. Premium-gated.
 */
export function runPathwayChat(
  pathway: string,
  messages: ChatTurn[],
  handlers: StreamHandlers,
): StreamControl {
  const controller = new AbortController();
  void streamSSE("/chat", { pathway, messages }, handlers, controller.signal);
  return { cancel: () => controller.abort() };
}

/** Analyze previously-uploaded document(s) (by caseId) in a single grounded pass. */
export function runAnalyze(
  caseId: string,
  handlers: StreamHandlers,
  pathway?: string,
): StreamControl {
  const controller = new AbortController();
  void streamSSE("/analyze", { caseId, pathway }, handlers, controller.signal);
  return { cancel: () => controller.abort() };
}

// ─── Transcription ───────────────────────────────────────────────────────────
export interface TranscriptSegment {
  speaker: string;
  speakerLabel: string;
  startSec: number;
  start: string;
  text: string;
}

export interface TranscriptResult {
  filename: string;
  language: string;
  durationSec: number;
  speakerCount: number;
  segments: TranscriptSegment[];
  text: string;
}

/**
 * Transcribe an audio/video recording into a full, verbatim, speaker-labelled
 * transcript with timestamps. Handles long recordings (court proceedings,
 * client meetings) up to the server limit.
 */
export async function transcribeRecording(file: File): Promise<TranscriptResult> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/transcribe`, { method: "POST", body: form });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((msg as { error?: string }).error || `Transcription failed (${res.status})`);
  }
  return res.json() as Promise<TranscriptResult>;
}

// ─── Academic Library ────────────────────────────────────────────────────────
// The shared academic content (theory, case law, cause papers, workflows, costs,
// glossary) is served by the same API server but at the ABSOLUTE root `/api/lit/...`
// — NOT under `/api/lit/irac/...` and NOT under the artifact BASE_URL prefix.
const ROOT_API = "/api";

export interface TheoryTopic {
  id: number;
  title: string;
  category: string;
  overview: string;
  content: string;
  legislation: string[];
  keyPrinciples: string[];
  relatedCases: string[];
  order: number;
}

export interface LegalCase {
  id: number;
  caseName: string;
  citation: string;
  year: number;
  court: string;
  judge?: string;
  facts: string;
  issues: string[];
  held: string;
  significance: string;
  tags: string[];
  legislation: string[];
}

export interface WorkflowStep {
  stepNumber: number;
  title: string;
  description: string;
  legalBasis: string;
  documents: string[];
  timeframe?: string;
  notes?: string;
}

export interface Workflow {
  id: number;
  title: string;
  category: string;
  description: string;
  legalBasis: string;
  applicableTo: string;
  estimatedDuration?: string;
  steps: WorkflowStep[];
  sampleDocuments: string[];
}

export interface LegalForm {
  id: number;
  formNumber: string;
  title: string;
  category: string;
  authorizedBy: string;
  purpose: string;
  instructions: string;
  fields: string[];
  filingFee: string;
  timeLimit?: string;
  notes?: string;
}

export interface CostItem {
  description: string;
  amount: string;
  notes?: string;
}

export interface CostSchedule {
  id: number;
  title: string;
  category: string;
  description: string;
  items: CostItem[];
  legislativeBasis: string;
  lastUpdated?: string;
}

export interface GlossaryTerm {
  id: number;
  term: string;
  definition: string;
  source: string;
  example?: string;
  relatedTerms: string[];
  category: string;
  latinOrigin?: string;
}

export interface PracticeDirection {
  id: number;
  title: string;
  refNo: string;
  court: string;
  category: string;
  summary: string;
  practicalEffect: string;
  effectiveDate?: string | null;
  status: string;
  sourceUrl: string;
}

export interface BarCouncilRuling {
  id: number;
  title: string;
  chapter: string;
  ruling: string;
  basis: string;
  practicalEffect: string;
  consequence?: string | null;
  sourceUrl: string;
  lastUpdated?: string | null;
}

export interface CompendiumItem {
  injury: string;
  low: number;
  high: number | null;
  notes?: string;
}

export interface CompendiumCategory {
  slug: string;
  name: string;
  group: string;
  description: string;
  items: CompendiumItem[];
  factors?: string[];
  note?: string;
}

export interface CompendiumMeta {
  title: string;
  source: string;
  approvedBy: string;
  effectiveYear: number;
  currency: string;
  guideline: string;
  leadingCase: string;
  overlapPrinciple: string;
}

export interface CompendiumResponse {
  meta: CompendiumMeta;
  categories: CompendiumCategory[];
}

// Theory
export function getTheoryTopics(): Promise<TheoryTopic[]> {
  return getJson<TheoryTopic[]>(`${ROOT_API}/theory`);
}
export function getTheoryTopic(id: number | string): Promise<TheoryTopic> {
  return getJson<TheoryTopic>(`${ROOT_API}/theory/${encodeURIComponent(String(id))}`);
}

// Jurisprudence (case law)
export function getLegalCases(search?: string): Promise<LegalCase[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return getJson<LegalCase[]>(`${ROOT_API}/jurisprudence${qs}`);
}
export function getLegalCase(id: number | string): Promise<LegalCase> {
  return getJson<LegalCase>(`${ROOT_API}/jurisprudence/${encodeURIComponent(String(id))}`);
}

// Workflows
export function getWorkflows(): Promise<Workflow[]> {
  return getJson<Workflow[]>(`${ROOT_API}/workflows`);
}
export function getWorkflow(id: number | string): Promise<Workflow> {
  return getJson<Workflow>(`${ROOT_API}/workflows/${encodeURIComponent(String(id))}`);
}

// Forms (cause papers)
export function getForms(): Promise<LegalForm[]> {
  return getJson<LegalForm[]>(`${ROOT_API}/forms`);
}
export function getForm(id: number | string): Promise<LegalForm> {
  return getJson<LegalForm>(`${ROOT_API}/forms/${encodeURIComponent(String(id))}`);
}

// Costs & fees
export function getCostSchedules(): Promise<CostSchedule[]> {
  return getJson<CostSchedule[]>(`${ROOT_API}/costs`);
}

// Compendium of Personal Injury Awards (quantum)
export function getCompendium(): Promise<CompendiumResponse> {
  return getJson<CompendiumResponse>(`${ROOT_API}/compendium`);
}

// Terminology (glossary)
export function getTerms(search?: string, letter?: string): Promise<GlossaryTerm[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (letter) params.set("letter", letter);
  const qs = params.toString();
  return getJson<GlossaryTerm[]>(`${ROOT_API}/terminology${qs ? `?${qs}` : ""}`);
}
export function getTerm(id: number | string): Promise<GlossaryTerm> {
  return getJson<GlossaryTerm>(`${ROOT_API}/terminology/${encodeURIComponent(String(id))}`);
}

// Practice directions & court circulars
export function getPracticeDirections(search?: string): Promise<PracticeDirection[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return getJson<PracticeDirection[]>(`${ROOT_API}/practice-directions${qs}`);
}

// Bar Council rules & rulings
export function getBarCouncilRulings(search?: string): Promise<BarCouncilRuling[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return getJson<BarCouncilRuling[]>(`${ROOT_API}/bar-council-rulings${qs}`);
}

// ─── Enforcement & Costs ─────────────────────────────────────────────────────
// Served by the shared API server at the ABSOLUTE root `/api/lit/enforcement`.
// `/methods` is open; `/advise` and `/bill-of-costs` are premium SSE streams.

export interface EnforcementMethod {
  id: string;
  name: string;
  shortName: string;
  basis: string;
  debtor: "individual" | "company" | "any";
  summary: string;
  targets: string;
  whenToUse: string[];
  prerequisites: string[];
  pros: string[];
  cons: string[];
  courtFee: string;
}

export interface CostsBasis {
  id: string;
  name: string;
  description: string;
}

export interface EnforcementDocumentType {
  id: string;
  name: string;
  basis: string;
  debtor: "individual" | "company" | "any";
  summary: string;
  produces: string;
  particularsHint: string;
}

export interface EnforcementMethodsResponse {
  methods: EnforcementMethod[];
  costsBases: CostsBasis[];
  documents: EnforcementDocumentType[];
}

export function getEnforcementMethods(): Promise<EnforcementMethodsResponse> {
  return getJson<EnforcementMethodsResponse>(`${ROOT_API}/enforcement/methods`);
}

export interface PlainStreamHandlers {
  onContent: (chunk: string) => void;
  onDone?: (disclaimer?: string) => void;
  onError?: (message: string) => void;
}

// Stream a plain `data: {content|done|error}` SSE from the shared API server.
// Used by the premium enforcement advisor and bill-of-costs drafters.
async function streamRootSSE(
  path: string,
  body: Record<string, unknown>,
  handlers: PlainStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${ROOT_API}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withProvider(body)),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    handlers.onError?.("Network error. Please try again.");
    return;
  }

  if (!res.ok || !res.body) {
    if (res.status === 401) {
      handlers.onError?.("Please sign in to use this tool.");
      return;
    }
    if (res.status === 402) {
      handlers.onError?.("A subscription is required for this tool.");
      return;
    }
    const msg = await res.json().catch(() => ({ error: res.statusText }));
    handlers.onError?.((msg as { error?: string }).error || `Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      for (const evt of events) {
        const line = evt.trim();
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        try {
          const data = JSON.parse(payload);
          if (data.error) {
            handlers.onError?.(data.error);
            continue;
          }
          if (typeof data.content === "string") handlers.onContent(data.content);
          if (data.done) handlers.onDone?.(data.disclaimer);
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      handlers.onError?.("Stream interrupted. Please try again.");
    }
  }
}

export interface EnforcementAdviseInput {
  debtorType: string;
  judgmentSum: string;
  judgmentDate: string;
  knownAssets: string;
  debtorProfile: string;
  priorSteps: string;
}

export function runEnforcementAdvise(
  input: EnforcementAdviseInput,
  handlers: PlainStreamHandlers,
): { cancel: () => void } {
  const controller = new AbortController();
  void streamRootSSE("/enforcement/advise", { ...input }, handlers, controller.signal);
  return { cancel: () => controller.abort() };
}

export interface BillOfCostsInput {
  court: string;
  suitNo: string;
  parties: string;
  basis: string;
  costsOrder: string;
  workDone: string;
  attendances: string;
  disbursements: string;
  counselFees: string;
}

export function runBillOfCosts(
  input: BillOfCostsInput,
  handlers: PlainStreamHandlers,
): { cancel: () => void } {
  const controller = new AbortController();
  void streamRootSSE("/enforcement/bill-of-costs", { ...input }, handlers, controller.signal);
  return { cancel: () => controller.abort() };
}

export interface DraftDocumentInput {
  documentType: string;
  court: string;
  suitNo: string;
  parties: string;
  judgmentSum: string;
  judgmentDate: string;
  debtorName: string;
  debtorAddress: string;
  debtorType: string;
  particulars: string;
}

export function runDraftDocument(
  input: DraftDocumentInput,
  handlers: PlainStreamHandlers,
): { cancel: () => void } {
  const controller = new AbortController();
  void streamRootSSE("/enforcement/draft-document", { ...input }, handlers, controller.signal);
  return { cancel: () => controller.abort() };
}

// ─── Client Vault ────────────────────────────────────────────────────────────
// The confidential, per-user vault. All endpoints require login; writes also
// require a subscription. Everything is scoped server-side by the access code.
const VAULT_API = `${ROOT_API}/clients`;

export interface VaultClient {
  id: number;
  name: string;
  reference: string | null;
  clientType: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultDocument {
  id: number;
  clientId: number;
  fileName: string;
  objectPath: string;
  contentType: string | null;
  sizeBytes: number | null;
  label: string | null;
  createdAt: string;
}

export interface VaultWork {
  id: number;
  title: string;
  kind: string;
  matter: string | null;
  clientId: number | null;
  updatedAt: string;
}

export interface VaultMatter {
  id: number;
  title: string;
  suitNo: string | null;
  clientId: number | null;
  updatedAt: string;
}

export interface VaultClientDetail extends VaultClient {
  documents: VaultDocument[];
  work: VaultWork[];
  matters: VaultMatter[];
}

export interface AssignableItems {
  work: VaultWork[];
  matters: VaultMatter[];
}

async function vaultRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${VAULT_API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (res.status === 401) message = "AUTH_REQUIRED";
    else if (res.status === 402) message = "SUBSCRIPTION_REQUIRED";
    else {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      message = (body as { error?: string }).error || message;
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listVaultClients(): Promise<VaultClient[]> {
  return vaultRequest<VaultClient[]>("");
}

export function getVaultClient(id: number): Promise<VaultClientDetail> {
  return vaultRequest<VaultClientDetail>(`/${id}`);
}

export type VaultClientInput = Partial<
  Pick<VaultClient, "name" | "reference" | "clientType" | "email" | "phone" | "address" | "notes">
>;

export function createVaultClient(input: VaultClientInput): Promise<VaultClient> {
  return vaultRequest<VaultClient>("", { method: "POST", body: JSON.stringify(input) });
}

export function updateVaultClient(id: number, input: VaultClientInput): Promise<VaultClient> {
  return vaultRequest<VaultClient>(`/${id}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function deleteVaultClient(id: number): Promise<{ success: boolean }> {
  return vaultRequest<{ success: boolean }>(`/${id}`, { method: "DELETE" });
}

export function getAssignableItems(): Promise<AssignableItems> {
  return vaultRequest<AssignableItems>("/assignable");
}

export function linkWorkToClient(workId: number, clientId: number | null): Promise<VaultWork> {
  return vaultRequest<VaultWork>(`/work/${workId}/client`, {
    method: "PATCH",
    body: JSON.stringify({ clientId }),
  });
}

export function linkMatterToClient(matterId: number, clientId: number | null): Promise<VaultMatter> {
  return vaultRequest<VaultMatter>(`/matters/${matterId}/client`, {
    method: "PATCH",
    body: JSON.stringify({ clientId }),
  });
}

export function deleteVaultDocument(docId: number): Promise<{ success: boolean }> {
  return vaultRequest<{ success: boolean }>(`/documents/${docId}`, { method: "DELETE" });
}

export function vaultDocumentDownloadUrl(docId: number): string {
  return `${VAULT_API}/documents/${docId}/download`;
}

// Upload a file to a client: ask for a presigned URL, PUT the bytes straight to
// object storage, then record the metadata. Returns the new document row.
export async function uploadVaultDocument(
  clientId: number,
  file: File,
  label?: string,
): Promise<VaultDocument> {
  const { uploadURL } = await vaultRequest<{ uploadURL: string }>(
    `/${clientId}/documents/upload-url`,
    { method: "POST", body: JSON.stringify({ fileName: file.name }) },
  );
  const put = await fetch(uploadURL, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error("Could not upload the file. Please try again.");
  return vaultRequest<VaultDocument>(`/${clientId}/documents`, {
    method: "POST",
    body: JSON.stringify({
      uploadURL,
      fileName: file.name,
      contentType: file.type || null,
      sizeBytes: file.size,
      label: label || null,
    }),
  });
}

// Persist a piece of generated work (analysis / draft / reply) into the vault,
// optionally filed under a client. Mirrors POST /saved-work on the API server.
export interface SaveWorkInput {
  kind: string;
  title: string;
  content: string;
  matter?: string | null;
  clientId?: number | null;
  matterId?: number | null;
}

export async function saveWorkToVault(input: SaveWorkInput): Promise<VaultWork> {
  const res = await fetch(`${ROOT_API}/saved-work`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("AUTH_REQUIRED");
    if (res.status === 402) throw new Error("SUBSCRIPTION_REQUIRED");
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<VaultWork>;
}

// ─── Vault auth (login gate covers ONLY the vault) ───────────────────────────
const AUTH_API = `${ROOT_API}/auth`;

export async function vaultLogin(password: string): Promise<void> {
  const res = await fetch(`${AUTH_API}/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error || "Invalid access code");
  }
}

export async function vaultVerify(): Promise<boolean> {
  try {
    const res = await fetch(`${AUTH_API}/verify`, { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

export interface SsoLoginResult {
  success: boolean;
  needsLink?: boolean;
  error?: string;
}

// Microsoft SSO exchange. Posts the ticket (and optionally a one-time access code
// to link) to the shared /api/lit/sso endpoint. Returns needsLink when the
// Microsoft email hasn't been linked to an access code yet.
export async function vaultSsoLogin(ticket: string, code?: string): Promise<SsoLoginResult> {
  try {
    const res = await fetch(`${ROOT_API}/lit/auth/sso`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(code ? { ticket, code } : { ticket }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && (data as { success?: boolean }).success) {
      return { success: true };
    }
    if (res.status === 404 && (data as { needsLink?: boolean }).needsLink) {
      return { success: false, needsLink: true };
    }
    return {
      success: false,
      error: (data as { error?: string }).error || "Microsoft sign-in failed. Please try again.",
    };
  } catch {
    return { success: false, error: "Network error. Please try again." };
  }
}

export async function vaultLogout(): Promise<boolean> {
  try {
    const res = await fetch(`${AUTH_API}/logout`, { method: "POST", credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Authenticated JSON helper (session-cookie; writes need a subscription) ───
// Mirrors vaultRequest but for the other shared, login-gated resources (matters,
// bundles, deadline diary). Surfaces AUTH_REQUIRED / SUBSCRIPTION_REQUIRED so
// pages can show an inline sign-in / upgrade prompt instead of a raw error.
async function authedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ROOT_API}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    if (res.status === 401) message = "AUTH_REQUIRED";
    else if (res.status === 402) message = "SUBSCRIPTION_REQUIRED";
    else {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      message = (body as { error?: string }).error || message;
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Matters (shared) — minimal client for linking & the deadline diary ──────
export interface Matter {
  id: number;
  title: string;
  clientName: string | null;
  actingFor: string | null;
  plaintiff: string | null;
  defendant: string | null;
  matterType: string | null;
  court: string | null;
  suitNo: string | null;
  claimAmount: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function listMatters(): Promise<Matter[]> {
  return authedRequest<Matter[]>("/matters");
}

export interface UpcomingDeadline {
  id: number;
  matterId: number;
  title: string;
  dueDate: string;
  category: string | null;
  status: string;
  basis: string | null;
  notes: string | null;
  matterTitle: string;
  suitNo: string | null;
}

export function getUpcomingDeadlines(days = 60): Promise<UpcomingDeadline[]> {
  return authedRequest<UpcomingDeadline[]>(
    `/matters/deadlines/upcoming?days=${encodeURIComponent(String(days))}`,
  );
}

export interface DeadlineInput {
  title: string;
  dueDate: string;
  category?: string;
  basis?: string;
  notes?: string;
}

export function addDeadlinesBulk(
  matterId: number,
  deadlines: DeadlineInput[],
): Promise<unknown> {
  return authedRequest(`/matters/${matterId}/deadlines/bulk`, {
    method: "POST",
    body: JSON.stringify({ deadlines }),
  });
}

// ─── Affidavits & supporting documents ───────────────────────────────────────
export interface AffidavitField {
  key: string;
  label: string;
  long?: boolean;
  placeholder?: string;
}

export interface AffidavitType {
  id: string;
  name: string;
  category: "affidavit" | "supporting";
  basis: string;
  description: string;
  whenToUse: string;
  hasExhibits: boolean;
  caveats: string[];
}

export interface AffidavitTypesResponse {
  types: AffidavitType[];
  fields: AffidavitField[];
}

export function getAffidavitTypes(): Promise<AffidavitTypesResponse> {
  return getJson<AffidavitTypesResponse>(`${ROOT_API}/affidavits/types`);
}

export interface AffidavitDraftInput {
  typeId: string;
  court: string;
  parties: string;
  deponent: string;
  context: string;
  facts: string;
  exhibits: string;
  additionalDetails: string;
}

export function runAffidavitDraft(
  input: AffidavitDraftInput,
  handlers: PlainStreamHandlers,
): { cancel: () => void } {
  const controller = new AbortController();
  void streamRootSSE("/affidavits/draft", { ...input }, handlers, controller.signal);
  return { cancel: () => controller.abort() };
}

// ─── Appeals & jurisdiction ──────────────────────────────────────────────────
export interface ForumTier {
  id: "magistrates" | "sessions" | "high-court";
  name: string;
  statute: string;
  min: number | null;
  max: number | null;
  scope: string;
}

export interface ForumResult {
  amount: number;
  forum: ForumTier;
  rationale: string;
  note: string;
}

export interface AppealCausePaper {
  id: string;
  name: string;
  basis: string;
  description: string;
}

export interface AppealStep {
  label: string;
  offsetDays: number;
  category: string;
  basis: string;
  notes?: string;
}

export interface AppealPathway {
  id: string;
  name: string;
  shortName: string;
  fromForum: string;
  toForum: string;
  summary: string;
  leaveRequired: boolean;
  leaveNote: string;
  prerequisites: string[];
  causePapers: AppealCausePaper[];
  anchorLabel: string;
  timeline: AppealStep[];
  caveats: string[];
}

export interface AppealPathwaysResponse {
  pathways: AppealPathway[];
  forumTiers: ForumTier[];
}

export function getAppealPathways(): Promise<AppealPathwaysResponse> {
  return getJson<AppealPathwaysResponse>(`${ROOT_API}/appeals/pathways`);
}

export function getForumRoute(amount: number): Promise<ForumResult> {
  return getJson<ForumResult>(
    `${ROOT_API}/appeals/forum?amount=${encodeURIComponent(String(amount))}`,
  );
}

export interface AppealDraftInput {
  pathwayId: string;
  causePaperId: string;
  court: string;
  parties: string;
  decision: string;
  grounds: string;
  questionsOfLaw: string;
  additionalDetails: string;
}

export function runAppealDraft(
  input: AppealDraftInput,
  handlers: PlainStreamHandlers,
): { cancel: () => void } {
  const controller = new AbortController();
  void streamRootSSE("/appeals/draft", { ...input }, handlers, controller.signal);
  return { cancel: () => controller.abort() };
}

// ─── Oral advocacy practice (all premium) ────────────────────────────────────
export type OralScenario =
  | "oral_submission"
  | "examination_in_chief"
  | "cross_examination"
  | "negotiation";

export interface OralTurn {
  speaker: "them" | "me";
  text: string;
}

export interface OralRespondInput {
  scenario: OralScenario;
  caseContext: string;
  userRole: string;
  witness: string;
  history: OralTurn[];
  userTurn: string;
}

export function runOralRespond(
  input: OralRespondInput,
  handlers: PlainStreamHandlers,
): { cancel: () => void } {
  const controller = new AbortController();
  void streamRootSSE("/oral/respond", { ...input }, handlers, controller.signal);
  return { cancel: () => controller.abort() };
}

// Synthesise a persona's spoken turn to mp3. The voice is chosen server-side
// from the scenario. Throws AUTH_REQUIRED / SUBSCRIPTION_REQUIRED like the rest.
export async function oralTts(text: string, scenario: OralScenario): Promise<Blob> {
  const res = await fetch(`${ROOT_API}/oral/tts`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, scenario }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("AUTH_REQUIRED");
    if (res.status === 402) throw new Error("SUBSCRIPTION_REQUIRED");
    throw new Error("Text-to-speech failed. Please try again.");
  }
  return res.blob();
}

// ─── Document bundles ────────────────────────────────────────────────────────
export interface BundleTypeOption {
  id: string;
  name: string;
}

export interface BundleTypesResponse {
  bundleTypes: BundleTypeOption[];
  docTypes: string[];
}

export function getBundleTypes(): Promise<BundleTypesResponse> {
  return getJson<BundleTypesResponse>(`${ROOT_API}/bundles/types`);
}

export interface Bundle {
  id: number;
  title: string;
  bundleType: string | null;
  court: string | null;
  suitNo: string | null;
  parties: string | null;
  notes: string | null;
  startPage: number | null;
  matterId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BundleDoc {
  id: number;
  bundleId: number;
  title: string;
  section: string | null;
  docType: string | null;
  docDate: string | null;
  pageCount: number | null;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BundleIndexItem {
  tab: number;
  id: number;
  section: string | null;
  title: string;
  docType: string | null;
  docDate: string | null;
  pageCount: number;
  startPage: number;
  endPage: number;
  pageLabel: string;
}

export interface BundleIndex {
  items: BundleIndexItem[];
  totalPages: number;
  lastPage: number;
}

export interface BundleDetail extends Bundle {
  documents: BundleDoc[];
  index: BundleIndex;
}

export function listBundles(): Promise<Bundle[]> {
  return authedRequest<Bundle[]>("/bundles");
}

export function getBundle(id: number): Promise<BundleDetail> {
  return authedRequest<BundleDetail>(`/bundles/${id}`);
}

export interface BundleInput {
  title: string;
  bundleType?: string;
  court?: string;
  suitNo?: string;
  parties?: string;
  notes?: string;
  startPage?: number;
  matterId?: number | null;
}

export function createBundle(input: BundleInput): Promise<Bundle> {
  return authedRequest<Bundle>("/bundles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBundle(id: number, input: Partial<BundleInput>): Promise<Bundle> {
  return authedRequest<Bundle>(`/bundles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteBundle(id: number): Promise<{ success: boolean }> {
  return authedRequest<{ success: boolean }>(`/bundles/${id}`, { method: "DELETE" });
}

export interface BundleDocInput {
  title: string;
  section?: string;
  docType?: string;
  docDate?: string;
  pageCount?: number;
  sortOrder?: number;
}

export function addBundleDocument(id: number, input: BundleDocInput): Promise<BundleDoc> {
  return authedRequest<BundleDoc>(`/bundles/${id}/documents`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBundleDocument(
  id: number,
  docId: number,
  input: Partial<BundleDocInput>,
): Promise<BundleDoc> {
  return authedRequest<BundleDoc>(`/bundles/${id}/documents/${docId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteBundleDocument(
  id: number,
  docId: number,
): Promise<{ success: boolean }> {
  return authedRequest<{ success: boolean }>(`/bundles/${id}/documents/${docId}`, {
    method: "DELETE",
  });
}

export function reorderBundle(
  id: number,
  order: number[],
): Promise<{ documents: BundleDoc[]; index: BundleIndex }> {
  return authedRequest<{ documents: BundleDoc[]; index: BundleIndex }>(
    `/bundles/${id}/reorder`,
    { method: "POST", body: JSON.stringify({ order }) },
  );
}

// ─── Admin — access-code management (password header, not session) ────────────
export interface AccessCode {
  id: number;
  code: string;
  recipientName: string;
  recipientEmail: string;
  notes: string | null;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
}

export async function adminVerify(password: string): Promise<boolean> {
  try {
    const res = await fetch(`${ROOT_API}/admin/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listAccessCodes(password: string): Promise<AccessCode[]> {
  const res = await fetch(`${ROOT_API}/admin/codes`, {
    headers: { "x-admin-password": password },
  });
  if (!res.ok) throw new Error("Could not load access codes.");
  return res.json() as Promise<AccessCode[]>;
}

export interface GenerateCodesInput {
  recipientName: string;
  recipientEmail: string;
  notes?: string;
  expiresAt?: string;
  count: number;
}

export interface GenerateCodesResult {
  success: boolean;
  codes: string[];
  count: number;
  emailSent: boolean;
  emailError?: string;
}

export async function generateAccessCodes(
  password: string,
  input: GenerateCodesInput,
): Promise<GenerateCodesResult> {
  const res = await fetch(`${ROOT_API}/admin/codes/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-password": password },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to generate codes.");
  return data as GenerateCodesResult;
}

export async function revokeAccessCode(password: string, id: number): Promise<void> {
  const res = await fetch(`${ROOT_API}/admin/codes/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-password": password },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Could not revoke the code.");
}

export async function restoreAccessCode(password: string, id: number): Promise<void> {
  const res = await fetch(`${ROOT_API}/admin/codes/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-password": password },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error("Could not restore the code.");
}

// ─── AI provider (admin default) ──────────────────────────────────────────────
export interface AiProviderStatus {
  provider: AIProvider;
  openaiConfigured: boolean;
}

/** Public: read the admin-selected default provider + whether OpenAI is usable. */
export async function getAdminAiProvider(): Promise<AiProviderStatus> {
  const res = await fetch(`${ROOT_API}/admin/ai-provider`);
  if (!res.ok) throw new Error("Could not load the AI provider setting.");
  return res.json() as Promise<AiProviderStatus>;
}

/** Admin-only: change the default provider for the IRAC tools. */
export async function setAdminAiProvider(
  password: string,
  provider: AIProvider,
): Promise<AIProvider> {
  const res = await fetch(`${ROOT_API}/admin/ai-provider`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-password": password },
    body: JSON.stringify({ provider }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Never surface raw backend error text — it can name the underlying AI
    // provider/API. Map to neutral, persona-safe wording for the user.
    if (res.status === 401) throw new Error("Incorrect admin password.");
    throw new Error("That paralegal is currently unavailable. Please choose the other paralegal.");
  }
  return (data as { provider: AIProvider }).provider;
}
