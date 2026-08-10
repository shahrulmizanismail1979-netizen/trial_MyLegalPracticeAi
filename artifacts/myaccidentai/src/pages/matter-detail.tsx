import { useState, useEffect } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  ArrowLeft,
  Loader2,
  CalendarClock,
  AlertTriangle,
  Trash2,
  Plus,
  CheckSquare,
  Square,
  FileText,
  Clock,
  Home,
  Sparkles,
  Trash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAccidentCheckSession } from "@workspace/api-client-react";
import {
  useMatter,
  useUpdateMatter,
  useDeleteMatter,
  useMatterWork,
  useDeadlineTriggers,
  useComputeDeadlines,
  useAddDeadlinesBulk,
  useAddDeadline,
  useUpdateDeadline,
  useDeleteDeadline,
  useChecklist,
  useAddChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useTimeEntries,
  useAddTimeEntry,
  useDeleteTimeEntry,
  useUpdateStage,
  daysUntil,
  categoryMeta,
  ACC_STAGES,
  type ComputedDeadline,
} from "@/hooks/use-matters";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Tab = "overview" | "deadlines" | "checklist" | "documents" | "time";

export default function MatterDetailPage() {
  const [, params] = useRoute("/workspace/matters/:id");
  const matterId = params?.id ? parseInt(params.id, 10) : null;
  const [, setLocation] = useLocation();

  const { data: session, isLoading: sessionLoading } = useAccidentCheckSession();
  useEffect(() => {
    if (!sessionLoading && (!session || !session.authenticated)) {
      setLocation("/login");
    }
  }, [session, sessionLoading, setLocation]);

  const { data: matter, isLoading, error } = useMatter(matterId);
  const [tab, setTab] = useState<Tab>("overview");

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !matter) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-muted-foreground">Matter not found.</p>
        <Link href="/workspace/matters">
          <Button variant="outline" size="sm" className="mt-4 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to matters
          </Button>
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
    { id: "overview", label: "Overview", icon: FileText },
    { id: "deadlines", label: "Deadlines", icon: CalendarClock },
    { id: "checklist", label: "Checklist", icon: CheckSquare },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "time", label: "Time", icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/workspace/matters">
              <Button variant="ghost" size="icon" data-testid="link-back">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-serif font-bold truncate" data-testid="text-matter-title">{matter.title}</h1>
              <p className="text-xs text-muted-foreground truncate">
                {matter.fileRef} {matter.court ? `· ${matter.court}` : ""}{" "}
                {matter.caseNo ? `· ${matter.caseNo}` : ""}
              </p>
            </div>
          </div>
          <Link href="/">
            <Button variant="outline" size="sm" className="gap-2">
              <Home className="h-4 w-4" /> Home
            </Button>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 pt-4">
        <div className="flex gap-1 border-b border-border overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`tab-${t.id}`}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto p-6">
        {tab === "overview" && <OverviewTab matterId={matterId!} matter={matter} />}
        {tab === "deadlines" && <DeadlinesTab matterId={matterId!} deadlines={matter.deadlines} />}
        {tab === "checklist" && <ChecklistTab matterId={matterId!} />}
        {tab === "documents" && <DocumentsTab matterId={matterId!} />}
        {tab === "time" && <TimeTab matterId={matterId!} />}
      </main>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewTab({ matterId, matter }: { matterId: number; matter: NonNullable<ReturnType<typeof useMatter>["data"]> }) {
  const update = useUpdateMatter();
  const del = useDeleteMatter();
  const updateStage = useUpdateStage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [form, setForm] = useState({
    clientName: matter.clientName ?? "",
    actingFor: matter.actingFor ?? "",
    plaintiff: matter.plaintiff ?? "",
    defendant: matter.defendant ?? "",
    court: matter.court ?? "",
    caseNo: matter.caseNo ?? "",
    claimAmount: matter.claimAmount ?? "",
    notes: matter.notes ?? "",
  });

  const save = async () => {
    try {
      await update.mutateAsync({ id: matterId, ...form });
      toast({ title: "Matter saved" });
    } catch {
      toast({ title: "Could not save", variant: "destructive" });
    }
  };

  const remove = async () => {
    if (!confirm("Delete this matter? Filed documents and deadlines will be removed.")) return;
    try {
      await del.mutateAsync(matterId);
      setLocation("/workspace/matters");
    } catch {
      toast({ title: "Could not delete", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <Label className="text-xs font-semibold">Stage</Label>
            <Select
              value={ACC_STAGES.includes(matter.status) ? matter.status : ""}
              onValueChange={(v) => updateStage.mutate({ matterId, stage: v })}
            >
              <SelectTrigger className="w-56" data-testid="select-stage">
                <SelectValue placeholder="Set stage…" />
              </SelectTrigger>
              <SelectContent>
                {ACC_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Client name" value={form.clientName} onChange={(v) => setForm({ ...form, clientName: v })} testid="ov-client" />
            <Field label="Acting for" value={form.actingFor} onChange={(v) => setForm({ ...form, actingFor: v })} testid="ov-acting" />
            <Field label="Plaintiff" value={form.plaintiff} onChange={(v) => setForm({ ...form, plaintiff: v })} testid="ov-plaintiff" />
            <Field label="Defendant" value={form.defendant} onChange={(v) => setForm({ ...form, defendant: v })} testid="ov-defendant" />
            <Field label="Court" value={form.court} onChange={(v) => setForm({ ...form, court: v })} testid="ov-court" />
            <Field label="Case no." value={form.caseNo} onChange={(v) => setForm({ ...form, caseNo: v })} testid="ov-caseno" />
            <Field label="Claim amount (RM)" value={form.claimAmount} onChange={(v) => setForm({ ...form, claimAmount: v })} testid="ov-claim" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={4} data-testid="ov-notes" />
          </div>
          <div className="flex justify-between">
            <Button variant="outline" size="sm" className="gap-2 text-destructive border-destructive/40" onClick={remove} data-testid="button-delete-matter">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
            <Button size="sm" onClick={save} disabled={update.isPending} className="gap-2" data-testid="button-save-matter">
              {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, testid }: { label: string; value: string; onChange: (v: string) => void; testid: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} />
    </div>
  );
}

// ── Deadlines ───────────────────────────────────────────────────────────────

function DeadlinesTab({ matterId, deadlines }: { matterId: number; deadlines: NonNullable<ReturnType<typeof useMatter>["data"]>["deadlines"] }) {
  const { data: triggers } = useDeadlineTriggers();
  const compute = useComputeDeadlines();
  const addBulk = useAddDeadlinesBulk();
  const addOne = useAddDeadline();
  const updateDl = useUpdateDeadline();
  const deleteDl = useDeleteDeadline();
  const { toast } = useToast();

  const [trigger, setTrigger] = useState("");
  const [triggerDate, setTriggerDate] = useState("");
  const [preview, setPreview] = useState<ComputedDeadline[]>([]);

  const [manualTitle, setManualTitle] = useState("");
  const [manualDate, setManualDate] = useState("");

  const runCompute = async () => {
    if (!trigger || !triggerDate) return;
    try {
      const res = await compute.mutateAsync({ matterId, trigger, triggerDate });
      setPreview(res);
    } catch {
      toast({ title: "Could not compute deadlines", variant: "destructive" });
    }
  };

  const addPreview = async () => {
    if (preview.length === 0) return;
    try {
      await addBulk.mutateAsync({ matterId, deadlines: preview });
      setPreview([]);
      toast({ title: "Deadlines added to diary" });
    } catch {
      toast({ title: "Could not add deadlines", variant: "destructive" });
    }
  };

  const addManual = async () => {
    if (!manualTitle.trim() || !manualDate) return;
    try {
      await addOne.mutateAsync({ matterId, title: manualTitle.trim(), dueDate: new Date(manualDate).toISOString() });
      setManualTitle("");
      setManualDate("");
    } catch {
      toast({ title: "Could not add deadline", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Compute from trigger */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Compute standard deadlines
          </h3>
          <p className="text-xs text-muted-foreground">
            Pick a trigger event and its date to generate the ordinary statutory deadlines. Always verify
            each date against the sealed process and the applicable enactment before relying on it.
          </p>
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Trigger</Label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger data-testid="select-trigger">
                  <SelectValue placeholder="Select trigger…" />
                </SelectTrigger>
                <SelectContent>
                  {(triggers ?? []).map((t) => (
                    <SelectItem key={t.trigger} value={t.trigger}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={triggerDate} onChange={(e) => setTriggerDate(e.target.value)} data-testid="input-trigger-date" />
            </div>
            <Button size="sm" onClick={runCompute} disabled={compute.isPending || !trigger || !triggerDate} className="gap-2" data-testid="button-compute">
              {compute.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Compute
            </Button>
          </div>

          {preview.length > 0 && (
            <div className="space-y-2 pt-2">
              {preview.map((d, i) => {
                const meta = categoryMeta(d.category);
                return (
                  <div key={i} className="rounded-lg border border-border bg-background px-3 py-2" data-testid={`preview-${i}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{d.title}</span>
                      <Badge variant="outline" className={meta.color}>{fmtDate(d.dueDate)}</Badge>
                    </div>
                    {d.basis && <div className="text-[11px] text-muted-foreground mt-0.5">{d.basis}</div>}
                  </div>
                );
              })}
              <Button size="sm" onClick={addPreview} disabled={addBulk.isPending} className="gap-2 mt-1" data-testid="button-add-preview">
                {addBulk.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Add {preview.length} to diary
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual deadline */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold">Add a manual deadline</h3>
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Title</Label>
              <Input value={manualTitle} onChange={(e) => setManualTitle(e.target.value)} data-testid="input-manual-title" />
            </div>
            <div>
              <Label className="text-xs">Due date</Label>
              <Input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} data-testid="input-manual-date" />
            </div>
            <Button size="sm" onClick={addManual} disabled={addOne.isPending || !manualTitle.trim() || !manualDate} className="gap-2" data-testid="button-add-manual">
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diary */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Deadline diary</h3>
        {deadlines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No deadlines yet.</p>
        ) : (
          deadlines.map((d) => {
            const days = daysUntil(d.dueDate);
            const meta = categoryMeta(d.category);
            const done = d.status === "done";
            return (
              <div key={d.id} className={`flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 ${done ? "opacity-60" : ""}`} data-testid={`deadline-${d.id}`}>
                <div className="min-w-0">
                  <div className={`text-sm font-medium ${done ? "line-through" : ""}`}>{d.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                    <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                    <span>{fmtDate(d.dueDate)}</span>
                    {!done && (
                      <span className={days < 0 ? "text-red-400" : days <= 7 ? "text-amber-400" : ""}>
                        {days < 0 ? (
                          <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {Math.abs(days)}d overdue</span>
                        ) : `${days}d`}
                      </span>
                    )}
                  </div>
                  {d.basis && <div className="text-[11px] text-muted-foreground mt-0.5">{d.basis}</div>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => updateDl.mutate({ matterId, id: d.id, status: done ? "pending" : "done" })} data-testid={`button-toggle-${d.id}`}>
                    {done ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4 text-emerald-400" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteDl.mutate({ matterId, id: d.id })} data-testid={`button-delete-deadline-${d.id}`}>
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Checklist ───────────────────────────────────────────────────────────────

function ChecklistTab({ matterId }: { matterId: number }) {
  const { data: items, isLoading } = useChecklist(matterId);
  const add = useAddChecklistItem();
  const upd = useUpdateChecklistItem();
  const del = useDeleteChecklistItem();
  const [text, setText] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a checklist item…" data-testid="input-checklist" onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { add.mutate({ matterId, item_text: text.trim() }); setText(""); } }} />
        <Button size="sm" onClick={() => { if (text.trim()) { add.mutate({ matterId, item_text: text.trim() }); setText(""); } }} className="gap-2" data-testid="button-add-checklist">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (items?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No checklist items yet — an AI procedural checklist is generated when a matter is created.</p>
      ) : (
        <div className="space-y-1.5">
          {(items ?? []).map((it) => (
            <div key={it.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5" data-testid={`checklist-${it.id}`}>
              <button onClick={() => upd.mutate({ matterId, itemId: it.id, done: !it.done })} data-testid={`toggle-checklist-${it.id}`}>
                {it.done ? <CheckSquare className="h-4 w-4 text-emerald-400" /> : <Square className="h-4 w-4 text-muted-foreground" />}
              </button>
              <span className={`text-sm flex-1 ${it.done ? "line-through text-muted-foreground" : ""}`}>{it.item_text}</span>
              <Button variant="ghost" size="icon" onClick={() => del.mutate({ matterId, itemId: it.id })} data-testid={`delete-checklist-${it.id}`}>
                <Trash className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Documents (filed saved work) ──────────────────────────────────────────────

function DocumentsTab({ matterId }: { matterId: number }) {
  const { data: work, isLoading } = useMatterWork(matterId);
  const [openId, setOpenId] = useState<number | null>(null);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if ((work?.length ?? 0) === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No filed documents yet. Generate a draft or analysis in the workspace and use “Save into a matter file”.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {(work ?? []).map((w) => (
        <Card key={w.id} data-testid={`doc-${w.id}`}>
          <CardContent className="p-4">
            <button className="w-full text-left" onClick={() => setOpenId(openId === w.id ? null : w.id)}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{w.title}</span>
                <Badge variant="outline">{w.kind}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(w.updatedAt)}</div>
            </button>
            {openId === w.id && (
              <pre className="mt-3 text-xs leading-relaxed font-mono whitespace-pre-wrap p-3 bg-background border border-border rounded max-h-[400px] overflow-auto" data-testid={`doc-content-${w.id}`}>
                {w.content}
              </pre>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Time entries ──────────────────────────────────────────────────────────────

function TimeTab({ matterId }: { matterId: number }) {
  const { data, isLoading } = useTimeEntries(matterId);
  const add = useAddTimeEntry();
  const del = useDeleteTimeEntry();
  const { toast } = useToast();

  const [desc, setDesc] = useState("");
  const [minutes, setMinutes] = useState("");

  const submit = async () => {
    const m = parseInt(minutes, 10);
    if (!desc.trim() || Number.isNaN(m) || m <= 0) {
      toast({ title: "Enter a description and minutes", variant: "destructive" });
      return;
    }
    try {
      await add.mutateAsync({ matterId, description: desc.trim(), minutes: m });
      setDesc("");
      setMinutes("");
    } catch {
      toast({ title: "Could not add time entry", variant: "destructive" });
    }
  };

  const total = data?.totalMinutes ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex gap-2 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Description</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} data-testid="input-time-desc" />
            </div>
            <div className="w-28">
              <Label className="text-xs">Minutes</Label>
              <Input value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" data-testid="input-time-minutes" />
            </div>
            <Button size="sm" onClick={submit} disabled={add.isPending} className="gap-2" data-testid="button-add-time">
              <Plus className="h-4 w-4" /> Log
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Total recorded: <span className="font-semibold text-foreground">{Math.floor(total / 60)}h {total % 60}m</span>
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (data?.entries.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">No time entries yet.</p>
      ) : (
        <div className="space-y-1.5">
          {(data?.entries ?? []).map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5" data-testid={`time-${e.id}`}>
              <div className="min-w-0">
                <div className="text-sm truncate">{e.description}</div>
                <div className="text-xs text-muted-foreground">{fmtDate(e.entry_date)}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-medium">{Math.floor(e.minutes / 60)}h {e.minutes % 60}m</span>
                <Button variant="ghost" size="icon" onClick={() => del.mutate({ matterId, entryId: e.id })} data-testid={`delete-time-${e.id}`}>
                  <Trash className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
