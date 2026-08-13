import { useState } from "react";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  Check,
  Wand2,
  AlertTriangle,
  CircleCheck,
  Building2,
  Scale,
  Hash,
  Clock,
  FileText,
  Workflow,
  Loader2,
  Brain,
  RefreshCw,
  ChevronRight,
  User,
  Users,
  Timer,
  ClipboardList,
  BarChart3,
  Calendar,
  Download,
  Gavel,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  History,
  Link2,
  Unlink,
  Sparkles,
  Calculator,
  FolderLock,
  FileSignature,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { DraftExportButtons } from "@workspace/draft-export/react";
import { useCrimListWorkflows } from "@workspace/api-client-react";
import { BillingTab, type BillingRequest } from "@workspace/billing-ui";
import { DocumentsPanel, type VaultRequest } from "@workspace/vault-ui";
import { DraftsPanel, type LettersRequest } from "@workspace/letters-ui";

const billingRequest: BillingRequest = (path, init) =>
  fetch(`/api/crim/matters${path}`, { credentials: "include", ...init });
const vaultRequest: VaultRequest = billingRequest;
const lettersRequest: LettersRequest = billingRequest;
import {
  useMatter,
  useUpdateMatter,
  useDeleteMatter,
  useMatterWork,
  useDeadlineTriggers,
  useComputeDeadlines,
  useAddDeadline,
  useAddDeadlinesBulk,
  useUpdateDeadline,
  useDeleteDeadline,
  useAiInsights,
  useRefreshAiInsights,
  useIntakeBriefing,
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
  useLinkClientToMatter,
  useUnlinkClientFromMatter,
  useCaseEvents,
  useAddCaseEvent,
  useUpdateCaseEvent,
  useDeleteCaseEvent,
  useCaseReview,
  CASE_EVENT_KINDS,
  CRIM_STAGES,
  categoryMeta,
  daysUntil,
  type MatterDeadline,
  type ComputedDeadline,
  type SavedWorkItem,
  type MatterInput,
  type ClientItem,
  type CaseEvent,
} from "@/hooks/use-matters";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";

const CATEGORY_OPTIONS = ["remand", "charge", "bail", "trial", "appeal", "revision", "custom"];
const STATUS_OPTIONS = ["open", "on-hold", "closed"];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

function StageStepper({ currentStatus, matterId }: { currentStatus: string; matterId: number }) {
  const updateStage = useUpdateStage();
  const { toast } = useToast();
  const currentIdx = CRIM_STAGES.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {CRIM_STAGES.map((stage, idx) => {
        const isActive = stage === currentStatus;
        const isPast = currentIdx >= 0 && idx < currentIdx;
        return (
          <button
            key={stage}
            onClick={async () => {
              if (isActive) return;
              try {
                await updateStage.mutateAsync({ matterId, stage });
                toast({ title: `Stage advanced to ${stage}` });
              } catch (e) {
                toast({ title: "Could not update stage", description: e instanceof Error ? e.message : "", variant: "destructive" });
              }
            }}
            disabled={updateStage.isPending}
            title={`Set stage to ${stage}`}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : isPast
                ? "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                : "bg-muted text-muted-foreground border-border hover:border-primary/40 hover:text-primary"
            }`}
          >
            {isPast && <Check className="h-3 w-3" />}
            {stage}
          </button>
        );
      })}
    </div>
  );
}

function IntakeBriefingPanel({ matterId }: { matterId: number }) {
  const { data: briefing } = useIntakeBriefing(matterId);
  const [open, setOpen] = useState(false);
  if (!briefing) return null;
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
              Read-only intake snapshot · generated {new Date(briefing.generatedAt).toLocaleDateString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AiInsightsPanel({ matterId }: { matterId: number }) {
  const { data: insights, isLoading, error } = useAiInsights(matterId);
  const refresh = useRefreshAiInsights();
  const { toast } = useToast();

  const handleRefresh = async () => {
    try {
      await refresh.mutateAsync(matterId);
      toast({ title: "AI insights refreshed" });
    } catch {
      toast({ title: "Could not refresh insights", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
          <p className="text-sm text-muted-foreground">Generating AI case analysis…</p>
        </CardContent>
      </Card>
    );
  }

  if (error || !insights) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-5 flex items-center gap-3">
          <Brain className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground flex-1">AI insights unavailable. Add documents and deadlines to enable analysis.</p>
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handleRefresh} disabled={refresh.isPending}>
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="font-serif font-semibold text-foreground">AI Case Analysis</h3>
          <RiskBadge rating={insights.riskAssessment.rating} />
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={handleRefresh} disabled={refresh.isPending}>
          <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Case Summary</p>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">{insights.caseSummary}</p>
        </CardContent>
      </Card>

      {insights.riskAssessment.keyStrengths.length > 0 || insights.riskAssessment.keyWeaknesses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.riskAssessment.keyStrengths.length > 0 && (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold mb-2">Key Strengths</p>
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
                <p className="text-xs uppercase tracking-wide text-amber-600 font-semibold mb-2">Key Weaknesses</p>
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
      ) : null}

      {insights.nextSteps.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Prioritised Next Steps</p>
          <div className="space-y-2">
            {insights.nextSteps.map((step, i) => {
              const priorityColors = {
                high: "border-l-red-500 bg-red-500/5",
                medium: "border-l-amber-500 bg-amber-500/5",
                low: "border-l-slate-400 bg-slate-500/5",
              };
              const priorityBadge = {
                high: "text-red-600 bg-red-500/10 border-red-500/20",
                medium: "text-amber-600 bg-amber-500/10 border-amber-500/20",
                low: "text-slate-500 bg-slate-500/10 border-slate-400/20",
              };
              return (
                <div key={i} className={`border-l-2 pl-3 py-2 rounded-r ${priorityColors[step.priority]}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-foreground font-medium">{step.action}</p>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${priorityBadge[step.priority]}`}>
                      {step.priority}
                    </span>
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

function ChecklistTab({ matterId }: { matterId: number }) {
  const { data: items, isLoading } = useChecklist(matterId);
  const addItem = useAddChecklistItem();
  const updateItem = useUpdateChecklistItem();
  const deleteItem = useDeleteChecklistItem();
  const { toast } = useToast();
  const [newText, setNewText] = useState("");

  const done = (items ?? []).filter((i) => i.done).length;
  const total = (items ?? []).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const toggle = async (item: { id: number; done: boolean }) => {
    try {
      await updateItem.mutateAsync({ matterId, itemId: item.id, done: !item.done });
    } catch {
      toast({ title: "Could not update item", variant: "destructive" });
    }
  };

  const addCustom = async () => {
    if (!newText.trim()) return;
    try {
      await addItem.mutateAsync({ matterId, item_text: newText.trim() });
      setNewText("");
    } catch {
      toast({ title: "Could not add item", variant: "destructive" });
    }
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading checklist…</div>;

  return (
    <div className="space-y-4">
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{done} of {total} items completed</span>
            <span className="font-semibold text-primary">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
      )}

      {total === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-10 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-serif font-semibold text-foreground mb-1">Checklist generating…</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              An AI procedural checklist is being generated for this matter. It may take a moment to appear. You can also add items manually below.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items!.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${item.done ? "opacity-60 border-border/30 bg-card/30" : "border-border/50 bg-card/50"}`}
            >
              <button
                onClick={() => toggle(item)}
                className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  item.done ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary"
                }`}
              >
                {item.done && <Check className="h-3 w-3" />}
              </button>
              <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                {item.item_text}
              </span>
              <button
                onClick={async () => {
                  try { await deleteItem.mutateAsync({ matterId, itemId: item.id }); }
                  catch { toast({ title: "Could not delete item", variant: "destructive" }); }
                }}
                className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary shrink-0"
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
          onKeyDown={(e) => e.key === "Enter" && addCustom()}
          placeholder="Add a custom checklist item…"
          className="flex-1"
        />
        <Button onClick={addCustom} disabled={addItem.isPending || !newText.trim()} className="gap-2">
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </div>
  );
}

function TimeTab({ matterId }: { matterId: number }) {
  const { data, isLoading } = useTimeEntries(matterId);
  const addEntry = useAddTimeEntry();
  const deleteEntry = useDeleteTimeEntry();
  const { toast } = useToast();
  const [form, setForm] = useState({ description: "", minutes: "", rate_usd: "", entry_date: new Date().toISOString().slice(0, 10) });

  const submitEntry = async () => {
    if (!form.description.trim() || !form.minutes) return;
    const mins = parseInt(form.minutes, 10);
    if (isNaN(mins) || mins < 0) {
      toast({ title: "Invalid minutes", variant: "destructive" });
      return;
    }
    try {
      await addEntry.mutateAsync({
        matterId,
        description: form.description.trim(),
        minutes: mins,
        rate_usd: form.rate_usd ? parseFloat(form.rate_usd) : null,
        entry_date: form.entry_date,
      });
      setForm({ description: "", minutes: "", rate_usd: "", entry_date: new Date().toISOString().slice(0, 10) });
      toast({ title: "Time entry logged" });
    } catch {
      toast({ title: "Could not log time", variant: "destructive" });
    }
  };

  const total = data?.totalMinutes ?? 0;
  const hours = Math.floor(total / 60);
  const mins = total % 60;

  if (isLoading) return <div className="py-8 text-center text-muted-foreground animate-pulse">Loading time entries…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Total time recorded</p>
          <p className="text-2xl font-bold text-primary mt-0.5">{hours}h {mins}m</p>
        </div>
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4" /> Log Time
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div>
            <Label className="text-xs">Description *</Label>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Client conference, file review…" className="mt-1" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Minutes *</Label>
              <Input type="number" min="0" value={form.minutes} onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))} placeholder="60" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Rate (USD/hr)</Label>
              <Input type="number" min="0" step="0.01" value={form.rate_usd} onChange={(e) => setForm((f) => ({ ...f, rate_usd: e.target.value }))} placeholder="0.00" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} className="mt-1" />
            </div>
          </div>
          <Button onClick={submitEntry} disabled={addEntry.isPending || !form.description.trim() || !form.minutes} className="w-full gap-2">
            {addEntry.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Log time
          </Button>
        </CardContent>
      </Card>

      {(data?.entries.length ?? 0) === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-8 text-center">
            <Timer className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No time entries yet. Log your first entry above.</p>
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
                  <Timer className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fmtDate(entry.entry_date)} · {h > 0 ? `${h}h ` : ""}{m > 0 ? `${m}m` : ""}
                      {entry.rate_usd ? ` · $${parseFloat(entry.rate_usd).toFixed(2)}/hr` : ""}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try { await deleteEntry.mutateAsync({ matterId, entryId: entry.id }); }
                      catch { toast({ title: "Could not delete entry", variant: "destructive" }); }
                    }}
                    className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary shrink-0"
                  >
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

function TeamTab({ matterId, clientName }: { matterId: number; clientName: string | null }) {
  const { data: clients } = useClients();
  const { data: linkedClients } = useMatterClients(matterId);
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const linkClient = useLinkClientToMatter();
  const unlinkClient = useUnlinkClientFromMatter();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [editClient, setEditClient] = useState<ClientItem | null>(null);
  const [form, setForm] = useState({ name: "", ic_number: "", company_name: "", email: "", phone: "", address: "", notes: "" });
  // Inline "create + link" mini form
  const [newLink, setNewLink] = useState({ name: "", phone: "", email: "" });

  const linkedIds = new Set((linkedClients ?? []).map((c) => c.id));
  const suggested = clients?.find((c) => clientName && c.name.toLowerCase().includes(clientName.toLowerCase()));
  const linkableClients = (clients ?? []).filter((c) => !linkedIds.has(c.id));

  const submitAdd = async () => {
    if (!form.name.trim()) return;
    try {
      await createClient.mutateAsync({ name: form.name.trim(), ic_number: form.ic_number || undefined, company_name: form.company_name || undefined, email: form.email || undefined, phone: form.phone || undefined, address: form.address || undefined, notes: form.notes || undefined });
      toast({ title: "Client saved" });
      setAddOpen(false);
      setForm({ name: "", ic_number: "", company_name: "", email: "", phone: "", address: "", notes: "" });
    } catch {
      toast({ title: "Could not save client", variant: "destructive" });
    }
  };

  const submitEdit = async () => {
    if (!editClient) return;
    try {
      await updateClient.mutateAsync({ id: editClient.id, ...form });
      toast({ title: "Client updated" });
      setEditClient(null);
    } catch {
      toast({ title: "Could not update client", variant: "destructive" });
    }
  };

  const doLink = async (clientId: number) => {
    try {
      await linkClient.mutateAsync({ clientId, matterId });
      toast({ title: "Client linked to matter" });
    } catch (e) {
      toast({ title: "Could not link client", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const doUnlink = async (clientId: number) => {
    try {
      await unlinkClient.mutateAsync({ clientId, matterId });
      toast({ title: "Client unlinked" });
    } catch (e) {
      toast({ title: "Could not unlink client", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const createAndLink = async () => {
    if (!newLink.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      const created = await createClient.mutateAsync({
        name: newLink.name.trim(),
        phone: newLink.phone || undefined,
        email: newLink.email || undefined,
      });
      await linkClient.mutateAsync({ clientId: created.id, matterId });
      toast({ title: "Client created and linked" });
      setNewLink({ name: "", phone: "", email: "" });
      setLinkOpen(false);
    } catch (e) {
      toast({ title: "Could not create client", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Clients
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setLinkOpen(true)}>
            <Link2 className="h-4 w-4" /> Link client
          </Button>
          <Button size="sm" className="gap-2" onClick={() => {
            setForm({ name: clientName ?? "", ic_number: "", company_name: "", email: "", phone: "", address: "", notes: "" });
            setAddOpen(true);
          }}>
            <Plus className="h-4 w-4" /> Add client
          </Button>
        </div>
      </div>

      {/* Linked-to-this-matter section */}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Linked to this matter</p>
        {(linkedClients?.length ?? 0) === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-6 text-center">
              <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No client linked to this matter yet. Use "Link client" above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {linkedClients!.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onEdit={(c) => { setEditClient(c); setForm({ name: c.name, ic_number: c.ic_number ?? "", company_name: c.company_name ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" }); }}
                onUnlink={() => doUnlink(client.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Full directory */}
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">All client records</p>
        {suggested && (
          <Card className="border-primary/20 bg-primary/5 mb-2">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-primary font-semibold mb-2">Matched client</p>
              <ClientCard client={suggested} onEdit={(c) => { setEditClient(c); setForm({ name: c.name, ic_number: c.ic_number ?? "", company_name: c.company_name ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" }); }} onLink={linkedIds.has(suggested.id) ? undefined : () => doLink(suggested.id)} linked={linkedIds.has(suggested.id)} />
            </CardContent>
          </Card>
        )}

        {(clients?.length ?? 0) === 0 ? (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="p-8 text-center">
              <User className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No client records yet. Add a client card to track contact details.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {clients!.filter((c) => c.id !== suggested?.id).map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onEdit={(c) => { setEditClient(c); setForm({ name: c.name, ic_number: c.ic_number ?? "", company_name: c.company_name ?? "", email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" }); }}
                onLink={linkedIds.has(client.id) ? undefined : () => doLink(client.id)}
                linked={linkedIds.has(client.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Link client dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Link a Client</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Pick from your clients</p>
              {linkableClients.length === 0 ? (
                <p className="text-sm text-muted-foreground">All your clients are already linked. Create a new one below.</p>
              ) : (
                <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                  {linkableClients.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border/50 bg-card/50">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        {(c.phone || c.email) && <p className="text-xs text-muted-foreground truncate">{[c.phone, c.email].filter(Boolean).join(" · ")}</p>}
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => doLink(c.id)} disabled={linkClient.isPending}>
                        <Link2 className="h-3.5 w-3.5" /> Link
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="pt-2 border-t border-border/50">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Or create &amp; link a new client</p>
              <div className="space-y-2">
                <Input placeholder="Full name *" value={newLink.name} onChange={(e) => setNewLink((f) => ({ ...f, name: e.target.value }))} />
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Phone" value={newLink.phone} onChange={(e) => setNewLink((f) => ({ ...f, phone: e.target.value }))} />
                  <Input placeholder="Email" value={newLink.email} onChange={(e) => setNewLink((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <Button className="w-full gap-2" onClick={createAndLink} disabled={createClient.isPending || linkClient.isPending || !newLink.name.trim()}>
                  {(createClient.isPending || linkClient.isPending) && <Loader2 className="h-4 w-4 animate-spin" />} Create &amp; link
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add client dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Add Client</DialogTitle></DialogHeader>
          <ClientForm form={form} setForm={setForm} />
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={submitAdd} disabled={createClient.isPending || !form.name.trim()}>
              {createClient.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit client dialog */}
      <Dialog open={!!editClient} onOpenChange={(o) => !o && setEditClient(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Edit Client</DialogTitle></DialogHeader>
          <ClientForm form={form} setForm={setForm} />
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setEditClient(null)}>Cancel</Button>
            <Button className="flex-1" onClick={submitEdit} disabled={updateClient.isPending}>
              {updateClient.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientCard({
  client,
  onEdit,
  onUnlink,
  onLink,
  linked,
}: {
  client: ClientItem;
  onEdit: (c: ClientItem) => void;
  onUnlink?: () => void;
  onLink?: () => void;
  linked?: boolean;
}) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-foreground">{client.name}</p>
              {linked && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border text-primary bg-primary/10 border-primary/20">Linked</span>}
            </div>
            {client.ic_number && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><CreditCard className="h-3 w-3" /> {client.ic_number}</p>}
            {client.company_name && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {client.company_name}</p>}
            {client.email && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="h-3 w-3" /> {client.email}</p>}
            {client.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" /> {client.phone}</p>}
            {client.address && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {client.address}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onLink && (
              <Button variant="ghost" size="sm" onClick={onLink} className="gap-1.5" title="Link to this matter"><Link2 className="h-3.5 w-3.5" /></Button>
            )}
            {onUnlink && (
              <Button variant="ghost" size="sm" onClick={onUnlink} className="gap-1.5 text-muted-foreground hover:text-destructive" title="Unlink from this matter"><Unlink className="h-3.5 w-3.5" /></Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onEdit(client)}><Pencil className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        {client.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50 whitespace-pre-wrap">{client.notes}</p>}
      </CardContent>
    </Card>
  );
}

function ClientForm({ form, setForm }: { form: Record<string, string>; setForm: React.Dispatch<React.SetStateAction<Record<string, string>>> }) {
  return (
    <div className="space-y-3">
      <div><Label>Full name *</Label><Input className="mt-1" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
      <div><Label>IC / Passport no.</Label><Input className="mt-1" value={form.ic_number} onChange={(e) => setForm((f) => ({ ...f, ic_number: e.target.value }))} /></div>
      <div><Label>Company</Label><Input className="mt-1" value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Email</Label><Input className="mt-1" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
        <div><Label>Phone</Label><Input className="mt-1" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></div>
      </div>
      <div><Label>Address</Label><Textarea className="mt-1" rows={2} value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
      <div><Label>Notes</Label><Textarea className="mt-1" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
    </div>
  );
}

function downloadIcs(matter: { title: string; deadlines: MatterDeadline[] }) {
  const escape = (s: string) => s.replace(/[,;\\]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const dtFmt = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
  const uid = (id: number) => `crim-dl-${id}@mycrimai`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyCrimAI//Matter Calendar//EN",
    ...matter.deadlines.flatMap((d) => [
      "BEGIN:VEVENT",
      `UID:${uid(d.id)}`,
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

const EVENT_KIND_META: Record<string, { label: string; color: string }> = {
  filing: { label: "Filing", color: "text-blue-600 bg-blue-500/10 border-blue-500/20" },
  hearing: { label: "Hearing", color: "text-amber-600 bg-amber-500/10 border-amber-500/20" },
  correspondence: { label: "Correspondence", color: "text-cyan-600 bg-cyan-500/10 border-cyan-500/20" },
  instruction: { label: "Instruction", color: "text-violet-600 bg-violet-500/10 border-violet-500/20" },
  deadline: { label: "Deadline", color: "text-red-600 bg-red-500/10 border-red-500/20" },
  stage: { label: "Stage", color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20" },
  "saved-work": { label: "Saved work", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" },
  note: { label: "Note", color: "text-slate-500 bg-slate-500/10 border-slate-400/20" },
  payment: { label: "Payment", color: "text-green-600 bg-green-500/10 border-green-500/20" },
  meeting: { label: "Meeting", color: "text-orange-600 bg-orange-500/10 border-orange-500/20" },
};

function eventKindMeta(kind: string) {
  return EVENT_KIND_META[kind] ?? EVENT_KIND_META.note;
}

function ChronologyTab({ matterId }: { matterId: number }) {
  const { data: events, isLoading } = useCaseEvents(matterId);
  const addEvent = useAddCaseEvent();
  const updateEvent = useUpdateCaseEvent();
  const deleteEvent = useDeleteCaseEvent();
  const { toast } = useToast();

  const blank = { title: "", event_date: new Date().toISOString().slice(0, 10), kind: "note", description: "" };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<CaseEvent | null>(null);
  const [editForm, setEditForm] = useState(blank);

  const sorted = [...(events ?? [])].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
  );

  const submitAdd = async () => {
    if (!form.title.trim() || !form.event_date) {
      toast({ title: "Title and date required", variant: "destructive" });
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
      toast({ title: "Event added to chronology" });
      setForm(blank);
    } catch (e) {
      toast({ title: "Could not add event", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const openEdit = (ev: CaseEvent) => {
    setEditing(ev);
    setEditForm({
      title: ev.title,
      event_date: ev.event_date.slice(0, 10),
      kind: ev.kind,
      description: ev.description ?? "",
    });
  };

  const submitEdit = async () => {
    if (!editing || !editForm.title.trim() || !editForm.event_date) {
      toast({ title: "Title and date required", variant: "destructive" });
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
      toast({ title: "Event updated" });
      setEditing(null);
    } catch (e) {
      toast({ title: "Could not update event", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const removeEvent = async (ev: CaseEvent) => {
    try {
      await deleteEvent.mutateAsync({ matterId, eventId: ev.id });
    } catch (e) {
      toast({ title: "Could not delete event", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-serif font-bold text-lg flex items-center gap-2">
        <History className="h-5 w-5 text-primary" /> Case Chronology
      </h2>

      {/* Add event form */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> Add Event</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Kind</Label>
              <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CASE_EVENT_KINDS.map((k) => <SelectItem key={k} value={k}>{eventKindMeta(k).label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Title *</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Charge read and understood" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="mt-1" />
          </div>
          <Button onClick={submitAdd} disabled={addEvent.isPending || !form.title.trim() || !form.event_date} className="w-full gap-2">
            {addEvent.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add event
          </Button>
        </CardContent>
      </Card>

      {/* Timeline */}
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground animate-pulse">Loading chronology…</div>
      ) : sorted.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-10 text-center">
            <History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No chronology events yet. Add the first event above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border/50" />
          <div className="space-y-3 pl-10">
            {sorted.map((ev) => {
              const meta = eventKindMeta(ev.kind);
              return (
                <div key={ev.id} className="relative">
                  <div className="absolute -left-6 top-3 h-3 w-3 rounded-full border-2 bg-primary border-primary" />
                  <Card className="border-border/50 bg-card/50">
                    <CardContent className="p-3 flex items-start gap-3">
                      <CalendarClock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{ev.title}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${meta.color}`}>{meta.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(ev.event_date)}</p>
                        {ev.description && <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap leading-relaxed">{ev.description}</p>}
                        {ev.source && <p className="text-[10px] text-muted-foreground/60 mt-1">Source: {ev.source}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(ev)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => removeEvent(ev)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit event dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Edit Event</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date *</Label>
                <Input type="date" value={editForm.event_date} onChange={(e) => setEditForm((f) => ({ ...f, event_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Kind</Label>
                <Select value={editForm.kind} onValueChange={(v) => setEditForm((f) => ({ ...f, kind: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CASE_EVENT_KINDS.map((k) => <SelectItem key={k} value={k}>{eventKindMeta(k).label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Title *</Label>
              <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="flex-1" onClick={submitEdit} disabled={updateEvent.isPending}>Save changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AiCaseReviewButton({ matterId }: { matterId: number }) {
  const review = useCaseReview();
  const { toast } = useToast();
  const [result, setResult] = useState<string | null>(null);

  const run = async () => {
    setResult(null);
    try {
      const res = await review.mutateAsync(matterId);
      setResult(res.review);
    } catch (e) {
      toast({ title: "Case review failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-serif font-semibold text-foreground">AI Case Review</h3>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={run} disabled={review.isPending}>
            {review.isPending
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reviewing…</>
              : <><Sparkles className="h-3.5 w-3.5" /> {result ? "Re-run review" : "Run case review"}</>}
          </Button>
        </div>
        {!result && !review.isPending && (
          <p className="text-sm text-muted-foreground">
            Generate a grounded review of this matter — current position, risks and prioritised next actions. Takes up to a minute.
          </p>
        )}
        {review.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Assembling context and generating review…
          </div>
        )}
        {result && (
          <div className="pt-2 border-t border-border/50">
            <MarkdownRenderer content={result} />
            <p className="text-[10px] text-muted-foreground/60 mt-3">AI-generated · verify against the file before relying on it.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MatterDetailPage() {
  const params = useParams();
  const id = params.id ? parseInt(params.id, 10) : null;
  const { data: matter, isLoading } = useMatter(id);
  const { data: matterWork } = useMatterWork(id);
  const { toast } = useToast();

  const updateMatter = useUpdateMatter();
  const deleteMatter = useDeleteMatter();
  const { data: triggers } = useDeadlineTriggers();
  const compute = useComputeDeadlines();
  const addDeadline = useAddDeadline();
  const addBulk = useAddDeadlinesBulk();
  const updateDeadline = useUpdateDeadline();
  const deleteDeadline = useDeleteDeadline();

  const { data: workflows } = useCrimListWorkflows();
  const linkedWorkflow = matter?.workflowId
    ? (workflows ?? []).find((w) => w.id === matter.workflowId)
    : undefined;

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<MatterInput>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [dForm, setDForm] = useState({ title: "", dueDate: "", category: "custom", basis: "", notes: "" });

  const [computeOpen, setComputeOpen] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [triggerDate, setTriggerDate] = useState("");
  const [preview, setPreview] = useState<ComputedDeadline[]>([]);
  const [picked, setPicked] = useState<Record<number, boolean>>({});

  const [editingDeadline, setEditingDeadline] = useState<MatterDeadline | null>(null);
  const [edForm, setEdForm] = useState({ title: "", dueDate: "", category: "custom", basis: "", notes: "" });

  const [viewDoc, setViewDoc] = useState<SavedWorkItem | null>(null);

  if (isLoading) return <div className="p-8 text-center text-primary animate-pulse">Loading matter…</div>;
  if (!matter) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">This matter could not be found.</p>
        <Button variant="outline" className="gap-2" asChild><Link href="/workspace/matters"><ArrowLeft className="h-4 w-4" /> Back to matters</Link></Button>
      </div>
    );
  }

  const openEdit = () => {
    setEditForm({
      title: matter.title,
      clientName: matter.clientName ?? "",
      accusedName: matter.accusedName ?? "",
      charge: matter.charge ?? "",
      court: matter.court ?? "",
      caseNo: matter.caseNo ?? "",
      workflowId: matter.workflowId,
      status: matter.status,
      notes: matter.notes ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editForm.title?.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    try {
      await updateMatter.mutateAsync({ id: matter.id, ...editForm });
      toast({ title: "Matter updated" });
      setEditOpen(false);
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const doDelete = async () => {
    try {
      await deleteMatter.mutateAsync(matter.id);
      toast({ title: "Matter deleted" });
      window.history.back();
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const submitAdd = async () => {
    if (!dForm.title.trim() || !dForm.dueDate) {
      toast({ title: "Title and due date required", variant: "destructive" });
      return;
    }
    try {
      await addDeadline.mutateAsync({ matterId: matter.id, ...dForm });
      toast({ title: "Deadline added" });
      setAddOpen(false);
      setDForm({ title: "", dueDate: "", category: "custom", basis: "", notes: "" });
    } catch (e) {
      toast({ title: "Could not add deadline", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const runCompute = async () => {
    if (!trigger || !triggerDate) {
      toast({ title: "Pick a trigger and its date", variant: "destructive" });
      return;
    }
    try {
      const rows = await compute.mutateAsync({ matterId: matter.id, trigger, triggerDate });
      setPreview(rows);
      setPicked(Object.fromEntries(rows.map((_, i) => [i, true])));
    } catch (e) {
      toast({ title: "Could not compute", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const saveComputed = async () => {
    const chosen = preview.filter((_, i) => picked[i]);
    if (chosen.length === 0) {
      toast({ title: "Select at least one deadline", variant: "destructive" });
      return;
    }
    try {
      await addBulk.mutateAsync({
        matterId: matter.id,
        deadlines: chosen.map((c) => ({ title: c.title, dueDate: c.dueDate, category: c.category, basis: c.basis, notes: c.notes })),
      });
      toast({ title: `${chosen.length} deadline(s) added` });
      setComputeOpen(false);
      setPreview([]);
      setTrigger("");
      setTriggerDate("");
    } catch (e) {
      toast({ title: "Could not save", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const toggleDone = async (d: MatterDeadline) => {
    try {
      await updateDeadline.mutateAsync({ matterId: matter.id, id: d.id, status: d.status === "done" ? "pending" : "done" });
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const openEditDeadline = (d: MatterDeadline) => {
    setEditingDeadline(d);
    setEdForm({ title: d.title, dueDate: d.dueDate.slice(0, 10), category: d.category, basis: d.basis ?? "", notes: d.notes ?? "" });
  };

  const saveEditDeadline = async () => {
    if (!editingDeadline) return;
    if (!edForm.title.trim() || !edForm.dueDate) {
      toast({ title: "Title and due date required", variant: "destructive" });
      return;
    }
    try {
      await updateDeadline.mutateAsync({ matterId: matter.id, id: editingDeadline.id, ...edForm });
      toast({ title: "Deadline updated" });
      setEditingDeadline(null);
    } catch (e) {
      toast({ title: "Could not update", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const removeDeadline = async (d: MatterDeadline) => {
    try {
      await deleteDeadline.mutateAsync({ matterId: matter.id, id: d.id });
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const deadlines = matter.deadlines ?? [];
  const pending = deadlines.filter((d) => d.status !== "done");
  const done = deadlines.filter((d) => d.status === "done");
  const selectedTrigger = triggers?.find((t) => t.trigger === trigger);

  // Timeline: merge deadlines + documents sorted by date
  const timelineItems: Array<{ type: "deadline" | "doc"; date: string; label: string; id: number; extra?: string; item?: SavedWorkItem; dl?: MatterDeadline }> = [
    ...deadlines.map((d) => ({ type: "deadline" as const, date: d.dueDate, label: d.title, id: d.id, extra: categoryMeta(d.category).label, dl: d })),
    ...(matterWork ?? []).map((w) => ({ type: "doc" as const, date: w.updatedAt, label: w.title, id: w.id, item: w })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const hearingCategories = ["remand", "charge", "trial"];
  const hearingDeadlines = deadlines.filter((d) => hearingCategories.includes(d.category));

  // AI tool launch links with matter context
  const matterParams = new URLSearchParams();
  if (matter.title) matterParams.set("matterTitle", matter.title);
  if (matter.accusedName) matterParams.set("accused", matter.accusedName);
  if (matter.charge) matterParams.set("charge", matter.charge);
  if (matter.caseNo) matterParams.set("caseNo", matter.caseNo);
  if (matter.court) matterParams.set("court", matter.court);
  const matterQuery = matterParams.toString();

  const aiTools = [
    { name: "Case Analyzer", href: `/workspace/ai/case-analyzer?${matterQuery}`, icon: Scale },
    { name: "Document Drafter", href: `/workspace/ai/document-drafter?${matterQuery}`, icon: FileText },
    { name: "Charge Analyzer", href: `/workspace/ai/charge-analyzer?${matterQuery}`, icon: Gavel },
    { name: "Case Strategy", href: `/workspace/ai/case-strategy?${matterQuery}`, icon: Brain },
    { name: "Legal Opinion", href: `/workspace/ai/legal-opinion?${matterQuery}`, icon: Scale },
    { name: "Appeal Grounds", href: `/workspace/ai/appeal-grounds?${matterQuery}`, icon: ArrowRight },
  ];

  return (
    <div className="pb-16">
      {/* Header */}
      <Link href="/workspace/matters" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" /> All matters
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="space-y-1 min-w-0">
          <h1 className="font-serif text-2xl font-bold tracking-tight" data-testid="text-matter-title">{matter.title}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {matter.fileRef && <span className="text-xs text-muted-foreground">#{matter.fileRef}</span>}
            {matter.caseNo && <span className="text-xs text-muted-foreground">· {matter.caseNo}</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" className="gap-2" onClick={openEdit}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Stage stepper */}
      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Case Stage</p>
        <StageStepper currentStatus={matter.status} matterId={matter.id} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Timeline</TabsTrigger>
          <TabsTrigger value="chronology" className="gap-1.5"><History className="h-3.5 w-3.5" /> Chronology</TabsTrigger>
          <TabsTrigger value="hearings" className="gap-1.5"><Gavel className="h-3.5 w-3.5" /> Hearings</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Documents {(matterWork?.length ?? 0) > 0 && <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4">{matterWork!.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1.5"><ClipboardList className="h-3.5 w-3.5" /> Checklist</TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Team</TabsTrigger>
          <TabsTrigger value="time" className="gap-1.5"><Timer className="h-3.5 w-3.5" /> Time</TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5"><Calculator className="h-3.5 w-3.5" /> Billing</TabsTrigger>
          <TabsTrigger value="vault" className="gap-1.5"><FolderLock className="h-3.5 w-3.5" /> Vault</TabsTrigger>
          <TabsTrigger value="letters" className="gap-1.5"><FileSignature className="h-3.5 w-3.5" /> Drafts &amp; Letters</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Intake Briefing */}
          <IntakeBriefingPanel matterId={matter.id} />

          {/* AI Insights */}
          <AiInsightsPanel matterId={matter.id} />

          {/* AI Case Review (on-demand) */}
          <AiCaseReviewButton matterId={matter.id} />

          {/* Matter info */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">Matter Details</p>
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                {[
                  { icon: Hash, label: "File ref", value: matter.fileRef },
                  { icon: Building2, label: "Client", value: matter.clientName },
                  { icon: Scale, label: "Accused", value: matter.accusedName },
                  { icon: Scale, label: "Charge", value: matter.charge },
                  { icon: Building2, label: "Court", value: matter.court },
                  { icon: Hash, label: "Case no.", value: matter.caseNo },
                ].filter((r) => r.value).map((r) => {
                  const Icon = r.icon;
                  return (
                    <div key={r.label} className="flex items-center gap-2.5 text-sm">
                      <Icon className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-muted-foreground">{r.label}:</span>
                      <span className="text-foreground font-medium truncate">{r.value}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {matter.notes && (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Notes</p>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{matter.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Linked workflow */}
          <Card className="border-primary/25 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3">
                <Workflow className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {linkedWorkflow ? linkedWorkflow.title : "Practice workflow"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {linkedWorkflow ? "Step-by-step procedure for this stage." : "Link a criminal-procedure workflow from Edit."}
                  </p>
                </div>
              </div>
              <Button size="sm" className="gap-2 shrink-0" asChild>
                <Link href={linkedWorkflow ? `/workspace/workflows/${linkedWorkflow.id}` : "/workspace/workflows"}>
                  {linkedWorkflow ? "Open workflow" : "Browse workflows"} <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* AI tool launch */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">Launch AI Tools for This Matter</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {aiTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link key={tool.name} href={tool.href} className="w-full text-left flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-card/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-foreground truncate">{tool.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Timeline tab */}
        <TabsContent value="timeline" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-serif font-bold text-lg flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Case Timeline</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadIcs(matter)}>
                <Download className="h-3.5 w-3.5" /> Export .ics
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setComputeOpen(true)}><Wand2 className="h-3.5 w-3.5" /> Compute from CPC</Button>
              <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add deadline</Button>
            </div>
          </div>

          {timelineItems.length === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-10 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No timeline events yet. Add deadlines or file documents to build the case timeline.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border/50" />
              <div className="space-y-4 pl-10">
                {timelineItems.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="relative">
                    <div className={`absolute -left-6 top-2 h-3 w-3 rounded-full border-2 ${item.type === "deadline" ? "bg-primary border-primary" : "bg-card border-primary/50"}`} />
                    <Card className="border-border/50 bg-card/50">
                      <CardContent className="p-3 flex items-center gap-3">
                        {item.type === "deadline" ? (
                          <>
                            <CalendarClock className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{item.label}</span>
                                {item.extra && <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${categoryMeta(item.dl!.category).color}`}>{item.extra}</span>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(item.date)}</p>
                            </div>
                            <CountdownBadge due={item.dl!.dueDate} status={item.dl!.status} />
                            <button onClick={() => toggleDone(item.dl!)} className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${item.dl!.status === "done" ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"}`}>
                              {item.dl!.status === "done" && <Check className="h-3 w-3" />}
                            </button>
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{item.label}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">Filed {fmtDate(item.date)}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setViewDoc(item.item!)}>View</Button>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800/80 leading-relaxed">
              Computed dates apply ordinary CPC / Courts of Judicature Act periods and roll forward off weekends. <span className="text-amber-700 font-medium">Always verify against sealed orders before relying on a date.</span>
            </p>
          </div>
        </TabsContent>

        {/* Chronology tab */}
        <TabsContent value="chronology">
          <ChronologyTab matterId={matter.id} />
        </TabsContent>

        {/* Hearings tab */}
        <TabsContent value="hearings" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-serif font-bold text-lg flex items-center gap-2"><Gavel className="h-5 w-5 text-primary" /> Hearings &amp; Key Dates</h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => downloadIcs(matter)}><Download className="h-3.5 w-3.5" /> Export .ics</Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setComputeOpen(true)}><Wand2 className="h-3.5 w-3.5" /> Compute from CPC</Button>
              <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add</Button>
            </div>
          </div>

          {hearingDeadlines.length === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-10 text-center">
                <Gavel className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No hearing dates yet. Add remand, charge or trial deadlines and they'll appear here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {[...pending.filter((d) => hearingCategories.includes(d.category)), ...done.filter((d) => hearingCategories.includes(d.category))].map((d) => {
                const cat = categoryMeta(d.category);
                const isDone = d.status === "done";
                return (
                  <Card key={d.id} className={`border-border/50 bg-card/50 transition-all ${isDone ? "opacity-60" : ""}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <button onClick={() => toggleDone(d)} className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 ${isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"}`}>
                        {isDone && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{d.title}</span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" /> {fmtDate(d.dueDate)}
                        </div>
                      </div>
                      <CountdownBadge due={d.dueDate} status={d.status} />
                      <button onClick={() => openEditDeadline(d)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"><Pencil className="h-3.5 w-3.5" /></button>
                      <button onClick={() => removeDeadline(d)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary"><Trash2 className="h-3.5 w-3.5" /></button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Show all other deadlines too */}
          {deadlines.filter((d) => !hearingCategories.includes(d.category)).length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">Show other deadlines ({deadlines.filter((d) => !hearingCategories.includes(d.category)).length})</summary>
              <div className="space-y-2 mt-2">
                {deadlines.filter((d) => !hearingCategories.includes(d.category)).map((d) => {
                  const cat = categoryMeta(d.category);
                  const isDone = d.status === "done";
                  return (
                    <Card key={d.id} className={`border-border/50 bg-card/50 ${isDone ? "opacity-60" : ""}`}>
                      <CardContent className="p-3 flex items-center gap-3">
                        <button onClick={() => toggleDone(d)} className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"}`}>
                          {isDone && <Check className="h-3 w-3" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{d.title}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{fmtDate(d.dueDate)}</p>
                        </div>
                        <CountdownBadge due={d.dueDate} status={d.status} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </details>
          )}
        </TabsContent>

        {/* Documents tab */}
        <TabsContent value="documents" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-serif font-bold text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Filed Documents
              {(matterWork?.length ?? 0) > 0 && <Badge variant="outline">{matterWork!.length}</Badge>}
            </h2>
          </div>

          {(matterWork?.length ?? 0) === 0 ? (
            <Card className="border-border/50 bg-card/50">
              <CardContent className="p-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-4">No documents filed yet. Generate a draft in any AI tool and file it into this matter.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="list-matter-documents">
              {matterWork!.map((w) => (
                <Card key={w.id} className="hover:border-primary/40 transition-colors cursor-pointer border-border/50 bg-card/50" onClick={() => setViewDoc(w)} data-testid={`card-document-${w.id}`}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <FileText className="h-4 w-4 text-primary mt-1 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{w.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Updated {fmtDate(w.updatedAt)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="pt-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">Draft for This Matter</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {aiTools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Link key={tool.name} href={tool.href} className="w-full text-left flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-card/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-sm">
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-medium text-foreground truncate">{tool.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* Checklist tab */}
        <TabsContent value="checklist">
          <ChecklistTab matterId={matter.id} />
        </TabsContent>

        {/* Team tab */}
        <TabsContent value="team">
          <TeamTab matterId={matter.id} clientName={matter.clientName} />
        </TabsContent>

        {/* Time tab */}
        <TabsContent value="time">
          <TimeTab matterId={matter.id} />
        </TabsContent>

        {/* Billing tab */}
        <TabsContent value="billing">
          <BillingTab
            request={billingRequest}
            matterId={matter.id}
            accent="#d4a017"
            currency="RM"
            defaultClientName={matter.clientName ?? undefined}
          />
        </TabsContent>

        {/* Vault tab */}
        <TabsContent value="vault">
          <DocumentsPanel
            request={vaultRequest}
            matterId={matter.id}
            accent="#d4a017"
          />
        </TabsContent>

        {/* Drafts & Letters tab */}
        <TabsContent value="letters">
          <DraftsPanel
            request={lettersRequest}
            matterId={matter.id}
            accent="#d4a017"
            showLetterWriter
            matterTitle={matter.title || ''}
            clientName={matter.clientName || ''}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}

      {/* Edit matter */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Edit Matter</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Matter title *</Label>
              <Input value={editForm.title ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Input value={editForm.clientName ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, clientName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Accused</Label>
                <Input value={editForm.accusedName ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, accusedName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Charge</Label>
              <Input value={editForm.charge ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, charge: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Court</Label>
                <Input value={editForm.court ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, court: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Case no.</Label>
                <Input value={editForm.caseNo ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, caseNo: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status ?? "open"} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    {CRIM_STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Linked workflow</Label>
                <Select
                  value={editForm.workflowId ? String(editForm.workflowId) : "none"}
                  onValueChange={(v) => setEditForm((f) => ({ ...f, workflowId: v === "none" ? null : parseInt(v, 10) }))}
                >
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(workflows ?? []).map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={editForm.notes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={saveEdit} disabled={updateMatter.isPending}>
                {updateMatter.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Delete this matter?</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">This permanently deletes <span className="text-foreground font-medium">"{matter.title}"</span> and all its data. Cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={doDelete} disabled={deleteMatter.isPending}>Delete</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add deadline */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Add Deadline</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={dForm.title} onChange={(e) => setDForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. File Notice of Appeal" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Due date *</Label>
                <Input type="date" value={dForm.dueDate} onChange={(e) => setDForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={dForm.category} onValueChange={(v) => setDForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{categoryMeta(c).label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Basis (provision / authority)</Label>
              <Input value={dForm.basis} onChange={(e) => setDForm((f) => ({ ...f, basis: e.target.value }))} placeholder="e.g. s.307(1) CPC — 14 days" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={dForm.notes} onChange={(e) => setDForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={submitAdd} disabled={addDeadline.isPending}>Add deadline</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compute from trigger */}
      <Dialog open={computeOpen} onOpenChange={(o) => { setComputeOpen(o); if (!o) setPreview([]); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Compute Deadlines from Criminal Procedure</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Trigger event</Label>
                <Select value={trigger} onValueChange={(v) => { setTrigger(v); setPreview([]); }}>
                  <SelectTrigger><SelectValue placeholder="Select a trigger…" /></SelectTrigger>
                  <SelectContent>
                    {triggers?.map((t) => <SelectItem key={t.trigger} value={t.trigger}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date of that event</Label>
                <Input type="date" value={triggerDate} onChange={(e) => { setTriggerDate(e.target.value); setPreview([]); }} />
              </div>
            </div>
            {selectedTrigger && <p className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3">{selectedTrigger.description}</p>}
            <Button variant="outline" className="w-full gap-2" onClick={runCompute} disabled={compute.isPending}>
              <Wand2 className="h-4 w-4" /> {compute.isPending ? "Computing…" : "Compute deadlines"}
            </Button>
            {preview.length > 0 && (
              <>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  <p className="text-xs text-muted-foreground">Select the deadlines to add:</p>
                  {preview.map((p, i) => {
                    const cat = categoryMeta(p.category);
                    return (
                      <label key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/40 cursor-pointer transition-all">
                        <input type="checkbox" checked={!!picked[i]} onChange={(e) => setPicked((pk) => ({ ...pk, [i]: e.target.checked }))} className="mt-1 accent-primary" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{p.title}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{fmtDate(p.dueDate)} · {p.basis}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1" onClick={() => { setComputeOpen(false); setPreview([]); }}>Cancel</Button>
                  <Button className="flex-1" onClick={saveComputed} disabled={addBulk.isPending}>Add selected</Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit deadline */}
      <Dialog open={!!editingDeadline} onOpenChange={(o) => { if (!o) setEditingDeadline(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Edit Deadline</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5"><Label>Title *</Label><Input value={edForm.title} onChange={(e) => setEdForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Due date *</Label><Input type="date" value={edForm.dueDate} onChange={(e) => setEdForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={edForm.category} onValueChange={(v) => setEdForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{categoryMeta(c).label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Basis</Label><Input value={edForm.basis} onChange={(e) => setEdForm((f) => ({ ...f, basis: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={edForm.notes} onChange={(e) => setEdForm((f) => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditingDeadline(null)}>Cancel</Button>
              <Button className="flex-1" onClick={saveEditDeadline} disabled={updateDeadline.isPending}>Save changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View filed document */}
      <Dialog open={!!viewDoc} onOpenChange={(o) => { if (!o) setViewDoc(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle className="font-serif">{viewDoc?.title ?? "Document"}</DialogTitle></DialogHeader>
          {viewDoc && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <DraftExportButtons title={viewDoc.title} content={viewDoc.content} />
              </div>
              <div className="bg-background border border-border rounded-lg p-4 max-h-[55vh] overflow-y-auto">
                <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed" data-testid="text-document-content">{viewDoc.content}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
