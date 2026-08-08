import { useState } from "react";
import { Link } from "wouter";
import {
  useMatters,
  useCreateMatter,
  useUpcomingDeadlines,
  ApiError,
  categoryMeta,
  daysUntil,
  matterTypeLabel,
  SYA_MATTER_TYPES,
  SYA_COURTS,
  type MatterInput,
} from "@/hooks/use-matters";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { useLanguage } from "@/lib/language-context";
import {
  Briefcase,
  Plus,
  Scale,
  ArrowRight,
  Building2,
  Hash,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";

const ACTING_FOR = ["Plaintif", "Defendan", "Pemohon", "Responden"];

const STATUS_META: Record<string, { en: string; bm: string; color: string }> = {
  active: { en: "Active", bm: "Aktif", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  "on-hold": { en: "On Hold", bm: "Tergantung", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  closed: { en: "Closed", bm: "Ditutup", color: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? STATUS_META.active;
}

const EMPTY: MatterInput = {
  title: "",
  clientName: "",
  actingFor: "Plaintif",
  plaintiff: "",
  defendant: "",
  matterType: SYA_MATTER_TYPES[0].value,
  court: SYA_COURTS[0],
  caseNo: "",
  claimAmount: "",
  status: "active",
  notes: "",
};

function formatMoney(v: string | null) {
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function MattersPage() {
  const { t, ts, mode } = useLanguage();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data: matters, isLoading } = useMatters(statusFilter || undefined);
  const { data: upcoming } = useUpcomingDeadlines(30);
  const createMatter = useCreateMatter();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<MatterInput>(EMPTY);

  const set = (k: keyof MatterInput, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title?.trim()) {
      toast({ title: ts("Matter title required", "Tajuk fail kes diperlukan"), variant: "destructive" });
      return;
    }
    try {
      await createMatter.mutateAsync(form);
      toast({ title: ts("Matter created", "Fail kes dibuka") });
      setOpen(false);
      setForm(EMPTY);
    } catch (e) {
      toast({
        title: ts("Could not create matter", "Fail kes tidak dapat dibuka"),
        description: e instanceof ApiError ? e.message : ts("Please try again.", "Sila cuba lagi."),
        variant: "destructive",
      });
    }
  };

  const list = matters ?? [];
  const urgent = (upcoming ?? []).slice(0, 5);

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-foreground" data-testid="matters-title">
            {t("Matter Files", "Fail Kes")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {t(
              "Your Syariah case files. Each matter collects the parties, case number, filed drafts and a live deadline diary.",
              "Fail kes Syariah anda. Setiap fail mengumpulkan pihak-pihak, nombor kes, draf yang difailkan dan diari tarikh akhir.",
            )}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground" data-testid="matters-new">
          <Plus className="h-4 w-4" /> {t("New Matter", "Fail Kes Baharu")}
        </Button>
      </div>

      {urgent.length > 0 && (
        <Card className="border-amber-800/30 bg-amber-950/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="h-4 w-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-foreground">
                {t("Upcoming deadlines (30 days)", "Tarikh akhir akan datang (30 hari)")}
              </h2>
            </div>
            <div className="space-y-1.5">
              {urgent.map((d) => {
                const days = daysUntil(d.dueDate);
                const cat = categoryMeta(d.category);
                return (
                  <Link key={d.id} href={`/matters/${d.matterId}`}>
                    <div className="flex items-center gap-2 text-xs py-1 cursor-pointer hover:text-secondary transition-colors flex-wrap">
                      {days < 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-red-400">
                          <AlertTriangle className="h-3 w-3" /> {Math.abs(days)}d
                        </span>
                      ) : (
                        <span className={`font-semibold ${days <= 7 ? "text-amber-400" : "text-muted-foreground"}`}>
                          {days === 0 ? t("Today", "Hari ini") : `${days}d`}
                        </span>
                      )}
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color}`}>{cat.label}</span>
                      <span className="text-foreground font-medium">{d.title}</span>
                      <span className="text-muted-foreground">— {d.matterTitle}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        {["", "active", "on-hold", "closed"].map((s) => (
          <button
            key={s || "all"}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              statusFilter === s
                ? "bg-secondary/10 text-secondary border-secondary/30"
                : "text-muted-foreground border-border hover:border-secondary/30"
            }`}
          >
            {s === "" ? t("All", "Semua") : mode === "bm" ? statusMeta(s).bm : statusMeta(s).en}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-secondary animate-pulse">
          {t("Loading your matters…", "Memuatkan fail kes anda…")}
        </div>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Briefcase className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-serif font-semibold text-foreground mb-1">
              {t("No matters yet", "Tiada fail kes lagi")}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              {t(
                "Open a matter for each case you act in — record the parties and case number, file your AI drafts into it, and build a deadline diary from Syariah procedure triggers.",
                "Buka fail kes bagi setiap kes yang anda kendalikan — rekodkan pihak-pihak dan nombor kes, failkan draf AI anda, dan bina diari tarikh akhir daripada pencetus tatacara Syariah.",
              )}
            </p>
            <Button onClick={() => setOpen(true)} className="gap-2 bg-secondary hover:bg-secondary/90 text-secondary-foreground" data-testid="matters-create-first">
              <Plus className="h-4 w-4" /> {t("Create your first matter", "Buka fail kes pertama anda")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((m) => {
            const sm = statusMeta(m.status);
            const money = formatMoney(m.claimAmount);
            return (
              <Link key={m.id} href={`/matters/${m.id}`}>
                <Card className="flex flex-col hover:border-secondary/50 transition-all cursor-pointer h-full group" data-testid={`matter-card-${m.id}`}>
                  <CardContent className="p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${sm.color}`}>
                        {mode === "bm" ? sm.bm : sm.en}
                      </span>
                      {m.matterType && (
                        <span className="text-[10px] text-muted-foreground font-medium text-right">
                          {matterTypeLabel(m.matterType, mode)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-secondary transition-colors">
                      {m.title}
                    </h3>
                    <div className="space-y-1.5 text-xs text-muted-foreground flex-1">
                      {m.clientName && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.clientName}{m.actingFor ? ` · ${m.actingFor}` : ""}</span>
                        </div>
                      )}
                      {m.caseNo && (
                        <div className="flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate font-mono">{m.caseNo}</span>
                        </div>
                      )}
                      {m.court && (
                        <div className="flex items-center gap-1.5">
                          <Scale className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.court}</span>
                        </div>
                      )}
                    </div>
                    {money && <Badge variant="outline" className="self-start">{money}</Badge>}
                    <div className="flex items-center gap-1.5 text-xs text-secondary font-medium pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {t("Open matter", "Buka fail")} <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("New Matter", "Fail Kes Baharu")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Matter title *", "Tajuk fail kes *")}</Label>
              <Input
                value={form.title ?? ""}
                onChange={(e) => set("title", e.target.value)}
                placeholder={ts("e.g. Siti Aminah lwn Ahmad — Tuntutan Nafkah", "cth. Siti Aminah lwn Ahmad — Tuntutan Nafkah")}
                data-testid="matter-form-title"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("Client", "Klien")}</Label>
                <Input value={form.clientName ?? ""} onChange={(e) => set("clientName", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Acting for", "Bertindak bagi")}</Label>
                <Select value={form.actingFor ?? ""} onValueChange={(v) => set("actingFor", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTING_FOR.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("Plaintiff / Applicant", "Plaintif / Pemohon")}</Label>
                <Input value={form.plaintiff ?? ""} onChange={(e) => set("plaintiff", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Defendant / Respondent", "Defendan / Responden")}</Label>
                <Input value={form.defendant ?? ""} onChange={(e) => set("defendant", e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("Matter type", "Jenis kes")}</Label>
                <Select value={form.matterType ?? ""} onValueChange={(v) => set("matterType", v)}>
                  <SelectTrigger data-testid="matter-form-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SYA_MATTER_TYPES.map((tt) => (
                      <SelectItem key={tt.value} value={tt.value}>
                        {mode === "bm" ? tt.bm : tt.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("Court", "Mahkamah")}</Label>
                <Select value={form.court ?? ""} onValueChange={(v) => set("court", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SYA_COURTS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("Case no.", "No. kes")}</Label>
                <Input value={form.caseNo ?? ""} onChange={(e) => set("caseNo", e.target.value)} placeholder="14600-010-0123-2026" />
              </div>
              <div className="space-y-1.5">
                <Label>{t("Claim amount (RM)", "Jumlah tuntutan (RM)")}</Label>
                <Input type="number" value={form.claimAmount ?? ""} onChange={(e) => set("claimAmount", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Notes", "Catatan")}</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                {t("Cancel", "Batal")}
              </Button>
              <Button
                className="flex-1 bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                onClick={submit}
                disabled={createMatter.isPending}
                data-testid="matter-form-submit"
              >
                {createMatter.isPending ? t("Creating…", "Membuka…") : t("Create matter", "Buka fail kes")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
