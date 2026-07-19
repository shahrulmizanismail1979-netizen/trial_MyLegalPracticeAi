import { useState } from "react";
import { useLocation } from "wouter";
import {
  useTranscribeMeeting,
  useCreateMeeting,
  getListMeetingsQueryKey,
  type MeetingSegment,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useT, useLanguage } from "@/lib/i18n";
import { fileToBase64, type RecordingResult } from "@/hooks/useRecorder";
import { AudioRecorder } from "@/components/AudioRecorder";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

/** Split a pasted "Name: text" transcript into labelled segments. */
function parseTranscript(text: string): MeetingSegment[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const segments: MeetingSegment[] = [];
  for (const line of lines) {
    const m = line.match(/^([^:]{1,40}):\s*(.+)$/);
    if (m) segments.push({ speaker: m[1].trim(), text: m[2].trim() });
    else segments.push({ speaker: "Speaker", text: line });
  }
  return segments;
}

export function NewMeetingDialog() {
  const t = useT();
  const { lang } = useLanguage();
  const { currentUser } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [recording, setRecording] = useState<RecordingResult | null>(null);
  const [pasteText, setPasteText] = useState("");
  const [transcript, setTranscript] = useState<{
    segments: MeetingSegment[];
    rawTranscript: string;
  } | null>(null);

  const transcribe = useTranscribeMeeting();
  const createMeeting = useCreateMeeting();

  const reset = () => {
    setTitle("");
    setRecording(null);
    setPasteText("");
    setTranscript(null);
  };

  const handleTranscribe = async (audio: RecordingResult) => {
    try {
      const res = await transcribe.mutateAsync({
        data: {
          audioBase64: audio.audioBase64,
          mimeType: audio.mimeType,
          actingUserId: currentUser?.id ?? 0,
        },
      });
      setTranscript({ segments: res.segments, rawTranscript: res.rawTranscript });
    } catch {
      toast.error(t("meetings.error.transcribe"));
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const audioBase64 = await fileToBase64(file);
      await handleTranscribe({
        audioBase64,
        mimeType: file.type || "audio/mpeg",
      });
    } catch {
      toast.error(t("meetings.error.transcribe"));
    }
  };

  const handleGenerate = async () => {
    let segments: MeetingSegment[];
    let rawTranscript: string;

    if (transcript) {
      segments = transcript.segments;
      rawTranscript = transcript.rawTranscript;
    } else if (pasteText.trim()) {
      segments = parseTranscript(pasteText);
      rawTranscript = segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");
    } else {
      toast.error(t("meetings.error.noTranscript"));
      return;
    }

    try {
      const meeting = await createMeeting.mutateAsync({
        data: {
          title: title.trim() || null,
          lang,
          segments,
          rawTranscript,
          actingUserId: currentUser?.id ?? null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
      setOpen(false);
      reset();
      navigate(`/meeting/${meeting.id}`);
    } catch {
      toast.error(t("meetings.error.create"));
    }
  };

  const canGenerate = !!transcript || pasteText.trim().length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2 font-semibold tracking-wide shadow-sm">
          <Plus className="h-4 w-4" />
          {t("meetings.new")}
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card max-w-xl rounded-2xl border-none shadow-2xl">
        <DialogHeader className="mb-2">
          <DialogTitle className="font-serif text-2xl tracking-tight">
            {t("meetings.new.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <Label>{t("meetings.new.titleField")}</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("meetings.new.titlePlaceholder")}
          />
        </div>

        <Tabs defaultValue="record" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="record">{t("meetings.new.tab.record")}</TabsTrigger>
            <TabsTrigger value="upload">{t("meetings.new.tab.upload")}</TabsTrigger>
            <TabsTrigger value="paste">{t("meetings.new.tab.paste")}</TabsTrigger>
          </TabsList>

          <TabsContent value="record" className="pt-4">
            <AudioRecorder
              onResult={(r) => {
                setRecording(r);
                if (r) handleTranscribe(r);
                else setTranscript(null);
              }}
            />
          </TabsContent>

          <TabsContent value="upload" className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              {t("meetings.new.upload.hint")}
            </p>
            <Input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
            />
          </TabsContent>

          <TabsContent value="paste" className="space-y-2 pt-4">
            <Label>{t("meetings.new.paste.label")}</Label>
            <Textarea
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value);
                setTranscript(null);
              }}
              placeholder={t("meetings.new.paste.placeholder")}
              className="h-40 resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t("meetings.new.paste.hint")}
            </p>
          </TabsContent>
        </Tabs>

        {transcribe.isPending && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("meetings.new.transcribing")}
          </p>
        )}
        {transcript && !transcribe.isPending && (
          <p className="mt-2 flex items-center gap-2 text-sm font-medium text-primary">
            <CheckCircle2 className="h-4 w-4" />
            {t("meetings.new.transcriptReady")}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || createMeeting.isPending || transcribe.isPending}
            className="gap-2"
          >
            {createMeeting.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("meetings.new.generating")}
              </>
            ) : (
              t("meetings.new.generate")
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
