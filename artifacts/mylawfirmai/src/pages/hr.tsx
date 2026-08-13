import { useState } from "react";
import { Redirect } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, CalendarDays, Clock, DollarSign, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Download, Plus, UserCheck, FileText, Loader2,
} from "lucide-react";

// ── API helpers ────────────────────────────────────────────────────────────────

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/firm${path}`, { credentials: "include", ...init });

const apiJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const r = await api(path, init);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error((err as Record<string, string>).error ?? r.statusText);
  }
  return r.json() as Promise<T>;
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const LEAVE_TYPES = ["annual","medical","maternity","paternity","unpaid"] as const;
type LeaveType = typeof LEAVE_TYPES[number];

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800 border-amber-200",
  approved:  "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected:  "bg-red-100 text-red-800 border-red-200",
  draft:     "bg-slate-100 text-slate-700 border-slate-200",
  finalised: "bg-blue-100 text-blue-800 border-blue-200",
};

const ATT_COLORS: Record<string, string> = {
  present:  "bg-emerald-500",
  absent:   "bg-red-400",
  leave:    "bg-amber-400",
  half_day: "bg-sky-400",
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface HrProfile {
  userId: number; icNumber?: string; position?: string; department?: string;
  employmentType: string; employmentStart?: string; employmentEnd?: string;
  salary: number; epfNumber?: string; socsoNumber?: string; pcbNumber?: string;
  bankName?: string; bankAccount?: string; emergencyName?: string;
  emergencyPhone?: string; notes?: string;
}
interface User { id: number; name: string; email: string; title: string | null; activeStatus: boolean; }
interface LeaveRequest {
  id: number; userId: number; userName: string; leaveType: string;
  startDate: string; endDate: string; daysRequested: number; reason?: string;
  status: string; managerNotes?: string; createdAt: string;
}
interface LeaveBalance { id: number; userId: number; userName: string; year: number; leaveType: string; entitlement: number; used: number; }
interface AttRecord { id: number; userId: number; userName: string; workDate: string; status: string; clockIn?: string; clockOut?: string; }
interface PayrollRun { id: number; month: number; year: number; status: string; createdAt: string; }
interface Payslip {
  id: number; runId: number; userId: number; userName: string;
  grossSalary: number; epfEmployee: number; epfEmployer: number;
  socsoEmployee: number; socsoEmployer: number; eisEmployee: number;
  eisEmployer: number; pcb: number; totalDeductions: number; netPay: number;
}

const rm = (n: number) => `RM ${n.toFixed(2)}`;

// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEES TAB
// ══════════════════════════════════════════════════════════════════════════════

function EmployeesTab() {
  const t = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<HrProfile>>({});
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: () => apiJson<{ employees: { user: User; profile: HrProfile | null }[] }>("/hr/employees"),
  });

  const save = useMutation({
    mutationFn: ({ userId, body }: { userId: number; body: Partial<HrProfile> }) =>
      apiJson(`/hr/employees/${userId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => {
      toast({ description: t("hr.emp.saved") });
      qc.invalidateQueries({ queryKey: ["hr-employees"] });
      setDirty(false);
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const expandEmployee = (userId: number, profile: HrProfile | null) => {
    if (expanded === userId) { setExpanded(null); return; }
    setExpanded(userId);
    setForm(profile ?? { salary: 0, employmentType: "full_time" });
    setDirty(false);
  };

  const setField = (k: keyof HrProfile, v: string | number) => {
    setForm(f => ({ ...f, [k]: v }));
    setDirty(true);
  };

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      {(data?.employees ?? []).map(({ user, profile }) => (
        <Card key={user.id} className="glass-card overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors text-left"
            onClick={() => expandEmployee(user.id, profile)}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {profile?.position ?? user.title ?? "—"} {profile?.department ? `· ${profile.department}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {profile ? (
                <span className="text-sm font-semibold text-emerald-700">{rm(profile.salary)}<span className="text-xs text-muted-foreground font-normal">/mo</span></span>
              ) : (
                <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">{t("hr.emp.noProfile")}</Badge>
              )}
              {expanded === user.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          {expanded === user.id && (
            <div className="border-t border-border/50 p-4 bg-muted/10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {([
                  ["position", "hr.emp.position", "text"],
                  ["department", "hr.emp.department", "text"],
                  ["icNumber", "hr.emp.icNumber", "text"],
                  ["epfNumber", "hr.emp.epfNumber", "text"],
                  ["socsoNumber", "hr.emp.socsoNumber", "text"],
                  ["pcbNumber", "hr.emp.pcbNumber", "text"],
                  ["bankName", "hr.emp.bank", "text"],
                  ["bankAccount", "hr.emp.bankAccount", "text"],
                  ["emergencyName", "hr.emp.emergencyName", "text"],
                  ["emergencyPhone", "hr.emp.emergencyPhone", "text"],
                  ["employmentStart", "hr.emp.startDate", "date"],
                  ["employmentEnd", "hr.emp.endDate", "date"],
                ] as [keyof HrProfile, string, string][]).map(([key, label, type]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t(label)}</Label>
                    <Input
                      type={type}
                      value={String(form[key] ?? "")}
                      onChange={e => setField(key, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("hr.emp.salary")}</Label>
                  <Input type="number" min={0} step={100} value={form.salary ?? 0} onChange={e => setField("salary", parseFloat(e.target.value) || 0)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("hr.emp.type")}</Label>
                  <Select value={form.employmentType ?? "full_time"} onValueChange={v => setField("employmentType", v)}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["full_time","part_time","contract"] as const).map(v => (
                        <SelectItem key={v} value={v}>{t(`hr.emp.type.${v}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 lg:col-span-3 space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("hr.emp.notes")}</Label>
                  <Textarea value={form.notes ?? ""} onChange={e => setField("notes", e.target.value)} className="text-sm resize-none h-16" />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate({ userId: user.id, body: form })}>
                  {save.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
                  {t("hr.emp.save")}
                </Button>
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LEAVE TAB
// ══════════════════════════════════════════════════════════════════════════════

function LeaveTab() {
  const t = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<"pending"|"all"|"balances"|"entitlement">("pending");
  const [year, setYear] = useState(new Date().getFullYear());
  const [entForm, setEntForm] = useState({ userId: "", leaveType: "annual" as LeaveType, entitlement: "" });
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});

  // Separate queries so TypeScript can infer a single concrete response shape per query.
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["hr-leave-requests", subTab],
    queryFn: () => {
      const params = subTab === "pending" ? "?status=pending" : "";
      return apiJson<{ requests: LeaveRequest[] }>(`/hr/leave${params}`);
    },
    enabled: subTab === "pending" || subTab === "all",
  });

  const { data: balancesData, isLoading: balancesLoading } = useQuery({
    queryKey: ["hr-leave-balances", year],
    queryFn: () => apiJson<{ balances: LeaveBalance[] }>(`/hr/leave/balances?year=${year}`),
    enabled: subTab === "balances" || subTab === "entitlement",
  });

  const isLoading = requestsLoading || balancesLoading;

  const { data: empData } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: () => apiJson<{ employees: { user: User; profile: HrProfile | null }[] }>("/hr/employees"),
  });

  const review = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      apiJson(`/hr/leave/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, managerNotes: notes }) }),
    onSuccess: () => { toast({ description: t("hr.leave.reviewed") }); qc.invalidateQueries({ queryKey: ["hr-leave-requests"] }); qc.invalidateQueries({ queryKey: ["hr-leave-balances"] }); },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const saveEnt = useMutation({
    mutationFn: () => apiJson("/hr/leave/entitlements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: parseInt(entForm.userId), leaveType: entForm.leaveType, year, entitlement: parseFloat(entForm.entitlement) }) }),
    onSuccess: () => { toast({ description: t("hr.entitlement.saved") }); qc.invalidateQueries({ queryKey: ["hr-leave-balances"] }); setEntForm(f => ({ ...f, userId: "", entitlement: "" })); },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const requests = requestsData?.requests ?? [];
  const balances  = balancesData?.balances  ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["pending","all","balances","entitlement"] as const).map(s => (
          <Button key={s} variant={subTab === s ? "default" : "outline"} size="sm" onClick={() => setSubTab(s)}>
            {t(`hr.leave.${s === "entitlement" ? "setEntitlement" : s}`)}
          </Button>
        ))}
        {(subTab === "balances" || subTab === "entitlement") && (
          <div className="flex items-center gap-1 ml-auto">
            <Label className="text-xs">{t("hr.leave.year")}</Label>
            <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-24 h-8 text-sm" />
          </div>
        )}
      </div>

      {(subTab === "pending" || subTab === "all") && (
        isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> :
        requests.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">{t("hr.leave.empty.pending")}</p>
        ) : (
          <div className="space-y-2">
            {requests.map(r => (
              <Card key={r.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{r.userName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t(`hr.leave.type.${r.leaveType}`)} · {r.startDate} → {r.endDate} · {r.daysRequested} {t("hr.leave.days")}
                      </p>
                      {r.reason && <p className="text-xs text-foreground/70 mt-1 italic">"{r.reason}"</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${STATUS_COLORS[r.status] ?? ""}`}>{t(`hr.leave.status.${r.status}`)}</Badge>
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => review.mutate({ id: r.id, status: "approved", notes: reviewNotes[r.id] })}>
                            <CheckCircle2 className="w-3 h-3" /> {t("hr.leave.approve")}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50"
                            onClick={() => review.mutate({ id: r.id, status: "rejected", notes: reviewNotes[r.id] })}>
                            <XCircle className="w-3 h-3" /> {t("hr.leave.reject")}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {r.status === "pending" && (
                    <Input
                      placeholder={t("hr.leave.managerNotes")}
                      className="mt-2 h-7 text-xs"
                      value={reviewNotes[r.id] ?? ""}
                      onChange={e => setReviewNotes(n => ({ ...n, [r.id]: e.target.value }))}
                    />
                  )}
                  {r.managerNotes && <p className="text-xs text-muted-foreground mt-1">📝 {r.managerNotes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}

      {subTab === "balances" && (
        isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> :
        balances.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">No leave entitlements set for {year}.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-4 font-semibold">{t("hr.emp.name")}</th>
                  <th className="text-left py-2 pr-4 font-semibold">Leave Type</th>
                  <th className="text-right py-2 pr-4 font-semibold">{t("hr.leave.entitlement")}</th>
                  <th className="text-right py-2 pr-4 font-semibold">{t("hr.leave.used")}</th>
                  <th className="text-right py-2 font-semibold">{t("hr.leave.remaining")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {balances.map(b => (
                  <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2 pr-4 font-medium">{b.userName}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{t(`hr.leave.type.${b.leaveType}`)}</td>
                    <td className="py-2 pr-4 text-right">{b.entitlement}</td>
                    <td className="py-2 pr-4 text-right text-amber-700">{b.used}</td>
                    <td className="py-2 text-right font-semibold text-emerald-700">{Math.max(0, b.entitlement - b.used)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {subTab === "entitlement" && (
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">{t("hr.leave.setEntitlement")} — {year}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide">{t("hr.emp.name")}</Label>
              <Select value={entForm.userId} onValueChange={v => setEntForm(f => ({ ...f, userId: v }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select employee…" /></SelectTrigger>
                <SelectContent>
                  {(empData?.employees ?? []).map(({ user }) => (
                    <SelectItem key={user.id} value={String(user.id)}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide">Leave Type</Label>
              <Select value={entForm.leaveType} onValueChange={v => setEntForm(f => ({ ...f, leaveType: v as LeaveType }))}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map(lt => <SelectItem key={lt} value={lt}>{t(`hr.leave.type.${lt}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide">{t("hr.leave.entitlement")} ({t("hr.leave.days")})</Label>
              <Input type="number" min={0} step={0.5} value={entForm.entitlement} onChange={e => setEntForm(f => ({ ...f, entitlement: e.target.value }))} className="h-8 text-sm" />
            </div>
            <Button size="sm" disabled={!entForm.userId || !entForm.entitlement || saveEnt.isPending} onClick={() => saveEnt.mutate()}>
              {saveEnt.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
              {t("hr.leave.setEntitlement")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ATTENDANCE TAB
// ══════════════════════════════════════════════════════════════════════════════

function AttendanceTab() {
  const t = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ["hr-attendance", month, year],
    queryFn: () => apiJson<{ records: AttRecord[] }>(`/hr/attendance?month=${month}&year=${year}`),
  });

  const { data: empData } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: () => apiJson<{ employees: { user: User; profile: HrProfile | null }[] }>("/hr/employees"),
  });

  const mark = useMutation({
    mutationFn: (body: { userId: number; workDate: string; status: string }) =>
      apiJson("/hr/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSuccess: () => { toast({ description: t("hr.att.saved") }); qc.invalidateQueries({ queryKey: ["hr-attendance"] }); },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const records = data?.records ?? [];
  const recMap = new Map(records.map(r => [`${r.userId}-${r.workDate}`, r]));
  const employees = empData?.employees ?? [];

  const statuses = ["present","absent","leave","half_day"] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} className="w-24 h-8 text-sm" />
        <div className="flex gap-2 ml-auto">
          {statuses.map(s => (
            <span key={s} className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={`w-3 h-3 rounded-sm ${ATT_COLORS[s]}`} />
              {t(`hr.att.status.${s}`)}
            </span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : employees.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">{t("hr.att.noRecords")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse min-w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-3 font-semibold text-muted-foreground uppercase tracking-wide min-w-[120px]">{t("hr.emp.name")}</th>
                {days.map(d => {
                  const dow = new Date(year, month - 1, d).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <th key={d} className={`text-center py-2 px-1 w-8 font-semibold ${isWeekend ? "text-muted-foreground/40" : "text-muted-foreground"}`}>{d}</th>
                  );
                })}
                <th className="text-right py-2 pl-3 font-semibold text-muted-foreground uppercase tracking-wide">Present</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {employees.map(({ user }) => {
                const presentCount = days.filter(d => {
                  const date = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                  return recMap.get(`${user.id}-${date}`)?.status === "present";
                }).length;
                return (
                  <tr key={user.id} className="hover:bg-muted/10">
                    <td className="py-1.5 pr-3 font-medium text-foreground">{user.name}</td>
                    {days.map(d => {
                      const date = `${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
                      const rec  = recMap.get(`${user.id}-${date}`);
                      const dow  = new Date(year, month - 1, d).getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      return (
                        <td key={d} className="text-center px-0.5 py-1">
                          <button
                            disabled={isWeekend}
                            title={rec ? t(`hr.att.status.${rec.status}`) : "Unset"}
                            className={`w-6 h-6 rounded-sm transition-all hover:ring-2 hover:ring-primary/50 ${
                              rec ? ATT_COLORS[rec.status] ?? "bg-muted" : isWeekend ? "bg-muted/20" : "bg-muted/40 hover:bg-muted/60"
                            }`}
                            onClick={() => {
                              const nextStatuses = ["present","absent","leave","half_day"];
                              const cur = rec?.status ?? "";
                              const ni  = nextStatuses.indexOf(cur);
                              const next = nextStatuses[(ni + 1) % nextStatuses.length];
                              mark.mutate({ userId: user.id, workDate: date, status: next });
                            }}
                          />
                        </td>
                      );
                    })}
                    <td className="text-right pl-3 font-semibold text-emerald-700">{presentCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAYROLL TAB
// ══════════════════════════════════════════════════════════════════════════════

function PayrollTab() {
  const t = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();
  const [runMonth, setRunMonth] = useState(now.getMonth() + 1);
  const [runYear, setRunYear] = useState(now.getFullYear());
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [showRunForm, setShowRunForm] = useState(false);

  const { data: runsData, isLoading } = useQuery({
    queryKey: ["hr-payroll-runs"],
    queryFn: () => apiJson<{ runs: PayrollRun[] }>("/hr/payroll/runs"),
  });

  const { data: slipsData, isLoading: slipsLoading } = useQuery({
    queryKey: ["hr-payroll-slips", selectedRun?.id],
    queryFn: () => apiJson<{ payslips: Payslip[] }>(`/hr/payroll/runs/${selectedRun!.id}/payslips`),
    enabled: !!selectedRun,
  });

  const runPayroll = useMutation({
    mutationFn: () => apiJson("/hr/payroll/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: runMonth, year: runYear }) }),
    onSuccess: () => {
      toast({ description: t("hr.pay.runSuccess") });
      qc.invalidateQueries({ queryKey: ["hr-payroll-runs"] });
      setShowRunForm(false);
    },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const downloadPDF = async (slipId: number) => {
    const resp = await api(`/hr/payroll/payslips/${slipId}/pdf`);
    if (!resp.ok) { toast({ variant: "destructive", description: "Download failed." }); return; }
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payslip-${slipId}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  };

  const runs = runsData?.runs ?? [];
  const payslips = slipsData?.payslips ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">{t("hr.pay.runs")}</h3>
        <Button size="sm" className="gap-1.5" onClick={() => setShowRunForm(v => !v)}>
          <Plus className="w-3.5 h-3.5" /> {t("hr.pay.runPayroll")}
        </Button>
      </div>

      {showRunForm && (
        <Card className="glass-card">
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide">{t("hr.pay.month")}</Label>
              <Select value={String(runMonth)} onValueChange={v => setRunMonth(parseInt(v))}>
                <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide">{t("hr.pay.year")}</Label>
              <Input type="number" value={runYear} onChange={e => setRunYear(parseInt(e.target.value))} className="w-24 h-8 text-sm" />
            </div>
            <Button size="sm" disabled={runPayroll.isPending} onClick={() => runPayroll.mutate()}>
              {runPayroll.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null}
              {t("hr.pay.runPayroll")}
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : runs.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">{t("hr.pay.noRuns")}</p>
      ) : (
        <div className="space-y-2">
          {runs.map(run => (
            <Card key={run.id} className={`glass-card cursor-pointer transition-all ${selectedRun?.id === run.id ? "ring-2 ring-primary" : "hover:bg-muted/30"}`} onClick={() => setSelectedRun(selectedRun?.id === run.id ? null : run)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{MONTHS[run.month - 1]} {run.year}</p>
                  <p className="text-xs text-muted-foreground">{new Date(run.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${STATUS_COLORS[run.status] ?? ""}`}>{t(`hr.pay.status.${run.status}`)}</Badge>
                  <Button size="sm" variant="ghost" className="text-xs h-7 gap-1" onClick={e => { e.stopPropagation(); setSelectedRun(run); }}>
                    <FileText className="w-3 h-3" /> {t("hr.pay.viewSlips")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedRun && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">{t("hr.pay.payslips")} — {MONTHS[selectedRun.month - 1]} {selectedRun.year}</CardTitle>
          </CardHeader>
          <CardContent>
            {slipsLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-xs uppercase text-muted-foreground border-b border-border">
                      <th className="text-left py-2 pr-4 font-semibold">{t("hr.pay.employee")}</th>
                      <th className="text-right py-2 pr-3 font-semibold">{t("hr.pay.gross")}</th>
                      <th className="text-right py-2 pr-3 font-semibold">{t("hr.pay.epf")}</th>
                      <th className="text-right py-2 pr-3 font-semibold">{t("hr.pay.socso")}</th>
                      <th className="text-right py-2 pr-3 font-semibold">{t("hr.pay.eis")}</th>
                      <th className="text-right py-2 pr-3 font-semibold">{t("hr.pay.pcb")}</th>
                      <th className="text-right py-2 pr-3 font-semibold">{t("hr.pay.totalDeductions")}</th>
                      <th className="text-right py-2 pr-3 font-semibold text-emerald-700">{t("hr.pay.net")}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {payslips.map(s => (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="py-2 pr-4 font-medium">{s.userName}</td>
                        <td className="py-2 pr-3 text-right">{rm(s.grossSalary)}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{rm(s.epfEmployee)}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{rm(s.socsoEmployee)}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{rm(s.eisEmployee)}</td>
                        <td className="py-2 pr-3 text-right text-muted-foreground">{rm(s.pcb)}</td>
                        <td className="py-2 pr-3 text-right text-red-700 font-semibold">{rm(s.totalDeductions)}</td>
                        <td className="py-2 pr-3 text-right text-emerald-700 font-bold">{rm(s.netPay)}</td>
                        <td className="py-2">
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => downloadPDF(s.id)}>
                            <Download className="w-3 h-3" /> PDF
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SELF-SERVICE — for staff (non-manager) with a selected user identity
// ══════════════════════════════════════════════════════════════════════════════

function SelfServiceTab() {
  const t = useT();
  const { toast } = useToast();
  const qc = useQueryClient();
  const now = new Date();
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState({ leaveType: "annual" as LeaveType, startDate: "", endDate: "", daysRequested: "", reason: "" });
  const [attMonth, setAttMonth] = useState(now.getMonth() + 1);
  const [attYear, setAttYear] = useState(now.getFullYear());

  const { data: leaveData } = useQuery({
    queryKey: ["hr-me-leave"],
    queryFn: () => apiJson<{ requests: LeaveRequest[]; balances: LeaveBalance[] }>("/hr/me/leave"),
  });

  const { data: attData } = useQuery({
    queryKey: ["hr-me-attendance", attMonth, attYear],
    queryFn: () => apiJson<{ records: AttRecord[] }>(`/hr/me/attendance?month=${attMonth}&year=${attYear}`),
  });

  const { data: slipData } = useQuery({
    queryKey: ["hr-me-payslips"],
    queryFn: () => apiJson<{ payslips: (Payslip & { run: PayrollRun | null })[] }>("/hr/me/payslips"),
  });

  const applyLeave = useMutation({
    mutationFn: () => apiJson("/hr/me/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leaveType: applyForm.leaveType, startDate: applyForm.startDate, endDate: applyForm.endDate, daysRequested: parseFloat(applyForm.daysRequested) || 1, reason: applyForm.reason || undefined }) }),
    onSuccess: () => { toast({ description: t("hr.leave.applied") }); qc.invalidateQueries({ queryKey: ["hr-me-leave"] }); setApplyOpen(false); },
    onError: (e: Error) => toast({ variant: "destructive", description: e.message }),
  });

  const downloadMyPDF = async (slipId: number, run: PayrollRun | null) => {
    const resp = await api(`/hr/me/payslips/${slipId}/pdf`, { method: "GET" });
    if (!resp.ok) { toast({ variant: "destructive", description: "Download failed." }); return; }
    const blob = await resp.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `payslip-${run?.year ?? ""}-${String(run?.month ?? "").padStart(2,"0")}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(a.href);
  };

  const balances  = leaveData?.balances ?? [];
  const requests  = leaveData?.requests ?? [];
  const records   = attData?.records ?? [];
  const mySlips   = slipData?.payslips ?? [];

  return (
    <div className="space-y-6">
      {/* Leave Balances */}
      {balances.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {balances.map(b => (
            <Card key={b.id} className="glass-card">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t(`hr.leave.type.${b.leaveType}`)}</p>
                <p className="text-2xl font-bold text-emerald-700">{Math.max(0, b.entitlement - b.used)}</p>
                <p className="text-xs text-muted-foreground">{t("hr.leave.remaining")} / {b.entitlement} {t("hr.leave.entitlement")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Apply + My Requests */}
      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{t("hr.leave.apply")}</CardTitle>
          <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="w-3.5 h-3.5" /> {t("hr.leave.apply")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("hr.leave.apply")}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide">Leave Type</Label>
                  <Select value={applyForm.leaveType} onValueChange={v => setApplyForm(f => ({ ...f, leaveType: v as LeaveType }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LEAVE_TYPES.map(lt => <SelectItem key={lt} value={lt}>{t(`hr.leave.type.${lt}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wide">{t("hr.leave.startDate")}</Label>
                    <Input type="date" value={applyForm.startDate} onChange={e => setApplyForm(f => ({ ...f, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wide">{t("hr.leave.endDate")}</Label>
                    <Input type="date" value={applyForm.endDate} onChange={e => setApplyForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide">{t("hr.leave.days")}</Label>
                  <Input type="number" min={0.5} step={0.5} value={applyForm.daysRequested} onChange={e => setApplyForm(f => ({ ...f, daysRequested: e.target.value }))} placeholder="e.g. 1, 1.5, 2" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide">{t("hr.leave.reason")}</Label>
                  <Textarea value={applyForm.reason} onChange={e => setApplyForm(f => ({ ...f, reason: e.target.value }))} className="resize-none h-16 text-sm" />
                </div>
                <Button className="w-full" disabled={!applyForm.startDate || !applyForm.endDate || applyLeave.isPending} onClick={() => applyLeave.mutate()}>
                  {applyLeave.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : null} Submit Application
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? <p className="text-sm text-muted-foreground">{t("hr.self.leave.empty")}</p> : (
            <div className="space-y-2">
              {requests.map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{t(`hr.leave.type.${r.leaveType}`)} · {r.daysRequested} {t("hr.leave.days")}</p>
                    <p className="text-xs text-muted-foreground">{r.startDate} → {r.endDate}</p>
                    {r.managerNotes && <p className="text-xs text-muted-foreground italic">Manager: {r.managerNotes}</p>}
                  </div>
                  <Badge variant="outline" className={`text-xs ${STATUS_COLORS[r.status] ?? ""}`}>{t(`hr.leave.status.${r.status}`)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Attendance */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t("hr.att.summary")}</CardTitle>
            <div className="flex gap-2">
              <Select value={String(attMonth)} onValueChange={v => setAttMonth(parseInt(v))}>
                <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" value={attYear} onChange={e => setAttYear(parseInt(e.target.value))} className="w-20 h-7 text-xs" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? <p className="text-sm text-muted-foreground">{t("hr.self.att.empty")}</p> : (
            <div className="flex flex-wrap gap-1.5">
              {records.map(r => (
                <span key={r.id} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${
                  r.status === "present"  ? "bg-emerald-100 text-emerald-800" :
                  r.status === "absent"   ? "bg-red-100 text-red-800" :
                  r.status === "leave"    ? "bg-amber-100 text-amber-800" :
                  "bg-sky-100 text-sky-800"
                }`}>
                  {r.workDate.slice(8)} {t(`hr.att.status.${r.status}`)}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Payslips */}
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-base">{t("hr.pay.payslips")}</CardTitle></CardHeader>
        <CardContent>
          {mySlips.length === 0 ? <p className="text-sm text-muted-foreground">{t("hr.self.payslips.empty")}</p> : (
            <div className="space-y-2">
              {mySlips.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm font-semibold">{s.run ? `${MONTHS[s.run.month - 1]} ${s.run.year}` : "Payslip"}</p>
                    <p className="text-xs text-muted-foreground">{t("hr.pay.gross")}: {rm(s.grossSalary)} · {t("hr.pay.net")}: <span className="font-semibold text-emerald-700">{rm(s.netPay)}</span></p>
                  </div>
                  <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => downloadMyPDF(s.id, s.run)}>
                    <Download className="w-3 h-3" /> {t("hr.pay.download")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

export default function HrPage() {
  const t = useT();
  const { isManager, currentUser } = useAuth();

  return (
    <AppLayout>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground jewel-gradient-text drop-shadow-sm">
            {t("hr.title")}
          </h1>
          <p className="text-muted-foreground mt-2 font-medium">{t("hr.subtitle")}</p>
        </header>

        {isManager ? (
          <Tabs defaultValue="employees" className="space-y-4">
            <TabsList className="flex flex-wrap gap-1 h-auto">
              <TabsTrigger value="employees" className="gap-1.5"><Users className="w-3.5 h-3.5" />{t("hr.tab.employees")}</TabsTrigger>
              <TabsTrigger value="leave" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{t("hr.tab.leave")}</TabsTrigger>
              <TabsTrigger value="attendance" className="gap-1.5"><Clock className="w-3.5 h-3.5" />{t("hr.tab.attendance")}</TabsTrigger>
              <TabsTrigger value="payroll" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" />{t("hr.tab.payroll")}</TabsTrigger>
              <TabsTrigger value="self" className="gap-1.5"><UserCheck className="w-3.5 h-3.5" />{t("hr.tab.self")}</TabsTrigger>
            </TabsList>

            <TabsContent value="employees"><EmployeesTab /></TabsContent>
            <TabsContent value="leave"><LeaveTab /></TabsContent>
            <TabsContent value="attendance"><AttendanceTab /></TabsContent>
            <TabsContent value="payroll"><PayrollTab /></TabsContent>
            <TabsContent value="self"><SelfServiceTab /></TabsContent>
          </Tabs>
        ) : (
          <Card className="glass-card">
            <CardContent className="p-8 text-center">
              <UserCheck className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">{t("hr.self.noUser")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
