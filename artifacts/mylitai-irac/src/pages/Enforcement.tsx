import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Gavel,
  Loader2,
  Check,
  Copy,
  CircleAlert,
  ScrollText,
  Coins,
  Target,
  ListChecks,
  ThumbsUp,
  ThumbsDown,
  Library as LibraryIcon,
  Compass,
  Scale,
  CalendarClock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { DisclaimerNotice } from "@/components/DisclaimerNotice";
import { useLanguage } from "@/contexts/LanguageContext";
import { FileSignature } from "lucide-react";
import {
  getEnforcementMethods,
  runEnforcementAdvise,
  runBillOfCosts,
  runDraftDocument,
  type EnforcementMethod,
} from "@/lib/irac-api";

const selectCls =
  "flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))] focus:border-[hsl(var(--gold))]";

const DEBTOR_BADGE: Record<EnforcementMethod["debtor"], string> = {
  individual: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  company: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  any: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

function OutputBlock({
  output,
  disclaimer,
  copyLabel,
  copiedLabel,
}: {
  output: string;
  disclaimer?: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => {
            navigator.clipboard.writeText(output);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              {copiedLabel}
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              {copyLabel}
            </>
          )}
        </Button>
      </div>
      <div className="bg-background/60 border border-border rounded-lg p-5 max-h-[60vh] overflow-y-auto">
        <MarkdownRenderer content={output} />
      </div>
      {disclaimer && <DisclaimerNotice disclaimer={disclaimer} />}
    </div>
  );
}

// ─── Judgment Interest Calculator ────────────────────────────────────────────
function JudgmentInterestCalculator() {
  const { t } = useLanguage();
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("5");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [interestType, setInterestType] = useState("pre");
  const [result, setResult] = useState<null | {
    days: number;
    totalInterest: number;
    totalSum: number;
    dailyRate: number;
  }>(null);

  const fmt = (n: number) =>
    n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(principal);
    const r = parseFloat(rate);
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!p || p <= 0 || !r || isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start)
      return;
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const totalInterest = p * (r / 100) * (days / 365);
    const dailyRate = (p * (r / 100)) / 365;
    setResult({
      days,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalSum: Math.round((p + totalInterest) * 100) / 100,
      dailyRate: Math.round(dailyRate * 100) / 100,
    });
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" /> {t("enf.calc.interest.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{t("enf.calc.interest.subtitle")}</p>
        </div>
        <form onSubmit={handleCalculate} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("enf.calc.interest.type")}</Label>
            <select className={selectCls} value={interestType} onChange={(e) => setInterestType(e.target.value)}>
              <option value="pre">{t("enf.calc.interest.pre")}</option>
              <option value="post">{t("enf.calc.interest.post")}</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t("enf.calc.interest.principal")}</Label>
            <Input type="number" placeholder="e.g. 250000" value={principal} onChange={(e) => setPrincipal(e.target.value)} min="1" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{interestType === "pre" ? t("enf.calc.interest.startPre") : t("enf.calc.interest.startPost")}</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>{interestType === "pre" ? t("enf.calc.interest.endPre") : t("enf.calc.interest.endPost")}</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("enf.calc.interest.rate")}</Label>
            <Input type="number" step="0.1" placeholder="5" value={rate} onChange={(e) => setRate(e.target.value)} min="0.1" max="100" required />
            <p className="text-xs text-muted-foreground">{t("enf.calc.interest.rateNote")}</p>
          </div>
          <Button type="submit" className="w-full">{t("enf.calc.interest.button")}</Button>
        </form>
        {result && (
          <div className="mt-2 p-5 bg-primary/5 border border-primary/20 rounded-xl space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {interestType === "pre" ? t("enf.calc.interest.pre") : t("enf.calc.interest.post")}
              </p>
              <p className="text-4xl font-serif font-bold text-primary">RM {fmt(result.totalInterest)}</p>
              <p className="text-xs text-muted-foreground">{t("enf.calc.interest.forDays").replace("{days}", String(result.days))}</p>
            </div>
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex justify-between text-sm bg-background p-2 rounded border border-border">
                <span className="text-muted-foreground">{t("enf.calc.interest.daily")}</span>
                <span className="font-mono font-medium">RM {fmt(result.dailyRate)}</span>
              </div>
              <div className="flex justify-between text-sm bg-primary/10 p-2 rounded border border-primary/20 font-semibold">
                <span>{t("enf.calc.interest.totalSum")}</span>
                <span className="font-mono text-primary">RM {fmt(result.totalSum)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Filing Fees Calculator ──────────────────────────────────────────────────
const FILING_FEES: Record<string, Record<string, (amount: number) => { fee: number; note: string }>> = {
  high_court: {
    writ: (amt) => ({
      fee: amt <= 500_000 ? 800 : amt <= 1_000_000 ? 1200 : amt <= 5_000_000 ? 2000 : 4000,
      note: "Writ of Summons (approx. — verify with registry).",
    }),
    originating_summons: () => ({ fee: 600, note: "Originating Summons (O.7 / O.28 / O.83 ROC 2012) — approx." }),
    judicial_review: () => ({ fee: 600, note: "OS for Judicial Review (O.53 ROC 2012) — approx." }),
    winding_up: () => ({ fee: 1500, note: "Winding Up Petition (Companies Act 2016, s.464) — incl. deposit (approx.)" }),
    bankruptcy_petition: () => ({ fee: 800, note: "Creditor's Petition (Insolvency Act 1967) — approx." }),
    garnishee: () => ({ fee: 100, note: "Garnishee proceedings (O.49 ROC 2012) — per application (approx.)" }),
    notice_of_appeal: () => ({ fee: 1000, note: "Notice of Appeal to Court of Appeal (approx.)" }),
  },
  sessions_court: {
    civil_claim: () => ({ fee: 400, note: "Sessions Court: jurisdiction up to RM1 million (approx.)" }),
  },
  magistrates_court: {
    civil_claim: () => ({ fee: 120, note: "Magistrates' Court: jurisdiction up to RM100,000 (approx.)" }),
  },
};

const COURT_OPTIONS: Record<string, { label: string; proceedings: Record<string, string> }> = {
  high_court: {
    label: "High Court",
    proceedings: {
      writ: "Writ of Summons",
      originating_summons: "Originating Summons",
      judicial_review: "Judicial Review (O.53)",
      winding_up: "Winding Up Petition",
      bankruptcy_petition: "Creditor's Bankruptcy Petition",
      garnishee: "Garnishee Proceedings (O.49)",
      notice_of_appeal: "Notice of Appeal (Court of Appeal)",
    },
  },
  sessions_court: { label: "Sessions Court", proceedings: { civil_claim: "Civil Claim" } },
  magistrates_court: { label: "Magistrates' Court", proceedings: { civil_claim: "Civil Claim" } },
};

function FilingFeesCalculator() {
  const { t } = useLanguage();
  const [court, setCourt] = useState("high_court");
  const [proceedingType, setProceedingType] = useState("writ");
  const [claimAmount, setClaimAmount] = useState("");
  const [result, setResult] = useState<null | { fee: number; note: string }>(null);
  const needsAmount = ["writ", "civil_claim"].includes(proceedingType);
  const fmt = (n: number) =>
    n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(claimAmount) || 0;
    const calcFn = FILING_FEES[court]?.[proceedingType];
    if (!calcFn) return;
    setResult(calcFn(amt));
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" /> {t("enf.calc.filing.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{t("enf.calc.filing.subtitle")}</p>
        </div>
        <form onSubmit={handleCalculate} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("enf.calc.filing.court")}</Label>
            <select
              className={selectCls}
              value={court}
              onChange={(e) => {
                setCourt(e.target.value);
                setProceedingType(Object.keys(COURT_OPTIONS[e.target.value].proceedings)[0]);
                setResult(null);
              }}
            >
              {Object.entries(COURT_OPTIONS).map(([val, opt]) => (
                <option key={val} value={val}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t("enf.calc.filing.proceeding")}</Label>
            <select className={selectCls} value={proceedingType} onChange={(e) => { setProceedingType(e.target.value); setResult(null); }}>
              {Object.entries(COURT_OPTIONS[court].proceedings).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          {needsAmount && (
            <div className="space-y-2">
              <Label>{t("enf.calc.filing.amount")}</Label>
              <Input type="number" placeholder="e.g. 150000" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} min="0" />
            </div>
          )}
          <Button type="submit" className="w-full">{t("enf.calc.filing.button")}</Button>
        </form>
        {result && (
          <div className="mt-2 p-5 bg-primary/5 border border-primary/20 rounded-xl space-y-4">
            <div className="text-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t("enf.calc.filing.fee")}</p>
              <p className="text-4xl font-serif font-bold text-primary">RM {fmt(result.fee)}</p>
            </div>
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-sm text-foreground">{result.note}</p>
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /> {t("enf.calc.filing.verify")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Court Deadline Calculator ───────────────────────────────────────────────
type DeadlineRule = { id: string; label: string; days: number; citation: string; note?: string };

const DEADLINE_RULES: DeadlineRule[] = [
  { id: "appearance", label: "Memorandum of Appearance — after service of Writ", days: 14, citation: "O.12 r.4 ROC 2012", note: "14 days where served within Malaysia." },
  { id: "defence", label: "Statement of Defence — after entry of appearance", days: 14, citation: "O.18 r.2 ROC 2012" },
  { id: "reply", label: "Reply / Defence to Counterclaim — after Defence", days: 14, citation: "O.18 r.3 ROC 2012" },
  { id: "set-aside-ex-parte", label: "Set aside / vary an ex parte order", days: 14, citation: "O.32 r.6 ROC 2012" },
  { id: "list-of-docs", label: "Serve List of Documents (after pleadings closed)", days: 14, citation: "O.24 r.2 ROC 2012" },
  { id: "settle-order", label: "Settle Sealed Order with opposing counsel", days: 14, citation: "O.42 r.5 ROC 2012" },
  { id: "noa-coa", label: "Notice of Appeal — High Court to Court of Appeal", days: 30, citation: "Rule 12 RCA 1994", note: "From date of decision. Strict." },
  { id: "moa-coa", label: "Memorandum of Appeal — after Grounds of Judgment", days: 56, citation: "Rule 18 RCA 1994", note: "8 weeks." },
  { id: "leave-fc", label: "Motion for Leave to Appeal — to Federal Court", days: 30, citation: "Rule 4 RFC 1995" },
  { id: "noa-sub-hc", label: "Notice of Appeal — Sessions/Magistrates to High Court", days: 14, citation: "s.28 SCA 1948 / O.55 ROC 2012" },
  { id: "taxation", label: "File Bill of Costs for taxation — after order for costs", days: 180, citation: "O.59 r.20 ROC 2012", note: "6 months; beyond this, leave required." },
  { id: "jr-leave", label: "Apply for leave for Judicial Review", days: 90, citation: "O.53 r.3(6) ROC 2012", note: "3 months from decision." },
  { id: "enforce-judgment", label: "Enforce judgment without leave", days: 2190, citation: "O.46 r.2 ROC 2012", note: "6 years; after which leave to issue execution required." },
  { id: "wind-up-petition", label: "Winding-up — after statutory notice (s.466 CA 2016)", days: 21, citation: "s.466(1)(a) Companies Act 2016" },
  { id: "bankruptcy-act", label: "Bankruptcy notice — debtor to satisfy", days: 7, citation: "s.3(2)(i) Insolvency Act 1967" },
  { id: "arbitration-set-aside", label: "Set aside Arbitration Award", days: 90, citation: "s.37(4) Arbitration Act 2005", note: "3 months from receipt; strict." },
];

function CourtDeadlineCalculator() {
  const { t } = useLanguage();
  const [ruleId, setRuleId] = useState(DEADLINE_RULES[0].id);
  const [eventDate, setEventDate] = useState("");
  const [result, setResult] = useState<null | {
    deadline: Date;
    rule: DeadlineRule;
    daysFromToday: number;
    isUrgent: boolean;
    isOverdue: boolean;
  }>(null);

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const rule = DEADLINE_RULES.find((r) => r.id === ruleId);
    if (!rule || !eventDate) return;
    const start = new Date(eventDate);
    if (isNaN(start.getTime())) return;
    const deadline = new Date(start);
    deadline.setDate(deadline.getDate() + rule.days);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysFromToday = Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    setResult({
      deadline,
      rule,
      daysFromToday,
      isUrgent: daysFromToday >= 0 && daysFromToday <= 7,
      isOverdue: daysFromToday < 0,
    });
  };

  const selected = DEADLINE_RULES.find((r) => r.id === ruleId);

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div>
          <h3 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> {t("enf.calc.deadline.title")}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{t("enf.calc.deadline.subtitle")}</p>
        </div>
        <form onSubmit={handleCalculate} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("enf.calc.deadline.step")}</Label>
            <select className={selectCls} value={ruleId} onChange={(e) => setRuleId(e.target.value)}>
              {DEADLINE_RULES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label} — {r.days < 365 ? `${r.days} days` : `${Math.round(r.days / 30)} months`}
                </option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-muted-foreground italic mt-1">
                <span className="font-mono not-italic text-primary/80">{selected.citation}</span>
                {selected.note && <> — {selected.note}</>}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t("enf.calc.deadline.eventDate")}</Label>
            <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full">{t("enf.calc.deadline.button")}</Button>
        </form>
        {result && (
          <div
            className={`mt-2 p-5 rounded-xl space-y-3 border ${
              result.isOverdue
                ? "border-red-500/40 bg-red-500/5"
                : result.isUrgent
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-primary/20 bg-primary/5"
            }`}
          >
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("enf.calc.deadline.deadline")}</p>
              <p className="text-2xl font-serif font-bold text-foreground">{fmtDate(result.deadline)}</p>
              <p className={`text-sm font-medium ${result.isOverdue ? "text-red-400" : result.isUrgent ? "text-amber-400" : "text-primary"}`}>
                {result.isOverdue
                  ? t("enf.calc.deadline.overdue").replace("{n}", String(Math.abs(result.daysFromToday)))
                  : t("enf.calc.deadline.remaining").replace("{n}", String(result.daysFromToday))}
              </p>
            </div>
            <p className="text-xs text-muted-foreground italic border-t border-border pt-2">
              <span className="font-mono not-italic text-primary/80">{result.rule.citation}</span>
              {result.rule.note && <> — {result.rule.note}</>}
            </p>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /> {t("enf.calc.deadline.verify")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type Tab = "advisor" | "documents" | "costs" | "calculators" | "library";

export default function Enforcement() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Tab>("advisor");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["enforcement", "methods"],
    queryFn: getEnforcementMethods,
    staleTime: 1000 * 60 * 10,
  });

  const DEBTOR_LABEL: Record<EnforcementMethod["debtor"], string> = {
    individual: t("enf.debtor.individual"),
    company: t("enf.debtor.company"),
    any: t("enf.debtor.any"),
  };

  // Advisor state
  const [adv, setAdv] = useState({
    debtorType: "",
    judgmentSum: "",
    judgmentDate: "",
    knownAssets: "",
    debtorProfile: "",
    priorSteps: "",
  });
  const [advOut, setAdvOut] = useState("");
  const [advDisc, setAdvDisc] = useState<string | undefined>();
  const [advGen, setAdvGen] = useState(false);
  const [advErr, setAdvErr] = useState<string | null>(null);

  // Bill of costs state
  const [boc, setBoc] = useState({
    court: "",
    suitNo: "",
    parties: "",
    basis: "standard",
    costsOrder: "",
    workDone: "",
    attendances: "",
    disbursements: "",
    counselFees: "",
  });
  const [bocOut, setBocOut] = useState("");
  const [bocDisc, setBocDisc] = useState<string | undefined>();
  const [bocGen, setBocGen] = useState(false);
  const [bocErr, setBocErr] = useState<string | null>(null);

  // Court-document drafter state
  const [doc, setDoc] = useState({
    documentType: "",
    court: "",
    suitNo: "",
    parties: "",
    judgmentSum: "",
    judgmentDate: "",
    debtorName: "",
    debtorAddress: "",
    debtorType: "",
    particulars: "",
  });
  const [docOut, setDocOut] = useState("");
  const [docDisc, setDocDisc] = useState<string | undefined>();
  const [docGen, setDocGen] = useState(false);
  const [docErr, setDocErr] = useState<string | null>(null);
  const selectedDoc = (data?.documents ?? []).find((d) => d.id === doc.documentType);

  const runAdvise = () => {
    setAdvGen(true);
    setAdvOut("");
    setAdvDisc(undefined);
    setAdvErr(null);
    runEnforcementAdvise(adv, {
      onContent: (c) => setAdvOut((p) => p + c),
      onDone: (d) => {
        setAdvDisc(d);
        setAdvGen(false);
      },
      onError: (m) => {
        setAdvErr(m);
        setAdvGen(false);
      },
    });
  };

  const runBoc = () => {
    setBocGen(true);
    setBocOut("");
    setBocDisc(undefined);
    setBocErr(null);
    runBillOfCosts(boc, {
      onContent: (c) => setBocOut((p) => p + c),
      onDone: (d) => {
        setBocDisc(d);
        setBocGen(false);
      },
      onError: (m) => {
        setBocErr(m);
        setBocGen(false);
      },
    });
  };

  const runDoc = () => {
    setDocGen(true);
    setDocOut("");
    setDocDisc(undefined);
    setDocErr(null);
    runDraftDocument(doc, {
      onContent: (c) => setDocOut((p) => p + c),
      onDone: (d) => {
        setDocDisc(d);
        setDocGen(false);
      },
      onError: (m) => {
        setDocErr(m);
        setDocGen(false);
      },
    });
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "advisor", label: t("enf.tab.advisor"), icon: Compass },
    { id: "documents", label: t("enf.tab.documents"), icon: FileSignature },
    { id: "costs", label: t("enf.tab.costs"), icon: Coins },
    { id: "calculators", label: t("enf.tab.calculators"), icon: Scale },
    { id: "library", label: t("enf.tab.library"), icon: LibraryIcon },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 w-full">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-gradient-gold">{t("enf.title")}</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">{t("enf.desc")}</p>
        <div className="rule-gold mt-4" />
      </div>

      <div className="flex gap-2 mb-6 border-b border-border flex-wrap">
        {tabs.map((tb) => {
          const active = tab === tb.id;
          return (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? "border-[hsl(var(--gold-bright))] text-[hsl(var(--gold-bright))]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <tb.icon className="h-4 w-4" />
              {tb.label}
            </button>
          );
        })}
      </div>

      {tab === "advisor" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t("enf.advisor.desc")}</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>{t("enf.advisor.debtorType")}</Label>
                <select className={`${selectCls} mt-1`} value={adv.debtorType} onChange={(e) => setAdv({ ...adv, debtorType: e.target.value })}>
                  <option value="">{t("enf.advisor.select")}</option>
                  <option value="individual">{t("enf.debtor.individual")}</option>
                  <option value="company">{t("enf.debtor.company")}</option>
                </select>
              </div>
              <div>
                <Label>{t("enf.advisor.judgmentSum")}</Label>
                <Input className="mt-1" placeholder="e.g. RM 850,000.00" value={adv.judgmentSum} onChange={(e) => setAdv({ ...adv, judgmentSum: e.target.value })} />
              </div>
              <div>
                <Label>{t("enf.advisor.judgmentDate")}</Label>
                <Input type="date" className="mt-1" value={adv.judgmentDate} onChange={(e) => setAdv({ ...adv, judgmentDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("enf.advisor.knownAssets")}</Label>
              <Textarea className="mt-1" rows={2} placeholder={t("enf.advisor.knownAssetsHint")} value={adv.knownAssets} onChange={(e) => setAdv({ ...adv, knownAssets: e.target.value })} />
            </div>
            <div>
              <Label>{t("enf.advisor.debtorProfile")}</Label>
              <Textarea className="mt-1" rows={2} placeholder={t("enf.advisor.debtorProfileHint")} value={adv.debtorProfile} onChange={(e) => setAdv({ ...adv, debtorProfile: e.target.value })} />
            </div>
            <div>
              <Label>{t("enf.advisor.priorSteps")}</Label>
              <Input className="mt-1" placeholder={t("enf.advisor.priorStepsHint")} value={adv.priorSteps} onChange={(e) => setAdv({ ...adv, priorSteps: e.target.value })} />
            </div>
            <Button onClick={runAdvise} disabled={advGen} className="w-full gap-2">
              {advGen ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("enf.advisor.advising")}
                </>
              ) : (
                <>
                  <Compass className="h-4 w-4" /> {t("enf.advisor.button")}
                </>
              )}
            </Button>
            {advErr && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <CircleAlert className="h-4 w-4" />
                {advErr}
              </div>
            )}
            {advOut && <OutputBlock output={advOut} disclaimer={advDisc} copyLabel={t("common.copy")} copiedLabel={t("common.copied")} />}
          </CardContent>
        </Card>
      )}

      {tab === "documents" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t("enf.docs.desc")}</p>
            <div>
              <Label>{t("enf.docs.documentType")}</Label>
              <select
                className={`${selectCls} mt-1`}
                value={doc.documentType}
                onChange={(e) => setDoc({ ...doc, documentType: e.target.value })}
              >
                <option value="">{t("enf.docs.selectDocument")}</option>
                {(data?.documents ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.basis}
                  </option>
                ))}
              </select>
              {selectedDoc && (
                <p className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1.5">
                  <FileSignature className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <span>
                    {selectedDoc.summary} <span className="text-primary/80">{t("enf.docs.produces")}: {selectedDoc.produces}</span>
                  </span>
                </p>
              )}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("enf.docs.court")}</Label>
                <Input className="mt-1" placeholder="e.g. High Court of Malaya at Kuala Lumpur" value={doc.court} onChange={(e) => setDoc({ ...doc, court: e.target.value })} />
              </div>
              <div>
                <Label>{t("enf.docs.suitNo")}</Label>
                <Input className="mt-1" placeholder="e.g. WA-22NCC-123-04/2026" value={doc.suitNo} onChange={(e) => setDoc({ ...doc, suitNo: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("enf.docs.parties")}</Label>
              <Input className="mt-1" placeholder="e.g. ABC Bank Bhd (Plaintiff) v. XYZ Sdn Bhd (Defendant)" value={doc.parties} onChange={(e) => setDoc({ ...doc, parties: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label>{t("enf.docs.judgmentSum")}</Label>
                <Input className="mt-1" placeholder="e.g. RM 850,000.00" value={doc.judgmentSum} onChange={(e) => setDoc({ ...doc, judgmentSum: e.target.value })} />
              </div>
              <div>
                <Label>{t("enf.docs.judgmentDate")}</Label>
                <Input type="date" className="mt-1" value={doc.judgmentDate} onChange={(e) => setDoc({ ...doc, judgmentDate: e.target.value })} />
              </div>
              <div>
                <Label>{t("enf.docs.debtorType")}</Label>
                <select className={`${selectCls} mt-1`} value={doc.debtorType} onChange={(e) => setDoc({ ...doc, debtorType: e.target.value })}>
                  <option value="">{t("enf.advisor.select")}</option>
                  <option value="individual">{t("enf.debtor.individual")}</option>
                  <option value="company">{t("enf.debtor.company")}</option>
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("enf.docs.debtorName")}</Label>
                <Input className="mt-1" placeholder={t("enf.docs.debtorNameHint")} value={doc.debtorName} onChange={(e) => setDoc({ ...doc, debtorName: e.target.value })} />
              </div>
              <div>
                <Label>{t("enf.docs.debtorAddress")}</Label>
                <Input className="mt-1" placeholder={t("enf.docs.debtorAddressHint")} value={doc.debtorAddress} onChange={(e) => setDoc({ ...doc, debtorAddress: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("enf.docs.particulars")}</Label>
              <Textarea
                className="mt-1"
                rows={3}
                placeholder={selectedDoc ? selectedDoc.particularsHint : t("enf.docs.particularsHint")}
                value={doc.particulars}
                onChange={(e) => setDoc({ ...doc, particulars: e.target.value })}
              />
            </div>
            <Button onClick={runDoc} disabled={docGen || !doc.documentType} className="w-full gap-2">
              {docGen ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("enf.docs.drafting")}
                </>
              ) : (
                <>
                  <FileSignature className="h-4 w-4" /> {t("enf.docs.button")}
                </>
              )}
            </Button>
            {docErr && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <CircleAlert className="h-4 w-4" />
                {docErr}
              </div>
            )}
            {docOut && <OutputBlock output={docOut} disclaimer={docDisc} copyLabel={t("common.copy")} copiedLabel={t("common.copied")} />}
          </CardContent>
        </Card>
      )}

      {tab === "costs" && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t("enf.costs.desc")}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("enf.costs.court")}</Label>
                <Input className="mt-1" placeholder="e.g. High Court of Malaya at Kuala Lumpur" value={boc.court} onChange={(e) => setBoc({ ...boc, court: e.target.value })} />
              </div>
              <div>
                <Label>{t("enf.costs.suitNo")}</Label>
                <Input className="mt-1" placeholder="e.g. WA-22NCC-123-04/2026" value={boc.suitNo} onChange={(e) => setBoc({ ...boc, suitNo: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("enf.costs.parties")}</Label>
              <Input className="mt-1" placeholder="e.g. ABC Bank Bhd (Plaintiff) v. XYZ Sdn Bhd (Defendant)" value={boc.parties} onChange={(e) => setBoc({ ...boc, parties: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("enf.costs.basis")}</Label>
                <select className={`${selectCls} mt-1`} value={boc.basis} onChange={(e) => setBoc({ ...boc, basis: e.target.value })}>
                  {(data?.costsBases ?? []).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{t("enf.costs.costsOrder")}</Label>
                <Input className="mt-1" placeholder="e.g. 'costs to be taxed' per order dated …" value={boc.costsOrder} onChange={(e) => setBoc({ ...boc, costsOrder: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("enf.costs.workDone")}</Label>
              <Textarea className="mt-1" rows={2} placeholder={t("enf.costs.workDoneHint")} value={boc.workDone} onChange={(e) => setBoc({ ...boc, workDone: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>{t("enf.costs.attendances")}</Label>
                <Textarea className="mt-1" rows={2} placeholder={t("enf.costs.attendancesHint")} value={boc.attendances} onChange={(e) => setBoc({ ...boc, attendances: e.target.value })} />
              </div>
              <div>
                <Label>{t("enf.costs.counselFees")}</Label>
                <Textarea className="mt-1" rows={2} placeholder={t("enf.costs.counselFeesHint")} value={boc.counselFees} onChange={(e) => setBoc({ ...boc, counselFees: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t("enf.costs.disbursements")}</Label>
              <Textarea className="mt-1" rows={2} placeholder={t("enf.costs.disbursementsHint")} value={boc.disbursements} onChange={(e) => setBoc({ ...boc, disbursements: e.target.value })} />
            </div>
            <Button onClick={runBoc} disabled={bocGen} className="w-full gap-2">
              {bocGen ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("enf.costs.drafting")}
                </>
              ) : (
                <>
                  <ScrollText className="h-4 w-4" /> {t("enf.costs.button")}
                </>
              )}
            </Button>
            {bocErr && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <CircleAlert className="h-4 w-4" />
                {bocErr}
              </div>
            )}
            {bocOut && <OutputBlock output={bocOut} disclaimer={bocDisc} copyLabel={t("common.copy")} copiedLabel={t("common.copied")} />}
          </CardContent>
        </Card>
      )}

      {tab === "calculators" && (
        <div className="grid lg:grid-cols-3 gap-4">
          <JudgmentInterestCalculator />
          <FilingFeesCalculator />
          <CourtDeadlineCalculator />
        </div>
      )}

      {tab === "library" && (
        <div>
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-2 text-destructive py-12 justify-center">
              <CircleAlert className="h-5 w-5" /> {t("common.errorRetry")}
            </div>
          )}
          {data && (
            <div className="grid md:grid-cols-2 gap-4">
              {data.methods.map((m) => (
                <Card key={m.id}>
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Gavel className="h-5 w-5 text-primary shrink-0" />
                        <h3 className="font-serif text-lg font-semibold text-foreground leading-tight">{m.shortName}</h3>
                      </div>
                      <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${DEBTOR_BADGE[m.debtor]}`}>
                        {DEBTOR_LABEL[m.debtor]}
                      </span>
                    </div>
                    <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground">{m.basis}</span>
                    <p className="text-sm text-foreground/85 leading-relaxed">{m.summary}</p>
                    <div className="flex gap-2 items-start text-xs text-muted-foreground">
                      <Target className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{m.targets}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-400 mb-1">
                          <ThumbsUp className="h-3 w-3" />
                          {t("enf.lib.pros")}
                        </span>
                        <ul className="space-y-0.5">
                          {m.pros.map((p, i) => (
                            <li key={i} className="text-[11px] text-foreground/75 leading-snug">• {p}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-rose-400 mb-1">
                          <ThumbsDown className="h-3 w-3" />
                          {t("enf.lib.cons")}
                        </span>
                        <ul className="space-y-0.5">
                          {m.cons.map((c, i) => (
                            <li key={i} className="text-[11px] text-foreground/75 leading-snug">• {c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div>
                      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-foreground mb-1">
                        <ListChecks className="h-3 w-3 text-primary" />
                        {t("enf.lib.prerequisites")}
                      </span>
                      <ul className="space-y-0.5">
                        {m.prerequisites.map((p, i) => (
                          <li key={i} className="text-[11px] text-foreground/75 leading-snug">• {p}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex gap-2 items-start text-[11px] text-amber-500/90 border-t border-border pt-2">
                      <Coins className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{m.courtFee}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
