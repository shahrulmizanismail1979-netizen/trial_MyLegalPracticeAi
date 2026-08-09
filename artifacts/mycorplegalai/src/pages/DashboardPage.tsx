import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMatters, useUpcomingDeadlines, useCreateMatter, daysUntil, type MatterInput } from "@/hooks/use-matters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FolderKanban, Plus, ArrowRight, Building2, Users, Hash, CalendarClock,
  AlertTriangle, Scale, Sparkles, BrainCircuit, CheckCircle2, ChevronRight,
} from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  "on-hold": { label: "On Hold", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  closed: { label: "Closed", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
};

const CORP_STAGES = ["Instruction", "Due Diligence", "Advisory", "Opinion Delivered", "Closed"];

function statusMeta(s: string) {
  return STATUS_META[s] ?? STATUS_META.open;
}

function stageBadge(status: string) {
  if (CORP_STAGES.includes(status)) {
    const idx = CORP_STAGES.indexOf(status);
    const pct = Math.round((idx / (CORP_STAGES.length - 1)) * 100);
    return { label: status, pct };
  }
  return { label: status, pct: 0 };
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
  const { data: matters, isLoading: mattersLoading } = useMatters();
  const { data: upcoming } = useUpcomingDeadlines(30);
  const createMatter = useCreateMatter();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MatterInput>(EMPTY);

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

        {/* Active matters */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-purple-300/80 uppercase tracking-wider flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-primary" />
              Active Matters
            </h2>
            <Link href="/matters" className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 px-3 py-1.5 rounded-md border border-primary/20 hover:bg-primary/5 transition-colors">
              View all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>

          {mattersLoading ? (
            <div className="p-8 text-center text-primary animate-pulse">Loading matters…</div>
          ) : activeMatters.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-serif font-semibold text-foreground mb-1">No active matters</h3>
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
              {activeMatters.slice(0, 6).map((m) => {
                const sm = statusMeta(m.status);
                const sb = stageBadge(m.status);
                // Find the soonest pending deadline for this matter from upcoming
                const nextDeadline = (upcoming ?? [])
                  .filter((d) => d.matterId === m.id)
                  .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
                return (
                  <Link key={m.id} href={`/matters/${m.id}`}>
                    <Card className="flex flex-col hover:border-primary/50 transition-all cursor-pointer h-full group">
                      <CardContent className="p-5 flex flex-col gap-3 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sm.color}`}>
                            {sb.label || sm.label}
                          </span>
                          {m.matterType && (
                            <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[50%]">{m.matterType}</span>
                          )}
                        </div>
                        <h3 className="font-serif font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                          {m.title}
                        </h3>
                        <div className="space-y-1 text-xs text-muted-foreground flex-1">
                          {m.clientName && (
                            <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{m.clientName}</span></div>
                          )}
                          {m.reference && (
                            <div className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 shrink-0" /><span className="truncate font-mono">{m.reference}</span></div>
                          )}
                        </div>
                        {nextDeadline && (
                          <div className={`flex items-center gap-1.5 text-xs font-medium mt-1 ${
                            daysUntil(nextDeadline.dueDate) < 0 ? "text-red-400" :
                            daysUntil(nextDeadline.dueDate) <= 7 ? "text-amber-400" : "text-muted-foreground"
                          }`}>
                            <CalendarClock className="h-3 w-3 shrink-0" />
                            <span className="truncate">{nextDeadline.title}</span>
                            <span className="shrink-0">
                              {daysUntil(nextDeadline.dueDate) < 0
                                ? `${Math.abs(daysUntil(nextDeadline.dueDate))}d overdue`
                                : daysUntil(nextDeadline.dueDate) === 0
                                ? "Today"
                                : `in ${daysUntil(nextDeadline.dueDate)}d`}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-primary font-medium pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          Open matter <ArrowRight className="h-3.5 w-3.5" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
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
    </AppLayout>
  );
}
