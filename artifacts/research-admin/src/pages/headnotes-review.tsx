/**
 * Headnotes Review — Research Admin
 *
 * Lists all judgments with AI-drafted headnotes and catchwords awaiting
 * editorial review. Editors can accept, reject, or edit individual items,
 * accept everything at once, or trigger a fresh AI regeneration.
 */
import { useCallback, useEffect, useState } from "react";
import {
  headnotesApi,
  type Headnote,
  type Catchword,
  type HeadnotesDetail,
  type HeadnotesListItem,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  RotateCcw,
  Pencil,
  Check,
  X,
  BookOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "accepted"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "rejected"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  const label =
    status === "accepted" ? "Accepted ✓" : status === "rejected" ? "Rejected" : "AI Draft";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── Editable headnote row ─────────────────────────────────────────────────────

function HeadnoteRow({
  item,
  judgmentId,
  onUpdated,
}: {
  item: Headnote;
  judgmentId: number;
  onUpdated: (h: Headnote) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(item.text);
  const [editRef, setEditRef] = useState(item.paragraphRef ?? "");
  const [saving, setSaving] = useState(false);

  const handleStatusChange = async (status: "accepted" | "rejected") => {
    setSaving(true);
    try {
      const updated = await headnotesApi.updateHeadnote(judgmentId, item.id, { status });
      onUpdated(updated);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const updated = await headnotesApi.updateHeadnote(judgmentId, item.id, {
        text: editText,
        paragraphRef: editRef,
      });
      onUpdated(updated);
      setEditing(false);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`rounded-lg border p-4 space-y-2 ${
      item.status === "accepted"
        ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-900/10"
        : item.status === "rejected"
          ? "border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-900/10 opacity-60"
          : "border-border bg-card"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-muted-foreground w-5 text-right">{item.number}.</span>
          <StatusBadge status={item.status} />
          {item.paragraphRef && !editing && (
            <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 font-mono">
              {item.paragraphRef}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!editing && item.status !== "rejected" && (
            <button
              title="Edit"
              onClick={() => { setEditing(true); setEditText(item.text); setEditRef(item.paragraphRef ?? ""); }}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Pencil size={13} />
            </button>
          )}
          {item.status !== "accepted" && (
            <button
              title="Accept"
              disabled={saving}
              onClick={() => handleStatusChange("accepted")}
              className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-40"
            >
              <CheckCircle size={15} />
            </button>
          )}
          {item.status !== "rejected" && (
            <button
              title="Reject"
              disabled={saving}
              onClick={() => handleStatusChange("rejected")}
              className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-40"
            >
              <XCircle size={15} />
            </button>
          )}
          {item.status === "rejected" && (
            <button
              title="Restore to draft"
              disabled={saving}
              onClick={() => handleStatusChange("accepted")}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2 ml-7">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Input
              value={editRef}
              onChange={(e) => setEditRef(e.target.value)}
              placeholder="Paragraph ref, e.g. [14]"
              className="h-8 text-sm w-40"
            />
            <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="h-8">
              <Check size={13} /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-8">
              <X size={13} /> Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed ml-7 text-foreground">{item.text}</p>
      )}
    </div>
  );
}

// ── Editable catchword row ────────────────────────────────────────────────────

function CatchwordRow({
  item,
  judgmentId,
  onUpdated,
}: {
  item: Catchword;
  judgmentId: number;
  onUpdated: (c: Catchword) => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editLine, setEditLine] = useState(item.catchwordLine);
  const [saving, setSaving] = useState(false);

  const handleStatus = async (status: "accepted" | "rejected") => {
    setSaving(true);
    try {
      const updated = await headnotesApi.updateCatchword(judgmentId, item.id, { status });
      onUpdated(updated);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await headnotesApi.updateCatchword(judgmentId, item.id, { catchwordLine: editLine });
      onUpdated(updated);
      setEditing(false);
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
      item.status === "accepted"
        ? "bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800"
        : item.status === "rejected"
          ? "opacity-50 border border-dashed border-border"
          : "bg-muted/40 border border-border"
    }`}>
      <span className="flex-1 font-mono text-xs">
        {editing
          ? <Input value={editLine} onChange={(e) => setEditLine(e.target.value)} className="h-7 text-xs" />
          : item.catchwordLine
        }
      </span>
      <StatusBadge status={item.status} />
      <div className="flex items-center gap-0.5 shrink-0">
        {!editing && (
          <button onClick={() => { setEditing(true); setEditLine(item.catchwordLine); }}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Pencil size={11} />
          </button>
        )}
        {editing && (
          <>
            <button onClick={handleSave} disabled={saving} className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40">
              <Check size={13} />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors">
              <X size={13} />
            </button>
          </>
        )}
        {!editing && item.status !== "accepted" && (
          <button onClick={() => handleStatus("accepted")} disabled={saving}
            className="p-1 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors disabled:opacity-40">
            <Check size={13} />
          </button>
        )}
        {!editing && item.status !== "rejected" && (
          <button onClick={() => handleStatus("rejected")} disabled={saving}
            className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors disabled:opacity-40">
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Judgment detail panel ─────────────────────────────────────────────────────

function JudgmentPanel({
  judgmentId,
  caseName,
  onBack,
}: {
  judgmentId: number;
  caseName: string | null;
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<HeadnotesDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    headnotesApi.get(judgmentId)
      .then(setDetail)
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [judgmentId]);

  useEffect(() => { load(); }, [load]);

  const updateHeadnote = (updated: Headnote) => {
    setDetail((d) => d ? { ...d, headnotes: d.headnotes.map((h) => h.id === updated.id ? updated : h) } : d);
  };

  const updateCatchword = (updated: Catchword) => {
    setDetail((d) => d ? { ...d, catchwords: d.catchwords.map((c) => c.id === updated.id ? updated : c) } : d);
  };

  const acceptAll = async () => {
    setAccepting(true);
    try {
      const r = await headnotesApi.acceptAll(judgmentId);
      toast({ title: "Accepted", description: `${r.acceptedHeadnotes} headnotes, ${r.acceptedCatchwords} catchwords accepted.` });
      load();
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally { setAccepting(false); }
  };

  const regenerate = async () => {
    setRegenerating(true);
    try {
      await headnotesApi.regenerate(judgmentId);
      toast({ title: "Regeneration queued", description: "Fresh AI headnotes will be generated shortly. Refresh in a few moments." });
    } catch (e: unknown) {
      toast({ title: "Error", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    } finally { setRegenerating(false); }
  };

  const pendingCount = detail
    ? detail.headnotes.filter((h) => h.status === "ai_draft").length +
      detail.catchwords.filter((c) => c.status === "ai_draft").length
    : 0;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Back + title */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
            <ChevronLeft size={18} />
          </button>
          <div>
            <h2 className="text-lg font-bold leading-tight">{caseName ?? `Judgment #${judgmentId}`}</h2>
            <p className="text-xs text-muted-foreground">Judgment #{judgmentId} · AI-drafted headnotes & catchwords</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={regenerate} disabled={regenerating}>
            <RotateCcw size={13} className={regenerating ? "animate-spin" : ""} /> Regenerate
          </Button>
          {pendingCount > 0 && (
            <Button size="sm" onClick={acceptAll} disabled={accepting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle size={13} /> Accept All ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      {loading && !detail && (
        <div className="py-16 text-center text-muted-foreground">
          <RefreshCw size={20} className="animate-spin inline" />
        </div>
      )}

      {detail && (
        <>
          {/* Headnotes */}
          <section>
            <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">
              Headnotes ({detail.headnotes.length})
            </h3>
            {detail.headnotes.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No headnotes generated yet.</p>
            ) : (
              <div className="space-y-3">
                {detail.headnotes.map((h) => (
                  <HeadnoteRow key={h.id} item={h} judgmentId={judgmentId} onUpdated={updateHeadnote} />
                ))}
              </div>
            )}
          </section>

          {/* Catchwords */}
          <section>
            <h3 className="font-semibold text-sm mb-3 text-muted-foreground uppercase tracking-wide">
              Catchwords ({detail.catchwords.length})
            </h3>
            {detail.catchwords.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No catchwords generated yet.</p>
            ) : (
              <div className="space-y-1.5">
                {detail.catchwords.map((c) => (
                  <CatchwordRow key={c.id} item={c} judgmentId={judgmentId} onUpdated={updateCatchword} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HeadnotesReviewPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<HeadnotesListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [selectedJudgment, setSelectedJudgment] = useState<HeadnotesListItem | null>(null);
  const LIMIT = 50;

  const loadList = useCallback(() => {
    setLoading(true);
    headnotesApi.list({ limit: LIMIT, offset })
      .then((page) => { setItems(page.items); setTotal(page.total); })
      .catch((e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [offset]);

  useEffect(() => { loadList(); }, [loadList]);

  if (selectedJudgment) {
    return (
      <JudgmentPanel
        judgmentId={selectedJudgment.judgmentId}
        caseName={selectedJudgment.caseName}
        onBack={() => { setSelectedJudgment(null); loadList(); }}
      />
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Headnotes Review</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-drafted law reporter headnotes and catchwords awaiting editorial review
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadList} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {/* List */}
      <div className="rounded-xl border border-border overflow-hidden">
        {loading && items.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <RefreshCw size={18} className="animate-spin inline mr-2" /> Loading…
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="py-16 text-center text-muted-foreground">
            <BookOpen size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No judgments have pending AI-draft headnotes.</p>
            <p className="text-xs mt-1">Headnotes are auto-generated after a judgment reaches the search index.</p>
          </div>
        )}
        {items.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground text-left">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Case Name</th>
                <th className="px-4 py-3 font-medium w-24 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.judgmentId}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedJudgment(item)}
                >
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{item.judgmentId}</td>
                  <td className="px-4 py-3 font-medium">
                    {item.caseName ?? <span className="text-muted-foreground italic">Untitled judgment</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">Review →</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {offset + 1}–{Math.min(offset + LIMIT, total)} of {total.toLocaleString()}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
              <ChevronLeft size={14} /> Previous
            </Button>
            <Button variant="outline" size="sm" disabled={offset + LIMIT >= total} onClick={() => setOffset(offset + LIMIT)}>
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
