/**
 * Shared client document vault UI for all practice portals (Task #193).
 *
 * Exports:
 *   <DocumentsPanel request={...} matterId={n} accent="#8a6d2f" />  — matter Documents tab
 *   <DocumentsPanel request={...} clientId={n} ... />                — client-record documents
 *
 * `request(path, init?)` must perform an authenticated fetch against the
 * portal's matters API base (e.g. path "/documents" → GET
 * /api/lit/matters/documents) and return the raw Response.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type VaultRequest = (path: string, init?: RequestInit) => Promise<Response>;

export interface VaultDocument {
  id: number;
  matter_id: number | null;
  client_id: number | null;
  file_name: string;
  content_type: string | null;
  size_bytes: number | string;
  category: string;
  doc_date: string | null;
  notes: string | null;
  created_at: string;
}

// Must mirror the server's inline-preview allowlist (unsafe types are always
// served as attachments; showing Preview for them would just download).
const INLINE_SAFE = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
]);
const canPreview = (ct: string | null) =>
  !!ct && INLINE_SAFE.has(ct.split(";")[0].trim().toLowerCase());

const CATEGORY_LABELS: Record<string, string> = {
  correspondence: "Correspondence",
  cause_papers: "Cause papers",
  evidence: "Evidence",
  client_kyc: "Client KYC",
  billing: "Billing",
  other: "Other",
};

function fmtSize(v: number | string): string {
  const n = Number(v);
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

async function jsonOrError(r: Response): Promise<any> {
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
const inputStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid rgba(128,128,128,0.35)",
  fontSize: 13,
  background: "transparent",
  color: "inherit",
};

export function DocumentsPanel({
  request,
  matterId,
  clientId,
  accent = "#8a6d2f",
  showFilters = true,
  title,
}: {
  request: VaultRequest;
  matterId?: number;
  clientId?: number;
  accent?: string;
  showFilters?: boolean;
  title?: string;
}) {
  const [docs, setDocs] = useState<VaultDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploadDate, setUploadDate] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const listPath = useMemo(() => {
    const params = new URLSearchParams();
    if (matterId) params.set("matterId", String(matterId));
    if (clientId) params.set("clientId", String(clientId));
    if (category) params.set("category", category);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return `/documents/list${qs ? `?${qs}` : ""}`;
  }, [matterId, clientId, category, from, to]);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const body = await jsonOrError(await request(listPath));
      setDocs(body.documents ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [request, listPath]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setBusy(true);
      setError(null);
      try {
        for (const file of Array.from(files)) {
          const grant = await jsonOrError(
            await request("/documents/upload-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileName: file.name }),
            }),
          );
          const put = await fetch(grant.uploadURL, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/octet-stream" },
            body: file,
          });
          if (!put.ok) throw new Error(`Upload failed (${put.status})`);
          await jsonOrError(
            await request("/documents/confirm", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                objectPath: grant.objectPath,
                fileName: file.name,
                contentType: file.type || null,
                category: uploadCategory,
                docDate: uploadDate || null,
                matterId: matterId ?? null,
                clientId: clientId ?? null,
              }),
            }),
          );
        }
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setBusy(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [request, uploadCategory, uploadDate, matterId, clientId, reload],
  );

  const download = useCallback(
    async (doc: VaultDocument, inline: boolean) => {
      try {
        const r = await request(`/documents/${doc.id}/download${inline ? "?inline=1" : ""}`);
        if (!r.ok) throw new Error(`Download failed (${r.status})`);
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        if (inline) {
          window.open(url, "_blank", "noopener");
        } else {
          const a = document.createElement("a");
          a.href = url;
          a.download = doc.file_name;
          a.click();
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Download failed");
      }
    },
    [request],
  );

  const patch = useCallback(
    async (id: number, body: Record<string, unknown>) => {
      setBusy(true);
      try {
        await jsonOrError(
          await request(`/documents/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
        );
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
      } finally {
        setBusy(false);
      }
    },
    [request, reload],
  );

  const remove = useCallback(
    async (doc: VaultDocument) => {
      if (!window.confirm(`Delete "${doc.file_name}" permanently?`)) return;
      setBusy(true);
      try {
        await jsonOrError(await request(`/documents/${doc.id}`, { method: "DELETE" }));
        await reload();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setBusy(false);
      }
    },
    [request, reload],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 14 }}>
      {title && <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>}

      {/* Upload */}
      <div style={box}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <label
            style={{
              display: "inline-block",
              padding: "8px 14px",
              borderRadius: 8,
              background: accent,
              color: "#fff",
              fontWeight: 600,
              fontSize: 13,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? "Working…" : "⬆ Upload documents"}
            <input
              ref={fileRef}
              type="file"
              multiple
              disabled={busy}
              style={{ display: "none" }}
              onChange={(e) => void upload(e.target.files)}
              data-testid="input-vault-upload"
            />
          </label>
          <select
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value)}
            style={inputStyle}
            data-testid="select-upload-category"
          >
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={uploadDate}
            onChange={(e) => setUploadDate(e.target.value)}
            style={inputStyle}
            title="Document date (optional)"
          />
          <span style={{ fontSize: 12, opacity: 0.65 }}>
            Files are stored privately and only visible to your firm.
          </span>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle} data-testid="select-filter-category">
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} title="From date" />
          <span style={{ opacity: 0.5 }}>–</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} title="To date" />
          {(category || from || to) && (
            <button
              onClick={() => {
                setCategory("");
                setFrom("");
                setTo("");
              }}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{ ...box, borderColor: "#c0392b", color: "#c0392b" }} data-testid="text-vault-error">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div style={{ opacity: 0.6 }}>Loading documents…</div>
      ) : docs.length === 0 ? (
        <div style={{ ...box, textAlign: "center", opacity: 0.7 }} data-testid="text-vault-empty">
          No documents stored yet. Upload client papers to keep them safe with this{" "}
          {clientId ? "client" : "matter"}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {docs.map((d) => (
            <div
              key={d.id}
              style={{ ...box, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}
              data-testid={`row-document-${d.id}`}
            >
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                {renamingId === d.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setRenamingId(null);
                      if (renameValue.trim() && renameValue.trim() !== d.file_name)
                        void patch(d.id, { fileName: renameValue.trim() });
                    }}
                    style={{ display: "flex", gap: 6 }}
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      style={{ ...inputStyle, flex: 1 }}
                      data-testid="input-rename-document"
                    />
                    <button type="submit" style={{ ...inputStyle, cursor: "pointer", fontWeight: 600 }}>
                      Save
                    </button>
                  </form>
                ) : (
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.file_name}
                  </div>
                )}
                <div style={{ fontSize: 12, opacity: 0.65, marginTop: 2 }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "1px 8px",
                      borderRadius: 99,
                      background: `${accent}22`,
                      color: accent,
                      fontWeight: 600,
                      marginRight: 8,
                    }}
                  >
                    {CATEGORY_LABELS[d.category] ?? d.category}
                  </span>
                  {fmtDate(d.doc_date ?? d.created_at)} · {fmtSize(d.size_bytes)}
                  {d.content_type ? ` · ${d.content_type.split("/")[1] ?? d.content_type}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {canPreview(d.content_type) && (
                  <button style={{ ...inputStyle, cursor: "pointer" }} onClick={() => void download(d, true)} data-testid={`button-preview-${d.id}`}>
                    Preview
                  </button>
                )}
                <button style={{ ...inputStyle, cursor: "pointer" }} onClick={() => void download(d, false)} data-testid={`button-download-${d.id}`}>
                  Download
                </button>
                <select
                  value={d.category}
                  onChange={(e) => void patch(d.id, { category: e.target.value })}
                  style={inputStyle}
                  title="Change category"
                >
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <button
                  style={{ ...inputStyle, cursor: "pointer" }}
                  onClick={() => {
                    setRenamingId(d.id);
                    setRenameValue(d.file_name);
                  }}
                  data-testid={`button-rename-${d.id}`}
                >
                  Rename
                </button>
                <button
                  style={{ ...inputStyle, cursor: "pointer", color: "#c0392b" }}
                  onClick={() => void remove(d)}
                  data-testid={`button-delete-${d.id}`}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
