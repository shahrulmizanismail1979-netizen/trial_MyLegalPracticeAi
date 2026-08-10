import { useState, useRef, useEffect } from "react";
import { Lightbulb, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { VoiceControls } from "@/components/ai/voice-controls";
import { useAiStream } from "@/lib/use-ai-stream";
import { useVoice } from "@/lib/use-voice";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";

export function AiAppealGroundsPage() {
  const [judgment, setJudgment] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
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
    if (!judgment.trim() || isStreaming) return;
    reset();
    const content = `TRIAL COURT JUDGMENT / GROUNDS OF DECISION:
${judgment}

${additionalContext ? `ADDITIONAL CONTEXT:\n${additionalContext}` : ""}`;

    await stream("/ai/appeal-grounds", {
      messages: [{ role: "user", content }],
    });
  };

  const handleReset = () => {
    setJudgment("");
    setAdditionalContext("");
    reset();
  };

  const sampleJudgment = `The accused was charged under Section 39A(1) of the Dangerous Drugs Act 1952 for trafficking in 150g of methamphetamine. The Sessions Court convicted the accused and sentenced him to life imprisonment and 10 strokes of the rotan.

Key findings: The trial judge relied primarily on the presumption under Section 37(da) of the DDA. The chemist report was admitted without the chemist being called to testify. The accused's cautioned statement was admitted despite the accused claiming it was obtained under duress. The defence of innocent carrier was rejected without detailed analysis.

The investigating officer admitted under cross-examination that the chain of custody had a 6-hour gap. The judge did not address this in the grounds of judgment.`;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-primary" />
            Appeal Grounds Analyzer
          </h1>
          <p className="text-muted-foreground">
            Paste a trial court judgment or grounds of decision to identify all potential appeal grounds — errors of law, misdirections on fact, procedural irregularities, sentencing errors, and constitutional issues. Each ground is rated by prospects of success with supporting Malaysian appellate authorities and a suggested draft petition structure
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
                <CardTitle className="font-serif text-lg">Trial Court Judgment</CardTitle>
                <CardDescription>Paste the grounds of decision or summarize the key findings and rulings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={judgment}
                  onChange={(e) => setJudgment(e.target.value)}
                  placeholder="Paste the trial court's grounds of judgment here, or summarize the key findings, rulings on evidence, legal reasoning, and the sentence imposed..."
                  className="min-h-[250px] bg-background/50 text-sm"
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Additional Context (Optional)</label>
                  <Textarea
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="e.g., Defence arguments that were not addressed, procedural irregularities during trial, evidence that was excluded..."
                    className="min-h-[80px] bg-background/50 text-sm"
                  />
                </div>
                <Button onClick={handleSubmit} disabled={!judgment.trim()} className="w-full" size="lg">
                  <Lightbulb className="h-4 w-4 mr-2" /> Identify Appeal Grounds
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
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap mb-3 max-h-[200px] overflow-auto">{sampleJudgment}</pre>
                <Button variant="secondary" size="sm" className="w-full" onClick={() => setJudgment(sampleJudgment)}>
                  Use This Example
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/30">
              <CardHeader>
                <CardTitle className="text-sm font-medium">What You'll Get</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <p>- Errors of law identified</p>
                <p>- Misdirections on fact</p>
                <p>- Procedural irregularities</p>
                <p>- Sentencing errors</p>
                <p>- Supporting authorities for each ground</p>
                <p>- Prospects of success assessment</p>
                <p>- Draft petition of appeal structure</p>
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
              <div className="mb-4">
                <SaveToMatterPanel
                  draftTitle="Appeal Grounds Analysis"
                  draftContent={response}
                  kind="appeal-grounds"
                  sourceLabel="Appeal Grounds Analyzer"
                  inputJson={{ judgment, additionalContext }}
                />
              </div>
            )}
            <div ref={scrollRef} className="max-h-[70vh] overflow-auto">
              {response ? (
                <MarkdownRenderer content={response} />
              ) : (
                <div className="flex items-center gap-2 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Analyzing judgment for appeal grounds...</span>
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
