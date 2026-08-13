import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTip, LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Landmark, Users, BarChart2, Plus, Download, Trash2,
  ChevronDown, ChevronUp, Loader2, ArrowDownLeft, ArrowUpRight, ArrowRightLeft,
  Settings2, AlertTriangle, CheckCircle2,
} from "lucide-react";

// ── API helpers ────────────────────────────────────────────────────────────────
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/firm${path}`, { credentials: "include", ...init });

const apiJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const r = await api(path, init);
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error((e as Record<string, string>).error ?? r.statusText);
  }
  return r.json() as Promise<T>;
};

const J = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MYR = (n: number) => `RM ${(n ?? 0).toFixed(2)}`;

// ── Types ──────────────────────────────────────────────────────────────────────

interface OfficeEntry {
  id: number; type: "income" | "expense"; category: string;
  description: string; amount: number; entryDate: string;
  reference?: string; createdAt: string;
}
interface ClientLedger {
  id: number; clientName: string; matterRef?: string;
  balance: number; notes?: string; createdAt: string; updatedAt: string;
}
interface ClientEntry {
  id: number; ledgerId: number; type: "deposit" | "disbursement" | "transfer_to_office";
  description: string; amount: number; entryDate: string; reference?: string; createdAt: string;
}
interface PlRow { month: string; income: number; expense: number; net: number; }
interface ExpenseBreakdown { category: string; total: number; budget?: number | null; overBudget?: boolean; }
interface CashflowRow { month: string; income: number; expense: number; net: number; cumulative: number; }

const ENTRY_COLORS: Record<string, string> = {
  income: "text-emerald-700", expense: "text-red-700",
  deposit: "text-emerald-700", disbursement: "text-red-700", transfer_to_office: "text-amber-700",
};
const ENTRY_BG: Record<string, string> = {
  income: "bg-emerald-100 text-emerald-800 border-emerald-200",
  expense: "bg-red-100 text-red-800 border-red-200",
  deposit: "bg-emerald-100 text-emerald-800 border-emerald-200",
  disbursement: "bg-red-100 text-red-800 border-red-200",
  transfer_to_office: "bg-amber-100 text-amber-800 border-amber-200",
};

const PIE_COLORS = ["#1565c0","#2e7d32","#6a1b9a","#c62828","#e65100","#00695c","#37474f","#4a148c","#0d47a1","#b71c1c","#1b5e20","#880e4f"];

// ══════════════════════════════════════════════════════════════════════════════
// OFFICE LEDGER TAB
// ══════════════════════════════════════════════════════════════════════════════

function OfficeLedgerTab() {
  const t = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [addOpen, setAddOpen]       = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [form, setForm] = useState({ type: "income" as "income" | "expense", category: "", description: "", amount: "", entryDate: "", reference: "" });
  // Per-category budget input state in the budget dialog (keyed by category name)
  const [budgetInputs, setBudgetInputs] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["acc-office", month, year],
    queryFn: () => apiJson<{ entries: OfficeEntry[]; totalIncome: number; totalExpense: number; net: number }>(
      `/accounts/office/entries?month=${month}&year=${year}`
    ),
  });

  const { data: cats } = useQuery({
    queryKey: ["acc-office-cats"],
    queryFn:  () => apiJson<{ income: string[]; expense: string[] }>("/accounts/office/categories"),
  });

  const { data: budgetData, refetch: refetchBudgets } = useQuery({
    queryKey: ["acc-budgets", month, year],
    queryFn:  () => apiJson<{ budgets: Record<string, number> }>(`/accounts/budgets?month=${month}&year=${year}`),
  });

  // Populate budget inputs when dialog opens
  const openBudgetDialog = () => {
    const existing = budgetData?.budgets ?? {};
    const inputs: Record<string, string> = {};
    for (const cat of (cats?.expense ?? [])) {
      inputs[cat] = existing[cat] != null ? String(existing[cat]) : "";
    }
    setBudgetInputs(inputs);
    setBudgetOpen(true);
  };

  const saveBudget = useMutation({
    mutationFn: async () => {
      for (const [category, val] of Object.entries(budgetInputs)) {
        const budget = parseFloat(val || "0");
        await apiJson("/accounts/budgets", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year, month, category, budget }),
        });
      }
    },
    onSuccess: () => {
      toast({ description: t("acc.budget.saved") });
      refetchBudgets();
      setBudgetOpen(false);
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const add = useMutation({
    mutationFn: () => apiJson("/accounts/office/entries", J({ ...form, amount: parseFloat(form.amount) })),
    onSuccess: () => { toast({ description: t("acc.office.added") }); qc.invalidateQueries({ queryKey: ["acc-office"] }); setAddOpen(false); setForm(f => ({ ...f, category: "", description: "", amount: "", entryDate: "", reference: "" })); },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const del = useMutation({
    mutationFn: (id: number) => apiJson(`/accounts/office/entries/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast({ description: t("acc.office.deleted") }); qc.invalidateQueries({ queryKey: ["acc-office"] }); },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const downloadVoucher = async (id: number, type: string) => {
    const resp = await api(`/accounts/voucher/office/${id}/pdf`);
    if (!resp.ok) { toast({ variant: "destructive", description: "Download failed." }); return; }
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${type === "income" ? "OR" : "PV"}-${String(id).padStart(6,"0")}.pdf`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  };

  const entries = data?.entries ?? [];
  const categoryList = form.type === "income" ? (cats?.income ?? []) : (cats?.expense ?? []);

  // Compute actual spend per expense category for the budget status panel
  const budgets = budgetData?.budgets ?? {};
  const actualByCategory: Record<string, number> = {};
  for (const e of entries.filter(e => e.type === "expense")) {
    actualByCategory[e.category] = (actualByCategory[e.category] ?? 0) + e.amount;
  }
  const expenseCats = cats?.expense ?? [];
  const catsWithBudget = expenseCats.filter(c => budgets[c] != null || (actualByCategory[c] ?? 0) > 0);
  const overBudgetCount = catsWithBudget.filter(c => budgets[c] != null && (actualByCategory[c] ?? 0) > budgets[c]!).length;

  return (
    <div className="space-y-4">
      {/* Month/Year picker + summary + add button */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
          <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-24 h-8 text-sm" />
        <div className="flex gap-4 ml-auto">
          <span className="text-sm font-semibold text-emerald-700">{t("acc.income")}: {MYR(data?.totalIncome ?? 0)}</span>
          <span className="text-sm font-semibold text-red-700">{t("acc.expense")}: {MYR(data?.totalExpense ?? 0)}</span>
          <span className={`text-sm font-bold ${(data?.net ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{t("acc.net")}: {MYR(data?.net ?? 0)}</span>
        </div>
        {/* Set Budgets dialog */}
        <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openBudgetDialog}>
              <Settings2 className="w-3.5 h-3.5" /> {t("acc.budget.set")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{t("acc.budget.title")} — {MONTHS[month - 1]} {year}</DialogTitle>
              <CardDescription className="text-xs text-muted-foreground pt-1">Set a monthly RM limit per expense category. Leave blank for no limit.</CardDescription>
            </DialogHeader>
            <div className="space-y-2 pt-2 max-h-80 overflow-y-auto pr-1">
              {(cats?.expense ?? []).map(cat => (
                <div key={cat} className="flex items-center gap-3">
                  <Label className="text-xs flex-1 truncate">{cat.replace(/_/g," ").replace(/\b\w/g, x => x.toUpperCase())}</Label>
                  <Input
                    type="number" min="0" step="0.01" placeholder="e.g. 5000"
                    value={budgetInputs[cat] ?? ""}
                    onChange={e => setBudgetInputs(p => ({ ...p, [cat]: e.target.value }))}
                    className="w-32 h-7 text-sm"
                  />
                </div>
              ))}
            </div>
            <Button className="w-full mt-3" disabled={saveBudget.isPending} onClick={() => saveBudget.mutate()}>
              {saveBudget.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null} {t("acc.save")}
            </Button>
          </DialogContent>
        </Dialog>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> {t("acc.office.add")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("acc.office.add")}</DialogTitle>
              <DialogDescription>Fill in the details below to record a new office ledger entry.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.type")}</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as "income"|"expense", category: "" }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">{t("acc.income")}</SelectItem>
                      <SelectItem value="expense">{t("acc.expense")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.category")}</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>{categoryList.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g," ").replace(/\b\w/g, x => x.toUpperCase())}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.description")}</Label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="h-14 text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.amount")} (RM)</Label>
                  <Input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.date")}</Label>
                  <Input type="date" value={form.entryDate} onChange={e => setForm(f => ({ ...f, entryDate: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.reference")} ({t("acc.optional")})</Label>
                <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} className="h-8 text-sm" placeholder="Invoice no., cheque no…" />
              </div>
              <Button className="w-full" disabled={!form.category || !form.description || !form.amount || !form.entryDate || add.isPending} onClick={() => add.mutate()}>
                {add.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null} {t("acc.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Budget Status Panel */}
      {catsWithBudget.length > 0 && (
        <Card className={`glass-card border ${overBudgetCount > 0 ? "border-red-300 bg-red-50/30" : "border-emerald-200 bg-emerald-50/20"}`}>
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              {overBudgetCount > 0
                ? <AlertTriangle className="w-4 h-4 text-red-600" />
                : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              <CardTitle className="text-sm font-semibold">
                {t("acc.budget.status")} — {MONTHS[month - 1]} {year}
                {overBudgetCount > 0 && (
                  <Badge className="ml-2 bg-red-100 text-red-700 border-red-300 text-xs">
                    {overBudgetCount} {t("acc.budget.overLimit")}
                  </Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-2">
              {catsWithBudget.map(cat => {
                const actual  = actualByCategory[cat] ?? 0;
                const budget  = budgets[cat];
                const isOver  = budget != null && actual > budget;
                const pct     = budget != null && budget > 0 ? Math.min((actual / budget) * 100, 100) : null;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className={`font-medium ${isOver ? "text-red-700" : "text-foreground"}`}>
                        {cat.replace(/_/g," ").replace(/\b\w/g, x => x.toUpperCase())}
                        {isOver && <AlertTriangle className="w-3 h-3 inline ml-1 text-red-600" />}
                      </span>
                      <span className={`font-semibold ${isOver ? "text-red-700" : "text-muted-foreground"}`}>
                        {MYR(actual)}{budget != null ? ` / ${MYR(budget)}` : ""}
                      </span>
                    </div>
                    {pct !== null && (
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isOver ? "bg-red-500" : pct > 80 ? "bg-amber-400" : "bg-emerald-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ledger table */}
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-10 text-sm">{t("acc.office.empty")}</p>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <Card key={e.id} className="glass-card">
              <CardContent className="p-3 flex flex-wrap items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${e.type === "income" ? "bg-emerald-100" : "bg-red-100"}`}>
                    {e.type === "income" ? <ArrowDownLeft className="w-4 h-4 text-emerald-700" /> : <ArrowUpRight className="w-4 h-4 text-red-700" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{e.description}</p>
                    <p className="text-xs text-muted-foreground">{e.entryDate} · {e.category.replace(/_/g," ").replace(/\b\w/g, x => x.toUpperCase())}{e.reference ? ` · ${e.reference}` : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  <span className={`text-base font-bold ${ENTRY_COLORS[e.type]}`}>{e.type === "income" ? "+" : "-"}{MYR(e.amount)}</span>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => downloadVoucher(e.id, e.type)}>
                    <Download className="w-3 h-3" /> {e.type === "income" ? "OR" : "PV"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => { if (confirm("Delete this entry?")) del.mutate(e.id); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CLIENT TRUST LEDGER TAB
// ══════════════════════════════════════════════════════════════════════════════

function ClientLedgerTab() {
  const t = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [newLedgerOpen, setNewLedgerOpen] = useState(false);
  const [addEntryOpen, setAddEntryOpen] = useState(false);
  const [ledgerForm, setLedgerForm] = useState({ clientName: "", matterRef: "", notes: "" });
  const [entryForm, setEntryForm] = useState({ type: "deposit" as "deposit"|"disbursement"|"transfer_to_office", description: "", amount: "", entryDate: "", reference: "" });

  const { data: ledgersData, isLoading } = useQuery({
    queryKey: ["acc-ledgers"],
    queryFn: () => apiJson<{ ledgers: ClientLedger[] }>("/accounts/client/ledgers"),
  });

  const { data: ledgerDetail } = useQuery({
    queryKey: ["acc-ledger-detail", expanded],
    queryFn:  () => apiJson<{ ledger: ClientLedger; entries: ClientEntry[] }>(`/accounts/client/ledgers/${expanded}`),
    enabled:  !!expanded,
  });

  const createLedger = useMutation({
    mutationFn: () => apiJson("/accounts/client/ledgers", J(ledgerForm)),
    onSuccess: () => { toast({ description: t("acc.client.created") }); qc.invalidateQueries({ queryKey: ["acc-ledgers"] }); setNewLedgerOpen(false); setLedgerForm({ clientName: "", matterRef: "", notes: "" }); },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const addEntry = useMutation({
    mutationFn: () => apiJson(`/accounts/client/ledgers/${expanded}/entries`, J({ ...entryForm, amount: parseFloat(entryForm.amount) })),
    onSuccess: () => { toast({ description: t("acc.client.entryAdded") }); qc.invalidateQueries({ queryKey: ["acc-ledgers"] }); qc.invalidateQueries({ queryKey: ["acc-ledger-detail", expanded] }); setAddEntryOpen(false); setEntryForm(f => ({ ...f, description: "", amount: "", entryDate: "", reference: "" })); },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const downloadVoucher = async (entryId: number, type: string) => {
    const prefixMap: Record<string, string> = { deposit: "OR-CA", disbursement: "PV-CA", transfer_to_office: "JV-CA" };
    const resp = await api(`/accounts/voucher/client/${entryId}/pdf`);
    if (!resp.ok) { toast({ variant: "destructive", description: "Download failed." }); return; }
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${prefixMap[type] ?? "VR"}-${String(entryId).padStart(6,"0")}.pdf`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  };

  const ledgers = ledgersData?.ledgers ?? [];
  const entries = ledgerDetail?.entries ?? [];
  const currentLedger = ledgerDetail?.ledger;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("acc.client.hint")}</p>
        <Dialog open={newLedgerOpen} onOpenChange={setNewLedgerOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> {t("acc.client.new")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("acc.client.new")}</DialogTitle>
              <DialogDescription>Create a new client trust ledger to track deposits and disbursements for a client.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.client.name")}</Label>
                <Input value={ledgerForm.clientName} onChange={e => setLedgerForm(f => ({ ...f, clientName: e.target.value }))} className="h-8 text-sm" placeholder="Full client name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.client.matterRef")} ({t("acc.optional")})</Label>
                <Input value={ledgerForm.matterRef} onChange={e => setLedgerForm(f => ({ ...f, matterRef: e.target.value }))} className="h-8 text-sm" placeholder="e.g. 2024/CIV/001" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.client.notes")} ({t("acc.optional")})</Label>
                <Textarea value={ledgerForm.notes} onChange={e => setLedgerForm(f => ({ ...f, notes: e.target.value }))} className="h-14 text-sm resize-none" />
              </div>
              <Button className="w-full" disabled={!ledgerForm.clientName || createLedger.isPending} onClick={() => createLedger.mutate()}>
                {createLedger.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null} {t("acc.save")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : ledgers.length === 0 ? (
        <p className="text-center text-muted-foreground py-10 text-sm">{t("acc.client.empty")}</p>
      ) : (
        <div className="space-y-2">
          {ledgers.map(l => (
            <Card key={l.id} className="glass-card overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                <div>
                  <p className="font-semibold text-sm">{l.clientName}</p>
                  <p className="text-xs text-muted-foreground">{l.matterRef ?? t("acc.client.noMatter")}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-base font-bold ${l.balance > 0 ? "text-emerald-700" : l.balance === 0 ? "text-muted-foreground" : "text-red-700"}`}>{MYR(l.balance)}</span>
                  {expanded === l.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {expanded === l.id && (
                <div className="border-t border-border/50 p-4 bg-muted/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{t("acc.client.balance")}: <span className={`font-bold ${(currentLedger?.balance ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{MYR(currentLedger?.balance ?? l.balance)}</span></p>
                    <Dialog open={addEntryOpen} onOpenChange={setAddEntryOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs"><Plus className="w-3 h-3" /> {t("acc.client.addEntry")}</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t("acc.client.addEntry")} — {l.clientName}</DialogTitle>
                          <DialogDescription>Record a deposit, disbursement, or transfer to office for this client trust account.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 pt-1">
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.type")}</Label>
                            <Select value={entryForm.type} onValueChange={v => setEntryForm(f => ({ ...f, type: v as typeof entryForm.type }))}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="deposit">{t("acc.client.deposit")}</SelectItem>
                                <SelectItem value="disbursement">{t("acc.client.disbursement")}</SelectItem>
                                <SelectItem value="transfer_to_office">{t("acc.client.transfer")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.description")}</Label>
                            <Textarea value={entryForm.description} onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))} className="h-14 text-sm resize-none" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.amount")} (RM)</Label>
                              <Input type="number" min="0.01" step="0.01" value={entryForm.amount} onChange={e => setEntryForm(f => ({ ...f, amount: e.target.value }))} className="h-8 text-sm" />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.date")}</Label>
                              <Input type="date" value={entryForm.entryDate} onChange={e => setEntryForm(f => ({ ...f, entryDate: e.target.value }))} className="h-8 text-sm" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold uppercase tracking-wide">{t("acc.reference")} ({t("acc.optional")})</Label>
                            <Input value={entryForm.reference} onChange={e => setEntryForm(f => ({ ...f, reference: e.target.value }))} className="h-8 text-sm" />
                          </div>
                          {entryForm.type !== "deposit" && (
                            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{t("acc.client.negativeWarn")} {MYR(currentLedger?.balance ?? l.balance)}.</p>
                          )}
                          <Button className="w-full" disabled={!entryForm.description || !entryForm.amount || !entryForm.entryDate || addEntry.isPending} onClick={() => addEntry.mutate()}>
                            {addEntry.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null} {t("acc.save")}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>

                  {entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">{t("acc.client.noEntries")}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {entries.map(e => (
                        <div key={e.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${e.type === "deposit" ? "bg-emerald-100" : e.type === "disbursement" ? "bg-red-100" : "bg-amber-100"}`}>
                            {e.type === "deposit" ? <ArrowDownLeft className="w-3 h-3 text-emerald-700" /> : e.type === "disbursement" ? <ArrowUpRight className="w-3 h-3 text-red-700" /> : <ArrowRightLeft className="w-3 h-3 text-amber-700" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{e.description}</p>
                            <p className="text-xs text-muted-foreground">{e.entryDate}{e.reference ? ` · ${e.reference}` : ""}</p>
                          </div>
                          <Badge variant="outline" className={`text-xs shrink-0 ${ENTRY_BG[e.type]}`}>{t(`acc.client.${e.type}`)}</Badge>
                          <span className={`text-sm font-bold shrink-0 ${ENTRY_COLORS[e.type]}`}>{e.type === "deposit" ? "+" : "-"}{MYR(e.amount)}</span>
                          <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 text-muted-foreground shrink-0" onClick={() => downloadVoucher(e.id, e.type)}>
                            <Download className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REPORTS TAB
// ══════════════════════════════════════════════════════════════════════════════

function ReportsTab() {
  const t = useT();
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [expMonth, setExpMonth] = useState<number | "">(now.getMonth() + 1);
  const [subTab, setSubTab] = useState<"pl"|"expenses"|"trust"|"cashflow">("pl");
  const [xlsxExporting, setXlsxExporting] = useState(false);

  const { data: plData, isLoading: plLoading } = useQuery({
    queryKey: ["acc-pl", year],
    queryFn:  () => apiJson<{ year: string; pl: PlRow[]; totalIncome: number; totalExpense: number; netProfit: number }>(`/accounts/reports/pl?year=${year}`),
    enabled:  subTab === "pl",
  });

  const expQuery = expMonth !== ""
    ? `/accounts/reports/expenses?year=${year}&month=${expMonth}`
    : `/accounts/reports/expenses?year=${year}`;

  const { data: expData, isLoading: expLoading } = useQuery({
    queryKey: ["acc-exp", year, expMonth],
    queryFn:  () => apiJson<{ breakdown: ExpenseBreakdown[]; grandTotal: number }>(expQuery),
    enabled:  subTab === "expenses",
  });

  const { data: trustData, isLoading: trustLoading } = useQuery({
    queryKey: ["acc-trust"],
    queryFn:  () => apiJson<{ ledgers: ClientLedger[]; totalBalance: number }>("/accounts/reports/trust"),
    enabled:  subTab === "trust",
  });

  const { data: cfData, isLoading: cfLoading } = useQuery({
    queryKey: ["acc-cf"],
    queryFn:  () => apiJson<{ cashflow: CashflowRow[] }>("/accounts/reports/cashflow?months=12"),
    enabled:  subTab === "cashflow",
  });

  const dlPdf = async (path: string, filename: string) => {
    const resp = await api(path);
    if (!resp.ok) { toast({ variant: "destructive", description: "Download failed." }); return; }
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  };

  const handleExportExcel = async () => {
    if (xlsxExporting) return;
    setXlsxExporting(true);
    try {
      const [plResp, expResp, trustResp] = await Promise.all([
        apiJson<{ year: string; pl: PlRow[]; totalIncome: number; totalExpense: number; netProfit: number }>(`/accounts/reports/pl?year=${year}`),
        apiJson<{ breakdown: ExpenseBreakdown[]; grandTotal: number }>(`/accounts/reports/expenses?year=${year}`),
        apiJson<{ ledgers: ClientLedger[]; totalBalance: number }>("/accounts/reports/trust"),
      ]);

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "MyLawFirmAI";

      const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF002147" } };
      const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" } };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const applyHeader = (sheet: any) => {
        const row = sheet.getRow(1);
        row.font = HEADER_FONT;
        row.fill = HEADER_FILL;
        row.alignment = { vertical: "middle" };
      };

      // Sheet 1: P&L by Month
      const plSheet = workbook.addWorksheet(`P&L ${year}`, { views: [{ state: "frozen", ySplit: 1 }] });
      plSheet.columns = [
        { header: "Month",        width: 18 },
        { header: "Income (RM)",  width: 18 },
        { header: "Expense (RM)", width: 18 },
        { header: "Net (RM)",     width: 16 },
      ];
      applyHeader(plSheet);
      const fmtM = (m: string) => { const idx = parseInt(m.slice(5)) - 1; return (MONTHS[idx] ?? m) + " " + year; };
      for (const row of plResp.pl) plSheet.addRow([fmtM(row.month), row.income, row.expense, row.net]);
      const plTotalRow = plSheet.addRow(["TOTAL", plResp.totalIncome, plResp.totalExpense, plResp.netProfit]);
      plTotalRow.font = { bold: true };

      // Sheet 2: Expense Breakdown
      const expSheet = workbook.addWorksheet("Expense Breakdown", { views: [{ state: "frozen", ySplit: 1 }] });
      expSheet.columns = [
        { header: "Category",   width: 32 },
        { header: "Total (RM)", width: 18 },
        { header: "% of Total", width: 14 },
      ];
      applyHeader(expSheet);
      for (const row of expResp.breakdown) {
        expSheet.addRow([
          row.category.replace(/_/g, " ").replace(/\b\w/g, x => x.toUpperCase()),
          row.total,
          expResp.grandTotal > 0 ? parseFloat(((row.total / expResp.grandTotal) * 100).toFixed(1)) : 0,
        ]);
      }
      const expTotalRow = expSheet.addRow(["GRAND TOTAL", expResp.grandTotal, 100]);
      expTotalRow.font = { bold: true };

      // Sheet 3: Trust Balances
      const trustSheet = workbook.addWorksheet("Trust Balances", { views: [{ state: "frozen", ySplit: 1 }] });
      trustSheet.columns = [
        { header: "Client Name",  width: 32 },
        { header: "Matter Ref",   width: 22 },
        { header: "Balance (RM)", width: 18 },
      ];
      applyHeader(trustSheet);
      for (const l of trustResp.ledgers) trustSheet.addRow([l.clientName, l.matterRef ?? "", l.balance]);
      const trustTotalRow = trustSheet.addRow(["TOTAL TRUST", "", trustResp.totalBalance]);
      trustTotalRow.font = { bold: true };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `accounts-report-${year}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    } catch {
      toast({ variant: "destructive", description: "Excel export failed." });
    } finally {
      setXlsxExporting(false);
    }
  };

  const downloadPL         = () => dlPdf(`/accounts/reports/pl/pdf?year=${year}`, `pl-report-${year}.pdf`);
  const downloadExpenses   = () => dlPdf(`/accounts/reports/expenses/pdf?year=${year}`, `expenses-${year}.pdf`);
  const downloadTrust      = () => dlPdf(`/accounts/reports/trust/pdf`, `trust-balances-${new Date().toISOString().slice(0,10)}.pdf`);
  const downloadCashflow   = () => dlPdf(`/accounts/reports/cashflow/pdf?months=12`, `cashflow-12m.pdf`);

  const fmtMonth = (m: string) => {
    const idx = parseInt(m.slice(5)) - 1;
    return MONTHS[idx] ?? m;
  };

  const isLoading = plLoading || expLoading || trustLoading || cfLoading;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {(["pl","expenses","trust","cashflow"] as const).map(s => (
          <Button key={s} size="sm" variant={subTab === s ? "default" : "outline"} onClick={() => setSubTab(s)}>
            {t(`acc.report.${s}`)}
          </Button>
        ))}
        {(subTab === "pl" || subTab === "expenses") && (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {subTab === "expenses" && (
              <>
                <Label className="text-xs">{t("acc.month")}</Label>
                <Select value={String(expMonth)} onValueChange={v => setExpMonth(v === "" ? "" : parseInt(v))}>
                  <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All months</SelectItem>
                    {MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
            <Label className="text-xs">{t("acc.year")}</Label>
            <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-24 h-8 text-sm" />
          </div>
        )}
        {subTab === "pl" && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadPL}>
            <Download className="w-3.5 h-3.5" /> {t("acc.report.downloadPl")}
          </Button>
        )}
        <Button size="sm" variant="outline" className="gap-1.5" disabled={xlsxExporting} onClick={handleExportExcel}>
          {xlsxExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          {xlsxExporting ? "Preparing…" : "Download Excel"}
        </Button>
        {subTab === "expenses" && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadExpenses}>
            <Download className="w-3.5 h-3.5" /> {t("acc.report.downloadPdf")}
          </Button>
        )}
        {subTab === "trust" && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadTrust}>
            <Download className="w-3.5 h-3.5" /> {t("acc.report.downloadPdf")}
          </Button>
        )}
        {subTab === "cashflow" && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadCashflow}>
            <Download className="w-3.5 h-3.5" /> {t("acc.report.downloadPdf")}
          </Button>
        )}
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}

      {/* P&L Chart */}
      {subTab === "pl" && !plLoading && plData && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Card className="glass-card"><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{t("acc.income")}</p><p className="text-2xl font-bold text-emerald-700">{MYR(plData.totalIncome)}</p></CardContent></Card>
            <Card className="glass-card"><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{t("acc.expense")}</p><p className="text-2xl font-bold text-red-700">{MYR(plData.totalExpense)}</p></CardContent></Card>
            <Card className="glass-card"><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{t("acc.netProfit")}</p><p className={`text-2xl font-bold ${plData.netProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{MYR(plData.netProfit)}</p></CardContent></Card>
          </div>
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base">{t("acc.report.pl")} — {year}</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={plData.pl} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="month" tickFormatter={fmtMonth} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <RechartsTip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12 }} formatter={(v: number) => [MYR(v), ""]} />
                  <Bar dataKey="income"  name={t("acc.income")}  fill="#2e7d32" radius={[4,4,0,0]} />
                  <Bar dataKey="expense" name={t("acc.expense")} fill="#c62828" radius={[4,4,0,0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          {/* Monthly table */}
          <Card className="glass-card">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="text-left py-2 px-4 font-semibold">{t("acc.month")}</th>
                    <th className="text-right py-2 px-4 font-semibold text-emerald-700">{t("acc.income")}</th>
                    <th className="text-right py-2 px-4 font-semibold text-red-700">{t("acc.expense")}</th>
                    <th className="text-right py-2 px-4 font-semibold">{t("acc.net")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {plData.pl.map(row => (
                    <tr key={row.month} className="hover:bg-muted/20">
                      <td className="py-2 px-4 font-medium">{fmtMonth(row.month)} {year}</td>
                      <td className="py-2 px-4 text-right text-emerald-700">{row.income > 0 ? MYR(row.income) : "—"}</td>
                      <td className="py-2 px-4 text-right text-red-700">{row.expense > 0 ? MYR(row.expense) : "—"}</td>
                      <td className={`py-2 px-4 text-right font-semibold ${row.net >= 0 ? "text-emerald-700" : "text-red-700"}`}>{row.net !== 0 ? MYR(row.net) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Expense breakdown */}
      {subTab === "expenses" && !expLoading && expData && (
        <div className="space-y-4">
          <Card className="glass-card"><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{t("acc.report.totalExpenses")}</p><p className="text-2xl font-bold text-red-700">{MYR(expData.grandTotal)}</p></CardContent></Card>
          {expData.breakdown.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">{t("acc.report.noExpenses")}</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pie chart */}
                <Card className="glass-card">
                  <CardHeader><CardTitle className="text-base">{t("acc.report.expenses")}</CardTitle></CardHeader>
                  <CardContent className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={expData.breakdown} dataKey="total" nameKey="category" outerRadius={90} label={({ name, percent }) => `${name.replace(/_/g," ").slice(0,12)} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                          {expData.breakdown.map((row, i) => <Cell key={i} fill={row.overBudget ? "#c62828" : PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <RechartsTip formatter={(v: number) => [MYR(v), ""]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                {/* Budget vs Actual bar chart — only shown when a month is selected and budgets exist */}
                {expMonth !== "" && expData.breakdown.some(r => r.budget != null) ? (
                  <Card className="glass-card">
                    <CardHeader><CardTitle className="text-base">{t("acc.budget.actual")} {t("acc.budget.vs")}</CardTitle></CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={expData.breakdown.filter(r => r.budget != null).map(r => ({
                            name: r.category.replace(/_/g," ").replace(/\b\w/g, x => x.toUpperCase()).slice(0, 14),
                            actual: r.total,
                            budget: r.budget,
                            over:   r.overBudget,
                          }))}
                          margin={{ top: 5, right: 10, left: 0, bottom: 40 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                          <RechartsTip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12 }} formatter={(v: number) => [MYR(v), ""]} />
                          <Bar dataKey="actual" name={t("acc.budget.actual")} radius={[4,4,0,0]}>
                            {expData.breakdown.filter(r => r.budget != null).map((row, i) => (
                              <Cell key={i} fill={row.overBudget ? "#c62828" : "#1565c0"} />
                            ))}
                          </Bar>
                          <Bar dataKey="budget" name={t("acc.budget.budget")} fill="#9e9e9e" radius={[4,4,0,0]} opacity={0.4} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ) : (
                  /* Fallback: category table */
                  <Card className="glass-card">
                    <CardContent className="p-0 overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                            <th className="text-left py-2 px-4 font-semibold">{t("acc.category")}</th>
                            <th className="text-right py-2 px-4 font-semibold">{t("acc.amount")}</th>
                            <th className="text-right py-2 px-4 font-semibold">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {expData.breakdown.map((row, i) => (
                            <tr key={row.category} className="hover:bg-muted/20">
                              <td className="py-2 px-4 flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                                {row.category.replace(/_/g," ").replace(/\b\w/g, x => x.toUpperCase())}
                              </td>
                              <td className="py-2 px-4 text-right font-semibold text-red-700">{MYR(row.total)}</td>
                              <td className="py-2 px-4 text-right text-muted-foreground">{expData.grandTotal > 0 ? ((row.total / expData.grandTotal) * 100).toFixed(1) : "0"}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                )}
              </div>
              {/* Full category table with budget column (always shown when month selected) */}
              {expMonth !== "" && (
                <Card className="glass-card">
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                          <th className="text-left py-2 px-4 font-semibold">{t("acc.category")}</th>
                          <th className="text-right py-2 px-4 font-semibold">{t("acc.budget.actual")}</th>
                          <th className="text-right py-2 px-4 font-semibold">{t("acc.budget.budget")}</th>
                          <th className="text-right py-2 px-4 font-semibold">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                        {expData.breakdown.map((row, i) => (
                          <tr key={row.category} className={`hover:bg-muted/20 ${row.overBudget ? "bg-red-50/60" : ""}`}>
                            <td className="py-2 px-4 flex items-center gap-2">
                              {row.overBudget
                                ? <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                : <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />}
                              <span className={row.overBudget ? "font-semibold text-red-700" : ""}>
                                {row.category.replace(/_/g," ").replace(/\b\w/g, x => x.toUpperCase())}
                              </span>
                              {row.overBudget && <Badge className="ml-1 bg-red-100 text-red-700 border-red-300 text-xs py-0">{t("acc.budget.overLimit")}</Badge>}
                            </td>
                            <td className={`py-2 px-4 text-right font-semibold ${row.overBudget ? "text-red-700" : "text-foreground"}`}>{MYR(row.total)}</td>
                            <td className="py-2 px-4 text-right text-muted-foreground">
                              {row.budget != null ? MYR(row.budget) : <span className="text-xs italic">{t("acc.budget.noBudget")}</span>}
                            </td>
                            <td className="py-2 px-4 text-right text-muted-foreground">{expData.grandTotal > 0 ? ((row.total / expData.grandTotal) * 100).toFixed(1) : "0"}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trust balances */}
      {subTab === "trust" && !trustLoading && trustData && (
        <div className="space-y-4">
          <Card className="glass-card"><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-muted-foreground mb-1">{t("acc.report.totalTrust")}</p><p className="text-2xl font-bold text-emerald-700">{MYR(trustData.totalBalance)}</p></CardContent></Card>
          {trustData.ledgers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">{t("acc.client.empty")}</p>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                      <th className="text-left py-2 px-4 font-semibold">{t("acc.client.name")}</th>
                      <th className="text-left py-2 px-4 font-semibold">{t("acc.client.matterRef")}</th>
                      <th className="text-right py-2 px-4 font-semibold">{t("acc.client.balance")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {trustData.ledgers.map(l => (
                      <tr key={l.id} className="hover:bg-muted/20">
                        <td className="py-2 px-4 font-semibold">{l.clientName}</td>
                        <td className="py-2 px-4 text-muted-foreground">{l.matterRef ?? "—"}</td>
                        <td className={`py-2 px-4 text-right font-bold ${l.balance > 0 ? "text-emerald-700" : "text-muted-foreground"}`}>{MYR(l.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Cashflow */}
      {subTab === "cashflow" && !cfLoading && cfData && (
        <div className="space-y-4">
          {cfData.cashflow.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">{t("acc.report.noCashflow")}</p>
          ) : (
            <Card className="glass-card">
              <CardHeader><CardTitle className="text-base">{t("acc.report.cashflow")} — {t("acc.report.last12")}</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cfData.cashflow} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                    <XAxis dataKey="month" tickFormatter={fmtMonth} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <RechartsTip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.75rem", fontSize: 12 }} formatter={(v: number) => [MYR(v), ""]} />
                    <Line type="monotone" dataKey="net"        name={t("acc.net")}        stroke="#1565c0" strokeWidth={3} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="cumulative" name={t("acc.report.cumulative")} stroke="#2e7d32" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    <Legend />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function AccountsPage() {
  const t = useT();
  const { isManager } = useAuth();
  if (!isManager) return <Redirect to="/urgent" />;

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground jewel-gradient-text drop-shadow-sm">
            {t("acc.title")}
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">{t("acc.subtitle")}</p>
        </header>

        <Tabs defaultValue="office" className="space-y-4">
          <TabsList className="flex flex-wrap gap-1 h-auto">
            <TabsTrigger value="office"  className="gap-1.5"><Landmark className="w-3.5 h-3.5" />{t("acc.tab.office")}</TabsTrigger>
            <TabsTrigger value="client"  className="gap-1.5"><Users className="w-3.5 h-3.5" />{t("acc.tab.client")}</TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5"><BarChart2 className="w-3.5 h-3.5" />{t("acc.tab.reports")}</TabsTrigger>
          </TabsList>
          <TabsContent value="office"><OfficeLedgerTab /></TabsContent>
          <TabsContent value="client"><ClientLedgerTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
