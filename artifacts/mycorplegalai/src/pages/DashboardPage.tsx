import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useMatters, useUpcomingDeadlines, useCreateMatter, useMattersBriefing,
  usePrepareMatter, daysUntil, fmtDate, ApiError,
  type MatterInput, type MatterBriefing,
} from "@/hooks/use-matters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FolderKanban, Plus, ArrowRight, CalendarClock,
  AlertTriangle, Scale, Sparkles, BrainCircuit, ChevronRight,
  ListChecks, Loader2, RefreshCw, Target,
} from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  "on-hold": { label: "On Hold", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  closed: { label: "Closed", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? STATUS_META.open;
}

const EMPTY: MatterInput = {
  title: "",
  clientName: "",
  counterparty: "",
  matterType: "",
  reference: "",
  status: "Instruction",
  notes: "",
};

const inputCls =
  "w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: matters } = useMatters();
  const { data: upcoming } = useUpcomingDeadlines(30);
  const { data: briefing, isLoading: briefingLoading, error: briefingError, refetch: refetchBriefing } = useMattersBriefing();
  const createMatter = useCreateMatter();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MatterInput>(EMPTY);
  const [prepareFor, setPrepareFor] = useState<MatterBriefing | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      setLocation("/login");
    }
  }, [setLocation]);

  const set = (k: keyof MatterInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title?.trim()) {
      toast({ title: "Matter title required", variant: "destructive" });
      return;
    }
    try {
      const m = await createMatter.mutateAsync(form);
      toast({ title: "Matter created" });
      setOpen(false);
      setForm(EMPTY);
      setLocation(`/matters/${m.id}`);
    } catch (e) {
      toast({ title: "Could not create matter", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const activeMatters = (matters ?? []).filter((m) => m.status !== "Closed" && m.status !== "closed");
  const overdueCount = (upcoming ?? []).filter((d) => daysUntil(d.dueDate) < 0).length;
  const urgentCount = (upcoming ?? []).filter((d) => { const dd = daysUntil(d.dueDate); return dd >= 0 && dd <= 7; }).length;

  return (
    <AppLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap border-b border-purple-500/15 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 flex items-center justify-center">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground">MYCorpLegalAI</h1>
              <p className="text-sm text-muted-foreground">Corporate matter management · AI-powered practice</p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Matter
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FolderKanban className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-2xl font-bold text-foreground">{activeMatters.length}</p>
                <p className="text-xs text-muted-foreground">Active matters</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-2xl font-bold text-foreground">{(upcoming ?? []).length}</p>
                <p className="text-xs text-muted-foreground">Deadlines (30d)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-amber-400">{urgentCount}</p>
                <p className="text-xs text-muted-foreground">Due within 7d</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
              <div>
                <p className="text-2xl font-bold text-red-400">{overdueCount}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Cases */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-purple-300/80 uppercase tracking-wider flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-primary" />
              My Cases
            </h2>
            <Link href="/matters" className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 px-3 py-1.5 rounded-md border border-primary/20 hover:bg-primary/5 transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {briefingLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <Card key={i}><CardContent className="p-5 space-y-3 animate-pulse">
                  <div className="h-3 w-20 bg-muted rounded" />
                  <div className="h-4 w-3/4 bg-muted rounded" />
                  <div className="h-1.5 w-full bg-muted rounded" />
                  <div className="h-10 w-full bg-muted rounded" />
                </CardContent></Card>
              ))}
            </div>
          ) : briefingError ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="h-10 w-10 text-red-400/70 mx-auto mb-3" />
                <h3 className="font-serif font-semibold text-foreground mb-1">Couldn't load your cases</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  {briefingError instanceof Error ? briefingError.message : "An unexpected error occurred."}
                </p>
                <Button variant="outline" className="gap-2" onClick={() => refetchBriefing()}>
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              </CardContent>
            </Card>
          ) : (briefing?.matters.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-serif font-semibold text-foreground mb-1">No matters yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  Open a matter for each client engagement to track AI-generated advice, deadlines, and billing.
                </p>
                <Button onClick={() => setOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" /> Create your first matter
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orderedBriefing(briefing?.matters ?? []).map((m) => (
                <MatterBriefingCard key={m.id} m={m} onPrepare={() => setPrepareFor(m)} />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming deadlines */}
        {(upcoming ?? []).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-purple-300/80 uppercase tracking-wider flex items-center gap-2 mb-4">
              <CalendarClock className="w-4 h-4 text-primary" />
              Upcoming Deadlines (30 days)
            </h2>
            <div className="space-y-2">
              {(upcoming ?? []).slice(0, 5).map((d) => {
                const days = daysUntil(d.dueDate);
                return (
                  <Link key={d.id} href={`/matters/${d.matterId}`}>
                    <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{d.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{d.matterTitle}{d.reference ? ` · ${d.reference}` : ""}</p>
                        </div>
                        <span className={`text-xs font-bold shrink-0 ${
                          days < 0 ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-muted-foreground"
                        }`}>
                          {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? "Today" : `in ${days}d`}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* AI tools quick access */}
        <div className="border-t border-purple-500/10 pt-6">
          <h2 className="text-sm font-semibold text-purple-300/80 uppercase tracking-wider flex items-center gap-2 mb-4">
            <BrainCircuit className="w-4 h-4 text-primary" />
            AI Practice Tools
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: "/tools/legal-opinion", label: "Legal Opinion", desc: "Draft opinions & advice letters" },
              { href: "/tools/dd-report", label: "DD Report", desc: "Due diligence reports" },
              { href: "/tools/contract-review", label: "Contract Review", desc: "Analyse contracts for risk" },
              { href: "/tools/board-resolution", label: "Resolutions", desc: "Board & shareholder resolutions" },
            ].map((t) => (
              <Link key={t.href} href={t.href}>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
                  <CardContent className="p-4">
                    <p className="font-medium text-sm text-foreground">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="mt-3 text-center">
            <Link href="/tools" className="text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1">
              <Sparkles className="h-3.5 w-3.5" /> View all AI tools <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* New matter dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">New Matter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg p-3">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Only the title is required. An AI-generated procedural checklist will be created automatically.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Matter title *</Label>
              <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Acme Bhd — Series A Financing" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Input value={form.clientName ?? ""} onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. Acme Bhd" />
              </div>
              <div className="space-y-1.5">
                <Label>Counterparty</Label>
                <Input value={form.counterparty ?? ""} onChange={(e) => set("counterparty", e.target.value)} placeholder="e.g. Beta Capital" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Matter type</Label>
                <Input value={form.matterType ?? ""} onChange={(e) => set("matterType", e.target.value)} placeholder="e.g. M&A, Compliance" />
              </div>
              <div className="space-y-1.5">
                <Label>Reference</Label>
                <Input value={form.reference ?? ""} onChange={(e) => set("reference", e.target.value)} placeholder="e.g. MCL/2026/1234" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <select value={form.status ?? "Instruction"} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                {["Instruction", "Due Diligence", "Advisory", "Opinion Delivered", "Closed"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Background, deal terms, key contacts…" rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createMatter.isPending}>
              {createMatter.isPending ? "Creating…" : "Create matter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PrepareDialog matter={prepareFor} onClose={() => setPrepareFor(null)} />
    </AppLayout>
  );
}

function isClosed(status: string) {
  return status === "Closed" || status === "closed";
}

function orderedBriefing(matters: MatterBriefing[]): MatterBriefing[] {
  const active = matters.filter((m) => !isClosed(m.status));
  const closed = matters.filter((m) => isClosed(m.status));
  return [...active, ...closed];
}

function MatterBriefingCard({ m, onPrepare }: { m: MatterBriefing; onPrepare: () => void }) {
  const sm = statusMeta(m.status);
  const closed = isClosed(m.status);
  const checklistPct = m.checklist_total > 0 ? Math.round((m.checklist_done / m.checklist_total) * 100) : 0;
  return (
    <Card className={`flex flex-col h-full ${closed ? "opacity-60" : "hover:border-primary/50 transition-all"}`} data-testid={`card-matter-${m.id}`}>
      <CardContent className="p-5 flex flex-col gap-3 flex-1">
        <Link href={`/matters/${m.id}`} className="flex flex-col gap-3 group cursor-pointer">
          <div className="flex items-start justify-between gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sm.color}`}>
              {m.status}
            </span>
            {m.matter_type && (
              <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[50%] flex items-center gap-1">
                <Target className="h-3 w-3" /> {m.matter_type}
              </span>
            )}
          </div>
          <h3 className="font-serif font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {m.title}
          </h3>

          {/* Stage progress */}
          {m.stage_index >= 0 && m.stage_count > 0 && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>Stage {m.stage_index + 1} of {m.stage_count}</span>
              </div>
              <Progress value={Math.round(((m.stage_index + 1) / m.stage_count) * 100)} className="h-1.5" />
            </div>
          )}

          {/* Checklist progress */}
          {m.checklist_total > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5 shrink-0" />
              <span className="shrink-0">Checklist {m.checklist_done}/{m.checklist_total}</span>
              <div className="flex-1"><Progress value={checklistPct} className="h-1.5" /></div>
            </div>
          )}

          {/* Next deadline */}
          {m.next_deadline && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CalendarClock className="h-3 w-3 shrink-0" />
              <span className="truncate">{m.next_deadline.title} · {fmtDate(m.next_deadline.due_date)}</span>
              {m.overdue_count > 0 && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border text-red-400 border-red-500/30 bg-red-500/10 shrink-0">
                  <AlertTriangle className="h-2.5 w-2.5" /> overdue
                </span>
              )}
            </div>
          )}

          {/* Next step (prominent) */}
          {m.next_step && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-primary/80 font-semibold flex items-center gap-1 mb-0.5">
                <ArrowRight className="h-3 w-3" /> Next
              </p>
              <p className="text-xs text-foreground font-medium leading-snug">
                {m.next_step.label}
                {m.next_step.due_date && (
                  <span className="text-muted-foreground font-normal"> · {fmtDate(m.next_step.due_date)}</span>
                )}
              </p>
            </div>
          )}
        </Link>

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/60">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-7 text-xs"
            onClick={onPrepare}
            data-testid={`btn-prepare-${m.id}`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Prepare with AI
          </Button>
          <Link href={`/matters/${m.id}`} className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1">
            Open <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function PrepareDialog({ matter, onClose }: { matter: MatterBriefing | null; onClose: () => void }) {
  const prepare = usePrepareMatter();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const run = async (m: MatterBriefing) => {
    setMarkdown(null);
    setErrMsg(null);
    try {
      const res = await prepare.mutateAsync({ id: m.id, step: m.next_step?.label });
      setMarkdown(res.preparation ?? "");
    } catch (e) {
      setErrMsg(e instanceof ApiError ? e.message : "Preparation failed. Please try again.");
    }
  };

  useEffect(() => {
    if (matter) run(matter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matter?.id]);

  return (
    <Dialog open={!!matter} onOpenChange={(o) => { if (!o) { onClose(); setMarkdown(null); setErrMsg(null); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Prepare with AI
          </DialogTitle>
        </DialogHeader>
        {matter && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{matter.title}</p>
              {matter.next_step && (
                <p className="text-xs text-muted-foreground">Next step: {matter.next_step.label}</p>
              )}
            </div>

            {prepare.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing your next step — this can take up to a minute…
              </div>
            )}

            {errMsg && !prepare.isPending && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm text-red-400 font-medium flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" /> {errMsg}
                </p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => run(matter)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            )}

            {markdown && !prepare.isPending && !errMsg && (
              <pre className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans max-h-[500px] overflow-y-auto bg-background border border-border rounded-md p-4">
                {markdown}
              </pre>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
