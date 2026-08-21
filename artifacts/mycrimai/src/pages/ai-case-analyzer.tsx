import { useState, useEffect } from "react";
import { Scale, Loader2, RotateCcw, Sparkles, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { DraftExportButtons } from "@workspace/draft-export/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { VoiceControls } from "@/components/ai/voice-controls";
import { useAiStream } from "@/lib/use-ai-stream";
import { useVoice } from "@/lib/use-voice";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import { MatterPicker, matterToCaseDetails } from "@/components/MatterPicker";

const EXAMPLE_FACTS = `On 15 March 2024, the accused, a 28-year-old male Malaysian citizen, was arrested at a roadblock in Petaling Jaya, Selangor. A search of his vehicle uncovered 50 grams of methamphetamine hidden in a modified compartment in the car boot. The accused claimed the car belonged to his friend and he was unaware of the drugs. He has no prior criminal record. The arresting officer noted that the accused appeared nervous and attempted to flee before being apprehended. A mobile phone found on the accused contained text messages discussing drug pricing.`;

/** Parse a single query-string integer param; returns null if missing/invalid. */
function parseIntParam(search: string, key: string): number | null {
  const v = new URLSearchParams(search).get(key);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function AiCaseAnalyzerPage() {
  const [facts, setFacts] = useState("");
  const voice = useVoice();
  const { response, isStreaming, error, stream, reset } = useAiStream();

  // --- matter context from URL ------------------------------------------------
  const search = typeof window !== "undefined" ? window.location.search : "";
  const matterId = parseIntParam(search, "matterId");

  // Pre-fill facts from URL params (matterTitle / accused / charge / caseNo / court)
  // so even without a loaded matter list we have some context.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const parts: string[] = [];
    const matterTitle = params.get("matterTitle");
    const accused = params.get("accused");
    const charge = params.get("charge");
    const caseNo = params.get("caseNo");
    const court = params.get("court");
    if (matterTitle) parts.push(`Matter: ${matterTitle}`);
    if (accused) parts.push(`Accused: ${accused}`);
    if (charge) parts.push(`Charge: ${charge}`);
    if (caseNo) parts.push(`Case No: ${caseNo}`);
    if (court) parts.push(`Court: ${court}`);
    if (parts.length > 0) setFacts(parts.join(" | "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  useEffect(() => {
    if (!isStreaming && response) voice.speak(response);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  const handleAnalyze = async () => {
    if (!facts.trim()) return;
    reset();
    await stream("/ai/analyze-case", { facts });
  };

  return (
    <div
      className="space-y-6 pb-8"
      data-testid="case-home-handoff-target"
      data-matter-id={matterId ?? undefined}
    >
      {/* Back to matter link when launched from a matter */}
      {matterId != null && (
        <Link
          href={`/workspace/matters/${matterId}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to matter
        </Link>
      )}

      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
          <Scale className="h-8 w-8 text-primary" />
          Case Fact Analyzer
        </h1>
        <p className="text-muted-foreground">
          Paste your case facts to receive a comprehensive analysis — applicable charges with section references, essential elements to prove, potential defences, sentencing range, relevant Malaysian precedents, bail considerations, and strategic defence recommendations
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Case Facts</CardTitle>
              <CardDescription>Enter the facts of your case. Include dates, location, parties involved, and key events.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MatterPicker
                defaultMatterId={matterId}
                onSelect={(matter) => setFacts(matterToCaseDetails(matter))}
              />
              <Textarea
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                placeholder="Enter the case facts here..."
                className="min-h-[300px] bg-background/50 font-mono text-sm"
                data-testid="textarea-case-facts"
              />
              <div className="flex gap-2">
                <Button onClick={handleAnalyze} disabled={isStreaming || !facts.trim()} className="flex-1" data-testid="button-analyze-case">
                  {isStreaming ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Analyze Case</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => { setFacts(""); reset(); }} disabled={isStreaming}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Example — Try it</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-2 line-clamp-3">{EXAMPLE_FACTS}</p>
              <Button variant="ghost" size="sm" onClick={() => setFacts(EXAMPLE_FACTS)} data-testid="button-use-example">
                Use Example
              </Button>
            </CardContent>
          </Card>
        </div>

        <div>
          {response ? (
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Analysis Result
                    {isStreaming && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </CardTitle>
                  <VoiceControls voice={voice} responseText={response} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isStreaming && response && (
                  <div className="space-y-3">
                    <DraftExportButtons
                      title="Case Fact Analysis"
                      content={response}
                    />
                    <SaveToMatterPanel
                      draftTitle="Case Fact Analysis"
                      draftContent={response}
                      defaultMatterId={matterId}
                      kind="case-analysis"
                      sourceLabel="Case Fact Analyzer"
                      inputJson={{ facts }}
                    />
                  </div>
                )}
                <MarkdownRenderer content={response} />
              </CardContent>
            </Card>
          ) : error ? (
            <div className="text-center text-destructive p-6 bg-destructive/10 rounded-lg">{error}</div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 border border-dashed rounded-lg border-border">
              <Scale className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Analysis will appear here</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">Enter case facts and click Analyze</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
