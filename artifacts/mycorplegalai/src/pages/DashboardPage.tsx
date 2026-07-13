import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { SECTIONS } from "@/data/mock-data";
import { PRACTITIONER_TOOLS, TOOL_CATEGORIES } from "@/data/ai-tools-data";
import { useAiContext } from "@/contexts/AiContext";
import {
  ChevronRight, BrainCircuit, Sparkles, ArrowRight,
  BookOpen, FileText, Scale, Shield, Landmark, Receipt,
  CalendarClock, MessageSquare, Zap, FileSearch, Globe,
  TrendingUp, Swords, FileCheck, Handshake
} from "lucide-react";

const QUICK_ACTIONS = [
  {
    tool: "tutor" as const,
    label: "Ask a Legal Question",
    icon: MessageSquare,
    prompt: "",
    desc: "Get instant answers on Malaysian corporate law",
    accent: "from-purple-500/20 to-blue-500/20",
  },
  {
    tool: "drafter" as const,
    label: "Draft a Document",
    icon: FileText,
    prompt: "",
    desc: "Resolutions, agreements, letters, notices",
    accent: "from-amber-500/20 to-orange-500/20",
  },
  {
    tool: "risk-scanner" as const,
    label: "Scan for Risks",
    icon: Shield,
    prompt: "",
    desc: "Identify legal red flags in your transaction",
    accent: "from-red-500/20 to-pink-500/20",
  },
  {
    tool: "case-finder" as const,
    label: "Find Case Law",
    icon: Scale,
    prompt: "",
    desc: "Find relevant Malaysian cases with citations",
    accent: "from-emerald-500/20 to-teal-500/20",
  },
  {
    tool: "document-analyzer" as const,
    label: "Analyze a Document",
    icon: BookOpen,
    prompt: "",
    desc: "Get AI analysis of any legal document or clause",
    accent: "from-violet-500/20 to-purple-500/20",
  },
  {
    tool: "checklist" as const,
    label: "Generate Checklist",
    icon: Zap,
    prompt: "",
    desc: "Step-by-step procedural checklist",
    accent: "from-cyan-500/20 to-blue-500/20",
  },
];

export default function DashboardPage() {
  const [, setLocation] = useLocation();
  const { openWithContext, setPanelOpen } = useAiContext();

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      setLocation("/login");
    }
  }, [setLocation]);

  const featuredTools = PRACTITIONER_TOOLS.slice(0, 8);
  const totalTools = PRACTITIONER_TOOLS.length;

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/20 flex items-center justify-center">
              <Scale className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground">MYCorpLegalAI</h1>
              <p className="text-muted-foreground text-sm">
                AI-powered practice tools for Malaysian corporate legal practitioners
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500/5 via-primary/5 to-purple-500/5 border border-purple-500/15 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-purple-300/80 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Quick AI Actions
            </h2>
            <span className="text-[10px] text-muted-foreground bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-full font-medium">
              Powered by Gemini 2.5 Flash
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.tool}
                onClick={() => {
                  setPanelOpen(true);
                  openWithContext(action.tool, action.prompt);
                }}
                className="group flex items-start gap-3 bg-card/80 border border-border rounded-lg p-4 hover:border-purple-500/30 hover:bg-purple-500/5 transition-all text-left"
              >
                <div className={`w-9 h-9 rounded-md bg-gradient-to-br ${action.accent} border border-purple-500/10 flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors`}>
                  <action.icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{action.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-purple-300/80 uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-primary" />
              AI Practitioner Tools
            </h2>
            <Link
              href="/tools"
              className="text-xs font-medium text-primary hover:text-primary/80 flex items-center gap-1 px-3 py-1.5 rounded-md border border-primary/20 hover:bg-primary/5 transition-colors"
            >
              View All {totalTools} Tools
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {featuredTools.map((tool) => (
              <Link
                key={tool.id}
                href={`/tools/${tool.id}`}
                className="group flex items-start gap-3 bg-card border border-border rounded-lg p-4 hover:border-purple-500/30 hover:shadow-[0_0_25px_-5px_rgba(120,80,200,0.15)] transition-all"
              >
                <div className="w-9 h-9 rounded-md bg-purple-500/10 border border-purple-500/15 flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors">
                  <tool.icon className={`w-4 h-4 ${tool.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{tool.shortName}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {TOOL_CATEGORIES.map((cat) => {
            const count = PRACTITIONER_TOOLS.filter(t => t.category === cat.id).length;
            if (count === 0) return null;
            return (
              <div key={cat.id} className="bg-card/50 border border-border rounded-lg p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">{count}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{cat.label}</p>
                  <p className="text-[10px] text-muted-foreground">{cat.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-purple-300/80 uppercase tracking-wider mb-3">
            Reference Library
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SECTIONS.map((section) => (
              <Link
                key={section.id}
                href={`/section/${section.id}`}
                className="group flex flex-col bg-card border border-border p-5 rounded-xl hover:border-purple-500/30 hover:shadow-[0_0_25px_-5px_rgba(120,80,200,0.15)] transition-all"
              >
                <h3 className="font-serif text-lg font-semibold text-primary mb-1.5 group-hover:text-accent transition-colors">
                  {section.title}
                </h3>
                <p className="text-xs text-muted-foreground flex-1 mb-4">
                  {section.description}
                </p>
                <div className="flex items-center text-xs font-medium text-foreground group-hover:text-primary transition-colors mt-auto">
                  Explore
                  <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
