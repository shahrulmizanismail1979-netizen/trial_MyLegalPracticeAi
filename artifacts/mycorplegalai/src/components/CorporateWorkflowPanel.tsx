import { useState, useEffect } from "react";
import { Loader2, Plus, Pencil, Trash2, CheckCircle2, AlertTriangle, Building2, FileSignature, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  useCorpWorkflow, 
  useCreateObligation, useUpdateObligation, useDeleteObligation, 
  useCreateTransaction, useUpdateTransaction, useDeleteTransaction, 
  useUpdateReview,
  type Obligation, type TransactionItem, type ReviewState
} from "@/hooks/use-corp-workflow";
import { ApiError } from "@/hooks/use-matters";

const inputCls = "w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";
const thCls = "px-3 py-2 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap border-b border-border bg-muted/20";
const tdCls = "px-3 py-2.5 text-sm text-foreground border-b border-border/30 align-top";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: "Open", cls: "bg-slate-500/10 text-slate-300 border-slate-500/20" },
    at_risk: { label: "At risk", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
    fulfilled: { label: "Fulfilled", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    not_applicable: { label: "Not applicable", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
    blocked: { label: "Blocked", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
    complete: { label: "Complete", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    pending: { label: "Pending", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
    in_progress: { label: "In Progress", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    done: { label: "Done", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    draft: { label: "Draft", cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
    negotiation: { label: "Negotiation", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    execution: { label: "Execution", cls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
    completed: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    approved: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    rejected: { label: "Rejected", cls: "bg-red-500/10 text-red-400 border-red-500/20" }
  };
  const d = map[status] || { label: status, cls: "bg-slate-500/10 text-slate-400 border-slate-500/20" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${d.cls}`}>
      {d.label}
    </span>
  );
}

function RiskBadge({ risk }: { risk: string | null }) {
  if (!risk) return <span className="text-muted-foreground">-</span>;
  const map: Record<string, string> = {
    low: "text-emerald-400",
    medium: "text-amber-400",
    high: "text-red-400",
  };
  return <span className={`text-[11px] font-bold uppercase tracking-wider ${map[risk] || "text-foreground"}`}>{risk}</span>;
}

export function CorporateWorkflowPanel({ matterId }: { matterId: number }) {
  const { data, isLoading, isError } = useCorpWorkflow(matterId);

  if (isLoading) {
    return <div className="p-8 text-center text-primary animate-pulse flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Syncing control room...</div>;
  }
  if (isError || !data) {
    return <div className="p-8 text-center text-red-400 text-sm">Failed to load workflow data.</div>;
  }

  return (
    <div className="space-y-6">
      <ObligationsSection matterId={matterId} obligations={data.obligations} />
      <TransactionsSection matterId={matterId} transactions={data.transactions} />
      <FinalReviewSection matterId={matterId} initialReview={data.review} />
    </div>
  );
}

function ObligationsSection({ matterId, obligations }: { matterId: number; obligations: Obligation[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const defaultForm = { title: "", authority: "", owner_name: "", due_date: "", status: "open", risk: "low", evidence_note: "", source_reference: "" };
  const [form, setForm] = useState(defaultForm);
  
  const create = useCreateObligation();
  const update = useUpdateObligation();
  const remove = useDeleteObligation();
  const { toast } = useToast();

  const handleOpenNew = () => {
    setForm(defaultForm);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (ob: Obligation) => {
    setForm({
      title: ob.title,
      authority: ob.authority || "",
      owner_name: ob.owner_name || "",
      due_date: ob.due_date ? ob.due_date.slice(0, 10) : "",
      status: ob.status,
      risk: ob.risk || "low",
      evidence_note: ob.evidence_note || "",
      source_reference: ob.source_reference || "",
    });
    setEditingId(ob.id);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    try {
      if (editingId) {
        await update.mutateAsync({ matterId, id: editingId, ...form, due_date: form.due_date || null });
        toast({ title: "Obligation updated" });
      } else {
        await create.mutateAsync({ matterId, ...form, due_date: form.due_date || null });
        toast({ title: "Obligation created" });
      }
      setIsModalOpen(false);
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Error saving obligation", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this obligation?")) return;
    try {
      await remove.mutateAsync({ matterId, id });
      toast({ title: "Obligation deleted" });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Error deleting obligation", variant: "destructive" });
    }
  };

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground font-serif tracking-wide">Regulatory & Contractual Obligations</h2>
        </div>
        <Button size="sm" onClick={handleOpenNew} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" /> Add Obligation
        </Button>
      </div>
      
      {obligations.length === 0 ? (
        <div className="p-8 text-center flex flex-col items-center">
          <CircleDashed className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No obligations recorded. Track regulatory requirements and evidence here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Obligation</th>
                <th className={thCls}>Authority / Source</th>
                <th className={thCls}>Owner</th>
                <th className={thCls}>Due Date</th>
                <th className={thCls}>Risk</th>
                <th className={thCls}>Status</th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {obligations.map((ob) => (
                <tr key={ob.id} className="hover:bg-primary/5 transition-colors group">
                  <td className={tdCls}>
                    <p className="font-medium">{ob.title}</p>
                    {ob.evidence_note && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ob.evidence_note}</p>}
                  </td>
                  <td className={tdCls}>
                    <div className="text-xs">{ob.authority || <span className="text-muted-foreground">-</span>}</div>
                    {ob.source_reference && <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">{ob.source_reference}</div>}
                  </td>
                  <td className={tdCls}><span className="text-xs">{ob.owner_name || "-"}</span></td>
                  <td className={tdCls}><span className="text-xs">{ob.due_date ? new Date(ob.due_date).toLocaleDateString() : "-"}</span></td>
                  <td className={tdCls}><RiskBadge risk={ob.risk} /></td>
                  <td className={tdCls}><StatusBadge status={ob.status} /></td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(ob)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(ob.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Obligation" : "Add Obligation"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. File Annual Return" />
            </div>
            <div className="space-y-1.5">
              <Label>Authority / Counterparty</Label>
              <Input value={form.authority} onChange={e => setForm({...form, authority: e.target.value})} placeholder="e.g. SSM / LHDN" />
            </div>
            <div className="space-y-1.5">
              <Label>Source Reference</Label>
              <Input value={form.source_reference} onChange={e => setForm({...form, source_reference: e.target.value})} placeholder="e.g. Clause 4.2 / Section 68" />
            </div>
            <div className="space-y-1.5">
              <Label>Owner / Assignee</Label>
              <Input value={form.owner_name} onChange={e => setForm({...form, owner_name: e.target.value})} placeholder="e.g. John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label>Risk Level</Label>
              <select value={form.risk} onChange={e => setForm({...form, risk: e.target.value})} className={inputCls}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inputCls}>
                <option value="open">Open</option>
                <option value="at_risk">At risk</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="not_applicable">Not applicable</option>
              </select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Evidence / Notes</Label>
              <Textarea value={form.evidence_note} onChange={e => setForm({...form, evidence_note: e.target.value})} rows={3} placeholder="Link to document or notes on fulfillment..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Obligation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function TransactionsSection({ matterId, transactions }: { matterId: number; transactions: TransactionItem[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const defaultForm = { title: "", item_type: "Agreement", counterparty: "", target_date: "", status: "open", version_label: "", deviation: "", fallback_position: "", approval_status: "pending", notes: "" };
  const [form, setForm] = useState(defaultForm);
  
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const remove = useDeleteTransaction();
  const { toast } = useToast();

  const handleOpenNew = () => {
    setForm(defaultForm);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tx: TransactionItem) => {
    setForm({
      title: tx.title,
      item_type: tx.item_type || "Agreement",
      counterparty: tx.counterparty || "",
      target_date: tx.target_date ? tx.target_date.slice(0, 10) : "",
      status: tx.status,
      version_label: tx.version_label || "",
      deviation: tx.deviation || "",
      fallback_position: tx.fallback_position || "",
      approval_status: tx.approval_status || "pending",
      notes: tx.notes || "",
    });
    setEditingId(tx.id);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    try {
      if (editingId) {
        await update.mutateAsync({ matterId, id: editingId, ...form, target_date: form.target_date || null });
        toast({ title: "Transaction updated" });
      } else {
        await create.mutateAsync({ matterId, ...form, target_date: form.target_date || null });
        toast({ title: "Transaction added" });
      }
      setIsModalOpen(false);
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Error saving transaction", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this transaction item?")) return;
    try {
      await remove.mutateAsync({ matterId, id });
      toast({ title: "Transaction deleted" });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Error deleting transaction", variant: "destructive" });
    }
  };

  return (
    <Card className="border-border/60 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2">
          <FileSignature className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground font-serif tracking-wide">Transaction / Deal Items</h2>
        </div>
        <Button size="sm" onClick={handleOpenNew} className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" /> Add Transaction
        </Button>
      </div>
      
      {transactions.length === 0 ? (
        <div className="p-8 text-center flex flex-col items-center">
          <CircleDashed className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No transaction items tracked. Add contracts, resolutions, or filings.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className={thCls}>Item</th>
                <th className={thCls}>Counterparty</th>
                <th className={thCls}>Status & Version</th>
                <th className={thCls}>Deviations / Fallbacks</th>
                <th className={thCls}>Approval</th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-primary/5 transition-colors group">
                  <td className={tdCls}>
                    <p className="font-medium">{tx.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wide">{tx.item_type}</p>
                  </td>
                  <td className={tdCls}><span className="text-xs">{tx.counterparty || "-"}</span></td>
                  <td className={tdCls}>
                    <div className="space-y-1.5">
                      <StatusBadge status={tx.status} />
                      {tx.version_label && <div className="text-[10px] text-muted-foreground font-mono">v: {tx.version_label}</div>}
                    </div>
                  </td>
                  <td className={tdCls}>
                    {(tx.deviation || tx.fallback_position) ? (
                      <div className="space-y-1 text-xs">
                        {tx.deviation && <div><span className="text-amber-400/80 font-medium">Dev:</span> <span className="text-muted-foreground">{tx.deviation}</span></div>}
                        {tx.fallback_position && <div><span className="text-primary/80 font-medium">FB:</span> <span className="text-muted-foreground">{tx.fallback_position}</span></div>}
                      </div>
                    ) : <span className="text-muted-foreground text-xs">Standard</span>}
                  </td>
                  <td className={tdCls}>
                    <div className="space-y-1">
                      <StatusBadge status={tx.approval_status} />
                      {tx.approved_by && <div className="text-[10px] text-muted-foreground">by {tx.approved_by}</div>}
                    </div>
                  </td>
                  <td className={tdCls}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenEdit(tx)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(tx.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Transaction Item" : "Add Transaction Item"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-1.5">
              <Label>Title / Document Name *</Label>
              <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Share Purchase Agreement" />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Input value={form.item_type} onChange={e => setForm({...form, item_type: e.target.value})} placeholder="e.g. Agreement, Resolution" />
            </div>
            <div className="space-y-1.5">
              <Label>Counterparty</Label>
              <Input value={form.counterparty} onChange={e => setForm({...form, counterparty: e.target.value})} placeholder="e.g. Acme Corp" />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className={inputCls}>
                <option value="open">Open</option>
                <option value="blocked">Blocked</option>
                <option value="complete">Complete</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Version Label</Label>
              <Input value={form.version_label} onChange={e => setForm({...form, version_label: e.target.value})} placeholder="e.g. v2.1" />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Standard Deviations</Label>
              <Textarea value={form.deviation} onChange={e => setForm({...form, deviation: e.target.value})} rows={2} placeholder="Note any deviations from standard template..." />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Fallback Position</Label>
              <Textarea value={form.fallback_position} onChange={e => setForm({...form, fallback_position: e.target.value})} rows={2} placeholder="If negotiation stalls on deviation..." />
            </div>
            <div className="space-y-1.5">
              <Label>Approval Status</Label>
              <select value={form.approval_status} onChange={e => setForm({...form, approval_status: e.target.value})} className={inputCls}>
                <option value="not_required">Not required</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Target Date</Label>
              <Input type="date" value={form.target_date} onChange={e => setForm({...form, target_date: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
              {(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FinalReviewSection({ matterId, initialReview }: { matterId: number; initialReview: ReviewState | null }) {
  const [form, setForm] = useState<ReviewState>({
    reviewer_name: initialReview?.reviewer_name || "",
    evidence_status: initialReview?.evidence_status || "needs_review",
    assumptions: initialReview?.assumptions || "",
    finalised: initialReview?.finalised || false,
  });

  const update = useUpdateReview();
  const { toast } = useToast();

  useEffect(() => {
    if (initialReview) {
      setForm({
        reviewer_name: initialReview.reviewer_name || "",
        evidence_status: initialReview.evidence_status || "needs_review",
        assumptions: initialReview.assumptions || "",
        finalised: initialReview.finalised || false,
      });
    }
  }, [initialReview]);

  const handleSave = async (isFinalising: boolean = false) => {
    try {
      const payload = { ...form };
      if (isFinalising) {
        if (payload.evidence_status !== "verified") {
          toast({ title: "Cannot finalise until evidence is verified", variant: "destructive" });
          return;
        }
        payload.finalised = true;
      }
      
      await update.mutateAsync({ matterId, ...payload });
      toast({ title: isFinalising ? "Matter Finalised" : "Review saved" });
    } catch (e) {
      toast({ title: e instanceof ApiError ? e.message : "Error saving review", variant: "destructive" });
    }
  };

  return (
    <Card className={`border transition-colors ${form.finalised ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-primary/20 bg-primary/5'}`}>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className={`text-lg font-serif ${form.finalised ? 'text-emerald-400' : 'text-primary'}`}>
              {form.finalised ? 'Matter Finalised' : 'Final Matter Review'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Verify evidence and register assumptions before generating closing reports.
            </p>
          </div>
          {form.finalised && (
            <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full text-sm font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Locked
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
          <div className="space-y-1.5">
            <Label>Reviewer Name</Label>
            <Input 
              value={form.reviewer_name || ""} 
              onChange={e => setForm({...form, reviewer_name: e.target.value})} 
              disabled={form.finalised}
              placeholder="Partner / Senior Counsel Name" 
              className="bg-background"
            />
          </div>
          
          <div className="space-y-1.5">
            <Label>Overall Evidence Status</Label>
            <select 
              value={form.evidence_status} 
              onChange={e => {
                const val = e.target.value as "needs_review" | "verified";
                setForm({...form, evidence_status: val, finalised: val !== "verified" ? false : form.finalised });
              }} 
              disabled={form.finalised}
              className={`${inputCls} ${form.evidence_status === 'verified' ? 'text-emerald-400 border-emerald-500/30' : 'text-amber-400 border-amber-500/30'}`}
            >
              <option value="needs_review">Needs Review / Pending</option>
              <option value="verified">All Evidence Verified</option>
            </select>
          </div>

          <div className="col-span-1 md:col-span-2 space-y-1.5">
            <Label>Working Assumptions / Limitations</Label>
            <Textarea 
              value={form.assumptions || ""} 
              onChange={e => setForm({...form, assumptions: e.target.value})} 
              disabled={form.finalised}
              rows={3} 
              placeholder="State any assumptions relied upon during this review (e.g. unaudited accounts accepted as true)..." 
              className="bg-background"
            />
          </div>
        </div>

        {!form.finalised && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Changes are tracked for audit purposes.</span>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={update.isPending}>
                Save Draft
              </Button>
              <Button 
                onClick={() => {
                  if (confirm("This will finalise the workflow and mark evidence as closed. Proceed?")) {
                    handleSave(true);
                  }
                }} 
                disabled={update.isPending || form.evidence_status !== 'verified'}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Finalise Matter
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
