import { useState, useMemo } from "react";
import { transcribeRecording, TranscriptResult, TranscriptSegment } from "@/lib/irac-api";
import { FileUpload } from "@/components/FileUpload";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AudioLines,
  Loader2,
  Copy,
  Check,
  Download,
  Users,
  Clock,
  FileAudio,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

const MEDIA_ACCEPT: Record<string, string[]> = {
  "audio/*": [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".oga", ".opus", ".flac", ".amr", ".weba"],
  "video/*": [".mp4", ".mov", ".m4v", ".mkv", ".avi", ".webm", ".3gp"],
};
const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(ss)}` : `${pad(m)}:${pad(ss)}`;
}

export default function Transcription() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const uniqueSpeakers = useMemo(() => {
    if (!result) return [] as { id: string; label: string }[];
    const seen: { id: string; label: string }[] = [];
    for (const seg of result.segments) {
      if (!seen.some((x) => x.id === seg.speaker)) {
        seen.push({ id: seg.speaker, label: seg.speakerLabel });
      }
    }
    return seen;
  }, [result]);

  const nameFor = (seg: Pick<TranscriptSegment, "speaker" | "speakerLabel">) =>
    speakerNames[seg.speaker]?.trim() || seg.speakerLabel;

  const handleUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setIsTranscribing(true);
    setError(null);
    setResult(null);
    setSpeakerNames({});
    try {
      const res = await transcribeRecording(file);
      setResult(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("tool.transcription.toast.couldNot");
      setError(msg);
      toast({
        title: t("tool.transcription.toast.failed"),
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const buildPlainText = (): string => {
    if (!result) return "";
    const head = [
      t("tool.transcription.docHeading"),
      `${t("tool.transcription.fileLabel")}: ${result.filename}`,
      `${t("tool.transcription.duration")}: ${fmtDuration(result.durationSec)}  ·  ${t("tool.transcription.speakers")}: ${result.speakerCount}`,
      t("tool.transcription.disclaimer"),
      "",
    ].join("\n");
    const body = result.segments
      .map((s) => `[${s.start}] ${nameFor(s)}:\n${s.text}`)
      .join("\n\n");
    return `${head}\n${body}\n`;
  };

  const buildMarkdown = (): string => {
    if (!result) return "";
    const head = [
      `# ${t("tool.transcription.docHeading")}`,
      "",
      `**${t("tool.transcription.fileLabel")}:** ${result.filename}  `,
      `**${t("tool.transcription.duration")}:** ${fmtDuration(result.durationSec)} · **${t("tool.transcription.speakers")}:** ${result.speakerCount}  `,
      "",
      `> ${t("tool.transcription.disclaimer")}`,
      "",
    ].join("\n");
    const body = result.segments
      .map((s) => `**${nameFor(s)}** \`[${s.start}]\`\n\n${s.text}`)
      .join("\n\n");
    return `${head}\n${body}\n`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildPlainText());
    setCopied(true);
    toast({ title: t("tool.transcription.toast.copied") });
    setTimeout(() => setCopied(false), 2000);
  };

  const download = (kind: "txt" | "md") => {
    if (!result) return;
    const content = kind === "md" ? buildMarkdown() : buildPlainText();
    const blob = new Blob([content], {
      type: kind === "md" ? "text/markdown;charset=utf-8" : "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const base = result.filename.replace(/\.[^.]+$/, "") || "transcript";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}-transcript.${kind}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setSpeakerNames({});
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto p-6 gap-6 grid grid-cols-1 lg:grid-cols-12">
      {/* Controls */}
      <div className="lg:col-span-4 space-y-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-2">
            <AudioLines className="w-8 h-8 text-primary" />
            {t("tool.transcription.title")}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">{t("tool.transcription.desc")}</p>
        </div>

        {(!result || isTranscribing) && (
          <Card className="bg-card shadow-sm border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-serif">
                {t("tool.transcription.uploadTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUpload
                onUpload={handleUpload}
                isUploading={isTranscribing}
                title={t("tool.transcription.dropTitle")}
                hint={t("tool.transcription.hint")}
                buttonLabel={t("tool.transcription.button")}
                maxSizeBytes={MAX_MEDIA_BYTES}
                accept={MEDIA_ACCEPT}
                multiple={false}
              />
              {isTranscribing && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin mt-0.5 shrink-0" />
                  <span>{t("tool.transcription.transcribingNote")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {result && !isTranscribing && (
          <>
            <Card className="bg-card shadow-sm border-border">
              <CardContent className="pt-6 space-y-3 text-sm">
                <div className="flex items-center gap-2 text-foreground">
                  <FileAudio className="w-4 h-4 text-primary shrink-0" />
                  <span className="truncate">{result.filename}</span>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" />
                    {fmtDuration(result.durationSec)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-primary" />
                    {result.speakerCount} {t("tool.transcription.speakers")}
                  </span>
                </div>
                <Button variant="outline" className="w-full" onClick={reset}>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  {t("tool.transcription.newRecording")}
                </Button>
              </CardContent>
            </Card>

            {uniqueSpeakers.length > 0 && (
              <Card className="bg-card shadow-sm border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-serif">
                    {t("tool.transcription.speakerNames")}
                  </CardTitle>
                  <CardDescription>{t("tool.transcription.speakerNamesHint")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {uniqueSpeakers.map((sp) => (
                    <div key={sp.id} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{sp.label}</Label>
                      <Input
                        value={speakerNames[sp.id] ?? ""}
                        placeholder={sp.label}
                        onChange={(e) =>
                          setSpeakerNames((prev) => ({ ...prev, [sp.id]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Output */}
      <div className="lg:col-span-8">
        <Card className="h-[calc(100vh-8rem)] flex flex-col shadow-md border-border bg-card">
          <CardHeader className="border-b border-border bg-card/80 backdrop-blur pb-3 flex flex-row items-center justify-between sticky top-0 z-10">
            <CardTitle className="font-serif text-lg">
              {t("tool.transcription.resultTitle")}
            </CardTitle>
            {result && !isTranscribing && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? t("common.copied") : t("tool.transcription.copy")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => download("txt")}>
                  <Download className="w-4 h-4 mr-2" />
                  {t("tool.transcription.downloadTxt")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => download("md")}>
                  <Download className="w-4 h-4 mr-2" />
                  {t("tool.transcription.downloadMd")}
                </Button>
              </div>
            )}
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-8">
            {error && (
              <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-md text-sm">
                {error}
              </div>
            )}

            {isTranscribing ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Loader2 className="w-12 h-12 mb-4 animate-spin text-primary" />
                <p>{t("tool.transcription.transcribing")}</p>
              </div>
            ) : !result ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                <AudioLines className="w-16 h-16 mb-4" />
                <p>{t("tool.transcription.empty")}</p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500 max-w-3xl mx-auto space-y-5">
                {result.segments.map((seg, i) => (
                  <div key={i}>
                    <div className="flex items-baseline gap-3 mb-1">
                      <span className="font-serif font-semibold text-primary">{nameFor(seg)}</span>
                      <span className="text-xs font-mono text-muted-foreground">{seg.start}</span>
                    </div>
                    <p className="text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {seg.text}
                    </p>
                  </div>
                ))}
                <div className="pt-6 mt-6 border-t border-border text-xs text-muted-foreground">
                  {t("tool.transcription.disclaimer")}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
