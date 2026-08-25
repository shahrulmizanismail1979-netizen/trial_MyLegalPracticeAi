/**
 * @workspace/case-home-ui
 *
 * Shared Case Home panel for all practice portals (Task #137).
 *
 * Exports:
 *   <CaseHomePanel matterId={n} request={...} accent="#2563eb" />
 *
 * `request(path, init?)` must perform an authenticated fetch against the
 * portal's matters API base (e.g. path "/12/case-home" →
 * GET /api/<portal>/matters/12/case-home) and return the raw Response.
 *
 * Data endpoints consumed:
 *   GET    /<matterId>/case-home   — full case home snapshot
 *   POST   /<matterId>/tasks       — create task
 *   PATCH  /<matterId>/tasks/:id   — update task (status, assignee, etc.)
 *   DELETE /<matterId>/tasks/:id   — delete task
 *
 * This component mirrors the server contract in
 *   artifacts/api-server/src/lib/caseHome.ts
 *   artifacts/api-server/src/lib/caseTasks.ts
 * Task status = open | in_progress | done | cancelled
 * Task priority = low | medium | high
 *
 * Theming: the UI is built entirely on host CSS variables (--ch-* with robust
 * fallbacks that read common shadcn/portal tokens), so it works in both light
 * and dark portal shells without hard-coded white/black surfaces. Pass `accent`
 * to override the primary colour.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ─── Exported types ────────────────────────────────────────────────────────────

export type CaseHomeRequest = (path: string, init?: RequestInit) => Promise<Response>;

export interface CaseCorpusStatus {
  driveDocuments: number;
  verifiedJudgments: number;
  indexedJudgments: number;
  searchableJudgments: number;
  inventoryCompletedAt: string | null;
}

/**
 * A compact, app-wide indicator of the research corpus. Consumers mount it
 * beside their root router so the same live number is present on every screen.
 * The API distinguishes catalogued Drive files from judgments so the UI never
 * presents document uploads as customer-searchable cases.
 */
export function CaseCorpusStatus({
  variant = "floating",
}: {
  /** Use inline on a landing/dashboard section; floating is for portal shells. */
  variant?: "floating" | "inline";
}) {
  const [status, setStatus] = useState<CaseCorpusStatus | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void fetch("/api/cases/status", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Unable to load case-law corpus status");
        return (await res.json()) as CaseCorpusStatus;
      })
      .then((next) => setStatus(next))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setStatus(null);
        }
      });

    return () => controller.abort();
  }, []);

  if (!status) return null;

  const number = new Intl.NumberFormat("en-MY");
  const refreshed = status.inventoryCompletedAt
    ? new Intl.DateTimeFormat("en-MY", { dateStyle: "medium" }).format(
        new Date(status.inventoryCompletedAt),
      )
    : null;
  return (
    <aside
      aria-label="Research corpus status"
      data-testid="case-corpus-status"
      title={`${number.format(status.driveDocuments)} Google Drive documents catalogued. ${number.format(status.searchableJudgments)} judgments are currently published to customer search.`}
      style={{
        position: variant === "floating" ? "fixed" : "relative",
        left: variant === "floating" ? 12 : undefined,
        bottom: variant === "floating" ? 12 : undefined,
        zIndex: variant === "floating" ? 40 : undefined,
        pointerEvents: "none",
        maxWidth: variant === "floating" ? "calc(100vw - 24px)" : 540,
        padding: "7px 10px",
        borderRadius: 9,
        background: "var(--background, #ffffff)",
        border: "1px solid color-mix(in srgb, var(--border, #d1d5db) 88%, transparent)",
        boxShadow: "0 6px 20px rgba(15, 23, 42, 0.13)",
        color: "var(--foreground, #111827)",
        fontSize: 11,
        lineHeight: 1.35,
      }}
    >
      <strong style={{ display: "block", fontSize: 11 }}>Research corpus status</strong>
      <span>
        {number.format(status.verifiedJudgments)} verified judgments · {number.format(status.indexedJudgments)} indexed
      </span>
      <span style={{ display: "block", color: "var(--muted-foreground, #64748b)" }}>
        {number.format(status.driveDocuments)} Drive documents catalogued · {number.format(status.searchableJudgments)} published
      </span>
      {refreshed && (
        <span style={{ display: "block", marginTop: 3, color: "var(--muted-foreground, #64748b)" }}>
          Source inventory last completed {refreshed}
        </span>
      )}
    </aside>
  );
}

export type TaskStatus = "open" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high";

/** A per-matter task as returned by the case_tasks table. */
export interface CaseTask {
  id: number;
  title: string;
  assignee: string | null;
  due_date: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  note: string | null;
  created_at: string;
  updated_at?: string;
}

/** A unified, newest-first timeline entry (see caseHome.ts TimelineEntry). */
export interface CaseTimelineEntry {
  /** ISO timestamp sort key */
  ts: string;
  kind: string;
  title: string;
  description?: string | null;
  source?: string | null;
  /** Provenance for filed AI work */
  tool?: string | null;
  /** Originating feature/table */
  origin: "event" | "stage" | "deadline" | "task" | "saved-work" | "document" | string;
  meta?: Record<string, unknown> | null;
}

export interface CaseNextDeadline {
  title: string;
  due_date: string;
  status: string;
}

export type CaseNextAction =
  | { source: "task"; label: string; reason: "overdue" | "high" | "open"; taskId: number }
  | { source: "deadline"; label: string; due_date: string }
  | { source: "checklist"; label: string }
  | { source: "stage"; label: string };

export interface CaseLatestActivity {
  title: string;
  kind: string;
  event_date: string;
  created_at: string;
}

export interface CasePerson {
  id: number | string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  ic_number?: string | null;
  role?: string | null;
  [k: string]: unknown;
}

export interface CaseDocument {
  id: number | string;
  file_name: string;
  content_type?: string | null;
  category?: string | null;
  doc_date?: string | null;
  size_bytes?: number | null;
  created_at?: string | null;
  [k: string]: unknown;
}

export interface CaseSavedWork {
  id: number | string;
  title: string;
  kind?: string | null;
  /** AI tool/model provenance */
  tool?: string | null;
  created_at?: string | null;
}

/** Full GET /:id/case-home response shape (superset — extra keys allowed). */
export interface CaseHomeSummary {
  matter: Record<string, unknown>;
  stages?: string[];
  currentStage?: string | null;
  stageIndex?: number;
  stageCount?: number;
  nextDeadline?: CaseNextDeadline | null;
  outstandingTasks?: CaseTask[];
  tasks?: CaseTask[];
  latestActivity?: CaseLatestActivity | null;
  people?: CasePerson[];
  documents?: CaseDocument[];
  savedWork?: CaseSavedWork[];
  timeline?: CaseTimelineEntry[];
  nextAction?: CaseNextAction | null;
  [k: string]: unknown;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function jsonOrThrow(res: Response): Promise<unknown> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  return body;
}

/**
 * Read the host Vite artifact base path (import.meta.env.BASE_URL).
 *
 * Each portal is served under its own base (e.g. "/myccblitai/"), which Vite
 * injects at build time as import.meta.env.BASE_URL. In dev preview this is
 * usually "/", in production base-path builds it is "/<slug>/". We read it
 * defensively (this lib doesn't depend on vite/client types) and fall back to
 * "/" if unavailable (e.g. SSR / test environments).
 */
function hostBaseUrl(): string {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    const base = env?.BASE_URL;
    if (typeof base === "string" && base.length > 0) return base;
  } catch {
    // import.meta.env not available in this environment
  }
  return "/";
}

/**
 * Resolve an app-internal href against the host artifact base path so links
 * stay inside the portal (e.g. under "/myccblitai/") instead of escaping to the
 * root landing page.
 *
 * Left UNCHANGED (returned verbatim):
 *   - empty/whitespace-only values
 *   - fully-qualified URLs (http:, https:, and any other scheme like
 *     mailto:, tel:, data:, blob:, ftp:) — detected via a scheme prefix
 *   - protocol-relative URLs ("//host/…")
 *   - pure hash ("#…") and query ("?…") fragments
 *   - relative hrefs that do not start with "/" (already resolve against the
 *     current document, which is base-aware)
 *   - hrefs already prefixed with the base (avoids double-prefixing)
 *
 * Only ROOT-RELATIVE hrefs ("/foo") are rewritten to "<base>foo".
 *
 * This is a pure function: pass `base` explicitly for deterministic testing;
 * it defaults to the host Vite base at call time.
 */
export function resolveActionHref(href: string, base: string = hostBaseUrl()): string {
  if (typeof href !== "string") return href;
  const raw = href.trim();
  if (raw === "") return href;

  // Fully-qualified (scheme://…) or any scheme (mailto:, tel:, data:, etc.),
  // and protocol-relative ("//host").
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(raw) || raw.startsWith("//")) return href;

  // In-page fragments / bare queries resolve against the current URL already.
  if (raw.startsWith("#") || raw.startsWith("?")) return href;

  // Only root-relative paths need rebasing.
  if (!raw.startsWith("/")) return href;

  // Normalize base to a trailing "/" (Vite BASE_URL usually already ends in one).
  const normalizedBase = base === "" ? "/" : base.endsWith("/") ? base : `${base}/`;

  // Root base ("/") never needs prefixing.
  if (normalizedBase === "/") return href;

  // Avoid double-prefixing when the href already lives under the base.
  const baseNoSlash = normalizedBase.slice(0, -1); // e.g. "/myccblitai"
  if (raw === baseNoSlash || raw === normalizedBase || raw.startsWith(normalizedBase)) {
    return href;
  }

  // Rewrite "/foo" → "<base>foo" (base has trailing slash; strip the leading
  // slash of the href so we don't produce "//").
  return normalizedBase + raw.slice(1);
}

const asStr = (v: unknown): string | null =>
  v == null ? null : typeof v === "string" ? v : String(v);

/** Read the first present key from an object, tolerant of camel/snake case. */
function pick(obj: Record<string, unknown> | null | undefined, ...keys: string[]): unknown {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] != null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

const d10 = (v: unknown): string => {
  const s = asStr(v);
  if (!s) return "—";
  const iso = s.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

const today = (): string => new Date().toISOString().slice(0, 10);

function daysUntil(v: unknown): number | null {
  const s = asStr(v);
  if (!s) return null;
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function fmtRelative(v: unknown): string {
  const s = asStr(v);
  if (!s) return "—";
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return d10(s);
  const secs = Math.round((Date.now() - t) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  const days = Math.floor(secs / 86400);
  if (days < 30) return `${days}d ago`;
  return d10(s);
}

function fmtBytes(v: unknown): string | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── Defensive normalizers (camelCase/snake_case tolerant) ────────────────────

function normPerson(p: Record<string, unknown>, i: number): CasePerson {
  return {
    id: (pick(p, "id") as number | string) ?? i,
    name:
      (asStr(pick(p, "name", "full_name", "fullName", "client_name", "clientName")) ??
        asStr(pick(p, "company_name", "companyName")) ??
        "Unnamed"),
    role: asStr(pick(p, "role", "relationship", "type")),
    email: asStr(pick(p, "email")),
    phone: asStr(pick(p, "phone", "phone_number", "phoneNumber")),
    company_name: asStr(pick(p, "company_name", "companyName")),
    ic_number: asStr(pick(p, "ic_number", "icNumber")),
  };
}

function normDocument(d: Record<string, unknown>, i: number): CaseDocument {
  return {
    id: (pick(d, "id") as number | string) ?? i,
    file_name:
      asStr(pick(d, "file_name", "fileName", "title", "name")) ?? "Untitled document",
    content_type: asStr(pick(d, "content_type", "contentType", "mime_type", "mimeType")),
    category: asStr(pick(d, "category", "kind")),
    doc_date: asStr(pick(d, "doc_date", "docDate")),
    size_bytes: (pick(d, "size_bytes", "sizeBytes", "size") as number | null) ?? null,
    created_at: asStr(pick(d, "created_at", "createdAt", "uploaded_at", "uploadedAt")),
  };
}

function normTask(t: Record<string, unknown>): CaseTask {
  const rawStatus = asStr(pick(t, "status")) ?? "open";
  const status: TaskStatus = (["open", "in_progress", "done", "cancelled"] as const).includes(
    rawStatus as TaskStatus,
  )
    ? (rawStatus as TaskStatus)
    : "open";
  const rawPriority = asStr(pick(t, "priority")) ?? "medium";
  const priority: TaskPriority = (["low", "medium", "high"] as const).includes(
    rawPriority as TaskPriority,
  )
    ? (rawPriority as TaskPriority)
    : "medium";
  const due = pick(t, "due_date", "dueDate");
  return {
    id: pick(t, "id") as number,
    title: asStr(pick(t, "title")) ?? "Untitled task",
    assignee: asStr(pick(t, "assignee")),
    due_date: due != null ? asStr(due)!.slice(0, 10) : null,
    priority,
    status,
    note: asStr(pick(t, "note", "notes")),
    created_at: asStr(pick(t, "created_at", "createdAt")) ?? new Date(0).toISOString(),
    updated_at: asStr(pick(t, "updated_at", "updatedAt")) ?? undefined,
  };
}

/** A timeline entry is AI-derived if it carries a provenance tool. */
function isAiEntry(e: CaseTimelineEntry): boolean {
  return Boolean(e.tool) || e.origin === "saved-work" || e.kind === "saved-work";
}

// ─── Theme-safe scoped CSS (injected once) ────────────────────────────────────

const CSS_ID = "case-home-ui-styles";

/*
 * All colours resolve through --ch-* variables, each with a fallback chain that
 * first tries common shadcn/portal HSL tokens, then a neutral literal. Because
 * shadcn tokens are space-separated HSL triples, they are wrapped in hsl(...).
 * If a host doesn't define them the literal fallback keeps contrast sane in both
 * light and dark shells.
 */
const CSS = `
.ch-root{
  --ch-accent-fallback: hsl(var(--primary, 221 83% 53%));
  --ch-accent: var(--ch-accent-override, var(--ch-accent-fallback));
  --ch-fg: var(--ch-fg-override, hsl(var(--foreground, 222 47% 11%)));
  --ch-muted: var(--ch-muted-override, hsl(var(--muted-foreground, 215 16% 47%)));
  --ch-surface: var(--ch-surface-override, hsl(var(--card, 0 0% 100%)));
  --ch-surface-2: var(--ch-surface-2-override, hsl(var(--muted, 210 40% 96%)));
  --ch-border: var(--ch-border-override, hsl(var(--border, 214 32% 91%)));
  --ch-danger: var(--ch-danger-override, hsl(var(--destructive, 0 72% 51%)));
  --ch-on-accent: var(--ch-on-accent-override, hsl(var(--primary-foreground, 0 0% 100%)));
  --ch-ai: var(--ch-ai-override, #8b5cf6);
  color: var(--ch-fg);
  font-family: inherit;
  font-size: 14px;
  background: transparent;
  container-type: inline-size;
}
.ch-root *{box-sizing:border-box;}
.ch-grid{display:grid;grid-template-columns:1fr;gap:14px;}
@media(min-width:640px){.ch-grid{grid-template-columns:1fr 1fr;}}
@media(min-width:1024px){.ch-grid{grid-template-columns:1fr 1fr 1fr;}}
.ch-card{
  background: var(--ch-surface);
  border: 1px solid var(--ch-border);
  border-radius: 10px;
  padding: 16px;
}
.ch-card-full{grid-column:1/-1;}
.ch-section-title{
  font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;
  color:var(--ch-muted);margin:0 0 10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;
}
.ch-stage-badge{
  display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:999px;
  font-size:13px;font-weight:700;color:var(--ch-on-accent);background:var(--ch-accent);
}
.ch-count-badge{
  background:var(--ch-accent);color:var(--ch-on-accent);border-radius:999px;
  font-size:11px;font-weight:700;padding:1px 8px;
}
.ch-title{margin:0;font-size:18px;font-weight:700;color:var(--ch-fg);}
.ch-sub{font-size:13px;color:var(--ch-muted);margin-top:2px;}
.ch-eyebrow{font-size:11px;color:var(--ch-muted);margin-bottom:4px;}
.ch-kv{display:flex;flex-direction:column;gap:8px;}
.ch-kv-row{display:flex;gap:8px;align-items:flex-start;}
.ch-kv-label{flex:0 0 130px;font-size:12px;color:var(--ch-muted);padding-top:2px;}
.ch-kv-val{flex:1;font-size:13px;color:var(--ch-fg);font-weight:500;}
.ch-deadline-soon{color:#c2760a;font-weight:700;}
.ch-deadline-overdue{color:var(--ch-danger);font-weight:700;}
.ch-task-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px;}
.ch-task-item{
  display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:8px;
  background:var(--ch-surface-2);border:1px solid var(--ch-border);
}
.ch-task-check{flex:0 0 18px;width:18px;height:18px;margin-top:2px;cursor:pointer;accent-color:var(--ch-accent);}
.ch-task-body{flex:1;min-width:0;}
.ch-task-title{font-size:13px;font-weight:600;color:var(--ch-fg);overflow-wrap:anywhere;}
.ch-task-title.done{text-decoration:line-through;color:var(--ch-muted);}
.ch-task-meta{font-size:11px;color:var(--ch-muted);margin-top:2px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;}
.ch-task-actions{display:flex;gap:4px;align-items:center;margin-left:auto;flex-shrink:0;}
.ch-badge{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;font-weight:700;line-height:1.5;}
.ch-pri-low{background:color-mix(in srgb, #16a34a 18%, transparent);color:#15803d;}
.ch-pri-medium{background:color-mix(in srgb, #ca8a04 20%, transparent);color:#a16207;}
.ch-pri-high{background:color-mix(in srgb, #dc2626 18%, transparent);color:#b91c1c;}
.ch-st-open{background:var(--ch-surface-2);color:var(--ch-muted);border:1px solid var(--ch-border);}
.ch-st-in_progress{background:color-mix(in srgb, #2563eb 18%, transparent);color:#1d4ed8;}
.ch-st-done{background:color-mix(in srgb, #16a34a 18%, transparent);color:#15803d;}
.ch-st-cancelled{background:var(--ch-surface-2);color:var(--ch-muted);border:1px solid var(--ch-border);}
.ch-tl-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;}
.ch-tl-item{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--ch-border);}
.ch-tl-item:last-child{border-bottom:none;}
.ch-tl-dot{flex:0 0 10px;width:10px;height:10px;border-radius:50%;margin-top:4px;background:var(--ch-muted);}
.ch-tl-dot-ai{background:var(--ch-ai);}
.ch-tl-dot-task{background:var(--ch-accent);}
.ch-tl-dot-document{background:#0891b2;}
.ch-tl-dot-stage{background:#d97706;}
.ch-tl-dot-deadline{background:var(--ch-danger);}
.ch-tl-body{flex:1;min-width:0;}
.ch-tl-title{font-size:13px;color:var(--ch-fg);font-weight:500;overflow-wrap:anywhere;}
.ch-tl-desc{font-size:12px;color:var(--ch-muted);margin-top:2px;overflow-wrap:anywhere;}
.ch-tl-meta{font-size:11px;color:var(--ch-muted);margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.ch-ai-label{
  display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;
  color:var(--ch-ai);background:color-mix(in srgb, var(--ch-ai) 14%, transparent);
  border:1px solid color-mix(in srgb, var(--ch-ai) 45%, transparent);border-radius:4px;padding:1px 5px;
}
.ch-person-list{display:flex;flex-direction:column;gap:8px;}
.ch-person-item{display:flex;gap:10px;align-items:center;}
.ch-avatar{
  width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:12px;font-weight:700;color:var(--ch-on-accent);background:var(--ch-accent);flex:0 0 32px;
}
.ch-person-info{min-width:0;}
.ch-person-name{font-size:13px;font-weight:600;color:var(--ch-fg);}
.ch-person-role{font-size:11px;color:var(--ch-muted);overflow-wrap:anywhere;}
.ch-doc-list,.ch-sw-list{display:flex;flex-direction:column;gap:6px;}
.ch-doc-item{
  display:flex;gap:8px;align-items:flex-start;padding:6px 8px;border-radius:7px;
  background:var(--ch-surface-2);border:1px solid var(--ch-border);
}
.ch-doc-icon{
  flex:0 0 26px;width:26px;height:26px;border-radius:5px;display:flex;align-items:center;justify-content:center;
  font-size:10px;font-weight:700;color:#fff;background:#0891b2;
}
.ch-doc-body{flex:1;min-width:0;}
.ch-doc-title{font-size:13px;font-weight:600;color:var(--ch-fg);overflow-wrap:anywhere;}
.ch-doc-meta{font-size:11px;color:var(--ch-muted);margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;}
.ch-form{display:flex;flex-direction:column;gap:10px;margin-top:12px;}
.ch-form-row{display:flex;gap:8px;flex-wrap:wrap;}
.ch-form-group{display:flex;flex-direction:column;gap:4px;flex:1 1 140px;}
.ch-label{font-size:12px;font-weight:600;color:var(--ch-fg);}
.ch-input,.ch-select,.ch-textarea{
  padding:7px 10px;border:1px solid var(--ch-border);border-radius:7px;font-size:13px;
  outline:none;background:var(--ch-surface);color:var(--ch-fg);width:100%;font-family:inherit;
}
.ch-textarea{resize:vertical;min-height:56px;}
.ch-input:focus,.ch-select:focus,.ch-textarea:focus{
  border-color:var(--ch-accent);
  box-shadow:0 0 0 2px color-mix(in srgb, var(--ch-accent) 25%, transparent);
}
.ch-err{color:var(--ch-danger);font-size:12px;margin:4px 0;}
.ch-empty{color:var(--ch-muted);font-size:13px;padding:8px 0;}
.ch-loading{color:var(--ch-muted);font-size:13px;padding:24px;text-align:center;}
.ch-action-link{
  display:inline-flex;align-items:center;justify-content:center;padding:8px 16px;border-radius:7px;
  font-size:13px;font-weight:600;text-decoration:none;color:var(--ch-on-accent);background:var(--ch-accent);
}
.ch-btn{
  display:inline-flex;align-items:center;justify-content:center;padding:7px 14px;border-radius:7px;
  font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;font-family:inherit;
  transition:opacity .15s;
}
.ch-btn:disabled{opacity:.5;cursor:not-allowed;}
.ch-btn-primary{background:var(--ch-accent);color:var(--ch-on-accent);}
.ch-btn-ghost{background:var(--ch-surface);border-color:var(--ch-border);color:var(--ch-fg);}
.ch-btn-ghost:hover:not(:disabled){background:var(--ch-surface-2);}
.ch-btn-danger{background:var(--ch-surface);border-color:color-mix(in srgb, var(--ch-danger) 50%, transparent);color:var(--ch-danger);}
.ch-btn-danger:hover:not(:disabled){background:color-mix(in srgb, var(--ch-danger) 10%, transparent);}
.ch-btn-sm{padding:4px 10px;font-size:12px;}
.ch-toggle{
  background:none;border:none;cursor:pointer;font-size:12px;color:var(--ch-muted);
  display:inline-flex;align-items:center;gap:4px;padding:0;margin-top:10px;font-family:inherit;
}
.ch-toggle:hover{color:var(--ch-fg);}
`;

function injectStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(CSS_ID)) return;
  const style = document.createElement("style");
  style.id = CSS_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// ─── Small presentational components ──────────────────────────────────────────

function Btn({
  children,
  onClick,
  kind = "primary",
  disabled,
  small,
  type = "button",
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  small?: boolean;
  type?: "button" | "submit";
  ariaLabel?: string;
}) {
  const cls = [
    "ch-btn",
    kind === "ghost" ? "ch-btn-ghost" : kind === "danger" ? "ch-btn-danger" : "ch-btn-primary",
    small ? "ch-btn-sm" : "",
  ].join(" ");
  return (
    <button type={type} className={cls} onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);
  return <span className={`ch-badge ch-pri-${priority}`}>{label}</span>;
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const labels: Record<TaskStatus, string> = {
    open: "Open",
    in_progress: "In Progress",
    done: "Done",
    cancelled: "Cancelled",
  };
  return <span className={`ch-badge ch-st-${status}`}>{labels[status]}</span>;
}

function AiLabel({ tool, at }: { tool?: string | null; at?: unknown }) {
  const atStr = asStr(at);
  const title = ["Generated by AI", tool ? `Source tool: ${tool}` : null, atStr ? `Filed: ${d10(atStr)}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <span className="ch-ai-label" title={title}>
      ✦ AI{tool ? ` · ${tool}` : ""}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "?";
  return (
    <div className="ch-avatar" aria-hidden="true">
      {initials}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="ch-section-title">{children}</h3>;
}

function DeadlineText({ value, label }: { value: unknown; label?: boolean }) {
  const days = daysUntil(value);
  const cls = days === null ? "" : days < 0 ? "ch-deadline-overdue" : days <= 3 ? "ch-deadline-soon" : "";
  return (
    <span className={cls}>
      {label ? "Due " : ""}
      {d10(value)}
      {days !== null && (
        <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6 }}>
          {days < 0 ? `(${Math.abs(days)}d overdue)` : days === 0 ? "(today)" : `(in ${days}d)`}
        </span>
      )}
    </span>
  );
}

// ─── Create Task Form ─────────────────────────────────────────────────────────

function CreateTaskForm({
  matterId,
  request,
  onCreated,
}: {
  matterId: number;
  request: CaseHomeRequest;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>("open");
  const [note, setNote] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      // snake_case payload matches caseTasks.ts POST contract
      await request(`/${matterId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          assignee: assignee.trim() || null,
          due_date: dueDate || null,
          priority,
          status,
          note: note.trim() || null,
        }),
      }).then(jsonOrThrow);
      setTitle("");
      setAssignee("");
      setDueDate("");
      setPriority("medium");
      setStatus("open");
      setNote("");
      setOpen(false);
      onCreated();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to create task");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Btn onClick={() => setOpen((v) => !v)} small>
        {open ? "✕ Cancel" : "+ New Task"}
      </Btn>
      {open && (
        <form className="ch-form" onSubmit={handleSubmit} aria-label="Create new task">
          <div className="ch-form-group" style={{ flex: "1 1 100%" }}>
            <label className="ch-label" htmlFor="ch-task-title">
              Title <span aria-hidden="true" style={{ color: "var(--ch-danger)" }}>*</span>
            </label>
            <input
              id="ch-task-title"
              ref={titleRef}
              className="ch-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title…"
              required
              maxLength={500}
            />
          </div>

          <div className="ch-form-row">
            <div className="ch-form-group">
              <label className="ch-label" htmlFor="ch-task-assignee">
                Assignee
              </label>
              <input
                id="ch-task-assignee"
                className="ch-input"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Name or email"
                maxLength={200}
              />
            </div>
            <div className="ch-form-group">
              <label className="ch-label" htmlFor="ch-task-due">
                Due Date
              </label>
              <input
                id="ch-task-due"
                type="date"
                className="ch-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={today()}
              />
            </div>
          </div>

          <div className="ch-form-row">
            <div className="ch-form-group">
              <label className="ch-label" htmlFor="ch-task-priority">
                Priority
              </label>
              <select
                id="ch-task-priority"
                className="ch-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="ch-form-group">
              <label className="ch-label" htmlFor="ch-task-status">
                Status
              </label>
              <select
                id="ch-task-status"
                className="ch-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="ch-form-group" style={{ flex: "1 1 100%" }}>
            <label className="ch-label" htmlFor="ch-task-note">
              Note
            </label>
            <textarea
              id="ch-task-note"
              className="ch-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Short note (optional)…"
              maxLength={5000}
            />
          </div>

          {err && (
            <p className="ch-err" role="alert">
              {err}
            </p>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <Btn type="submit" disabled={busy || !title.trim()}>
              {busy ? "Saving…" : "Save Task"}
            </Btn>
            <Btn kind="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Btn>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Task row (with inline edit) ──────────────────────────────────────────────

function TaskRow({
  task,
  matterId,
  request,
  onChanged,
}: {
  task: CaseTask;
  matterId: number;
  request: CaseHomeRequest;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStatus, setEditStatus] = useState<TaskStatus>(task.status);
  const [editAssignee, setEditAssignee] = useState(task.assignee ?? "");
  const [editDue, setEditDue] = useState(task.due_date ?? "");
  const [editPriority, setEditPriority] = useState<TaskPriority>(task.priority);
  const [editNote, setEditNote] = useState(task.note ?? "");
  const [err, setErr] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onChanged();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed");
      setBusy(false);
    }
  };

  const patch = (body: Record<string, unknown>) =>
    request(`/${matterId}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(jsonOrThrow);

  const done = task.status === "done";

  const toggleComplete = () => run(() => patch({ status: done ? "open" : "done" }));

  const del = () => {
    if (typeof confirm === "function" && !confirm(`Delete task "${task.title}"?`)) return;
    run(() => request(`/${matterId}/tasks/${task.id}`, { method: "DELETE" }).then(jsonOrThrow));
  };

  const saveEdit = () =>
    run(async () => {
      await patch({
        status: editStatus,
        assignee: editAssignee.trim() || null,
        due_date: editDue || null,
        priority: editPriority,
        note: editNote.trim() || null,
      });
      setEditOpen(false);
    });

  return (
    <li className="ch-task-item">
      <input
        type="checkbox"
        className="ch-task-check"
        checked={done}
        onChange={toggleComplete}
        disabled={busy}
        aria-label={done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
      />
      <div className="ch-task-body">
        <div className={`ch-task-title${done ? " done" : ""}`}>{task.title}</div>
        <div className="ch-task-meta">
          {task.assignee && <span>{task.assignee}</span>}
          {task.due_date && <DeadlineText value={task.due_date} label />}
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
        {task.note && !editOpen && (
          <div style={{ fontSize: 12, color: "var(--ch-muted)", marginTop: 3, fontStyle: "italic" }}>
            {task.note}
          </div>
        )}
        {editOpen && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <select
                className="ch-select"
                style={{ flex: "1 1 130px" }}
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as TaskStatus)}
                aria-label="Status"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                className="ch-select"
                style={{ flex: "1 1 110px" }}
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                aria-label="Priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                type="date"
                className="ch-input"
                style={{ flex: "1 1 130px" }}
                value={editDue}
                onChange={(e) => setEditDue(e.target.value)}
                aria-label="Due date"
              />
              <input
                className="ch-input"
                style={{ flex: "1 1 130px" }}
                value={editAssignee}
                onChange={(e) => setEditAssignee(e.target.value)}
                placeholder="Assignee"
                aria-label="Assignee"
                maxLength={200}
              />
            </div>
            <textarea
              className="ch-textarea"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Note…"
              rows={2}
              aria-label="Note"
              maxLength={5000}
            />
            {err && (
              <p className="ch-err" role="alert">
                {err}
              </p>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              <Btn small disabled={busy} onClick={saveEdit}>
                {busy ? "Saving…" : "Save"}
              </Btn>
              <Btn small kind="ghost" onClick={() => setEditOpen(false)}>
                Cancel
              </Btn>
            </div>
          </div>
        )}
        {err && !editOpen && (
          <p className="ch-err" role="alert">
            {err}
          </p>
        )}
      </div>
      {!editOpen && (
        <div className="ch-task-actions">
          <Btn small kind="ghost" onClick={() => setEditOpen(true)} disabled={busy} ariaLabel="Edit task">
            Edit
          </Btn>
          <Btn small kind="danger" onClick={del} disabled={busy} ariaLabel="Delete task">
            Del
          </Btn>
        </div>
      )}
    </li>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ events }: { events: CaseTimelineEntry[] }) {
  const sorted = useMemo(
    () => [...events].sort((a, b) => String(b.ts).localeCompare(String(a.ts))),
    [events],
  );
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? sorted : sorted.slice(0, 12);

  if (sorted.length === 0) {
    return <p className="ch-empty">No activity recorded yet.</p>;
  }

  const dotClass = (e: CaseTimelineEntry): string => {
    if (isAiEntry(e)) return "ch-tl-dot ch-tl-dot-ai";
    if (e.origin === "task") return "ch-tl-dot ch-tl-dot-task";
    if (e.origin === "document") return "ch-tl-dot ch-tl-dot-document";
    if (e.origin === "stage") return "ch-tl-dot ch-tl-dot-stage";
    if (e.origin === "deadline") return "ch-tl-dot ch-tl-dot-deadline";
    return "ch-tl-dot";
  };

  return (
    <>
      <ul className="ch-tl-list" aria-label="Case timeline (newest first)">
        {visible.map((ev, i) => (
          <li key={`${ev.source ?? ev.origin}-${ev.ts}-${i}`} className="ch-tl-item">
            <span className={dotClass(ev)} aria-hidden="true" />
            <div className="ch-tl-body">
              <div className="ch-tl-title">{ev.title}</div>
              {ev.description && <div className="ch-tl-desc">{ev.description}</div>}
              <div className="ch-tl-meta">
                <span style={{ textTransform: "capitalize" }}>{ev.kind || ev.origin}</span>
                <time dateTime={String(ev.ts)}>{fmtRelative(ev.ts)}</time>
                {isAiEntry(ev) && <AiLabel tool={ev.tool ?? ev.source} at={ev.ts} />}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {sorted.length > 12 && (
        <button type="button" className="ch-toggle" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "▲ Show less" : `▼ Show all ${sorted.length} events`}
        </button>
      )}
    </>
  );
}

// ─── People / Documents / Saved work panels ───────────────────────────────────

function PeoplePanel({ people }: { people: CasePerson[] }) {
  if (people.length === 0) return <p className="ch-empty">No people linked.</p>;
  return (
    <div className="ch-person-list">
      {people.map((p, i) => {
        const detail = [p.role, p.company_name, p.email, p.phone].filter(Boolean).join(" · ");
        return (
          <div key={p.id ?? i} className="ch-person-item">
            <Avatar name={p.name} />
            <div className="ch-person-info">
              <div className="ch-person-name">{p.name}</div>
              {detail && <div className="ch-person-role">{detail}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocumentsPanel({ documents }: { documents: CaseDocument[] }) {
  if (documents.length === 0) return <p className="ch-empty">No documents attached.</p>;
  return (
    <div className="ch-doc-list">
      {documents.map((doc, i) => {
        const kindShort = (doc.category ?? doc.content_type ?? "DOC").replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase() || "DOC";
        const size = fmtBytes(doc.size_bytes);
        return (
          <div key={doc.id ?? i} className="ch-doc-item">
            <div className="ch-doc-icon" aria-hidden="true">
              {kindShort}
            </div>
            <div className="ch-doc-body">
              <div className="ch-doc-title">{doc.file_name}</div>
              <div className="ch-doc-meta">
                {doc.category && <span style={{ textTransform: "capitalize" }}>{doc.category}</span>}
                {(doc.doc_date || doc.created_at) && (
                  <time dateTime={String(doc.doc_date ?? doc.created_at)}>
                    {d10(doc.doc_date ?? doc.created_at)}
                  </time>
                )}
                {size && <span>{size}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SavedWorkPanel({ items }: { items: CaseSavedWork[] }) {
  if (items.length === 0) return <p className="ch-empty">No filed work yet.</p>;
  return (
    <div className="ch-sw-list">
      {items.map((sw, i) => (
        <div key={sw.id ?? i} className="ch-doc-item">
          <div className="ch-doc-icon" aria-hidden="true" style={{ background: "var(--ch-ai)" }}>
            ✦
          </div>
          <div className="ch-doc-body">
            <div className="ch-doc-title">{sw.title}</div>
            <div className="ch-doc-meta">
              {sw.kind && <span style={{ textTransform: "capitalize" }}>{sw.kind}</span>}
              {sw.created_at && <time dateTime={String(sw.created_at)}>{d10(sw.created_at)}</time>}
              <AiLabel tool={sw.tool} at={sw.created_at} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Overview card ────────────────────────────────────────────────────────────

function OverviewCard({
  data,
  action,
}: {
  data: CaseHomeSummary;
  action?: { label: string; href: string };
}) {
  const matter = data.matter ?? {};
  const ref = asStr(pick(matter, "reference", "ref", "matter_ref", "matterRef", "case_number", "caseNumber", "file_no", "fileNo"));
  const titleText =
    asStr(pick(matter, "title", "name", "matter_title", "matterTitle", "subject", "description")) ?? "Case Home";
  const client = asStr(pick(matter, "client_name", "clientName", "client"));
  const practiceArea = asStr(pick(matter, "practice_area", "practiceArea", "area", "category"));

  const currentStage = data.currentStage ?? asStr(pick(matter, "status", "stage"));
  const stages = data.stages ?? [];
  const stageIndex = typeof data.stageIndex === "number" ? data.stageIndex : -1;

  const nextAction = data.nextAction ?? null;
  const nextDeadline = data.nextDeadline ?? null;

  return (
    <div className="ch-card ch-card-full">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ minWidth: 0 }}>
          {(ref || practiceArea) && (
            <div className="ch-eyebrow">{[ref, practiceArea].filter(Boolean).join(" · ")}</div>
          )}
          <h2 className="ch-title">{titleText}</h2>
          {client && <div className="ch-sub">Client: {client}</div>}
        </div>
        {action && (
          <a className="ch-action-link" href={resolveActionHref(action.href)}>
            {action.label}
          </a>
        )}
      </div>

      {currentStage && (
        <div style={{ marginBottom: 12 }}>
          <div className="ch-eyebrow">
            Current Stage
            {stages.length > 0 && stageIndex >= 0 ? ` · step ${stageIndex + 1} of ${stages.length}` : ""}
          </div>
          <span className="ch-stage-badge">{currentStage}</span>
        </div>
      )}

      <div className="ch-kv">
        {nextAction && (
          <div className="ch-kv-row">
            <span className="ch-kv-label">Next Action</span>
            <span className="ch-kv-val">
              {nextAction.label}
              {nextAction.source === "task" && "reason" in nextAction && (
                <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6, color: "var(--ch-muted)" }}>
                  ({nextAction.reason === "overdue" ? "overdue task" : nextAction.reason === "high" ? "high priority" : "open task"})
                </span>
              )}
              {nextAction.source === "deadline" && "due_date" in nextAction && (
                <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6, color: "var(--ch-muted)" }}>
                  (due {d10(nextAction.due_date)})
                </span>
              )}
            </span>
          </div>
        )}
        {nextDeadline && (
          <div className="ch-kv-row">
            <span className="ch-kv-label">Next Deadline</span>
            <span className="ch-kv-val">
              <DeadlineText value={nextDeadline.due_date} /> — {nextDeadline.title}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main CaseHomePanel ───────────────────────────────────────────────────────

export interface CaseHomePanelProps {
  matterId: number;
  request: CaseHomeRequest;
  accent?: string;
  className?: string;
  action?: { label: string; href: string };
}

export function CaseHomePanel({ matterId, request, accent, className = "", action }: CaseHomePanelProps) {
  injectStyles();

  const [data, setData] = useState<CaseHomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const body = (await request(`/${matterId}/case-home`).then(jsonOrThrow)) as CaseHomeSummary;
      setData(body);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Failed to load case home");
    } finally {
      setLoading(false);
    }
  }, [request, matterId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // accent overrides only the accent token; everything else stays host-driven.
  const rootStyle = accent ? ({ ["--ch-accent-override" as string]: accent } as React.CSSProperties) : undefined;

  if (loading) {
    return (
      <div className={`ch-root ${className}`} style={rootStyle}>
        <div className="ch-loading" role="status" aria-live="polite">
          Loading case home…
        </div>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className={`ch-root ${className}`} style={rootStyle}>
        <div className="ch-card" style={{ textAlign: "center" }}>
          <p className="ch-err" role="alert">
            {err ?? "Failed to load case home"}
          </p>
          <Btn onClick={() => void reload()}>Retry</Btn>
        </div>
      </div>
    );
  }

  // Normalize collections defensively.
  const tasks = (data.tasks ?? []).map((t) => normTask(t as unknown as Record<string, unknown>));
  const people = (data.people ?? []).map((p, i) => normPerson(p as Record<string, unknown>, i));
  const documents = (data.documents ?? []).map((d, i) => normDocument(d as Record<string, unknown>, i));
  const savedWork = data.savedWork ?? [];
  const timeline = data.timeline ?? [];

  const outstanding = tasks.filter((t) => t.status === "open" || t.status === "in_progress");
  const closed = tasks.filter((t) => t.status === "done" || t.status === "cancelled");
  const orderedTasks = [...outstanding, ...closed];

  const aiInTimeline = timeline.some(isAiEntry);

  return (
    <div className={`ch-root ${className}`} style={rootStyle} aria-label={`Case home for matter ${matterId}`}>
      <div className="ch-grid">
        {/* Overview: stage, next action, next deadline */}
        <OverviewCard data={data} action={action} />

        {/* Outstanding tasks + create/edit */}
        <div className="ch-card ch-card-full">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <SectionTitle>
              Outstanding Tasks
              {outstanding.length > 0 && <span className="ch-count-badge">{outstanding.length}</span>}
            </SectionTitle>
            <CreateTaskForm matterId={matterId} request={request} onCreated={reload} />
          </div>

          {tasks.length === 0 ? (
            <p className="ch-empty">No tasks yet. Create the first one above.</p>
          ) : (
            <ul className="ch-task-list" aria-label="Tasks">
              {orderedTasks.map((task) => (
                <TaskRow key={task.id} task={task} matterId={matterId} request={request} onChanged={reload} />
              ))}
            </ul>
          )}
        </div>

        {/* People */}
        <div className="ch-card">
          <SectionTitle>People</SectionTitle>
          <PeoplePanel people={people} />
        </div>

        {/* Documents */}
        <div className="ch-card">
          <SectionTitle>Documents</SectionTitle>
          <DocumentsPanel documents={documents} />
        </div>

        {/* Filed / AI work */}
        <div className="ch-card">
          <SectionTitle>
            Filed Work
            {savedWork.length > 0 && <AiLabel />}
          </SectionTitle>
          <SavedWorkPanel items={savedWork} />
        </div>

        {/* Unified newest-first timeline */}
        <div className="ch-card ch-card-full">
          <SectionTitle>
            Latest Activity
            {aiInTimeline && (
              <span
                title="Some entries were created or filed by AI tools. Purple dot = AI provenance; hover the ✦ AI label for the source tool and time."
                style={{ fontSize: 10, color: "var(--ch-ai)", cursor: "help" }}
              >
                ✦ includes AI-filed items
              </span>
            )}
          </SectionTitle>
          <Timeline events={timeline} />
        </div>
      </div>
    </div>
  );
}
