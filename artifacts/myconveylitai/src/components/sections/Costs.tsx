import React, { useState } from 'react';
import { Calculator, Loader2, AlertCircle, Info, Building2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGenerateDraft } from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';

const STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan',
  'Pahang', 'Perak', 'Perlis', 'Pulau Pinang', 'Sabah',
  'Sarawak', 'Selangor', 'Terengganu',
  'W.P. Kuala Lumpur', 'W.P. Labuan', 'W.P. Putrajaya'
];

const SST_RATE = 0.08; // Service Tax on legal services, 8% from 1 March 2024

interface FormState {
  // Purchaser side
  purchasePrice: string;
  loanAmount: string;
  state: string;
  propertyType: 'residential' | 'commercial';
  titleType: 'individual' | 'strata' | 'master';
  isFirstHome: boolean;
  isNewDev: boolean;
  // Vendor / RPGT side
  computeRPGT: boolean;
  vendorType: 'citizen' | 'company' | 'foreigner';
  acquisitionPrice: string;
  acquisitionDate: string;
  disposalDate: string;
  allowableExpenses: string;
  privateResExemption: boolean;
}

function fmt(n: number) {
  return 'RM ' + n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcBand(price: number): number {
  let duty = 0;
  if (price <= 100000) return price * 0.01;
  duty += 100000 * 0.01;
  if (price <= 500000) return duty + (price - 100000) * 0.02;
  duty += 400000 * 0.02;
  if (price <= 1000000) return duty + (price - 500000) * 0.03;
  duty += 500000 * 0.03;
  return duty + (price - 1000000) * 0.04;
}

function calcStampDutyMOT(price: number, firstHome: boolean, residential: boolean): number {
  // First-home exemption (i-MILIKI) is threshold-based on the whole instrument duty:
  //   price <= RM500,000          -> 100% exempt (duty = 0)
  //   RM500,001 - RM1,000,000     -> 50% of the full ad valorem duty
  //   above RM1,000,000           -> no first-home exemption (full duty)
  if (firstHome && residential) {
    if (price <= 500000) return 0;
    if (price <= 1000000) return calcBand(price) * 0.5;
  }
  return calcBand(price);
}

function calcStampDutyLoan(loan: number): number {
  return loan * 0.005;
}

// SRO 2023 Scale A (Solicitors' Remuneration Order 2023, P.U.(A) 207).
// Applies to both Jadual Pertama (sale/transfer) and Jadual Ketiga (charge/loan):
//   first RM500,000        -> 1.25% (subject to a RM500 minimum)
//   next  RM7,000,000      -> 1%   (i.e. the RM500,001 – RM7,500,000 band)
//   above RM7,500,000      -> negotiable on the excess, capped at 1%
function calcLegalFeesScaleA(amount: number): number {
  if (amount <= 0) return 0;
  let fee = 0;
  if (amount <= 500000) {
    fee = amount * 0.0125;
  } else {
    // For any amount above RM500k the marginal rate is a flat 1% (the
    // RM7m band and the negotiable excess above RM7.5m both ceil at 1%).
    fee = 500000 * 0.0125 + (amount - 500000) * 0.01;
  }
  return Math.max(fee, 500);
}

// SRO 2023 Susunan B — transactions under the Housing Development (Control and
// Licensing) Act 1966 (purchase from a licensed housing developer). The fee is
// a reduced percentage of the Scale A fee:
//   RM50,000 or less          -> RM500 (flat)
//   RM50,001 – RM250,000      -> 75% of Scale A (min RM500)
//   RM250,001 – RM500,000     -> 70% of Scale A
//   RM500,001 – RM1,000,000   -> 65% of Scale A
//   above RM1,000,000         -> 50% of Scale A
function calcLegalFeesSRO(amount: number, housingDev: boolean): number {
  if (amount <= 0) return 0;
  const scaleA = calcLegalFeesScaleA(amount);
  if (!housingDev) return scaleA;
  if (amount <= 50000) return 500;
  let pct: number;
  if (amount <= 250000) pct = 0.75;
  else if (amount <= 500000) pct = 0.70;
  else if (amount <= 1000000) pct = 0.65;
  else pct = 0.50;
  return Math.max(scaleA * pct, 500);
}

function yearsBetween(fromISO: string, toISO: string): number {
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return (b - a) / (365.25 * 24 * 3600 * 1000);
}

interface RPGTResult {
  applicable: boolean;
  grossGain: number;
  schedule4Exemption: number;
  chargeableGain: number;
  holdingYears: number;
  rate: number; // percent
  tax: number;
  retentionRate: number; // percent
  retention: number;
  exempt: boolean;
  note: string;
}

function calcRPGTReal(
  disposalPrice: number,
  acquisitionPrice: number,
  allowableExpenses: number,
  acqDate: string,
  dispDate: string,
  vendorType: FormState['vendorType'],
  privateResExemption: boolean
): RPGTResult {
  const grossGain = disposalPrice - acquisitionPrice - allowableExpenses;
  const holdingYears = yearsBetween(acqDate, dispDate);

  // Rate by holding period (RPGT Act 1976, as amended)
  let rate = 0;
  if (vendorType === 'company') {
    if (holdingYears <= 3) rate = 30;
    else if (holdingYears <= 4) rate = 20;
    else if (holdingYears <= 5) rate = 15;
    else rate = 10;
  } else if (vendorType === 'foreigner') {
    rate = holdingYears <= 5 ? 30 : 10;
  } else {
    // Malaysian citizen / PR individual
    if (holdingYears <= 3) rate = 30;
    else if (holdingYears <= 4) rate = 20;
    else if (holdingYears <= 5) rate = 15;
    else rate = 0;
  }

  // Acquirer's retention obligation under s.21B: 3% (citizen/company) or 7% (foreigner)
  const retentionRate = vendorType === 'foreigner' ? 7 : 3;
  const retention = disposalPrice * (retentionRate / 100);

  // Once-in-a-lifetime private residence exemption (Malaysian citizen/PR individuals only)
  if (privateResExemption && vendorType === 'citizen') {
    return {
      applicable: true, grossGain, schedule4Exemption: 0,
      chargeableGain: Math.max(grossGain, 0), holdingYears, rate, tax: 0,
      retentionRate, retention, exempt: true,
      note: 'Once-in-a-lifetime private residence exemption claimed (Sch 4 para 9). RPGT nil, but 3% retention may still apply pending LHDN clearance via CKHT 3.'
    };
  }

  if (grossGain <= 0) {
    return {
      applicable: true, grossGain, schedule4Exemption: 0, chargeableGain: 0,
      holdingYears, rate, tax: 0, retentionRate, retention, exempt: false,
      note: 'No chargeable gain (disposal price does not exceed acquisition price plus allowable expenses) — an allowable loss may be available to carry forward.'
    };
  }

  // Schedule 4 exemption for individuals: greater of RM10,000 or 10% of chargeable gain
  const schedule4Exemption = vendorType === 'company' ? 0 : Math.max(10000, grossGain * 0.1);
  const chargeableGain = Math.max(grossGain - schedule4Exemption, 0);
  const tax = chargeableGain * (rate / 100);

  return {
    applicable: true, grossGain, schedule4Exemption, chargeableGain, holdingYears,
    rate, tax, retentionRate, retention, exempt: rate === 0,
    note: rate === 0
      ? 'Disposal after 5 full years by a Malaysian citizen/PR individual — 0% RPGT. The 3% retention is still withheld and refunded after LHDN clearance.'
      : `Holding period ${holdingYears.toFixed(2)} years → ${rate}% on chargeable gain after Schedule 4 exemption.`
  };
}

interface ResultRow { label: string; amount: number; note?: string; highlight?: boolean }

function ResultCard({ row, index }: { row: ResultRow; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-xl border p-4 ${row.highlight ? 'border-amber-500/30 bg-amber-500/5' : 'border-gold-700 bg-gold-900'}`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-sm font-medium ${row.highlight ? 'text-amber-400' : 'text-slate-300'}`}>{row.label}</span>
        <div className="flex items-center gap-2">
          <span className={`font-mono font-bold text-base ${row.highlight ? 'text-amber-400' : 'text-slate-100'}`}>{fmt(row.amount)}</span>
          {row.note && (
            <button onClick={() => setOpen(v => !v)} className="text-slate-500 hover:text-slate-300 transition-colors">
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {open && row.note && (
          <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="text-xs text-slate-400 mt-2 border-t border-gold-700 pt-2 overflow-hidden">
            {row.note}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function CostsSection() {
  const { toast } = useToast();
  const draftMutation = useGenerateDraft();
  const [form, setForm] = useState<FormState>({
    purchasePrice: '',
    loanAmount: '',
    state: 'Selangor',
    propertyType: 'residential',
    titleType: 'individual',
    isFirstHome: false,
    isNewDev: false,
    computeRPGT: false,
    vendorType: 'citizen',
    acquisitionPrice: '',
    acquisitionDate: '',
    disposalDate: '',
    allowableExpenses: '',
    privateResExemption: false,
  });
  const [purchaserRows, setPurchaserRows] = useState<ResultRow[] | null>(null);
  const [vendorRows, setVendorRows] = useState<ResultRow[] | null>(null);
  const [aiExplanation, setAiExplanation] = useState('');
  const [loadingAI, setLoadingAI] = useState(false);

  const price = parseFloat(form.purchasePrice.replace(/,/g, '')) || 0;
  const loan = parseFloat(form.loanAmount.replace(/,/g, '')) || 0;
  const acqPrice = parseFloat(form.acquisitionPrice.replace(/,/g, '')) || 0;
  const allowable = parseFloat(form.allowableExpenses.replace(/,/g, '')) || 0;

  const handleCalculate = () => {
    if (!price) {
      toast({ title: 'Please enter a purchase / disposal price', variant: 'destructive' });
      return;
    }

    const residential = form.propertyType === 'residential';
    const motDuty = calcStampDutyMOT(price, form.isFirstHome && residential, residential);
    const loanDuty = loan ? calcStampDutyLoan(loan) : 0;
    const legalSPA = calcLegalFeesSRO(price, form.isNewDev);
    const legalLoan = loan ? calcLegalFeesSRO(loan, form.isNewDev) : 0;
    const sst = (legalSPA + legalLoan) * SST_RATE;
    const valuationFee = loan ? Math.min(Math.max(loan * 0.0025, 100), 3000) : 0;
    const landSearch = 25;
    const bankruptcySearch = 21;
    const landOfficeReg = Math.min(Math.max(Math.round(price / 100000) * 10, 10), 300);
    const misc = 300;

    const pRows: ResultRow[] = [
      {
        label: 'Stamp Duty — Memorandum of Transfer (MOT)',
        amount: motDuty,
        note: form.isFirstHome && residential
          ? 'First-home exemption (i-MILIKI): 100% exempt if price \u2264 RM500k; 50% of the full duty for RM500,001\u2013RM1,000,000; full duty above RM1m. Base ad valorem scale: 1% first RM100k, 2% next RM400k, 3% next RM500k, 4% above RM1m.'
          : 'Ad valorem scale (Stamp Act 1949): 1% on first RM100k, 2% next RM400k, 3% next RM500k, 4% above RM1m.'
      },
      {
        label: 'Stamp Duty — Loan / Charge Agreement (0.5%)',
        amount: loanDuty,
        note: loan ? `0.5% ad valorem on facility amount of ${fmt(loan)} (Stamp Act 1949, First Schedule).` : 'No loan amount entered — cash purchase.'
      },
      {
        label: 'Legal Fees — SPA / Transfer (SRO 2023)',
        amount: legalSPA,
        note: form.isNewDev
          ? 'SRO 2023 Jadual Pertama, Susunan B (Housing Development Act sale): RM500 flat (≤RM50k); 75% of Scale A (RM50k–250k); 70% (RM250k–500k); 65% (RM500k–1m); 50% (>RM1m). Minimum RM500.'
          : 'SRO 2023 Jadual Pertama, Susunan A: 1.25% on the first RM500,000; 1% on the next RM7,000,000; negotiable (max 1%) above RM7,500,000. Minimum RM500.'
      },
      {
        label: 'Legal Fees — Loan / Security Documentation (SRO 2023)',
        amount: legalLoan,
        note: loan
          ? (form.isNewDev
              ? `SRO 2023 Jadual Ketiga, Susunan B applied to the loan/charge documentation on ${fmt(loan)} (Housing Development Act financing).`
              : `SRO 2023 Jadual Ketiga, Susunan A applied to the loan/charge documentation on ${fmt(loan)}: 1.25% first RM500k, 1% next RM7m.`)
          : 'No loan amount entered.'
      },
      {
        label: 'SST on Legal Fees (8%)',
        amount: sst,
        note: 'Service Tax at 8% (raised from 6% on 1 March 2024) is chargeable on solicitors\u2019 professional fees where the firm is SST-registered.'
      },
    ];

    if (loan) {
      pRows.push({
        label: 'Bank Valuation Fee (est.)',
        amount: valuationFee,
        note: 'Indicative panel-valuer fee for the bank\u2019s security valuation (graduated scale under the valuation guidelines). Confirm with the appointed valuer.'
      });
    }

    pRows.push(
      {
        label: 'Land / Title Search Fees',
        amount: landSearch,
        note: 'Official title search at the Pejabat Tanah / Pejabat Pendaftar to confirm ownership, encumbrances and restrictions in interest. Approx RM20–30 per title.'
      },
      {
        label: 'Bankruptcy / Winding-up Search',
        amount: bankruptcySearch,
        note: 'Insolvency search at Jabatan Insolvensi Malaysia (individuals) or SSM winding-up search (companies). Approx RM10–25 per party searched.'
      },
      {
        label: 'Land Office Registration Fee',
        amount: landOfficeReg,
        note: 'Presentment and registration of the instrument of dealing at the Pejabat Tanah. Approx RM10–300 depending on state schedule and value.'
      },
      {
        label: 'Miscellaneous Disbursements',
        amount: misc,
        note: 'Includes statutory declaration / commissioner-for-oaths fees, courier, printing of Form 14A on A3, postage and registration sundries.'
      },
    );

    const pSubtotal = pRows.reduce((s, r) => s + r.amount, 0);
    pRows.push({ label: 'PURCHASER\u2019S TOTAL ESTIMATED COSTS', amount: pSubtotal, highlight: true });
    setPurchaserRows(pRows);

    // Vendor / RPGT side
    if (form.computeRPGT) {
      if (!acqPrice || !form.acquisitionDate || !form.disposalDate) {
        toast({ title: 'For RPGT, enter acquisition price, acquisition date and disposal date', variant: 'destructive' });
        setVendorRows(null);
      } else if (new Date(form.disposalDate).getTime() < new Date(form.acquisitionDate).getTime()) {
        toast({ title: 'Disposal date must be on or after the acquisition date', variant: 'destructive' });
        setVendorRows(null);
      } else {
        const r = calcRPGTReal(price, acqPrice, allowable, form.acquisitionDate, form.disposalDate, form.vendorType, form.privateResExemption);
        const vRows: ResultRow[] = [
          { label: 'Disposal Price (Consideration)', amount: price, note: 'The sale price / market value used as the disposal price under the RPGT Act 1976.' },
          { label: 'Less: Acquisition Price', amount: acqPrice, note: 'Original purchase price plus incidental costs of acquisition (legal fees, stamp duty, agent fees on acquisition).' },
          { label: 'Less: Allowable Expenses / Enhancements', amount: allowable, note: 'Permitted deductions: enhancement/renovation that is reflected in the property, legal fees defending title, and incidental costs of disposal (agent commission, advertising, legal fees on sale).' },
          { label: `Gross Chargeable Gain (held ${r.holdingYears.toFixed(2)} yrs)`, amount: Math.max(r.grossGain, 0), note: 'Disposal price less acquisition price less allowable expenses.' },
        ];
        if (r.schedule4Exemption > 0) {
          vRows.push({ label: 'Less: Schedule 4 Exemption', amount: r.schedule4Exemption, note: 'Individuals are exempt on the greater of RM10,000 or 10% of the chargeable gain (Sch 4 para 2).' });
        }
        vRows.push({ label: 'Net Chargeable Gain', amount: r.chargeableGain, note: 'Amount on which RPGT is computed after exemptions.' });
        vRows.push({
          label: r.exempt ? 'RPGT Payable (0% — exempt)' : `RPGT Payable (${r.rate}% rate)`,
          amount: r.tax,
          note: r.note,
          highlight: true,
        });
        vRows.push({
          label: `Acquirer\u2019s Retention to LHDN (${r.retentionRate}%)`,
          amount: r.retention,
          note: `Under s.21B the purchaser must retain ${r.retentionRate}% of the consideration and remit it to LHDN via CKHT 502 within 60 days of the SPA. It is credited against the vendor\u2019s RPGT and any excess is refunded after clearance. This is withheld from the price, not an extra cost.`
        });
        setVendorRows(vRows);
      }
    } else {
      setVendorRows(null);
    }

    setAiExplanation('');
  };

  const handleAIExplain = async () => {
    if (!purchaserRows) return;
    setLoadingAI(true);
    try {
      const pSummary = purchaserRows.map(r => `${r.label}: ${fmt(r.amount)}`).join('\n');
      const vSummary = vendorRows ? '\n\nVendor RPGT:\n' + vendorRows.map(r => `${r.label}: ${fmt(r.amount)}`).join('\n') : '';
      const res = await draftMutation.mutateAsync({
        data: {
          clauseType: 'Costs & Fees Explanation',
          variables: `Property: ${form.propertyType}, State: ${form.state}, Purchase/Disposal Price: ${fmt(price)}, Loan: ${fmt(loan)}, First Home: ${form.isFirstHome}, New development: ${form.isNewDev}.\n\nPurchaser costs:\n${pSummary}${vSummary}\n\nProvide a clear, plain-English explanation of each fee and tax, its statutory basis (cite the Act/Order), who bears it (purchaser vs vendor), and practical completion-account tips. Reflect SRO 2023, current LHDN stamp duty rates, the 8% SST on legal fees, and the RPGT Act 1976.`
        }
      });
      setAiExplanation(res.draft);
    } catch {
      toast({ title: 'AI explanation failed', variant: 'destructive' });
    }
    setLoadingAI(false);
  };

  const set = (k: keyof FormState, v: any) => setForm(f => {
    const next = { ...f, [k]: v };
    // Private-residence RPGT exemption is citizen-only; clear it if vendor type changes away from citizen.
    if (k === 'vendorType' && v !== 'citizen') next.privateResExemption = false;
    return next;
  });

  const inputCls = 'w-full bg-gold-950 border border-gold-700 rounded-xl px-4 py-3 text-slate-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500';
  const labelCls = 'text-xs font-bold text-slate-400 uppercase tracking-wider';

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-amber-500/10 rounded-lg">
            <Calculator className="w-6 h-6 text-amber-500" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-slate-100">Costs, Fees & RPGT Assessor</h1>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed">
          A practitioner completion-cost estimator. Computes the <span className="text-amber-400">purchaser&rsquo;s</span> stamp duties, SRO 2023 legal fees, 8% SST and disbursements, and — separately — the <span className="text-amber-400">vendor&rsquo;s</span> Real Property Gains Tax from real acquisition figures. Buyer and seller costs are kept apart, as they are in practice.
        </p>
        <div className="mt-3 flex items-start gap-2 bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-400">Estimates only, based on current statutory rates. Always confirm the actual completion account with the firm&rsquo;s conveyancing clerk and the relevant authorities before transacting.</p>
        </div>
      </div>

      {/* Input Form */}
      <div className="bg-gold-900 border border-gold-800 rounded-2xl p-6 md:p-8 mb-8 space-y-6">
        <h2 className="font-serif font-semibold text-slate-200 text-lg border-b border-gold-800 pb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-500" /> Transaction Details (Purchaser)
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className={labelCls}>Purchase / Disposal Price (RM)</label>
            <input data-testid="input-purchase-price" type="number" placeholder="e.g. 650000" value={form.purchasePrice} onChange={e => set('purchasePrice', e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Loan Amount (RM) — leave blank if cash</label>
            <input data-testid="input-loan-amount" type="number" placeholder="e.g. 500000" value={form.loanAmount} onChange={e => set('loanAmount', e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className={labelCls}>State</label>
            <select data-testid="select-state" value={form.state} onChange={e => set('state', e.target.value)} className={`${inputCls} appearance-none`}>
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className={labelCls}>Property Type</label>
            <div className="flex gap-2">
              {(['residential', 'commercial'] as const).map(t => (
                <button key={t} data-testid={`btn-type-${t}`} onClick={() => set('propertyType', t)}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${form.propertyType === t ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-950 border-gold-700 text-slate-400 hover:border-slate-600'}`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={labelCls}>Title Type</label>
          <select data-testid="select-title-type" value={form.titleType} onChange={e => set('titleType', e.target.value as any)} className={`${inputCls} appearance-none`}>
            <option value="individual">Individual Title (Geran)</option>
            <option value="strata">Strata Title</option>
            <option value="master">Master Title (No Individual Title Yet)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {[
            { key: 'isFirstHome', label: 'First Home (Stamp Duty Exemption)' },
            { key: 'isNewDev', label: 'Purchase from Developer' },
          ].map(({ key, label }) => (
            <button key={key} data-testid={`toggle-${key}`} onClick={() => set(key as keyof FormState, !(form as any)[key])}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${(form as any)[key] ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-950 border-gold-700 text-slate-400 hover:border-slate-600'}`}>
              <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${(form as any)[key] ? 'border-amber-500 bg-amber-500' : 'border-slate-600'}`}>
                {(form as any)[key] && <svg className="w-2.5 h-2.5 text-slate-900" viewBox="0 0 10 10" fill="currentColor"><path d="M1 5l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
              </div>
              {label}
            </button>
          ))}
        </div>

        {/* Vendor / RPGT block */}
        <div className="border-t border-gold-800 pt-6">
          <button
            data-testid="toggle-computeRPGT"
            onClick={() => set('computeRPGT', !form.computeRPGT)}
            className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border transition-all ${form.computeRPGT ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-950 border-gold-700 text-slate-300 hover:border-slate-600'}`}
          >
            <Building2 className="w-4 h-4" />
            Also calculate the Vendor&rsquo;s RPGT (disposal / sale side)
          </button>

          <AnimatePresence>
            {form.computeRPGT && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="space-y-5 pt-5">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Vendor (Disposer) Type</label>
                    <select data-testid="select-vendor-type" value={form.vendorType} onChange={e => set('vendorType', e.target.value as any)} className={`${inputCls} appearance-none`}>
                      <option value="citizen">Malaysian Citizen / Permanent Resident</option>
                      <option value="company">Company (incorporated in Malaysia)</option>
                      <option value="foreigner">Foreigner / Non-citizen</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className={labelCls}>Original Acquisition Price (RM)</label>
                      <input data-testid="input-acquisition-price" type="number" placeholder="e.g. 400000" value={form.acquisitionPrice} onChange={e => set('acquisitionPrice', e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>Allowable Expenses & Enhancements (RM)</label>
                      <input data-testid="input-allowable-expenses" type="number" placeholder="e.g. 50000" value={form.allowableExpenses} onChange={e => set('allowableExpenses', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className={labelCls}>Acquisition Date</label>
                      <input data-testid="input-acquisition-date" type="date" value={form.acquisitionDate} onChange={e => set('acquisitionDate', e.target.value)} className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>Disposal Date (SPA date)</label>
                      <input data-testid="input-disposal-date" type="date" value={form.disposalDate} onChange={e => set('disposalDate', e.target.value)} className={inputCls} />
                    </div>
                  </div>
                  {form.vendorType === 'citizen' && (
                    <button data-testid="toggle-privateResExemption" onClick={() => set('privateResExemption', !form.privateResExemption)}
                      className={`w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all ${form.privateResExemption ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' : 'bg-gold-950 border-gold-700 text-slate-400 hover:border-slate-600'}`}>
                      <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0 ${form.privateResExemption ? 'border-amber-500 bg-amber-500' : 'border-slate-600'}`}>
                        {form.privateResExemption && <svg className="w-2.5 h-2.5 text-slate-900" viewBox="0 0 10 10" fill="currentColor"><path d="M1 5l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>}
                      </div>
                      Claim once-in-a-lifetime private residence exemption (Sch 4 para 9)
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button data-testid="btn-calculate" onClick={handleCalculate}
          className="w-full py-4 bg-amber-500 text-slate-900 font-bold rounded-xl hover:bg-amber-400 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 text-base">
          <Calculator className="w-5 h-5" />
          Calculate Completion Costs
        </button>
      </div>

      {/* Results */}
      <AnimatePresence>
        {purchaserRows && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <h2 className="font-serif font-semibold text-slate-200 text-xl mb-5 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" /> Purchaser&rsquo;s Estimated Costs
            </h2>
            {purchaserRows.map((row, i) => <ResultCard key={row.label} row={row} index={i} />)}

            {vendorRows && (
              <>
                <h2 className="font-serif font-semibold text-slate-200 text-xl mb-5 mt-10 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-500" /> Vendor&rsquo;s RPGT (Disposal)
                </h2>
                {vendorRows.map((row, i) => <ResultCard key={row.label} row={row} index={i} />)}
              </>
            )}

            <div className="pt-4">
              <button data-testid="btn-ai-explain" onClick={handleAIExplain} disabled={loadingAI}
                className="w-full py-4 bg-gold-800 text-slate-200 font-bold rounded-xl hover:bg-gold-700 transition-colors flex items-center justify-center gap-2 border border-gold-700">
                {loadingAI ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating AI Explanation...</> : <><span className="text-amber-500">✦</span> Get AI Explanation of All Fees</>}
              </button>
            </div>

            {aiExplanation && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-gold-900 border border-gold-700 rounded-2xl p-6 mt-4">
                <h3 className="font-serif font-bold text-amber-500 mb-4">AI Legal Advisor Commentary</h3>
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-300 leading-relaxed">{aiExplanation}</pre>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
