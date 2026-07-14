import { useState, useMemo } from 'react';
import { useListCases } from '@/hooks/use-jurisprudence';
import { PageHeader, Card, CardContent, CardHeader, CardTitle, Badge, Modal, Input } from '@/components/ui';
import { Gavel, Search, MapPin, Scale, AlertTriangle, ExternalLink, BarChart3 } from 'lucide-react';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LegalCase = Record<string, any>;

// ─── Litigation Topic Categories (Procedural) ──────────────────────────────────
const CATEGORIES: { label: string; keywords: string[]; color: string }[] = [
  { label: 'All Cases', keywords: [], color: 'bg-primary' },
  {
    label: 'Originating Process',
    keywords: ['Writ', 'Originating Summons', 'Statement of Claim', 'Pleadings', 'Cause of Action', 'Locus Standi', 'Joinder', 'Representative Action', 'Class Action', 'Originating Process'],
    color: 'bg-blue-500',
  },
  {
    label: 'Summary Judgment',
    keywords: ['Summary Judgment', 'Order 14', 'O.14', 'No Defence', 'Triable Issue', 'Leave to Defend', 'Unconditional Leave', 'Conditional Leave'],
    color: 'bg-emerald-500',
  },
  {
    label: 'Striking Out',
    keywords: ['Striking Out', 'Strike Out', 'Order 18', 'O.18 r.19', 'Frivolous', 'Vexatious', 'No Cause of Action', 'Abuse of Process', 'Plain and Obvious'],
    color: 'bg-red-500',
  },
  {
    label: 'Interlocutory & Injunctions',
    keywords: ['Interlocutory', 'Injunction', 'Mareva', 'Anton Piller', 'Interim Order', 'Stay of Proceedings', 'Interim Relief', 'Freezing Order', 'Search Order', 'Prohibitory', 'Mandatory Injunction', 'Balance of Convenience'],
    color: 'bg-violet-500',
  },
  {
    label: 'Discovery & Pre-Trial',
    keywords: ['Discovery', 'Interrogatories', 'Pre-Trial', 'Case Management', 'Further and Better Particulars', 'Specific Discovery', 'Affidavit of Documents', 'Inspection'],
    color: 'bg-cyan-500',
  },
  {
    label: 'Foreclosure & Order for Sale',
    keywords: ['Foreclosure', 'Order for Sale', 'Order 83', 'O.83', 'Charge', 'Chargor', 'Chargee', 'Form 16', 'Land Charge', 'Auction', 'Judicial Sale', 'National Land Code'],
    color: 'bg-amber-500',
  },
  {
    label: 'Execution & Enforcement',
    keywords: ['Garnishee', 'Charging Order', 'Writ of Seizure', 'Execution', 'Judgment Debtor', 'Judgment Creditor', 'Enforcement', 'Committal', 'Contempt', 'Oral Examination'],
    color: 'bg-orange-500',
  },
  {
    label: 'Winding Up',
    keywords: ['Winding Up', 'Liquidation', 'Insolvency', 'Creditor', 'Contributory', 'Statutory Demand', 'Unable to Pay Debts', 'Just and Equitable', 'Oppression', 'Companies Act 2016'],
    color: 'bg-rose-500',
  },
  {
    label: 'Bankruptcy',
    keywords: ['Bankruptcy', 'Bankrupt', 'Receiving Order', 'Adjudication Order', 'Creditor Petition', 'Debtor Petition', 'Act of Bankruptcy', 'Insolvency Act', 'Annulment'],
    color: 'bg-pink-500',
  },
  {
    label: 'Appeals',
    keywords: ['Leave to Appeal', 'Notice of Appeal', 'Stay Pending Appeal', 'Fresh Evidence', 'Cross-Appeal', 'Appellate Procedure', 'Appellate Review', 'Extension of Time', 'Ladd v Marshall'],
    color: 'bg-indigo-500',
  },
  {
    label: 'Judicial Review',
    keywords: ['Judicial Review', 'Order 53', 'O.53', 'Certiorari', 'Mandamus', 'Prohibition', 'Natural Justice', 'Audi Alteram', 'Ultra Vires', 'Wednesbury', 'Proportionality', 'Legitimate Expectation', 'Public Authority'],
    color: 'bg-teal-500',
  },
  {
    label: 'Limitation & Evidence',
    keywords: ['Limitation', 'Time-Barred', 'Limitation Act', 'Evidence', 'Burden of Proof', 'Hearsay', 'Expert Evidence', 'Admissibility', 'Similar Fact', 'Res Judicata', 'Estoppel', 'Issue Estoppel'],
    color: 'bg-gray-500',
  },
];

function getCategoryForCase(c: LegalCase, category: typeof CATEGORIES[number]): boolean {
  if (category.keywords.length === 0) return true;
  const haystack = [...c.tags, ...c.legislation, c.caseName, c.facts, c.held, c.significance]
    .join(' ')
    .toLowerCase();
  return category.keywords.some(kw => haystack.includes(kw.toLowerCase()));
}

function CitationDisclaimer() {
  return (
    <div className="mb-6 flex items-start gap-3 bg-amber-950/30 border border-amber-700/50 rounded-xl p-4">
      <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
      <div className="text-sm">
        <p className="font-semibold text-amber-300 mb-1">Educational Reference — Verify All Citations Independently</p>
        <p className="text-amber-200/80 leading-relaxed">
          Case summaries and citations in this module are for educational study purposes only. 
          All citations <strong>must be independently verified</strong> against primary sources 
          (WestlawAsia, Current Law Journal, Malayan Law Journal, or official court records) 
          before any professional or academic use. Do not rely on these citations without verification.
        </p>
      </div>
    </div>
  );
}

function CategoryDistributionChart({ allCases }: { allCases: LegalCase[] }) {
  const categoryCounts = useMemo(() => {
    return CATEGORIES.slice(1).map(cat => ({
      label: cat.label,
      color: cat.color,
      count: allCases.filter(c => getCategoryForCase(c, cat)).length,
    })).sort((a, b) => b.count - a.count);
  }, [allCases]);

  const maxCount = Math.max(...categoryCounts.map(c => c.count), 1);

  return (
    <div className="mb-8 bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="font-serif font-bold text-base">Case Distribution by Litigation Topic</h3>
        <span className="text-xs text-muted-foreground ml-auto">{allCases.length} cases (topics may overlap)</span>
      </div>
      <div className="space-y-2">
        {categoryCounts.map((cat) => (
          <div key={cat.label} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-40 truncate shrink-0 text-right">{cat.label}</span>
            <div className="flex-1 h-6 bg-secondary/30 rounded-full overflow-hidden">
              <div
                className={`h-full ${cat.color} rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2`}
                style={{ width: `${Math.max((cat.count / maxCount) * 100, cat.count > 0 ? 8 : 0)}%` }}
              >
                {cat.count > 0 && <span className="text-[10px] font-bold text-white">{cat.count}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Jurisprudence() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [selectedCase, setSelectedCase] = useState<LegalCase | null>(null);

  const { data: allCases, isLoading } = useListCases({ search: search || undefined });

  const filteredCases = useMemo(() => {
    if (!allCases) return [];
    const cat = CATEGORIES[selectedCategory];
    return allCases.filter((c: any) => getCategoryForCase(c, cat));
  }, [allCases, selectedCategory]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader 
        title="Case Laws" 
        description="Landmark Malaysian cases, ratios, and critical analyses — categorised by litigation procedure topic."
      />

      <CitationDisclaimer />

      {allCases && allCases.length > 0 && <CategoryDistributionChart allCases={allCases} />}

      {/* ─── Search ────────────────────────────────────────────────────────── */}
      <div className="mb-6 relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input 
          placeholder="Search by case name, citation, or keywords..." 
          className="pl-10 h-12 text-lg rounded-full bg-card shadow-sm border-primary/20 focus-visible:ring-primary/50"
          value={search}
          onChange={e => { setSearch(e.target.value); setSelectedCategory(0); }}
        />
      </div>

      {/* ─── Category Tabs ─────────────────────────────────────────────────── */}
      <div className="mb-8 overflow-x-auto pb-2">
        <div className="flex gap-2 min-w-max">
          {CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              onClick={() => { setSelectedCategory(i); setSearch(''); }}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all whitespace-nowrap ${
                selectedCategory === i
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${cat.color} shrink-0`} />
              {cat.label}
              {selectedCategory === i && allCases && (
                <span className="text-xs opacity-75">({filteredCases.length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Cases Grid ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="p-8 text-center text-primary animate-pulse">Loading Cases...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCases.map((c: any) => {
            const matchedCat = CATEGORIES.slice(1).find(cat => getCategoryForCase(c, cat));
            return (
              <Card key={c.id} className="cursor-pointer hover:border-primary/50 transition-all flex flex-col group" onClick={() => setSelectedCase(c)}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start mb-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary">{c.year}</span>
                      {matchedCat && (
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full text-white font-medium ${matchedCat.color}`}>
                          {matchedCat.label}
                        </span>
                      )}
                    </div>
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3"/> {c.court}</span>
                  </div>
                  <CardTitle className="text-xl leading-snug group-hover:text-primary transition-colors">{c.caseName}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-mono text-muted-foreground">{c.citation}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-950/40 text-amber-400 border border-amber-700/40 rounded px-1.5 py-0.5">
                      <AlertTriangle className="h-2.5 w-2.5" /> Verify citation
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <div className="bg-secondary/20 p-3 rounded-lg border border-border">
                    <p className="text-sm font-semibold mb-1 flex items-center gap-2"><Scale className="h-4 w-4 text-primary"/> Held:</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{c.held}</p>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {c.tags.slice(0, 4).map((t: any) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                    {c.tags.length > 4 && <Badge variant="outline" className="text-[10px]">+{c.tags.length - 4}</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredCases.length === 0 && (
            <div className="col-span-full py-16 text-center text-muted-foreground bg-card border border-dashed border-border rounded-xl">
              <Gavel className="h-12 w-12 mx-auto text-muted mb-4" />
              <p className="text-lg">No cases found matching your criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* ─── Case Detail Modal ─────────────────────────────────────────────── */}
      <Modal isOpen={!!selectedCase} onClose={() => setSelectedCase(null)} title="Case Analysis">
        {selectedCase && (
          <div className="space-y-8 pb-6">
            <div className="text-center pb-6 border-b border-border">
              <h2 className="text-2xl font-serif font-bold text-foreground mb-2">{selectedCase.caseName}</h2>
              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground font-mono">
                <span>{selectedCase.citation}</span>
                <span>•</span>
                <span>{selectedCase.court}</span>
                <span>•</span>
                <span>{selectedCase.year}</span>
              </div>
              {selectedCase.judge && (
                <p className="text-sm italic mt-2">Coram: {selectedCase.judge}</p>
              )}
              <div className="mt-3 inline-flex items-center gap-2 bg-amber-950/40 text-amber-300 border border-amber-700/40 rounded-lg px-3 py-1.5 text-xs">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Educational reference only — verify citation against WestlawAsia / CLJ / MLJ before professional use
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">Brief Facts</h4>
                <p className="text-sm text-foreground leading-relaxed bg-card border border-border p-4 rounded-xl shadow-inner">
                  {selectedCase.facts}
                </p>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">Issues Before Court</h4>
                <ul className="text-sm text-foreground bg-card border border-border p-4 rounded-xl shadow-inner list-disc list-outside ml-4 space-y-2">
                  {selectedCase.issues.map((issue: any, i: any) => <li key={i}>{issue}</li>)}
                </ul>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                <Scale className="h-4 w-4" /> Ratio Decidendi (Held)
              </h4>
              <div className="text-foreground leading-relaxed bg-primary/5 border border-primary/20 p-5 rounded-xl text-lg font-serif">
                {selectedCase.held}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-wider text-primary">Significance</h4>
              <p className="text-muted-foreground leading-relaxed">
                {selectedCase.significance}
              </p>
            </div>

            <div className="pt-4 flex flex-wrap gap-2 border-t border-border">
              {selectedCase.tags.map((t: any) => <Badge key={t}>{t}</Badge>)}
              {selectedCase.legislation.map((l: any) => <Badge key={l} variant="outline" className="font-mono">{l}</Badge>)}
            </div>

            <div className="flex items-start gap-2 bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
              <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Verify this case through: <strong>WestlawAsia</strong> · <strong>Current Law Journal (CLJ)</strong> · 
                <strong> Malayan Law Journal (MLJ)</strong> · <strong>LexisNexis Malaysia</strong> · 
                Official court records at the respective court registry.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
