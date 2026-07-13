import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { SECTIONS } from "@/data/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Scale, FileText, CheckCircle2, BookOpen, Sparkles, FileSearch, ListChecks, MessageSquare, Search, ClipboardList } from "lucide-react";
import { useAiContext } from "@/contexts/AiContext";

type AiTool = "tutor" | "drafter" | "risk-scanner" | "checklist" | "deadline-calculator" | "document-analyzer" | "case-finder" | "minutes-drafter" | "contract-review" | "compliance-advisor";

function AskAiButton({
  tool,
  message,
  context,
  label,
  icon: Icon = Sparkles,
  variant = "default",
}: {
  tool: AiTool;
  message: string;
  context?: string;
  label: string;
  icon?: React.ElementType;
  variant?: "default" | "subtle";
}) {
  const { openWithContext } = useAiContext();
  return (
    <button
      onClick={() => openWithContext(tool, message, context)}
      className={
        variant === "subtle"
          ? "flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors px-2 py-1 rounded hover:bg-primary/5"
          : "flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors px-2.5 py-1.5 rounded-md border border-primary/20 hover:bg-primary/10 bg-primary/5"
      }
      title={label}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
    </button>
  );
}

export default function SectionPage() {
  const { id } = useParams();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!localStorage.getItem("auth_token")) {
      setLocation("/login");
    }
  }, [setLocation]);

  const section = SECTIONS.find(s => s.id === id);

  if (!section) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <h2 className="text-2xl font-serif text-muted-foreground">Section not found.</h2>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        {/* Section Header */}
        <div className="border-b border-border pb-6">
          <h1 className="text-4xl font-serif font-bold text-foreground mb-2">{section.title}</h1>
          <p className="text-lg text-muted-foreground mb-4">{section.description}</p>
          {/* Section-level AI quick actions */}
          <div className="flex flex-wrap gap-2">
            <AskAiButton
              tool="tutor"
              message={`Give me a comprehensive overview of ${section.title} under Malaysian corporate law`}
              label="Overview with AI"
              icon={BookOpen}
            />
            <AskAiButton
              tool="checklist"
              message={`Generate a practitioner checklist for ${section.title}`}
              label="Get Checklist"
              icon={ListChecks}
            />
            <AskAiButton
              tool="risk-scanner"
              message={`What are the key legal risks and compliance traps in ${section.title} that Malaysian practitioners must watch out for?`}
              label="Scan Risks"
              icon={FileSearch}
            />
          </div>
        </div>

        {/* Substantive Law Topics */}
        {section.topics && (
          <div className="grid grid-cols-1 gap-6">
            {section.topics.map(topic => (
              <Card key={topic.id} className="bg-card border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border/50 bg-background/50">
                  <CardTitle className="font-serif text-xl text-primary flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    {topic.title}
                  </CardTitle>
                  {/* Per-topic AI actions */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <AskAiButton
                      tool="tutor"
                      message={`Explain ${topic.title} in detail under Malaysian law`}
                      context={topic.content}
                      label="Ask AI Tutor"
                      icon={MessageSquare}
                      variant="subtle"
                    />
                    <AskAiButton
                      tool="case-finder"
                      message={`Find leading Malaysian cases on ${topic.title}`}
                      label="Find Cases"
                      icon={Search}
                      variant="subtle"
                    />
                    <AskAiButton
                      tool="risk-scanner"
                      message={`What are the key legal risks and director liability exposures related to ${topic.title}?`}
                      label="Scan Risks"
                      icon={FileSearch}
                      variant="subtle"
                    />
                    {topic.practiceNotes && (
                      <AskAiButton
                        tool="checklist"
                        message={`Generate a step-by-step practitioner checklist for ${topic.title}`}
                        label="Get Checklist"
                        icon={ListChecks}
                        variant="subtle"
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <p className="text-sm leading-relaxed text-foreground">{topic.content}</p>

                  <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-sm">
                    <span className="font-semibold text-primary block mb-1">Legislation:</span>
                    <span className="text-muted-foreground">{topic.legislationRefs.join(", ")}</span>
                  </div>

                  <div className="bg-accent/5 border border-accent/20 rounded-md p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-semibold text-accent block mb-1">Practice Note:</span>
                        <span className="text-muted-foreground">{topic.practiceNotes}</span>
                      </div>
                      <AskAiButton
                        tool="drafter"
                        message={`Draft a precedent document related to ${topic.title} under Malaysian law`}
                        label="Draft Doc"
                        icon={ClipboardList}
                        variant="subtle"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Workflows */}
        {section.workflows && (
          <div className="grid grid-cols-1 gap-10">
            {section.workflows.map(wf => (
              <div key={wf.id} className="space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <h3 className="text-2xl font-serif font-semibold text-primary flex items-center gap-2">
                    <FileText className="w-6 h-6" />
                    {wf.title}
                    <span className="text-xs font-sans font-medium px-2 py-1 bg-border rounded text-muted-foreground ml-2">
                      {wf.category}
                    </span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    <AskAiButton
                      tool="checklist"
                      message={`Generate a complete practitioner checklist for: ${wf.title}`}
                      label="Full Checklist"
                      icon={ListChecks}
                    />
                    <AskAiButton
                      tool="risk-scanner"
                      message={`What are the key legal risks and pitfalls in the process of: ${wf.title}?`}
                      label="Risk Analysis"
                      icon={FileSearch}
                    />
                    <AskAiButton
                      tool="drafter"
                      message={`Draft the key documents required for: ${wf.title}`}
                      label="Draft Documents"
                      icon={ClipboardList}
                    />
                  </div>
                </div>

                <div className="relative border-l border-primary/30 ml-3 space-y-6">
                  {wf.steps.map(step => (
                    <div key={step.step} className="relative pl-6">
                      <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-card border-2 border-primary flex items-center justify-center text-xs font-bold text-primary">
                        {step.step}
                      </div>
                      <div className="bg-card border border-border rounded-lg p-4 group">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-foreground flex-1">{step.action}</p>
                          <AskAiButton
                            tool="tutor"
                            message={`Explain step ${step.step} in detail: ${step.action}. What must be done, what forms are required, and what are the legal consequences of non-compliance?`}
                            context={`Legislation: ${step.legislation}. Timeframe: ${step.timeframe}`}
                            label="Explain"
                            icon={MessageSquare}
                            variant="subtle"
                          />
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-accent" />
                            {step.timeframe}
                          </span>
                          <span className="flex items-center gap-1">
                            <Scale className="w-3 h-3 text-primary" />
                            {step.legislation}
                          </span>
                        </div>
                        {step.notes && (
                          <p className="mt-2 text-xs text-muted-foreground italic border-t border-border/40 pt-2">{step.notes}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Leading Cases */}
        {section.cases && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {section.cases.map((c, i) => (
              <Card key={i} className="bg-card border-border hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="font-serif text-lg text-primary">{c.name}</CardTitle>
                      <p className="text-xs font-mono text-muted-foreground">{c.citation} · {c.court} ({c.year})</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <AskAiButton
                      tool="tutor"
                      message={`Explain the case ${c.name} [${c.citation}] in detail — facts, ratio decidendi, how it has been applied in subsequent Malaysian cases, and its current significance`}
                      label="Deep Analysis"
                      icon={BookOpen}
                      variant="subtle"
                    />
                    <AskAiButton
                      tool="case-finder"
                      message={`Find Malaysian cases that have followed, distinguished, or applied ${c.name} [${c.citation}]`}
                      label="Find Related Cases"
                      icon={Search}
                      variant="subtle"
                    />
                    <AskAiButton
                      tool="risk-scanner"
                      message={`Based on the principles in ${c.name}, what risks should Malaysian corporate practitioners be aware of?`}
                      label="Practical Risks"
                      icon={FileSearch}
                      variant="subtle"
                    />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-2 text-sm">
                  <div><span className="font-semibold text-foreground">Facts: </span><span className="text-muted-foreground">{c.facts}</span></div>
                  <div><span className="font-semibold text-foreground">Issue: </span><span className="text-muted-foreground">{c.issue}</span></div>
                  <div><span className="font-semibold text-foreground">Held: </span><span className="text-accent">{c.held}</span></div>
                  <div className="pt-2 border-t border-border/50">
                    <span className="font-semibold text-primary">Significance: </span>
                    <span className="text-muted-foreground">{c.significance}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Forms & Drafting Items */}
        {section.items && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.items.map((item, i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-serif font-semibold text-foreground">{item.title}</h4>
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-1 bg-primary/10 text-primary rounded">
                    {item.type}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{item.notes}</p>
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
                  <AskAiButton
                    tool="drafter"
                    message={`Draft a ${item.title} under Malaysian law — ${item.notes}`}
                    label="Draft with AI"
                    icon={ClipboardList}
                  />
                  <AskAiButton
                    tool="tutor"
                    message={`Explain the requirements and legal purpose of a ${item.title} under Malaysian corporate law`}
                    label="Explain"
                    icon={BookOpen}
                    variant="subtle"
                  />
                  <AskAiButton
                    tool="checklist"
                    message={`What are the steps and requirements for preparing and executing a ${item.title} in Malaysia?`}
                    label="Get Steps"
                    icon={ListChecks}
                    variant="subtle"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Glossary Terms */}
        {section.terms && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.terms.map((term, i) => (
              <div key={i} className="p-4 border border-border/50 hover:border-primary/30 hover:bg-card transition-colors rounded-md group">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-serif font-bold text-primary">{term.term}</h4>
                  <AskAiButton
                    tool="tutor"
                    message={`Explain the concept of "${term.term}" in Malaysian corporate law with relevant case examples and statutory provisions`}
                    label="Ask AI"
                    icon={MessageSquare}
                    variant="subtle"
                  />
                </div>
                <p className="text-sm text-muted-foreground mb-2">{term.definition}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-accent">Related: {term.relatedTerms}</span>
                  <AskAiButton
                    tool="case-finder"
                    message={`Find Malaysian cases on the concept of "${term.term}"`}
                    label="Find Cases"
                    icon={Search}
                    variant="subtle"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Fees & Compliance Content */}
        {section.content && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              <AskAiButton
                tool="deadline-calculator"
                message="Calculate all key SSM, SC, and Companies Act 2016 compliance deadlines for a Malaysian company with financial year ending 31 December 2024"
                label="Calculate My Deadlines"
                icon={Scale}
              />
              <AskAiButton
                tool="tutor"
                message="Explain all SSM filing fees, stamp duty rates on share transfers, and SC registration fees applicable in Malaysia"
                label="Fee Breakdown"
                icon={BookOpen}
              />
              <AskAiButton
                tool="risk-scanner"
                message="What are the consequences and penalties for missing SSM, SC, and Companies Act 2016 compliance deadlines in Malaysia?"
                label="Non-Compliance Risks"
                icon={FileSearch}
              />
            </div>
            <div className="bg-card border border-border rounded-xl p-6 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {section.content.split('\n').map((line, i) => {
                if (line.startsWith('###')) return <h3 key={i} className="text-primary font-serif font-semibold mt-4 mb-2">{line.replace('###', '').trim()}</h3>;
                if (line.startsWith('-')) return <li key={i} className="ml-4 list-disc">{line.replace('-', '').trim()}</li>;
                return <p key={i} className="mb-2">{line}</p>;
              })}
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
