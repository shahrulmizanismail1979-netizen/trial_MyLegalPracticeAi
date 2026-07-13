import { useState, useEffect } from "react";
import { FileSearch, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { VoiceControls } from "@/components/ai/voice-controls";
import { useAiStream } from "@/lib/use-ai-stream";
import { useVoice } from "@/lib/use-voice";

const EXAMPLE_CHARGE = `PERTUDUHAN

Bahawa kamu, pada 15 Mac 2024, jam lebih kurang 2.30 petang, di Jalan SS2/55, Petaling Jaya, di dalam Daerah Petaling, di dalam Negeri Selangor Darul Ehsan, telah didapati mengedar dadah berbahaya iaitu Methamphetamine seberat 50 gram, dan dengan itu kamu telah melakukan satu kesalahan di bawah Seksyen 39B(1)(a) Akta Dadah Berbahaya 1952 dan boleh dihukum di bawah Seksyen 39B(2) Akta yang sama.`;

export function AiChargeAnalyzerPage() {
  const [chargeSheet, setChargeSheet] = useState("");
  const voice = useVoice();
  const { response, isStreaming, error, stream, reset } = useAiStream();

  useEffect(() => {
    if (!isStreaming && response) voice.speak(response);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  const handleAnalyze = async () => {
    if (!chargeSheet.trim()) return;
    reset();
    await stream("/ai/analyze-charge", { chargeSheet });
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileSearch className="h-8 w-8 text-primary" />
          Charge Sheet Analyzer
        </h1>
        <p className="text-muted-foreground">
          Paste any charge sheet (English or Bahasa Malaysia) for a complete breakdown — statutory provisions, essential elements the prosecution must prove, viable defences, sentencing guidelines with mandatory/discretionary ranges, bail analysis, prosecution strategy prediction, and defence tactical recommendations
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Charge Sheet</CardTitle>
              <CardDescription>Paste the charge (pertuduhan) text — in English or Bahasa Malaysia</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={chargeSheet}
                onChange={(e) => setChargeSheet(e.target.value)}
                placeholder="Paste the charge sheet text here..."
                className="min-h-[300px] bg-background/50 font-mono text-sm"
                data-testid="textarea-charge-sheet"
              />
              <div className="flex gap-2">
                <Button onClick={handleAnalyze} disabled={isStreaming || !chargeSheet.trim()} className="flex-1" data-testid="button-analyze-charge">
                  {isStreaming ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Analyzing...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Analyze Charge</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => { setChargeSheet(""); reset(); }} disabled={isStreaming}>
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
              <p className="text-xs text-muted-foreground mb-2 line-clamp-3">{EXAMPLE_CHARGE}</p>
              <Button variant="ghost" size="sm" onClick={() => setChargeSheet(EXAMPLE_CHARGE)} data-testid="button-use-example-charge">
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
                    <Sparkles className="h-5 w-5 text-primary" /> Charge Analysis
                    {isStreaming && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </CardTitle>
                  <VoiceControls voice={voice} responseText={response} />
                </div>
              </CardHeader>
              <CardContent>
                <MarkdownRenderer content={response} />
              </CardContent>
            </Card>
          ) : error ? (
            <div className="text-center text-destructive p-6 bg-destructive/10 rounded-lg">{error}</div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 border border-dashed rounded-lg border-border">
              <FileSearch className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Analysis will appear here</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">Paste a charge sheet and click Analyze</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
