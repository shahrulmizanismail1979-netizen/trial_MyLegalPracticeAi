import { useState, useRef, useEffect } from "react";
import { TrendingUp, Loader2, RotateCcw } from "lucide-react";
import { DraftExportButtons } from "@workspace/draft-export/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { VoiceControls } from "@/components/ai/voice-controls";
import { useAiStream } from "@/lib/use-ai-stream";
import { useVoice } from "@/lib/use-voice";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import { MatterPicker, matterToCaseDetails } from "@/components/MatterPicker";

const STRATEGY_ROLES = [
  { value: "defence", label: "Defence Counsel" },
  { value: "prosecution", label: "Prosecution / DPP" },
];

export function AiCaseStrategyPage() {
  const [role, setRole] = useState("defence");
  const [caseDetails, setCaseDetails] = useState("");
  const [evidence, setEvidence] = useState("");
  const [concerns, setConcerns] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const voice = useVoice();
  const { response, isStreaming, isComplete, error, stream, reset } = useAiStream({});

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [response]);

  useEffect(() => {
    if (isComplete && response) voice.speak(response);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  const handleSubmit = async () => {
    if (!caseDetails.trim() || isStreaming) return;
    reset();
    const content = `Role: ${role === "defence" ? "Defence Counsel" : "Prosecution / DPP"}

CASE DETAILS:
${caseDetails}

${evidence ? `AVAILABLE EVIDENCE:\n${evidence}` : ""}

${concerns ? `SPECIFIC CONCERNS / OBJECTIVES:\n${concerns}` : ""}`;

    await stream("/ai/case-strategy", {
      messages: [{ role: "user", content }],
      strategyRole: role,
    });
  };

  const handleReset = () => {
    setCaseDetails("");
    setEvidence("");
    setConcerns("");
    reset();
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            Case Strategy Planner
          </h1>
          <p className="text-muted-foreground">
            Build a comprehensive defence or prosecution strategy covering 8 dimensions — case assessment with strength rating, legal framework with burden of proof analysis, evidence strategy and admissibility issues, witness management and cross-examination planning, primary and alternative legal arguments with authorities, day-by-day trial timeline, risk matrix with contingency plans, and sentencing strategy
          </p>
        </div>
        {response && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" /> New Strategy
          </Button>
        )}
      </div>

      {!response && !isStreaming && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Case Information</CardTitle>
            <CardDescription>Provide your case details for a comprehensive strategy plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <MatterPicker
              onSelect={(matter) => {
                setCaseDetails(matterToCaseDetails(matter));
              }}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium">Your Role</label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRATEGY_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Case Details</label>
              <Textarea
                value={caseDetails}
                onChange={(e) => setCaseDetails(e.target.value)}
                placeholder="Charges, parties involved, court level, brief facts, stage of proceedings, any prior hearings or rulings..."
                className="min-h-[180px] bg-background/50 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Available Evidence (Optional)</label>
              <Textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="List key evidence: witness statements, forensic reports, CCTV footage, documentary evidence, confessions, expert reports..."
                className="min-h-[100px] bg-background/50 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Specific Concerns / Objectives (Optional)</label>
              <Textarea
                value={concerns}
                onChange={(e) => setConcerns(e.target.value)}
                placeholder="e.g., Key witness is unreliable, forensic evidence may be challenged, client wants minimum custodial sentence..."
                className="min-h-[80px] bg-background/50 text-sm"
              />
            </div>

            <Button onClick={handleSubmit} disabled={!caseDetails.trim()} className="w-full" size="lg">
              <TrendingUp className="h-4 w-4 mr-2" /> Generate Strategy Plan
            </Button>
          </CardContent>
        </Card>
      )}

      {(response || isStreaming) && (
        <Card className="border-border/50 bg-card/30">
          <CardContent className="pt-6">
            {response && (
              <div className="flex justify-end mb-2">
                <VoiceControls voice={voice} responseText={response} />
              </div>
            )}
            {response && isComplete && (
              <div className="mb-4 space-y-3">
                <DraftExportButtons
                  title={`Case Strategy — ${role === "defence" ? "Defence" : "Prosecution"}`}
                  content={response}
                />
                <SaveToMatterPanel
                  draftTitle={`Case Strategy — ${role === "defence" ? "Defence" : "Prosecution"}`}
                  draftContent={response}
                  kind="case-strategy"
                  sourceLabel="Case Strategy Planner"
                  inputJson={{ role, caseDetails, evidence, concerns }}
                />
              </div>
            )}
            <div ref={scrollRef} className="max-h-[70vh] overflow-auto">
              {response ? (
                <MarkdownRenderer content={response} exportReady={isComplete} />
              ) : (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Building case strategy...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {error && <div className="text-center text-destructive text-sm p-3 bg-destructive/10 rounded-lg">{error}</div>}
    </div>
  );
}
