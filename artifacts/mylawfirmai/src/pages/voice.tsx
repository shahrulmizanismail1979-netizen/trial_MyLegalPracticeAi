import { useState } from "react";
import {
  useParseVoiceInstruction,
  type VoiceParseResponse,
} from "@/lib/api-client";
import { AppLayout } from "@/components/layout/AppLayout";
import { AudioRecorder } from "@/components/AudioRecorder";
import { DraftReview } from "@/components/DraftReview";
import { useAuth } from "@/lib/auth";
import { useT, useLanguage } from "@/lib/i18n";
import { type RecordingResult } from "@/hooks/useRecorder";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Quote, MessageSquare, AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";

export default function VoicePage() {
  const t = useT();
  const { lang } = useLanguage();
  const { currentUser, isManager } = useAuth();
  const parse = useParseVoiceInstruction();
  const [result, setResult] = useState<VoiceParseResponse | null>(null);

  const handleProcess = (audio: RecordingResult) => {
    parse.mutate(
      {
        data: {
          audioBase64: audio.audioBase64,
          mimeType: audio.mimeType,
          lang,
          actingUserId: currentUser?.id ?? null,
        },
      },
      {
        onSuccess: (res) => setResult(res),
        onError: () => toast.error(t("voice.error")),
      },
    );
  };

  const handleReset = () => {
    setResult(null);
    parse.reset();
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-3xl p-8">
        <header className="mb-8">
          <h1 className="jewel-gradient-text font-serif text-4xl font-bold tracking-tight">
            {t("voice.title")}
          </h1>
          <p className="mt-2 text-base font-medium text-muted-foreground">
            {t("voice.subtitle")}
          </p>
        </header>

        {!isManager && (
          <p className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
            {t("ai.managerOnly")}
          </p>
        )}

        <Card className="glass-card border-border/60 p-6">
          <AudioRecorder
            hint={t("voice.record.hint")}
            onResult={(r) => {
              if (r) handleProcess(r);
              else handleReset();
            }}
          />
          {parse.isPending && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("voice.processing")}
            </p>
          )}
        </Card>

        {result && (
          <div className="mt-8 space-y-6">
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                <Quote className="h-3.5 w-3.5" />
                {t("voice.transcript")}
              </h2>
              <p className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 italic text-foreground">
                {result.transcript}
              </p>
            </section>

            <section>
              <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
                <MessageSquare className="h-3.5 w-3.5" />
                {t("voice.assistantReply")}
              </h2>
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <DraftExportButtons title={t("voice.assistantReply")} content={result.assistantReply} hideMarkdown />
                <DraftDocument content={result.assistantReply} />
              </div>
            </section>

            {result.missing.length > 0 && (
              <section>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t("voice.missing")}
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {result.missing.map((mi, i) => (
                    <li
                      key={i}
                      className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-800"
                    >
                      {mi}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section>
              <DraftReview drafts={[result.draft]} onCreated={handleReset} />
            </section>

            <Button variant="ghost" onClick={handleReset} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              {t("voice.reset")}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
