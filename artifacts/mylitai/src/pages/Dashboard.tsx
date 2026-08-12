import { Link } from 'wouter';
import { BookOpen, GitBranch, FileText, Gavel, ArrowRight, AlertTriangle, Calculator, BookA, FolderOpen, Scale, CalendarClock, Clock, FolderKanban, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, PageHeader, Badge } from '@/components/ui';
import { useUpcomingDeadlines, categoryMeta, daysUntil } from '@/hooks/use-matters';
import { ParalegalWidget } from '@workspace/paralegal-widget';

const paralegalRequest = (path: string, init?: RequestInit) =>
  fetch(`/api/lit/paralegal${path.replace(/^\/paralegal/, '')}`, { ...init, credentials: 'include' });

function DeadlineRadar() {
  const { data, isLoading } = useUpcomingDeadlines(30);
  const items = (data ?? []).slice(0, 6);
  const overdue = (data ?? []).filter((d) => daysUntil(d.dueDate) < 0).length;

  return (
    <Card>
      <CardHeader className="border-b border-border bg-secondary/30 flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Deadline Radar
          {overdue > 0 && <Badge variant="outline" className="text-red-400 border-red-500/30">{overdue} overdue</Badge>}
        </CardTitle>
        <Link href="/app/diary">
          <span className="text-xs text-primary font-medium hover:underline cursor-pointer inline-flex items-center gap-1">
            Full diary <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground animate-pulse">Loading deadlines…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">No deadlines due in the next 30 days.</p>
            <Link href="/app/matters">
              <span className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline cursor-pointer">
                <Plus className="h-4 w-4" /> Open a matter
              </span>
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((d) => {
              const n = daysUntil(d.dueDate);
              const cat = categoryMeta(d.category);
              return (
                <Link key={d.id} href={`/app/matters/${d.matterId}`}>
                  <div className="p-3.5 flex items-center gap-3 hover:bg-secondary/50 transition-colors cursor-pointer">
                    <div className="flex flex-col items-center justify-center shrink-0 w-12">
                      <span className={`text-base font-bold leading-none ${n < 0 ? 'text-red-400' : n <= 7 ? 'text-amber-400' : 'text-foreground'}`}>
                        {n < 0 ? Math.abs(n) : n}
                      </span>
                      <span className="text-[8px] uppercase tracking-wide text-muted-foreground">{n < 0 ? 'late' : 'days'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{d.title}</span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border ${cat.color} shrink-0`}>{cat.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 truncate">
                        <Clock className="h-3 w-3 shrink-0" /> {new Date(d.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        <span className="truncate">· {d.matterTitle}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const LITIGATION_TOPICS = [
  { name: 'Originating Process', cases: 'Writ, OS, Pleadings', color: 'bg-blue-500' },
  { name: 'Summary Judgment', cases: 'O.14, Triable Issue', color: 'bg-emerald-500' },
  { name: 'Striking Out', cases: 'O.18 r.19, Abuse', color: 'bg-red-500' },
  { name: 'Injunctions', cases: 'Mareva, Anton Piller', color: 'bg-violet-500' },
  { name: 'Discovery', cases: 'O.24, Interrogatories', color: 'bg-cyan-500' },
  { name: 'Foreclosure', cases: 'O.83, Order for Sale', color: 'bg-amber-500' },
  { name: 'Execution', cases: 'Garnishee, WSS', color: 'bg-orange-500' },
  { name: 'Winding Up', cases: 'Insolvency, s.465', color: 'bg-rose-500' },
  { name: 'Bankruptcy', cases: 'Receiving Order', color: 'bg-pink-500' },
  { name: 'Appeals', cases: 'CoA, Federal Court', color: 'bg-indigo-500' },
  { name: 'Judicial Review', cases: 'O.53, Certiorari', color: 'bg-teal-500' },
  { name: 'Limitation', cases: 'Time Bar, Evidence', color: 'bg-gray-500' },
];

export default function Dashboard() {
  const quickLinks = [
    { name: 'Matters', path: '/app/matters', icon: FolderKanban, count: null, label: 'case files', color: 'text-primary', bgColor: 'bg-primary/10' },
    { name: 'Legal Theory', path: '/app/theory', icon: BookOpen, count: 22, label: 'topics', color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
    { name: 'Cause Papers & Forms', path: '/app/forms', icon: FileText, count: 65, label: 'forms', color: 'text-emerald-400', bgColor: 'bg-emerald-400/10' },
    { name: 'Case Laws', path: '/app/jurisprudence', icon: Gavel, count: 105, label: 'cases', color: 'text-purple-400', bgColor: 'bg-purple-400/10' },
    { name: 'Workflows', path: '/app/workflows', icon: GitBranch, count: 18, label: 'workflows', color: 'text-amber-400', bgColor: 'bg-amber-400/10' },
    { name: 'Sample Documents', path: '/app/chambers', icon: FolderOpen, count: 47, label: 'templates', color: 'text-orange-400', bgColor: 'bg-orange-400/10' },
    { name: 'Costs & Fees', path: '/app/costs', icon: Calculator, count: null, label: 'calculators', color: 'text-rose-400', bgColor: 'bg-rose-400/10' },
    { name: 'Terminology', path: '/app/terminology', icon: BookA, count: 98, label: 'terms', color: 'text-cyan-400', bgColor: 'bg-cyan-400/10' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader 
        title="Dashboard Overview" 
        description="Welcome to MyLitAi. Access your primary modules below or use the AI Senior Counsel for immediate guidance."
      />

      {/* ─── Your Online LA — practice-first entry point ─────────────────── */}
      <Link href="/app/practice">
        <div className="cursor-pointer bg-primary/5 border border-primary/25 rounded-xl p-5 hover:bg-primary/10 hover:border-primary/40 transition-all">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="font-serif font-bold text-lg text-primary">Your Online LA — Work by Matter</p>
              <p className="text-sm text-muted-foreground mt-1">Pick the file you are handling — Civil Litigation, Insolvency, Banking & Recovery or Enforcement — and get its workflow, checklist, cause papers and AI drafting on one page.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Civil Litigation', 'Insolvency', 'Banking & Recovery', 'Enforcement'].map(a => (
                <span key={a} className="text-xs px-3 py-1.5 rounded-full border border-primary/30 bg-background text-primary font-medium">{a}</span>
              ))}
            </div>
          </div>
        </div>
      </Link>

      {/* ─── Stats Overview ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Gavel className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">105</p>
            <p className="text-xs text-muted-foreground">Case Laws</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">22</p>
            <p className="text-xs text-muted-foreground">Theory Topics</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">65</p>
            <p className="text-xs text-muted-foreground">Cause Papers</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <GitBranch className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">18</p>
            <p className="text-xs text-muted-foreground">Workflows</p>
          </div>
        </div>
      </div>

      {/* ─── Deadline Radar ───────────────────────────────────────────── */}
      <DeadlineRadar />

      {/* ─── Module Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.name} href={link.path}>
              <Card className="hover:border-primary/50 hover:shadow-primary/10 transition-all cursor-pointer group h-full">
                <CardContent className="p-5 flex flex-col items-center text-center space-y-3">
                  <div className={`h-14 w-14 rounded-full ${link.bgColor} flex items-center justify-center group-hover:scale-110 transition-transform ${link.color}`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="font-serif font-bold text-base group-hover:text-primary transition-colors leading-tight">{link.name}</h3>
                    <p className="text-muted-foreground text-xs mt-1">
                      {link.count !== null ? `${link.count} ${link.label}` : `Interactive ${link.label}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* ─── Litigation Topics Visual Map ─────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Scale className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-serif font-bold">Litigation Topics Coverage</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-5">Case laws are categorized by litigation procedure — not substantive law topics.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {LITIGATION_TOPICS.map((topic) => (
            <Link key={topic.name} href="/app/jurisprudence">
              <div className="group bg-secondary/30 border border-border rounded-lg p-3 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer text-center">
                <div className={`h-2 w-full ${topic.color} rounded-full mb-2 group-hover:h-3 transition-all`} />
                <p className="text-xs font-bold text-foreground mb-0.5">{topic.name}</p>
                <p className="text-[10px] text-muted-foreground">{topic.cases}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 bg-amber-950/20 border border-amber-800/40 rounded-xl p-4">
        <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-semibold text-amber-300 mb-1">Educational Platform — Verify All Legal References</p>
          <p className="text-amber-200/70 leading-relaxed">
            This platform is an <strong>educational study tool</strong>. All case citations, statutory section numbers, 
            and procedural details must be independently verified against primary sources (WestlawAsia, CLJ, MLJ, 
            official Rules of Court, or court registries) before professional or academic reliance. 
            The AI Senior Counsel may also make errors — always cross-check its responses.
          </p>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-2xl font-serif font-bold mb-6">Study Modules</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="border-b border-border bg-secondary/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <Gavel className="h-5 w-5 text-purple-400" />
                Case Laws (105 cases)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border">
              {[
                { name: "Bandar Builder Sdn Bhd v United Malayan Banking Corp Bhd", note: "[1993] 3 MLJ 36" },
                { name: "Keet Gerald Francis Noel John v Mohd Noor", note: "[1995] 1 MLJ 193" },
                { name: "Pengarah Tanah dan Galian WP v Sri Lempah Enterprise", note: "[1979] 1 MLJ 135" },
              ].map(item => (
                <Link key={item.name} href="/app/jurisprudence">
                  <div className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors cursor-pointer">
                    <div>
                      <span className="font-medium text-sm block">{item.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">{item.note}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="border-b border-border bg-secondary/30">
              <CardTitle className="text-lg flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-amber-400" />
                Core Workflows (18 workflows)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border">
              {[
                "Order for Sale (Foreclosure) — Landed Property",
                "Summary Judgment Application under Order 14",
                "Winding Up Petition — Company Debtor",
              ].map(flow => (
                <Link key={flow} href="/app/workflows">
                  <div className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors cursor-pointer">
                    <span className="font-medium text-sm">{flow}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
      <ParalegalWidget
        portalName="MyLitAI"
        request={paralegalRequest}
        accent="#8a6d2f"
      />
    </div>
  );
}
