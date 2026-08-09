import { useState } from "react";
import { Link } from "wouter";
import { FolderKanban, Plus, Loader2, CalendarClock, AlertTriangle, FileText, Hash, ChevronRight, Clock } from "lucide-react";
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
import {
  useMatters,
  useCreateMatter,
  useUpcomingDeadlines,
  generateFileRef,
  daysUntil,
  categoryMeta,
  STAGE_OPTIONS,
} from "@/hooks/use-matters";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function MattersPage() {
  const { data: matters, isLoading } = useMatters();
  const { data: upcoming } = useUpcomingDeadlines(30);
  const createMatter = useCreateMatter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
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

  const submit = async () => {
    if (!form.title.trim()) {
      toast({ title: "Matter title is required", variant: "destructive" });
      return;
    }
    try {
      await createMatter.mutateAsync({ ...form, fileRef: generateFileRef(), status: "open" });
      toast({ title: "Matter created" });
      setOpen(false);
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

      <Dialog open={open} onOpenChange={setOpen}>
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
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={submit} disabled={createMatter.isPending} data-testid="button-submit-matter">
                {createMatter.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create matter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
