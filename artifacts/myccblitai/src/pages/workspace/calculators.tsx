import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import WorkspaceLayout from "./layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, CalendarClock, Scale, Coins, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";

// --- Limitation Period Calculator Logic ---
type CauseOfAction = {
  name: string;
  years: number;
  months?: number;
  statute: string;
  requiresKnowledge?: boolean;
};

const causesOfAction: Record<string, CauseOfAction> = {
  "contract": { name: "Breach of Contract", years: 6, statute: "Limitation Act 1953, s.6(1)(a)" },
  "tort": { name: "Tort / Negligence", years: 6, statute: "Limitation Act 1953, s.6(1)(a)" },
  "defamation": { name: "Defamation", years: 6, statute: "Limitation Act 1953, s.6(1)(a)" }, // Defamation Act may apply differently but standard 6 yrs for simplicity here
  "land": { name: "Recovery of Land", years: 12, statute: "Limitation Act 1953, s.9(1)" },
  "fraud": { name: "Fraud", years: 6, statute: "Limitation Act 1953, s.29(1)", requiresKnowledge: true },
  "personal_injury": { name: "Personal Injury", years: 3, statute: "Limitation Act 1953, s.6(1)(a) & Civil Law Act 1956", requiresKnowledge: true }, // Actually 3 years from knowledge
  "guarantee": { name: "Banking Guarantee", years: 6, statute: "Limitation Act 1953, s.6(1)(a)" },
  "judicial_review": { name: "Judicial Review", years: 0, months: 3, statute: "Rules of Court 2012, O.53 r.3(6)" },
  "winding_up": { name: "Winding Up Petition", years: 100, statute: "No statutory limitation (Laches applies)" }, // effectively no limitation
  "trust": { name: "Breach of Trust", years: 6, statute: "Limitation Act 1953, s.22" }
};

export default function CalculatorsPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/access");
    }
  }, [setLocation]);

  // State for Limitation Period
  const [limitationCause, setLimitationCause] = useState<string>("contract");
  const [limitationStartDate, setLimitationStartDate] = useState<string>("");
  const [limitationKnowledgeDate, setLimitationKnowledgeDate] = useState<string>("");
  const [limitationResult, setLimitationResult] = useState<any>(null);

  // State for Filing Fee
  const [feeCourt, setFeeCourt] = useState<string>("magistrate");
  const [feeAmount, setFeeAmount] = useState<string>("");
  const [feeType, setFeeType] = useState<string>("writ");
  const [feeResult, setFeeResult] = useState<any>(null);

  // State for Interest
  const [interestPrincipal, setInterestPrincipal] = useState<string>("");
  const [interestRate, setInterestRate] = useState<string>("5");
  const [interestStart, setInterestStart] = useState<string>("");
  const [interestEnd, setInterestEnd] = useState<string>(new Date().toISOString().split('T')[0]);
  const [interestCompound, setInterestCompound] = useState<boolean>(false);
  const [interestResult, setInterestResult] = useState<any>(null);

  const { toast } = useToast();

  const showMissing = (label: string) => {
    toast({
      title: "Missing information",
      description: `Please fill in: ${label}`,
      variant: "destructive"
    });
  };

  // Handlers
  const calculateLimitation = () => {
    if (!limitationCause) { showMissing("Cause of Action"); return; }
    if (!limitationStartDate) { showMissing("Start Date"); return; }

    const cause = causesOfAction[limitationCause];
    const startDateStr = cause.requiresKnowledge && limitationKnowledgeDate ? limitationKnowledgeDate : limitationStartDate;
    
    const startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) return;

    let expiryDate = new Date(startDate);
    if (cause.years > 0) {
      expiryDate.setFullYear(expiryDate.getFullYear() + cause.years);
    }
    if (cause.months) {
      expiryDate.setMonth(expiryDate.getMonth() + cause.months);
    }

    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let status = "green";
    if (diffDays < 0) status = "red";
    else if (diffDays < 90 || (cause.months && diffDays < 14)) status = "red";
    else if (diffDays < 365) status = "yellow";

    if (cause.name === "Winding Up Petition") {
      status = "green";
      setLimitationResult({
        expiryDate: "No strict limitation period",
        daysRemaining: "N/A",
        status: status,
        isExpired: false,
        statute: cause.statute,
        note: "Equitable doctrine of laches may apply to bar stale claims."
      });
      return;
    }

    setLimitationResult({
      expiryDate: expiryDate.toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' }),
      daysRemaining: diffDays,
      status: status,
      isExpired: diffDays < 0,
      statute: cause.statute
    });
  };

  const calculateFee = () => {
    if (!feeCourt) { showMissing("Court"); return; }
    if (!feeType) { showMissing("Document Type"); return; }
    
    let amount = parseFloat(feeAmount) || 0;
    let baseFee = 0;
    let details = "";
    let rules = "Rules of Court 2012 - Appendix B";

    if (feeType === "winding_up") {
      baseFee = 2000; // Fixed fee for winding up
      details = "Fixed filing fee for Winding Up Petition";
      rules = "Companies (Winding-Up) Rules 1972";
    } else if (feeType === "interlocutory") {
      if (feeCourt === "magistrate") baseFee = 40;
      else if (feeCourt === "sessions") baseFee = 100;
      else baseFee = 200; // High Court
      details = "Standard interlocutory application fee";
    } else if (feeType === "appeal") {
      if (feeCourt === "magistrate") baseFee = 100;
      else if (feeCourt === "sessions") baseFee = 500;
      else baseFee = 1000; // High Court to COA
      details = "Notice of Appeal filing fee";
    } else {
      // Writ or OS
      if (feeCourt === "magistrate") {
        baseFee = 100 + (amount > 10000 ? Math.ceil((amount - 10000) / 1000) * 1 : 0);
        baseFee = Math.min(baseFee, 500); // Rough estimate
        details = "Base writ fee + scale based on claim amount";
      } else if (feeCourt === "sessions") {
        baseFee = 400 + (amount > 100000 ? Math.ceil((amount - 100000) / 5000) * 5 : 0);
        details = "Sessions Court scale fee";
      } else {
        baseFee = 800 + (amount > 1000000 ? Math.ceil((amount - 1000000) / 10000) * 10 : 0);
        baseFee = Math.min(baseFee, 5000); // Cap for standard writ
        details = "High Court scale fee";
      }
    }

    setFeeResult({
      total: baseFee.toFixed(2),
      details,
      rules
    });
  };

  const calculateInterest = () => {
    const p = parseFloat(interestPrincipal);
    const r = parseFloat(interestRate) / 100;

    if (isNaN(p)) { showMissing("Principal Amount"); return; }
    if (isNaN(r)) { showMissing("Interest Rate"); return; }
    if (!interestStart) { showMissing("Start Date"); return; }
    if (!interestEnd) { showMissing("End Date"); return; }

    const start = new Date(interestStart);
    const end = new Date(interestEnd);

    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) {
      toast({
        title: "Invalid date range",
        description: "End Date must be after Start Date.",
        variant: "destructive"
      });
      return;
    }
    
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = diffDays / 365;

    let interest = 0;
    if (interestCompound) {
      interest = p * Math.pow(1 + r, years) - p;
    } else {
      interest = p * r * years;
    }

    const dailyRate = (p * r) / 365;

    setInterestResult({
      days: diffDays,
      dailyRate: dailyRate.toFixed(2),
      totalInterest: interest.toFixed(2),
      totalDue: (p + interest).toFixed(2)
    });
  };

  // Markdown summaries of each calculator's result, suitable for filing into a matter.
  const limitationSummary = limitationResult
    ? [
        `# Limitation Period Calculation`,
        ``,
        `**Cause of Action:** ${causesOfAction[limitationCause]?.name ?? limitationCause}`,
        `**Date cause of action arose:** ${limitationStartDate}`,
        limitationKnowledgeDate ? `**Date of knowledge/discovery:** ${limitationKnowledgeDate}` : ``,
        `**Expiry Date:** ${limitationResult.expiryDate}`,
        `**Time Remaining:** ${limitationResult.daysRemaining === "N/A" ? "N/A" : `${limitationResult.daysRemaining} days`}`,
        `**Status:** ${limitationResult.isExpired ? "Expired / Time-barred" : limitationResult.status === "green" ? "Safe" : limitationResult.status === "yellow" ? "Caution" : "Critical"}`,
        `**Relevant Authority:** ${limitationResult.statute}`,
        limitationResult.note ? `` : ``,
        limitationResult.note ? `> ${limitationResult.note}` : ``,
      ].filter(Boolean).join("\n")
    : "";

  const feeSummary = feeResult
    ? [
        `# Court Filing Fee Estimate`,
        ``,
        `**Court Level:** ${feeCourt === "magistrate" ? "Magistrate's Court" : feeCourt === "sessions" ? "Sessions Court" : "High Court"}`,
        `**Type of Filing:** ${feeType}`,
        feeAmount ? `**Claim Amount (RM):** ${feeAmount}` : ``,
        `**Estimated Filing Fee:** RM ${feeResult.total}`,
        `**Calculation Basis:** ${feeResult.details}`,
        `**Reference:** ${feeResult.rules}`,
      ].filter(Boolean).join("\n")
    : "";

  const interestSummary = interestResult
    ? [
        `# Legal Interest Calculation`,
        ``,
        `**Principal Amount (RM):** ${interestPrincipal}`,
        `**Interest Rate:** ${interestRate}% per annum`,
        `**Period:** ${interestStart} to ${interestEnd}`,
        `**Type:** ${interestCompound ? "Compound" : "Simple"} interest`,
        `**Days Accrued:** ${interestResult.days}`,
        `**Daily Rate:** RM ${interestResult.dailyRate}`,
        `**Total Interest:** RM ${interestResult.totalInterest}`,
        `**Total Amount Due:** RM ${interestResult.totalDue}`,
      ].filter(Boolean).join("\n")
    : "";

  return (
    <WorkspaceLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 text-primary">
              <Calculator size={20} />
            </div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">Legal Calculators</h1>
          </div>
          <p className="text-muted-foreground text-lg">Interactive tools for calculating limitation periods, court fees, and judgment interest.</p>
        </div>

        <Tabs defaultValue="limitation" className="w-full">
          <TabsList className="grid grid-cols-3 w-full h-auto p-1 bg-card border border-border">
            <TabsTrigger value="limitation" className="py-3 data-[state=active]:bg-primary/20 data-[state=active]:text-primary" data-testid="tab-limitation">
              <CalendarClock className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Limitation Period</span>
            </TabsTrigger>
            <TabsTrigger value="fees" className="py-3 data-[state=active]:bg-primary/20 data-[state=active]:text-primary" data-testid="tab-fees">
              <Scale className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Court Filing Fees</span>
            </TabsTrigger>
            <TabsTrigger value="interest" className="py-3 data-[state=active]:bg-primary/20 data-[state=active]:text-primary" data-testid="tab-interest">
              <Coins className="w-4 h-4 mr-2" /> <span className="hidden sm:inline">Legal Interest</span>
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-6">
            {/* LIMITATION CALCULATOR */}
            <TabsContent value="limitation">
              <Card className="border-border bg-card/50 backdrop-blur shadow-sm">
                <CardHeader>
                  <CardTitle className="font-serif">Limitation Period Calculator</CardTitle>
                  <CardDescription>Determine if a cause of action is time-barred under the Limitation Act 1953.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="cause">Cause of Action</Label>
                        <select 
                          id="cause"
                          className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          value={limitationCause}
                          onChange={(e) => setLimitationCause(e.target.value)}
                          data-testid="input-cause"
                        >
                          {Object.entries(causesOfAction).map(([key, value]) => (
                            <option key={key} value={key}>{value.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="startDate">Date cause of action arose</Label>
                        <Input 
                          id="startDate" 
                          type="date" 
                          value={limitationStartDate}
                          onChange={(e) => setLimitationStartDate(e.target.value)}
                          data-testid="input-startDate"
                        />
                      </div>

                      {causesOfAction[limitationCause]?.requiresKnowledge && (
                        <div className="space-y-2">
                          <Label htmlFor="knowledgeDate" className="text-primary">Date of knowledge/discovery (Optional)</Label>
                          <Input 
                            id="knowledgeDate" 
                            type="date" 
                            value={limitationKnowledgeDate}
                            onChange={(e) => setLimitationKnowledgeDate(e.target.value)}
                            data-testid="input-knowledgeDate"
                          />
                          <p className="text-xs text-muted-foreground">For fraud or latent personal injury, time runs from discovery.</p>
                        </div>
                      )}

                      <Button onClick={calculateLimitation} className="w-full" data-testid="btn-calc-limitation">
                        Calculate Expiry
                      </Button>
                    </div>

                    <div className="bg-background/50 rounded-xl p-6 border border-border flex flex-col justify-center">
                      {limitationResult ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                            {limitationResult.status === "green" && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/10 text-green-500 text-sm font-bold border border-green-500/20">
                                <CheckCircle2 className="w-4 h-4" /> Safe ({'>'}1 yr)
                              </span>
                            )}
                            {limitationResult.status === "yellow" && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-sm font-bold border border-yellow-500/20">
                                <AlertCircle className="w-4 h-4" /> Caution ({'<'}1 yr)
                              </span>
                            )}
                            {limitationResult.status === "red" && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-500 text-sm font-bold border border-red-500/20">
                                <AlertCircle className="w-4 h-4" /> {limitationResult.isExpired ? 'Expired' : 'Critical (<3 mos)'}
                              </span>
                            )}
                          </div>
                          
                          <div>
                            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider block mb-1">Expiry Date</span>
                            <div className={`text-2xl font-bold ${limitationResult.isExpired ? 'text-red-500' : 'text-foreground'}`}>
                              {limitationResult.expiryDate}
                            </div>
                          </div>
                          
                          {limitationResult.daysRemaining !== "N/A" && (
                            <div>
                              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider block mb-1">Time Remaining</span>
                              <div className="text-xl font-bold text-foreground">
                                {limitationResult.daysRemaining > 0 ? `${limitationResult.daysRemaining} days` : '0 days'}
                              </div>
                            </div>
                          )}

                          <div className="pt-4 border-t border-border mt-4">
                            <span className="text-xs font-medium text-muted-foreground block mb-1">Relevant Authority</span>
                            <div className="text-sm text-primary font-medium">
                              {limitationResult.statute}
                            </div>
                            {limitationResult.note && (
                              <div className="text-xs text-muted-foreground mt-2 italic">{limitationResult.note}</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground opacity-50 flex flex-col items-center">
                          <CalendarClock className="w-12 h-12 mb-3" />
                          <p>Enter details and calculate to see results</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {limitationResult && (
                <div className="mt-6">
                  <SaveToMatterPanel
                    key={`limitation-${limitationSummary.length}`}
                    draftTitle={`Limitation Period — ${causesOfAction[limitationCause]?.name ?? "Calculation"}`}
                    draftContent={limitationSummary}
                    kind="calculation"
                    refPrefix="CCB"
                  />
                </div>
              )}
            </TabsContent>

            {/* FILING FEE CALCULATOR */}
            <TabsContent value="fees">
              <Card className="border-border bg-card/50 backdrop-blur shadow-sm">
                <CardHeader>
                  <CardTitle className="font-serif">Court Filing Fee Calculator</CardTitle>
                  <CardDescription>Estimate filing fees based on the Rules of Court 2012.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="court">Court Level</Label>
                        <select 
                          id="court"
                          className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          value={feeCourt}
                          onChange={(e) => setFeeCourt(e.target.value)}
                          data-testid="input-court"
                        >
                          <option value="magistrate">Magistrate's Court (&lt; RM100k)</option>
                          <option value="sessions">Sessions Court (RM100k - RM1M)</option>
                          <option value="high_court">High Court (&gt; RM1M)</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="feeType">Type of Filing</Label>
                        <select 
                          id="feeType"
                          className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          value={feeType}
                          onChange={(e) => setFeeType(e.target.value)}
                          data-testid="input-feeType"
                        >
                          <option value="writ">Writ & Statement of Claim</option>
                          <option value="os">Originating Summons</option>
                          <option value="appeal">Notice of Appeal</option>
                          <option value="interlocutory">Interlocutory Application</option>
                          <option value="winding_up">Winding Up Petition</option>
                        </select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="claimAmount">Claim Amount (RM) {feeType !== 'writ' && feeType !== 'os' ? '(Optional)' : ''}</Label>
                        <Input 
                          id="claimAmount" 
                          type="number" 
                          placeholder="e.g. 50000"
                          value={feeAmount}
                          onChange={(e) => setFeeAmount(e.target.value)}
                          data-testid="input-claimAmount"
                        />
                      </div>

                      <Button onClick={calculateFee} className="w-full" data-testid="btn-calc-fee">
                        Calculate Fee
                      </Button>
                    </div>

                    <div className="bg-background/50 rounded-xl p-6 border border-border flex flex-col justify-center">
                      {feeResult ? (
                        <div className="space-y-6 text-center">
                          <div>
                            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider block mb-2">Estimated Filing Fee</span>
                            <div className="text-4xl font-bold text-primary">
                              RM {feeResult.total}
                            </div>
                          </div>
                          
                          <div className="pt-4 border-t border-border">
                            <span className="text-xs font-medium text-muted-foreground block mb-1">Calculation Basis</span>
                            <div className="text-sm text-foreground mb-2">
                              {feeResult.details}
                            </div>
                            <div className="text-xs text-primary/80 font-medium">
                              Reference: {feeResult.rules}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-4 italic">
                              *Disclaimer: This is an estimate based on standard scales. Actual e-filing system (eFS) may calculate differently based on document page count and exact filing codes.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground opacity-50 flex flex-col items-center">
                          <Scale className="w-12 h-12 mb-3" />
                          <p>Enter details and calculate to see results</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {feeResult && (
                <div className="mt-6">
                  <SaveToMatterPanel
                    key={`fee-${feeSummary.length}`}
                    draftTitle="Court Filing Fee Estimate"
                    draftContent={feeSummary}
                    kind="calculation"
                    refPrefix="CCB"
                  />
                </div>
              )}
            </TabsContent>

            {/* INTEREST CALCULATOR */}
            <TabsContent value="interest">
              <Card className="border-border bg-card/50 backdrop-blur shadow-sm">
                <CardHeader>
                  <CardTitle className="font-serif">Legal Interest Calculator</CardTitle>
                  <CardDescription>Calculate pre- and post-judgment interest (Default 5% p.a. under s.11 Civil Law Act 1956).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="principal">Principal Amount (RM)</Label>
                        <Input 
                          id="principal" 
                          type="number" 
                          placeholder="e.g. 100000"
                          value={interestPrincipal}
                          onChange={(e) => setInterestPrincipal(e.target.value)}
                          data-testid="input-principal"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="rate">Interest Rate (% per annum)</Label>
                        <Input 
                          id="rate" 
                          type="number" 
                          step="0.1"
                          placeholder="5"
                          value={interestRate}
                          onChange={(e) => setInterestRate(e.target.value)}
                          data-testid="input-rate"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="interestStart">Start Date</Label>
                          <Input 
                            id="interestStart" 
                            type="date" 
                            value={interestStart}
                            onChange={(e) => setInterestStart(e.target.value)}
                            data-testid="input-interestStart"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="interestEnd">End Date</Label>
                          <Input 
                            id="interestEnd" 
                            type="date" 
                            value={interestEnd}
                            onChange={(e) => setInterestEnd(e.target.value)}
                            data-testid="input-interestEnd"
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 pt-2">
                        <input 
                          type="checkbox" 
                          id="compound" 
                          className="rounded border-border bg-background focus:ring-primary"
                          checked={interestCompound}
                          onChange={(e) => setInterestCompound(e.target.checked)}
                          data-testid="input-compound"
                        />
                        <Label htmlFor="compound" className="font-normal cursor-pointer">Calculate Compound Interest</Label>
                      </div>

                      <Button onClick={calculateInterest} className="w-full mt-2" data-testid="btn-calc-interest">
                        Calculate Interest
                      </Button>
                    </div>

                    <div className="bg-background/50 rounded-xl p-6 border border-border flex flex-col justify-center">
                      {interestResult ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Days Accrued</span>
                              <div className="text-xl font-bold text-foreground">
                                {interestResult.days}
                              </div>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-1">Daily Rate</span>
                              <div className="text-xl font-bold text-foreground">
                                RM {interestResult.dailyRate}
                              </div>
                            </div>
                          </div>
                          
                          <div className="pt-4 border-t border-border">
                            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider block mb-1">Total Interest</span>
                            <div className="text-3xl font-bold text-primary">
                              RM {interestResult.totalInterest}
                            </div>
                          </div>

                          <div className="pt-4 border-t border-border">
                            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider block mb-1">Total Amount Due</span>
                            <div className="text-3xl font-bold text-foreground">
                              RM {interestResult.totalDue}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground opacity-50 flex flex-col items-center">
                          <Coins className="w-12 h-12 mb-3" />
                          <p>Enter details and calculate to see results</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              {interestResult && (
                <div className="mt-6">
                  <SaveToMatterPanel
                    key={`interest-${interestSummary.length}`}
                    draftTitle="Legal Interest Calculation"
                    draftContent={interestSummary}
                    kind="calculation"
                    refPrefix="CCB"
                  />
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </WorkspaceLayout>
  );
}
