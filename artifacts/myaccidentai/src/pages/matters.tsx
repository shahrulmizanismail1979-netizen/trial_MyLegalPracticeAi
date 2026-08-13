import { useState } from "react";
import { Link, useLocation } from "wouter";
import { MatterFileUpload, type ExtractedFile } from "@/components/MatterFileUpload";
import {
  FolderKanban,
  Plus,
  Loader2,
  CalendarClock,
  AlertTriangle,
  Hash,
  ChevronRight,
  Home,
  ArrowLeft,
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useAccidentCheckSession } from "@workspace/api-client-react";
import { useEffect } from "react";
import {
  useMatters,
  useCreateMatter,
  useUpcomingDeadlines,
  generateFileRef,
  daysUntil,
  categoryMeta,
} from "@/hooks/use-matters";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const MATTER_TYPES = [
  { value: "running-down", label: "Running Down (motor)" },
  { value: "personal-injury", label: "Personal Injury" },
  { value: "fatal", label: "Fatal Accident / Dependency" },
  { value: "mib", label: "MIB Claim" },
  { value: "other", label: "Other" },
];

export default function MattersPage() {
  const [, setLocation] = useLocation();
  const { data: session, isLoading: sessionLoading } = useAccidentCheckSession();
  useEffect(() => {
    if (!sessionLoading && (!session || !session.authenticated)) {
      setLocation("/login");
    }
  }, [session, sessionLoading, setLocation]);

  const { data: matters, isLoading } = useMatters();
  const { data: upcoming } = useUpcomingDeadlines(30);
  const createMatter = useCreateMatter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);
  const [form, setForm] = useState({
    title: "",
    clientName: "",
    actingFor: "",
    plaintiff: "",
    defendant: "",
    matterType: "",
    court: "",
    caseNo: "",
    claimAmount: "",
    notes: "",
  });

  const submit = async () => {
    if (!form.title.trim()) {
      toast({ title: "Matter title is required", variant: "destructive" });
      return;
    }
    try {
      const NOTES_BUDGET = 19_800;
      const manualPart = form.notes?.trim() ?? '';
      const SEP = '\n\n--- Supporting Documents ---\n';
      const fcBudget = Math.max(0, NOTES_BUDGET - manualPart.length - SEP.length);
      let fileContext = extractedFiles.filter(f => f.text?.trim()).map(f => '=== ' + f.name + ' ===\n' + f.text.trim()).join('\n\n');
      if (fileContext.length > fcBudget) {
        fileContext = fileContext.slice(0, Math.max(0, fcBudget - 60)) + '\n[… document text truncated — matter notes limit reached]';
      }
      const notes = fileContext ? (manualPart ? manualPart + SEP + fileContext : '--- Supporting Documents ---\n' + fileContext) : manualPart;
      const hasDocuments = extractedFiles.some(f => !!f.text?.trim());
      const matter = await createMatter.mutateAsync({
        ...form,
        notes,
        fileRef: generateFileRef(),
        status: "open",
        hasDocuments,
      });
      setOpen(false);
      setExtractedFiles([]);
      setForm({
        title: "",
        clientName: "",
        actingFor: "",
        plaintiff: "",
        defendant: "",
        matterType: "",
        court: "",
        caseNo: "",
        claimAmount: "",
        notes: "",
      });
      if (hasDocuments) {
        toast({ title: "AI briefing in progress", description: "An AI intake briefing is being generated from your uploaded documents. It will appear in the AI Insights tab." });
      }
      setLocation(`/workspace/matters/${matter.id}`);
    } catch {
      toast({ title: "Could not create matter", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <FolderKanban className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-lg font-serif font-bold">Matter Files</h1>
              <p className="text-xs text-muted-foreground">
                Accident, personal injury & running-down briefs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" data-testid="link-back-workspace" asChild>
              <Link href="/workspace"><ArrowLeft className="h-4 w-4" /> Workspace</Link>
            </Button>
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="/"><Home className="h-4 w-4" /> Home</Link>
            </Button>
            <Button size="sm" onClick={() => setOpen(true)} className="gap-2" data-testid="button-new-matter">
              <Plus className="h-4 w-4" /> New matter
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Upcoming deadlines */}
        {upcoming && upcoming.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <CalendarClock className="h-4 w-4 text-primary" /> Upcoming deadlines (30 days)
            </h2>
            <div className="grid gap-2">
              {upcoming.slice(0, 8).map((d) => {
                const days = daysUntil(d.dueDate);
                const meta = categoryMeta(d.category);
                return (
                  <Link key={d.id} href={`/workspace/matters/${d.matterId}`}>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-2.5 hover:border-primary/40 transition-colors" data-testid={`upcoming-${d.id}`}>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{d.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {d.matterTitle}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className={meta.color}>{meta.label}</Badge>
                        <span
                          className={`text-xs font-semibold ${days < 0 ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-muted-foreground"}`}
                        >
                          {days < 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> {Math.abs(days)}d overdue
                            </span>
                          ) : (
                            `${days}d — ${fmtDate(d.dueDate)}`
                          )}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Matters list */}
        <section>
          <h2 className="text-sm font-semibold mb-3">All matters</h2>
          {isLoading ? (
            <div className="grid gap-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (matters?.length ?? 0) === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No matters yet.</p>
                <Button size="sm" className="mt-4 gap-2" onClick={() => setOpen(true)} data-testid="button-first-matter">
                  <Plus className="h-4 w-4" /> Create your first matter
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {(matters ?? []).map((m) => (
                <Link key={m.id} href={`/workspace/matters/${m.id}`}>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3.5 hover:border-primary/40 transition-colors" data-testid={`matter-${m.id}`}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{m.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5 flex-wrap">
                        {m.fileRef && (
                          <span className="inline-flex items-center gap-1">
                            <Hash className="h-3 w-3" /> {m.fileRef}
                          </span>
                        )}
                        {m.clientName && <span>{m.clientName}</span>}
                        {m.court && <span>{m.court}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge variant="outline">{m.status}</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setExtractedFiles([]); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New matter file</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Matter title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Lim v Tan — Running Down Claim"
                data-testid="input-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Client name</Label>
                <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} data-testid="input-client" />
              </div>
              <div>
                <Label className="text-xs">Acting for</Label>
                <Input value={form.actingFor} onChange={(e) => setForm({ ...form, actingFor: e.target.value })} placeholder="Plaintiff / Defendant" data-testid="input-acting" />
              </div>
              <div>
                <Label className="text-xs">Plaintiff</Label>
                <Input value={form.plaintiff} onChange={(e) => setForm({ ...form, plaintiff: e.target.value })} data-testid="input-plaintiff" />
              </div>
              <div>
                <Label className="text-xs">Defendant</Label>
                <Input value={form.defendant} onChange={(e) => setForm({ ...form, defendant: e.target.value })} data-testid="input-defendant" />
              </div>
              <div>
                <Label className="text-xs">Matter type</Label>
                <Select value={form.matterType} onValueChange={(v) => setForm({ ...form, matterType: v })}>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {MATTER_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Claim amount (RM)</Label>
                <Input value={form.claimAmount} onChange={(e) => setForm({ ...form, claimAmount: e.target.value })} inputMode="decimal" data-testid="input-claim" />
              </div>
              <div>
                <Label className="text-xs">Court</Label>
                <Input value={form.court} onChange={(e) => setForm({ ...form, court: e.target.value })} data-testid="input-court" />
              </div>
              <div>
                <Label className="text-xs">Case no.</Label>
                <Input value={form.caseNo} onChange={(e) => setForm({ ...form, caseNo: e.target.value })} data-testid="input-caseno" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} data-testid="input-notes" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Supporting Documents <span className="font-normal text-muted-foreground text-xs">(optional — AI will read these)</span></Label>
              <MatterFileUpload onFilesExtracted={setExtractedFiles} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => { setOpen(false); setExtractedFiles([]); }}>Cancel</Button>
              <Button onClick={submit} disabled={createMatter.isPending} className="gap-2" data-testid="button-create-matter">
                {createMatter.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create matter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
