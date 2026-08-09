import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { useMatters, useCreateMatter, ApiError, type MatterInput } from "@/hooks/use-matters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FolderKanban, Plus, ArrowRight, Building2, Users, Hash, Sparkles } from "lucide-react";

const STATUS_META: Record<string, { label: string; color: string }> = {
  open: { label: "Open", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  "on-hold": { label: "On Hold", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  closed: { label: "Closed", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
};
function statusMeta(s: string) {
  return STATUS_META[s] ?? STATUS_META.open;
}

const EMPTY: MatterInput = {
  title: "",
  clientName: "",
  counterparty: "",
  matterType: "",
  reference: "",
  status: "open",
  notes: "",
};

const inputCls =
  "w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary";

export default function MattersPage() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data: matters, isLoading } = useMatters(statusFilter || undefined);
  const createMatter = useCreateMatter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MatterInput>(EMPTY);

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) setLocation("/login");
  }, [setLocation]);

  const set = (k: keyof MatterInput, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title?.trim()) {
      toast({ title: "Matter title required", description: "Give the matter a short identifying title.", variant: "destructive" });
      return;
    }
    try {
      await createMatter.mutateAsync(form);
      toast({ title: "Matter created", description: `“${form.title}” is now in your workspace.` });
      setOpen(false);
      setForm(EMPTY);
    } catch (e) {
      if (e instanceof ApiError && e.status === 402) {
        toast({ title: "Premium feature", description: "Creating matters needs an active subscription.", variant: "destructive" });
      } else {
        toast({ title: "Could not create matter", description: e instanceof Error ? e.message : "Please try again.", variant: "destructive" });
      }
    }
  };

  const list = matters ?? [];

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="border-b border-purple-500/15 pb-6 flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-purple-500/20 flex items-center justify-center">
              <FolderKanban className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground">Matter Files</h1>
              <p className="text-sm text-muted-foreground">
                Case files holding client, counterparty, reference, filed drafts and deadlines — all in one place.
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Matter
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {["", "open", "on-hold", "closed"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                statusFilter === s
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "text-muted-foreground border-border hover:border-primary/30"
              }`}
            >
              {s === "" ? "All" : statusMeta(s).label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-primary animate-pulse">Loading your matters…</div>
        ) : list.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <FolderKanban className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <h3 className="text-lg font-serif font-semibold text-foreground mb-1">No matters yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                Open a matter for each deal or client engagement. Drafts generated from the AI tools can be filed
                straight into a matter, and you can track its deadlines here.
              </p>
              <Button onClick={() => setOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Create your first matter
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((m) => {
              const sm = statusMeta(m.status);
              return (
                <Link key={m.id} href={`/matters/${m.id}`}>
                  <Card className="flex flex-col hover:border-primary/50 transition-all cursor-pointer h-full group">
                    <CardContent className="p-5 flex flex-col gap-3 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sm.color}`}>
                          {sm.label}
                        </span>
                        {m.matterType && <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[50%]">{m.matterType}</span>}
                      </div>
                      <h3 className="font-serif font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {m.title}
                      </h3>
                      <div className="space-y-1.5 text-xs text-muted-foreground flex-1">
                        {m.clientName && (
                          <div className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{m.clientName}</span></div>
                        )}
                        {m.counterparty && (
                          <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{m.counterparty}</span></div>
                        )}
                        {m.reference && (
                          <div className="flex items-center gap-1.5"><Hash className="h-3.5 w-3.5 shrink-0" /><span className="truncate font-mono">{m.reference}</span></div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-primary font-medium pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Open matter <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">New Matter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 bg-primary/5 border border-primary/15 rounded-lg p-3">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Only a title is required. Fill the rest now or later — and add deadlines once the matter is open.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Matter title *</Label>
              <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Acme Bhd — Series A Financing" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client</Label>
                <Input value={form.clientName ?? ""} onChange={(e) => set("clientName", e.target.value)} placeholder="e.g. Acme Bhd" />
              </div>
              <div className="space-y-1.5">
                <Label>Counterparty</Label>
                <Input value={form.counterparty ?? ""} onChange={(e) => set("counterparty", e.target.value)} placeholder="e.g. Beta Capital" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Matter type</Label>
                <Input value={form.matterType ?? ""} onChange={(e) => set("matterType", e.target.value)} placeholder="e.g. M&A, Compliance" />
              </div>
              <div className="space-y-1.5">
                <Label>Reference</Label>
                <Input value={form.reference ?? ""} onChange={(e) => set("reference", e.target.value)} placeholder="e.g. MCL/2026/1234" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select value={form.status ?? "open"} onChange={(e) => set("status", e.target.value)} className={inputCls}>
                <option value="open">Open</option>
                <option value="on-hold">On Hold</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Background, deal terms, key contacts…" rows={3} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={createMatter.isPending}>
              {createMatter.isPending ? "Creating…" : "Create matter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
