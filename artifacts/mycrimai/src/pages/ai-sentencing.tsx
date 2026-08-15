import { useState, useRef, useEffect } from "react";
import { Target, Send, Loader2, RotateCcw } from "lucide-react";
import { DraftExportButtons } from "@workspace/draft-export/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { VoiceControls } from "@/components/ai/voice-controls";
import { useAiStream } from "@/lib/use-ai-stream";
import { useVoice } from "@/lib/use-voice";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import { MatterPicker } from "@/components/MatterPicker";
import type { Matter } from "@/hooks/use-matters";

export function AiSentencingPage() {
  const [input, setInput] = useState("");
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
    const text = input.trim();
    if (!text || isStreaming) return;
    reset();
    await stream("/ai/sentencing", {
      messages: [{ role: "user", content: text }],
    });
  };

  const handleReset = () => {
    setInput("");
    reset();
  };

  const sampleCase = `Offence: Section 302 Penal Code (Murder)
Accused: Male, 28 years old, first offender
Facts: Stabbed the deceased during a heated argument at a bar. Single stab wound. Accused was intoxicated.
Plea: Claims trial (not guilty)
Aggravating: Weapon used, public place
Mitigating: First offender, provocation by deceased, intoxication, young age, sole breadwinner for elderly parents`;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-8 w-8 text-primary" />
            Sentencing Predictor
          </h1>
          <p className="text-muted-foreground">
            Input offence details, accused's profile, and case circumstances to receive a comprehensive sentencing prediction — statutory range, predicted likely sentence, comparable case precedents, aggravating/mitigating factor analysis, sentencing trends, guilty plea discount assessment, and strategic recommendations
          </p>
        </div>
        {response && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" /> New Analysis
          </Button>
        )}
      </div>

      {!response && !isStreaming && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <CardTitle className="font-serif text-lg">Offence & Case Details</CardTitle>
                <CardDescription>Provide the offence, accused's background, and relevant circumstances</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <MatterPicker
                  onSelect={(matter: Matter) => {
                    const lines: string[] = [];
                    if (matter.charge) lines.push(`Offence: ${matter.charge}`);
                    if (matter.accusedName) lines.push(`Accused: ${matter.accusedName}`);
                    if (matter.stage) lines.push(`Stage: ${matter.stage}`);
                    if (matter.notes) lines.push(`Facts: ${matter.notes}`);
                    if (matter.court) lines.push(`Court: ${matter.court}`);
                    if (matter.caseNo) lines.push(`Case No: ${matter.caseNo}`);
                    setInput(lines.join("\n"));
                  }}
                />
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Enter the offence details:\n\nOffence: [Section and Act]\nAccused: [Age, background, antecedents]\nFacts: [Brief summary of facts]\nPlea: [Guilty/Not guilty]\nAggravating factors: [...]\nMitigating factors: [...]`}
                  className="min-h-[250px] bg-background/50 text-sm font-mono"
                />
                <Button onClick={handleSubmit} disabled={!input.trim()} className="w-full" size="lg">
                  <Target className="h-4 w-4 mr-2" /> Predict Sentencing Range
                </Button>
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="border-border/50 bg-card/30">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Try This Example</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap mb-3">{sampleCase}</pre>
                <Button variant="secondary" size="sm" className="w-full" onClick={() => setInput(sampleCase)}>
                  Use This Example
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/30">
              <CardHeader>
                <CardTitle className="text-sm font-medium">What You'll Get</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>- Statutory sentencing range</p>
                <p>- Predicted likely sentence</p>
                <p>- Comparable case precedents</p>
                <p>- Aggravating/mitigating factor analysis</p>
                <p>- Sentencing trend observations</p>
                <p>- Strategic recommendations</p>
              </CardContent>
            </Card>
          </div>
        </div>
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
              <div className="mb-4 space-y-3">
                <DraftExportButtons
                  title="Sentencing Prediction"
                  content={response}
                />
                <SaveToMatterPanel
                  draftTitle="Sentencing Prediction"
                  draftContent={response}
                  kind="sentencing"
                  sourceLabel="Sentencing Predictor"
                  inputJson={{ input }}
                />
              </div>
            )}
            <div ref={scrollRef} className="max-h-[70vh] overflow-auto">
              {response ? (
                <MarkdownRenderer content={response} />
              ) : (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Analyzing sentencing factors...</span>
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
