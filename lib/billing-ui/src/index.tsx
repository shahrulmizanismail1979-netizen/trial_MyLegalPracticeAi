/**
 * Shared time & billing UI for all practice portals (Task #192 / Task #272).
 *
 * Exports:
 *   <BillingTab request={...} matterId={n} accent="#8a6d2f" />  — matter billing tab
 *   <BillingPage request={...} accent="#8a6d2f" />              — portal-level Billing page
 *
 * `request(path, init?)` must perform an authenticated fetch against the
 * portal's matters API base (e.g. path "/12/billing" →
 * GET /api/lit/matters/12/billing) and return the raw Response.
 */
import { useCallback, useEffect, useMemo, useState } from "react";

export type BillingRequest = (path: string, init?: RequestInit) => Promise<Response>;

interface CommonProps {
  request: BillingRequest;
  accent?: string;
  currency?: string;
}

interface TimeEntry {
  id: number;
  description: string;
  minutes: number;
  rate: string | null;
  entry_date: string;
  invoice_id: number | null;
  activity_type: string | null;
  lawyer_level: string | null;
  lawyer_name: string | null;
  /** Persisted at POST time: which rule tier actually provided the rate. */
  rate_source: "named" | "level" | "manual" | "default" | null;
}
interface FeeItem {
  id: number;
  kind: string;
  description: string;
  amount: string;
  item_date: string;
  invoice_id: number | null;
}
export interface Invoice {
  id: number;
  invoice_no: string;
  status: string;
  matter_id: number;
  client_name: string | null;
  issue_date: string | null;
  due_date: string | null;
  subtotal: string;
  tax_percent: string;
  tax_amount: string;
  total: string;
  amount_paid: string;
  notes: string | null;
  created_at: string;
  lines?: Array<{ id: number; description: string; quantity: string; unit_amount: string; amount: string }>;
  payments?: Array<{ id: number; paid_date: string; amount: string; method: string | null; reference: string | null }>;
}
export interface RateCard {
  id: number;
  activity_type: string;
  lawyer_level: string;
  lawyer_name: string | null;
  practice_area: string | null;
  rate_usd: string;
}
interface Settings {
  firm_name: string | null;
  firm_address: string | null;
  firm_phone: string | null;
  firm_email: string | null;
  default_hourly_rate: string | null;
  tax_percent: string;
  invoice_prefix: string;
  rateCards?: RateCard[];
}
interface MatterBilling {
  timeEntries: TimeEntry[];
  feeItems: FeeItem[];
  invoices: Invoice[];
  settings: Settings;
  rateCards: RateCard[];
  unbilled: { time: string; fees: string; disbursements: string; total: string };
}

const n = (v: unknown) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(x) ? x : 0;
};
// Display dates as DD/MM/YYYY (Malaysian convention). Does NOT change stored
// values or API payloads — this is display-only formatting of an ISO date.
const d10 = (v: string | null | undefined) => {
  if (!v) return "—";
  const iso = String(v).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
const today = () => new Date().toISOString().slice(0, 10);

function fmtMoney(v: unknown, currency = "RM") {
  return `${currency} ${n(v).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  issued: "Issued",
  partly_paid: "Partly paid",
  paid: "Paid",
  void: "Void",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "#8a8a8a",
  issued: "#b07d1e",
  partly_paid: "#2563eb",
  paid: "#15803d",
  void: "#b91c1c",
};

// ── tiny styling helpers (self-contained; no portal CSS required) ─────────────

const S = {
  card: {
    background: "#fff",
    border: "1px solid #e5e2da",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  } as const,
  h: { margin: "0 0 10px", fontSize: 15, fontWeight: 700, color: "#1f2937" } as const,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: {
    textAlign: "left" as const,
    padding: "6px 8px",
    borderBottom: "2px solid #e5e2da",
    color: "#6b7280",
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },
  td: { padding: "7px 8px", borderBottom: "1px solid #f0ede6", color: "#111827", verticalAlign: "top" as const },
  input: {
    padding: "7px 9px",
    border: "1px solid #d6d2c8",
    borderRadius: 7,
    fontSize: 13,
    outline: "none",
    background: "#fff",
    color: "#111827",
  } as const,
  err: { color: "#b91c1c", fontSize: 13, margin: "8px 0" } as const,
};

function Btn({
  children,
  onClick,
  accent = "#8a6d2f",
  kind = "primary",
  disabled,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  accent?: string;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  small?: boolean;
}) {
  const base: React.CSSProperties = {
    padding: small ? "4px 10px" : "8px 14px",
    borderRadius: 7,
    fontSize: small ? 12 : 13,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
    border: "1px solid transparent",
    background: accent,
    color: "#fff",
  };
  if (kind === "ghost") {
    base.background = "#fff";
    base.color = accent;
    base.border = `1px solid ${accent}55`;
  }
  if (kind === "danger") {
    base.background = "#fff";
    base.color = "#b91c1c";
    base.border = "1px solid #b91c1c55";
  }
  return (
    <button type="button" style={base} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? "#6b7280";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        color: c,
        background: `${c}18`,
        border: `1px solid ${c}44`,
      }}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      style={{
        flex: "1 1 120px",
        minWidth: 120,
        background: "#faf8f3",
        border: "1px solid #eae6dc",
        borderRadius: 10,
        padding: "10px 14px",
      }}
    >
      <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: accent ?? "#111827", marginTop: 3 }}>{value}</div>
    </div>
  );
}

async function jsonOrThrow(res: Response) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `Request failed (${res.status})`);
  return body;
}

async function downloadPdf(request: BillingRequest, invoice: Invoice) {
  const res = await request(`/billing/invoices/${invoice.id}/pdf`);
  if (!res.ok) throw new Error("PDF download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${invoice.invoice_no}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// ── invoice row actions (shared by both views) ────────────────────────────────

function InvoiceActions({
  invoice,
  request,
  accent,
  onChanged,
  currency,
}: {
  invoice: Invoice;
  request: BillingRequest;
  accent: string;
  onChanged: () => void;
  currency: string;
}) {
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [error, setError] = useState<string | null>(null);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const patch = (body: Record<string, unknown>) =>
    request(`/billing/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(jsonOrThrow);

  const balance = n(invoice.total) - n(invoice.amount_paid);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {invoice.status === "draft" && (
          <>
            <Btn small accent={accent} disabled={busy} onClick={() => act(() => patch({ status: "issued" }))}>
              Issue
            </Btn>
            <Btn
              small
              kind="danger"
              disabled={busy}
              onClick={() =>
                act(() =>
                  request(`/billing/invoices/${invoice.id}`, { method: "DELETE" }).then(jsonOrThrow),
                )
              }
            >
              Delete
            </Btn>
          </>
        )}
        {(invoice.status === "issued" || invoice.status === "partly_paid") && (
          <>
            <Btn small accent={accent} disabled={busy} onClick={() => setPayOpen((v) => !v)}>
              Record payment
            </Btn>
            <Btn small kind="danger" disabled={busy} onClick={() => act(() => patch({ status: "void" }))}>
              Void
            </Btn>
          </>
        )}
        <Btn small kind="ghost" accent={accent} disabled={busy} onClick={() => act(() => downloadPdf(request, invoice))}>
          PDF
        </Btn>
      </div>
      {payOpen && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input
            style={{ ...S.input, width: 110 }}
            placeholder={`Amount (${currency})`}
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            inputMode="decimal"
          />
          <input
            style={{ ...S.input, width: 120 }}
            placeholder="Method"
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value)}
          />
          <Btn
            small
            accent={accent}
            disabled={busy || n(payAmount) <= 0}
            onClick={() =>
              act(async () => {
                await request(`/billing/invoices/${invoice.id}/payments`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ amount: n(payAmount), method: payMethod || undefined }),
                }).then(jsonOrThrow);
                setPayOpen(false);
                setPayAmount("");
              })
            }
          >
            Save
          </Btn>
          <span style={{ fontSize: 12, color: "#6b7280" }}>Balance: {fmtMoney(balance, currency)}</span>
        </div>
      )}
      {error && <div style={S.err}>{error}</div>}
    </div>
  );
}

// ── Rate card management panel ────────────────────────────────────────────────

const PRACTICE_AREA_OPTIONS = [
  "Litigation",
  "Conveyancing",
  "Corporate",
  "Syariah",
  "Criminal",
  "Employment",
  "Accident / Injury",
  "Banking / Finance",
  "Other",
];

function RateCardPanel({
  rateCards,
  request,
  accent,
  currency,
  onChanged,
}: {
  rateCards: RateCard[];
  request: BillingRequest;
  accent: string;
  currency: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addActivity, setAddActivity] = useState("");
  const [addLevel, setAddLevel] = useState("");
  const [addName, setAddName] = useState("");
  const [addArea, setAddArea] = useState("");
  const [addRate, setAddRate] = useState("");
  const [customActivity, setCustomActivity] = useState(false);
  const [customLevel, setCustomLevel] = useState(false);
  const [customArea, setCustomArea] = useState(false);

  const activityOptions = [
    "Court Hearing",
    "Trial",
    "Client Meeting",
    "Legal Research",
    "Document Drafting",
    "Negotiation",
    "Mediation",
    "Case Management",
    "Deposition",
    "Other",
  ];
  const levelOptions = [
    "Senior Partner",
    "Partner",
    "Senior Associate",
    "Associate",
    "Junior Associate",
    "Paralegal",
    "Other",
  ];

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
        Rate card — practice area × activity × lawyer level (× named lawyer)
      </div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
        Set rates by practice area, activity type, and lawyer level. Optionally add a named lawyer for an individual rate.
        Lookup priority: area + activity + level + name → area + activity + level → activity + level + name → activity + level.
        Leaving practice area blank creates a catch-all entry used when no area-specific rate exists.
      </div>

      {/* Add row */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        {/* Practice area */}
        {customArea ? (
          <input
            style={{ ...S.input, flex: "1 1 130px" }}
            placeholder="Practice area"
            value={addArea}
            onChange={(e) => setAddArea(e.target.value)}
          />
        ) : (
          <select
            style={{ ...S.input, flex: "1 1 130px" }}
            value={addArea}
            onChange={(e) => {
              if (e.target.value === "__custom__") { setCustomArea(true); setAddArea(""); }
              else setAddArea(e.target.value);
            }}
          >
            <option value="">Any practice area</option>
            {PRACTICE_AREA_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            <option value="__custom__">Custom…</option>
          </select>
        )}
        {/* Activity type */}
        {customActivity ? (
          <input
            style={{ ...S.input, flex: "1 1 150px" }}
            placeholder="Activity type"
            value={addActivity}
            onChange={(e) => setAddActivity(e.target.value)}
          />
        ) : (
          <select
            style={{ ...S.input, flex: "1 1 150px" }}
            value={addActivity}
            onChange={(e) => {
              if (e.target.value === "__custom__") { setCustomActivity(true); setAddActivity(""); }
              else setAddActivity(e.target.value);
            }}
          >
            <option value="">Activity type…</option>
            {activityOptions.map((a) => <option key={a} value={a}>{a}</option>)}
            <option value="__custom__">Custom…</option>
          </select>
        )}
        {/* Lawyer level */}
        {customLevel ? (
          <input
            style={{ ...S.input, flex: "1 1 140px" }}
            placeholder="Lawyer level"
            value={addLevel}
            onChange={(e) => setAddLevel(e.target.value)}
          />
        ) : (
          <select
            style={{ ...S.input, flex: "1 1 140px" }}
            value={addLevel}
            onChange={(e) => {
              if (e.target.value === "__custom__") { setCustomLevel(true); setAddLevel(""); }
              else setAddLevel(e.target.value);
            }}
          >
            <option value="">Lawyer level…</option>
            {levelOptions.map((l) => <option key={l} value={l}>{l}</option>)}
            <option value="__custom__">Custom…</option>
          </select>
        )}
        <input
          style={{ ...S.input, flex: "1 1 120px" }}
          placeholder="Named lawyer (optional)"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          title="Leave blank for a seniority-level rate that applies to all lawyers at this level"
        />
        <input
          style={{ ...S.input, width: 130 }}
          placeholder={`Rate (${currency}/hr)`}
          inputMode="decimal"
          value={addRate}
          onChange={(e) => setAddRate(e.target.value)}
        />
        <Btn
          small
          accent={accent}
          disabled={busy || !addActivity.trim() || !addLevel.trim() || n(addRate) <= 0}
          onClick={() =>
            run(async () => {
              await request(`/billing/rate-cards`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  activityType: addActivity.trim(),
                  lawyerLevel: addLevel.trim(),
                  lawyerName: addName.trim() || undefined,
                  practiceArea: addArea.trim() || undefined,
                  rateUsd: n(addRate),
                }),
              }).then(jsonOrThrow);
              setAddActivity(""); setAddLevel(""); setAddName(""); setAddArea(""); setAddRate("");
              setCustomActivity(false); setCustomLevel(false); setCustomArea(false);
            })
          }
        >
          Add / update
        </Btn>
      </div>
      {error && <div style={S.err}>{error}</div>}

      {rateCards.length === 0 ? (
        <div style={{ fontSize: 12, color: "#6b7280" }}>No rate card entries yet.</div>
      ) : (
        <table style={{ ...S.table, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={S.th}>Practice area</th>
              <th style={S.th}>Activity type</th>
              <th style={S.th}>Lawyer level</th>
              <th style={S.th}>Named lawyer</th>
              <th style={S.th}>Rate/hr</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {rateCards.map((rc) => (
              <RateCardRow key={rc.id} rc={rc} request={request} accent={accent} currency={currency} busy={busy} onChanged={() => void run(async () => { onChanged(); })} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RateCardRow({
  rc,
  request,
  accent,
  currency,
  busy,
  onChanged,
}: {
  rc: RateCard;
  request: BillingRequest;
  accent: string;
  currency: string;
  busy: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editRate, setEditRate] = useState(rc.rate_usd);
  const [localBusy, setLocalBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setLocalBusy(true);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLocalBusy(false);
    }
  };

  return (
    <tr>
      <td style={S.td}>
        {rc.practice_area ? (
          rc.practice_area
        ) : (
          <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Any</span>
        )}
      </td>
      <td style={S.td}>{rc.activity_type}</td>
      <td style={S.td}>{rc.lawyer_level}</td>
      <td style={S.td}>
        {rc.lawyer_name ? (
          rc.lawyer_name
        ) : (
          <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Any</span>
        )}
      </td>
      <td style={S.td}>
        {editing ? (
          <input
            style={{ ...S.input, width: 100 }}
            value={editRate}
            onChange={(e) => setEditRate(e.target.value)}
            inputMode="decimal"
          />
        ) : (
          fmtMoney(rc.rate_usd, currency)
        )}
        {error && <div style={{ ...S.err, margin: 0 }}>{error}</div>}
      </td>
      <td style={{ ...S.td, whiteSpace: "nowrap" as const }}>
        {editing ? (
          <div style={{ display: "flex", gap: 4 }}>
            <Btn small accent={accent} disabled={localBusy || n(editRate) <= 0}
              onClick={() => run(async () => {
                await request(`/billing/rate-cards/${rc.id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ rateUsd: n(editRate) }),
                }).then(jsonOrThrow);
                setEditing(false);
              })}>Save</Btn>
            <Btn small kind="ghost" accent={accent} disabled={localBusy} onClick={() => { setEditing(false); setEditRate(rc.rate_usd); }}>Cancel</Btn>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 4 }}>
            <Btn small kind="ghost" accent={accent} disabled={busy || localBusy} onClick={() => setEditing(true)}>Edit rate</Btn>
            <Btn small kind="danger" disabled={busy || localBusy}
              onClick={() => run(() =>
                request(`/billing/rate-cards/${rc.id}`, { method: "DELETE" }).then(jsonOrThrow)
              )}>Delete</Btn>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── BillingTab (matter-level) ─────────────────────────────────────────────────

export function BillingTab({
  request,
  matterId,
  accent = "#8a6d2f",
  currency = "RM",
  defaultClientName,
}: CommonProps & { matterId: number; defaultClientName?: string }) {
  const [data, setData] = useState<MatterBilling | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // add-time form
  const [tDesc, setTDesc] = useState("");
  const [tMin, setTMin] = useState("");
  const [tRate, setTRate] = useState("");
  const [tDate, setTDate] = useState(today());
  const [tActivity, setTActivity] = useState("");
  const [tLevel, setTLevel] = useState("");
  const [tName, setTName] = useState("");
  const [tArea, setTArea] = useState("");
  const [tCustomActivity, setTCustomActivity] = useState(false);
  const [tCustomLevel, setTCustomLevel] = useState(false);
  const [tCustomArea, setTCustomArea] = useState(false);
  // add-fee form
  const [fDesc, setFDesc] = useState("");
  const [fAmt, setFAmt] = useState("");
  const [fKind, setFKind] = useState<"fee" | "disbursement">("fee");
  // invoice form
  const [invOpen, setInvOpen] = useState(false);
  const [invClient, setInvClient] = useState(defaultClientName ?? "");
  const [invAddress, setInvAddress] = useState("");
  const [invTax, setInvTax] = useState("");
  const [invNotes, setInvNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const body = (await request(`/${matterId}/billing`).then(jsonOrThrow)) as MatterBilling;
      setData(body);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [request, matterId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  // Auto-fill rate from rate card.
  // Mirrors the server-side lookupRateCard fallback chain (most-specific first):
  //   1. area + activity + level + name
  //   2. activity + level + name  (any area)
  //   3. area + activity + level  (no named-lawyer row)
  //   4. activity + level         (no name, no area — broadest fallback)
  // Partial matches (activity-only or level-only) are intentionally skipped so a
  // Senior Partner entry never silently receive an Associate rate.
  const rateCards = data?.rateCards ?? [];

  const autoRate = useMemo(() => {
    if (!tActivity || !tLevel || rateCards.length === 0) return null;
    const area = tArea.trim() || null;
    const name = tName.trim() || null;
    const match = (rc: RateCard, areaVal: string | null, nameVal: string | null) =>
      rc.activity_type === tActivity &&
      rc.lawyer_level === tLevel &&
      (areaVal === null ? rc.practice_area === null : rc.practice_area === areaVal) &&
      (nameVal === null ? rc.lawyer_name === null : rc.lawyer_name === nameVal);
    // 1. area + name
    if (area && name) {
      const r = rateCards.find((rc) => match(rc, area, name));
      if (r) return r.rate_usd;
    }
    // 2. name only (any area → practice_area IS NULL row)
    if (name) {
      const r = rateCards.find((rc) => match(rc, null, name));
      if (r) return r.rate_usd;
    }
    // 3. area only (no named-lawyer row)
    if (area) {
      const r = rateCards.find((rc) => match(rc, area, null));
      if (r) return r.rate_usd;
    }
    // 4. level-only fallback (no area, no name)
    const r = rateCards.find((rc) => match(rc, null, null));
    return r ? r.rate_usd : null;
  }, [tActivity, tLevel, tName, tArea, rateCards]);

  // When auto-rate changes, pre-fill rate field (only if user hasn't manually typed)
  const [rateAutoFilled, setRateAutoFilled] = useState(false);
  useEffect(() => {
    if (autoRate !== null) {
      setTRate(n(autoRate).toFixed(2));
      setRateAutoFilled(true);
    } else if (rateAutoFilled) {
      setTRate("");
      setRateAutoFilled(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRate]);

  const activityOptions = [
    "Court Hearing", "Trial", "Client Meeting", "Legal Research",
    "Document Drafting", "Negotiation", "Mediation", "Case Management", "Deposition", "Other",
  ];
  const levelOptions = [
    "Senior Partner", "Partner", "Senior Associate",
    "Associate", "Junior Associate", "Paralegal", "Other",
  ];

  // Merge rate card activities/levels into options so firm-defined values appear
  const allActivities = useMemo(() => {
    const extras = rateCards.map((r) => r.activity_type).filter((a) => !activityOptions.includes(a));
    return [...new Set([...activityOptions, ...extras])];
  }, [rateCards]);
  const allLevels = useMemo(() => {
    const extras = rateCards.map((r) => r.lawyer_level).filter((l) => !levelOptions.includes(l));
    return [...new Set([...levelOptions, ...extras])];
  }, [rateCards]);

  if (loading) return <div style={{ padding: 20, color: "#6b7280", fontSize: 14 }}>Loading billing…</div>;
  if (!data) return <div style={{ padding: 20, ...S.err }}>{error ?? "Failed to load billing"}</div>;

  const unbilledTime = data.timeEntries.filter((t) => t.invoice_id == null);
  const unbilledFees = data.feeItems.filter((f) => f.invoice_id == null);

  // Effective rate = the entry's own rate, else the firm's default hourly rate.
  const defaultRate = n(data.settings?.default_hourly_rate);
  const lineAmount = (t: TimeEntry) => {
    const rate = t.rate != null && String(t.rate).trim() !== "" ? n(t.rate) : defaultRate;
    return (n(t.minutes) / 60) * rate;
  };

  return (
    <div>
      {error && <div style={S.err}>{error}</div>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <SummaryCard label="Unbilled time" value={fmtMoney(data.unbilled.time, currency)} />
        <SummaryCard label="Unbilled fees" value={fmtMoney(data.unbilled.fees, currency)} />
        <SummaryCard label="Disbursements" value={fmtMoney(data.unbilled.disbursements, currency)} />
        <SummaryCard label="Total fees" value={fmtMoney(data.unbilled.total, currency)} accent={accent} />
      </div>

      {/* Time entries */}
      <div style={S.card}>
        <h3 style={S.h}>Time entries</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          <input style={{ ...S.input, width: 130 }} type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} />
          <input
            style={{ ...S.input, flex: "1 1 200px" }}
            placeholder="Description, e.g. Drafting affidavit"
            value={tDesc}
            onChange={(e) => setTDesc(e.target.value)}
          />
          <input style={{ ...S.input, width: 90 }} placeholder="Minutes" inputMode="numeric" value={tMin} onChange={(e) => setTMin(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
          {/* Practice area */}
          {tCustomArea ? (
            <input
              style={{ ...S.input, flex: "1 1 120px" }}
              placeholder="Practice area"
              value={tArea}
              onChange={(e) => { setTArea(e.target.value); setRateAutoFilled(false); }}
            />
          ) : (
            <select
              style={{ ...S.input, flex: "1 1 120px" }}
              value={tArea}
              onChange={(e) => {
                if (e.target.value === "__custom__") { setTCustomArea(true); setTArea(""); }
                else { setTArea(e.target.value); setRateAutoFilled(false); }
              }}
            >
              <option value="">Practice area (optional)</option>
              {PRACTICE_AREA_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              <option value="__custom__">Custom…</option>
            </select>
          )}
          {/* Activity type */}
          {tCustomActivity ? (
            <input
              style={{ ...S.input, flex: "1 1 140px" }}
              placeholder="Activity type"
              value={tActivity}
              onChange={(e) => setTActivity(e.target.value)}
            />
          ) : (
            <select
              style={{ ...S.input, flex: "1 1 140px" }}
              value={tActivity}
              onChange={(e) => {
                if (e.target.value === "__custom__") { setTCustomActivity(true); setTActivity(""); }
                else setTActivity(e.target.value);
              }}
            >
              <option value="">Activity type (optional)</option>
              {allActivities.map((a) => <option key={a} value={a}>{a}</option>)}
              <option value="__custom__">Custom…</option>
            </select>
          )}
          {/* Lawyer level */}
          {tCustomLevel ? (
            <input
              style={{ ...S.input, flex: "1 1 130px" }}
              placeholder="Lawyer level"
              value={tLevel}
              onChange={(e) => setTLevel(e.target.value)}
            />
          ) : (
            <select
              style={{ ...S.input, flex: "1 1 130px" }}
              value={tLevel}
              onChange={(e) => {
                if (e.target.value === "__custom__") { setTCustomLevel(true); setTLevel(""); }
                else setTLevel(e.target.value);
              }}
            >
              <option value="">Lawyer level (optional)</option>
              {allLevels.map((l) => <option key={l} value={l}>{l}</option>)}
              <option value="__custom__">Custom…</option>
            </select>
          )}
          {/* Named lawyer */}
          <input
            style={{ ...S.input, flex: "1 1 130px" }}
            placeholder="Lawyer name (optional)"
            value={tName}
            onChange={(e) => { setTName(e.target.value); setRateAutoFilled(false); }}
            title="Enter a lawyer's name to apply their individual rate (if set in the rate card)"
          />
          <div style={{ position: "relative" as const }}>
            <input
              style={{ ...S.input, width: 130, paddingRight: autoRate !== null ? 24 : undefined }}
              placeholder={`Rate/${currency}/hr (optional)`}
              inputMode="decimal"
              value={tRate}
              onChange={(e) => { setTRate(e.target.value); setRateAutoFilled(false); }}
            />
            {autoRate !== null && (
              <span style={{ position: "absolute" as const, right: 7, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: accent, fontWeight: 700 }} title="Auto-filled from rate card">★</span>
            )}
          </div>
          {autoRate !== null && (
            <span style={{ fontSize: 11, color: "#6b7280" }}>Rate card: {fmtMoney(autoRate, currency)}/hr</span>
          )}
          <Btn
            accent={accent}
            disabled={busy || !tDesc.trim() || n(tMin) <= 0}
            onClick={() =>
              run(async () => {
                await request(`/${matterId}/time-entries`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    description: tDesc.trim(),
                    minutes: Math.round(n(tMin)),
                    // Only send rate_usd when the user manually typed it.
                    // Auto-filled values are omitted so the server does its own
                    // rate-card lookup and persists the correct rate_source
                    // ('named' or 'level') rather than 'manual'.
                    rate_usd: !rateAutoFilled && tRate.trim() ? n(tRate) : undefined,
                    entry_date: tDate,
                    activity_type: tActivity.trim() || undefined,
                    lawyer_level: tLevel.trim() || undefined,
                    lawyer_name: tName.trim() || undefined,
                    practice_area: tArea.trim() || undefined,
                  }),
                }).then(jsonOrThrow);
                setTDesc(""); setTMin(""); setTRate(""); setTActivity(""); setTLevel(""); setTName(""); setTArea("");
                setRateAutoFilled(false); setTCustomArea(false);
              })
            }
          >
            Log time
          </Btn>
        </div>
        {data.timeEntries.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>No time recorded yet.</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Date</th>
                <th style={S.th}>Activity</th>
                <th style={S.th}>Lawyer level</th>
                <th style={S.th}>Lawyer</th>
                <th style={S.th}>Description</th>
                <th style={S.th}>Minutes</th>
                <th style={S.th}>Rate/hr</th>
                <th style={S.th}>Amount</th>
                <th style={S.th}>Status</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {data.timeEntries.map((t) => (
                <tr key={t.id}>
                  <td style={S.td}>{d10(t.entry_date)}</td>
                  <td style={S.td}>{t.activity_type ?? <span style={{ color: "#9ca3af" }}>—</span>}</td>
                  <td style={S.td}>{t.lawyer_level ?? <span style={{ color: "#9ca3af" }}>—</span>}</td>
                  <td style={S.td}>{t.lawyer_name ?? <span style={{ color: "#9ca3af" }}>—</span>}</td>
                  <td style={S.td}>{t.description}</td>
                  <td style={S.td}>{t.minutes}</td>
                  <td style={S.td}>
                    {t.rate != null && String(t.rate).trim() !== "" ? fmtMoney(t.rate, currency) : `default${defaultRate > 0 ? " (" + fmtMoney(defaultRate, currency) + ")" : ""}`}
                    {t.rate_source === "named" && (
                      <span
                        title={`Named-lawyer rule matched${t.lawyer_name ? ` for ${t.lawyer_name}` : ""}`}
                        style={{ display: "block", fontSize: 10, marginTop: 2, color: "#7c3aed", fontWeight: 600, whiteSpace: "nowrap" as const }}
                      >
                        {t.lawyer_name ? `${t.lawyer_name} — custom rate` : "custom rate"}
                      </span>
                    )}
                    {t.rate_source === "level" && (
                      <span
                        title={`Level rate applied${t.lawyer_level ? ` for ${t.lawyer_level}` : ""}${t.lawyer_name ? ` (no named rule for ${t.lawyer_name})` : ""}`}
                        style={{ display: "block", fontSize: 10, marginTop: 2, color: "#2563eb", fontWeight: 600, whiteSpace: "nowrap" as const }}
                      >
                        {t.lawyer_level ? `${t.lawyer_level} — level rate` : "level rate"}
                      </span>
                    )}
                    {t.rate_source === "manual" && (
                      <span
                        title="Rate entered manually"
                        style={{ display: "block", fontSize: 10, marginTop: 2, color: "#059669", fontWeight: 600, whiteSpace: "nowrap" as const }}
                      >
                        manual rate
                      </span>
                    )}
                  </td>
                  <td style={S.td}>{fmtMoney(lineAmount(t), currency)}</td>
                  <td style={S.td}>{t.invoice_id != null ? <StatusBadge status="issued" /> : <span style={{ color: "#6b7280", fontSize: 12 }}>Unbilled</span>}</td>
                  <td style={S.td}>
                    {t.invoice_id == null && (
                      <Btn
                        small
                        kind="danger"
                        disabled={busy}
                        onClick={() => run(() => request(`/${matterId}/time-entries/${t.id}`, { method: "DELETE" }).then(jsonOrThrow))}
                      >
                        Delete
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Fees & disbursements */}
      <div style={S.card}>
        <h3 style={S.h}>Fixed fees & disbursements</h3>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          <select style={S.input} value={fKind} onChange={(e) => setFKind(e.target.value as "fee" | "disbursement")}>
            <option value="fee">Professional fee</option>
            <option value="disbursement">Disbursement</option>
          </select>
          <input
            style={{ ...S.input, flex: "1 1 200px" }}
            placeholder="Description, e.g. Filing fee"
            value={fDesc}
            onChange={(e) => setFDesc(e.target.value)}
          />
          <input style={{ ...S.input, width: 130 }} placeholder={`Amount (${currency})`} inputMode="decimal" value={fAmt} onChange={(e) => setFAmt(e.target.value)} />
          <Btn
            accent={accent}
            disabled={busy || !fDesc.trim() || n(fAmt) <= 0}
            onClick={() =>
              run(async () => {
                await request(`/${matterId}/billing/fee-items`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ description: fDesc.trim(), amount: n(fAmt), kind: fKind }),
                }).then(jsonOrThrow);
                setFDesc(""); setFAmt("");
              })
            }
          >
            Add
          </Btn>
        </div>
        {data.feeItems.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>No fees or disbursements yet.</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Date</th>
                <th style={S.th}>Type</th>
                <th style={S.th}>Description</th>
                <th style={S.th}>Amount</th>
                <th style={S.th}>Status</th>
                <th style={S.th}></th>
              </tr>
            </thead>
            <tbody>
              {data.feeItems.map((f) => (
                <tr key={f.id}>
                  <td style={S.td}>{d10(f.item_date)}</td>
                  <td style={S.td}>{f.kind === "disbursement" ? "Disbursement" : "Fee"}</td>
                  <td style={S.td}>{f.description}</td>
                  <td style={S.td}>{fmtMoney(f.amount, currency)}</td>
                  <td style={S.td}>{f.invoice_id != null ? <StatusBadge status="issued" /> : <span style={{ color: "#6b7280", fontSize: 12 }}>Unbilled</span>}</td>
                  <td style={S.td}>
                    {f.invoice_id == null && (
                      <Btn
                        small
                        kind="danger"
                        disabled={busy}
                        onClick={() => run(() => request(`/${matterId}/billing/fee-items/${f.id}`, { method: "DELETE" }).then(jsonOrThrow))}
                      >
                        Delete
                      </Btn>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invoices */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h3 style={{ ...S.h, marginBottom: 0 }}>Invoices for this matter</h3>
          <Btn accent={accent} disabled={busy || (unbilledTime.length === 0 && unbilledFees.length === 0)} onClick={() => setInvOpen((v) => !v)}>
            Generate invoice
          </Btn>
        </div>
        {invOpen && (
          <div style={{ background: "#faf8f3", border: "1px solid #eae6dc", borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <input style={{ ...S.input, flex: "1 1 180px" }} placeholder="Client name" value={invClient} onChange={(e) => setInvClient(e.target.value)} />
              <input style={{ ...S.input, width: 110 }} placeholder="Tax % (opt.)" inputMode="decimal" value={invTax} onChange={(e) => setInvTax(e.target.value)} />
            </div>
            <textarea
              style={{ ...S.input, width: "100%", minHeight: 50, boxSizing: "border-box", marginBottom: 8 }}
              placeholder="Client address (appears on the invoice)"
              value={invAddress}
              onChange={(e) => setInvAddress(e.target.value)}
            />
            <textarea
              style={{ ...S.input, width: "100%", minHeight: 40, boxSizing: "border-box", marginBottom: 8 }}
              placeholder="Notes / payment instructions (optional)"
              value={invNotes}
              onChange={(e) => setInvNotes(e.target.value)}
            />
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              All unbilled time ({unbilledTime.length}) and fee items ({unbilledFees.length}) will be included as itemised lines. The invoice starts as a draft.
            </div>
            <Btn
              accent={accent}
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await request(`/${matterId}/billing/invoices`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      clientName: invClient.trim() || undefined,
                      clientAddress: invAddress.trim() || undefined,
                      taxPercent: invTax.trim() ? n(invTax) : undefined,
                      notes: invNotes.trim() || undefined,
                    }),
                  }).then(jsonOrThrow);
                  setInvOpen(false);
                })
              }
            >
              Create draft invoice
            </Btn>
          </div>
        )}
        {data.invoices.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>No invoices yet.</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Invoice</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Total</th>
                <th style={S.th}>Paid</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600 }}>{inv.invoice_no}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>Due {d10(inv.due_date)}</div>
                  </td>
                  <td style={S.td}><StatusBadge status={inv.status} /></td>
                  <td style={S.td}>{fmtMoney(inv.total, currency)}</td>
                  <td style={S.td}>{fmtMoney(inv.amount_paid, currency)}</td>
                  <td style={S.td}>
                    <InvoiceActions invoice={inv} request={request} accent={accent} currency={currency} onChanged={() => void reload()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── BillingPage (portal-level) ────────────────────────────────────────────────

export function BillingPage({
  request,
  accent = "#8a6d2f",
  currency = "RM",
  matterLink,
}: CommonProps & { matterLink?: (matterId: number) => string }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<{
    outstanding: string;
    aging: { current: string; overdue1to30: string; overdue31to60: string; overdue60plus: string };
  } | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [list, st] = await Promise.all([
        request(`/billing/invoices`).then(jsonOrThrow) as Promise<{ invoices: Invoice[]; summary: typeof summary }>,
        request(`/billing/settings`).then(jsonOrThrow) as Promise<Settings>,
      ]);
      setInvoices(list.invoices);
      setSummary(list.summary as typeof summary);
      setSettings(st);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (settings) {
      setForm({
        firmName: settings.firm_name ?? "",
        firmAddress: settings.firm_address ?? "",
        firmPhone: settings.firm_phone ?? "",
        firmEmail: settings.firm_email ?? "",
        defaultHourlyRate: settings.default_hourly_rate ?? "",
        taxPercent: settings.tax_percent ?? "0",
        invoicePrefix: settings.invoice_prefix ?? "INV",
      });
    }
  }, [settings]);

  const shown = useMemo(
    () => (filter === "all" ? invoices : invoices.filter((i) => i.status === filter)),
    [invoices, filter],
  );

  if (loading) return <div style={{ padding: 20, color: "#6b7280", fontSize: 14 }}>Loading billing…</div>;

  return (
    <div>
      {error && <div style={S.err}>{error}</div>}

      {summary && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <SummaryCard label="Outstanding" value={fmtMoney(summary.outstanding, currency)} accent={accent} />
          <SummaryCard label="Not yet due" value={fmtMoney(summary.aging.current, currency)} />
          <SummaryCard label="Overdue 1–30d" value={fmtMoney(summary.aging.overdue1to30, currency)} />
          <SummaryCard label="Overdue 31–60d" value={fmtMoney(summary.aging.overdue31to60, currency)} />
          <SummaryCard label="Overdue 60d+" value={fmtMoney(summary.aging.overdue60plus, currency)} />
        </div>
      )}

      {/* Firm settings */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ ...S.h, marginBottom: 0 }}>Firm billing settings</h3>
          <Btn kind="ghost" accent={accent} small onClick={() => setSettingsOpen((v) => !v)}>
            {settingsOpen ? "Hide" : "Edit"}
          </Btn>
        </div>
        {settingsOpen && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              <input style={{ ...S.input, flex: "1 1 200px" }} placeholder="Firm name (on invoices)" value={form.firmName ?? ""} onChange={(e) => setForm({ ...form, firmName: e.target.value })} />
              <input style={{ ...S.input, width: 150 }} placeholder="Phone" value={form.firmPhone ?? ""} onChange={(e) => setForm({ ...form, firmPhone: e.target.value })} />
              <input style={{ ...S.input, flex: "1 1 180px" }} placeholder="Email" value={form.firmEmail ?? ""} onChange={(e) => setForm({ ...form, firmEmail: e.target.value })} />
            </div>
            <textarea
              style={{ ...S.input, width: "100%", minHeight: 46, boxSizing: "border-box", marginBottom: 8 }}
              placeholder="Firm address"
              value={form.firmAddress ?? ""}
              onChange={(e) => setForm({ ...form, firmAddress: e.target.value })}
            />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <input style={{ ...S.input, width: 170 }} placeholder={`Default rate (${currency}/hr)`} inputMode="decimal" value={form.defaultHourlyRate ?? ""} onChange={(e) => setForm({ ...form, defaultHourlyRate: e.target.value })} />
              <input style={{ ...S.input, width: 110 }} placeholder="Tax %" inputMode="decimal" value={form.taxPercent ?? ""} onChange={(e) => setForm({ ...form, taxPercent: e.target.value })} />
              <input style={{ ...S.input, width: 110 }} placeholder="Prefix" value={form.invoicePrefix ?? ""} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} />
              <Btn
                accent={accent}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setSaved(false);
                  try {
                    await request(`/billing/settings`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        firmName: form.firmName,
                        firmAddress: form.firmAddress,
                        firmPhone: form.firmPhone,
                        firmEmail: form.firmEmail,
                        invoicePrefix: form.invoicePrefix,
                        defaultHourlyRate: form.defaultHourlyRate.trim() === "" ? null : n(form.defaultHourlyRate),
                        taxPercent: n(form.taxPercent),
                      }),
                    }).then(jsonOrThrow);
                    setSaved(true);
                    await reload();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Failed to save settings");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Save settings
              </Btn>
              {saved && <span style={{ color: "#15803d", fontSize: 13 }}>Saved ✓</span>}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
              The default hourly rate is used for time entries that don't match a rate card entry.
            </div>

            {/* Rate card section */}
            {settings && (
              <RateCardPanel
                rateCards={settings.rateCards ?? []}
                request={request}
                accent={accent}
                currency={currency}
                onChanged={() => void reload()}
              />
            )}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ ...S.h, marginBottom: 0 }}>All invoices</h3>
          <select style={S.input} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="issued">Issued</option>
            <option value="partly_paid">Partly paid</option>
            <option value="paid">Paid</option>
            <option value="void">Void</option>
          </select>
        </div>
        {shown.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            No invoices{filter !== "all" ? " with this status" : " yet — open a matter's Billing tab to log time and generate one"}.
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Invoice</th>
                <th style={S.th}>Client</th>
                <th style={S.th}>Matter</th>
                <th style={S.th}>Status</th>
                <th style={S.th}>Total</th>
                <th style={S.th}>Balance</th>
                <th style={S.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((inv) => (
                <tr key={inv.id}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 600 }}>{inv.invoice_no}</div>
                    <div style={{ fontSize: 11, color: "#6b7280" }}>
                      Issued {d10(inv.issue_date)} · Due {d10(inv.due_date)}
                    </div>
                  </td>
                  <td style={S.td}>{inv.client_name ?? "—"}</td>
                  <td style={S.td}>
                    {matterLink ? (
                      <a href={matterLink(inv.matter_id)} style={{ color: accent, textDecoration: "none", fontWeight: 600 }}>
                        #{inv.matter_id}
                      </a>
                    ) : (
                      `#${inv.matter_id}`
                    )}
                  </td>
                  <td style={S.td}><StatusBadge status={inv.status} /></td>
                  <td style={S.td}>{fmtMoney(inv.total, currency)}</td>
                  <td style={S.td}>{fmtMoney(n(inv.total) - n(inv.amount_paid), currency)}</td>
                  <td style={S.td}>
                    <InvoiceActions invoice={inv} request={request} accent={accent} currency={currency} onChanged={() => void reload()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
