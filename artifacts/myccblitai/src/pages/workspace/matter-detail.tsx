import { useState } from "react";
import { Link, useRoute } from "wouter";
import WorkspaceLayout from "./layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import MarkdownRenderer from "@/components/markdown-renderer";
import { DraftExportButtons } from "@workspace/draft-export/react";
import { useToast } from "@/hooks/use-toast";
import {
  useMatter,
  useUpdateMatter,
  useDeleteMatter,
  useMatterWork,
  useAddDeadline,
  useUpdateDeadline,
  useDeleteDeadline,
  daysUntil,
  fmtDate,
  ApiError,
  type MatterDeadline,
  type MatterWorkItem,
  type MatterInput,
} from "@/hooks/use-matters";
import {
  ArrowLeft,
  CalendarClock,
  Plus,
  Pencil,
  Trash2,
  Check,
  AlertTriangle,
  CircleCheck,
  User,
  Hash,
  Clock,
  FileText,
  Copy,
} from "lucide-react";

const STATUS_OPTIONS = ["open", "on-hold", "closed"];

function CountdownBadge({ due, status }: { due: string; status: string }) {
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
        <CircleCheck className="h-3.5 w-3.5" /> Done
      </span>
    );
  }
  const d = daysUntil(due);
  if (d < 0)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive">
        <AlertTriangle className="h-3.5 w-3.5" /> {Math.abs(d)}d overdue
      </span>
    );
  if (d === 0) return <span className="text-[11px] font-bold text-destructive">Due today</span>;
  if (d <= 7) return <span className="text-[11px] font-bold text-amber-500">in {d}d</span>;
  return <span className="text-[11px] font-medium text-muted-foreground">in {d}d</span>;
}

export default function MatterDetailPage() {
  const [, params] = useRoute("/workspace/matters/:id");
  const id = params?.id ? parseInt(params.id, 10) : null;
  const { data: matter, isLoading, error } = useMatter(id);
  const { data: matterWork } = useMatterWork(id);
  const { toast } = useToast();

  const updateMatter = useUpdateMatter();
  const deleteMatter = useDeleteMatter();
  const addDeadline = useAddDeadline();
  const updateDeadline = useUpdateDeadline();
  const deleteDeadline = useDeleteDeadline();

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<MatterInput>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dForm, setDForm] = useState({ title: "", dueDate: "", basis: "", notes: "" });
  const [viewDoc, setViewDoc] = useState<MatterWorkItem | null>(null);

  const isForbidden = error instanceof ApiError && error.status === 403;

  if (isForbidden) {
    return (
      <WorkspaceLayout>
        <div className="p-10 text-center max-w-lg mx-auto">
          <h2 className="text-xl font-serif font-bold mb-2">Matter files require a subscriber access code</h2>
          <p className="text-muted-foreground mb-4">{error instanceof ApiError ? error.message : ""}</p>
          <Link href="/workspace/matters"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button></Link>
        </div>
      </WorkspaceLayout>
    );
  }

  if (isLoading) {
    return (
      <WorkspaceLayout>
        <div className="p-10 text-center text-primary animate-pulse">Loading matter…</div>
      </WorkspaceLayout>
    );
  }

  if (!matter) {
    return (
      <WorkspaceLayout>
        <div className="p-10 text-center">
          <p className="text-muted-foreground mb-4">This matter could not be found.</p>
          <Link href="/workspace/matters"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back to matters</Button></Link>
        </div>
      </WorkspaceLayout>
    );
  }

  const openEdit = () => {
    setEditForm({
      title: matter.title,
      clientName: matter.clientName ?? "",
      counterparty: matter.counterparty ?? "",
      matterType: matter.matterType ?? "",
      reference: matter.reference ?? "",
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
      setDForm({ title: "", dueDate: "", basis: "", notes: "" });
    } catch (e) {
      toast({ title: "Could not add deadline", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const toggleDone = async (d: MatterDeadline) => {
    try {
      await updateDeadline.mutateAsync({ matterId: matter.id, id: d.id, status: d.status === "done" ? "pending" : "done" });
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

  const copyDoc = (w: MatterWorkItem) => {
    navigator.clipboard.writeText(w.content);
    toast({ title: "Copied to clipboard" });
  };

  const deadlines = matter.deadlines ?? [];
  const pending = deadlines.filter((d) => d.status !== "done");
  const done = deadlines.filter((d) => d.status === "done");

  const infoRows: { icon: typeof User; label: string; value: string }[] = [];
  if (matter.reference) infoRows.push({ icon: Hash, label: "File ref", value: matter.reference });
  if (matter.clientName) infoRows.push({ icon: User, label: "Client", value: matter.clientName });
  if (matter.counterparty) infoRows.push({ icon: User, label: "Counterparty", value: matter.counterparty });
  if (matter.matterType) infoRows.push({ icon: FileText, label: "Type", value: matter.matterType });

  return (
    <WorkspaceLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto">
        <Link href="/workspace/matters">
          <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" /> All matters
          </button>
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground mb-1">{matter.title}</h1>
            <p className="text-muted-foreground">{matter.status}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={openEdit}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        {infoRows.length > 0 && (
          <Card className="mb-6">
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
          <Card className="mb-6">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Notes</p>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{matter.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        <div className="flex items-center gap-2 mb-4 mt-8">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-serif font-bold text-lg text-foreground">Documents</h2>
          {(matterWork?.length ?? 0) > 0 && <Badge variant="outline">{matterWork!.length}</Badge>}
        </div>
        {(matterWork?.length ?? 0) === 0 ? (
          <Card className="mb-8">
            <CardContent className="p-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No documents filed yet. Generate a draft in any tool and file it into this matter.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {matterWork!.map((w) => (
              <Card key={w.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => setViewDoc(w)}>
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

        {/* Deadlines */}
        <div className="flex items-center justify-between mb-4 mt-8">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            <h2 className="font-serif font-bold text-lg text-foreground">Deadlines</h2>
            {pending.length > 0 && <Badge variant="outline">{pending.length} pending</Badge>}
          </div>
          <Button className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add</Button>
        </div>

        {deadlines.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <CalendarClock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-serif font-semibold text-foreground mb-1">No deadlines yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Add key dates for this matter and track them here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {[...pending, ...done].map((d) => {
              const isDone = d.status === "done";
              return (
                <Card key={d.id} className={`transition-all ${isDone ? "opacity-60" : ""}`}>
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
                      <span className={`text-sm font-medium ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{d.title}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" /> {fmtDate(d.dueDate)}
                        {d.basis && <span className="truncate">· {d.basis}</span>}
                      </div>
                      {d.notes && <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">{d.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <CountdownBadge due={d.dueDate} status={d.status} />
                      <button onClick={() => removeDeadline(d)} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-secondary" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit matter */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit matter</DialogTitle></DialogHeader>
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
                <Label>Counterparty</Label>
                <Input value={editForm.counterparty ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, counterparty: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Matter type</Label>
                <Input value={editForm.matterType ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, matterType: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>File reference</Label>
                <Input value={editForm.reference ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                value={editForm.status ?? "open"}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                className="flex h-10 w-full items-center rounded-md border border-border/60 bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={editForm.notes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMatter.isPending}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete this matter?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes <span className="text-foreground font-medium">"{matter.title}"</span> and all its deadlines. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete} disabled={deleteMatter.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add deadline */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add deadline</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={dForm.title} onChange={(e) => setDForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. File defence" />
            </div>
            <div className="space-y-1.5">
              <Label>Due date *</Label>
              <Input type="date" value={dForm.dueDate} onChange={(e) => setDForm((f) => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Basis (rule / authority)</Label>
              <Input value={dForm.basis} onChange={(e) => setDForm((f) => ({ ...f, basis: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={dForm.notes} onChange={(e) => setDForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={addDeadline.isPending}>Add deadline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View document */}
      <Dialog open={!!viewDoc} onOpenChange={(o) => !o && setViewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="pr-8">{viewDoc?.title}</DialogTitle>
          </DialogHeader>
          {viewDoc && (
            <>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copyDoc(viewDoc)}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <DraftExportButtons title={viewDoc.title} content={viewDoc.content} className="items-center" />
              </div>
              <div className="overflow-y-auto flex-1 mt-2 border-t border-border pt-4">
                <MarkdownRenderer content={viewDoc.content} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </WorkspaceLayout>
  );
}
