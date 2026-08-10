import { useState, useRef, useEffect } from "react";
import { FileCheck, Send, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { VoiceControls } from "@/components/ai/voice-controls";
import { useAiStream } from "@/lib/use-ai-stream";
import { useVoice } from "@/lib/use-voice";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";

const OPINION_TYPES = [
  { value: "advisory", label: "Client Advisory Opinion" },
  { value: "case-evaluation", label: "Case Evaluation & Merits" },
  { value: "defence-strategy", label: "Defence Strategy Opinion" },
  { value: "appeal-prospects", label: "Appeal Prospects Opinion" },
  { value: "bail-opinion", label: "Bail Application Opinion" },
  { value: "plea-advice", label: "Plea Bargain Advisory" },
  { value: "general", label: "General Legal Opinion" },
];

export function AiLegalOpinionPage() {
  const [clientName, setClientName] = useState("");
  const [opinionType, setOpinionType] = useState("");
  const [facts, setFacts] = useState("");
  const [specificQuestions, setSpecificQuestions] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const voice = useVoice();
  const { response, isStreaming, error, stream, reset } = useAiStream({});

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [response]);

  useEffect(() => {
    if (!isStreaming && response) voice.speak(response);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  const handleSubmit = async () => {
    if (!facts.trim() || isStreaming) return;
    reset();
    const content = `Opinion Type: ${OPINION_TYPES.find(t => t.value === opinionType)?.label || "General Legal Opinion"}
${clientName ? `Client Reference: ${clientName}` : ""}
    
FACTS:
${facts}

${specificQuestions ? `SPECIFIC QUESTIONS TO ADDRESS:\n${specificQuestions}` : ""}`;

    await stream("/ai/legal-opinion", {
      messages: [{ role: "user", content }],
      opinionType: opinionType || "general",
    });
  };

  const handleReset = () => {
    setFacts("");
    setSpecificQuestions("");
    reset();
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileCheck className="h-8 w-8 text-primary" />
            Legal Opinion Writer
          </h1>
          <p className="text-muted-foreground">
            Generate formal, professionally structured legal opinions — introduction, statement of facts, legal issues identified, applicable law with exact statutory provisions and authorities, detailed analysis, risk assessment with case strength rating, actionable recommendations, and conclusion. Supports 7 opinion types: client advisory, case evaluation, defence strategy, appeal prospects, bail opinion, plea bargain advisory, and general
          </p>
        </div>
        {response && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" /> New Opinion
          </Button>
        )}
      </div>

      {!response && !isStreaming && (
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Opinion Details</CardTitle>
            <CardDescription>Provide the facts and context for the legal opinion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Opinion Type</label>
                <Select value={opinionType} onValueChange={setOpinionType}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue placeholder="Select opinion type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {OPINION_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Client Reference (Optional)</label>
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g., Re: Ahmad bin Ali"
                  className="bg-background/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Statement of Facts</label>
              <Textarea
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                placeholder="Provide the full facts of the case. Include: dates, parties involved, nature of offence, evidence available, charges (if any), current status of proceedings..."
                className="min-h-[200px] bg-background/50 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Specific Questions to Address (Optional)</label>
              <Textarea
                value={specificQuestions}
                onChange={(e) => setSpecificQuestions(e.target.value)}
                placeholder="e.g., What are the prospects of acquittal? Should the client plead guilty? What sentence can the client expect?"
                className="min-h-[80px] bg-background/50 text-sm"
              />
            </div>

            <Button onClick={handleSubmit} disabled={!facts.trim()} className="w-full" size="lg">
              <FileCheck className="h-4 w-4 mr-2" /> Generate Legal Opinion
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
            {response && !isStreaming && (
              <div className="mb-4">
                <SaveToMatterPanel
                  draftTitle={`Legal Opinion — ${OPINION_TYPES.find((t) => t.value === opinionType)?.label || "General Legal Opinion"}`}
                  draftContent={response}
                  kind="legal-opinion"
                  sourceLabel="Legal Opinion Writer"
                  defaultMatterTitle={clientName || undefined}
                  inputJson={{ clientName, opinionType, facts, specificQuestions }}
                />
              </div>
            )}
            <div ref={scrollRef} className="max-h-[70vh] overflow-auto">
              {response ? (
                <MarkdownRenderer content={response} />
              ) : (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Drafting legal opinion...</span>
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
