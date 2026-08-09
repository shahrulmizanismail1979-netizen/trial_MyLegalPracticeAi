import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  useMatter, useUpdateMatter, useDeleteMatter,
  useAddDeadline, useUpdateDeadline, useDeleteDeadline,
  useMatterWork, categoryMeta, daysUntil,
  type MatterDeadline, type MatterWorkItem, type MatterInput,
} from "@/hooks/use-matters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, CalendarClock, Plus, Pencil, Trash2, Check, AlertTriangle,
  CircleCheck, Building2, Users, Hash, Clock, FileText, Copy, Download, ChevronDown,
} from "lucide-react";

const STATUS_OPTIONS = ["open", "on-hold", "closed"];
const CATEGORY_OPTIONS = ["filing", "compliance", "meeting", "closing", "hearing", "custom"];
const inputCls =
  "w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function CountdownBadge({ due, status }: { due: string; status: string }) {
  if (status === "done") {
    return <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400"><CircleCheck className="h-3.5 w-3.5" /> Done</span>;
  }
  const d = daysUntil(due);
  if (d < 0) return <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> {Math.abs(d)}d overdue</span>;
  if (d === 0) return <span className="text-[11px] font-bold text-red-400">Due today</span>;
  if (d <= 7) return <span className="text-[11px] font-bold text-amber-400">in {d}d</span>;
  return <span className="text-[11px] font-medium text-muted-foreground">in {d}d</span>;
}

export default function MatterDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : null;
  const { data: matter, isLoading } = useMatter(id);
  const { toast } = useToast();

  const updateMatter = useUpdateMatter();
  const deleteMatter = useDeleteMatter();
  const addDeadline = useAddDeadline();
  const updateDeadline = useUpdateDeadline();
  const deleteDeadline = useDeleteDeadline();
  const { data: matterWork } = useMatterWork(id);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<MatterInput>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [dForm, setDForm] = useState({ title: "", dueDate: "", category: "custom", basis: "", notes: "" });

  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) setLocation("/login");
  }, [setLocation]);

  if (isLoading) {
    return <AppLayout><div className="p-8 text-center text-primary animate-pulse">Loading matter…</div></AppLayout>;
  }
  if (!matter) {
    return (
      <AppLayout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground mb-4">This matter could not be found.</p>
          <Link href="/matters"><Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back to matters</Button></Link>
        </div>
      </AppLayout>
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
    if (!editForm.title?.trim()) { toast({ title: "Title required", variant: "destructive" }); return; }
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
      setLocation("/matters");
    } catch (e) {
      toast({ title: "Could not delete", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const submitAdd = async () => {
    if (!dForm.title.trim() || !dForm.dueDate) { toast({ title: "Title and due date required", variant: "destructive" }); return; }
    try {
      await addDeadline.mutateAsync({ matterId: matter.id, ...dForm });
      toast({ title: "Deadline added" });
      setAddOpen(false);
      setDForm({ title: "", dueDate: "", category: "custom", basis: "", notes: "" });
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

  const downloadDoc = (w: MatterWorkItem) => {
    const blob = new Blob([w.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${w.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deadlines = matter.deadlines ?? [];
  const pending = deadlines.filter((d) => d.status !== "done");
  const done = deadlines.filter((d) => d.status === "done");

  const infoRows: { icon: typeof Building2; label: string; value: string }[] = [];
  if (matter.clientName) infoRows.push({ icon: Building2, label: "Client", value: matter.clientName });
  if (matter.counterparty) infoRows.push({ icon: Users, label: "Counterparty", value: matter.counterparty });
  if (matter.matterType) infoRows.push({ icon: FileText, label: "Type", value: matter.matterType });
  if (matter.reference) infoRows.push({ icon: Hash, label: "Reference", value: matter.reference });

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <Link href="/matters">
          <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-4 w-4" /> All matters
          </button>
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap border-b border-purple-500/15 pb-6">
          <div>
            <h1 className="text-3xl font-serif font-bold text-foreground">{matter.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {matter.matterType ? `${matter.matterType} · ` : ""}{matter.status}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={openEdit}><Pencil className="h-4 w-4" /> Edit</Button>
            <Button variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>

        {infoRows.length > 0 && (
          <Card>
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
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-2">Notes</p>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{matter.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        <div className="flex items-center gap-2 mt-4">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="font-serif font-bold text-lg text-foreground">Documents</h2>
          {(matterWork?.length ?? 0) > 0 && <Badge variant="outline">{matterWork!.length}</Badge>}
        </div>
        {(matterWork?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No documents filed yet. Drafts saved from the AI tools can be filed into this matter.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {matterWork!.map((w) => {
              const isOpen = expanded === w.id;
              return (
                <Card key={w.id}>
                  <CardContent className="p-0">
                    <button
                      onClick={() => setExpanded(isOpen ? null : w.id)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-accent/5 transition-colors"
                    >
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-foreground truncate">{w.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Updated {fmtDate(w.updatedAt)}</p>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-border p-4 space-y-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => copyDoc(w)}>
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadDoc(w)}>
                            <Download className="h-3.5 w-3.5" /> Download .txt
                          </Button>
                        </div>
                        <pre className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans max-h-[400px] overflow-y-auto bg-background border border-border rounded-md p-3">
                          {w.content}
                        </pre>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Deadlines */}
        <div className="flex items-center justify-between mt-4">
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
              <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                Add key dates for this matter — filing deadlines, board meetings, closing dates and compliance milestones.
              </p>
              <Button className="gap-2" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add a deadline</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {[...pending, ...done].map((d) => {
              const cat = categoryMeta(d.category);
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
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
                <Label>Reference</Label>
                <Input value={editForm.reference ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, reference: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select value={editForm.status ?? "open"} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))} className={inputCls}>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={editForm.notes ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMatter.isPending}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-serif">Delete this matter?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently deletes <span className="text-foreground font-medium">“{matter.title}”</span> and all its deadlines. This cannot be undone.
          </p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={doDelete} disabled={deleteMatter.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add deadline */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-serif">Add Deadline</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title *</Label>
              <Input value={dForm.title} onChange={(e) => setDForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. File annual return" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Due date *</Label>
                <Input type="date" value={dForm.dueDate} onChange={(e) => setDForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <select value={dForm.category} onChange={(e) => setDForm((f) => ({ ...f, category: e.target.value }))} className={inputCls}>
                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{categoryMeta(c).label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Basis (rule / authority)</Label>
              <Input value={dForm.basis} onChange={(e) => setDForm((f) => ({ ...f, basis: e.target.value }))} placeholder="e.g. s.68 Companies Act 2016" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={dForm.notes} onChange={(e) => setDForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={submitAdd} disabled={addDeadline.isPending}>Add deadline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
