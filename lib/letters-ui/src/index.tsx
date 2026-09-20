/**
 * Shared client letter writer & versioned drafts UI for all practice portals
 * (Task #194).
 *
 * Exports:
 *   <DraftsPanel request={...} matterId={n} accent="#8a6d2f" />
 *   <LetterWriter request={...} matterId={n} accent="#8a6d2f"
 *                 clientName="..." matterTitle="..." />
 *
 * `request(path, init?)` — same authenticated raw fetch pattern as vault-ui
 * and billing-ui, pointing at the portal's matters API base.
 *
 * Backend route paths (relative to API base):
 *   POST /letters/generate          — SSE stream
 *   GET  /letters/types
 *   GET  /drafts/list               — list + filter
 *   POST /drafts                    — create draft / new version
 *   GET  /drafts/:id
 *   GET  /drafts/:id/versions
 *   PATCH /drafts/:id
 *   DELETE /drafts/:id
 *   GET  /drafts/:id/export/pdf
 *   GET  /drafts/:id/export/docx
 *   GET  /:matterId/drafts
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";

export type LettersRequest = (path: string, init?: RequestInit) => Promise<Response>;

export interface DraftVersion {
  id: number;
  root_id: number;
  version_number: number;
  kind: "draft" | "letter";
  letter_type: string | null;
  language: string;
  title: string;
  content: string;
  notes: string | null;
  matter_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface LetterType {
  id: string;
  label: string;
}

const LETTER_TYPES_FALLBACK: LetterType[] = [
  { id: "status_update", label: "Status Update to Client" },
  { id: "fee_reminder", label: "Fee Reminder to Client" },
  { id: "request_documents", label: "Request for Documents from Client" },
  { id: "cover_letter_court", label: "Cover Letter to Court" },
  { id: "cover_letter_opponent", label: "Cover Letter to Opposing Counsel" },
  { id: "demand_letter", label: "Demand Letter" },
  { id: "settlement_offer", label: "Settlement Offer Letter" },
  { id: "engagement_letter", label: "Engagement / Retainer Letter" },
];

async function jsonOr<T>(r: Response, fallback: T): Promise<T> {
  try { return r.ok ? ((await r.json()) as T) : fallback; } catch { return fallback; }
}
async function expectJson(r: Response): Promise<any> {
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body?.error || `Request failed (${r.status})`);
  return body;
}

const box: React.CSSProperties = {
  border: "1px solid rgba(128,128,128,0.25)",
  borderRadius: 10,
  padding: 14,
  background: "rgba(128,128,128,0.04)",
};
const inp: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid rgba(128,128,128,0.35)",
  fontSize: 13,
  background: "transparent",
  color: "inherit",
  width: "100%",
  boxSizing: "border-box",
};
// The native dropdown list renders on the OS's default (light) surface, so
// options must carry an explicit readable colour. Without this they inherit the
// portal's near-white foreground and become invisible on dark themes (MyCrimAI).
const optStyle: React.CSSProperties = { background: "#ffffff", color: "#111827" };
const btn = (accent: string, secondary = false): React.CSSProperties => ({
  padding: "6px 14px",
  borderRadius: 7,
  border: secondary ? `1px solid ${accent}` : "none",
  background: secondary ? "transparent" : accent,
  color: secondary ? accent : "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  flexShrink: 0,
});
const EXPORT_CSS = `
.letters-export-actions{display:flex;flex-wrap:wrap;gap:6px}
.letters-export-button{padding:6px 10px;border-radius:7px;border:1px solid rgba(128,128,128,.35);
background:transparent;color:inherit;font:600 12px/1.2 system-ui,sans-serif;cursor:pointer}
.letters-export-button:hover{border-color:currentColor}.letters-export-button:disabled{cursor:default;opacity:.5}`;

// ── Shared helpers ────────────────────────────────────────────────────────────

function fmtDate(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

/** Compact list metadata only; the stored source remains byte-for-byte intact. */
function plainPreview(content: string, maxLength: number): string {
  return content
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// ── LetterWriter component ────────────────────────────────────────────────────

export function LetterWriter({
  request,
  matterId,
  matterTitle = "",
  clientName = "",
  accent = "#8a6d2f",
  onSaved,
}: {
  request: LettersRequest;
  matterId?: number;
  matterTitle?: string;
  clientName?: string;
  accent?: string;
  onSaved?: (draft: DraftVersion) => void;
}) {
  const [letterTypes, setLetterTypes] = useState<LetterType[]>(LETTER_TYPES_FALLBACK);
  const [letterType, setLetterType] = useState("status_update");
  const [language, setLanguage] = useState<"en" | "bm">("en");
  const [details, setDetails] = useState("");
  const [generated, setGenerated] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [editingGenerated, setEditingGenerated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    request("/letters/types")
      .then((r) => jsonOr(r, { letterTypes: LETTER_TYPES_FALLBACK }))
      .then((d) => setLetterTypes((d as any).letterTypes ?? LETTER_TYPES_FALLBACK))
      .catch(() => {});
  }, [request]);

  const generate = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGenerating(true);
    setGenerated("");
    setEditingGenerated(false);
    setError(null);
    try {
      const r = await request("/letters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterType, language, clientName, matterTitle, details }),
        signal: ctrl.signal as RequestInit["signal"],
      });
      if (!r.ok || !r.body) throw new Error(`Generate failed (${r.status})`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.startsWith("data: ") ? part.slice(6) : part;
          try {
            const ev = JSON.parse(line) as { content?: string; done?: boolean; error?: string };
            if (ev.error) throw new Error(ev.error);
            if (ev.content) setGenerated((prev) => prev + ev.content);
          } catch (e) {
            if ((e as Error).message !== "Unexpected end of JSON input") throw e;
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError")
        setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [request, letterType, language, clientName, matterTitle, details]);

  const save = useCallback(async () => {
    if (!generated.trim()) { setError("Nothing to save — generate a letter first."); return; }
    setSaving(true);
    setError(null);
    try {
      const typeDef = letterTypes.find((t) => t.id === letterType);
      const title = `${typeDef?.label ?? "Letter"}${clientName ? ` — ${clientName}` : ""}`;
      const draft = await expectJson(
        await request("/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "letter",
            letterType,
            language,
            title,
            content: generated,
            matterId: matterId ?? null,
          }),
        }),
      );
      setSavedMsg("Letter saved to Drafts ✓");
      setTimeout(() => setSavedMsg(""), 3000);
      onSaved?.(draft as DraftVersion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [request, generated, letterType, language, clientName, matterId, letterTypes, onSaved]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 14 }}>
      <style>{EXPORT_CSS}</style>
      <div style={box}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 10 }}>
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ fontSize: 12, opacity: 0.7, display: "block", marginBottom: 4 }}>
              Letter type
            </label>
            <select
              value={letterType}
              onChange={(e) => setLetterType(e.target.value)}
              style={inp}
              data-testid="select-letter-type"
            >
              {letterTypes.map((t) => (
                <option key={t.id} value={t.id} style={optStyle}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "0 0 120px" }}>
            <label style={{ fontSize: 12, opacity: 0.7, display: "block", marginBottom: 4 }}>
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "bm")}
              style={inp}
              data-testid="select-language"
            >
              <option value="en" style={optStyle}>English</option>
              <option value="bm" style={optStyle}>Bahasa Malaysia</option>
            </select>
          </div>
        </div>
        <label style={{ fontSize: 12, opacity: 0.7, display: "block", marginBottom: 4 }}>
          Additional details or instructions for the AI (optional)
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          style={{ ...inp, resize: "vertical", fontFamily: "inherit" }}
          placeholder="e.g. the client's outstanding balance is RM 5,000; hearing is on 20 Oct 2026…"
          data-testid="textarea-letter-details"
        />
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={generate}
            disabled={generating}
            style={btn(accent)}
            data-testid="button-generate-letter"
          >
            {generating ? "Generating…" : "✦ Generate letter"}
          </button>
          {generating && (
            <button
              onClick={() => abortRef.current?.abort()}
              style={btn(accent, true)}
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ ...box, borderColor: "#c0392b", color: "#c0392b" }} data-testid="text-letter-error">
          {error}
        </div>
      )}

      {(generated || generating) && (
        <div style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>Generated letter</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {!generating && (
                <>
                  <button
                    type="button"
                    onClick={() => setEditingGenerated((value) => !value)}
                    style={btn(accent, true)}
                    data-testid="button-edit-letter-source"
                  >
                    {editingGenerated ? "Preview letter" : "Edit letter"}
                  </button>
                  <button onClick={save} disabled={saving} style={btn(accent)} data-testid="button-save-letter">
                    {saving ? "Saving…" : "Save to Drafts"}
                  </button>
                  {savedMsg && (
                    <span style={{ color: accent, fontWeight: 600, fontSize: 13 }}>{savedMsg}</span>
                  )}
                </>
              )}
            </div>
          </div>
          {editingGenerated ? (
            <textarea
              value={generated}
              onChange={(e) => setGenerated(e.target.value)}
              rows={28}
              style={{
                ...inp,
                resize: "vertical",
                width: "min(100%, 210mm)",
                minHeight: "297mm",
                margin: "0 auto",
                display: "block",
                padding: "22mm 20mm",
                background: "#fff",
                color: "#111827",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 14,
                lineHeight: 1.65,
                boxShadow: "0 3px 18px rgba(0,0,0,0.12)",
              }}
              aria-label="Edit generated letter source"
              data-testid="textarea-letter-content"
            />
          ) : (
            <DraftDocument content={generated} />
          )}
          {!generating && generated.trim() && (
            <div style={{ marginTop: 10 }}>
              <DraftExportButtons
                title={letterTypes.find((type) => type.id === letterType)?.label ?? "Generated letter"}
                content={generated}
                bm={language === "bm"}
                hideMarkdown
                className="letters-export-actions"
                buttonClassName="letters-export-button"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DraftsPanel component ─────────────────────────────────────────────────────

export function DraftsPanel({
  request,
  matterId,
  accent = "#8a6d2f",
  showLetterWriter = true,
  clientName = "",
  matterTitle = "",
}: {
  request: LettersRequest;
  matterId?: number;
  accent?: string;
  showLetterWriter?: boolean;
  clientName?: string;
  matterTitle?: string;
}) {
  const [tab, setTab] = useState<"list" | "write" | "view">("list");
  const [drafts, setDrafts] = useState<DraftVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"" | "draft" | "letter">("");
  const [viewDraft, setViewDraft] = useState<DraftVersion | null>(null);
  const [versions, setVersions] = useState<DraftVersion[]>([]);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [editTitle, setEditTitle] = useState("");

  const listPath = matterId
    ? `/${matterId}/drafts`
    : `/drafts/list${filter ? `?kind=${filter}` : ""}`;

  const reload = useCallback(async () => {
    setError(null);
    try {
      const body = await expectJson(await request(listPath));
      setDrafts(body.drafts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, [request, listPath]);

  useEffect(() => { void reload(); }, [reload]);

  const openDraft = useCallback(
    async (d: DraftVersion) => {
      setViewDraft(d);
      setEditContent(d.content);
      setEditTitle(d.title);
      setEditing(false);
      setTab("view");
      // Load version history
      const body = await jsonOr(
        await request(`/drafts/${d.id}/versions`),
        { versions: [] },
      );
      setVersions((body as any).versions ?? []);
    },
    [request],
  );

  const saveVersion = useCallback(async () => {
    if (!viewDraft) return;
    setBusy(true);
    setError(null);
    try {
      const draft = await expectJson(
        await request("/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rootId: viewDraft.root_id ?? viewDraft.id,
            title: editTitle,
            content: editContent,
            kind: viewDraft.kind,
            letterType: viewDraft.letter_type,
            language: viewDraft.language,
            matterId: viewDraft.matter_id,
          }),
        }),
      );
      setViewDraft(draft as DraftVersion);
      setEditing(false);
      await reload();
      const body = await jsonOr(await request(`/drafts/${(draft as DraftVersion).id}/versions`), { versions: [] });
      setVersions((body as any).versions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }, [request, viewDraft, editTitle, editContent, reload]);

  const deleteDraft = useCallback(
    async (d: DraftVersion) => {
      if (!window.confirm(`Delete "${d.title}" (version ${d.version_number})?`)) return;
      setBusy(true);
      try {
        await expectJson(await request(`/drafts/${d.id}`, { method: "DELETE" }));
        await reload();
        if (viewDraft?.id === d.id) { setTab("list"); setViewDraft(null); }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setBusy(false);
      }
    },
    [request, reload, viewDraft],
  );

  const exportDraft = useCallback(
    async (d: DraftVersion, fmt: "pdf" | "docx") => {
      try {
        const r = await request(`/drafts/${d.id}/export/${fmt}`);
        if (!r.ok) throw new Error(`Export failed (${r.status})`);
        const blob = await r.blob();
        downloadBlob(blob, `${d.title.slice(0, 60)}-v${d.version_number}.${fmt}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed");
      }
    },
    [request],
  );

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "6px 16px",
    borderRadius: 7,
    border: "none",
    background: active ? accent : "rgba(128,128,128,0.1)",
    color: active ? "#fff" : "inherit",
    fontWeight: active ? 700 : 400,
    fontSize: 13,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 14 }}>
      <style>{EXPORT_CSS}</style>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button style={tabStyle(tab === "list")} onClick={() => setTab("list")}>
          📄 Drafts
        </button>
        {showLetterWriter && (
          <button style={tabStyle(tab === "write")} onClick={() => setTab("write")} data-testid="button-write-letter">
            ✦ Write Letter
          </button>
        )}
        {viewDraft && (
          <button style={tabStyle(tab === "view")} onClick={() => setTab("view")}>
            {viewDraft.title.slice(0, 30)}
            {viewDraft.title.length > 30 ? "…" : ""}
          </button>
        )}
      </div>

      {error && (
        <div style={{ ...box, borderColor: "#c0392b", color: "#c0392b" }} data-testid="text-draft-error">
          {error}
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 8, border: "none", background: "transparent", cursor: "pointer", color: "#c0392b", fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      )}

      {/* Drafts list */}
      {tab === "list" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as "" | "draft" | "letter")}
              style={{ ...inp, width: "auto" }}
            >
              <option value="" style={optStyle}>All types</option>
              <option value="draft" style={optStyle}>Drafts only</option>
              <option value="letter" style={optStyle}>Letters only</option>
            </select>
            <button onClick={reload} style={{ ...inp, cursor: "pointer", width: "auto" }}>
              ↻ Refresh
            </button>
          </div>

          {loading ? (
            <div style={{ opacity: 0.6 }}>Loading drafts…</div>
          ) : drafts.length === 0 ? (
            <div style={{ ...box, textAlign: "center", opacity: 0.7 }} data-testid="text-drafts-empty">
              No drafts yet. Use "Write Letter" to generate a client letter, or save AI-generated
              documents here as dated drafts.
            </div>
          ) : (
            drafts.map((d) => (
              <div
                key={d.id}
                style={{ ...box, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-start" }}
                data-testid={`row-draft-${d.id}`}
              >
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.title}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.65, marginTop: 3 }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "1px 8px",
                        borderRadius: 99,
                        background: `${accent}22`,
                        color: accent,
                        fontWeight: 600,
                        marginRight: 6,
                      }}
                    >
                      {d.kind === "letter" ? "Letter" : "Draft"}
                    </span>
                    v{d.version_number} · {fmtDate(d.updated_at)}
                    {d.language === "bm" ? " · BM" : ""}
                  </div>
                  {d.content && (
                    <div style={{ fontSize: 12, opacity: 0.55, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {plainPreview(d.content, 120)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button style={btn(accent, true)} onClick={() => void openDraft(d)} data-testid={`button-open-draft-${d.id}`}>
                    Open
                  </button>
                  <button style={{ ...btn(accent, true), color: "#c0392b", borderColor: "#c0392b" }} onClick={() => void deleteDraft(d)} data-testid={`button-delete-draft-${d.id}`} disabled={busy}>
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Letter writer tab */}
      {tab === "write" && showLetterWriter && (
        <LetterWriter
          request={request}
          matterId={matterId}
          clientName={clientName}
          matterTitle={matterTitle}
          accent={accent}
          onSaved={(d) => {
            setViewDraft(d);
            setEditContent(d.content);
            setEditTitle(d.title);
            setTab("view");
            void reload();
          }}
        />
      )}

      {/* Draft viewer / editor */}
      {tab === "view" && viewDraft && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button style={btn(accent, true)} onClick={() => setTab("list")}>
              ← All drafts
            </button>
            {editing ? (
              <>
                <button style={btn(accent)} onClick={saveVersion} disabled={busy} data-testid="button-save-version">
                  {busy ? "Saving…" : "Save new version"}
                </button>
                <button style={btn(accent, true)} onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button style={btn(accent)} onClick={() => setEditing(true)} data-testid="button-edit-draft">
                  Edit
                </button>
                <button style={btn(accent, true)} onClick={() => void exportDraft(viewDraft, "pdf")} data-testid="button-export-pdf">
                  Export PDF
                </button>
                <button style={btn(accent, true)} onClick={() => void exportDraft(viewDraft, "docx")} data-testid="button-export-docx">
                  Export DOCX
                </button>
                <button
                  style={{ ...btn(accent, true), color: "#c0392b", borderColor: "#c0392b" }}
                  onClick={() => void deleteDraft(viewDraft)}
                  disabled={busy}
                >
                  Delete
                </button>
              </>
            )}
          </div>

          {editing ? (
            <div style={box}>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{ ...inp, marginBottom: 8, fontWeight: 700 }}
                placeholder="Title"
                data-testid="input-draft-title"
              />
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={24}
                style={{
                  ...inp,
                  resize: "vertical",
                  width: "min(100%, 210mm)",
                  minHeight: "297mm",
                  margin: "0 auto",
                  display: "block",
                  padding: "22mm 20mm",
                  background: "#fff",
                  color: "#111827",
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 14,
                  lineHeight: 1.65,
                  boxShadow: "0 3px 18px rgba(0,0,0,0.12)",
                }}
                data-testid="textarea-draft-content"
              />
            </div>
          ) : (
            <div style={box}>
              <h3 style={{ margin: "0 0 8px", fontWeight: 700 }}>{viewDraft.title}</h3>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 12 }}>
                v{viewDraft.version_number} · {fmtDate(viewDraft.updated_at)} ·{" "}
                {viewDraft.kind === "letter" ? "Letter" : "Draft"}
                {viewDraft.language === "bm" ? " · BM" : ""}
              </div>
              <div data-testid="document-draft-content">
                <DraftDocument content={viewDraft.content} />
              </div>
              <div style={{ marginTop: 10 }}>
                <DraftExportButtons
                  title={viewDraft.title}
                  content={viewDraft.content}
                  bm={viewDraft.language === "bm"}
                  hideMarkdown
                  className="letters-export-actions"
                  buttonClassName="letters-export-button"
                />
              </div>
            </div>
          )}

          {/* Version timeline */}
          {versions.length > 1 && (
            <div style={box}>
              <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>Version history</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {[...versions].reverse().map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      padding: "4px 0",
                      borderBottom: "1px solid rgba(128,128,128,0.15)",
                      background: v.id === viewDraft.id ? `${accent}11` : undefined,
                    }}
                    data-testid={`row-version-${v.version_number}`}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        minWidth: 60,
                        padding: "1px 8px",
                        borderRadius: 99,
                        background: v.id === viewDraft.id ? accent : "rgba(128,128,128,0.15)",
                        color: v.id === viewDraft.id ? "#fff" : "inherit",
                        fontWeight: 600,
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      v{v.version_number}
                    </span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{fmtDate(v.created_at)}</span>
                    <span style={{ flex: 1, fontSize: 12, opacity: 0.55, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {plainPreview(v.content, 80)}
                    </span>
                    {v.id !== viewDraft.id && (
                      <button
                        style={{ ...btn(accent, true), padding: "2px 10px" }}
                        onClick={() => void openDraft(v)}
                        data-testid={`button-view-version-${v.version_number}`}
                      >
                        View
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
