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
  History,
  Pencil,
  Users,
  UserPlus,
  Phone,
  Mail,
  X,
  Calculator,
  FolderLock,
  FileSignature,
  ClipboardList,
  ChevronDown,
  Scale,
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
  useCaseEvents,
  useAddCaseEvent,
  useUpdateCaseEvent,
  useDeleteCaseEvent,
  useMatterReview,
  useMatterClients,
  useClients,
  useCreateClient,
  useLinkClient,
  useUnlinkClient,
  useAiInsights,
  useRefreshAiInsights,
  useIntakeBriefing,
  daysUntil,
  categoryMeta,
  ACC_STAGES,
  CASE_EVENT_KINDS,
  ApiError,
  type ComputedDeadline,
  type CaseEvent,
} from "@/hooks/use-matters";
import { BillingTab, type BillingRequest } from "@workspace/billing-ui";
import { DocumentsPanel, type VaultRequest } from "@workspace/vault-ui";
import { DraftsPanel, type LettersRequest } from "@workspace/letters-ui";

const billingRequest: BillingRequest = (path, init) =>
  fetch(`/api/accident/matters${path}`, { credentials: "include", ...init });
const vaultRequest: VaultRequest = billingRequest;
const lettersRequest: LettersRequest = billingRequest;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type Tab = "overview" | "chronology" | "deadlines" | "checklist" | "documents" | "vault" | "time" | "billing" | "letters";

const KIND_META: Record<string, { label: string; color: string }> = {
  filing: { label: "Filing", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  hearing: { label: "Hearing", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  correspondence: { label: "Correspondence", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  instruction: { label: "Instruction", color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  deadline: { label: "Deadline", color: "text-red-400 bg-red-500/10 border-red-500/20" },
  stage: { label: "Stage", color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20" },
  "saved-work": { label: "Saved work", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  note: { label: "Note", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
  payment: { label: "Payment", color: "text-green-400 bg-green-500/10 border-green-500/20" },
  meeting: { label: "Meeting", color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
};

function kindMeta(kind: string) {
  return KIND_META[kind] ?? { label: kind, color: "text-slate-400 bg-slate-500/10 border-slate-500/20" };
}

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
    { id: "chronology", label: "Chronology", icon: History },
    { id: "deadlines", label: "Deadlines", icon: CalendarClock },
    { id: "checklist", label: "Checklist", icon: CheckSquare },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "vault", label: "Vault", icon: FolderLock },
    { id: "time", label: "Time", icon: Clock },
    { id: "billing", label: "Billing", icon: Calculator },
    { id: "letters", label: "Drafts & Letters", icon: FileSignature },
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
        {tab === "chronology" && <ChronologyTab matterId={matterId!} />}
        {tab === "deadlines" && <DeadlinesTab matterId={matterId!} deadlines={matter.deadlines} />}
        {tab === "checklist" && <ChecklistTab matterId={matterId!} />}
        {tab === "documents" && <DocumentsTab matterId={matterId!} />}
        {tab === "vault" && (
          <DocumentsPanel request={vaultRequest} matterId={matter.id} accent="#f59e0b" />
        )}
        {tab === "time" && <TimeTab matterId={matterId!} />}
        {tab === "billing" && (
          <BillingTab
            request={billingRequest}
            matterId={matterId!}
            accent="#f59e0b"
            currency="RM"
            defaultClientName={matter.clientName ?? undefined}
          />
        )}
        {tab === "letters" && (
          <DraftsPanel
            request={lettersRequest}
            matterId={matter.id}
            accent="#f59e0b"
            showLetterWriter
            matterTitle={matter.title || ''}
            clientName={matter.clientName || ''}
          />
        )}
      </main>
    </div>
  );
}

// ── Intake Briefing panel ─────────────────────────────────────────────────────

function IntakeBriefingPanel({ matterId }: { matterId: number }) {
  const { data: briefing } = useIntakeBriefing(matterId);
  const [open, setOpen] = useState(false);
  if (!briefing) return null;
  return (
    <Card>
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

// ── AI Insights panel ─────────────────────────────────────────────────────────

function AiInsightsPanel({ matterId }: { matterId: number }) {
  const { data: insights, isLoading } = useAiInsights(matterId);
  const refresh = useRefreshAiInsights();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const ratingColor =
    insights?.riskAssessment.rating === "High"
      ? "text-red-400"
      : insights?.riskAssessment.rating === "Medium"
        ? "text-amber-400"
        : "text-emerald-400";

  const priorityDot = (p: "high" | "medium" | "low") =>
    p === "high" ? "bg-red-400" : p === "medium" ? "bg-amber-400" : "bg-emerald-400";

  const handleRefresh = async () => {
    try {
      await refresh.mutateAsync(matterId);
    } catch (e) {
      toast({
        title: "Could not refresh AI Insights",
        description: e instanceof ApiError ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5">
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
          <button
            className="flex items-center gap-2 text-left flex-1"
            onClick={() => setOpen((o) => !o)}
          >
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-foreground">AI Insights</span>
            {insights.riskAssessment.rating && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ratingColor}`}>
                {insights.riskAssessment.rating} Risk
              </Badge>
            )}
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={refresh.isPending}
            className="gap-1.5 text-xs"
            data-testid="button-refresh-ai-insights"
          >
            {refresh.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {refresh.isPending ? "Refreshing…" : "Refresh"}
          </Button>
        </div>

        {open && (
          <div className="mt-4 space-y-5">
            {/* Case summary */}
            {insights.caseSummary && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">
                  Summary
                </p>
                <p className="text-sm text-foreground/80 leading-relaxed">{insights.caseSummary}</p>
              </div>
            )}

            {/* Next steps */}
            {insights.nextSteps.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                  Recommended Next Steps
                </p>
                <div className="space-y-2">
                  {insights.nextSteps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${priorityDot(step.priority)}`} />
                      <div className="text-sm text-foreground flex-1">
                        <span>{step.action}</span>
                        {step.suggestedDeadline && (
                          <span className="ml-2 text-[11px] text-muted-foreground">
                            by {step.suggestedDeadline}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk assessment */}
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">
                Risk Assessment —{" "}
                <span className={ratingColor}>{insights.riskAssessment.rating}</span>
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {insights.riskAssessment.keyStrengths.length > 0 && (
                  <div>
                    <p className="text-xs text-emerald-400 font-medium mb-1">Strengths</p>
                    <ul className="space-y-1">
                      {insights.riskAssessment.keyStrengths.map((s, i) => (
                        <li key={i} className="text-sm text-foreground/80 flex items-start gap-1.5">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {insights.riskAssessment.keyWeaknesses.length > 0 && (
                  <div>
                    <p className="text-xs text-red-400 font-medium mb-1">Weaknesses</p>
                    <ul className="space-y-1">
                      {insights.riskAssessment.keyWeaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-foreground/80 flex items-start gap-1.5">
                          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground/60 pt-1">
              AI-generated · cached {new Date(insights.cachedAt).toLocaleDateString()} · verify before relying on this
            </p>
          </div>
        )}
      </CardContent>
    </Card>
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

      <IntakeBriefingPanel matterId={matterId} />

      <AiInsightsPanel matterId={matterId} />

      <ClientSection matterId={matterId} />

      <AiCaseReview matterId={matterId} />
    </div>
  );
}

// ── Client section ─────────────────────────────────────────────────────────────

function ClientSection({ matterId }: { matterId: number }) {
  const { data: linked, isLoading } = useMatterClients(matterId);
  const { data: directory } = useClients();
  const create = useCreateClient();
  const link = useLinkClient();
  const unlink = useUnlinkClient();
  const { toast } = useToast();

  const [showLink, setShowLink] = useState(false);
  const [selectId, setSelectId] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [nf, setNf] = useState({ name: "", phone: "", email: "" });

  const linkedIds = new Set((linked ?? []).map((c) => c.id));
  const available = (directory ?? []).filter((c) => !linkedIds.has(c.id));

  const doLink = async () => {
    const id = parseInt(selectId, 10);
    if (Number.isNaN(id)) return;
    try {
      await link.mutateAsync({ clientId: id, matterId });
      setSelectId("");
      setShowLink(false);
      toast({ title: "Client linked" });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Could not link client", variant: "destructive" });
    }
  };

  const doCreateAndLink = async () => {
    if (!nf.name.trim()) {
      toast({ title: "Client name is required", variant: "destructive" });
      return;
    }
    try {
      const client = await create.mutateAsync({
        name: nf.name.trim(),
        phone: nf.phone.trim() || undefined,
        email: nf.email.trim() || undefined,
      });
      await link.mutateAsync({ clientId: client.id, matterId });
      setNf({ name: "", phone: "", email: "" });
      setShowNew(false);
      toast({ title: "Client created and linked" });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Could not create client", variant: "destructive" });
    }
  };

  const doUnlink = async (clientId: number) => {
    try {
      await unlink.mutateAsync({ clientId, matterId });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Could not unlink", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Client
          </h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setShowLink((v) => !v); setShowNew(false); }} data-testid="button-link-client">
              <UserPlus className="h-3.5 w-3.5" /> Link client
            </Button>
          </div>
        </div>

        {showLink && (
          <div className="rounded-lg border border-border bg-background p-3 space-y-3">
            {available.length > 0 && (
              <div className="flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Existing client</Label>
                  <Select value={selectId} onValueChange={setSelectId}>
                    <SelectTrigger data-testid="select-existing-client">
                      <SelectValue placeholder="Choose a client…" />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button size="sm" onClick={doLink} disabled={!selectId || link.isPending} className="gap-1.5" data-testid="button-confirm-link">
                  {link.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Link
                </Button>
              </div>
            )}
            {!showNew ? (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setShowNew(true)} data-testid="button-new-client">
                <Plus className="h-3.5 w-3.5" /> Create new client
              </Button>
            ) : (
              <div className="space-y-2 border-t border-border pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Name</Label>
                    <Input value={nf.name} onChange={(e) => setNf({ ...nf, name: e.target.value })} data-testid="input-new-client-name" />
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input value={nf.phone} onChange={(e) => setNf({ ...nf, phone: e.target.value })} data-testid="input-new-client-phone" />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input value={nf.email} onChange={(e) => setNf({ ...nf, email: e.target.value })} data-testid="input-new-client-email" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>Cancel</Button>
                  <Button size="sm" onClick={doCreateAndLink} disabled={create.isPending || link.isPending} className="gap-1.5" data-testid="button-create-link">
                    {(create.isPending || link.isPending) && <Loader2 className="h-4 w-4 animate-spin" />} Create &amp; link
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (linked?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No client linked to this matter yet.</p>
        ) : (
          <div className="space-y-2">
            {(linked ?? []).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5" data-testid={`client-${c.id}`}>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap mt-0.5">
                    {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
                    {c.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
                    {c.company_name && <span>{c.company_name}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => doUnlink(c.id)} disabled={unlink.isPending} data-testid={`button-unlink-${c.id}`}>
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── AI Case Review ─────────────────────────────────────────────────────────────

function AiCaseReview({ matterId }: { matterId: number }) {
  const review = useMatterReview();
  const { toast } = useToast();
  const [markdown, setMarkdown] = useState<string | null>(null);

  const run = async () => {
    setMarkdown(null);
    try {
      const res = await review.mutateAsync(matterId);
      setMarkdown(res.review);
    } catch (e) {
      toast({
        title: "AI review failed",
        description: e instanceof ApiError ? e.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> AI Case Review
          </h3>
          <Button size="sm" onClick={run} disabled={review.isPending} className="gap-2" data-testid="button-ai-review">
            {review.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {review.isPending ? "Reviewing…" : markdown ? "Re-run review" : "Run AI review"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Generates an AI assessment of the matter and a prioritised list of next actions from the assembled
          case context. Always verify against the file before relying on it.
        </p>
        {review.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Analysing the matter — this can take up to a minute…
          </div>
        )}
        {markdown && !review.isPending && (
          <div
            className="text-sm leading-relaxed whitespace-pre-wrap p-4 bg-background border border-border rounded max-h-[500px] overflow-auto"
            data-testid="ai-review-output"
          >
            {markdown}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Chronology ─────────────────────────────────────────────────────────────────

function ChronologyTab({ matterId }: { matterId: number }) {
  const { data: events, isLoading } = useCaseEvents(matterId);
  const add = useAddCaseEvent();
  const upd = useUpdateCaseEvent();
  const del = useDeleteCaseEvent();
  const { toast } = useToast();

  const [form, setForm] = useState({ title: "", event_date: "", kind: "note", description: "" });
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", event_date: "", kind: "note", description: "" });

  const sorted = [...(events ?? [])].sort(
    (a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime(),
  );

  const submit = async () => {
    if (!form.title.trim() || !form.event_date) {
      toast({ title: "Title and date are required", variant: "destructive" });
      return;
    }
    try {
      await add.mutateAsync({
        matterId,
        title: form.title.trim(),
        event_date: form.event_date,
        kind: form.kind,
        description: form.description.trim() || undefined,
      });
      setForm({ title: "", event_date: "", kind: "note", description: "" });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Could not add event", variant: "destructive" });
    }
  };

  const startEdit = (ev: CaseEvent) => {
    setEditId(ev.id);
    setEditForm({
      title: ev.title,
      event_date: ev.event_date.slice(0, 10),
      kind: ev.kind,
      description: ev.description ?? "",
    });
  };

  const saveEdit = async () => {
    if (editId == null) return;
    if (!editForm.title.trim() || !editForm.event_date) {
      toast({ title: "Title and date are required", variant: "destructive" });
      return;
    }
    try {
      await upd.mutateAsync({
        matterId,
        eventId: editId,
        title: editForm.title.trim(),
        event_date: editForm.event_date,
        kind: editForm.kind,
        description: editForm.description.trim() || undefined,
      });
      setEditId(null);
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Could not save event", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Add chronology event
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} data-testid="input-event-date" />
            </div>
            <div>
              <Label className="text-xs">Kind</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger data-testid="select-event-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASE_EVENT_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>{kindMeta(k).label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-event-title" />
          </div>
          <div>
            <Label className="text-xs">Description (optional)</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} data-testid="input-event-description" />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={add.isPending} className="gap-2" data-testid="button-add-event">
              {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add event
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No chronology events yet.</p>
      ) : (
        <div className="relative pl-6 space-y-3">
          <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
          {sorted.map((ev) => {
            const meta = kindMeta(ev.kind);
            const editing = editId === ev.id;
            return (
              <div key={ev.id} className="relative" data-testid={`event-${ev.id}`}>
                <div className="absolute -left-[18px] top-3 h-2.5 w-2.5 rounded-full bg-primary border-2 border-background" />
                <Card>
                  <CardContent className="p-4">
                    {editing ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <Input type="date" value={editForm.event_date} onChange={(e) => setEditForm({ ...editForm, event_date: e.target.value })} data-testid={`edit-date-${ev.id}`} />
                          <Select value={editForm.kind} onValueChange={(v) => setEditForm({ ...editForm, kind: v })}>
                            <SelectTrigger data-testid={`edit-kind-${ev.id}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CASE_EVENT_KINDS.map((k) => (
                                <SelectItem key={k} value={k}>{kindMeta(k).label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} data-testid={`edit-title-${ev.id}`} />
                        <Textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} data-testid={`edit-desc-${ev.id}`} />
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
                          <Button size="sm" onClick={saveEdit} disabled={upd.isPending} className="gap-1.5" data-testid={`button-save-event-${ev.id}`}>
                            {upd.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                            <span className="text-xs text-muted-foreground">{fmtDate(ev.event_date)}</span>
                          </div>
                          <div className="text-sm font-medium mt-1">{ev.title}</div>
                          {ev.description && <div className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap">{ev.description}</div>}
                          {ev.source && <div className="text-[11px] text-muted-foreground mt-0.5">Source: {ev.source}</div>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(ev)} data-testid={`button-edit-event-${ev.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => del.mutate({ matterId, eventId: ev.id })} data-testid={`button-delete-event-${ev.id}`}>
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
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
