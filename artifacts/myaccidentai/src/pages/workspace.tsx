import { useState, useEffect } from "react";
import { emitRateLimit, readRateLimitRemaining } from "@/lib/rate-limit-bus";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";
import { useLocation, useSearchParams, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAccidentCheckSession, useAccidentLogout, getAccidentCheckSessionQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookOpen, Scale, FileText, Activity, Shield, Search,
  ChevronDown, LogOut, Home, MessageSquare, Calculator,
  FileEdit, Map, Gavel, Users, Clock, ArrowRight, BookMarked,
  CheckSquare, Library, Info, ExternalLink, Folder, Briefcase, Sparkles, AlertTriangle, UserCog
} from "lucide-react";
import { MatterPicker } from "@/components/MatterPicker";
import { type Matter } from "@/hooks/use-matters";
import {
  theoryTopics, caseLaws, workflows, sampleDocs,
  glossaryTerms, statuteReferences, checklistData,
  interlocutoryApplications, aiAssistantQA
} from "@/components/workspace/data";
import { CalculatorTab } from "@/components/workspace/calculator-tab";
import { CausePaperGenerator } from "@/components/workspace/cause-paper-generator";
import { ChecklistsTab } from "@/components/workspace/checklists-tab";
import { templates } from "@/components/workspace/templates";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import MyCases from "@/components/my-cases";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  clearStoredPersona,
  PERSONA_DASHBOARD_FRAMING,
  PERSONA_DESCRIPTIONS,
  PERSONA_LABELS,
  PERSONA_ROLES,
  usePersona,
} from "@workspace/persona-client";
import { Check } from "lucide-react";
import { requireGeneratedText } from "@/lib/ai-response";

function tokenize(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9]+/i).filter(t => t.length > 0);
}

function matchesTokens(tokens: string[], haystack: string): boolean {
  if (tokens.length === 0) return true;
  const h = haystack.toLowerCase();
  return tokens.every(t => h.includes(t));
}

type Tab = "my-cases" | "theory" | "cases" | "workflows" | "documents" | "glossary" | "calculator" | "assistant" | "statutes" | "checklists" | "applications" | "generator" | "analyzer" | "drafter";

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
        <Button variant="outline" size="sm" className="gap-2" disabled={saving} data-testid="button-professional-mode">
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
              data-testid={`persona-option-${r}`}
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

/** Build a readable matter summary for AI fact-input textareas */
function buildMatterSummary(m: Matter): string {
  const lines: string[] = [];
  if (m.title) lines.push(`Matter: ${m.title}`);
  const client = m.clientName || m.plaintiff;
  if (client) lines.push(`Client / Plaintiff: ${client}`);
  if (m.defendant) lines.push(`Defendant: ${m.defendant}`);
  if (m.matterType) lines.push(`Matter type: ${m.matterType}`);
  if (m.court) lines.push(`Court: ${m.court}`);
  if (m.caseNo) lines.push(`Case / Suit No.: ${m.caseNo}`);
  if (m.fileRef) lines.push(`File ref: ${m.fileRef}`);
  if (m.claimAmount) lines.push(`Claim amount: ${m.claimAmount}`);
  if (m.actingFor) lines.push(`Acting for: ${m.actingFor}`);
  if (m.notes) lines.push(`\nBackground / facts:\n${m.notes}`);
  return lines.join("\n");
}

export default function Workspace() {
  const [searchParams] = useSearchParams();

  // Parse Case Home query params: ?tab=analyzer&matterId=X&client=Y&plaintiff=Z&matterTitle=T
  const tabFromQuery = searchParams.get("tab") as Tab | null;
  const matterIdFromQuery = searchParams.get("matterId")
    ? parseInt(searchParams.get("matterId")!, 10)
    : null;
  const clientFromQuery = searchParams.get("client") ?? "";
  const plaintiffFromQuery = searchParams.get("plaintiff") ?? "";
  const matterTitleFromQuery = searchParams.get("matterTitle") ?? "";

  const [activeTab, setActiveTab] = useState<Tab>(
    tabFromQuery && ["my-cases","theory","cases","workflows","documents","glossary","calculator","assistant","statutes","checklists","applications","generator","analyzer","drafter"].includes(tabFromQuery)
      ? tabFromQuery
      : "my-cases",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [generatorTemplateId, setGeneratorTemplateId] = useState<string | undefined>(undefined);
  const [pickedMatter, setPickedMatter] = useState<Matter | null>(null);

  const openGenerator = (templateId?: string) => {
    setGeneratorTemplateId(templateId);
    setActiveTab("generator");
    setSearchQuery("");
  };
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: session, isLoading } = useAccidentCheckSession();
  const logout = useAccidentLogout();
  const { role } = usePersona();

  useEffect(() => {
    if (!isLoading && (!session || !session.authenticated)) {
      // Session expired / not authenticated — clear the shared persona cache so
      // the next subscriber on this browser never inherits the previous one.
      clearStoredPersona();
      setLocation("/login");
    }
  }, [session, isLoading, setLocation]);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: async () => {
        clearStoredPersona();
        await queryClient.invalidateQueries({ queryKey: getAccidentCheckSessionQueryKey() });
        setLocation("/");
      },
    });
  };

  const framing = role ? PERSONA_DASHBOARD_FRAMING[role] : null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading workspace...</div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof BookOpen; count?: number }[] = [
    { id: "my-cases", label: "My Cases", icon: Folder },
    { id: "theory", label: "Theory & Principles", icon: BookOpen, count: theoryTopics.length },
    { id: "cases", label: "Case Law Database", icon: Scale, count: caseLaws.length },
    { id: "statutes", label: "Statutes & Sections", icon: Library, count: statuteReferences.reduce((s, r) => s + r.sections.length, 0) },
    { id: "applications", label: "Notices of Application", icon: Briefcase, count: interlocutoryApplications.length },
    { id: "workflows", label: "Practice Workflows", icon: Activity, count: workflows.length },
    { id: "documents", label: "Document Templates", icon: FileText, count: sampleDocs.length },
    { id: "generator", label: "Cause Paper Generator", icon: Sparkles, count: templates.length },
    { id: "checklists", label: "Practice Checklists", icon: CheckSquare, count: checklistData.reduce((s, c) => s + c.items.length, 0) },
    { id: "glossary", label: "Legal Glossary", icon: BookMarked, count: glossaryTerms.length },
    { id: "calculator", label: "AI Damages Calculator", icon: Calculator },
    { id: "assistant", label: "AI Legal Assistant", icon: MessageSquare },
    { id: "analyzer", label: "AI Case Analyzer", icon: Gavel },
    { id: "drafter", label: "AI Document Drafter", icon: FileEdit },
  ];

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-64 border-r border-border bg-card/50 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-border">
          <Link href="/" className="text-xl font-serif font-bold" data-testid="link-home-workspace">
            MyAccident<span className="text-primary">Ai</span>
          </Link>
          {session?.codeLabel && (
            <p className="text-xs text-muted-foreground mt-1">{session.codeLabel}</p>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }}
              data-testid={`sidebar-${tab.id}`}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.count && (
                <span className="text-xs bg-muted px-2 py-0.5 rounded">{tab.count}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <Button variant="outline" size="sm" className="w-full gap-2" asChild>
            <Link href="/workspace/matters" data-testid="link-matters-from-workspace"><Folder className="h-4 w-4" /> Matter Files</Link>
          </Button>
          <Button variant="outline" size="sm" className="w-full gap-2" asChild>
            <Link href="/workspace/billing" data-testid="link-billing-from-workspace"><Calculator className="h-4 w-4" /> Billing</Link>
          </Button>
          <Button variant="outline" size="sm" className="w-full gap-2" asChild>
            <Link href="/workspace/case-law" data-testid="link-case-law-from-workspace"><BookOpen className="h-4 w-4" /> Case Law</Link>
          </Button>
          <Button variant="outline" size="sm" className="w-full gap-2" asChild>
            <Link href="/" data-testid="link-home-from-workspace"><Home className="h-4 w-4" /> Home</Link>
          </Button>
          <Button variant="outline" size="sm" className="w-full gap-2 text-destructive" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-8 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-serif font-bold">{tabs.find(t => t.id === activeTab)?.label}</h1>
              {role && (
                <Badge variant="secondary" data-testid="badge-persona">{PERSONA_LABELS[role]}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {framing?.tagline ?? "Accident, Personal Injury & Running Down — Malaysian Law"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ProfessionalModeSwitcher />
            <div className="relative w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search across all content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card"
                data-testid="input-search"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={handleLogout}
              data-testid="button-logout-header"
              disabled={logout.isPending}
            >
              <LogOut className="h-4 w-4" />
              {logout.isPending ? "Logging out..." : "Logout"}
            </Button>
          </div>
        </header>

        <div className="p-8">
          {/* Matter picker banner — shown above AI tool tabs only */}
          {(activeTab === "assistant" || activeTab === "analyzer" || activeTab === "drafter" || activeTab === "calculator") && (
            <div className="mb-5 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Pre-fill from:</span>
              <MatterPicker
                onSelect={(m) => setPickedMatter(m)}
                selectedTitle={pickedMatter?.title}
                onClear={() => setPickedMatter(null)}
              />
              {pickedMatter && (
                <span className="text-xs text-muted-foreground">
                  — fields pre-filled from <strong>{pickedMatter.title}</strong>. You can still edit before generating.
                </span>
              )}
            </div>
          )}

          {activeTab === "my-cases" && <MyCases />}
          {activeTab === "theory" && <TheoryTab search={searchQuery} />}
          {activeTab === "cases" && <CasesTab search={searchQuery} />}
          {activeTab === "statutes" && <StatutesTab search={searchQuery} />}
          {activeTab === "applications" && <ApplicationsTab search={searchQuery} />}
          {activeTab === "workflows" && <WorkflowsTab search={searchQuery} />}
          {activeTab === "documents" && <DocumentsTab search={searchQuery} onOpenGenerator={openGenerator} />}
          {activeTab === "generator" && <CausePaperGenerator initialTemplateId={generatorTemplateId} />}
          {activeTab === "checklists" && <ChecklistsTab />}
          {activeTab === "glossary" && <GlossaryTab search={searchQuery} />}
          {activeTab === "calculator" && <CalculatorTab matter={pickedMatter} />}
          {activeTab === "assistant" && <AssistantTab matter={pickedMatter} />}
          {activeTab === "analyzer" && (
            <CaseAnalyzerTab
              matter={pickedMatter}
              matterIdFromQuery={!pickedMatter ? matterIdFromQuery : null}
              prefillContext={!pickedMatter && (matterTitleFromQuery || clientFromQuery || plaintiffFromQuery)
                ? [
                    matterTitleFromQuery && `Matter: ${matterTitleFromQuery}`,
                    (clientFromQuery || plaintiffFromQuery) && `Client / Plaintiff: ${clientFromQuery || plaintiffFromQuery}`,
                  ].filter(Boolean).join("\n")
                : undefined}
            />
          )}
          {activeTab === "drafter" && <AiDrafterTab matter={pickedMatter} />}
        </div>
      </main>
    </div>
  );
}

function TheoryTab({ search }: { search: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = [...new Set(theoryTopics.map(t => t.category))];
  const tokens = tokenize(search);
  const filtered = theoryTopics.filter(t => {
    const matchesSearch = matchesTokens(tokens, `${t.title} ${t.desc} ${t.category} ${(t.statutes || []).join(" ")}`);
    const matchesCat = !selectedCategory || t.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button variant={!selectedCategory ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(null)} className="text-xs">
          All ({theoryTopics.length})
        </Button>
        {categories.map(cat => {
          const count = theoryTopics.filter(t => t.category === cat).length;
          return (
            <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(cat)} className="text-xs">
              {cat} ({count})
            </Button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((topic, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors" data-testid={`card-theory-${i}`}>
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{topic.category}</span>
            </div>
            <h3 className="font-serif font-semibold text-foreground mb-1">{topic.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{topic.desc}</p>
            {topic.statutes.length > 0 && (
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {topic.statutes.map((s, j) => (
                  <span key={j} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">{s}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function CasesTab({ search }: { search: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"year" | "name">("year");
  const [recentOnly, setRecentOnly] = useState(false);
  const [unverifiedOnly, setUnverifiedOnly] = useState(false);
  const categories = [...new Set(caseLaws.map(c => c.category))];

  const tokens = tokenize(search);

  const filtered = caseLaws
    .filter(c => {
      const haystack = `${c.name} ${c.principle} ${c.court} ${c.category} ${c.year}`;
      const matchesSearch = matchesTokens(tokens, haystack);
      const matchesCat = !selectedCategory || c.category === selectedCategory;
      const matchesRecent = !recentOnly || c.year >= 2020;
      const isUnverified = c.verified === false;
      const matchesVerif = !unverifiedOnly || isUnverified;
      return matchesSearch && matchesCat && matchesRecent && matchesVerif;
    })
    .sort((a, b) => sortBy === "year" ? b.year - a.year : a.name.localeCompare(b.name));

  return (
    <div>
      <div className="bg-amber-500/5 border border-amber-500/30 rounded-xl p-4 mb-5" data-testid="cases-disclaimer">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-foreground/80 leading-relaxed">
            <p className="font-semibold text-amber-500 mb-1">Verify before citing in court</p>
            <p>
              This database is a study and research aid. Always confirm the citation, holding and current authority of any case against an authoritative
              source (MLJ, CLJ, eLaw, LexisNexis, Thomson Reuters) before pleading or submitting it. Spotted an error? Please notify the platform editor so
              the entry can be reviewed and corrected.
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <Button variant={!selectedCategory ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(null)} className="text-xs">
            All ({caseLaws.length})
          </Button>
          {categories.map(cat => {
            const count = caseLaws.filter(c => c.category === cat).length;
            return (
              <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(cat)} className="text-xs">
                {cat} ({count})
              </Button>
            );
          })}
        </div>
        <div className="flex gap-1 text-xs flex-wrap">
          <Button variant={sortBy === "year" ? "default" : "outline"} size="sm" onClick={() => setSortBy("year")} className="text-xs">By Year</Button>
          <Button variant={sortBy === "name" ? "default" : "outline"} size="sm" onClick={() => setSortBy("name")} className="text-xs">By Name</Button>
          <Button variant={recentOnly ? "default" : "outline"} size="sm" onClick={() => setRecentOnly(v => !v)} className="text-xs" data-testid="filter-recent">Recent (2020+)</Button>
          <Button variant={unverifiedOnly ? "default" : "outline"} size="sm" onClick={() => setUnverifiedOnly(v => !v)} className="text-xs" data-testid="filter-unverified">Flagged unverified only</Button>
        </div>
      </div>
      <div className="space-y-3">
        {filtered.map((law, i) => {
          const unverified = law.verified === false;
          const note = law.verifyNote;
          return (
          <div key={i} className={`bg-card border rounded-xl p-5 hover:border-primary/30 transition-colors ${unverified ? "border-amber-500/40" : "border-border"}`} data-testid={`card-case-${i}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="font-serif font-semibold text-primary">{law.name}</h3>
                  {unverified && (
                    <span className="text-[10px] bg-amber-500/15 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded inline-flex items-center gap-1" data-testid={`badge-unverified-${i}`}>
                      <AlertTriangle className="h-2.5 w-2.5" /> Unverified — verify before citing
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed"><strong>Principle:</strong> {law.principle}</p>
                {unverified && note && (
                  <p className="text-xs text-amber-500/90 mt-2 italic">{note}</p>
                )}
              </div>
              <div className="flex flex-col gap-1 items-end flex-shrink-0">
                <span className="text-xs bg-muted px-2 py-1 rounded">{law.court}</span>
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{law.category}</span>
                <span className="text-xs text-muted-foreground">{law.year}</span>
              </div>
            </div>
          </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Showing {filtered.length} of {caseLaws.length} cases</p>
    </div>
  );
}

function StatutesTab({ search }: { search: string }) {
  const [expandedStatute, setExpandedStatute] = useState<string | null>(statuteReferences[0]?.name || null);
  const tokens = tokenize(search);

  return (
    <div className="space-y-4">
      {statuteReferences.map((statute, i) => {
        const expanded = expandedStatute === statute.name;
        const filteredSections = statute.sections.filter(s =>
          matchesTokens(tokens, `${s.section} ${s.title} ${s.desc} ${statute.name}`)
        );
        if (search && filteredSections.length === 0) return null;

        return (
          <div key={i} className="bg-card border border-border rounded-xl overflow-hidden" data-testid={`statute-${i}`}>
            <button
              className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
              onClick={() => setExpandedStatute(expanded ? null : statute.name)}
            >
              <div className="flex items-center gap-3">
                <Library className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="text-left">
                  <h3 className="font-serif font-semibold">{statute.name}</h3>
                  <p className="text-xs text-muted-foreground">{statute.sections.length} key sections</p>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            {expanded && (
              <div className="border-t border-border divide-y divide-border">
                {(search ? filteredSections : statute.sections).map((sec, j) => (
                  <div key={j} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-xs bg-primary/10 text-primary px-2 py-1 rounded flex-shrink-0 mt-0.5">{sec.section}</span>
                      <div>
                        <h4 className="font-semibold text-sm">{sec.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{sec.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WorkflowsTab({ search }: { search: string }) {
  const [expandedWf, setExpandedWf] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = [...new Set(workflows.map(w => w.category))];
  const tokens = tokenize(search);
  const filtered = workflows.filter(w => {
    const matchesSearch = matchesTokens(tokens, `${w.title} ${w.category} ${w.est} ${(w.steps || []).join(" ")}`);
    const matchesCat = !selectedCategory || w.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button variant={!selectedCategory ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(null)} className="text-xs">All</Button>
        {categories.map(cat => (
          <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(cat)} className="text-xs">{cat}</Button>
        ))}
      </div>
      <div className="space-y-4">
        {filtered.map((wf, i) => (
          <div key={i} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors" data-testid={`card-workflow-${i}`}>
            <button className="w-full p-6 text-left flex items-center gap-4" onClick={() => setExpandedWf(expandedWf === i ? null : i)}>
              <Map className="h-8 w-8 text-primary flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-serif font-semibold mb-1">{wf.title}</h3>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> {wf.steps.length} steps</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {wf.est}</span>
                  <span className="bg-muted px-2 py-0.5 rounded">{wf.category}</span>
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedWf === i ? "rotate-180" : ""}`} />
            </button>
            {expandedWf === i && (
              <div className="px-6 pb-6 border-t border-border pt-4">
                <div className="space-y-3">
                  {wf.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-mono font-bold text-primary">{j + 1}</span>
                      </div>
                      <p className="text-sm text-foreground/80 pt-1">{step}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">Estimated timeline: <strong>{wf.est}</strong></p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function findGeneratorMatch(docName: string): string | undefined {
  const n = docName.toLowerCase();
  const map: { keys: string[]; id: string }[] = [
    { keys: ["writ of summons", "writ saman"], id: "writ-summons" },
    { keys: ["statement of claim", "soc"], id: "soc-mva" },
    { keys: ["memorandum of appearance", "memo of appearance"], id: "memo-appearance" },
    { keys: ["statement of defence", "defence"], id: "defence-mva" },
    { keys: ["s.96", "s. 96", "section 96", "notice of demand (s.96"], id: "s96-notice" },
    { keys: ["letter of demand"], id: "demand-letter" },
    { keys: ["interim payment"], id: "noa-interim-payment" },
    { keys: ["affidavit"], id: "affidavit-interim" },
    { keys: ["summary judgment", "o.14"], id: "noa-summary-judgment" },
    { keys: ["striking out", "strike out", "o.18 r.19"], id: "noa-striking-out" },
    { keys: ["discovery"], id: "noa-discovery" },
    { keys: ["default judgment", "judgment in default"], id: "noa-default-judgment" },
    { keys: ["third party"], id: "noa-third-party" },
    { keys: ["scott schedule"], id: "scott-schedule" },
    { keys: ["bundle of pleadings", "bundle pliding"], id: "bundle-pleadings" },
    { keys: ["bundle a", "part a", "agreed bundle", "bundle of documents part a"], id: "bundle-docs-a" },
    { keys: ["bundle b", "part b", "bundle of documents part b"], id: "bundle-docs-b" },
    { keys: ["bundle c", "part c", "bundle of documents part c"], id: "bundle-docs-c" },
    { keys: ["common bundle", "joint bundle"], id: "common-bundle" },
    { keys: ["core bundle"], id: "core-bundle" },
    { keys: ["bundle of authorities", "authorities"], id: "bundle-authorities" },
    { keys: ["bundle of witness", "witness statements bundle"], id: "bundle-witness-statements" },
    { keys: ["witness statement", "evidence-in-chief", "evidence in chief"], id: "witness-statement" },
    { keys: ["bundle of documents", "bundle"], id: "bundle-of-documents" },
    { keys: ["mareva"], id: "noa-mareva" },
    { keys: ["anton piller"], id: "noa-anton-piller" },
    { keys: ["norwich pharmacal"], id: "noa-norwich-pharmacal" },
    { keys: ["seizure and sale", "writ of seizure"], id: "writ-seizure-sale" },
    { keys: ["garnishee"], id: "garnishee" },
    { keys: ["judgment debtor summons", "jds"], id: "judgment-debtor-summons" },
    { keys: ["set aside", "setting aside"], id: "noa-set-aside" },
    { keys: ["extension of time", "extension of the time"], id: "noa-extension-time" },
    { keys: ["stay of execution", "stay of"], id: "noa-stay-execution" },
    { keys: ["notice of trial", "setting down"], id: "notice-trial" },
    { keys: ["subpoena duces", "duces tecum"], id: "subpoena-duces" },
    { keys: ["subpoena ad test", "subpoena ad", "subpoena"], id: "subpoena-ad-test" },
    { keys: ["notice to admit"], id: "notice-admit-facts" },
    { keys: ["notice to produce"], id: "notice-produce-docs" },
    { keys: ["interrogator"], id: "interrogatories" },
    { keys: ["discontinuance"], id: "notice-discontinuance" },
    { keys: ["change of solicitor", "change solicitor"], id: "notice-change-solicitors" },
    { keys: ["consent judgment", "order in terms"], id: "consent-judgment" },
    { keys: ["notice of appeal"], id: "notice-of-appeal" },
    { keys: ["memorandum of appeal", "memo of appeal"], id: "memo-of-appeal" },
    { keys: ["bill of cost"], id: "bill-of-costs" },
    { keys: ["written submission", "skeletal", "submissions"], id: "skeletal-submissions" },
    { keys: ["agreed issues", "list of issues", "statement of issues"], id: "list-of-issues" },
    { keys: ["reply and defence", "reply to counterclaim"], id: "reply-defence-counterclaim" },
    { keys: ["leave to appeal"], id: "noa-leave-appeal" },
    { keys: ["originating summons"], id: "originating-summons" },
  ];
  for (const m of map) {
    if (m.keys.some(k => n.includes(k))) return m.id;
  }
  return undefined;
}

function DocumentsTab({ search, onOpenGenerator }: { search: string; onOpenGenerator: (id?: string) => void }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = [...new Set(sampleDocs.map(d => d.category))];
  const tokens = tokenize(search);
  const filtered = sampleDocs.filter(d => {
    const matchesSearch = matchesTokens(tokens, `${d.name} ${d.desc} ${d.category}`);
    const matchesCat = !selectedCategory || d.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div>
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">Click any template to open it in the Cause Paper Generator</p>
          <p className="text-xs text-muted-foreground mt-0.5">Fill in case details, preview live, then copy or download as a draft.</p>
        </div>
        <Button size="sm" onClick={() => onOpenGenerator()} className="gap-1.5" data-testid="button-open-generator">
          <Sparkles className="h-3.5 w-3.5" /> Open Generator
        </Button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <Button variant={!selectedCategory ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(null)} className="text-xs">
          All ({sampleDocs.length})
        </Button>
        {categories.map(cat => {
          const count = sampleDocs.filter(d => d.category === cat).length;
          return (
            <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(cat)} className="text-xs">
              <Folder className="h-3 w-3 mr-1" /> {cat} ({count})
            </Button>
          );
        })}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((doc, i) => {
          const generatorId = findGeneratorMatch(doc.name);
          const hasGenerator = !!generatorId;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onOpenGenerator(generatorId)}
              className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 hover:bg-card/80 transition-colors cursor-pointer group text-left"
              data-testid={`card-doc-${i}`}
            >
              <div className="flex items-start gap-3">
                <FileEdit className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium block">{doc.name}</span>
                  <p className="text-xs text-muted-foreground mt-1">{doc.desc}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground inline-block">{doc.category}</span>
                    {hasGenerator ? (
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                        <Sparkles className="h-2.5 w-2.5" /> Generate
                      </span>
                    ) : (
                      <span className="text-[10px] bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded inline-block">Open in generator</span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 group-hover:text-primary" />
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Showing {filtered.length} of {sampleDocs.length} templates · {templates.length} live cause paper generators available</p>
    </div>
  );
}

function GlossaryTab({ search }: { search: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categories = [...new Set(glossaryTerms.map(g => g.category))];
  const tokens = tokenize(search);
  const filtered = glossaryTerms.filter(g => {
    const matchesSearch = matchesTokens(tokens, `${g.term} ${g.def} ${g.category}`);
    const matchesCat = !selectedCategory || g.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const alphabet = [...new Set(filtered.map(g => g.term[0].toUpperCase()))].sort();

  return (
    <div>
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button variant={!selectedCategory ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(null)} className="text-xs">
          All ({glossaryTerms.length})
        </Button>
        {categories.map(cat => {
          const count = glossaryTerms.filter(g => g.category === cat).length;
          return (
            <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(cat)} className="text-xs">
              {cat} ({count})
            </Button>
          );
        })}
      </div>
      <div className="space-y-6">
        {alphabet.map(letter => {
          const letterTerms = filtered.filter(g => g.term[0].toUpperCase() === letter);
          if (letterTerms.length === 0) return null;
          return (
            <div key={letter}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-serif font-bold text-primary">{letter}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="space-y-2 pl-2">
                {letterTerms.map((g, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors" data-testid={`card-glossary-${g.term.replace(/\s/g, '-')}`}>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-serif font-semibold text-primary">{g.term}</h3>
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground flex-shrink-0">{g.category}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{g.def}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Showing {filtered.length} of {glossaryTerms.length} terms</p>
    </div>
  );
}

function ApplicationsTab({ search }: { search: string }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedApp, setExpandedApp] = useState<number | null>(null);
  const categories = [...new Set(interlocutoryApplications.map(a => a.category))];
  const tokens = tokenize(search);
  const filtered = interlocutoryApplications.filter(a => {
    const matchesSearch = matchesTokens(tokens, `${a.name} ${a.purpose} ${a.rule} ${a.outcome} ${a.category} ${(a.requirements || []).join(" ")}`);
    const matchesCat = !selectedCategory || a.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div>
      <div className="bg-muted/30 rounded-xl p-4 border border-border mb-6">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Comprehensive reference for all major Notices of Application and interim/interlocutory orders under the Rules of Court 2012. Each entry sets out the governing rule, purpose, requirements, and likely outcome.
          </p>
        </div>
      </div>
      <div className="flex gap-2 mb-6 flex-wrap">
        <Button variant={!selectedCategory ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(null)} className="text-xs">
          All ({interlocutoryApplications.length})
        </Button>
        {categories.map(cat => {
          const count = interlocutoryApplications.filter(a => a.category === cat).length;
          return (
            <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(cat)} className="text-xs">
              {cat} ({count})
            </Button>
          );
        })}
      </div>
      <div className="space-y-3">
        {filtered.map((app, i) => {
          const expanded = expandedApp === i;
          return (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors" data-testid={`card-application-${i}`}>
              <button className="w-full p-5 text-left" onClick={() => setExpandedApp(expanded ? null : i)}>
                <div className="flex items-start gap-4">
                  <Briefcase className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-serif font-semibold text-foreground">{app.name}</h3>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">{app.rule}</span>
                      <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">{app.category}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{app.purpose}</p>
                  </div>
                </div>
              </button>
              {expanded && (
                <div className="px-5 pb-5 border-t border-border pt-4 ml-10">
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold uppercase text-primary mb-2">Requirements</h4>
                    <ul className="space-y-1.5">
                      {app.requirements.map((r, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-foreground/80">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-primary mb-2">Outcome</h4>
                    <p className="text-sm text-foreground/80">{app.outcome}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">Showing {filtered.length} of {interlocutoryApplications.length} applications</p>
    </div>
  );
}

type ChatMsg = { role: "user" | "assistant"; content: string };

function AssistantTab({ matter }: { matter?: Matter | null }) {
  const [input, setInput] = useState(() =>
    matter ? buildMatterSummary(matter) + "\n\nPlease advise on the key legal issues and recommended next steps." : ""
  );
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedQA, setExpandedQA] = useState<number | null>(null);
  const qaTokens = tokenize(search);
  const filteredQA = aiAssistantQA.filter(qa => matchesTokens(qaTokens, `${qa.q} ${qa.a}`));

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setError(null);
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/accident/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 429) emitRateLimit(0);
        throw new Error(j.error || `Request failed (${res.status})`);
      }
      const rl = readRateLimitRemaining(res);
      if (rl !== null) emitRateLimit(rl);
      const j = await res.json();
       setMessages([...next, { role: "assistant", content: requireGeneratedText(j, "reply") }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "What is the limitation period for a child injured in a motor accident?",
    "Calculate dependency for a 35-year-old deceased earning RM5,000/month with 2 kids",
    "How do I draft a Notice of Application for interim payment under O.29 r.10?",
    "What contributory negligence applies to a pillion rider not wearing helmet?",
  ];

  return (
    <div className="max-w-4xl">
      <div className="bg-muted/30 rounded-xl p-4 border border-border mb-6">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Live AI assistant powered by GPT-5, trained on Malaysian Accident, PI & Running Down law. Ask anything about limitation, contributory negligence, quantum, interlocutory applications, MIB claims, enforcement, fatal accidents, and more. Also browse {aiAssistantQA.length} curated Q&As below.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="space-y-4 mb-4 min-h-[300px] max-h-[500px] overflow-y-auto" data-testid="chat-messages">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Ask any Malaysian PI / running-down legal question. Responses are AI-generated and based on Civil Law Act 1956, RTA 1987, ROC 2012 and leading authorities.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => send(s)}
                    className="text-left text-xs p-3 bg-background border border-border rounded-lg hover:border-primary/30 transition-colors"
                    data-testid={`suggestion-${i}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className="flex gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.role === "user" ? "bg-secondary" : "bg-primary"}`}>
                {m.role === "user" ? <Users className="h-4 w-4" /> : <Gavel className="h-4 w-4 text-primary-foreground" />}
              </div>
              <div className={`p-4 rounded-2xl flex-1 text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-secondary/20 rounded-tl-sm" : "bg-background border border-border rounded-tl-sm"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                <Gavel className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="bg-background border border-border p-4 rounded-2xl rounded-tl-sm flex-1 text-sm text-muted-foreground">
                <span className="animate-pulse">Researching Malaysian authorities…</span>
              </div>
            </div>
          )}
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 text-destructive text-xs p-3 rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="relative">
          <Input
            placeholder="Ask a legal question about accident & PI law in Malaysia..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="pr-24 bg-background"
            disabled={loading}
            data-testid="input-assistant-question"
          />
          <div className="absolute right-1 top-1 flex gap-1">
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setMessages([]); setError(null); }} data-testid="button-clear-chat">
                Clear
              </Button>
            )}
            <Button size="icon" className="h-8 w-8 bg-primary" onClick={() => send()} disabled={loading || !input.trim()} data-testid="button-send-question">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">AI responses are for reference only. Always verify against primary sources and current authorities before relying on any guidance in actual practice.</p>

        <div className="mt-6 pt-6 border-t border-border">
          <button
            className="w-full flex items-center justify-between p-3 hover:bg-muted/30 rounded-lg transition-colors"
            onClick={() => setShowLibrary(!showLibrary)}
            data-testid="button-toggle-library"
          >
            <div className="flex items-center gap-2">
              <Library className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Curated Q&A Library ({aiAssistantQA.length})</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showLibrary ? "rotate-180" : ""}`} />
          </button>

          {showLibrary && (
            <div className="mt-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter Q&A library..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setExpandedQA(null); }}
                  className="pl-9 bg-background"
                  data-testid="input-assistant-filter"
                />
              </div>
              <div className="space-y-2">
                {filteredQA.map((qa, i) => {
                  const expanded = expandedQA === i;
                  return (
                    <div key={i} className="border border-border rounded-xl overflow-hidden">
                      <button
                        className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedQA(expanded ? null : i)}
                        data-testid={`qa-${i}`}
                      >
                        <p className="flex-1 text-sm font-medium">{qa.q}</p>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                      </button>
                      {expanded && (
                        <div className="border-t border-border p-4 bg-background/50 text-sm leading-relaxed whitespace-pre-line">
                          {qa.a}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredQA.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">No matching questions.</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CaseAnalyzerTab({
  matter,
  matterIdFromQuery,
  prefillContext,
}: {
  matter?: Matter | null;
  matterIdFromQuery?: number | null;
  prefillContext?: string;
}) {
  // Build initial facts: picked matter > query-param context > empty
  const [facts, setFacts] = useState(() => {
    if (matter) return buildMatterSummary(matter);
    if (prefillContext) return prefillContext + "\n\n[Add full accident facts here — the more detail, the better the analysis.]";
    return "";
  });
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The matter to file into: prefer explicitly picked matter id over query param
  const targetMatterId = matter?.id ?? matterIdFromQuery ?? null;

  const analyze = async () => {
    if (facts.trim().length < 20) {
      setError("Please describe the case facts (at least 20 characters).");
      return;
    }
    setError(null);
    setLoading(true);
    setAnalysis("");
    try {
      const res = await fetch("/api/accident/ai/analyze-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ facts }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 429) emitRateLimit(0);
        throw new Error(j.error || `Request failed (${res.status})`);
      }
      const rl = readRateLimitRemaining(res);
      if (rl !== null) emitRateLimit(rl);
      const j = await res.json();
       setAnalysis(requireGeneratedText(j, "analysis", "Case analysis"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const sample = `On 12 March 2026 at about 2.30pm at KM 45 of the North-South Expressway near Tapah, my client (45 year old male, monthly net income RM6,200, married with 3 dependent children) was driving his Toyota Vios at about 90 km/h in the right lane. A Hilux 4x4 in the middle lane suddenly changed lane to the right without signalling and collided with my client's vehicle. My client lost control, hit the divider and the car overturned.

Injuries: closed fracture of right femur (operated, IM nailing), 3 fractured ribs, mild closed head injury with brief loss of consciousness, multiple lacerations on face requiring 18 stitches, post-traumatic stress symptoms.

Hospital: 11 days admission at Hospital Sultanah Aminah Johor Bahru, then 6 weeks of physiotherapy. Sick leave 4 months. Permanent disability assessment: 18%.

Special damages incurred: RM 24,500 medical, RM 8,200 vehicle repair (insurer paid RM 6,000), RM 3,200 transport, RM 24,800 loss of earnings (4 months).

Defendant has third-party insurance only. Police report lodged same day. Defendant pleaded guilty to careless driving in magistrates court and was fined RM 1,500.`;

  return (
    <div
      className="max-w-5xl"
      data-testid="case-home-handoff-target"
      data-matter-id={targetMatterId ?? undefined}
    >
      <div className="bg-muted/30 rounded-xl p-4 border border-border mb-6">
        <div className="flex items-start gap-2">
          <Gavel className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Paste your case facts below — AI will produce a full structured analysis: liability split, possible defences, contributory negligence, indicative quantum table (RM), recommended procedure, evidence to gather, settlement strategy, and risks. Powered by GPT-5 trained on Malaysian PI authorities.
          </p>
        </div>
      </div>

      {/* Banner when opened from Case Home with matter context */}
      {targetMatterId && !matter && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 mb-4 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>
            Case facts pre-filled from your matter file. Edit freely before analysing.
          </span>
          <Link
            href={`/workspace/matters/${targetMatterId}`}
            className="ml-auto text-primary hover:underline shrink-0"
          >
            Back to matter
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Case Facts</h3>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFacts(sample)} data-testid="button-load-sample">
              Load sample
            </Button>
          </div>
          <textarea
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            placeholder="Date, time, place. Parties (ages, occupations, monthly income, dependants). How the accident happened. Police report. Injuries with severity & duration. Hospital stay & treatment. Sick leave. Permanent disability %. Special damages with amounts. Insurance position. Any prior negotiations or admissions. The more detail, the better the analysis."
            rows={20}
            className="w-full bg-background border border-border rounded-lg p-3 text-sm font-mono resize-none"
            data-testid="textarea-case-facts"
          />
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={analyze} disabled={loading} className="bg-primary flex-1" data-testid="button-analyze">
              {loading ? "Analyzing…" : "Analyze Case"}
            </Button>
            {analysis && (
              <DraftExportButtons title="AI Case Analysis" content={analysis} hideMarkdown />
            )}
          </div>
          {error && (
            <p className="mt-2 text-xs text-destructive">{error}</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-3">Analysis</h3>
          <div className="bg-background border border-border rounded-lg p-4 text-sm leading-relaxed min-h-[450px] max-h-[600px] overflow-y-auto" data-testid="output-analysis">
            {loading && <span className="animate-pulse text-muted-foreground">Analyzing case facts and Malaysian authorities…</span>}
            {!loading && !analysis && <span className="text-muted-foreground">Analysis will appear here.</span>}
            {analysis && <DraftDocument content={analysis} />}
          </div>
          {analysis && !loading && (
            <div className="mt-4">
              <SaveToMatterPanel
                draftTitle="AI Case Analysis"
                draftContent={analysis}
                kind="analysis"
                sourceLabel="AI Case Analyzer"
                defaultMatterId={targetMatterId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AiDrafterTab({ matter }: { matter?: Matter | null }) {
  const [mode, setMode] = useState<"demand-letter" | "submissions">("demand-letter");
  const [facts, setFacts] = useState(() => matter ? buildMatterSummary(matter) : "");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (facts.trim().length < 20) {
      setError("Please describe the case facts (at least 20 characters).");
      return;
    }
    setError(null);
    setLoading(true);
    setOutput("");
    try {
      const res = await fetch(`/api/accident/ai/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ facts }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 429) emitRateLimit(0);
        throw new Error(j.error || `Request failed (${res.status})`);
      }
      const rl = readRateLimitRemaining(res);
      if (rl !== null) emitRateLimit(rl);
      const j = await res.json();
       setOutput(
         mode === "demand-letter"
           ? requireGeneratedText(j, "letter", "Demand letter")
           : requireGeneratedText(j, "submissions", "Written submissions"),
       );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <div className="bg-muted/30 rounded-xl p-4 border border-border mb-6">
        <div className="flex items-start gap-2">
          <FileEdit className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            AI document drafter — paste your case facts and let AI draft a court-ready document. Currently supports Letter of Demand and Written Submissions for trial. The AI uses Malaysian conventions, statutory references and case authorities.
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Button
          variant={mode === "demand-letter" ? "default" : "outline"}
          onClick={() => { setMode("demand-letter"); setOutput(""); }}
          size="sm"
          data-testid="button-mode-demand"
        >
          Letter of Demand
        </Button>
        <Button
          variant={mode === "submissions" ? "default" : "outline"}
          onClick={() => { setMode("submissions"); setOutput(""); }}
          size="sm"
          data-testid="button-mode-submissions"
        >
          Written Submissions
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-3">Case Facts</h3>
          <textarea
            value={facts}
            onChange={(e) => setFacts(e.target.value)}
            placeholder="Provide detailed facts: parties, accident date/time/place, injuries, damages, liability position, quantum sought."
            rows={20}
            className="w-full bg-background border border-border rounded-lg p-3 text-sm font-mono resize-none"
            data-testid="textarea-drafter-facts"
          />
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={generate} disabled={loading} className="bg-primary flex-1" data-testid="button-generate-doc">
              {loading ? "Drafting…" : `Draft ${mode === "demand-letter" ? "Letter of Demand" : "Written Submissions"}`}
            </Button>
            {output && (
              <DraftExportButtons
                title={mode === "demand-letter" ? "Letter of Demand" : "Written Submissions"}
                content={output}
                hideMarkdown
              />
            )}
          </div>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-3">Generated Document</h3>
          <div className="bg-background border border-border rounded-lg p-4 text-sm leading-relaxed min-h-[450px] max-h-[600px] overflow-y-auto" data-testid="output-doc">
            {loading && <span className="animate-pulse text-muted-foreground">Drafting…</span>}
            {!loading && !output && <span className="text-muted-foreground">Generated document will appear here.</span>}
            {output && <DraftDocument content={output} />}
          </div>
          {output && !loading && (
            <div className="mt-4">
              <SaveToMatterPanel
                draftTitle={mode === "demand-letter" ? "Letter of Demand" : "Written Submissions"}
                draftContent={output}
                kind={mode === "demand-letter" ? "demand-letter" : "submissions"}
                sourceLabel="AI Document Drafter"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
