import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import WorkspaceLayout from "./layout";
import {
  useMattersBriefing, usePrepareMatter, fmtDate, ApiError,
  type MatterBriefing,
} from "@/hooks/use-matters";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import MarkdownRenderer from "@/components/markdown-renderer";
import {
  Scale, FolderKanban, Plus, ArrowRight, CalendarClock,
  AlertTriangle, Sparkles, BrainCircuit, ChevronRight, Building, Landmark,
  FileText, Shield, Target, ListChecks, Loader2, RefreshCw,
} from "lucide-react";
import { isAuthenticated, authHeaders } from "@/lib/auth";
import { motion } from "framer-motion";
import { ParalegalWidget } from "@workspace/paralegal-widget";

const paralegalRequest = (path: string, init?: RequestInit) =>
  fetch(`/api/ccb${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...authHeaders() },
  });

const CCB_STAGES = ["Pre-Action", "Filing", "Interlocutory", "Trial", "Judgment", "Enforcement", "Closed"];

function statusColor(status: string) {
  if (status === "Closed" || status === "closed") return "text-muted-foreground border-border bg-muted";
  if (CCB_STAGES.includes(status)) {
    const idx = CCB_STAGES.indexOf(status);
    if (idx <= 1) return "text-amber-500 border-amber-500/30 bg-amber-500/10";
    if (idx <= 3) return "text-blue-400 border-blue-400/30 bg-blue-400/10";
    return "text-emerald-500 border-emerald-500/30 bg-emerald-500/10";
  }
  switch (status) {
    case "open": return "text-emerald-500 border-emerald-500/30 bg-emerald-500/10";
    case "closed": return "text-muted-foreground border-border bg-muted";
    default: return "text-amber-500 border-amber-500/30 bg-amber-500/10";
  }
}

function isClosed(status: string) {
  return status === "Closed" || status === "closed";
}

function MatterBriefingCard({ m, onPrepare }: { m: MatterBriefing; onPrepare: () => void }) {
  const closed = isClosed(m.status);
  const checklistPct = m.checklist_total > 0 ? Math.round((m.checklist_done / m.checklist_total) * 100) : 0;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card
        className={`h-full transition-colors ${closed ? "opacity-60" : "hover:border-primary/40"}`}
        data-testid={`card-matter-${m.id}`}
      >
        <CardContent className="p-5 flex flex-col h-full">
          <Link href={`/workspace/matters/${m.id}`}>
            <div className="cursor-pointer">
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-serif font-semibold text-foreground truncate">{m.title}</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${statusColor(m.status)}`}>
                  {m.status}
                </span>
              </div>

              {m.matter_type && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Target className="h-3 w-3" /> {m.matter_type}
                </div>
              )}

              {/* Stage progress */}
              {m.stage_index >= 0 && m.stage_count > 0 && (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span>Stage {m.stage_index + 1} of {m.stage_count}</span>
                  </div>
                  <Progress value={Math.round(((m.stage_index + 1) / m.stage_count) * 100)} className="h-1.5" />
                </div>
              )}

              {/* Checklist progress */}
              {m.checklist_total > 0 && (
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
                  <ListChecks className="h-3 w-3" />
                  <span>Checklist {m.checklist_done}/{m.checklist_total}</span>
                  <div className="flex-1"><Progress value={checklistPct} className="h-1.5" /></div>
                </div>
              )}

              {/* Next deadline */}
              {m.next_deadline && (
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                  <CalendarClock className="h-3 w-3" />
                  <span className="truncate">{m.next_deadline.title} · {fmtDate(m.next_deadline.due_date)}</span>
                  {m.overdue_count > 0 && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border text-red-500 border-red-500/30 bg-red-500/10 shrink-0">
                      <AlertTriangle className="h-2.5 w-2.5" /> overdue
                    </span>
                  )}
                </div>
              )}

              {/* Next step (prominent) */}
              {m.next_step && (
                <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
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
            </div>
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
            <Link href={`/workspace/matters/${m.id}`}>
              <span className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-1 cursor-pointer">
                Open <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PrepareDialog({ matter, onClose }: { matter: MatterBriefing | null; onClose: () => void }) {
  const prepare = usePrepareMatter();
  const [result, setResult] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const run = async (m: MatterBriefing) => {
    setResult(null);
    setErrMsg(null);
    try {
      const res = await prepare.mutateAsync({ id: m.id, step: m.next_step?.label });
      setResult(res.preparation ?? "");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Preparation failed.");
    }
  };

  // Kick off preparation automatically when a matter is selected.
  useEffect(() => {
    if (matter) run(matter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matter?.id]);

  return (
    <Dialog open={!!matter} onOpenChange={(o) => { if (!o) { onClose(); setResult(null); setErrMsg(null); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
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
              <p className="text-sm text-muted-foreground animate-pulse flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparing your next step… this can take up to a minute.
              </p>
            )}

            {errMsg && !prepare.isPending && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
                <p className="text-sm text-destructive font-medium flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4" /> {errMsg}
                </p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => run(matter)}>
                  <RefreshCw className="h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            )}

            {result != null && !prepare.isPending && !errMsg && (
              <div className="border-t border-border pt-3">
                <MarkdownRenderer content={result} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const QUICK_LINKS = [
  { href: "/workspace/tool/statement-of-claim", label: "Draft Cause Papers", icon: FileText, desc: "Statement of claim, defence, counterclaim" },
  { href: "/workspace/tool/injunction-application", label: "Interlocutory Apps", icon: Scale, desc: "Injunctions, summary judgment, striking out" },
  { href: "/workspace/tool/legal-opinion", label: "Legal Opinion", icon: Shield, desc: "Banking & commercial law opinions" },
  { href: "/workspace/tool/costs-calculator", label: "Debt Calculator", icon: Building, desc: "Interest, costs, judgment amounts" },
];

export default function WorkspaceIndex() {
  const [, setLocation] = useLocation();
  const { data: briefing, isLoading, error, refetch } = useMattersBriefing();
  const [prepareFor, setPrepareFor] = useState<MatterBriefing | null>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/access");
    }
  }, [setLocation]);

  const isForbidden = error instanceof ApiError && error.status === 403;
  const allMatters = briefing?.matters ?? [];
  const activeMatters = allMatters.filter((m) => !isClosed(m.status));
  const closedMatters = allMatters.filter((m) => isClosed(m.status));

  return (
    <WorkspaceLayout>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 flex-wrap"
        >
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
              <Landmark className="h-7 w-7 text-primary" />
              Case Command Centre
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Banking litigation and corporate commercial matters — managed from instruction to enforcement.
            </p>
          </div>
          {!isForbidden && (
            <Link href="/workspace/matters">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New Matter
              </Button>
            </Link>
          )}
        </motion.div>

        {/* My Cases */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" /> My Cases
            </h2>
            <Link href="/workspace/matters">
              <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </Link>
          </div>

          {isForbidden ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-serif font-semibold text-lg text-foreground mb-1">Matter files require a subscriber access code</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Sign in with a subscriber access code to access matter management.
                </p>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-52 w-full rounded-xl" />)}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertTriangle className="h-10 w-10 text-destructive/70 mx-auto mb-3" />
                <h3 className="font-serif font-semibold text-lg text-foreground mb-1">Couldn't load your cases</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                  {error instanceof Error ? error.message : "An unexpected error occurred."}
                </p>
                <Button variant="outline" className="gap-2" onClick={() => refetch()}>
                  <RefreshCw className="h-4 w-4" /> Retry
                </Button>
              </CardContent>
            </Card>
          ) : allMatters.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-serif font-semibold text-lg text-foreground mb-1">No matters yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  Open a matter to track your banking litigation files, deadlines, and AI-generated cause papers.
                </p>
                <Link href="/workspace/matters">
                  <Button className="gap-2"><Plus className="h-4 w-4" /> Create your first matter</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...activeMatters, ...closedMatters].map((m) => (
                <MatterBriefingCard key={m.id} m={m} onPrepare={() => setPrepareFor(m)} />
              ))}
            </div>
          )}
        </div>

        <PrepareDialog matter={prepareFor} onClose={() => setPrepareFor(null)} />

        {/* Quick action links */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
            <BrainCircuit className="h-4 w-4 text-primary" /> AI Tools
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {QUICK_LINKS.map((q) => (
              <Link key={q.href} href={q.href}>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full group">
                  <CardContent className="p-4">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center mb-2">
                      <q.icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{q.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{q.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="mt-3">
            <Link href="/workspace/tool/list">
              <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> View all AI tools <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </Link>
          </div>
        </div>

        {/* Navigation tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/workspace/matters", label: "Matter Files", icon: FolderKanban, desc: "All cases & files" },
            { href: "/workspace/calculators", label: "Calculators", icon: Building, desc: "Interest & costs" },
            { href: "/workspace/reference", label: "Reference", icon: Shield, desc: "Legislation & rules" },
            { href: "/workspace/strategy", label: "Strategy", icon: Scale, desc: "Litigation planning" },
          ].map((t) => (
            <Link key={t.href} href={t.href}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 text-center">
                  <t.icon className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-medium text-sm text-foreground">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
      <ParalegalWidget
        portalName="MyCorpCommBankLitAI"
        request={paralegalRequest}
        accent="#8a6d2f"
      />
    </WorkspaceLayout>
  );
}
