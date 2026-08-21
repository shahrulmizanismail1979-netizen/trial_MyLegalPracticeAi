import { useState, useEffect } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  suggestWorkflowId,
  useMatter,
  useMatterWork,
  useUpdateMatter,
  useDeleteMatter,
  useDeleteWork,
  useDeadlineTriggers,
  useComputeDeadlines,
  useAddDeadline,
  useAddDeadlinesBulk,
  useUpdateDeadline,
  useDeleteDeadline,
  useAiInsights,
  useRefreshAiInsights,
  useIntakeBriefing,
  useGenerateIntakeBriefing,
  useStageHistory,
  useUpdateStage,
  useChecklist,
  useAddChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useTimeEntries,
  useAddTimeEntry,
  useDeleteTimeEntry,
  useClients,
  useCreateClient,
  useUpdateClient,
  useMatterClients,
  useLinkClient,
  useUnlinkClient,
  useCaseEvents,
  useAddCaseEvent,
  useUpdateCaseEvent,
  useDeleteCaseEvent,
  useCaseReview,
  CASE_EVENT_KINDS,
  SYA_STAGES,
  categoryMeta,
  daysUntil,
  matterTypeLabel,
  SYA_MATTER_TYPES,
  SYA_COURTS,
  type ComputedDeadline,
  type MatterInput,
  type MatterDeadline,
  type MatterWorkItem,
  type ClientItem,
  type CaseEvent,
} from "@/hooks/use-matters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-context";
import {
  ArrowLeft,
  FileText,
  Trash2,
  Pencil,
  CalendarClock,
  Plus,
  Wand2,
  Check,
  AlertTriangle,
  Workflow,
  Loader2,
  Copy,
  Brain,
  RefreshCw,
  CircleCheck,
  Clock,
  Timer,
  ClipboardList,
  Users,
  User,
  BarChart3,
  Calendar,
  Download,
  Phone,
  Mail,
  MapPin,
  Building2,
  CreditCard,
  ChevronRight,
  Sparkles,
  Link2,
  X,
  History,
  Calculator,
  FolderLock,
  FileSignature,
  ChevronDown,
  Scale,
} from "lucide-react";
import { BillingTab, type BillingRequest } from "@workspace/billing-ui";
import { DocumentsPanel, type VaultRequest } from "@workspace/vault-ui";
import { DraftsPanel, type LettersRequest } from "@workspace/letters-ui";
import { CaseHomePanel } from "@workspace/case-home-ui";

const billingRequest: BillingRequest = (path, init) =>
  fetch(`/api/sya/matters${path}`, { credentials: "include", ...init });
const vaultRequest: VaultRequest = billingRequest;
const lettersRequest: LettersRequest = billingRequest;
const caseHomeRequest = billingRequest;

function fmtDate(iso: string, mode: string) {
  return new Date(iso).toLocaleDateString(mode === "bm" ? "ms-MY" : "en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CountdownBadge({ due, status }: { due: string; status: string }) {
  if (status === "done") {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><CircleCheck className="h-3.5 w-3.5" /> Done</span>;
  }
  const d = daysUntil(due);
  if (d < 0) return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-[11px] font-bold text-red-600">Due today</span>;
  if (d <= 7) return <span className="text-[11px] font-bold text-amber-600">in {d}d</span>;
  return <span className="text-[11px] font-medium text-muted-foreground">in {d}d</span>;
}

function RiskBadge({ rating }: { rating: "Low" | "Medium" | "High" }) {
  const styles = {
    Low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    Medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    High: "bg-red-500/10 text-red-600 border-red-500/20",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${styles[rating]}`}>{rating} Risk</span>;
}

function StageStepper({ currentStatus, matterId, mode }: { currentStatus: string; matterId: number; mode: string }) {
  const updateStage = useUpdateStage();
  const { toast } = useToast();
  const currentIdx = SYA_STAGES.indexOf(currentStatus);
  const labels: Record<string, string> = {
    Pengajuan: mode === "bm" ? "Pengajuan" : "Filing",
    Perbicaraan: mode === "bm" ? "Perbicaraan" : "Hearing",
    Penghakiman: mode === "bm" ? "Penghakiman" : "Judgment",
    Rayuan: mode === "bm" ? "Rayuan" : "Appeal",
    Selesai: mode === "bm" ? "Selesai" : "Closed",
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {SYA_STAGES.map((stage, idx) => {
        const isActive = stage === currentStatus;
        const isPast = currentIdx >= 0 && idx < currentIdx;
        return (
          <button
            key={stage}
            onClick={async () => {
              if (isActive) return;
              try {
                await updateStage.mutateAsync({ matterId, stage });
                toast({ title: `Stage: ${labels[stage] ?? stage}` });
              } catch (e) {
                toast({ title: "Could not update stage", variant: "destructive" });
              }
            }}
            disabled={updateStage.isPending}
            title={`Set stage to ${labels[stage] ?? stage}`}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              isActive
                ? "bg-secondary text-secondary-foreground border-secondary shadow-sm"
                : isPast
                ? "bg-secondary/20 text-secondary border-secondary/30 hover:bg-secondary/30"
                : "bg-muted text-muted-foreground border-border hover:border-secondary/40 hover:text-secondary"
            }`}
          >
            {isPast && <Check className="h-3 w-3" />}
            {labels[stage] ?? stage}
          </button>
        );
      })}
    </div>
  );
}

function IntakeBriefingPanel({ matterId }: { matterId: number }) {
  const { data: briefing, isLoading } = useIntakeBriefing(matterId);
  const generate = useGenerateIntakeBriefing();
  const [open, setOpen] = useState(false);

  if (isLoading) return null;

  if (!briefing) {
    return (
      <Card className="border-indigo-500/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-semibold text-foreground">Intake Briefing</span>
            </div>
            <button
              onClick={() => generate.mutate(matterId, { onSuccess: () => setOpen(true) })}
              disabled={generate.isPending}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
            >
              {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {generate.isPending ? "Generating…" : "Generate Intake Briefing"}
            </button>
          </div>
          {generate.isPending && (
            <p className="text-xs text-muted-foreground/60 mt-2">Analysing matter details — this may take a moment…</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-indigo-500/20">
      <CardContent className="p-5">
        <button className="flex items-center justify-between w-full text-left" onClick={() => setOpen((o) => !o)}>
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-foreground">Intake Briefing</span>
            <span className="text-[10px] text-muted-foreground/60 ml-1">— opening snapshot</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="mt-4 space-y-4">
            {(briefing.parties.client || briefing.parties.opponent || briefing.parties.counsel || briefing.parties.others.length > 0) && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Parties</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {briefing.parties.client && <div><span className="text-muted-foreground text-xs">Client: </span>{briefing.parties.client}</div>}
                  {briefing.parties.opponent && <div><span className="text-muted-foreground text-xs">Opponent: </span>{briefing.parties.opponent}</div>}
                  {briefing.parties.counsel && <div><span className="text-muted-foreground text-xs">Counsel: </span>{briefing.parties.counsel}</div>}
                  {briefing.parties.others.map((o, i) => <div key={i}><span className="text-muted-foreground text-xs">Other: </span>{o}</div>)}
                </div>
              </div>
            )}
            {briefing.keyFacts.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Key Facts</p>
                <ul className="space-y-1">
                  {briefing.keyFacts.map((f, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />{f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {briefing.legalIssues.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Legal Issues</p>
                <ul className="space-y-1">
                  {briefing.legalIssues.map((issue, i) => (
                    <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                      <Scale className="h-3.5 w-3.5 text-indigo-400 mt-0.5 shrink-0" />{issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {briefing.initialActions.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Suggested Initial Actions</p>
                <div className="space-y-2">
                  {briefing.initialActions.map((a, i) => {
                    const dot = a.priority === "high" ? "bg-red-400" : a.priority === "medium" ? "bg-amber-400" : "bg-emerald-400";
                    return (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${dot}`} />
                        <p className="text-sm text-foreground">{a.action}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground/60 pt-1">
              Read-only intake snapshot · generated {new Date(briefing.generatedAt).toLocaleDateString('en-GB')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AiInsightsPanel({ matterId, mode }: { matterId: number; mode: string }) {
  const { data: insights, isLoading, error } = useAiInsights(matterId);
  const refresh = useRefreshAiInsights();
  const { toast } = useToast();

  const t = (en: string, bm: string) => mode === "bm" ? bm : en;

  const handleRefresh = async () => {
    try {
      await refresh.mutateAsync(matterId);
      toast({ title: t("AI insights refreshed", "Analisis AI dikemas kini") });
    } catch {
      toast({ title: t("Could not refresh", "Tidak dapat dikemas kini"), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card className="border-secondary/20 bg-secondary/5">
        <CardContent className="p-5 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-secondary animate-spin shrink-0" />
          <p className="text-sm text-muted-foreground">{t("Generating AI case analysis…", "Menjana analisis kes AI…")}</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !insights) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-5 flex items-center gap-3">
          <Brain className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground flex-1">{t("AI insights unavailable. Add documents and deadlines to enable analysis.", "Analisis AI tidak tersedia. Tambah dokumen dan tarikh akhir untuk mengaktifkan analisis.")}</p>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handleRefresh} disabled={refresh.isPending}>
            <RefreshCw className="h-3.5 w-3.5" /> {t("Retry", "Cuba semula")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-secondary" />
          <h3 className="font-serif font-semibold text-foreground">{t("AI Case Analysis", "Analisis Kes AI")}</h3>
          <RiskBadge rating={insights.riskAssessment.rating} />
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleRefresh} disabled={refresh.isPending}>
          <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`} /> {t("Refresh", "Kemas kini")}
        </Button>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">{t("Case Summary", "Ringkasan Kes")}</p>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{insights.caseSummary}</p>
        </CardContent>
      </Card>

      {(insights.riskAssessment.keyStrengths.length > 0 || insights.riskAssessment.keyWeaknesses.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.riskAssessment.keyStrengths.length > 0 && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold mb-2">{t("Key Strengths", "Kekuatan Utama")}</p>
                <ul className="space-y-1">
                  {insights.riskAssessment.keyStrengths.map((s, i) => (
                    <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
                      <CircleCheck className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {insights.riskAssessment.keyWeaknesses.length > 0 && (
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold mb-2">{t("Key Weaknesses", "Kelemahan Utama")}</p>
                <ul className="space-y-1">
                  {insights.riskAssessment.keyWeaknesses.map((w, i) => (
                    <li key={i} className="text-sm text-foreground/90 flex items-start gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                      {w}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {insights.nextSteps.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">{t("Prioritised Next Steps", "Langkah Seterusnya")}</p>
          <div className="space-y-2">
            {insights.nextSteps.map((step, i) => {
              const priorityColors = { high: "border-l-red-500 bg-red-500/5", medium: "border-l-amber-500 bg-amber-500/5", low: "border-l-slate-400 bg-slate-500/5" };
              const priorityBadge = { high: "text-red-600 bg-red-500/10 border-red-500/20", medium: "text-amber-600 bg-amber-500/10 border-amber-500/20", low: "text-slate-500 bg-slate-500/10 border-slate-400/20" };
              return (
                <div key={i} className={`border-l-2 pl-3 py-2 rounded-r ${priorityColors[step.priority]}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground font-medium">{step.action}</p>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${priorityBadge[step.priority]}`}>{step.priority}</span>
                  </div>
                  {step.suggestedDeadline && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {step.suggestedDeadline}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistTab({ matterId, mode }: { matterId: number; mode: string }) {
  const { data: items, isLoading } = useChecklist(matterId);
  const addItem = useAddChecklistItem();
  const updateItem = useUpdateChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const { toast } = useToast();
  const [newText, setNewText] = useState("");
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;

  const doneCnt = (items ?? []).filter((i) => i.done).length;
  const total = (items ?? []).length;
  const pct = total > 0 ? Math.round((doneCnt / total) * 100) : 0;

  const toggle = async (item: { id: number; done: boolean }) => {
    try {
      await updateItem.mutateAsync({ matterId, itemId: item.id, done: !item.done });
    } catch {
      toast({ title: t("Could not update item", "Tidak dapat dikemas kini"), variant: "destructive" });
    }
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground animate-pulse">{t("Loading checklist…", "Memuatkan senarai semak…")}</div>;

  return (
    <div className="space-y-4">
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{doneCnt} {t("of", "daripada")} {total} {t("items completed", "item selesai")}</span>
            <span className="font-semibold text-secondary">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      )}

      {total === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-10 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-serif font-semibold text-foreground mb-1">{t("Checklist generating…", "Senarai semak sedang dijana…")}</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {t("An AI procedural checklist is being generated. It may take a moment. You can also add items manually.", "Senarai semak tatacara AI sedang dijana. Ia mungkin mengambil masa. Anda juga boleh menambah item secara manual.")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items!.map((item) => (
            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${item.done ? "opacity-60 border-border/30 bg-card/30" : "border-border/50 bg-card/50"}`}>
              <button
                onClick={() => toggle(item)}
                className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${item.done ? "bg-secondary border-secondary text-secondary-foreground" : "border-border hover:border-secondary"}`}
              >
                {item.done && <Check className="h-3 w-3" />}
              </button>
              <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.item_text}</span>
              <button
                onClick={async () => {
                  try { await deleteItem.mutateAsync({ matterId, itemId: item.id }); }
                  catch { toast({ title: t("Could not delete item", "Tidak dapat dipadam"), variant: "destructive" }); }
                }}
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary/30 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-2">
        <Input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && newText.trim() && addItem.mutate({ matterId, item_text: newText.trim() })}
          placeholder={t("Add a custom checklist item…", "Tambah item senarai semak…")}
          className="flex-1"
        />
        <Button
          onClick={() => { if (newText.trim()) { addItem.mutate({ matterId, item_text: newText.trim() }); setNewText(""); } }}
          disabled={addItem.isPending || !newText.trim()}
          className="gap-2"
        >
          <Plus className="h-4 w-4" /> {t("Add", "Tambah")}
        </Button>
      </div>
    </div>
  );
}

function TimeTab({ matterId, mode }: { matterId: number; mode: string }) {
  const { data, isLoading } = useTimeEntries(matterId);
  const addEntry = useAddTimeEntry();
  const deleteEntry = useDeleteTimeEntry();
  const { toast } = useToast();
  const [form, setForm] = useState({ description: "", minutes: "", rate_usd: "", entry_date: new Date().toISOString().slice(0, 10) });
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;

  const submitEntry = async () => {
    if (!form.description.trim() || !form.minutes) return;
    const mins = parseInt(form.minutes, 10);
    if (isNaN(mins) || mins < 0) { toast({ title: t("Invalid minutes", "Minit tidak sah"), variant: "destructive" }); return; }
    try {
      await addEntry.mutateAsync({ matterId, description: form.description.trim(), minutes: mins, rate_usd: form.rate_usd ? parseFloat(form.rate_usd) : null, entry_date: form.entry_date });
      setForm({ description: "", minutes: "", rate_usd: "", entry_date: new Date().toISOString().slice(0, 10) });
      toast({ title: t("Time entry logged", "Masa direkodkan") });
    } catch {
      toast({ title: t("Could not log time", "Tidak dapat merekod masa"), variant: "destructive" });
    }
  };

  const total = data?.totalMinutes ?? 0;
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (isLoading) return <div className="py-8 text-center text-muted-foreground animate-pulse">{t("Loading…", "Memuatkan…")}</div>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{t("Total time recorded", "Jumlah masa direkodkan")}</p>
        <p className="text-2xl font-bold text-secondary mt-0.5">{hours}h {mins}m</p>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> {t("Log Time", "Rekod Masa")}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div><Label className="text-xs">{t("Description *", "Huraian *")}</Label><Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder={t("e.g. Client conference, file review…", "cth. Persidangan klien, semak fail…")} className="mt-1" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">{t("Minutes *", "Minit *")}</Label><Input type="number" min="0" value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} placeholder="60" className="mt-1" /></div>
            <div><Label className="text-xs">Rate (USD/hr)</Label><Input type="number" min="0" step="0.01" value={form.rate_usd} onChange={(e) => setForm((f) => ({ ...f, rate_usd: e.target.value }))} placeholder="0.00" className="mt-1" /></div>
            <div><Label className="text-xs">{t("Date", "Tarikh")}</Label><Input type="date" value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} className="mt-1" /></div>
          </div>
          <Button onClick={submitEntry} disabled={addEntry.isPending || !form.description.trim() || !form.minutes} className="w-full gap-2">
            {addEntry.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("Log time", "Rekod masa")}
          </Button>
        </CardContent>
      </Card>

      {(data?.entries.length ?? 0) === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-8 text-center">
            <Timer className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("No time entries yet.", "Tiada rekod masa lagi.")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data!.entries.map((entry) => {
            const h = Math.floor(entry.minutes / 60);
            const m = entry.minutes % 60;
            return (
              <Card key={entry.id} className="border-border/50 bg-card/50">
                <CardContent className="p-3 flex items-center gap-3">
                  <Timer className="h-4 w-4 text-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(entry.entry_date, mode)} · {h > 0 ? `${h}h ` : ""}{m > 0 ? `${m}m` : ""}{entry.rate_usd ? ` · $${parseFloat(entry.rate_usd).toFixed(2)}/hr` : ""}</p>
                  </div>
                  <button onClick={async () => { try { await deleteEntry.mutateAsync({ matterId, entryId: entry.id }); } catch { toast({ title: t("Could not delete", "Tidak dapat dipadam"), variant: "destructive" }); } }} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary/30 shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeamTab({ matterId, clientName, mode }: { matterId: number; clientName: string | null; mode: string }) {
  const { data: clients } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientItem | null>(null);
  const [form, setForm] = useState({ name: "", ic_number: "", company_name: "", email: "", phone: "", address: "", notes: "" });
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;

  const suggested = clients?.find((c) => clientName && c.name.toLowerCase().includes(clientName.toLowerCase()));

  const submitAdd = async () => {
    if (!form.name.trim()) return;
    try {
      await createClient.mutateAsync({ name: form.name.trim(), ic_number: form.ic_number || undefined, company_name: form.company_name || undefined, email: form.email || undefined, phone: form.phone || undefined, address: form.address || undefined, notes: form.notes || undefined });
      toast({ title: t("Client saved", "Klien disimpan") });
      setAddOpen(false);
      setForm({ name: "", ic_number: "", company_name: "", email: "", phone: "", address: "", notes: "" });
    } catch {
      toast({ title: t("Could not save client", "Tidak dapat menyimpan klien"), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-secondary" /> {t("Client Records", "Rekod Klien")}
        </h3>
        <Button size="sm" className="gap-2" onClick={() => { setForm({ name: clientName ?? "", ic_number: "", company_name: "", email: "", phone: "", address: "", notes: "" }); setAddOpen(true); }}>
          <Plus className="h-4 w-4" /> {t("Add client", "Tambah klien")}
        </Button>
      </div>

      {suggested && (
        <Card className="border-secondary/20 bg-secondary/5">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-secondary font-semibold mb-2">{t("Matched client", "Klien yang dipadankan")}</p>
            <SyaClientCard client={suggested} mode={mode} onEdit={(c) => { setEditClient(c); setForm({ name: c.name, ic_number: c.ic_number ?? "", company_name: c.company_name ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" }); }} />
          </CardContent>
        </Card>
      )}

      {(clients?.length ?? 0) === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-8 text-center">
            <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("No client records yet.", "Tiada rekod klien lagi.")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {clients!.filter((c) => c.id !== suggested?.id).map((client) => (
            <SyaClientCard key={client.id} client={client} mode={mode} onEdit={(c) => { setEditClient(c); setForm({ name: c.name, ic_number: c.ic_number ?? "", company_name: c.company_name ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" }); }} />
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">{t("Add Client", "Tambah Klien")}</DialogTitle></DialogHeader>
          <SyaClientForm form={form} setForm={setForm} mode={mode} />
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>{t("Cancel", "Batal")}</Button>
            <Button className="flex-1" onClick={submitAdd} disabled={createClient.isPending || !form.name.trim()}>
              {createClient.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {t("Save", "Simpan")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editClient} onOpenChange={(o) => !o && setEditClient(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">{t("Edit Client", "Sunting Klien")}</DialogTitle></DialogHeader>
          <SyaClientForm form={form} setForm={setForm} mode={mode} />
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setEditClient(null)}>{t("Cancel", "Batal")}</Button>
            <Button className="flex-1" onClick={async () => {
              if (!editClient) return;
              try {
                await updateClient.mutateAsync({ id: editClient.id, ...form });
                toast({ title: t("Client updated", "Klien dikemas kini") });
                setEditClient(null);
              } catch { toast({ title: t("Could not update", "Tidak dapat dikemas kini"), variant: "destructive" }); }
            }} disabled={updateClient.isPending}>
              {updateClient.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {t("Save", "Simpan")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SyaClientCard({ client, onEdit, mode }: { client: ClientItem; onEdit: (c: ClientItem) => void; mode: string }) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <p className="font-semibold text-foreground">{client.name}</p>
            {client.ic_number && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> {client.ic_number}</p>}
            {client.company_name && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {client.company_name}</p>}
            {client.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" /> {client.email}</p>}
            {client.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" /> {client.phone}</p>}
            {client.address && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {client.address}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={() => onEdit(client)}><Pencil className="h-3.5 w-3.5" /></Button>
        </div>
        {client.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50 whitespace-pre-wrap">{client.notes}</p>}
      </CardContent>
    </Card>
  );
}

function SyaClientForm({ form, setForm, mode }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>>; mode: string }) {
  const t = (en: string, bm: string) => mode === "bm" ? bm : en;
  return (
    <div className="space-y-3">
      <div><Label>{t("Full name *", "Nama penuh *")}</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
      <div><Label>{t("IC / Passport", "IC / Pasport")}</Label><Input className="mt-1" value={form.ic_number} onChange={(e) => setForm((f) => ({ ...f, ic_number: e.target.value }))} /></div>
      <div><Label>{t("Company", "Syarikat")}</Label><Input className="mt-1" value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
        <div><Label>{t("Phone", "Telefon")}</Label><Input className="mt-1" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
      </div>
      <div><Label>{t("Address", "Alamat")}</Label><Textarea className="mt-1" rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
      <div><Label>{t("Notes", "Catatan")}</Label><Textarea className="mt-1" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
    </div>
  );
}

function downloadIcs(matter: { title: string; deadlines: MatterDeadline[] }) {
  const escape = (s: string) => s.replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const dtFmt = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MySyariahAI//Matter Calendar//EN",
    ...matter.deadlines.flatMap((d) => [
      "BEGIN:VEVENT",
      `UID:sya-dl-${d.id}@mysyariahai`,
      `DTSTART;VALUE=DATE:${dtFmt(d.dueDate)}`,
      `DTEND;VALUE=DATE:${dtFmt(d.dueDate)}`,
      `SUMMARY:${escape(d.title)} [${matter.title}]`,
      `DESCRIPTION:${escape(d.basis ?? "")}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${matter.title.replace(/[^a-z0-9]/gi, "-")}-deadlines.ics`;
  a.click();
}

const EVENT_KIND_LABELS: Record<string, { en: string; bm: string }> = {
  filing: { en: "Filing", bm: "Pemfailan" },
  hearing: { en: "Hearing", bm: "Perbicaraan" },
  correspondence: { en: "Correspondence", bm: "Surat-menyurat" },
  instruction: { en: "Instruction", bm: "Arahan" },
  deadline: { en: "Deadline", bm: "Tarikh Akhir" },
  stage: { en: "Stage", bm: "Peringkat" },
  "saved-work": { en: "Saved work", bm: "Kerja disimpan" },
  note: { en: "Note", bm: "Catatan" },
  payment: { en: "Payment", bm: "Bayaran" },
  meeting: { en: "Meeting", bm: "Mesyuarat" },
};

const EVENT_KIND_COLORS: Record<string, string> = {
  filing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  hearing: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  correspondence: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  instruction: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  deadline: "bg-red-500/10 text-red-600 border-red-500/20",
  stage: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "saved-work": "bg-slate-500/10 text-slate-600 border-slate-500/20",
  note: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  payment: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  meeting: "bg-pink-500/10 text-pink-600 border-pink-500/20",
};

function kindLabel(kind: string, mode: string) {
  const m = EVENT_KIND_LABELS[kind];
  return m ? (mode === "bm" ? m.bm : m.en) : kind;
}

function ChronologyTab({ matterId, mode }: { matterId: number; mode: string }) {
  const { data: events, isLoading } = useCaseEvents(matterId);
  const addEvent = useAddCaseEvent();
  const updateEvent = useUpdateCaseEvent();
  const deleteEvent = useDeleteCaseEvent();
  const { toast } = useToast();
  const t = (en: string, bm: string) => (mode === "bm" ? bm : en);

  const blank = { title: "", event_date: new Date().toISOString().slice(0, 10), kind: "filing", description: "" };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<CaseEvent | null>(null);
  const [editForm, setEditForm] = useState(blank);

  const sorted = [...(events ?? [])].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
  );

  const submit = async () => {
    if (!form.title.trim() || !form.event_date) {
      toast({ title: t("Title and date required", "Tajuk dan tarikh diperlukan"), variant: "destructive" });
      return;
    }
    try {
      await addEvent.mutateAsync({
        matterId,
        title: form.title.trim(),
        event_date: form.event_date,
        kind: form.kind,
        description: form.description.trim() || undefined,
      });
      setForm(blank);
      toast({ title: t("Event added", "Peristiwa ditambah") });
    } catch (e) {
      toast({ title: t("Could not add event", "Tidak dapat menambah"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.title.trim() || !editForm.event_date) {
      toast({ title: t("Title and date required", "Tajuk dan tarikh diperlukan"), variant: "destructive" });
      return;
    }
    try {
      await updateEvent.mutateAsync({
        matterId,
        eventId: editing.id,
        title: editForm.title.trim(),
        event_date: editForm.event_date,
        kind: editForm.kind,
        description: editForm.description.trim() || undefined,
      });
      setEditing(null);
      toast({ title: t("Event updated", "Peristiwa dikemas kini") });
    } catch (e) {
      toast({ title: t("Could not update", "Tidak dapat dikemas kini"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-serif font-bold text-lg flex items-center gap-2">
        <History className="h-5 w-5 text-secondary" /> {t("Chronology", "Kronologi")}
      </h2>

      {/* Add event form */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> {t("Add event", "Tambah peristiwa")}</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label className="text-xs">{t("Date *", "Tarikh *")}</Label><Input type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} className="mt-1" /></div>
            <div>
              <Label className="text-xs">{t("Kind *", "Jenis *")}</Label>
              <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CASE_EVENT_KINDS.map((k) => <SelectItem key={k} value={k}>{kindLabel(k, mode)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-1"><Label className="text-xs">{t("Title *", "Tajuk *")}</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("e.g. Statement of claim filed", "cth. Penyata tuntutan difailkan")} className="mt-1" /></div>
          </div>
          <div><Label className="text-xs">{t("Description", "Huraian")}</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="mt-1" /></div>
          <Button onClick={submit} disabled={addEvent.isPending || !form.title.trim()} className="gap-2">
            {addEvent.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {t("Add event", "Tambah peristiwa")}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground animate-pulse">{t("Loading…", "Memuatkan…")}</div>
      ) : sorted.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-8 text-center">
            <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("No chronology events yet.", "Tiada peristiwa kronologi lagi.")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border/50" />
          <div className="space-y-4 pl-10">
            {sorted.map((ev) => (
              <div key={ev.id} className="relative">
                <div className="absolute -left-6 top-2 h-3 w-3 rounded-full border-2 bg-secondary border-secondary" />
                <Card className="border-border/50 bg-card/50">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${EVENT_KIND_COLORS[ev.kind] ?? EVENT_KIND_COLORS.note}`}>{kindLabel(ev.kind, mode)}</span>
                          <span className="text-xs text-muted-foreground">{fmtDate(ev.event_date, mode)}</span>
                        </div>
                        <p className="text-sm font-medium text-foreground mt-1">{ev.title}</p>
                        {ev.description && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{ev.description}</p>}
                        {ev.source && <p className="text-[10px] text-muted-foreground/70 mt-1">{t("Source", "Sumber")}: {ev.source}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { setEditing(ev); setEditForm({ title: ev.title, event_date: ev.event_date.slice(0, 10), kind: ev.kind, description: ev.description ?? "" }); }} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-secondary hover:bg-secondary/30"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={async () => { try { await deleteEvent.mutateAsync({ matterId, eventId: ev.id }); } catch { toast({ title: t("Could not delete", "Tidak dapat dipadam"), variant: "destructive" }); } }} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary/30"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">{t("Edit Event", "Sunting Peristiwa")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("Date *", "Tarikh *")}</Label><Input type="date" className="mt-1" value={editForm.event_date} onChange={(e) => setEditForm((f) => ({ ...f, event_date: e.target.value }))} /></div>
            <div>
              <Label>{t("Kind *", "Jenis *")}</Label>
              <Select value={editForm.kind} onValueChange={(v) => setEditForm((f) => ({ ...f, kind: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CASE_EVENT_KINDS.map((k) => <SelectItem key={k} value={k}>{kindLabel(k, mode)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t("Title *", "Tajuk *")}</Label><Input className="mt-1" value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>{t("Description", "Huraian")}</Label><Textarea rows={2} className="mt-1" value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} /></div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>{t("Cancel", "Batal")}</Button>
              <Button className="flex-1" onClick={saveEdit} disabled={updateEvent.isPending}>{updateEvent.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {t("Save", "Simpan")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AiReviewButton({ matterId, mode }: { matterId: number; mode: string }) {
  const review = useCaseReview();
  const { toast } = useToast();
  const [result, setResult] = useState<string | null>(null);
  const t = (en: string, bm: string) => (mode === "bm" ? bm : en);

  const run = async () => {
    setResult(null);
    try {
      const res = await review.mutateAsync(matterId);
      setResult(res.review ?? "");
    } catch (e) {
      toast({ title: t("AI review failed", "Semakan AI gagal"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-secondary" />
          <h3 className="font-serif font-semibold text-foreground">{t("AI Case Review", "Semakan Kes AI")}</h3>
        </div>
        <Button size="sm" className="gap-2" onClick={run} disabled={review.isPending}>
          {review.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {review.isPending ? t("Reviewing…", "Menyemak…") : t("Run AI review", "Jalankan semakan AI")}
        </Button>
      </div>
      {review.isPending && (
        <Card className="border-secondary/20 bg-secondary/5">
          <CardContent className="p-5 flex items-center gap-3">
            <Loader2 className="h-5 w-5 text-secondary animate-spin shrink-0" />
            <p className="text-sm text-muted-foreground">{t("Generating case review and prioritised next actions… this can take up to a minute.", "Menjana semakan kes dan tindakan seterusnya… ini boleh mengambil masa sehingga seminit.")}</p>
          </CardContent>
        </Card>
      )}
      {result != null && !review.isPending && (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap font-sans">{result}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MatterClientsSection({ matterId, mode }: { matterId: number; mode: string }) {
  const { data: linked, isLoading } = useMatterClients(matterId);
  const { data: allClients } = useClients();
  const createClient = useCreateClient();
  const linkClient = useLinkClient();
  const unlinkClient = useUnlinkClient();
  const { toast } = useToast();
  const t = (en: string, bm: string) => (mode === "bm" ? bm : en);

  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [newForm, setNewForm] = useState({ name: "", phone: "", email: "" });

  const linkedIds = new Set((linked ?? []).map((c) => c.id));
  const available = (allClients ?? []).filter((c) => !linkedIds.has(c.id));

  const doLinkExisting = async () => {
    if (!selectedId) return;
    try {
      await linkClient.mutateAsync({ clientId: parseInt(selectedId, 10), matterId });
      toast({ title: t("Client linked", "Klien dipautkan") });
      setSelectedId("");
      setLinkOpen(false);
    } catch (e) {
      toast({ title: t("Could not link", "Tidak dapat dipautkan"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const doCreateAndLink = async () => {
    if (!newForm.name.trim()) { toast({ title: t("Name required", "Nama diperlukan"), variant: "destructive" }); return; }
    try {
      const created: ClientItem = await createClient.mutateAsync({
        name: newForm.name.trim(),
        phone: newForm.phone.trim() || undefined,
        email: newForm.email.trim() || undefined,
      });
      await linkClient.mutateAsync({ clientId: created.id, matterId });
      toast({ title: t("Client created & linked", "Klien dicipta & dipautkan") });
      setNewForm({ name: "", phone: "", email: "" });
      setLinkOpen(false);
    } catch (e) {
      toast({ title: t("Could not create client", "Tidak dapat mencipta klien"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif font-semibold text-foreground flex items-center gap-2">
          <User className="h-5 w-5 text-secondary" /> {t("Linked Clients", "Klien Dipautkan")}
        </h3>
        <Button size="sm" className="gap-2" onClick={() => setLinkOpen(true)}><Link2 className="h-4 w-4" /> {t("Link client", "Pautkan klien")}</Button>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-muted-foreground animate-pulse">{t("Loading…", "Memuatkan…")}</div>
      ) : (linked?.length ?? 0) === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-8 text-center">
            <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{t("No client linked to this matter yet.", "Tiada klien dipautkan ke kes ini lagi.")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {linked!.map((client) => (
            <Card key={client.id} className="border-border/50 bg-card/50">
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="space-y-1.5 min-w-0">
                  <p className="font-semibold text-foreground">{client.name}</p>
                  {client.company_name && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {client.company_name}</p>}
                  {client.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" /> {client.email}</p>}
                  {client.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" /> {client.phone}</p>}
                </div>
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive shrink-0" onClick={async () => { try { await unlinkClient.mutateAsync({ clientId: client.id, matterId }); toast({ title: t("Client unlinked", "Klien dinyahpaut") }); } catch { toast({ title: t("Could not unlink", "Tidak dapat dinyahpaut"), variant: "destructive" }); } }} disabled={unlinkClient.isPending}>
                  <X className="h-3.5 w-3.5" /> {t("Unlink", "Nyahpaut")}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">{t("Link a Client", "Pautkan Klien")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("Existing client", "Klien sedia ada")}</Label>
              {available.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">{t("No other clients available.", "Tiada klien lain tersedia.")}</p>
              ) : (
                <div className="flex gap-2 mt-1">
                  <Select value={selectedId} onValueChange={setSelectedId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder={t("Choose a client", "Pilih klien")} /></SelectTrigger>
                    <SelectContent>{available.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button onClick={doLinkExisting} disabled={!selectedId || linkClient.isPending}>{linkClient.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {t("Link", "Pautkan")}</Button>
                </div>
              )}
            </div>

            <div className="border-t border-border/50 pt-4 space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">{t("Or create a new client", "Atau cipta klien baharu")}</p>
              <div><Label>{t("Full name *", "Nama penuh *")}</Label><Input className="mt-1" value={newForm.name} onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t("Phone", "Telefon")}</Label><Input className="mt-1" value={newForm.phone} onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))} /></div>
                <div><Label>Email</Label><Input className="mt-1" type="email" value={newForm.email} onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <Button className="w-full gap-2" onClick={doCreateAndLink} disabled={createClient.isPending || linkClient.isPending || !newForm.name.trim()}>
                {(createClient.isPending || linkClient.isPending) && <Loader2 className="h-4 w-4 animate-spin" />} {t("Create & link", "Cipta & pautkan")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MatterDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "", 10);
  const [, navigate] = useLocation();
  const { t, ts, mode } = useLanguage();
  const { toast } = useToast();

  const { data: matter, isLoading } = useMatter(Number.isNaN(id) ? null : id);
  const { data: work } = useMatterWork(Number.isNaN(id) ? null : id);
  const updateMatter = useUpdateMatter();

  const [suggestionDismissed, setSuggestionDismissed] = useState<boolean>(() => {
    if (Number.isNaN(id)) return false;
    return sessionStorage.getItem(`sya-wf-suggest-dismissed-${id}`) === "1";
  });

  useEffect(() => {
    if (Number.isNaN(id)) { setSuggestionDismissed(false); return; }
    setSuggestionDismissed(sessionStorage.getItem(`sya-wf-suggest-dismissed-${id}`) === "1");
  }, [id]);

  const dismissSuggestion = () => {
    setSuggestionDismissed(true);
    sessionStorage.setItem(`sya-wf-suggest-dismissed-${id}`, "1");
  };

  const deleteMatter = useDeleteMatter();
  const deleteWork = useDeleteWork();
  const { data: triggers } = useDeadlineTriggers();
  const computeDl = useComputeDeadlines();
  const addDl = useAddDeadline();
  const addBulk = useAddDeadlinesBulk();
  const updateDl = useUpdateDeadline();
  const deleteDl = useDeleteDeadline();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<MatterInput>({});
  const [workflowTouched, setWorkflowTouched] = useState(false);

  const { data: workflowOptions } = useQuery<any[]>({
    queryKey: ["workflows", "options"],
    queryFn: () => api.workflows.list(),
    staleTime: 5 * 60 * 1000,
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<MatterWorkItem | null>(null);
  const [dlOpen, setDlOpen] = useState(false);
  const [dlTitle, setDlTitle] = useState("");
  const [dlDate, setDlDate] = useState("");
  const [computeOpen, setComputeOpen] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [triggerDate, setTriggerDate] = useState("");
  const [preview, setPreview] = useState<ComputedDeadline[] | null>(null);
  const [editingDeadline, setEditingDeadline] = useState<MatterDeadline | null>(null);
  const [edForm, setEdForm] = useState({ title: "", dueDate: "", category: "custom", basis: "", notes: "" });

  if (isLoading) {
    return <div className="p-8 text-center text-secondary animate-pulse">{t("Loading matter…", "Memuatkan fail kes…")}</div>;
  }
  if (!matter) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">{t("Matter not found.", "Fail kes tidak dijumpai.")}</p>
        <Button variant="outline" asChild><Link href="/matters">{t("Back to matters", "Kembali ke fail kes")}</Link></Button>
      </div>
    );
  }

  const openEdit = () => {
    setEditForm({ title: matter.title, clientName: matter.clientName ?? "", actingFor: matter.actingFor ?? "", plaintiff: matter.plaintiff ?? "", defendant: matter.defendant ?? "", matterType: matter.matterType ?? "", court: matter.court ?? "", caseNo: matter.caseNo ?? "", claimAmount: matter.claimAmount ?? "", status: matter.status, notes: matter.notes ?? "", workflowId: matter.workflowId });
    setWorkflowTouched(false);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    await updateMatter.mutateAsync({ id: matter.id, ...editForm });
    setEditOpen(false);
    toast({ title: ts("Matter updated", "Fail kes dikemas kini") });
  };

  const doDelete = async () => {
    await deleteMatter.mutateAsync(matter.id);
    toast({ title: ts("Matter deleted", "Fail kes dipadam") });
    navigate("/matters");
  };

  const runCompute = async () => {
    if (!trigger || !triggerDate) return;
    const rows = await computeDl.mutateAsync({ matterId: matter.id, trigger, triggerDate });
    setPreview(rows);
  };

  const addComputed = async () => {
    if (!preview || preview.length === 0) return;
    await addBulk.mutateAsync({
      matterId: matter.id,
      deadlines: preview.map((p) => ({ title: p.title, dueDate: p.dueDate, category: p.category, basis: p.basis, notes: p.notes })),
    });
    setComputeOpen(false);
    setPreview(null);
    setTrigger("");
    setTriggerDate("");
    toast({ title: ts("Deadlines added to diary", "Tarikh akhir ditambah ke diari") });
  };

  const saveEditDeadline = async () => {
    if (!editingDeadline) return;
    if (!edForm.title.trim() || !edForm.dueDate) { toast({ title: ts("Title and date required", "Tajuk dan tarikh diperlukan"), variant: "destructive" }); return; }
    try {
      await updateDl.mutateAsync({ matterId: matter.id, id: editingDeadline.id, ...edForm });
      toast({ title: ts("Deadline updated", "Tarikh akhir dikemas kini") });
      setEditingDeadline(null);
    } catch { toast({ title: ts("Could not update", "Tidak dapat dikemas kini"), variant: "destructive" }); }
  };

  const deadlines = matter.deadlines ?? [];
  const pending = deadlines.filter((d) => d.status !== "done");
  const doneDl = deadlines.filter((d) => d.status === "done");

  // Timeline: merge deadlines + documents sorted by date
  const timelineItems: Array<{ type: "deadline" | "doc"; date: string; label: string; id: number; dl?: MatterDeadline; doc?: MatterWorkItem }> = [
    ...deadlines.map((d) => ({ type: "deadline" as const, date: d.dueDate, label: d.title, id: d.id, dl: d })),
    ...(work ?? []).map((w) => ({ type: "doc" as const, date: w.updatedAt, label: w.title, id: w.id, doc: w })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // AI tool launch links with matter context
  const matterParams = new URLSearchParams();
  matterParams.set("matterId", String(matter.id));
  if (matter.title) matterParams.set("matterTitle", matter.title);
  if (matter.plaintiff) matterParams.set("plaintiff", matter.plaintiff);
  if (matter.defendant) matterParams.set("defendant", matter.defendant);
  if (matter.matterType) matterParams.set("matterType", matter.matterType);
  if (matter.caseNo) matterParams.set("caseNo", matter.caseNo);
  if (matter.court) matterParams.set("court", matter.court);
  const matterQuery = matterParams.toString();

  const aiTools: Array<{ id: string; name: string; href: string }> = [
    { id: "case-analysis", name: ts("Case Analyzer", "Penganalisis Kes"), href: `/case-analysis?${matterQuery}` },
    { id: "document-generator", name: ts("Document Generator", "Penjana Dokumen"), href: `/document-generator?${matterQuery}` },
    { id: "ai-counsel", name: ts("AI Counsel", "Peguam AI"), href: `/ai-counsel?${matterQuery}` },
    { id: "legal-opinion", name: ts("Legal Opinion", "Pendapat Undang-Undang"), href: `/legal-opinion?${matterQuery}` },
    { id: "case-workspace", name: ts("Case Workspace", "Ruang Kerja Kes"), href: `/case-workspace?${matterQuery}` },
    { id: "faraid-calculator", name: ts("Faraid Calculator", "Kalkulator Faraid"), href: `/faraid-calculator?${matterQuery}` },
  ];

  const suggestedId = !matter.workflowId && !suggestionDismissed ? suggestWorkflowId(matter.matterType, workflowOptions) : null;
  const suggestedWorkflow = suggestedId != null ? (workflowOptions ?? []).find((w) => w.id === suggestedId) : null;
  const suggestedWorkflowName = suggestedWorkflow ? (mode === "bm" ? (suggestedWorkflow.titleBm ?? suggestedWorkflow.titleEn) : (suggestedWorkflow.titleEn ?? suggestedWorkflow.titleBm)) : null;

  const CATEGORY_OPTIONS = ["mal", "jenayah", "faraid", "perbicaraan", "rayuan", "custom"];

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-4 pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1 min-w-0">
          <Link href="/matters" className="text-xs text-muted-foreground hover:text-secondary flex items-center gap-1 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> {t("All matters", "Semua fail kes")}
          </Link>
          <h1 className="text-2xl font-serif font-bold text-foreground" data-testid="matter-detail-title">{matter.title}</h1>
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            {matter.caseNo && <span>· {matter.caseNo}</span>}
            {matter.matterType && <Badge variant="outline" className="text-xs">{matterTypeLabel(matter.matterType, mode)}</Badge>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /> {t("Edit", "Sunting")}</Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-red-400 border-red-900/40 hover:bg-red-950/30" onClick={() => setDeleteOpen(true)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Stage stepper */}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">{t("Case Stage", "Peringkat Kes")}</p>
        <StageStepper currentStatus={matter.status} matterId={matter.id} mode={mode} />
      </div>

      {/* Workflow suggestion banner */}
      {suggestedWorkflow && suggestedWorkflowName && (
        <div className="flex items-center gap-3 rounded-lg border border-secondary/30 bg-secondary/5 px-4 py-3 text-sm flex-wrap" data-testid="workflow-suggestion-banner">
          <Workflow className="h-4 w-4 text-secondary shrink-0" />
          <span className="flex-1 text-foreground/80 min-w-0">{t(`Link the "${suggestedWorkflowName}" procedure to this matter?`, `Pautan tatacara "${suggestedWorkflowName}" ke fail kes ini?`)}</span>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" className="h-7 bg-secondary hover:bg-secondary/90 text-secondary-foreground gap-1.5" disabled={updateMatter.isPending}
              onClick={async () => { await updateMatter.mutateAsync({ id: matter.id, workflowId: suggestedId }); toast({ title: ts("Procedure linked", "Tatacara dipautkan") }); }}>
              {t("Link", "Pautkan")}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-muted-foreground" onClick={dismissSuggestion}>{t("Dismiss", "Abaikan")}</Button>
          </div>
        </div>
      )}

      {/* Case Home panel */}
      <CaseHomePanel
        matterId={matter.id}
        request={caseHomeRequest}
        accent="hsl(var(--secondary))"
        className="my-2"
        action={
          aiTools.length > 0
            ? {
                label: `${ts("Open", "Buka")} ${aiTools[0].name}`,
                href: aiTools[0].href,
              }
            : undefined
        }
      />

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> {t("Overview", "Gambaran")}</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> {t("Timeline", "Garis Masa")}</TabsTrigger>
          <TabsTrigger value="chronology" className="gap-1.5"><History className="h-3.5 w-3.5" /> {t("Chronology", "Kronologi")}</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> {t("Documents", "Dokumen")} {(work?.length ?? 0) > 0 && <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4">{work!.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> {t("Checklist", "Senarai Semak")}</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><Users className="h-3.5 w-3.5" /> {t("Team", "Pasukan")}</TabsTrigger>
          <TabsTrigger value="time" className="gap-1.5"><Timer className="h-3.5 w-3.5" /> {t("Time", "Masa")}</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5"><Calculator className="h-3.5 w-3.5" /> {t("Billing", "Pengebilan")}</TabsTrigger>
          <TabsTrigger value="vault" className="gap-1.5"><FolderLock className="h-3.5 w-3.5" /> {t("Vault", "Peti Simpanan", "الخزنة")}</TabsTrigger>
          <TabsTrigger value="letters" className="gap-1.5"><FileSignature className="h-3.5 w-3.5" /> {t("Drafts & Letters", "Draf & Surat", "المسودات والرسائل")}</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="space-y-6">
          <IntakeBriefingPanel matterId={matter.id} />
          <AiInsightsPanel matterId={matter.id} mode={mode} />

          <AiReviewButton matterId={matter.id} mode={mode} />

          <MatterClientsSection matterId={matter.id} mode={mode} />

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">{t("Matter Details", "Butiran Kes")}</p>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
                {[
                  { label: ts("Client", "Klien"), value: matter.clientName },
                  { label: ts("Acting for", "Bertindak bagi"), value: matter.actingFor },
                  { label: ts("Plaintiff / Applicant", "Plaintif / Pemohon"), value: matter.plaintiff },
                  { label: ts("Defendant / Respondent", "Defendan / Responden"), value: matter.defendant },
                  { label: ts("Court", "Mahkamah"), value: matter.court },
                  { label: ts("Case no.", "No. kes"), value: matter.caseNo },
                  { label: ts("Matter type", "Jenis kes"), value: matter.matterType ? matterTypeLabel(matter.matterType, mode) : null },
                  { label: ts("Claim (RM)", "Tuntutan (RM)"), value: matter.claimAmount },
                ].filter((r) => r.value).map((r) => (
                  <div key={r.label}>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{r.label}</p>
                    <p className="text-sm text-foreground mt-0.5">{r.value}</p>
                  </div>
                ))}
                {matter.notes && (
                  <div className="col-span-2 md:col-span-4">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{t("Notes", "Catatan")}</p>
                    <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{matter.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI tool launch */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">{t("Launch AI Tools for This Matter", "Lancar Alat AI untuk Kes Ini")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {aiTools.map((tool) => (
                <Link key={tool.id} href={tool.href} className="w-full text-left flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-card/50 hover:border-secondary/40 hover:bg-secondary/5 transition-all text-sm">
                  <Brain className="h-4 w-4 text-secondary shrink-0" />
                  <span className="font-medium text-foreground truncate">{tool.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Timeline tab */}
        <TabsContent value="timeline" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-serif font-bold text-lg flex items-center gap-2"><Calendar className="h-5 w-5 text-secondary" /> {t("Case Timeline", "Garis Masa Kes")}</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadIcs(matter)}><Download className="h-3.5 w-3.5" /> Export .ics</Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setComputeOpen(true)}><Wand2 className="h-3.5 w-3.5" /> {t("Compute", "Kira")}</Button>
              <Button size="sm" className="gap-2" onClick={() => setDlOpen(true)}><Plus className="h-4 w-4" /> {t("Add deadline", "Tambah tarikh akhir")}</Button>
            </div>
          </div>

          {timelineItems.length === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-10 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t("No timeline events yet.", "Tiada peristiwa garis masa lagi.")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border/50" />
              <div className="space-y-4 pl-10">
                {timelineItems.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="relative">
                    <div className={`absolute -left-6 top-2 h-3 w-3 rounded-full border-2 ${item.type === "deadline" ? "bg-secondary border-secondary" : "bg-card border-secondary/50"}`} />
                    <Card className="border-border/50 bg-card/50">
                      <CardContent className="p-3 flex items-center gap-3">
                        {item.type === "deadline" ? (
                          <>
                            <CalendarClock className="h-4 w-4 text-secondary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{item.label}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(item.date, mode)}</p>
                            </div>
                            <CountdownBadge due={item.dl!.dueDate} status={item.dl!.status} />
                            <button onClick={async () => { try { await updateDl.mutateAsync({ matterId: matter.id, id: item.dl!.id, status: item.dl!.status === "done" ? "pending" : "done" }); } catch {} }} className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${item.dl!.status === "done" ? "bg-secondary border-secondary text-secondary-foreground" : "border-border hover:border-secondary"}`}>
                              {item.dl!.status === "done" && <Check className="h-3 w-3" />}
                            </button>
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 text-secondary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{item.label}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">{t("Filed", "Difailkan")} {fmtDate(item.date, mode)}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setViewDoc(item.doc!)}>{t("View", "Lihat")}</Button>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Chronology tab */}
        <TabsContent value="chronology">
          <ChronologyTab matterId={matter.id} mode={mode} />
        </TabsContent>

        {/* Documents tab */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-serif font-bold text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-secondary" /> {t("Filed Documents", "Dokumen Difailkan")}
              {(work?.length ?? 0) > 0 && <Badge variant="outline">{work!.length}</Badge>}
            </h2>
          </div>

          {(work?.length ?? 0) === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("No documents filed yet.", "Tiada dokumen difailkan lagi.")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {work!.map((w) => (
                <Card key={w.id} className="hover:border-secondary/40 transition-colors cursor-pointer border-border/50 bg-card/50">
                  <CardContent className="p-4 flex items-center gap-3" onClick={() => setViewDoc(w)}>
                    <FileText className="h-4 w-4 text-secondary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{w.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t("Updated", "Dikemas kini")} {fmtDate(w.updatedAt, mode)}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setViewDoc(w); }}>{t("View", "Lihat")}</Button>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={async (e) => { e.stopPropagation(); try { await deleteWork.mutateAsync({ matterId: matter.id, id: w.id }); } catch { toast({ title: ts("Could not delete", "Tidak dapat dipadam"), variant: "destructive" }); } }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="pt-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">{t("Draft for This Matter", "Draf untuk Kes Ini")}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {aiTools.map((tool) => (
                <Link key={tool.id} href={tool.href} className="w-full text-left flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-card/50 hover:border-secondary/40 hover:bg-secondary/5 transition-all text-sm">
                  <Brain className="h-4 w-4 text-secondary shrink-0" />
                  <span className="font-medium text-foreground truncate">{tool.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Checklist tab */}
        <TabsContent value="checklist">
          <ChecklistTab matterId={matter.id} mode={mode} />
        </TabsContent>

        {/* Team tab */}
        <TabsContent value="team">
          <TeamTab matterId={matter.id} clientName={matter.clientName} mode={mode} />
        </TabsContent>

        {/* Time tab */}
        <TabsContent value="time">
          <TimeTab matterId={matter.id} mode={mode} />
        </TabsContent>

        {/* Billing tab */}
        <TabsContent value="billing">
          <BillingTab
            request={billingRequest}
            matterId={matter.id}
            accent="#0f766e"
            currency="RM"
            defaultClientName={matter.clientName ?? undefined}
          />
        </TabsContent>

        {/* Vault tab */}
        <TabsContent value="vault">
          <DocumentsPanel
            request={vaultRequest}
            matterId={matter.id}
            accent="#0f766e"
          />
        </TabsContent>

        {/* Drafts & Letters tab */}
        <TabsContent value="letters">
          <DraftsPanel
            request={lettersRequest}
            matterId={matter.id}
            accent="#0f766e"
            showLetterWriter
            matterTitle={matter.title || ""}
            clientName={matter.clientName || ""}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}

      {/* Edit matter */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">{t("Edit Matter", "Sunting Fail Kes")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{t("Title *", "Tajuk *")}</Label><Input className="mt-1" value={editForm.title ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{ts("Client", "Klien")}</Label><Input className="mt-1" value={editForm.clientName ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))} /></div>
              <div><Label>{ts("Acting for", "Bertindak bagi")}</Label>
                <Select value={editForm.actingFor ?? ""} onValueChange={(v) => setEditForm((f) => ({ ...f, actingFor: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Plaintif", "Defendan", "Pemohon", "Responden"].map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{ts("Plaintiff / Applicant", "Plaintif / Pemohon")}</Label><Input className="mt-1" value={editForm.plaintiff ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, plaintiff: e.target.value }))} /></div>
              <div><Label>{ts("Defendant / Respondent", "Defendan / Responden")}</Label><Input className="mt-1" value={editForm.defendant ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, defendant: e.target.value }))} /></div>
            </div>
            <div>
              <Label>{ts("Matter type", "Jenis kes")}</Label>
              <Select value={editForm.matterType ?? ""} onValueChange={(v) => setEditForm((f) => ({ ...f, matterType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SYA_MATTER_TYPES.map((mt) => <SelectItem key={mt.value} value={mt.value}>{mode === "bm" ? mt.bm : mt.en}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ts("Court", "Mahkamah")}</Label>
                <Select value={editForm.court ?? ""} onValueChange={(v) => setEditForm((f) => ({ ...f, court: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{SYA_COURTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>{ts("Case no.", "No. kes")}</Label><Input className="mt-1" value={editForm.caseNo ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, caseNo: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{ts("Claim (RM)", "Tuntutan (RM)")}</Label><Input className="mt-1" type="number" value={editForm.claimAmount ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, claimAmount: e.target.value }))} /></div>
              <div>
                <Label>{ts("Status", "Status")}</Label>
                <Select value={editForm.status ?? "active"} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["active", "on-hold", "closed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    {SYA_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>{ts("Linked workflow", "Tatacara dipautkan")}</Label>
              <Select value={editForm.workflowId ? String(editForm.workflowId) : "none"} onValueChange={(v) => { setEditForm((f) => ({ ...f, workflowId: v === "none" ? null : parseInt(v, 10) })); setWorkflowTouched(true); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={t("None", "Tiada")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("None", "Tiada")}</SelectItem>
                  {(workflowOptions ?? []).map((w: any) => <SelectItem key={w.id} value={String(w.id)}>{mode === "bm" ? (w.titleBm ?? w.titleEn) : (w.titleEn ?? w.titleBm)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>{ts("Notes", "Catatan")}</Label><Textarea className="mt-1" rows={3} value={editForm.notes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>{ts("Cancel", "Batal")}</Button>
              <Button className="flex-1" onClick={saveEdit} disabled={updateMatter.isPending}>
                {updateMatter.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {ts("Save changes", "Simpan perubahan")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">{t("Delete matter?", "Padam fail kes?")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("This permanently deletes", "Ini memadam secara kekal")} <span className="font-medium text-foreground">"{matter.title}"</span>. {t("Cannot be undone.", "Tidak boleh dibuat asal.")}</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)}>{ts("Cancel", "Batal")}</Button>
              <Button variant="destructive" className="flex-1" onClick={doDelete} disabled={deleteMatter.isPending}>{ts("Delete", "Padam")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add deadline */}
      <Dialog open={dlOpen} onOpenChange={setDlOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">{t("Add Deadline", "Tambah Tarikh Akhir")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{ts("Title *", "Tajuk *")}</Label><Input className="mt-1" value={dlTitle} onChange={(e) => setDlTitle(e.target.value)} /></div>
            <div><Label>{ts("Due date *", "Tarikh akhir *")}</Label><Input className="mt-1" type="date" value={dlDate} onChange={(e) => setDlDate(e.target.value)} /></div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setDlOpen(false)}>{ts("Cancel", "Batal")}</Button>
              <Button className="flex-1" disabled={addDl.isPending || !dlTitle.trim() || !dlDate}
                onClick={async () => {
                  try {
                    await addDl.mutateAsync({ matterId: matter.id, title: dlTitle.trim(), dueDate: dlDate });
                    toast({ title: ts("Deadline added", "Tarikh akhir ditambah") });
                    setDlOpen(false); setDlTitle(""); setDlDate("");
                  } catch { toast({ title: ts("Could not add deadline", "Tidak dapat tambah tarikh akhir"), variant: "destructive" }); }
                }}>
                {ts("Add deadline", "Tambah tarikh akhir")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compute deadlines */}
      <Dialog open={computeOpen} onOpenChange={(o) => { setComputeOpen(o); if (!o) setPreview(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">{t("Compute Deadlines", "Kira Tarikh Akhir")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{ts("Trigger event", "Peristiwa pencetus")}</Label>
                <Select value={trigger} onValueChange={(v) => { setTrigger(v); setPreview(null); }}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={t("Select…", "Pilih…")} /></SelectTrigger>
                  <SelectContent>{triggers?.map((t_) => <SelectItem key={t_.trigger} value={t_.trigger}>{t_.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>{ts("Date", "Tarikh")}</Label>
                <Input className="mt-1" type="date" value={triggerDate} onChange={(e) => { setTriggerDate(e.target.value); setPreview(null); }} />
              </div>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={runCompute} disabled={computeDl.isPending || !trigger || !triggerDate}>
              <Wand2 className="h-4 w-4" /> {computeDl.isPending ? t("Computing…", "Mengira…") : t("Compute deadlines", "Kira tarikh akhir")}
            </Button>
            {preview && preview.length > 0 && (
              <>
                <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                  {preview.map((p, i) => (
                    <div key={i} className="p-3 rounded-lg border border-border bg-card/50">
                      <p className="text-sm font-medium">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(p.dueDate, mode)} · {p.basis}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => { setComputeOpen(false); setPreview(null); }}>{ts("Cancel", "Batal")}</Button>
                  <Button className="flex-1" onClick={addComputed} disabled={addBulk.isPending}>{ts("Add all", "Tambah semua")}</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit deadline dialog */}
      <Dialog open={!!editingDeadline} onOpenChange={(o) => { if (!o) setEditingDeadline(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">{t("Edit Deadline", "Sunting Tarikh Akhir")}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>{ts("Title *", "Tajuk *")}</Label><Input className="mt-1" value={edForm.title} onChange={(e) => setEdForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>{ts("Due date *", "Tarikh akhir *")}</Label><Input className="mt-1" type="date" value={edForm.dueDate} onChange={(e) => setEdForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
            <div><Label>{ts("Basis", "Asas")}</Label><Input className="mt-1" value={edForm.basis} onChange={(e) => setEdForm((f) => ({ ...f, basis: e.target.value }))} /></div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditingDeadline(null)}>{ts("Cancel", "Batal")}</Button>
              <Button className="flex-1" onClick={saveEditDeadline} disabled={updateDl.isPending}>{ts("Save", "Simpan")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View doc */}
      <Dialog open={!!viewDoc} onOpenChange={(o) => { if (!o) setViewDoc(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="font-serif">{viewDoc?.title ?? t("Document", "Dokumen")}</DialogTitle></DialogHeader>
          {viewDoc && (
            <div className="space-y-4">
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => { navigator.clipboard.writeText(viewDoc.content); toast({ title: ts("Copied", "Disalin") }); }}>
                  <Copy className="h-3.5 w-3.5" /> {t("Copy", "Salin")}
                </Button>
              </div>
              <div className="bg-background border border-border rounded-lg p-4 max-h-[55vh] overflow-y-auto">
                <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">{viewDoc.content}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
