import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import WorkspaceLayout from "./layout";
import { useMatters, useAiInsights, daysUntil, fmtDate, generateFileRef, ApiError } from "@/hooks/use-matters";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Scale, FolderKanban, Plus, ArrowRight, CalendarClock,
  AlertTriangle, Sparkles, BrainCircuit, ChevronRight, Building, Landmark,
  FileText, Shield, Hash, User, Target,
} from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { motion } from "framer-motion";

const CCB_STAGES = ["Pre-Action", "Filing", "Interlocutory", "Trial", "Judgment", "Enforcement", "Closed"];

function statusColor(status: string) {
  if (status === "Closed" || status === "closed") return "text-muted-foreground border-border bg-muted";
  if (CCB_STAGES.includes(status)) {
    const idx = CCB_STAGES.indexOf(status);
    if (idx <= 1) return "text-amber-500 border-amber-500/30 bg-amber-500/10";
    if (idx <= 3) return "text-blue-400 border-blue-400/30 bg-blue-400/10";
    return "text-emerald-500 border-emerald-500/30 bg-emerald-500/10";
  }
  switch (status) {
    case "open": return "text-emerald-500 border-emerald-500/30 bg-emerald-500/10";
    case "closed": return "text-muted-foreground border-border bg-muted";
    default: return "text-amber-500 border-amber-500/30 bg-amber-500/10";
  }
}

const QUICK_LINKS = [
  { href: "/workspace/tool/cause-paper-drafter", label: "Draft Cause Papers", icon: FileText, desc: "Statement of claim, defence, counterclaim" },
  { href: "/workspace/tool/interlocutory-drafter", label: "Interlocutory Apps", icon: Scale, desc: "Injunctions, summary judgment, striking out" },
  { href: "/workspace/tool/legal-opinion", label: "Legal Opinion", icon: Shield, desc: "Banking & commercial law opinions" },
  { href: "/workspace/tool/debt-recovery-calc", label: "Debt Calculator", icon: Building, desc: "Interest, costs, judgment amounts" },
];

export default function WorkspaceIndex() {
  const [, setLocation] = useLocation();
  const { data: matters, isLoading, error } = useMatters();

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/access");
    }
  }, [setLocation]);

  const isForbidden = error instanceof ApiError && error.status === 403;
  const activeMatters = (matters ?? []).filter((m) => m.status !== "Closed" && m.status !== "closed");

  return (
    <WorkspaceLayout>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 flex-wrap"
        >
          <div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
              <Landmark className="h-7 w-7 text-primary" />
              Case Command Centre
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Banking litigation and corporate commercial matters — managed from instruction to enforcement.
            </p>
          </div>
          {!isForbidden && (
            <Link href="/workspace/matters">
              <Button className="gap-2">
                <Plus className="h-4 w-4" /> New Matter
              </Button>
            </Link>
          )}
        </motion.div>

        {/* Active matters */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" /> Active Matters
            </h2>
            <Link href="/workspace/matters">
              <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                View all <ChevronRight className="h-3 w-3" />
              </button>
            </Link>
          </div>

          {isForbidden ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-serif font-semibold text-lg text-foreground mb-1">Matter files require a subscriber access code</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Sign in with a subscriber access code to access matter management.
                </p>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
            </div>
          ) : activeMatters.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <FolderKanban className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <h3 className="font-serif font-semibold text-lg text-foreground mb-1">No active matters</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
                  Open a matter to track your banking litigation files, deadlines, and AI-generated cause papers.
                </p>
                <Link href="/workspace/matters">
                  <Button className="gap-2"><Plus className="h-4 w-4" /> Create your first matter</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeMatters.slice(0, 4).map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Link href={`/workspace/matters/${m.id}`}>
                    <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full" data-testid={`card-matter-${m.id}`}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-serif font-semibold text-foreground truncate">{m.title}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${statusColor(m.status)}`}>
                            {m.status}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {m.reference && (
                            <div className="flex items-center gap-1.5"><Hash className="h-3 w-3" /> {m.reference}</div>
                          )}
                          {m.clientName && (
                            <div className="flex items-center gap-1.5"><User className="h-3 w-3" /> {m.clientName}</div>
                          )}
                          {m.matterType && (
                            <div className="flex items-center gap-1.5"><Target className="h-3 w-3" /> {m.matterType}</div>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/60">
                          <span className="text-[11px] text-muted-foreground">Updated {fmtDate(m.updatedAt)}</span>
                          <ArrowRight className="h-4 w-4 text-primary" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Quick action links */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
            <BrainCircuit className="h-4 w-4 text-primary" /> AI Tools
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {QUICK_LINKS.map((q) => (
              <Link key={q.href} href={q.href}>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full group">
                  <CardContent className="p-4">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center mb-2">
                      <q.icon className="h-4 w-4 text-primary" />
                    </div>
                    <p className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{q.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{q.desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="mt-3">
            <Link href="/workspace/tool/list">
              <button className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> View all AI tools <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </Link>
          </div>
        </div>

        {/* Navigation tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: "/workspace/matters", label: "Matter Files", icon: FolderKanban, desc: "All cases & files" },
            { href: "/workspace/calculators", label: "Calculators", icon: Building, desc: "Interest & costs" },
            { href: "/workspace/reference", label: "Reference", icon: Shield, desc: "Legislation & rules" },
            { href: "/workspace/strategy", label: "Strategy", icon: Scale, desc: "Litigation planning" },
          ].map((t) => (
            <Link key={t.href} href={t.href}>
              <Card className="hover:border-primary/30 transition-colors cursor-pointer h-full">
                <CardContent className="p-4 text-center">
                  <t.icon className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="font-medium text-sm text-foreground">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
