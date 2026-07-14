import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import WorkspaceLayout from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { BookMarked, Landmark, BookOpen, ScrollText, Search, BookDashed, Briefcase } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";

// Data
const courtStructure = [
  { name: "Federal Court", level: "Apex Court", jurisdiction: "Appeals from Court of Appeal. Exclusive original jurisdiction on constitutional matters.", amount: "N/A" },
  { name: "Court of Appeal", level: "Appellate Court", jurisdiction: "Appeals from High Court (Value > RM250k or with leave).", amount: "N/A" },
  { name: "High Court", level: "Superior Court", jurisdiction: "Unlimited civil jurisdiction. Appeals from Subordinate Courts.", amount: "> RM 1,000,000" },
  { name: "Sessions Court", level: "Subordinate Court", jurisdiction: "Civil matters. Exceptions: injunctions, specific performance, declarations.", amount: "RM 100,000 - RM 1,000,000" },
  { name: "Magistrate's Court", level: "Subordinate Court", jurisdiction: "Civil matters including debt recovery.", amount: "< RM 100,000" }
];

const keyLegislation = [
  { 
    title: "Companies Act 2016", 
    sections: [
      { s: "s.195", desc: "Members' rights to management" },
      { s: "s.217", desc: "Responsibility of a nominee director" },
      { s: "s.346", desc: "Remedy in cases of an oppression" },
      { s: "s.464", desc: "Petition for winding up" },
      { s: "s.466", desc: "Definition of inability to pay debts (Statutory Demand)" }
    ]
  },
  { 
    title: "Contracts Act 1950", 
    sections: [
      { s: "s.2", desc: "Interpretation / Definitions" },
      { s: "s.10", desc: "What agreements are contracts" },
      { s: "s.14", desc: "Free consent defined" },
      { s: "s.17", desc: "Fraud defined" },
      { s: "s.24", desc: "What considerations and objects are lawful" },
      { s: "s.56", desc: "Effect of failure to perform at fixed time" },
      { s: "s.73", desc: "Liability of person to whom money is paid by mistake (Quantum Meruit)" },
      { s: "s.74", desc: "Compensation for loss or damage caused by breach" },
      { s: "Part VIII", desc: "Of Indemnity and Guarantee" }
    ]
  },
  { 
    title: "Capital Markets and Services Act 2007", 
    sections: [
      { s: "s.176", desc: "Stock market manipulations" },
      { s: "s.178", desc: "False or misleading statements" },
      { s: "s.188", desc: "Insider trading" }
    ]
  },
  { 
    title: "National Land Code 1965", 
    sections: [
      { s: "s.241", desc: "Creation of charges" },
      { s: "s.254", desc: "Notice of default (Form 16D)" },
      { s: "s.256", desc: "Order for sale by Court" }
    ]
  },
  { 
    title: "Civil Law Act 1956", 
    sections: [
      { s: "s.7", desc: "Application of U.K. common law and rules of equity" },
      { s: "s.11", desc: "Power of Courts to award interest on debts and damages" }
    ]
  }
];

const forms = [
  { no: "Form 1", desc: "Writ of Summons", rule: "O. 6, r. 1" },
  { no: "Form 5", desc: "Originating Summons", rule: "O. 7, r. 2" },
  { no: "Form 15", desc: "Memorandum of Appearance", rule: "O. 12, r. 1" },
  { no: "Form 28A", desc: "Statement of Issues to be Tried", rule: "O. 34, r. 2" },
  { no: "Form 34", desc: "Subpoena Ad Testificandum", rule: "O. 38, r. 14" },
  { no: "Form 69", desc: "Notice of Appeal", rule: "O. 55, r. 3" },
  { no: "Form 111", desc: "Notice of Appeal to Judge in Chambers", rule: "O. 56, r. 1" }
];

export default function ReferencePage() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/access");
    }
  }, [setLocation]);

  const filteredLegislation = keyLegislation.map(act => {
    const term = searchTerm.toLowerCase();
    const actMatches = act.title.toLowerCase().includes(term);
    const matchedSections = act.sections.filter(sec => 
      sec.s.toLowerCase().includes(term) || sec.desc.toLowerCase().includes(term)
    );
    
    if (actMatches) return act;
    if (matchedSections.length > 0) return { ...act, sections: matchedSections };
    return null;
  }).filter(Boolean);

  return (
    <WorkspaceLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 text-primary">
              <BookMarked size={20} />
            </div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">Legal Reference</h1>
          </div>
          <p className="text-muted-foreground text-lg">Quick access to court structures, key statutes, and standard forms.</p>
        </div>

        <Tabs defaultValue="legislation" className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full h-auto p-1 bg-card border border-border">
            <TabsTrigger value="legislation" className="py-3 data-[state=active]:bg-primary/20 data-[state=active]:text-primary" data-testid="tab-leg">
              <BookOpen className="w-4 h-4 mr-2 hidden sm:block" /> Statutes
            </TabsTrigger>
            <TabsTrigger value="courts" className="py-3 data-[state=active]:bg-primary/20 data-[state=active]:text-primary" data-testid="tab-courts">
              <Landmark className="w-4 h-4 mr-2 hidden sm:block" /> Courts
            </TabsTrigger>
            <TabsTrigger value="forms" className="py-3 data-[state=active]:bg-primary/20 data-[state=active]:text-primary" data-testid="tab-forms">
              <ScrollText className="w-4 h-4 mr-2 hidden sm:block" /> Forms
            </TabsTrigger>
            <TabsTrigger value="limitation" className="py-3 data-[state=active]:bg-primary/20 data-[state=active]:text-primary" data-testid="tab-lim">
              <BookDashed className="w-4 h-4 mr-2 hidden sm:block" /> Limitations
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            {/* KEY LEGISLATION */}
            <TabsContent value="legislation">
              <div className="mb-6 relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Search statutes or sections..." 
                  className="pl-10 h-12 bg-card border-border text-foreground focus:border-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="space-y-6">
                {filteredLegislation.length > 0 ? filteredLegislation.map((act: any, idx) => (
                  <Card key={idx} className="border-border bg-card/50 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 bg-muted/30 border-b border-border">
                      <h3 className="text-lg font-serif font-bold text-primary">{act.title}</h3>
                    </div>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border">
                        {act.sections.map((sec: any, sIdx: number) => (
                          <div key={sIdx} className="px-6 py-3 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-6 hover:bg-muted/10 transition-colors">
                            <span className="font-mono text-sm font-bold text-foreground/80 w-16 flex-shrink-0">{sec.s}</span>
                            <span className="text-foreground/90">{sec.desc}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No matching statutes or sections found.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* COURT STRUCTURE */}
            <TabsContent value="courts">
              <Card className="border-border bg-card/50 shadow-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {courtStructure.map((court, idx) => (
                      <div key={idx} className="p-6 flex flex-col md:flex-row gap-6 hover:bg-muted/10 transition-colors">
                        <div className="md:w-1/3 space-y-1">
                          <h3 className="text-xl font-serif font-bold text-primary">{court.name}</h3>
                          <span className="inline-block px-2 py-1 bg-muted rounded text-xs font-semibold text-muted-foreground uppercase tracking-wider">{court.level}</span>
                        </div>
                        <div className="md:w-2/3 space-y-3">
                          <div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Jurisdiction & Note</span>
                            <p className="text-foreground/90">{court.jurisdiction}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Monetary Limit</span>
                            <p className="font-mono font-medium text-foreground bg-background px-2 py-1 rounded inline-block border border-border">{court.amount}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* STANDARD FORMS */}
            <TabsContent value="forms">
              <Card className="border-border bg-card/50 shadow-sm">
                <div className="px-6 py-4 bg-muted/30 border-b border-border">
                  <h3 className="text-lg font-serif font-bold text-foreground">Rules of Court 2012 - Appendix A Forms</h3>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    <div className="grid grid-cols-12 px-6 py-3 bg-muted/10 font-medium text-sm text-muted-foreground">
                      <div className="col-span-2">Form No.</div>
                      <div className="col-span-8">Description</div>
                      <div className="col-span-2">Rule Ref</div>
                    </div>
                    {forms.map((form, idx) => (
                      <div key={idx} className="grid grid-cols-12 px-6 py-3 items-center hover:bg-muted/10 transition-colors text-sm">
                        <div className="col-span-2 font-bold text-primary">{form.no}</div>
                        <div className="col-span-8 text-foreground/90">{form.desc}</div>
                        <div className="col-span-2 font-mono text-muted-foreground">{form.rule}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* LIMITATION PERIODS */}
            <TabsContent value="limitation">
              <Card className="border-border bg-card/50 shadow-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    <div className="grid grid-cols-12 px-6 py-3 bg-muted/10 font-medium text-sm text-muted-foreground">
                      <div className="col-span-6">Cause of Action</div>
                      <div className="col-span-2">Period</div>
                      <div className="col-span-4">Time Runs From</div>
                    </div>
                    
                    <div className="grid grid-cols-12 px-6 py-3 items-center text-sm">
                      <div className="col-span-6 font-medium text-foreground">Breach of Contract</div>
                      <div className="col-span-2 font-bold text-primary">6 Years</div>
                      <div className="col-span-4 text-muted-foreground">Date of breach</div>
                    </div>
                    <div className="grid grid-cols-12 px-6 py-3 items-center text-sm">
                      <div className="col-span-6 font-medium text-foreground">Tort (General)</div>
                      <div className="col-span-2 font-bold text-primary">6 Years</div>
                      <div className="col-span-4 text-muted-foreground">Date damage suffered</div>
                    </div>
                    <div className="grid grid-cols-12 px-6 py-3 items-center text-sm bg-muted/5">
                      <div className="col-span-6 font-medium text-foreground">Personal Injury</div>
                      <div className="col-span-2 font-bold text-primary">3 Years</div>
                      <div className="col-span-4 text-muted-foreground">Date of knowledge</div>
                    </div>
                    <div className="grid grid-cols-12 px-6 py-3 items-center text-sm">
                      <div className="col-span-6 font-medium text-foreground">Fraud / Mistake</div>
                      <div className="col-span-2 font-bold text-primary">6 Years</div>
                      <div className="col-span-4 text-muted-foreground">Date discovered (or could have)</div>
                    </div>
                    <div className="grid grid-cols-12 px-6 py-3 items-center text-sm">
                      <div className="col-span-6 font-medium text-foreground">Recovery of Land</div>
                      <div className="col-span-2 font-bold text-primary">12 Years</div>
                      <div className="col-span-4 text-muted-foreground">Date right of action accrued</div>
                    </div>
                    <div className="grid grid-cols-12 px-6 py-3 items-center text-sm bg-muted/5">
                      <div className="col-span-6 font-medium text-foreground">Judicial Review</div>
                      <div className="col-span-2 font-bold text-primary">3 Months</div>
                      <div className="col-span-4 text-muted-foreground">Date grounds arose</div>
                    </div>
                    <div className="grid grid-cols-12 px-6 py-3 items-center text-sm">
                      <div className="col-span-6 font-medium text-foreground">Defamation</div>
                      <div className="col-span-2 font-bold text-primary">1 Year*</div>
                      <div className="col-span-4 text-muted-foreground">Date of publication (*Can be extended to 3 yrs)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </WorkspaceLayout>
  );
}
