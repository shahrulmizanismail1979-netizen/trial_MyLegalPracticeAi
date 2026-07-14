import React, { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  UploadCloud,
  FileText,
  File as FileIcon,
  Image as ImageIcon,
  Link2,
  ClipboardType,
  Mic,
  MonitorPlay,
  X,
  Trash2,
  AudioLines,
  Video,
  Square,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";

// ─── Staged item model ────────────────────────────────────────────────────────
type StagedItem =
  | { id: string; kind: "file"; file: File }
  | { id: string; kind: "text"; label: string; content: string }
  | { id: string; kind: "url"; url: string };

let idCounter = 0;
const newId = () => `it_${Date.now()}_${idCounter++}`;

function bytesLabel(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function iconForFile(file: File): React.ReactNode {
  const t = file.type;
  if (t.startsWith("image/")) return <ImageIcon className="w-4 h-4 text-primary shrink-0" />;
  if (t.startsWith("audio/")) return <AudioLines className="w-4 h-4 text-primary shrink-0" />;
  if (t.startsWith("video/")) return <Video className="w-4 h-4 text-primary shrink-0" />;
  return <FileIcon className="w-4 h-4 text-primary shrink-0" />;
}

interface CaseIntakeProps {
  onSubmit: (items: { files: File[]; pasteTexts: { label?: string; content: string }[]; urls: string[] }) => void;
  isSubmitting: boolean;
  /** "create" for a brand-new matter, "append" to add to an existing one. */
  mode?: "create" | "append";
}

export function CaseIntake({ onSubmit, isSubmitting, mode = "create" }: CaseIntakeProps) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [items, setItems] = useState<StagedItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const addFiles = useCallback((files: File[]) => {
    if (!files.length) return;
    setItems((prev) => [...prev, ...files.map((file) => ({ id: newId(), kind: "file" as const, file }))]);
  }, []);

  const removeItem = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const clearAll = () => setItems([]);

  // ── File dropzone ───────────────────────────────────────────────────────────
  const onDrop = useCallback((accepted: File[]) => addFiles(accepted), [addFiles]);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled: isSubmitting,
    maxSize: 500 * 1024 * 1024,
    maxFiles: 100,
    noClick: true,
  });

  // ── Clipboard paste (screenshots + text) ────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handlePaste = (e: ClipboardEvent) => {
      if (isSubmitting) return;
      const cd = e.clipboardData;
      if (!cd) return;
      const imgs: File[] = [];
      for (const item of Array.from(cd.items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) {
            const ext = f.type.split("/")[1] || "png";
            imgs.push(new File([f], f.name || `screenshot-${Date.now()}.${ext}`, { type: f.type }));
          }
        }
      }
      if (imgs.length) {
        e.preventDefault();
        addFiles(imgs);
        toast({ title: t("tool.intake.toast.imageAdded"), description: `${imgs.length} ${t("tool.intake.toast.imagesStaged")}` });
        return;
      }
      const text = cd.getData("text/plain");
      if (text && text.trim().length > 0) {
        e.preventDefault();
        setItems((prev) => [
          ...prev,
          { id: newId(), kind: "text", label: `${t("tool.intake.pastedNote")} ${prev.filter((i) => i.kind === "text").length + 1}`, content: text },
        ]);
        toast({ title: t("tool.intake.toast.textPasted"), description: t("tool.intake.toast.textPastedDesc") });
      }
    };
    el.addEventListener("paste", handlePaste as EventListener);
    return () => el.removeEventListener("paste", handlePaste as EventListener);
  }, [addFiles, isSubmitting, toast]);

  // ── Paste-text modal ─────────────────────────────────────────────────────────
  const [textOpen, setTextOpen] = useState(false);
  const [textLabel, setTextLabel] = useState("");
  const [textBody, setTextBody] = useState("");
  const saveText = () => {
    if (!textBody.trim()) return;
    setItems((prev) => [
      ...prev,
      { id: newId(), kind: "text", label: textLabel.trim() || `Pasted note ${prev.filter((i) => i.kind === "text").length + 1}`, content: textBody },
    ]);
    setTextLabel("");
    setTextBody("");
    setTextOpen(false);
  };

  // ── Add-link modal ────────────────────────────────────────────────────────────
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const saveLink = () => {
    const u = linkUrl.trim();
    if (!u) return;
    setItems((prev) => [...prev, { id: newId(), kind: "url", url: u }]);
    setLinkUrl("");
    setLinkOpen(false);
  };

  // ── Recording (audio + screen) ────────────────────────────────────────────────
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [recording, setRecording] = useState<null | "audio" | "screen">(null);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const startRecording = async (type: "audio" | "screen") => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast({
        title: t("tool.intake.toast.recordFailed"),
        description: t("tool.intake.toast.notAvailable"),
        variant: "destructive",
      });
      return;
    }
    try {
      let stream: MediaStream;
      if (type === "audio") {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        // If the user picked a screen with no audio, also try to add the mic.
        if (stream.getAudioTracks().length === 0) {
          try {
            const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
            mic.getAudioTracks().forEach((t) => stream.addTrack(t));
          } catch {
            /* proceed without mic */
          }
        }
      }
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("video/webm")
        ? type === "screen"
          ? "video/webm"
          : "audio/webm"
        : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blobType = type === "screen" ? "video/webm" : "audio/webm";
        const ext = type === "screen" ? "webm" : "webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const name = type === "screen" ? `screen-recording-${stamp}.${ext}` : `voice-recording-${stamp}.${ext}`;
        if (blob.size > 0) addFiles([new File([blob], name, { type: blobType })]);
        stopTracks();
        setRecording(null);
        setSeconds(0);
      };
      // Stop automatically if the user ends screen-share from the browser UI.
      stream.getVideoTracks().forEach((t) => (t.onended = () => rec.state !== "inactive" && rec.stop()));
      rec.start();
      recorderRef.current = rec;
      setRecording(type);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (e) {
      const name = (e as Error).name;
      const inIframe = typeof window !== "undefined" && window.self !== window.top;
      let description: string;
      if (name === "NotAllowedError" || name === "SecurityError") {
        description = inIframe
          ? t("tool.intake.toast.previewBlocked")
          : t("tool.intake.toast.permissionDenied");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        description = t("tool.intake.toast.noDevice");
      } else {
        description = t("tool.intake.toast.notAvailable");
      }
      toast({
        title: t("tool.intake.toast.recordFailed"),
        description,
        variant: "destructive",
      });
      stopTracks();
      setRecording(null);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      stopTracks();
      setRecording(null);
    }
  };

  useEffect(() => () => stopTracks(), []);

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  // ── Submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    const files = items.filter((i): i is Extract<StagedItem, { kind: "file" }> => i.kind === "file").map((i) => i.file);
    const pasteTexts = items
      .filter((i): i is Extract<StagedItem, { kind: "text" }> => i.kind === "text")
      .map((i) => ({ label: i.label, content: i.content }));
    const urls = items.filter((i): i is Extract<StagedItem, { kind: "url" }> => i.kind === "url").map((i) => i.url);
    onSubmit({ files, pasteTexts, urls });
  };

  const count = items.length;

  const actions = [
    { label: t("tool.intake.action.upload"), icon: UploadCloud, onClick: () => fileInputRef.current?.click() },
    { label: t("tool.intake.action.pasteText"), icon: ClipboardType, onClick: () => setTextOpen(true) },
    { label: t("tool.intake.action.addLink"), icon: Link2, onClick: () => setLinkOpen(true) },
    { label: t("tool.intake.action.recordVoice"), icon: Mic, onClick: () => startRecording("audio") },
    { label: t("tool.intake.action.recordScreen"), icon: MonitorPlay, onClick: () => startRecording("screen") },
  ];

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div ref={containerRef} tabIndex={0} className="w-full outline-none">
      {/* Hidden input for explicit "Upload files" */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {/* Action bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        {actions.map((a) => (
          <Button
            key={a.label}
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting || recording !== null}
            onClick={a.onClick}
            className="gap-2"
          >
            <a.icon className="w-4 h-4" />
            {a.label}
          </Button>
        ))}
      </div>

      {/* Recording banner */}
      {recording && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <span className="text-sm font-medium text-foreground">
              {recording === "screen" ? t("tool.intake.recordingScreen") : t("tool.intake.recordingAudio")} · {mmss}
            </span>
          </div>
          <Button type="button" size="sm" variant="destructive" onClick={stopRecording} className="gap-2">
            <Square className="w-3.5 h-3.5" /> {t("tool.intake.stopAdd")}
          </Button>
        </div>
      )}

      {/* Drop / paste zone — the big staging area */}
      <div
        {...getRootProps()}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl transition-colors duration-200 cursor-pointer
          ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-card/40"}
          ${isSubmitting ? "opacity-60 cursor-not-allowed" : ""}
          ${count > 0 ? "p-4" : "min-h-[280px] flex items-center justify-center p-10"}
        `}
      >
        <input {...getInputProps()} />

        {count === 0 ? (
          <div className="flex flex-col items-center justify-center text-center space-y-4 pointer-events-none">
            <div className={`rounded-full p-4 ${isDragActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <p className="font-medium text-foreground text-base">
                {isDragActive ? t("tool.intake.dropHere") : t("tool.intake.dropPrompt")}
              </p>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-lg">
                {t("tool.intake.dropHint")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground/80">
              PDF · DOCX · images · TXT/MD/RTF/CSV · MP3/WAV/M4A · MP4/MOV/WEBM · ZIP
            </p>
          </div>
        ) : (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-sm font-medium text-foreground">{count} {count !== 1 ? t("tool.intake.itemPlural") : t("tool.intake.itemSingular")} {t("tool.intake.staged")}</span>
              <button
                type="button"
                onClick={clearAll}
                disabled={isSubmitting}
                className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" /> {t("tool.intake.clearAll")}
              </button>
            </div>
            <ul className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-center gap-3 bg-card border border-border rounded-md px-3 py-2.5 text-sm group"
                >
                  {it.kind === "file" && iconForFile(it.file)}
                  {it.kind === "text" && <ClipboardType className="w-4 h-4 text-primary shrink-0" />}
                  {it.kind === "url" && <Link2 className="w-4 h-4 text-primary shrink-0" />}

                  <div className="min-w-0 flex-1">
                    {it.kind === "file" && (
                      <>
                        <p className="truncate text-foreground font-medium" title={it.file.name}>{it.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {bytesLabel(it.file.size)}
                          {it.file.type.startsWith("audio/") || it.file.type.startsWith("video/")
                            ? t("tool.intake.willTranscribe")
                            : it.file.type.startsWith("image/")
                              ? t("tool.intake.willOcr")
                              : ""}
                        </p>
                      </>
                    )}
                    {it.kind === "text" && (
                      <>
                        <p className="truncate text-foreground font-medium" title={it.label}>{it.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{it.content.slice(0, 120)}</p>
                      </>
                    )}
                    {it.kind === "url" && (
                      <>
                        <p className="truncate text-foreground font-medium" title={it.url}>{it.url}</p>
                        <p className="text-xs text-muted-foreground">{t("tool.intake.webLink")}</p>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    disabled={isSubmitting}
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    aria-label={t("tool.intake.remove")}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Submit */}
      {count > 0 && (
        <div className="mt-4 flex justify-end">
          <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
            {isSubmitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {t("tool.intake.processing")}</>
            ) : (
              <><FileText className="w-4 h-4" /> {mode === "append" ? t("tool.intake.addToMatter") : t("tool.intake.processMaterials")}</>
            )}
          </Button>
        </div>
      )}

      {/* Paste-text modal */}
      <Dialog open={textOpen} onOpenChange={setTextOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tool.intake.modal.pasteText")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder={t("tool.intake.modal.labelPlaceholder")}
              value={textLabel}
              onChange={(e) => setTextLabel(e.target.value)}
            />
            <Textarea
              placeholder={t("tool.intake.modal.bodyPlaceholder")}
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              rows={10}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTextOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={saveText} disabled={!textBody.trim()}>{t("tool.intake.modal.addNote")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add-link modal */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("tool.intake.modal.addLink")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="https://example.com/article-or-judgment"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveLink()}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              {t("tool.intake.modal.linkHint")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={saveLink} disabled={!linkUrl.trim()}>{t("tool.intake.modal.addLinkButton")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
