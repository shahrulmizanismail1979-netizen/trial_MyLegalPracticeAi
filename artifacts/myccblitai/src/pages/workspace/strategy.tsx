import { useState, useEffect, useRef } from "react";
import { useLocation, Link } from "wouter";
import WorkspaceLayout from "./layout";
import MarkdownRenderer from "@/components/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, RefreshCw, Sparkles, Loader2, StopCircle, FileText, Target, ChevronRight, Check } from "lucide-react";
import { isAuthenticated, getToken } from "@/lib/auth";
import { emitRateLimit, readRateLimitRemaining } from "@/lib/rate-limit-bus";
import { apiUrl } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import { DraftExportButtons } from "@workspace/draft-export/react";

export default function StrategyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [inputs, setInputs] = useState({
    caseType: "",
    partiesInvolved: "",
    jurisdiction: "",
    claimValue: "",
    keyFacts: "",
    evidenceAvailable: "",
    witnessList: "",
    opposingArguments: "",
    knownWeaknesses: "",
    primaryObjective: "",
    budgetSensitivity: "",
    timeUrgency: ""
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);
  const endOfOutputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/access");
    }
  }, [setLocation]);

  useEffect(() => {
    if (isGenerating && endOfOutputRef.current) {
      endOfOutputRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [output, isGenerating]);

  const handleInputChange = (name: string, value: string) => {
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleNextStep = () => {
    if (step < 4) setStep(step + 1);
  };

  const handlePrevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsGenerating(false);
      toast({
        title: "Generation stopped",
        description: "The AI generation was manually stopped."
      });
    }
  };

  const handleSubmit = async () => {
    // Validate required fields roughly
    if (!inputs.caseType || !inputs.primaryObjective) {
      toast({
        title: "Missing Information",
        description: "Please ensure at least Case Type and Primary Objective are filled out.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setOutput("");
    setStep(5); // Move to results view
    
    abortControllerRef.current = new AbortController();
    
    try {
      const token = getToken();
      const url = apiUrl("tools/generate");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : ""
        },
        body: JSON.stringify({
          toolId: "case-strategy-planner",
          inputs
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        if (response.status === 429) emitRateLimit(0);
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const rl = readRateLimitRemaining(response);
      if (rl !== null) emitRateLimit(rl);

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                toast({
                  title: "Generation error",
                  description: data.error,
                  variant: "destructive"
                });
                setIsGenerating(false);
                return;
              }
              if (data.content) {
                setOutput(prev => prev + data.content);
              }
            } catch (e) {
              console.error("Error parsing SSE data", e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Generation aborted');
      } else {
        console.error("Generation error:", error);
        toast({
          title: "Generation failed",
          description: error.message || "An unexpected error occurred",
          variant: "destructive"
        });
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleReset = () => {
    setOutput("");
    setStep(1);
    setInputs({
      caseType: "",
      partiesInvolved: "",
      jurisdiction: "",
      claimValue: "",
      keyFacts: "",
      evidenceAvailable: "",
      witnessList: "",
      opposingArguments: "",
      knownWeaknesses: "",
      primaryObjective: "",
      budgetSensitivity: "",
      timeUrgency: ""
    });
  };

  const steps = [
    { id: 1, title: "Case Profile" },
    { id: 2, title: "Facts & Evidence" },
    { id: 3, title: "Opposing Position" },
    { id: 4, title: "Objectives" }
  ];

  return (
    <WorkspaceLayout>
      <div className="p-6 md:p-10 max-w-5xl mx-auto flex flex-col min-h-[calc(100vh-64px)]">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30 text-primary">
              <Target size={20} />
            </div>
            <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground">AI Case Strategy Planner</h1>
          </div>
          <p className="text-muted-foreground text-lg">Generate a comprehensive litigation strategy based on case facts and objectives.</p>
        </div>

        {step < 5 && (
          <div className="mb-8">
            <div className="flex items-center justify-between relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-border -z-10"></div>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary -z-10 transition-all duration-300" style={{ width: `${((step - 1) / 3) * 100}%` }}></div>
              
              {steps.map((s) => (
                <div key={s.id} className="flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors border-2 ${step > s.id ? 'bg-primary border-primary text-primary-foreground' : step === s.id ? 'bg-background border-primary text-primary' : 'bg-background border-border text-muted-foreground'}`}>
                    {step > s.id ? <Check size={16} /> : s.id}
                  </div>
                  <span className={`text-xs font-medium ${step >= s.id ? 'text-foreground' : 'text-muted-foreground'}`}>{s.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col bg-card rounded-xl border border-border overflow-hidden shadow-sm">
          {step === 1 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 md:p-8 flex-1 flex flex-col">
              <h2 className="text-2xl font-serif font-semibold mb-6 text-primary">Step 1: Case Profile</h2>
              <div className="space-y-6 flex-1">
                <div className="space-y-2">
                  <Label htmlFor="caseType">Case Type</Label>
                  <select 
                    id="caseType"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={inputs.caseType}
                    onChange={(e) => handleInputChange("caseType", e.target.value)}
                    data-testid="input-caseType"
                  >
                    <option value="" disabled>Select case type...</option>
                    <option value="Breach of Contract">Breach of Contract</option>
                    <option value="Corporate Dispute">Corporate Dispute</option>
                    <option value="Tort / Negligence">Tort / Negligence</option>
                    <option value="Employment">Employment</option>
                    <option value="Intellectual Property">Intellectual Property</option>
                    <option value="Defamation">Defamation</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partiesInvolved">Parties Involved</Label>
                  <Input 
                    id="partiesInvolved" 
                    placeholder="e.g., John Doe (Plaintiff) v. Acme Corp (Defendant)" 
                    value={inputs.partiesInvolved}
                    onChange={(e) => handleInputChange("partiesInvolved", e.target.value)}
                    data-testid="input-partiesInvolved"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jurisdiction">Jurisdiction / Court</Label>
                  <select 
                    id="jurisdiction"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={inputs.jurisdiction}
                    onChange={(e) => handleInputChange("jurisdiction", e.target.value)}
                    data-testid="input-jurisdiction"
                  >
                    <option value="" disabled>Select court...</option>
                    <option value="Magistrate's Court">Magistrate's Court</option>
                    <option value="Sessions Court">Sessions Court</option>
                    <option value="High Court">High Court</option>
                    <option value="Court of Appeal">Court of Appeal</option>
                    <option value="Federal Court">Federal Court</option>
                    <option value="Industrial Court">Industrial Court</option>
                    <option value="Arbitration">Arbitration</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="claimValue">Claim Value (RM)</Label>
                  <Input 
                    id="claimValue" 
                    placeholder="e.g., 500,000" 
                    value={inputs.claimValue}
                    onChange={(e) => handleInputChange("claimValue", e.target.value)}
                    data-testid="input-claimValue"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-6 mt-6 border-t border-border">
                <Button onClick={handleNextStep} data-testid="btn-next-1">
                  Next Step <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 md:p-8 flex-1 flex flex-col">
              <h2 className="text-2xl font-serif font-semibold mb-6 text-primary">Step 2: Facts & Evidence</h2>
              <div className="space-y-6 flex-1">
                <div className="space-y-2">
                  <Label htmlFor="keyFacts">Key Facts</Label>
                  <Textarea 
                    id="keyFacts" 
                    placeholder="Provide a chronological summary of key events..." 
                    className="min-h-[120px] resize-y"
                    value={inputs.keyFacts}
                    onChange={(e) => handleInputChange("keyFacts", e.target.value)}
                    data-testid="input-keyFacts"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evidenceAvailable">Available Evidence</Label>
                  <Textarea 
                    id="evidenceAvailable" 
                    placeholder="List key documents, emails, contracts, etc..." 
                    className="min-h-[100px] resize-y"
                    value={inputs.evidenceAvailable}
                    onChange={(e) => handleInputChange("evidenceAvailable", e.target.value)}
                    data-testid="input-evidenceAvailable"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="witnessList">Potential Witnesses</Label>
                  <Textarea 
                    id="witnessList" 
                    placeholder="List potential witnesses and what they can testify to..." 
                    className="min-h-[80px] resize-y"
                    value={inputs.witnessList}
                    onChange={(e) => handleInputChange("witnessList", e.target.value)}
                    data-testid="input-witnessList"
                  />
                </div>
              </div>
              <div className="flex justify-between pt-6 mt-6 border-t border-border">
                <Button variant="outline" onClick={handlePrevStep} data-testid="btn-prev-2">
                  Back
                </Button>
                <Button onClick={handleNextStep} data-testid="btn-next-2">
                  Next Step <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 md:p-8 flex-1 flex flex-col">
              <h2 className="text-2xl font-serif font-semibold mb-6 text-primary">Step 3: Opposing Position</h2>
              <div className="space-y-6 flex-1">
                <div className="space-y-2">
                  <Label htmlFor="opposingArguments">Likely Opposing Arguments</Label>
                  <Textarea 
                    id="opposingArguments" 
                    placeholder="What will the other side argue?" 
                    className="min-h-[150px] resize-y"
                    value={inputs.opposingArguments}
                    onChange={(e) => handleInputChange("opposingArguments", e.target.value)}
                    data-testid="input-opposingArguments"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="knownWeaknesses">Known Weaknesses in Our Case</Label>
                  <Textarea 
                    id="knownWeaknesses" 
                    placeholder="Be honest - what are the vulnerabilities in your position?" 
                    className="min-h-[150px] resize-y"
                    value={inputs.knownWeaknesses}
                    onChange={(e) => handleInputChange("knownWeaknesses", e.target.value)}
                    data-testid="input-knownWeaknesses"
                  />
                </div>
              </div>
              <div className="flex justify-between pt-6 mt-6 border-t border-border">
                <Button variant="outline" onClick={handlePrevStep} data-testid="btn-prev-3">
                  Back
                </Button>
                <Button onClick={handleNextStep} data-testid="btn-next-3">
                  Next Step <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="p-6 md:p-8 flex-1 flex flex-col">
              <h2 className="text-2xl font-serif font-semibold mb-6 text-primary">Step 4: Objectives</h2>
              <div className="space-y-6 flex-1">
                <div className="space-y-2">
                  <Label htmlFor="primaryObjective">Primary Objective</Label>
                  <select 
                    id="primaryObjective"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={inputs.primaryObjective}
                    onChange={(e) => handleInputChange("primaryObjective", e.target.value)}
                    data-testid="input-primaryObjective"
                  >
                    <option value="" disabled>Select objective...</option>
                    <option value="Win at Trial">Win at Trial (Full Victory)</option>
                    <option value="Favorable Settlement">Favorable Settlement (Early Resolution)</option>
                    <option value="Injunctive Relief">Injunctive Relief (Stop an action)</option>
                    <option value="Asset Preservation">Asset Preservation (Freeze assets)</option>
                    <option value="Minimize Liability">Minimize Liability (Damage control)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budgetSensitivity">Budget Sensitivity</Label>
                  <select 
                    id="budgetSensitivity"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={inputs.budgetSensitivity}
                    onChange={(e) => handleInputChange("budgetSensitivity", e.target.value)}
                    data-testid="input-budgetSensitivity"
                  >
                    <option value="" disabled>Select budget sensitivity...</option>
                    <option value="Low">Low (Willing to spend for best outcome)</option>
                    <option value="Medium">Medium (Balanced approach)</option>
                    <option value="High">High (Need cost-effective strategy)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeUrgency">Time Urgency</Label>
                  <select 
                    id="timeUrgency"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={inputs.timeUrgency}
                    onChange={(e) => handleInputChange("timeUrgency", e.target.value)}
                    data-testid="input-timeUrgency"
                  >
                    <option value="" disabled>Select urgency...</option>
                    <option value="Immediate">Immediate (Ex parte / Injunction needed)</option>
                    <option value="Within 6 months">Fast (Within 6 months)</option>
                    <option value="Standard">Standard pace</option>
                    <option value="No urgency">No urgency (Delay is acceptable/preferable)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-between pt-6 mt-6 border-t border-border">
                <Button variant="outline" onClick={handlePrevStep} data-testid="btn-prev-4">
                  Back
                </Button>
                <Button onClick={handleSubmit} className="font-bold" data-testid="btn-submit-strategy">
                  <Sparkles className="mr-2 w-4 h-4" /> Generate Strategy
                </Button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col h-[600px]">
              <div className="p-4 border-b border-border bg-muted/30 flex justify-between items-center h-[60px] flex-shrink-0">
                <h2 className="font-semibold flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-primary" />
                  Generated Strategy
                </h2>
                <div className="flex space-x-2">
                  {isGenerating ? (
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={handleStop}
                      className="h-8 text-xs"
                      data-testid="btn-stop"
                    >
                      <StopCircle className="w-3.5 h-3.5 mr-1.5" /> Stop
                    </Button>
                  ) : (
                    <>
                      <DraftExportButtons
                        title={inputs.partiesInvolved ? `Case Strategy — ${inputs.partiesInvolved}` : "AI Case Strategy"}
                        content={output}
                        hideMarkdown
                      />
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleReset}
                        className="h-8 border-border/50 text-xs"
                        data-testid="btn-reset"
                      >
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Start Over
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 relative bg-[url('/bg-pattern.svg')] bg-repeat">
                <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-0"></div>
                <div className="relative z-10 min-h-full">
                  <MarkdownRenderer content={output} />
                  {isGenerating && (
                    <div className="flex items-center space-x-2 mt-4 text-primary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium animate-pulse">Analyzing facts and synthesizing strategy...</span>
                    </div>
                  )}
                  {output && !isGenerating && (
                    <div className="mt-6">
                      <SaveToMatterPanel
                        draftTitle={inputs.partiesInvolved ? `Case Strategy — ${inputs.partiesInvolved}` : "AI Case Strategy"}
                        draftContent={output}
                        kind="strategy"
                        refPrefix="CCB"
                      />
                    </div>
                  )}
                  <div ref={endOfOutputRef} className="h-4" />
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </WorkspaceLayout>
  );
}
