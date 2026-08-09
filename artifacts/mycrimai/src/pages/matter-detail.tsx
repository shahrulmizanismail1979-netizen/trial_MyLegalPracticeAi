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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { DraftExportButtons } from "@workspace/draft-export/react";
import { useCrimListWorkflows } from "@workspace/api-client-react";
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
  categoryMeta,
  daysUntil,
  STAGE_OPTIONS,
  type MatterDeadline,
  type ComputedDeadline,
  type SavedWorkItem,
  type MatterInput,
} from "@/hooks/use-matters";

const STATUS_OPTIONS = ["open", "on-hold", "closed"];
const CATEGORY_OPTIONS = ["remand", "charge", "bail", "trial", "appeal", "revision", "custom"];

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
        <Link href="/workspace/matters"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back to matters</Button></Link>
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
      stage: matter.stage ?? "",
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

  const infoRows: { icon: typeof Building2; label: string; value: string }[] = [];
  if (matter.fileRef) infoRows.push({ icon: Hash, label: "File ref", value: matter.fileRef });
  if (matter.clientName) infoRows.push({ icon: Building2, label: "Client", value: matter.clientName });
  if (matter.accusedName) infoRows.push({ icon: Scale, label: "Accused", value: matter.accusedName });
  if (matter.charge) infoRows.push({ icon: Scale, label: "Charge", value: matter.charge });
  if (matter.court) infoRows.push({ icon: Building2, label: "Court", value: matter.court });
  if (matter.caseNo) infoRows.push({ icon: Hash, label: "Case no.", value: matter.caseNo });

  return (
    <div className="pb-16">
      <Link href="/workspace/matters">
        <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ArrowLeft className="h-4 w-4" /> All matters
        </button>
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight" data-testid="text-matter-title">{matter.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {matter.stage && <Badge variant="outline" className="capitalize">{matter.stage}</Badge>}
            <Badge variant="outline" className="capitalize">{matter.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={openEdit} data-testid="button-edit-matter"><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)} data-testid="button-delete-matter"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      {infoRows.length > 0 && (
        <Card className="mb-6 border-border/50 bg-card/50">
          <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
            {infoRows.map((r) => {
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
      )}

      {matter.notes && (
        <Card className="mb-6 border-border/50 bg-card/50">
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Notes</p>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{matter.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Practice workflow link */}
      <Card className="mb-6 border-primary/25 bg-primary/5">
        <CardContent className="p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Workflow className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-serif font-semibold text-foreground">
                {linkedWorkflow ? `${linkedWorkflow.title} — workflow & checklist` : "Practice workflow"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {linkedWorkflow
                  ? "Follow the step-by-step procedure for this stage of the case."
                  : "Link this matter to a criminal-procedure workflow (remand, bail, trial, appeal) from Edit, or browse all workflows."}
              </p>
            </div>
          </div>
          <Link href={linkedWorkflow ? `/workspace/workflows/${linkedWorkflow.id}` : "/workspace/workflows"}>
            <Button className="gap-2" data-testid="button-open-workflow">
              {linkedWorkflow ? "Open workflow" : "Browse workflows"} <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Documents filed in this matter */}
      <div className="flex items-center gap-2 mb-4 mt-8">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="font-serif font-bold text-lg text-foreground">Documents</h2>
        {(matterWork?.length ?? 0) > 0 && <Badge variant="outline">{matterWork!.length}</Badge>}
      </div>
      {(matterWork?.length ?? 0) === 0 ? (
        <Card className="mb-8 border-border/50 bg-card/50">
          <CardContent className="p-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No documents filed yet. Generate a draft in the Document Drafter and file it into this matter.
            </p>
            <Link href="/workspace/ai/document-drafter">
              <Button variant="outline" className="mt-4 gap-2">Open Document Drafter <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8" data-testid="list-matter-documents">
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

      {/* Deadline diary */}
      <div className="flex items-center justify-between mb-4 mt-8 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          <h2 className="font-serif font-bold text-lg text-foreground">Deadlines</h2>
          {pending.length > 0 && <Badge variant="outline">{pending.length} pending</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setComputeOpen(true)} data-testid="button-compute-deadlines"><Wand2 className="h-4 w-4" /> Compute from CPC</Button>
          <Button className="gap-2" onClick={() => setAddOpen(true)} data-testid="button-add-deadline"><Plus className="h-4 w-4" /> Add</Button>
        </div>
      </div>

      {deadlines.length === 0 ? (
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-10 text-center">
            <CalendarClock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <h3 className="font-serif font-semibold text-foreground mb-1">No deadlines yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
              Add a date manually, or compute a set from a criminal-procedure trigger — e.g. a subordinate-court
              conviction auto-generates the 14-day notice of appeal and stay dates.
            </p>
            <Button className="gap-2" onClick={() => setComputeOpen(true)}><Wand2 className="h-4 w-4" /> Compute from a trigger</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2" data-testid="list-deadlines">
          {[...pending, ...done].map((d) => {
            const cat = categoryMeta(d.category);
            const isDone = d.status === "done";
            return (
              <Card key={d.id} className={`border-border/50 bg-card/50 transition-all ${isDone ? "opacity-60" : ""}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <button
                    onClick={() => toggleDone(d)}
                    title={isDone ? "Mark pending" : "Mark done"}
                    className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-border hover:border-primary"
                    }`}
                  >
                    {isDone && <Check className="h-3.5 w-3.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{d.title}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <Clock className="h-3 w-3" /> {fmtDate(d.dueDate)}
                      {d.basis && <span className="truncate">· {d.basis}</span>}
                    </div>
                    {d.notes && <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">{d.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CountdownBadge due={d.dueDate} status={d.status} />
                    <button onClick={() => openEditDeadline(d)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeDeadline(d)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800/80 leading-relaxed">
          Computed dates apply the ordinary CPC / Courts of Judicature Act periods and roll forward off weekends.
          Some periods (e.g. the petition of appeal) run from service of the record, not the decision.
          <span className="text-amber-700 font-medium"> Always verify against the sealed orders before relying on a date.</span>
        </p>
      </div>

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
                <Label>Stage</Label>
                <Select value={editForm.stage ?? ""} onValueChange={(v) => setEditForm((f) => ({ ...f, stage: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select stage…" /></SelectTrigger>
                  <SelectContent>
                    {STAGE_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status ?? "open"} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
            <p className="text-sm text-muted-foreground">
              This permanently deletes <span className="text-foreground font-medium">“{matter.title}”</span> and all its deadlines. This cannot be undone.
            </p>
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

            {selectedTrigger && (
              <p className="text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3">{selectedTrigger.description}</p>
            )}

            <Button variant="outline" className="w-full gap-2" onClick={runCompute} disabled={compute.isPending}>
              <Wand2 className="h-4 w-4" /> {compute.isPending ? "Computing…" : "Compute deadlines"}
            </Button>

            {preview.length > 0 && (
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
                        {p.notes && <div className="text-xs text-muted-foreground/80 mt-0.5">{p.notes}</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {preview.length > 0 && (
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => { setComputeOpen(false); setPreview([]); }}>Cancel</Button>
                <Button className="flex-1" onClick={saveComputed} disabled={addBulk.isPending}>Add selected</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit deadline */}
      <Dialog open={!!editingDeadline} onOpenChange={(o) => { if (!o) setEditingDeadline(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-serif">Edit Deadline</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={edForm.title} onChange={(e) => setEdForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Due date *</Label>
                <Input type="date" value={edForm.dueDate} onChange={(e) => setEdForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
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
            <div className="space-y-1.5">
              <Label>Basis (provision / authority)</Label>
              <Input value={edForm.basis} onChange={(e) => setEdForm((f) => ({ ...f, basis: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={edForm.notes} onChange={(e) => setEdForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
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
