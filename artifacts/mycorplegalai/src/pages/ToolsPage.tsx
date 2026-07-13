import { useEffect } from "react";
import { useLocation, Link } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { PRACTITIONER_TOOLS, TOOL_CATEGORIES } from "@/data/ai-tools-data";
import { BrainCircuit, ArrowRight, Sparkles, Lock } from "lucide-react";
import { useTier, canAccessTool, minTierForTool } from "@/lib/tier";

const TIER_LABELS: Record<string, string> = {
  firm: "Firm",
  practitioner: "Practitioner",
  student: "Student",
  legacy_full: "Full Access",
};

export default function ToolsPage() {
  const [, setLocation] = useLocation();
  const tier = useTier();

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      setLocation("/login");
    }
  }, [setLocation]);

  const totalTools = PRACTITIONER_TOOLS.length;

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in duration-500">
        <div className="border-b border-purple-500/15 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 border border-purple-500/20 flex items-center justify-center">
              <BrainCircuit className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground">AI Practitioner Tools</h1>
              <p className="text-sm text-muted-foreground">
                {totalTools} purpose-built AI tools for Malaysian corporate legal practitioners
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3 max-w-2xl">
            Each tool uses structured inputs tailored to real-world workflows — not generic chatbots.
            Fill in the form, and the AI generates detailed, actionable output you can copy, download, and use immediately.
          </p>
        </div>

        {TOOL_CATEGORIES.map((cat) => {
          const tools = PRACTITIONER_TOOLS.filter((t) => t.category === cat.id);
          if (tools.length === 0) return null;
          return (
            <div key={cat.id}>
              <div className="mb-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">{tools.length}</span>
                </div>
                <div>
                  <h2 className="text-xl font-serif font-semibold text-foreground">{cat.label}</h2>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tools.map((tool) => {
                  const locked = !canAccessTool(tier, tool.id);
                  const requiredTier = TIER_LABELS[minTierForTool(tool.id)] ?? "a higher tier";
                  return (
                    <Link
                      key={tool.id}
                      href={locked ? "/pricing" : `/tools/${tool.id}`}
                      className={`group flex flex-col bg-card border rounded-xl p-5 transition-all ${
                        locked
                          ? "border-border opacity-75 hover:opacity-100 hover:border-purple-500/30"
                          : "border-border hover:border-purple-500/30 hover:shadow-[0_0_25px_-5px_rgba(120,80,200,0.15)]"
                      }`}
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/15 flex items-center justify-center shrink-0 group-hover:border-primary/30 transition-colors">
                          <tool.icon className={`w-5 h-5 ${tool.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-serif font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                            {tool.name}
                            {locked && <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {tool.description}
                          </p>
                        </div>
                      </div>
                      {tool.exampleScenario && (
                        <div className="bg-purple-500/5 border border-purple-500/10 rounded-md px-3 py-2 text-[11px] text-muted-foreground mt-auto mb-3">
                          <span className="font-medium text-purple-300/70">Example: </span>{tool.exampleScenario}
                        </div>
                      )}
                      {locked ? (
                        <div className="flex items-center text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors mt-auto pt-2">
                          <Lock className="w-3.5 h-3.5 mr-1.5" />
                          Requires {requiredTier} — Upgrade
                          <ArrowRight className="w-3.5 h-3.5 ml-auto group-hover:translate-x-1 transition-transform" />
                        </div>
                      ) : (
                        <div className="flex items-center text-xs font-medium text-primary/80 group-hover:text-primary transition-colors mt-auto pt-2">
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                          Open Tool
                          <ArrowRight className="w-3.5 h-3.5 ml-auto group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
