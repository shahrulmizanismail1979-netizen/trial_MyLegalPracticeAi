import { useCrimGetDashboardStats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Scale, BookOpen, FileText, Landmark, Workflow, Search, ArrowRight, ShieldCheck, Database, Award, Brain, Sparkles, Users, Gavel, Target, FileCheck, TrendingUp, Lightbulb, MessageSquareWarning, FileEdit, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function LandingPage() {
  const { data: stats, isLoading } = useCrimGetDashboardStats();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="h-6 w-6 text-primary" />
            <span className="font-serif font-bold text-xl tracking-tight">Mycrim<span className="text-primary">Ai</span></span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="hidden sm:inline-flex font-medium">Practitioner Login</Button>
            </Link>
            <Link href="/workspace">
              <Button className="font-medium">Enter Workspace <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background z-0"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-2">
              <ShieldCheck className="mr-2 h-4 w-4" />
              The Authoritative Companion for Criminal Legal Practice
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-bold tracking-tighter leading-tight">
              Malaysian Criminal Law <br className="hidden sm:block" />
              <span className="text-primary drop-shadow-[0_0_30px_hsl(0,72%,51%,0.3)]">Practice Companion</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              A comprehensive digital law library, AI-powered research suite, and interactive practice toolkit meticulously curated for criminal law practitioners in Malaysia.
            </p>

            <div className="pt-2 pb-4">
              <div className="max-w-xl mx-auto space-y-1">
                <p className="text-lg font-serif font-semibold text-foreground tracking-wide">Curated by Prof Madya Dr Shahrul Mizan Ismail</p>
                <p className="text-sm text-muted-foreground font-medium">Criminal Law Academic & Practitioner</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link href="/workspace">
                <Button size="lg" className="w-full sm:w-auto text-base h-12 px-8">
                  Access Workspace
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-base h-12 px-8">
                  Practitioner Login
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 border-y border-border/50 bg-muted/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl font-bold tracking-tight">Comprehensive Legal Database</h2>
            <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">Everything you need for criminal litigation, structured and indexed for rapid retrieval during research, preparation, and courtroom advocacy.</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 max-w-6xl mx-auto">
            <StatCard title="Theory Topics" count={stats?.topicsCount} isLoading={isLoading} icon={BookOpen} />
            <StatCard title="Case Laws" count={stats?.caseLawsCount} isLoading={isLoading} icon={Scale} />
            <StatCard title="Cause Papers" count={stats?.causePapersCount} isLoading={isLoading} icon={FileText} />
            <StatCard title="Workflows" count={stats?.workflowsCount} isLoading={isLoading} icon={Workflow} />
            <StatCard title="Sample Docs" count={stats?.sampleDocumentsCount} isLoading={isLoading} icon={Database} />
            <StatCard title="Costs & Fees" count={stats?.costsFeesCount} isLoading={isLoading} icon={Landmark} />
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-bold tracking-tight">11 AI-Powered Legal Tools</h2>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">Intelligent assistants trained on Malaysian criminal law — research statutes, analyze charges, draft court documents, build case strategies, and practice courtroom advocacy.</p>
          </div>
          <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {[
              { name: "AI Legal Research", icon: Brain, desc: "Multi-turn legal research chat with statute and case citations" },
              { name: "Case Fact Analyzer", icon: Scale, desc: "Analyze facts for applicable charges, defences, and precedents" },
              { name: "Charge Sheet Analyzer", icon: FileSearch, desc: "Break down charge sheets with elements, defences, and strategy" },
              { name: "Sentencing Predictor", icon: Target, desc: "Predict sentencing range with comparable case precedents" },
              { name: "Document Drafter", icon: FileEdit, desc: "Draft bail applications, submissions, and court documents" },
              { name: "Legal Opinion Writer", icon: FileCheck, desc: "Generate formal structured legal opinions" },
              { name: "Case Strategy Planner", icon: TrendingUp, desc: "Build comprehensive defence or prosecution strategies" },
              { name: "Appeal Grounds Analyzer", icon: Lightbulb, desc: "Identify grounds for appeal from trial judgments" },
              { name: "Cross-Examination Helper", icon: MessageSquareWarning, desc: "Generate strategic cross-examination questions" },
              { name: "Witness Practice", icon: Users, desc: "Interactive mock witness examination with 11 personalities" },
              { name: "Judge Practice", icon: Gavel, desc: "Practice advocacy before 9 simulated judge characters" },
            ].map((tool) => (
              <Card key={tool.name} className="border-border/50 bg-card/30 hover:border-primary/30 transition-colors">
                <CardContent className="p-4 flex items-start gap-3">
                  <tool.icon className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium">{tool.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{tool.desc}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 border-t border-border/50 bg-muted/10">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="grid md:grid-cols-3 gap-12">
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold font-serif">Rapid Retrieval</h3>
              <p className="text-muted-foreground leading-relaxed">
                Lightning-fast search across case laws, statutes, cause papers, and practice notes. Find exactly what you need when you're on your feet in court or preparing for trial.
              </p>
            </div>
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Workflow className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold font-serif">Practice Workflows</h3>
              <p className="text-muted-foreground leading-relaxed">
                Step-by-step procedural guides for common criminal applications — bail, appeals, revision, mitigation, and more. Never miss a crucial procedural requirement or statutory deadline.
              </p>
            </div>
            <div className="space-y-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold font-serif">Authoritative Content</h3>
              <p className="text-muted-foreground leading-relaxed">
                Curated by experienced criminal law practitioners. The companion you can trust for accurate, up-to-date criminal law principles and practice guidance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-border/50 py-12 bg-muted/10">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Scale className="h-5 w-5 text-primary/60" />
            <span className="font-serif font-bold text-lg text-muted-foreground">Mycrim<span className="text-primary/60">Ai</span></span>
          </div>
          <p className="text-sm text-muted-foreground">Curated by Prof Madya Dr Shahrul Mizan Ismail</p>
          <p className="text-xs text-muted-foreground mt-3">
            &copy; {new Date().getFullYear()} MyCrimAi. Designed for Malaysian Criminal Law Practitioners.
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ title, count, isLoading, icon: Icon }: { title: string, count?: number, isLoading: boolean, icon: any }) {
  return (
    <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors">
      <Icon className="h-6 w-6 text-primary/70 mb-3" />
      {isLoading ? (
        <Skeleton className="h-8 w-16 mb-1" />
      ) : (
        <span className="text-3xl font-bold mb-1">{count || 0}</span>
      )}
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">{title}</span>
    </div>
  );
}
