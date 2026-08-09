import { useState, useEffect } from "react";
import { FileEdit, Loader2, RotateCcw, Sparkles, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { VoiceControls } from "@/components/ai/voice-controls";
import { useAiStream } from "@/lib/use-ai-stream";
import { useVoice } from "@/lib/use-voice";
import { DraftExportButtons } from "@workspace/draft-export/react";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";

const DOCUMENT_TYPES = [
  { value: "Bail Application (Permohonan Jaminan)", label: "Bail Application" },
  { value: "Written Submission (Hujahan Bertulis)", label: "Written Submission" },
  { value: "Mitigation Plea (Rayuan Mitigasi)", label: "Mitigation Plea" },
  { value: "Notice of Appeal (Notis Rayuan)", label: "Notice of Appeal" },
  { value: "Representation Letter to AG (Surat Representasi)", label: "Representation to AG" },
  { value: "Criminal Motion (Usul Jenayah)", label: "Criminal Motion" },
  { value: "Stay of Execution Application", label: "Stay of Execution" },
  { value: "Revision Application (Permohonan Semakan)", label: "Revision Application" },
];

export function AiDocumentDrafterPage() {
  const [documentType, setDocumentType] = useState("");
  const [caseDetails, setCaseDetails] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [copied, setCopied] = useState(false);
  const voice = useVoice();
  const { response, isStreaming, error, stream, reset } = useAiStream();

  useEffect(() => {
    if (!isStreaming && response) voice.speak(response);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  const handleDraft = async () => {
    if (!documentType || !caseDetails.trim()) return;
    reset();
    await stream("/ai/draft-document", { documentType, caseDetails, additionalInstructions });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="space-y-1">
        <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
          <FileEdit className="h-8 w-8 text-primary" />
          Document Drafter
        </h1>
        <p className="text-muted-foreground">
          Generate professional legal documents following Malaysian court formatting — bail applications, written submissions, mitigation pleas, notices of appeal, AG representations, criminal motions, stay applications, and revision applications with proper case numbering, statutory references, and prayer/relief sections
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="font-serif text-lg">Document Details</CardTitle>
              <CardDescription>Select the type and provide case details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Document Type</label>
                <Select value={documentType} onValueChange={setDocumentType}>
                  <SelectTrigger className="bg-background/50" data-testid="select-document-type">
                    <SelectValue placeholder="Select document type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((dt) => (
                      <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Case Details</label>
                <Textarea
                  value={caseDetails}
                  onChange={(e) => setCaseDetails(e.target.value)}
                  placeholder="Provide the case details: accused's name, case number, charges, court, relevant facts, arguments to include..."
                  className="min-h-[200px] bg-background/50 font-mono text-sm"
                  data-testid="textarea-case-details"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Additional Instructions (Optional)</label>
                <Textarea
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  placeholder="Any specific points to emphasize, tone preferences, etc..."
                  className="min-h-[80px] bg-background/50 text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleDraft} disabled={isStreaming || !documentType || !caseDetails.trim()} className="flex-1" data-testid="button-draft-document">
                  {isStreaming ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Drafting...</>
                  ) : (
                    <><Sparkles className="h-4 w-4 mr-2" /> Generate Draft</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => { setDocumentType(""); setCaseDetails(""); setAdditionalInstructions(""); reset(); }} disabled={isStreaming}>
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
                <div className="flex flex-row items-center justify-between gap-2 flex-wrap">
                  <CardTitle className="font-serif text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" /> Generated Document
                    {isStreaming && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <VoiceControls voice={voice} responseText={response} compact />
                    {!isStreaming && response && (
                      <>
                        <Button variant="outline" size="sm" onClick={handleCopy}>
                          {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                        <DraftExportButtons title={documentType || "Document"} content={response} />
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isStreaming && response && (
                  <SaveToMatterPanel
                    draftTitle={documentType || "Document"}
                    draftContent={response}
                  />
                )}
                <MarkdownRenderer content={response} />
              </CardContent>
            </Card>
          ) : error ? (
            <div className="text-center text-destructive p-6 bg-destructive/10 rounded-lg">{error}</div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-12 border border-dashed rounded-lg border-border">
              <FileEdit className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Document will appear here</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">Select type and enter details to generate</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
