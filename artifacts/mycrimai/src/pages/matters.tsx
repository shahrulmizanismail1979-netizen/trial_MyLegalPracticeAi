import { useState } from "react";
import { Link } from "wouter";
import { MatterFileUpload, type ExtractedFile } from '@/components/MatterFileUpload';
import { FolderKanban, Plus, Loader2, CalendarClock, AlertTriangle, FileText, Hash, ChevronRight, Clock, Sparkles, ListChecks, ArrowRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
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
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { useToast } from "@/hooks/use-toast";
import {
  useMatters,
  useCreateMatter,
  useUpcomingDeadlines,
  useBriefingSummary,
  usePrepareMatter,
  generateFileRef,
  daysUntil,
  categoryMeta,
  STAGE_OPTIONS,
  type MatterBriefing,
} from "@/hooks/use-matters";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── "Prepare with AI" dialog ──────────────────────────────────────────────────

function PrepareDialog({
  matter,
  open,
  onOpenChange,
}: {
  matter: MatterBriefing | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const prepare = usePrepareMatter();
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const step = matter?.next_step?.label;

  const run = async () => {
    if (!matter) return;
    setResult(null);
    setError(null);
    try {
      const res = await prepare.mutateAsync({ matterId: matter.id, step });
      setResult(res.preparation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preparation failed. Please try again.");
    }
  };

  // Auto-run when the dialog opens for a matter.
  const [lastMatterId, setLastMatterId] = useState<number | null>(null);
  if (open && matter && matter.id !== lastMatterId && !prepare.isPending) {
    setLastMatterId(matter.id);
    setResult(null);
    setError(null);
    void run();
  }
  if (!open && lastMatterId !== null) {
    setLastMatterId(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Prepare with AI
          </DialogTitle>
        </DialogHeader>
        {matter && (
          <div className="space-y-3">
            <div>
              <p className="font-serif font-semibold text-foreground">{matter.title}</p>
              {step && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  Preparing for: <span className="font-medium text-foreground">{step}</span>
                </p>
              )}
            </div>

            {prepare.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="h-4 w-4 animate-spin" /> Assembling context and drafting your preparation…
              </div>
            )}

            {error && !prepare.isPending && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Preparation failed
                </p>
                <p className="text-sm text-red-600">{error}</p>
                <Button variant="outline" size="sm" onClick={run} className="gap-2">
                  <Sparkles className="h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            )}

            {result && !prepare.isPending && (
              <div className="pt-2 border-t border-border/50">
                <MarkdownRenderer content={result} />
                <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
                  <p className="text-[10px] text-muted-foreground/60">
                    AI-generated · verify against the file before relying on it.
                  </p>
                  <Button variant="outline" size="sm" onClick={run} className="gap-2">
                    <Sparkles className="h-3.5 w-3.5" /> Re-run
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── "My Cases" dashboard overview ──────────────────────────────────────────────

function MyCasesSection({ onPrepare }: { onPrepare: (m: MatterBriefing) => void }) {
  const { data, isLoading, isError, error, refetch } = useBriefingSummary();

  if (isLoading) {
    return (
      <div className="space-y-3">
        <SectionHeading />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <SectionHeading />
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-5 space-y-3">
            <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Couldn't load your cases
            </p>
            <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Please try again."}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const matters = data?.matters ?? [];
  if (matters.length === 0) {
    return (
      <div className="space-y-3">
        <SectionHeading />
        <Card>
          <CardContent className="p-10 text-center">
            <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-serif font-semibold mb-1">No matters yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Create a matter below to see your case overview here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SectionHeading />
      <div className="grid gap-4 md:grid-cols-2" data-testid="list-my-cases">
        {matters.map((m) => <MyCaseCard key={m.id} m={m} onPrepare={onPrepare} />)}
      </div>
    </div>
  );
}

function SectionHeading() {
  return (
    <div className="space-y-1">
      <h2 className="font-serif text-xl font-bold tracking-tight flex items-center gap-2">
        <Layers className="h-5 w-5 text-primary" /> My Cases
      </h2>
      <p className="text-sm text-muted-foreground">
        Where each matter stands, its next step, and one-click AI preparation.
      </p>
    </div>
  );
}

function MyCaseCard({ m, onPrepare }: { m: MatterBriefing; onPrepare: (m: MatterBriefing) => void }) {
  const isClosed = m.status?.toLowerCase() === "closed";
  const nd = m.next_deadline;
  const ndDays = nd ? daysUntil(nd.due_date) : null;

  return (
    <Card
      className={`h-full transition-colors ${isClosed ? "opacity-60" : "hover:border-primary/40"}`}
      data-testid={`card-my-case-${m.id}`}
    >
      <CardContent className="p-5 space-y-3">
        <Link href={`/workspace/matters/${m.id}`}>
          <div className="cursor-pointer space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-serif font-semibold text-foreground leading-snug hover:text-primary transition-colors">{m.title}</p>
              <Badge variant="outline" className="shrink-0 capitalize">{m.status}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {m.matter_type && <span className="truncate">{m.matter_type}</span>}
              {m.stage_index >= 0 && m.stage_count > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Layers className="h-3 w-3" /> Stage {m.stage_index + 1} of {m.stage_count}
                </span>
              )}
              {m.checklist_total > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-3 w-3" /> {m.checklist_done}/{m.checklist_total} done
                </span>
              )}
            </div>

            {/* Stage progress bar */}
            {m.stage_index >= 0 && m.stage_count > 0 && (
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, ((m.stage_index + 1) / m.stage_count) * 100)}%` }}
                />
              </div>
            )}

            {/* Next deadline */}
            {nd && (
              <div className="flex items-center gap-2 text-xs">
                {m.overdue_count > 0 ? (
                  <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700 gap-1">
                    <AlertTriangle className="h-3 w-3" /> {m.overdue_count} overdue
                  </Badge>
                ) : (
                  <CalendarClock className={`h-3.5 w-3.5 shrink-0 ${ndDays !== null && ndDays <= 7 ? "text-amber-600" : "text-muted-foreground"}`} />
                )}
                <span className="truncate text-muted-foreground">{nd.title}</span>
                <span className="text-muted-foreground/70 ml-auto shrink-0">{fmtDate(nd.due_date)}</span>
              </div>
            )}
          </div>
        </Link>

        {/* Next step — prominent */}
        {m.next_step && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
              Next: {m.next_step.label}
              {m.next_step.due_date && (
                <span className="font-normal text-muted-foreground">· {fmtDate(m.next_step.due_date)}</span>
              )}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => onPrepare(m)}
            data-testid={`button-prepare-${m.id}`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Prepare with AI
          </Button>
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" asChild>
            <Link href={`/workspace/matters/${m.id}`}>
              Open <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MattersPage() {
  const { data: matters, isLoading } = useMatters();
  const { data: upcoming } = useUpcomingDeadlines(30);
  const createMatter = useCreateMatter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [prepareMatter, setPrepareMatter] = useState<MatterBriefing | null>(null);
  const [prepareOpen, setPrepareOpen] = useState(false);
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);
  const [form, setForm] = useState({
    title: "",
    clientName: "",
    accusedName: "",
    charge: "",
    court: "",
    caseNo: "",
    stage: "",
    notes: "",
  });

  const openPrepare = (m: MatterBriefing) => {
    setPrepareMatter(m);
    setPrepareOpen(true);
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast({ title: "Matter title is required", variant: "destructive" });
      return;
    }
    try {
      const fileContext = extractedFiles.filter(f => f.text?.trim()).map(f => '=== ' + f.name + ' ===\n' + f.text.trim()).join('\n\n');
      const notes = fileContext ? (form.notes?.trim() ? form.notes.trim() + '\n\n--- Supporting Documents ---\n' + fileContext : '--- Supporting Documents ---\n' + fileContext) : (form.notes ?? '');
      const hasDocuments = extractedFiles.some(f => !!f.text?.trim());
      await createMatter.mutateAsync({ ...form, notes, fileRef: generateFileRef(), status: "open", hasDocuments });
      toast({ title: "Matter created" });
      if (hasDocuments) {
        toast({ title: "AI briefing in progress", description: "An AI intake briefing is being generated from your uploaded documents. It will appear in the AI Insights tab." });
      }
      setOpen(false);
      setExtractedFiles([]);
      setForm({ title: "", clientName: "", accusedName: "", charge: "", court: "", caseNo: "", stage: "", notes: "" });
    } catch (e) {
      toast({ title: "Could not create matter", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <FolderKanban className="h-8 w-8 text-primary" />
            Matter Files
          </h1>
          <p className="text-muted-foreground">
            Each matter file collects the drafts, deadlines and workflow checklist for one criminal brief.
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2" data-testid="button-create-matter">
          <Plus className="h-4 w-4" /> New matter
        </Button>
      </div>

      <MyCasesSection onPrepare={openPrepare} />

      {(upcoming?.length ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2 text-amber-700">
              <CalendarClock className="h-4 w-4" /> Deadlines in the next 30 days
            </p>
            <div className="space-y-1.5">
              {upcoming!.slice(0, 5).map((d) => {
                const days = daysUntil(d.dueDate);
                return (
                  <Link key={d.id} href={`/workspace/matters/${d.matterId}`}>
                    <div className="flex items-center gap-2 text-sm hover:bg-secondary/40 rounded px-2 py-1 cursor-pointer">
                      {days < 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 shrink-0"><AlertTriangle className="h-3.5 w-3.5" /> {Math.abs(days)}d overdue</span>
                      ) : (
                        <span className={`text-xs font-semibold shrink-0 ${days <= 7 ? "text-amber-600" : "text-muted-foreground"}`}>{days === 0 ? "Today" : `in ${days}d`}</span>
                      )}
                      <span className="truncate">{d.title}</span>
                      <span className="text-xs text-muted-foreground truncate ml-auto">{d.matterTitle}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (matters?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-serif font-semibold mb-1">No matter files yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
              Create a matter for each brief, or generate a draft with the Document Drafter and file it —
              a matter file is created for you on the spot.
            </p>
            <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Create your first matter</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2" data-testid="list-matters">
          {matters!.map((m) => (
            <Link key={m.id} href={`/workspace/matters/${m.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full" data-testid={`card-matter-${m.id}`}>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-serif font-semibold text-foreground leading-snug">{m.title}</p>
                    <Badge variant="outline" className="shrink-0 capitalize">{m.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {m.fileRef && <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" />{m.fileRef}</span>}
                    {m.stage && <Badge variant="outline" className="capitalize">{m.stage}</Badge>}
                    {m.caseNo && <span>{m.caseNo}</span>}
                  </div>
                  {(m.accusedName || m.charge) && (
                    <p className="text-sm text-muted-foreground truncate">
                      {m.accusedName && <span>{m.accusedName}</span>}
                      {m.accusedName && m.charge && " · "}
                      {m.charge && <span>{m.charge}</span>}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground/70 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Updated {fmtDate(m.updatedAt)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setExtractedFiles([]); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">New Matter File</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Matter title *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. PP v Ahmad bin Ali — Trafficking s.39B" data-testid="input-new-matter-title" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Input value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Accused</Label>
                <Input value={form.accusedName} onChange={(e) => setForm((f) => ({ ...f, accusedName: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Charge</Label>
              <Input value={form.charge} onChange={(e) => setForm((f) => ({ ...f, charge: e.target.value }))} placeholder="e.g. s.39B(1)(a) Dangerous Drugs Act 1952" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Court</Label>
                <Input value={form.court} onChange={(e) => setForm((f) => ({ ...f, court: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Case no.</Label>
                <Input value={form.caseNo} onChange={(e) => setForm((f) => ({ ...f, caseNo: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Stage</Label>
              <Select value={form.stage} onValueChange={(v) => setForm((f) => ({ ...f, stage: v }))}>
                <SelectTrigger><SelectValue placeholder="Select stage…" /></SelectTrigger>
                <SelectContent>
                  {STAGE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>Supporting Documents <span className="font-normal text-muted-foreground text-xs">(optional — AI will read these)</span></Label>
              <MatterFileUpload onFilesExtracted={setExtractedFiles} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setOpen(false); setExtractedFiles([]); }}>Cancel</Button>
              <Button className="flex-1" onClick={submit} disabled={createMatter.isPending} data-testid="button-submit-matter">
                {createMatter.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create matter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PrepareDialog matter={prepareMatter} open={prepareOpen} onOpenChange={setPrepareOpen} />
    </div>
  );
}
