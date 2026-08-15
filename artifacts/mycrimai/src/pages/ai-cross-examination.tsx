import { useState, useEffect } from "react";
import { MessageSquareWarning, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { DraftExportButtons } from "@workspace/draft-export/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { VoiceControls } from "@/components/ai/voice-controls";
import { useAiStream } from "@/lib/use-ai-stream";
import { useVoice } from "@/lib/use-voice";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import { MatterPicker, matterToChargeRef } from "@/components/MatterPicker";

export function AiCrossExaminationPage() {
  const [witnessStatement, setWitnessStatement] = useState("");
  const [witnessRole, setWitnessRole] = useState("");
  const [caseContext, setCaseContext] = useState("");
  const voice = useVoice();
  const { response, isStreaming, error, stream, reset } = useAiStream();

  useEffect(() => {
    if (!isStreaming && response) voice.speak(response);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  const handleGenerate = async () => {
    if (!witnessStatement.trim()) return;
    reset();
    await stream("/ai/cross-examination", { witnessStatement, witnessRole, caseContext });
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquareWarning className="h-8 w-8 text-primary" />
          Cross-Examination Helper
        </h1>
        <p className="text-muted-foreground">
          Generate strategic cross-examination questions from witness statements — credibility attacks, inconsistency exploitation, material fact challenges, impeachment foundations under Section 145 Evidence Act, and expert/technical questions with strategic notes on tone and pacing
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Witness Details</CardTitle>
              <CardDescription>Provide the witness statement and context for targeted questions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <MatterPicker
                onSelect={(matter) => setCaseContext(matterToChargeRef(matter))}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Witness Role (Optional)</label>
                <Input
                  value={witnessRole}
                  onChange={(e) => setWitnessRole(e.target.value)}
                  placeholder="e.g., Arresting officer, Complainant, IO, Forensic expert..."
                  className="bg-background/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Case Context (Optional)</label>
                <Textarea
                  value={caseContext}
                  onChange={(e) => setCaseContext(e.target.value)}
                  placeholder="Brief description of the case and charges..."
                  className="min-h-[80px] bg-background/50 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Witness Statement</label>
                <Textarea
                  value={witnessStatement}
                  onChange={(e) => setWitnessStatement(e.target.value)}
                  placeholder="Paste the witness statement here..."
                  className="min-h-[250px] bg-background/50 font-mono text-sm"
                  data-testid="textarea-witness-statement"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleGenerate} disabled={isStreaming || !witnessStatement.trim()} className="flex-1" data-testid="button-generate-questions">
                  {isStreaming ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Generate Questions</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => { setWitnessStatement(""); setWitnessRole(""); setCaseContext(""); reset(); }} disabled={isStreaming}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          {response ? (
            <Card className="border-border/50 bg-card/50">
              <CardHeader>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Cross-Examination Questions
                    {isStreaming && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </CardTitle>
                  <VoiceControls voice={voice} responseText={response} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isStreaming && response && (
                  <div className="space-y-3">
                    <DraftExportButtons
                      title={witnessRole ? `Cross-Examination Questions — ${witnessRole}` : "Cross-Examination Questions"}
                      content={response}
                    />
                    <SaveToMatterPanel
                      draftTitle={witnessRole ? `Cross-Examination Questions — ${witnessRole}` : "Cross-Examination Questions"}
                      draftContent={response}
                      kind="cross-examination"
                      sourceLabel="Cross-Examination Helper"
                      inputJson={{ witnessStatement, witnessRole, caseContext }}
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
              <MessageSquareWarning className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Questions will appear here</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">Enter a witness statement to generate targeted questions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
