import { useState } from 'react';
import { useListCostSchedules } from '@/hooks/use-costs';
import { PageHeader, Card, CardContent, CardHeader, CardTitle, Input, Button, Label } from '@/components/ui';
import { Calculator, FileSpreadsheet, AlertCircle, Scale, Gavel, CalendarClock, Stamp } from 'lucide-react';

// ─── Judgment Interest Calculator ──────────────────────────────────────────────
// Based on Courts of Judicature Act 1964 (Act 91), s. 11
// Pre-judgment interest: s.11(1) — at court's discretion, default 5% p.a.
// Post-judgment interest: s.11(2) — prescribed 5% p.a. from date of judgment to date of payment

function JudgmentInterestCalculator() {
  const [principal, setPrincipal] = useState('');
  const [rate, setRate] = useState('5');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [interestType, setInterestType] = useState('pre');
  const [result, setResult] = useState<null | {
    days: number; totalInterest: number; totalSum: number; dailyRate: number;
  }>(null);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(principal);
    const r = parseFloat(rate);
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!p || !r || isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return;
    const days = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const totalInterest = p * (r / 100) * (days / 365);
    const dailyRate = p * (r / 100) / 365;
    setResult({
      days,
      totalInterest: Math.round(totalInterest * 100) / 100,
      totalSum: Math.round((p + totalInterest) * 100) / 100,
      dailyRate: Math.round(dailyRate * 100) / 100,
    });
  };

  const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card className="border-primary/30 shadow-xl shadow-primary/5">
      <CardHeader className="border-b border-border bg-card">
        <CardTitle className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-primary" /> Judgment Interest Calculator
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Courts of Judicature Act 1964 (Act 91), s. 11 — Pre- &amp; Post-judgment interest at 5% p.a. (prescribed rate)
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <form onSubmit={handleCalculate} className="space-y-4">
          <div className="space-y-2">
            <Label>Type of Interest</Label>
            <select
              className="flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              value={interestType}
              onChange={e => setInterestType(e.target.value)}
            >
              <option value="pre">Pre-judgment Interest (s. 11(1) CJA 1964)</option>
              <option value="post">Post-judgment Interest (s. 11(2) CJA 1964)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Principal / Judgment Sum (RM)</Label>
            <Input
              type="number"
              placeholder="e.g. 250000"
              value={principal}
              onChange={e => setPrincipal(e.target.value)}
              required min="1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>
                {interestType === 'pre' ? 'Date Cause of Action Arose' : 'Date of Judgment'}
              </Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>
                {interestType === 'pre' ? 'Date of Judgment' : 'Date of Full Payment'}
              </Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Interest Rate (% per annum)</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                placeholder="5"
                value={rate}
                onChange={e => setRate(e.target.value)}
                required min="0.1" max="100"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">% p.a.</span>
            </div>
            <p className="text-xs text-muted-foreground">Default: 5% p.a. (prescribed under CJA 1964, s. 11; court may vary)</p>
          </div>
          <Button type="submit" className="w-full">
            Calculate Interest
          </Button>
        </form>

        {result && (
          <div className="mt-2 p-5 bg-primary/5 border border-primary/20 rounded-xl space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {interestType === 'pre' ? 'Pre-Judgment Interest' : 'Post-Judgment Interest'}
              </p>
              <p className="text-4xl font-serif font-bold text-primary">RM {fmt(result.totalInterest)}</p>
              <p className="text-xs text-muted-foreground">Interest for {result.days} days</p>
            </div>
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex justify-between text-sm bg-background p-2 rounded border border-border">
                <span className="text-muted-foreground">Daily Interest Rate</span>
                <span className="font-mono font-medium">RM {fmt(result.dailyRate)} / day</span>
              </div>
              <div className="flex justify-between text-sm bg-background p-2 rounded border border-border">
                <span className="text-muted-foreground">Total Interest</span>
                <span className="font-mono font-medium text-primary">RM {fmt(result.totalInterest)}</span>
              </div>
              <div className="flex justify-between text-sm bg-primary/10 p-2 rounded border border-primary/20 font-semibold">
                <span>Total Sum Recoverable</span>
                <span className="font-mono text-primary">RM {fmt(result.totalSum)}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
              {interestType === 'pre'
                ? 'Pre-judgment interest awarded at court\'s discretion under s. 11(1) CJA 1964. Court may award from cause of action to date of judgment.'
                : 'Post-judgment interest runs at 5% p.a. as of right under s. 11(2) CJA 1964 from date judgment is pronounced until full satisfaction of the judgment sum.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Court Filing Fees Calculator ──────────────────────────────────────────────
// Based on Kaedah-Kaedah Mahkamah 2012 (Jadual Kos) / Rules of Court 2012 (Cost Schedule)
// Subordinate Courts Rules (Amendment) 2019 (updated jurisdictional limits)
// NOTE: Fees are APPROXIMATE guides — actual fees vary by registry and may be revised.
// Always verify current fees with the relevant court registry before filing.

const FILING_FEES: Record<string, Record<string, (amount: number) => { fee: number; note: string }>> = {
  high_court: {
    writ: (amt) => ({
      fee: amt <= 500_000 ? 800 : amt <= 1_000_000 ? 1200 : amt <= 5_000_000 ? 2000 : 4000,
      note: amt <= 500_000 ? 'Writ of Summons: claims up to RM500,000 (approx. — verify with registry)' : amt <= 1_000_000 ? 'Writ of Summons: claims RM500,001 – RM1 million (approx.)' : amt <= 5_000_000 ? 'Writ of Summons: claims RM1M – RM5M (approx.)' : 'Writ of Summons: claims above RM5 million (approx.)',
    }),
    originating_summons: () => ({ fee: 600, note: 'Originating Summons (Order 7 / Order 28 / Order 83 ROC 2012) — approx.' }),
    judicial_review: () => ({ fee: 600, note: 'OS for Judicial Review (Order 53 ROC 2012) — approx.' }),
    winding_up: () => ({ fee: 1500, note: 'Winding Up Petition (Companies Act 2016, s. 464) — includes deposit (approx.)' }),
    bankruptcy_petition: () => ({ fee: 800, note: "Creditor's Petition (Insolvency Act 1967) — RM50,000 minimum debt threshold (approx.)" }),
    interlocutory: () => ({ fee: 100, note: 'Per interlocutory application / summons in chambers (approx.)' }),
    notice_of_appeal: () => ({ fee: 1000, note: 'Notice of Appeal to Court of Appeal (approx.)' }),
    garnishee: () => ({ fee: 100, note: 'Garnishee proceedings (Order 49 ROC 2012) — per application (approx.)' }),
  },
  sessions_court: {
    civil_claim: (amt) => ({
      fee: amt <= 100_000 ? 200 : amt <= 500_000 ? 400 : 600,
      note: 'Sessions Court: jurisdiction up to RM1 million (Subordinate Courts (Amendment) Act 2019) — approx.',
    }),
  },
  magistrates_court: {
    civil_claim: (amt) => ({
      fee: amt <= 25_000 ? 80 : amt <= 50_000 ? 120 : 200,
      note: "Magistrates' Court: jurisdiction up to RM100,000 (Subordinate Courts (Amendment) Act 2019) — approx.",
    }),
  },
};

function FilingFeesCalculator() {
  const [court, setCourt] = useState('high_court');
  const [proceedingType, setProceedingType] = useState('writ');
  const [claimAmount, setClaimAmount] = useState('');
  const [result, setResult] = useState<null | { fee: number; note: string }>(null);

  const COURT_OPTIONS: Record<string, { label: string; proceedings: Record<string, string> }> = {
    high_court: {
      label: 'High Court',
      proceedings: {
        writ: 'Writ of Summons (General Civil Claim)',
        originating_summons: 'Originating Summons',
        judicial_review: 'Judicial Review (Order 53)',
        winding_up: 'Winding Up Petition',
        bankruptcy_petition: "Creditor's Bankruptcy Petition",
        interlocutory: 'Interlocutory Application / Summons',
        notice_of_appeal: 'Notice of Appeal (Court of Appeal)',
        garnishee: 'Garnishee Proceedings (Order 49)',
      },
    },
    sessions_court: {
      label: 'Sessions Court',
      proceedings: { civil_claim: 'Civil Claim' },
    },
    magistrates_court: {
      label: "Magistrates' Court",
      proceedings: { civil_claim: 'Civil Claim' },
    },
  };

  const needsAmount = ['writ', 'civil_claim'].includes(proceedingType);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(claimAmount) || 0;
    const calcFn = FILING_FEES[court]?.[proceedingType];
    if (!calcFn) return;
    setResult(calcFn(amt));
  };

  const handleCourtChange = (val: string) => {
    setCourt(val);
    const firstProceeding = Object.keys(COURT_OPTIONS[val].proceedings)[0];
    setProceedingType(firstProceeding);
    setResult(null);
  };

  const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card className="border-primary/30 shadow-xl shadow-primary/5">
      <CardHeader className="border-b border-border bg-card">
        <CardTitle className="flex items-center gap-2">
          <Gavel className="h-5 w-5 text-primary" /> Court Filing Fees Calculator
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Illustrative estimates based on general court fee schedules. These are NOT statutory fee amounts — actual filing fees vary by court registry, proceeding type, and may be revised without notice. Always confirm current fees with the relevant court registry before filing.
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <form onSubmit={handleCalculate} className="space-y-4">
          <div className="space-y-2">
            <Label>Court</Label>
            <select
              className="flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              value={court}
              onChange={e => handleCourtChange(e.target.value)}
            >
              {Object.entries(COURT_OPTIONS).map(([val, opt]) => (
                <option key={val} value={val}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Type of Proceeding</Label>
            <select
              className="flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              value={proceedingType}
              onChange={e => { setProceedingType(e.target.value); setResult(null); }}
            >
              {Object.entries(COURT_OPTIONS[court].proceedings).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          {needsAmount && (
            <div className="space-y-2">
              <Label>Claim Amount (RM)</Label>
              <Input
                type="number"
                placeholder="e.g. 150000"
                value={claimAmount}
                onChange={e => setClaimAmount(e.target.value)}
                min="0"
              />
            </div>
          )}
          <Button type="submit" className="w-full">
            Calculate Filing Fee
          </Button>
        </form>

        {result && (
          <div className="mt-2 p-5 bg-primary/5 border border-primary/20 rounded-xl space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Filing Fee Payable</p>
              <p className="text-4xl font-serif font-bold text-primary">RM {fmt(result.fee)}</p>
            </div>
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-sm text-foreground">{result.note}</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="flex items-start gap-1.5"><AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /> Additional disbursements apply: service of process, affidavit filing fees, hearing fees.</p>
                <p className="flex items-start gap-1.5"><AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /> Filing fees are subject to change; verify current amounts with the relevant court registry.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Court Deadline Calculator ─────────────────────────────────────────────
// Pure deterministic date math. Each rule cites the governing Malaysian rule.

type DeadlineRule = {
  id: string;
  label: string;
  days: number;
  basis: 'calendar' | 'clear';   // 'clear' = exclusive of first & last day
  citation: string;
  note?: string;
};

const DEADLINE_RULES: DeadlineRule[] = [
  // Pleadings (ROC 2012)
  { id: 'appearance', label: 'Memorandum of Appearance — after service of Writ', days: 14, basis: 'calendar', citation: 'Order 12 r.4 ROC 2012', note: '14 days where served within Malaysia. Different periods apply for service out of jurisdiction (O.10 r.2A).' },
  { id: 'defence', label: 'Statement of Defence — after entry of appearance', days: 14, basis: 'calendar', citation: 'Order 18 r.2 ROC 2012', note: 'Or after time limited for appearance, whichever is later.' },
  { id: 'reply', label: 'Reply / Defence to Counterclaim — after service of Defence', days: 14, basis: 'calendar', citation: 'Order 18 r.3 ROC 2012' },
  { id: 'amend-once', label: 'Amend pleading once without leave (before pleadings closed)', days: 14, basis: 'calendar', citation: 'Order 20 r.3 ROC 2012' },

  // Default judgment
  { id: 'set-aside-dj', label: 'Set aside Default Judgment (regular) — practitioner rule of thumb', days: 30, basis: 'calendar', citation: 'Order 13 r.8 / Order 19 r.9 ROC 2012', note: 'No fixed deadline — must be "as soon as reasonably practicable". Beyond 30 days the court may treat the delay as inordinate (Hasil Bumi Perumahan v United Malayan Banking Corp [1994] 1 MLJ 312).' },
  { id: 'set-aside-ex-parte', label: 'Apply to set aside / vary an ex parte order', days: 14, basis: 'calendar', citation: 'Order 32 r.6 ROC 2012' },

  // Discovery & Interrogatories
  { id: 'list-of-docs', label: 'Serve List of Documents (after pleadings closed)', days: 14, basis: 'calendar', citation: 'Order 24 r.2 ROC 2012' },
  { id: 'inspect', label: 'Inspect documents — after service of List', days: 7, basis: 'calendar', citation: 'Order 24 r.9 ROC 2012' },
  { id: 'answer-interrog', label: 'Answer interrogatories', days: 14, basis: 'calendar', citation: 'Order 26 r.3(1) ROC 2012' },

  // Striking-out / SJ
  { id: 'sj-affd-reply', label: 'O.14 — Affidavit in Reply to Summary Judgment application', days: 14, basis: 'calendar', citation: 'Practice Direction; Order 14 ROC 2012', note: 'Court may direct shorter or longer time. Confirm at first directions hearing.' },

  // Appeals — to Court of Appeal
  { id: 'noa-coa', label: 'Notice of Appeal — High Court to Court of Appeal', days: 30, basis: 'calendar', citation: 'Rule 12 Rules of the Court of Appeal 1994', note: 'From date of decision sought to be appealed against. Strict — extension is only granted in exceptional circumstances.' },
  { id: 'moa-coa', label: 'Memorandum of Appeal — after receipt of Grounds of Judgment & Notes of Proceedings', days: 56, basis: 'calendar', citation: 'Rule 18 Rules of the Court of Appeal 1994', note: '8 weeks. Must be filed and served on all respondents.' },

  // Appeals — Federal Court
  { id: 'leave-fc', label: 'Notice of Motion for Leave to Appeal — to Federal Court', days: 30, basis: 'calendar', citation: 'Rule 4 Rules of the Federal Court 1995', note: 'From date of decision of Court of Appeal.' },
  { id: 'noa-fc', label: 'Notice of Appeal to Federal Court — after grant of leave', days: 14, basis: 'calendar', citation: 'Rule 49 Rules of the Federal Court 1995' },

  // Subordinate Court appeals
  { id: 'noa-sub-hc', label: 'Notice of Appeal — Sessions / Magistrates to High Court', days: 14, basis: 'calendar', citation: 'Section 28 Subordinate Courts Act 1948 / O.55 ROC 2012' },

  // Other key timelines
  { id: 'settle-order', label: 'Settle Sealed Order with opposing counsel', days: 14, basis: 'calendar', citation: 'Order 42 r.5 ROC 2012' },
  { id: 'taxation', label: 'File Bill of Costs for taxation — after order for costs', days: 180, basis: 'calendar', citation: 'Order 59 r.20 ROC 2012', note: '6 months. Beyond this, leave required.' },
  { id: 'arbitration-set-aside', label: 'Set aside Arbitration Award (s.37 Arbitration Act 2005)', days: 90, basis: 'calendar', citation: 'Section 37(4) Arbitration Act 2005', note: '3 months from date of receipt of the award. Strict — extension generally not available.' },
  { id: 'jr-leave', label: 'Apply for leave for Judicial Review', days: 90, basis: 'calendar', citation: 'Order 53 r.3(6) ROC 2012', note: '3 months from date of decision (or when grounds first arose). Court has discretion to extend.' },
  { id: 'enforce-judgment', label: 'Enforce judgment without leave', days: 2190, basis: 'calendar', citation: 'Order 46 r.2 ROC 2012', note: '6 years. After 6 years, leave to issue execution required.' },

  // Bankruptcy / Winding-up
  { id: 'wind-up-petition', label: 'Winding-up petition — after service of statutory notice (s.466 CA 2016)', days: 21, basis: 'calendar', citation: 'Section 466(1)(a) Companies Act 2016', note: 'Statutory notice requires payment within 21 days; petition may then be presented if unpaid.' },
  { id: 'bankruptcy-act', label: 'Bankruptcy notice — judgment debtor to satisfy', days: 7, basis: 'calendar', citation: 'Section 3(2)(i) Insolvency Act 1967', note: 'After service: failure to satisfy within 7 days = act of bankruptcy.' },
];

function CourtDeadlineCalculator() {
  const [ruleId, setRuleId] = useState(DEADLINE_RULES[0].id);
  const [eventDate, setEventDate] = useState('');
  const [result, setResult] = useState<null | {
    deadline: Date;
    rule: DeadlineRule;
    daysFromToday: number;
    isUrgent: boolean;
    isOverdue: boolean;
  }>(null);

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const rule = DEADLINE_RULES.find(r => r.id === ruleId);
    if (!rule || !eventDate) return;
    const start = new Date(eventDate);
    if (isNaN(start.getTime())) return;
    const deadline = new Date(start);
    // Default: simple calendar-day count; if "clear" days, exclusive of first & last
    deadline.setDate(deadline.getDate() + rule.days + (rule.basis === 'clear' ? 1 : 0));
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const daysFromToday = Math.floor((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    setResult({
      deadline,
      rule,
      daysFromToday,
      isUrgent: daysFromToday >= 0 && daysFromToday <= 7,
      isOverdue: daysFromToday < 0,
    });
  };

  const selected = DEADLINE_RULES.find(r => r.id === ruleId);

  return (
    <Card className="border-primary/30 shadow-xl shadow-primary/5">
      <CardHeader className="border-b border-border bg-card">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" /> Court Deadline Calculator
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Computes statutory and rule-based deadlines in Malaysian civil procedure with the governing rule cited.
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <form onSubmit={handleCalculate} className="space-y-4">
          <div className="space-y-2">
            <Label>Procedural Step / Rule</Label>
            <select
              className="flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              value={ruleId}
              onChange={e => setRuleId(e.target.value)}
            >
              {DEADLINE_RULES.map(r => (
                <option key={r.id} value={r.id}>{r.label} — {r.days < 365 ? `${r.days} days` : `${Math.round(r.days / 30)} months`}</option>
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
            <Label>Triggering Event Date</Label>
            <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
            <p className="text-xs text-muted-foreground">
              e.g. date of service, date of order, date of judgment — whichever the rule counts from.
            </p>
          </div>
          <Button type="submit" className="w-full">Calculate Deadline</Button>
        </form>

        {result && (
          <div className={`mt-2 p-5 rounded-xl space-y-4 animate-in fade-in slide-in-from-bottom-2 border ${
            result.isOverdue ? 'border-red-500/40 bg-red-500/5' :
            result.isUrgent ? 'border-amber-500/40 bg-amber-500/5' :
            'border-primary/20 bg-primary/5'
          }`}>
            <div className="text-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Deadline</p>
              <p className={`text-2xl font-serif font-bold ${
                result.isOverdue ? 'text-red-400' : result.isUrgent ? 'text-amber-400' : 'text-primary'
              }`}>{fmtDate(result.deadline)}</p>
              <p className={`text-sm mt-1 font-semibold ${
                result.isOverdue ? 'text-red-400' : result.isUrgent ? 'text-amber-400' : 'text-muted-foreground'
              }`}>
                {result.isOverdue
                  ? `OVERDUE by ${Math.abs(result.daysFromToday)} day${Math.abs(result.daysFromToday) === 1 ? '' : 's'}`
                  : `${result.daysFromToday} day${result.daysFromToday === 1 ? '' : 's'} from today`}
              </p>
            </div>
            <div className="pt-3 border-t border-border/60 space-y-1.5 text-xs text-muted-foreground">
              <p><span className="font-semibold text-foreground">Rule:</span> {result.rule.label}</p>
              <p><span className="font-semibold text-foreground">Authority:</span> <span className="font-mono text-primary/80">{result.rule.citation}</span></p>
              <p className="flex items-start gap-1.5 pt-1">
                <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                <span>If the deadline falls on a weekend or public holiday, time is extended to the next working day (Order 3 r.5(2) ROC 2012). If serving documents, account for service rules — e.g. AR Registered post is deemed served upon proof of receipt.</span>
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Stamp Duty Calculator ─────────────────────────────────────────────────
// Stamp Act 1949 (Act 378) — First Schedule. Rates effective 2024-2025.

type StampInstrument = {
  id: string;
  label: string;
  citation: string;
  compute: (amount: number) => { duty: number; breakdown: string[] };
};

const STAMP_INSTRUMENTS: StampInstrument[] = [
  {
    id: 'spa',
    label: 'Sale & Purchase / Transfer of Property (Memorandum of Transfer — Form 14A)',
    citation: 'Stamp Act 1949, First Schedule, Item 32(a) — ad valorem',
    compute: (v) => {
      // Tiered: 1% on first RM100k; 2% next RM400k; 3% next RM500k; 4% above RM1m
      const tiers = [
        { upper: 100000, rate: 0.01 },
        { upper: 500000, rate: 0.02 },
        { upper: 1000000, rate: 0.03 },
        { upper: Infinity, rate: 0.04 },
      ];
      let duty = 0; let prev = 0; const breakdown: string[] = [];
      for (const t of tiers) {
        if (v > prev) {
          const slice = Math.min(v, t.upper) - prev;
          const d = slice * t.rate;
          duty += d;
          breakdown.push(`First RM${slice.toLocaleString()} @ ${(t.rate * 100).toFixed(0)}% = RM${d.toFixed(2)}`);
          prev = t.upper;
          if (v <= t.upper) break;
        }
      }
      return { duty: Math.round(duty * 100) / 100, breakdown };
    },
  },
  {
    id: 'loan',
    label: 'Loan / Facility Agreement (principal sum secured)',
    citation: 'Stamp Act 1949, First Schedule, Item 27(a)(i)',
    compute: (v) => {
      const duty = Math.round(v * 0.005 * 100) / 100;
      return { duty, breakdown: [`0.5% of RM${v.toLocaleString()} = RM${duty.toFixed(2)}`] };
    },
  },
  {
    id: 'tenancy-1y',
    label: 'Tenancy Agreement — term up to 1 year (annual rent)',
    citation: 'Stamp Act 1949, First Schedule, Item 49(a)',
    compute: (v) => {
      // RM1 for every RM250 (or part thereof) of annual rent above RM2,400
      if (v <= 2400) return { duty: 0, breakdown: ['Annual rent ≤ RM2,400 — exempt'] };
      const taxable = v - 2400;
      const units = Math.ceil(taxable / 250);
      const duty = units * 1;
      return { duty, breakdown: [`Annual rent RM${v.toLocaleString()} – RM2,400 exempt = RM${taxable.toLocaleString()}`, `${units} × RM1 (per RM250 or part) = RM${duty.toFixed(2)}`] };
    },
  },
  {
    id: 'tenancy-3y',
    label: 'Tenancy Agreement — term 1-3 years (annual rent)',
    citation: 'Stamp Act 1949, First Schedule, Item 49(b)',
    compute: (v) => {
      if (v <= 2400) return { duty: 0, breakdown: ['Annual rent ≤ RM2,400 — exempt'] };
      const taxable = v - 2400;
      const units = Math.ceil(taxable / 250);
      const duty = units * 2;
      return { duty, breakdown: [`Annual rent RM${v.toLocaleString()} – RM2,400 exempt = RM${taxable.toLocaleString()}`, `${units} × RM2 (per RM250 or part) = RM${duty.toFixed(2)}`] };
    },
  },
  {
    id: 'tenancy-3y+',
    label: 'Tenancy / Lease — term over 3 years (annual rent)',
    citation: 'Stamp Act 1949, First Schedule, Item 49(c)',
    compute: (v) => {
      if (v <= 2400) return { duty: 0, breakdown: ['Annual rent ≤ RM2,400 — exempt'] };
      const taxable = v - 2400;
      const units = Math.ceil(taxable / 250);
      const duty = units * 4;
      return { duty, breakdown: [`Annual rent RM${v.toLocaleString()} – RM2,400 exempt = RM${taxable.toLocaleString()}`, `${units} × RM4 (per RM250 or part) = RM${duty.toFixed(2)}`] };
    },
  },
  {
    id: 'service',
    label: 'Service / Consultancy Agreement (contract value)',
    citation: 'Stamp Act 1949, First Schedule, Item 22(1)(a)',
    compute: (v) => {
      const duty = Math.round(v * 0.001 * 100) / 100;
      return { duty, breakdown: [`0.1% of RM${v.toLocaleString()} = RM${duty.toFixed(2)}`, 'Capped at RM2,000 per Stamp Duty (Remission) (No. 4) Order 2024'] };
    },
  },
  {
    id: 'general',
    label: 'General Agreement / MOU (no monetary consideration)',
    citation: 'Stamp Act 1949, First Schedule, Item 4',
    compute: () => ({ duty: 10, breakdown: ['Fixed duty: RM10'] }),
  },
  {
    id: 'pa',
    label: 'Power of Attorney (general)',
    citation: 'Stamp Act 1949, First Schedule, Item 39(a)',
    compute: () => ({ duty: 10, breakdown: ['Fixed duty: RM10'] }),
  },
  {
    id: 'statutory-decl',
    label: 'Statutory Declaration',
    citation: 'Stamp Act 1949, First Schedule, Item 44',
    compute: () => ({ duty: 10, breakdown: ['Fixed duty: RM10'] }),
  },
];

function StampDutyCalculator() {
  const [instrumentId, setInstrumentId] = useState(STAMP_INSTRUMENTS[0].id);
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<null | {
    duty: number;
    breakdown: string[];
    instrument: StampInstrument;
  }>(null);

  const fmt = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const inst = STAMP_INSTRUMENTS.find(i => i.id === instrumentId);
    if (!inst) return;
    const v = parseFloat(amount) || 0;
    const r = inst.compute(v);
    setResult({ ...r, instrument: inst });
  };

  const selected = STAMP_INSTRUMENTS.find(i => i.id === instrumentId);
  const requiresAmount = selected && !['general', 'pa', 'statutory-decl'].includes(selected.id);

  return (
    <Card className="border-primary/30 shadow-xl shadow-primary/5">
      <CardHeader className="border-b border-border bg-card">
        <CardTitle className="flex items-center gap-2">
          <Stamp className="h-5 w-5 text-primary" /> Stamp Duty Calculator
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Stamp Act 1949 (Act 378), First Schedule — for instruments commonly attached to litigation matters.
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        <form onSubmit={handleCalculate} className="space-y-4">
          <div className="space-y-2">
            <Label>Instrument Type</Label>
            <select
              className="flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              value={instrumentId}
              onChange={e => { setInstrumentId(e.target.value); setResult(null); }}
            >
              {STAMP_INSTRUMENTS.map(i => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
            </select>
            {selected && (
              <p className="text-xs text-muted-foreground italic">
                <span className="font-mono not-italic text-primary/80">{selected.citation}</span>
              </p>
            )}
          </div>
          {requiresAmount && (
            <div className="space-y-2">
              <Label>{selected?.id === 'spa' ? 'Property Consideration / Market Value (RM)' :
                       selected?.id === 'loan' ? 'Principal Loan Amount (RM)' :
                       selected?.id === 'service' ? 'Contract Value (RM)' :
                       'Annual Rent (RM)'}</Label>
              <Input
                type="number"
                placeholder="e.g. 500000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required={requiresAmount} min="0" step="any"
              />
            </div>
          )}
          <Button type="submit" className="w-full">Calculate Stamp Duty</Button>
        </form>

        {result && (
          <div className="mt-2 p-5 bg-primary/5 border border-primary/20 rounded-xl space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="text-center">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Stamp Duty Payable</p>
              <p className="text-4xl font-serif font-bold text-primary">RM {fmt(result.duty)}</p>
            </div>
            <div className="pt-4 border-t border-border space-y-2">
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground mb-1">Computation:</p>
                {result.breakdown.map((line, i) => (
                  <p key={i} className="font-mono text-xs">• {line}</p>
                ))}
              </div>
              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
                <p className="flex items-start gap-1.5"><AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /> Stamping must be done within 30 days of execution (s.47 Stamp Act 1949). Late stamping attracts penalty: max RM50 / 4× duty (s.47A).</p>
                <p className="flex items-start gap-1.5"><AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /> An unstamped instrument is inadmissible in evidence (s.52 Stamp Act 1949) until stamped + penalty paid.</p>
                <p className="flex items-start gap-1.5"><AlertCircle className="h-3 w-3 shrink-0 mt-0.5" /> Exemptions and reliefs may apply (Stamp Duty (Exemption) Orders). Verify with LHDN STAMPS portal.</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function Costs() {
  const { data: schedules, isLoading } = useListCostSchedules();

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-12">
      <PageHeader
        title="Costs & Fee Schedules"
        description="Litigation cost calculators and verified fee schedules for civil proceedings in Malaysian courts."
      />

      {/* Calculators */}
      <section>
        <h2 className="text-2xl font-serif font-bold flex items-center gap-2 border-b border-border pb-3 mb-6">
          <Calculator className="h-6 w-6 text-primary" /> Litigation Calculators
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <JudgmentInterestCalculator />
          <FilingFeesCalculator />
          <CourtDeadlineCalculator />
          <StampDutyCalculator />
        </div>
        <p className="text-xs text-muted-foreground mt-4 flex items-start gap-1.5">
          <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
          <span>For educational purposes only. Verify all amounts with the relevant court registry, Bar Council, or AIAC. Rates and fees are subject to legislative amendment. Not a substitute for professional legal advice.</span>
        </p>
      </section>

      {/* Cost Schedules */}
      <section>
        <h2 className="text-2xl font-serif font-bold flex items-center gap-2 border-b border-border pb-3 mb-6">
          <FileSpreadsheet className="h-6 w-6 text-primary" /> Scale Costs &amp; Fee Schedules
        </h2>
        {isLoading ? (
          <div className="text-center p-8 text-primary animate-pulse">Loading schedules...</div>
        ) : (
          <div className="space-y-6">
            {schedules?.map((schedule: any) => (
              <Card key={schedule.id}>
                <CardHeader className="py-4 bg-secondary/20">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <CardTitle className="text-lg leading-snug">{schedule.title}</CardTitle>
                    <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-1 rounded border border-border shrink-0 max-w-xs truncate" title={schedule.legislativeBasis}>
                      {schedule.legislativeBasis}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{schedule.description}</p>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <tbody>
                      {schedule.items.map((item: any, idx: any) => (
                        <tr key={idx} className="border-b border-border last:border-0 hover:bg-secondary/10 transition-colors">
                          <td className="p-4 align-top w-2/3">
                            <span className="font-medium text-foreground">{item.description}</span>
                            {item.notes && <p className="text-xs text-muted-foreground mt-1">{item.notes}</p>}
                          </td>
                          <td className="p-4 align-top w-1/3 text-right font-mono font-semibold text-primary text-xs leading-snug">
                            {item.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            ))}
            {(!schedules || schedules.length === 0) && (
              <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                No cost schedules available.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
