import React, { useState } from "react";
import { Link } from "wouter";
import { Search, FileEdit, Calculator, MessageSquare, Map, SearchCode, Send, ChevronRight, CheckCircle2, Scale, BookOpen, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const features = [
  { id: "research", title: "AI Case Law Research", icon: Search },
  { id: "drafter", title: "AI Document Drafter", icon: FileEdit },
  { id: "calculator", title: "AI Damages Calculator", icon: Calculator },
  { id: "assistant", title: "AI Legal Assistant", icon: MessageSquare },
  { id: "workflow", title: "AI Workflow Guide", icon: Map },
  { id: "analyzer", title: "Cause Paper Analyzer", icon: SearchCode },
];

export function AIFeatures() {
  const [activeTab, setActiveTab] = useState("research");

  return (
    <section id="features" className="py-24 bg-background border-t border-border/40">
      <div className="container px-4">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Next-Generation <span className="text-primary">AI Practice Tools</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Experience the power of an AI model trained exclusively on Malaysian personal injury and accident law. Precision, speed, and deep domain expertise.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 max-w-6xl mx-auto">
          {/* Tabs */}
          <div className="w-full lg:w-1/3 flex flex-col gap-2">
            {features.map((feature) => (
              <button
                key={feature.id}
                onClick={() => setActiveTab(feature.id)}
                data-testid={`tab-${feature.id}`}
                className={`flex items-center gap-4 px-6 py-4 rounded-xl transition-all duration-300 text-left ${
                  activeTab === feature.id
                    ? "bg-primary/10 border border-primary/30 text-primary shadow-sm"
                    : "bg-card/30 border border-transparent text-muted-foreground hover:bg-card hover:text-foreground"
                }`}
              >
                <feature.icon className={`h-5 w-5 ${activeTab === feature.id ? "text-primary" : ""}`} />
                <span className="font-medium">{feature.title}</span>
                {activeTab === feature.id && <ChevronRight className="h-4 w-4 ml-auto" />}
              </button>
            ))}
          </div>

          {/* Preview Panel */}
          <div className="w-full lg:w-2/3 bg-card border border-border/60 rounded-2xl p-1 shadow-xl overflow-hidden min-h-[500px] flex flex-col relative">
            <div className="h-10 bg-background/50 border-b border-border/40 flex items-center px-4 gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive/50"></div>
                <div className="w-3 h-3 rounded-full bg-primary/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
              </div>
              <div className="mx-auto text-xs text-muted-foreground/70 font-mono">
                MyAccidentAi / {features.find(f => f.id === activeTab)?.title.toLowerCase().replace(/\s+/g, '-')}
              </div>
              <span className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">Demo</span>
            </div>

            <div
              className="flex-1 p-6 overflow-y-auto bg-background/30 custom-scrollbar pointer-events-none select-none"
              aria-hidden="true"
              inert={true as unknown as undefined}
            >
              {activeTab === "research" && <ResearchPreview />}
              {activeTab === "drafter" && <DrafterPreview />}
              {activeTab === "calculator" && <CalculatorPreview />}
              {activeTab === "assistant" && <AssistantPreview />}
              {activeTab === "workflow" && <WorkflowPreview />}
              {activeTab === "analyzer" && <AnalyzerPreview />}
            </div>

            <div className="px-4 py-3 border-t border-border/40 bg-card/80 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Visual preview only. Full interactive tools live inside the workspace.</p>
              <Button size="sm" className="h-8 gap-2 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <Link href="/workspace" data-testid="link-preview-open-workspace">
                  Open in Workspace <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>

            <div className="absolute inset-0 pointer-events-none rounded-2xl ring-1 ring-inset ring-white/5 dark:ring-white/10"></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResearchPreview() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
        <Input 
          readOnly 
          value="negligence in motor vehicle accident rear end collision" 
          className="pl-10 h-12 bg-background border-primary/30 focus-visible:ring-primary/20 text-md"
        />
        <Button size="sm" className="absolute right-2 top-2 h-8 bg-primary/20 text-primary hover:bg-primary/30">
          Search
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground pb-2 border-b border-border/40">
          <span>Found 45 relevant authorities</span>
          <span className="text-primary text-xs flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> AI Summarized</span>
        </div>

        <div className="p-5 rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-serif text-lg font-semibold text-primary">Sivamani v Valliammal</h4>
            <span className="text-xs bg-muted px-2 py-1 rounded">1965 1 MLJ 240</span>
          </div>
          <p className="text-sm text-foreground/80 mb-3 leading-relaxed">
            <strong className="text-foreground">Principle:</strong> The driver of a following vehicle must travel at such a distance behind the preceding vehicle and at such a speed that he can pull up without colliding if the preceding vehicle stops suddenly.
          </p>
          <div className="text-xs text-muted-foreground flex gap-3">
            <span className="flex items-center gap-1"><Scale className="h-3 w-3" /> Federal Court</span>
            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> Negligence</span>
          </div>
        </div>

        <div className="p-5 rounded-lg border border-border/50 bg-card hover:border-primary/30 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <h4 className="font-serif text-lg font-semibold text-primary">Government of Malaysia v Jumat bin Mahmud</h4>
            <span className="text-xs bg-muted px-2 py-1 rounded">1977 2 MLJ 103</span>
          </div>
          <p className="text-sm text-foreground/80 mb-3 leading-relaxed">
            <strong className="text-foreground">Principle:</strong> Res ipsa loquitur. The fact that a vehicle collides with the rear of another vehicle moving in the same direction is prima facie evidence of negligence on the part of the driver of the rear vehicle.
          </p>
          <div className="text-xs text-muted-foreground flex gap-3">
            <span className="flex items-center gap-1"><Scale className="h-3 w-3" /> Federal Court</span>
            <span className="flex items-center gap-1"><BookOpen className="h-3 w-3" /> Res Ipsa Loquitur</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrafterPreview() {
  return (
    <div className="flex h-full gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-1/3 border-r border-border/50 pr-4 space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Templates</h4>
        {["Statement of Claim", "Statement of Defence", "Reply to Defence", "Notice of Demand", "Writ of Summons"].map((t, i) => (
          <div key={i} className={`p-3 rounded-md text-sm transition-colors ${i === 0 ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground"}`}>
            {t}
          </div>
        ))}
      </div>
      <div className="w-2/3 pl-2">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-lg font-medium">Statement of Claim (MVA)</h3>
          <Button size="sm" variant="outline" className="h-8 gap-2 text-xs">
            <FileEdit className="h-3 w-3" /> Export to Word
          </Button>
        </div>
        <div className="p-6 bg-white dark:bg-zinc-950 border border-border rounded-md font-serif text-sm leading-relaxed text-foreground h-[350px] overflow-y-auto">
          <p className="text-center mb-6 font-bold uppercase underline">Statement of Claim</p>
          <p className="mb-4">1. The Plaintiff is at all material times a student residing at No. 12, Jalan Universiti, 43600 Bangi, Selangor.</p>
          <p className="mb-4">2. The Defendant was at all material times the registered owner and/or driver of the motorcar bearing registration number WXX 1234 ("the said Motorcar").</p>
          <p className="mb-4">3. On or about 15 May 2023 at about 2:30 p.m., the Plaintiff was lawfully and carefully riding his motorcycle bearing registration number BXX 5678 ("the said Motorcycle") along Jalan Bangi Lama when the Defendant...</p>
          <p className="mb-4 text-primary bg-primary/5 p-2 border-l-2 border-primary">
            [AI SUGGESTION: Insert specific particulars of negligence here based on police report sketch plan. Common particulars for rear-end collision: failing to keep proper lookout, driving too fast, failing to apply brakes in time.]
          </p>
        </div>
      </div>
    </div>
  );
}

function CalculatorPreview() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-3 pb-4 border-b border-border/50">
        <Calculator className="h-6 w-6 text-primary" />
        <h3 className="font-serif text-xl font-medium">Personal Injury Damages Assessment</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">General Damages (Pain & Suffering)</label>
            <div className="flex items-center">
              <span className="bg-muted px-3 py-2 border border-border border-r-0 rounded-l-md text-sm">RM</span>
              <Input readOnly value="45,000.00" className="rounded-l-none text-right font-mono" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-right">Based on compound fracture of right femur</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Loss of Future Earnings</label>
            <div className="flex items-center">
              <span className="bg-muted px-3 py-2 border border-border border-r-0 rounded-l-md text-sm">RM</span>
              <Input readOnly value="144,000.00" className="rounded-l-none text-right font-mono" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 text-right">Multiplier: 12 (Age 30) × RM1,000/month</p>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Special Damages (Medical/Transport)</label>
            <div className="flex items-center">
              <span className="bg-muted px-3 py-2 border border-border border-r-0 rounded-l-md text-sm">RM</span>
              <Input readOnly value="12,450.00" className="rounded-l-none text-right font-mono" />
            </div>
          </div>
        </div>
        
        <div className="bg-primary/5 rounded-xl p-6 border border-primary/20 flex flex-col justify-center">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2 text-center">Total Estimated Assessment</h4>
          <div className="text-4xl font-mono font-bold text-primary text-center my-4">
            RM 201,450<span className="text-lg text-primary/70">.00</span>
          </div>
          
          <div className="mt-4 pt-4 border-t border-primary/10 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Apportionment of Liability</span>
              <span className="font-medium text-foreground">100% Defendant</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Interest (GD)</span>
              <span className="font-medium text-foreground">5% p.a. from service</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Interest (SD)</span>
              <span className="font-medium text-foreground">5% p.a. from accident</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssistantPreview() {
  return (
    <div className="flex flex-col h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
        {/* User Message */}
        <div className="flex gap-3 justify-end">
          <div className="bg-muted p-3 rounded-2xl rounded-tr-sm max-w-[80%] text-sm text-foreground">
            What is the limitation period for personal injury claims in Malaysia, and does it differ if the plaintiff is a minor?
          </div>
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium">U</span>
          </div>
        </div>
        
        {/* AI Response */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Scale className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="bg-card border border-border p-4 rounded-2xl rounded-tl-sm max-w-[85%] text-sm text-foreground/90 space-y-3 shadow-sm">
            <p>Under Malaysian law, the limitation periods are governed by the <strong>Limitation Act 1953 (Act 254)</strong>.</p>
            <p><strong>General Rule:</strong><br/>For personal injury claims (which fall under tort/negligence), the limitation period is <strong>6 years</strong> from the date on which the cause of action accrued (i.e., the date of the accident), pursuant to <em>Section 6(1)(a)</em> of the Limitation Act 1953.</p>
            <p><strong>Exception for Minors:</strong><br/>If the plaintiff was a minor (under 18 years of age) at the time of the accident, <em>Section 24(1)</em> applies. The 6-year limitation period only begins to run from the date the minor attains the age of majority (18 years old).</p>
            <div className="bg-background/50 p-2 rounded text-xs border border-border/50 text-muted-foreground mt-2">
              <strong className="text-foreground">Authority:</strong> See <em>Kuan Hip Peng v. Yap Yin & Anor [1965] 1 MLJ 252</em> where the court affirmed that time does not run against an infant until he attains majority.
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-auto relative">
        <Input 
          placeholder="Ask a legal question..." 
          className="pr-12 bg-background border-border"
          readOnly
        />
        <Button size="icon" className="absolute right-1 top-1 h-8 w-8 bg-primary hover:bg-primary/90">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function WorkflowPreview() {
  const steps = [
    { title: "Initial Consultation & Retainer", status: "completed", desc: "Gather facts, sign warrant to act" },
    { title: "Police Report & Documentation", status: "completed", desc: "Obtain certified copy of report & sketch plan" },
    { title: "Medical Report Request", status: "current", desc: "Apply for specialist medical report from hospital" },
    { title: "Notice of Demand (Section 96)", status: "pending", desc: "Serve 30-day notice to Defendant & Insurer" },
    { title: "Filing Pleadings", status: "pending", desc: "File Writ & Statement of Claim" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="font-serif text-xl font-medium">Standard MVA Plaintiff Workflow</h3>
          <p className="text-sm text-muted-foreground">Estimated timeline: 9-15 months</p>
        </div>
        <div className="text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
          Phase 1: Pre-Litigation
        </div>
      </div>
      
      <div className="relative pl-6 border-l-2 border-border/60 ml-4 space-y-6">
        {steps.map((step, i) => (
          <div key={i} className="relative">
            <div className={`absolute -left-[35px] w-6 h-6 rounded-full flex items-center justify-center border-2 ${
              step.status === 'completed' ? 'bg-primary border-primary text-primary-foreground' : 
              step.status === 'current' ? 'bg-background border-primary text-primary' : 
              'bg-background border-border text-muted-foreground'
            }`}>
              {step.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-[10px] font-bold">{i+1}</span>}
            </div>
            
            <div className={`p-4 rounded-lg border transition-colors ${
              step.status === 'current' ? 'bg-primary/5 border-primary/30 shadow-sm' : 
              'bg-card border-border/50'
            }`}>
              <div className="flex justify-between items-start">
                <h4 className={`font-medium ${step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {step.title}
                </h4>
                {step.status === 'current' && (
                  <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none text-[10px]">IN PROGRESS</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{step.desc}</p>
              
              {step.status === 'current' && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs">Generate Letter</Button>
                  <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground">Mark Complete</Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple Badge component since we didn't import it
function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${className}`}>{children}</span>;
}

function AnalyzerPreview() {
  return (
    <div className="flex gap-4 h-[400px] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-1/2 border border-border/50 rounded-lg p-4 bg-white dark:bg-zinc-950 text-sm overflow-y-auto relative font-serif text-foreground leading-relaxed">
        <div className="absolute top-2 right-2 flex gap-1">
          <Badge className="bg-secondary text-secondary-foreground text-[10px]">Statement of Defence</Badge>
        </div>
        <p className="font-bold underline text-center mb-4 mt-2">STATEMENT OF DEFENCE</p>
        <p className="mb-3">1. Paragraph 1 of the Statement of Claim is not admitted and the Plaintiff is put to strict proof thereof.</p>
        <div className="relative group">
          <p className="mb-3 bg-red-500/10 border-l-2 border-red-500 p-1 -ml-1">
            2. The Defendant admits paragraph 2 of the Statement of Claim in so far as being the registered owner of the said Motorcar, but <span className="font-bold underline decoration-red-500 decoration-wavy">denies being the driver</span> at the material time.
          </p>
        </div>
        <p className="mb-3">3. The Defendant denies paragraph 3 of the Statement of Claim entirely.</p>
        <div className="relative group">
          <p className="mb-3 bg-amber-500/10 border-l-2 border-amber-500 p-1 -ml-1">
            4. Further and/or in the alternative, if the collision did occur (which is denied), the collision was caused wholly or <span className="font-bold">contributed to by the negligence of the Plaintiff</span>.
          </p>
        </div>
      </div>
      
      <div className="w-1/2 space-y-3 overflow-y-auto pr-2">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-2">
          <SearchCode className="h-4 w-4" /> AI Analysis
        </h3>
        
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-red-500 mb-1">Critical Issue: Identity of Driver Denied</h4>
          <p className="text-xs text-foreground/80">The Defendant denies driving the vehicle. You must establish who was driving or plead vicarious liability against the owner. Check police report to confirm driver's identity.</p>
          <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-[10px] border-red-500/30 text-red-500 hover:bg-red-500/10">Suggest Interrogatories</Button>
        </div>
        
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-amber-500 mb-1">Standard Defence: Contributory Negligence</h4>
          <p className="text-xs text-foreground/80">Defendant has pleaded contributory negligence as an alternative defence. You must file a Reply to Defence specifically denying the particulars of contributory negligence raised.</p>
          <Button size="sm" variant="outline" className="w-full mt-2 h-7 text-[10px] border-amber-500/30 text-amber-500 hover:bg-amber-500/10">Draft Reply to Defence</Button>
        </div>
      </div>
    </div>
  );
}
