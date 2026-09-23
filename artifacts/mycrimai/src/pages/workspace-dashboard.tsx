import { useCrimGetDashboardStats, useCrimGetRecentActivity } from "@workspace/api-client-react";
import {
  usePersona,
  PERSONA_ROLES,
  PERSONA_LABELS,
  PERSONA_DESCRIPTIONS,
  PERSONA_DASHBOARD_FRAMING,
} from "@workspace/persona-client";
import { Link } from "wouter";
import { 
  BookOpen, 
  Scale, 
  FileText, 
  Workflow, 
  Files, 
  BookA, 
  Landmark, 
  ArrowRight,
  Clock,
  Activity,
  Search,
  Brain,
  FileEdit,
  FileSearch,
  MessageSquareWarning,
  Sparkles,
  Users,
  Gavel,
  Target,
  FileCheck,
  TrendingUp,
  Lightbulb,
  Lock,
  UserCog,
  Check
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useEntitlements, AI_TOOL_PATHS } from "@/lib/entitlements";

export function WorkspaceDashboard() {
  const { data: stats, isLoading: statsLoading } = useCrimGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useCrimGetRecentActivity({ limit: 10 });
  const { hasTool } = useEntitlements();
  const { role } = usePersona();

  const framing = role ? PERSONA_DASHBOARD_FRAMING[role] : null;
  const heading = framing?.heading ?? "Dashboard";
  const subtitle =
    framing?.tagline ??
    "Prepare the charge, agreed and disputed facts, investigation papers available to you, procedural stage and next court date. Use the tools for a working issue map, evidence checklist or editable draft, then verify every fact, authority, statutory version, court direction and deadline before professional use.";

  const categories = [
    { name: "Theory Topics", count: stats?.topicsCount, icon: BookOpen, href: "/workspace/topics", color: "text-red-400" },
    { name: "Case Laws", count: stats?.caseLawsCount, icon: Scale, href: "/workspace/case-laws", color: "text-red-500" },
    { name: "Cause Papers", count: stats?.causePapersCount, icon: FileText, href: "/workspace/cause-papers", color: "text-rose-400" },
    { name: "Practice Workflows", count: stats?.workflowsCount, icon: Workflow, href: "/workspace/workflows", color: "text-rose-500" },
    { name: "Sample Documents", count: stats?.sampleDocumentsCount, icon: Files, href: "/workspace/sample-documents", color: "text-red-300" },
    { name: "Glossary", count: stats?.glossaryCount, icon: BookA, href: "/workspace/glossary", color: "text-rose-300" },
    { name: "Costs & Fees", count: stats?.costsFeesCount, icon: Landmark, href: "/workspace/costs-fees", color: "text-red-400" },
  ];

  return (
    <div className="space-y-8 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-4xl font-bold tracking-tight">{heading}</h1>
            {role && <Badge variant="secondary">{PERSONA_LABELS[role]}</Badge>}
          </div>
          <p className="text-muted-foreground text-lg">{subtitle}</p>
        </div>
        <div className="shrink-0">
          <ProfessionalModeSwitcher />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((cat) => (
          <Link key={cat.name} href={cat.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-md hover:shadow-primary/5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {cat.name}
                </CardTitle>
                <cat.icon className={`h-4 w-4 ${cat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">
                  {statsLoading ? <Skeleton className="h-8 w-12" /> : (cat.count || 0)}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI-Powered Tools
        </h2>
        <p className="text-sm text-muted-foreground">Choose a tool only after removing irrelevant personal data and defining whether you act for the defence or prosecution. Treat each result as a reviewable draft: compare it with the actual charge and record, test assumptions, check current Malaysian primary sources and confirm the requirements of the court hearing the matter.</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[
            { name: "AI Legal Research", desc: "Multi-turn chat for Malaysian criminal law questions with statute citations and case references", icon: Brain, href: "/workspace/ai/research", color: "text-red-400" },
            { name: "Case Analyzer", desc: "Analyze case facts for applicable charges, defences, sentencing range, and relevant precedents", icon: Scale, href: "/workspace/ai/case-analyzer", color: "text-red-500" },
            { name: "Document Drafter", desc: "Draft bail applications, written submissions, mitigation pleas, notices of appeal, and more", icon: FileEdit, href: "/workspace/ai/document-drafter", color: "text-rose-400" },
            { name: "Charge Analyzer", desc: "Break down charge sheets — elements to prove, defences, sentencing guidelines, and strategy", icon: FileSearch, href: "/workspace/ai/charge-analyzer", color: "text-rose-500" },
            { name: "Cross-Examination", desc: "Generate strategic cross-examination questions with Evidence Act references and impeachment foundations", icon: MessageSquareWarning, href: "/workspace/ai/cross-examination", color: "text-red-300" },
            { name: "Sentencing Predictor", desc: "Predict sentencing range with comparable case precedents, aggravating/mitigating factor analysis", icon: Target, href: "/workspace/ai/sentencing", color: "text-red-400" },
            { name: "Legal Opinion", desc: "Draft formal structured legal opinions with analysis, risk assessment, and recommendations", icon: FileCheck, href: "/workspace/ai/legal-opinion", color: "text-rose-400" },
            { name: "Case Strategy", desc: "Comprehensive defence or prosecution strategy — evidence, witnesses, arguments, trial timeline", icon: TrendingUp, href: "/workspace/ai/case-strategy", color: "text-red-300" },
            { name: "Appeal Grounds", desc: "Identify appeal grounds from trial judgments — errors of law, misdirections, procedural irregularities", icon: Lightbulb, href: "/workspace/ai/appeal-grounds", color: "text-rose-300" },
            { name: "Witness Practice", desc: "Practice examining 11 witness personality types across 4 examination modes with realistic AI responses", icon: Users, href: "/workspace/ai/witness-practice", color: "text-red-400" },
            { name: "Judge Practice", desc: "Practice advocacy before 9 simulated judge characters across 7 courtroom scenarios", icon: Gavel, href: "/workspace/ai/judge-practice", color: "text-rose-300" },
          ].map((tool) => {
            const toolId = AI_TOOL_PATHS[tool.href];
            const locked = toolId ? !hasTool(toolId) : false;
            const target = locked ? "/pricing" : tool.href;
            return (
              <Link key={tool.name} href={target}>
                <Card className={`transition-colors cursor-pointer h-full border-primary/10 bg-gradient-to-br from-card/80 to-primary/10 backdrop-blur-sm hover:shadow-lg hover:shadow-primary/10 ${locked ? "opacity-60 hover:border-primary/30" : "hover:border-primary/50"}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <tool.icon className={`h-6 w-6 ${tool.color} mb-2`} />
                      {locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <CardTitle className="text-sm font-medium">{tool.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">{tool.desc}</p>
                    {locked && <p className="mt-2 text-xs font-medium text-primary">Upgrade to unlock</p>}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="col-span-1 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-serif text-xl">
              <Activity className="h-5 w-5 text-primary" />
              Recent Additions
            </CardTitle>
            <CardDescription>The latest updates to the library</CardDescription>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-center justify-between border-b border-border/50 pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{item.title}</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="uppercase tracking-wider font-semibold text-[10px] bg-secondary/50 px-2 py-0.5 rounded-full">
                          {item.type.replace("-", " ")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(item.createdAt).toLocaleDateString('en-GB')}
                        </span>
                      </div>
                    </div>
                    <Link href={`/workspace/${item.type}s/${item.id}`} className="text-primary hover:underline p-2">
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg border-border">
                No recent activity found.
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="col-span-1 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="font-serif text-xl">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <Link href="/workspace/search" className="flex items-center gap-3 p-3 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors">
               <div className="bg-primary/10 p-2 rounded-md">
                 <Search className="h-5 w-5 text-primary" />
               </div>
               <div>
                 <div className="font-medium">Global Search</div>
                 <div className="text-sm text-muted-foreground">Search across all resources instantly</div>
               </div>
             </Link>
             <Link href="/workspace/workflows" className="flex items-center gap-3 p-3 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors">
               <div className="bg-primary/10 p-2 rounded-md">
                 <Workflow className="h-5 w-5 text-primary" />
               </div>
               <div>
                 <div className="font-medium">Browse Workflows</div>
                 <div className="text-sm text-muted-foreground">Step-by-step procedural practice guides</div>
               </div>
             </Link>
             <Link href="/workspace/cause-papers" className="flex items-center gap-3 p-3 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors">
               <div className="bg-primary/10 p-2 rounded-md">
                 <FileText className="h-5 w-5 text-primary" />
               </div>
               <div>
                 <div className="font-medium">Find Cause Papers</div>
                 <div className="text-sm text-muted-foreground">Templates, precedents, and court document formats</div>
               </div>
             </Link>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

function ProfessionalModeSwitcher() {
  const { role, code, saving, switchRole } = usePersona();
  const { toast } = useToast();

  const handleSwitch = async (next: (typeof PERSONA_ROLES)[number]) => {
    if (next === role) return;
    try {
      await switchRole(next);
      toast({ title: `Switched to ${PERSONA_LABELS[next]}` });
    } catch (e) {
      toast({
        title: "Could not switch professional mode",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={saving}>
          <UserCog className="h-4 w-4" />
          {role ? PERSONA_LABELS[role] : "Professional mode"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Professional mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {code ? (
          PERSONA_ROLES.map((r) => (
            <DropdownMenuItem
              key={r}
              disabled={saving}
              onSelect={(e) => {
                e.preventDefault();
                void handleSwitch(r);
              }}
              className="flex flex-col items-start gap-0.5"
            >
              <span className="flex w-full items-center justify-between font-medium">
                {PERSONA_LABELS[r]}
                {role === r && <Check className="h-4 w-4 text-primary" />}
              </span>
              <span className="text-xs text-muted-foreground">{PERSONA_DESCRIPTIONS[r]}</span>
            </DropdownMenuItem>
          ))
        ) : (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            Log in again with your access code to enable switching.
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
