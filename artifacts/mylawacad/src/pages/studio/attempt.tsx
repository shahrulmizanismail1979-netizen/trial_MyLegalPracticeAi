import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { setAttemptTokenGetter } from "@/lib/api-client";
import { useRoute, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eraser,
  Flag,
  Mic,
  PenLine,
  Save,
  ScanLine,
  ShieldAlert,
  Square,
  Type as TypeIcon,
  User as UserIcon,
  Loader2,
  Maximize2,
} from "lucide-react";
import {
  useGetStudioAttempt,
  useSubmitStudioAnswer,
  useFinishStudioAttempt,
  useSubmitStudioProctorEvent,
  useSubmitStudioProctorSnapshot,
  useStudioTranscribeAudio,
  useStudioReadHandwriting,
  getGetStudioAttemptQueryKey,
} from "@/lib/api-client";
import type {
  StudioAnswer,
  StudioAnswerMode,
  StudioProctorEventBodySeverity,
  StudioQuestion,
} from "@/lib/api-client";
import { CinematicShell, SpotlightCard, GoldButton, GhostButton } from "@/components/cinematic-studio";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

type ProctorEventInput = {
  type: string;
  message: string;
  severity: StudioProctorEventBodySeverity;
};

function formatClock(seconds: number): string {
  if (seconds < 0 || !Number.isFinite(seconds)) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Attempt() {
  const [match, params] = useRoute<{ id: string }>("/studio/attempt/:id");
  const id = match ? params.id : "";
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  useEffect(() => {
    if (!id) return;
    const stored = sessionStorage.getItem(`studio.attempt.${id}.token`);
    if (stored) setAttemptTokenGetter(() => stored);
    return () => setAttemptTokenGetter(null);
  }, [id]);

  const { data: attempt, isLoading } = useGetStudioAttempt(id, {
    query: {
      enabled: !!id,
      refetchOnWindowFocus: false,
      queryKey: getGetStudioAttemptQueryKey(id),
    },
  });

  const submitAnswer = useSubmitStudioAnswer();
  const finishAttempt = useFinishStudioAttempt();
  const submitEvent = useSubmitStudioProctorEvent();
  const submitSnapshot = useSubmitStudioProctorSnapshot();
  const transcribe = useStudioTranscribeAudio();
  const recognise = useStudioReadHandwriting();

  // —— state ——
  const [currentIdx, setCurrentIdx] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [draftSelected, setDraftSelected] = useState<string[]>([]);
  const [draftMode, setDraftMode] = useState<StudioAnswerMode>("text");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [fsExited, setFsExited] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recognising, setRecognising] = useState(false);
  const [recordingMic, setRecordingMic] = useState(false);

  // —— refs ——
  const lastActivityRef = useRef<number>(Date.now());
  const idleFiredRef = useRef(false);
  const tabSwitchesRef = useRef(0);
  const finishedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const snapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [penSize, setPenSize] = useState(4);
  const recogObjRef = useRef<any | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const loudStartRef = useRef<number | null>(null);

  const assessment = attempt?.assessment;
  const questions = useMemo<StudioQuestion[]>(
    () => attempt?.questions ?? [],
    [attempt?.questions],
  );
  const answers = useMemo<StudioAnswer[]>(
    () => attempt?.answers ?? [],
    [attempt?.answers],
  );
  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;
  const answeredIds = useMemo(
    () => new Set(answers.map((a) => a.questionId)),
    [answers],
  );

  // Stable event-fire helper (doesn't depend on changing mutation object)
  const fireEvent = useCallback(
    (e: ProctorEventInput) => {
      if (!id) return;
      submitEvent.mutate({ id, data: e });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  // —— hydrate per-question draft when navigating ——
  useEffect(() => {
    if (!currentQuestion) return;
    const existing = answers.find((a) => a.questionId === currentQuestion.id);
    if (existing) {
      setDraftMode(existing.mode);
      setDraftText(existing.responseText ?? "");
      setDraftSelected(existing.selectedOptionIds ?? []);
    } else {
      const allowed = assessment?.allowedAnswerModes ?? ["text"];
      setDraftMode(
        currentQuestion.type === "multiple_choice" || currentQuestion.type === "true_false"
          ? "text"
          : (allowed[0] ?? "text"),
      );
      setDraftText("");
      setDraftSelected([]);
    }
  }, [currentQuestion?.id, answers, assessment?.allowedAnswerModes]);

  // —— countdown timer ——
  useEffect(() => {
    if (!attempt || !assessment) return;
    if (attempt.status !== "active") return;
    const startedAtMs = new Date(attempt.startedAt).getTime();
    const totalSec = (assessment.timeLimitMinutes ?? 0) * 60;
    if (totalSec <= 0) return;

    const tick = () => {
      if (paused) return;
      const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
      const left = totalSec - elapsed;
      setSecondsLeft(left);
      if (left <= 0 && !finishedRef.current) {
        finishedRef.current = true;
        finishAttempt.mutate(
          { id },
          {
            onSuccess: () => {
              toast("Time expired — attempt submitted");
              setLocation(`/studio/attempt/${id}/summary`);
            },
          },
        );
      }
    };
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, [attempt, assessment, paused, id, finishAttempt, setLocation]);

  // —— PROCTORING: fullscreen ——
  useEffect(() => {
    if (!assessment?.proctoring?.lockFullscreen || !attempt) return;
    const enter = () => {
      const el = document.documentElement as any;
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      }
    };
    enter();
    const onChange = () => {
      const inFs = !!document.fullscreenElement;
      setFsExited(!inFs);
      if (!inFs && !finishedRef.current) {
        fireEvent({
          type: "fullscreen-exit",
          message: "Exited fullscreen",
          severity: "warning",
        });
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
    };
  }, [assessment?.proctoring?.lockFullscreen, attempt, fireEvent]);

  // —— PROCTORING: copy/paste, contextmenu, shortcuts ——
  useEffect(() => {
    if (!assessment?.proctoring || !attempt) return;
    const cfg = assessment.proctoring;
    const handlers: Array<[string, EventListener]> = [];

    if (cfg.blockCopyPaste) {
      const fn = (ev: Event) => {
        ev.preventDefault();
        fireEvent({
          type: `clipboard-${ev.type}`,
          message: `Blocked ${ev.type}`,
          severity: "warning",
        });
      };
      ["copy", "cut", "paste"].forEach((evt) => {
        document.addEventListener(evt, fn);
        handlers.push([evt, fn]);
      });
    }

    if (cfg.blockRightClick) {
      const fn = (ev: Event) => {
        ev.preventDefault();
        fireEvent({
          type: "right-click",
          message: "Right-click blocked",
          severity: "warning",
        });
      };
      document.addEventListener("contextmenu", fn);
      handlers.push(["contextmenu", fn]);
    }

    if (cfg.blockShortcuts) {
      const fn = ((ev: KeyboardEvent) => {
        const key = ev.key.toLowerCase();
        const mod = ev.ctrlKey || ev.metaKey;
        const blocked =
          (mod && ["c", "v", "x", "s", "p", "u"].includes(key)) ||
          ev.key === "F12";
        if (blocked) {
          ev.preventDefault();
          fireEvent({
            type: "keyboard-shortcut",
            message: `Blocked ${ev.key}`,
            severity: "warning",
          });
        }
      }) as EventListener;
      document.addEventListener("keydown", fn);
      handlers.push(["keydown", fn]);
    }

    return () => {
      handlers.forEach(([evt, fn]) => document.removeEventListener(evt, fn));
    };
  }, [assessment?.proctoring, attempt, fireEvent]);

  // —— PROCTORING: devtools detection ——
  useEffect(() => {
    if (!assessment?.proctoring?.detectDevtools || !attempt) return;
    let firedRecently = false;
    const check = () => {
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      let open = widthDiff > 200 || heightDiff > 200;
      if (!open) {
        const t0 = Date.now();
        // eslint-disable-next-line no-debugger
        debugger;
        if (Date.now() - t0 > 100) open = true;
      }
      if (open && !firedRecently) {
        firedRecently = true;
        fireEvent({
          type: "devtools-open",
          message: "Developer tools appear to be open",
          severity: "critical",
        });
        window.setTimeout(() => (firedRecently = false), 10_000);
      }
    };
    const t = window.setInterval(check, 4000);
    return () => window.clearInterval(t);
  }, [assessment?.proctoring?.detectDevtools, attempt, fireEvent]);

  // —— PROCTORING: idle timeout ——
  useEffect(() => {
    if (!assessment?.proctoring || !attempt) return;
    const idleSec = assessment.proctoring.idleTimeoutSeconds ?? 0;
    if (idleSec <= 0) return;
    const bump = () => {
      lastActivityRef.current = Date.now();
      if (idleFiredRef.current) {
        idleFiredRef.current = false;
        setPaused(false);
      }
    };
    document.addEventListener("mousemove", bump);
    document.addEventListener("keydown", bump);
    document.addEventListener("touchstart", bump);
    const interval = window.setInterval(() => {
      const idleFor = (Date.now() - lastActivityRef.current) / 1000;
      if (idleFor > idleSec && !idleFiredRef.current) {
        idleFiredRef.current = true;
        setPaused(true);
        fireEvent({
          type: "idle-timeout",
          message: `Idle for ${Math.round(idleFor)}s — timer paused`,
          severity: "warning",
        });
      }
    }, 1000);
    return () => {
      document.removeEventListener("mousemove", bump);
      document.removeEventListener("keydown", bump);
      document.removeEventListener("touchstart", bump);
      window.clearInterval(interval);
    };
  }, [assessment?.proctoring, attempt, fireEvent]);

  // —— PROCTORING: tab switch detection ——
  useEffect(() => {
    if (!assessment?.proctoring || !attempt) return;
    const max = assessment.proctoring.maxTabSwitches ?? 0;
    const onVis = () => {
      if (document.hidden) {
        tabSwitchesRef.current += 1;
        const count = tabSwitchesRef.current;
        setTabSwitches(count);
        fireEvent({
          type: "tab-switch",
          message: `Tab switched away (${count})`,
          severity: max > 0 && count >= max ? "critical" : "warning",
        });
        if (max > 0 && count >= max && !finishedRef.current) {
          finishedRef.current = true;
          finishAttempt.mutate(
            { id },
            {
              onSuccess: () => {
                toast.error("Attempt auto-submitted: too many tab switches");
                setLocation(`/studio/attempt/${id}/summary`);
              },
            },
          );
        }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [assessment?.proctoring, attempt, id, finishAttempt, setLocation, fireEvent]);

  // —— PROCTORING: webcam snapshots ——
  useEffect(() => {
    if (!assessment?.proctoring?.webcamSnapshots || !attempt) return;
    let cancelled = false;
    let intervalId: number | undefined;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const intervalSec = Math.max(
          15,
          assessment.proctoring.webcamSnapshotIntervalSec ?? 60,
        );
        intervalId = window.setInterval(() => {
          const v = videoRef.current;
          const c = snapCanvasRef.current;
          if (!v || !c || v.videoWidth === 0) return;
          c.width = v.videoWidth;
          c.height = v.videoHeight;
          const ctx = c.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(v, 0, 0, c.width, c.height);
          const dataUrl = c.toDataURL("image/jpeg", 0.5);
          submitSnapshot.mutate({
            id,
            data: { imageDataUrl: dataUrl, capturedAt: new Date().toISOString() },
          });
        }, intervalSec * 1000);
      } catch (err) {
        fireEvent({
          type: "webcam-denied",
          message: "Webcam permission denied",
          severity: "critical",
        });
      }
    };
    start();
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((t) => t.stop());
        videoStreamRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment?.proctoring?.webcamSnapshots, attempt, id]);

  // —— PROCTORING: audio monitoring ——
  useEffect(() => {
    if (!assessment?.proctoring?.audioMonitoring || !attempt) return;
    let cancelled = false;
    let rafId: number | undefined;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        audioStreamRef.current = stream;
        const Ctx =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = new Ctx();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const buf = new Float32Array(analyser.fftSize);

        const sample = () => {
          analyser.getFloatTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i]! * buf[i]!;
          const rms = Math.sqrt(sum / buf.length);
          setAudioLevel(rms);
          if (rms > 0.3) {
            if (loudStartRef.current == null) loudStartRef.current = Date.now();
            else if (Date.now() - loudStartRef.current > 1000) {
              fireEvent({
                type: "loud-audio",
                message: "Loud audio detected",
                severity: "warning",
              });
              loudStartRef.current = Date.now() + 5000;
            }
          } else {
            loudStartRef.current = null;
          }
          rafId = window.setTimeout(sample, 250) as unknown as number;
        };
        sample();
      } catch {
        fireEvent({
          type: "audio-denied",
          message: "Microphone permission denied",
          severity: "critical",
        });
      }
    };
    start();
    return () => {
      cancelled = true;
      if (rafId) window.clearTimeout(rafId);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment?.proctoring?.audioMonitoring, attempt]);

  // —— Speech recognition (Speak tab) ——
  const startDictation = () => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (event: any) => {
        let finalText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          finalText += event.results[i][0].transcript;
        }
        if (finalText) {
          setDraftText((prev) => (prev ? `${prev} ${finalText}` : finalText));
        }
      };
      rec.onend = () => setRecordingMic(false);
      rec.onerror = () => setRecordingMic(false);
      rec.start();
      recogObjRef.current = rec;
      setRecordingMic(true);
      return;
    }
    // Fallback: MediaRecorder
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
        recordedChunksRef.current = [];
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        mr.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(recordedChunksRef.current, {
            type: "audio/webm",
          });
          const reader = new FileReader();
          reader.onloadend = () => {
            const url = reader.result as string;
            transcribe.mutate(
              {
                id,
                data: {
                  audioDataUrl: url,
                  questionId: currentQuestion?.id ?? null,
                },
              },
              {
                onSuccess: (res) => {
                  setDraftText((prev) =>
                    prev ? `${prev}\n${res.text}` : res.text,
                  );
                  toast.success("Audio transcribed");
                },
                onError: () => toast.error("Transcription failed"),
              },
            );
          };
          reader.readAsDataURL(blob);
        };
        mr.start();
        mediaRecorderRef.current = mr;
        setRecordingMic(true);
      })
      .catch(() => toast.error("Microphone unavailable"));
  };

  const stopDictation = () => {
    if (recogObjRef.current) {
      try {
        recogObjRef.current.stop();
      } catch {
        /* noop */
      }
      recogObjRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setRecordingMic(false);
  };

  // —— Handwriting canvas ——
  const getCanvasPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = drawCanvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * c.width) / r.width,
      y: ((e.clientY - r.top) * c.height) / r.height,
    };
  };
  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawingRef.current = true;
    lastPointRef.current = getCanvasPos(e);
    drawCanvasRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const c = drawCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const p = getCanvasPos(e);
    const last = lastPointRef.current ?? p;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = penSize;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
  };
  const onPointerUp = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };
  const clearCanvas = () => {
    const c = drawCanvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fefce8";
    ctx.fillRect(0, 0, c.width, c.height);
  };
  useEffect(() => {
    if (draftMode === "handwriting") clearCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion?.id, draftMode]);

  const recogniseHandwriting = () => {
    const c = drawCanvasRef.current;
    if (!c) return;
    const dataUrl = c.toDataURL("image/png");
    setRecognising(true);
    recognise.mutate(
      {
        id,
        data: { imageDataUrl: dataUrl, questionId: currentQuestion?.id ?? null },
      },
      {
        onSuccess: (res) => {
          setDraftText((prev) => (prev ? `${prev}\n${res.text}` : res.text));
          toast.success("Handwriting recognised");
        },
        onError: () => toast.error("Could not read handwriting"),
        onSettled: () => setRecognising(false),
      },
    );
  };

  // —— Save / Finish ——
  const persistDraft = (onDone?: () => void) => {
    if (!currentQuestion) return;
    const isChoice =
      currentQuestion.type === "multiple_choice" || currentQuestion.type === "true_false";
    const responseText = isChoice
      ? draftSelected.join(",")
      : draftText.trim();
    if (!responseText && (!isChoice || draftSelected.length === 0)) {
      toast.error("Provide an answer before saving");
      return;
    }
    submitAnswer.mutate(
      {
        id,
        data: {
          questionId: currentQuestion.id,
          mode: isChoice ? "text" : draftMode,
          responseText,
          selectedOptionIds: draftSelected,
        },
      },
      {
        onSuccess: () => {
          toast.success("Answer saved");
          qc.invalidateQueries({ queryKey: getGetStudioAttemptQueryKey(id) });
          onDone?.();
        },
        onError: () => toast.error("Could not save answer"),
      },
    );
  };

  const onFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    finishAttempt.mutate(
      { id },
      {
        onSuccess: () => {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
          setLocation(`/studio/attempt/${id}/summary`);
        },
        onError: () => {
          finishedRef.current = false;
          toast.error("Could not finish attempt");
        },
      },
    );
  };

  // —— render ——
  if (isLoading || !attempt || !assessment || !currentQuestion) {
    return (
      <CinematicShell showHeader={false} showFooter={false}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
        </div>
      </CinematicShell>
    );
  }

  if (attempt.status === "finished") {
    return (
      <CinematicShell showHeader={false} showFooter={false}>
        <div className="flex-1 flex items-center justify-center p-6">
          <SpotlightCard className="max-w-md w-full text-center p-10 space-y-4">
            <Check className="h-10 w-10 text-emerald-400 mx-auto" />
            <h2 className="font-display text-2xl text-gold">Attempt complete</h2>
            <p className="text-muted-foreground text-sm">
              You have already submitted this attempt.
            </p>
            <GoldButton onClick={() => setLocation(`/studio/attempt/${id}/summary`)}>
              View summary
            </GoldButton>
          </SpotlightCard>
        </div>
      </CinematicShell>
    );
  }

  const allowedModes: StudioAnswerMode[] = assessment.allowedAnswerModes ?? ["text"];
  const isChoice =
    currentQuestion.type === "multiple_choice" || currentQuestion.type === "true_false";
  const progressPct = totalQuestions > 0 ? ((currentIdx + 1) / totalQuestions) * 100 : 0;
  const proctoring = assessment.proctoring;

  return (
    <CinematicShell showHeader={false} showFooter={false}>
      {/* hidden capture surfaces */}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={snapCanvasRef} className="hidden" />

      {/* TOP BAR */}
      <div className="exam-top-bar sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b border-amber-500/20">
        <div className="container mx-auto px-3 sm:px-6 py-2 sm:py-3 [@media(max-height:400px)]:py-1 [@media(max-height:400px)]:gap-2 [@media(max-height:400px)]:flex-nowrap flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex-1 min-w-[140px]">
            <div className="text-[0.6rem] uppercase tracking-[0.4em] text-amber-400/80">
              {assessment.code}
            </div>
            <div className="font-display text-base sm:text-lg text-gold leading-tight truncate">
              {assessment.title}
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm">
            <UserIcon className="h-4 w-4 text-amber-400" />
            <span className="text-foreground/90">{attempt.studentName}</span>
          </div>
          <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10" data-testid="timer-badge">
            <Clock className="h-4 w-4 text-amber-300" />
            <span className="font-mono tabular-nums text-amber-200 text-sm">
              {secondsLeft == null ? "--:--" : formatClock(secondsLeft)}
            </span>
            {paused ? (
              <span className="text-[0.6rem] uppercase tracking-widest text-amber-400/80">
                paused
              </span>
            ) : null}
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <span>
              {currentIdx + 1} / {totalQuestions}
            </span>
            <Progress value={progressPct} className="w-24 sm:w-32 h-1.5" />
          </div>
          {/* Progress indicator visible on mobile */}
          <div className="flex sm:hidden items-center text-xs text-muted-foreground font-mono">
            {currentIdx + 1}/{totalQuestions}
          </div>
          <GoldButton
            onClick={onFinish}
            disabled={finishAttempt.isPending}
            className="!py-2 !px-3 sm:!px-4 text-xs sm:text-sm"
            data-testid="btn-finish-top"
          >
            {finishAttempt.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Flag className="h-3.5 w-3.5" />
            )}
            <span className="hidden xs:inline">Finish &amp; submit</span>
            <span className="xs:hidden">Submit</span>
          </GoldButton>
        </div>
        {tabSwitches > 0 ? (
          <div className="container mx-auto px-6 py-1.5 text-xs text-rose-300 flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5" />
            Tab switches detected: {tabSwitches}
            {proctoring.maxTabSwitches > 0 ? ` / ${proctoring.maxTabSwitches}` : null}
          </div>
        ) : null}
      </div>

      {/* MAIN GRID — extra bottom padding so fixed proctoring widgets don't obscure content */}
      <div className={cn(
        "container mx-auto px-3 sm:px-6 py-4 sm:py-6 flex-1 grid grid-cols-12 gap-4 sm:gap-6",
        (proctoring?.webcamSnapshots || proctoring?.audioMonitoring) && "pb-48 sm:pb-32",
      )}>
        {/* SIDEBAR */}
        <aside className="col-span-12 md:col-span-3">
          <SpotlightCard className="p-4">
            <div className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground mb-3">
              Question Navigator
            </div>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, i) => {
                const answered = answeredIds.has(q.id);
                const isCurrent = i === currentIdx;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIdx(i)}
                    className={cn(
                      "h-9 w-9 rounded-md text-xs font-mono font-bold flex items-center justify-center transition-all border",
                      isCurrent
                        ? "bg-amber-500 text-black border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]"
                        : answered
                          ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40"
                          : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm bg-amber-500" /> Current
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Answered
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-sm bg-white/30" /> Pending
              </div>
            </div>
          </SpotlightCard>
        </aside>

        {/* QUESTION PANE */}
        <section className="col-span-12 md:col-span-9 space-y-5" data-testid="question-pane">
          <SpotlightCard className="p-4 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="text-[0.6rem] uppercase tracking-[0.4em] text-amber-400/80">
                  Question {currentIdx + 1} · {currentQuestion.type.replace("_", " ")} · Level {currentQuestion.taxonomyLevel}
                </div>
                <h2 className="mt-2 font-display text-2xl md:text-3xl leading-tight text-foreground">
                  {currentQuestion.prompt}
                </h2>
              </div>
              <span className="px-3 py-1 rounded-full border border-amber-400/40 text-amber-200 text-xs uppercase tracking-[0.2em] whitespace-nowrap">
                {currentQuestion.points} pts
              </span>
            </div>

            {currentQuestion.context ? (
              <div className="p-4 rounded-xl border-l-4 border-amber-500/60 bg-white/[0.03] text-sm leading-relaxed whitespace-pre-wrap">
                {currentQuestion.context}
              </div>
            ) : null}

            {isChoice ? (
              <div className="space-y-2">
                {currentQuestion.options.map((opt) => {
                  const checked = draftSelected.includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors",
                        checked
                          ? "border-amber-400/60 bg-amber-500/10"
                          : "border-white/10 hover:bg-white/5",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setDraftSelected((s) => [...s, opt.id]);
                          } else {
                            setDraftSelected((s) => s.filter((x) => x !== opt.id));
                          }
                        }}
                        className="mt-1 accent-amber-500"
                      />
                      <span className="text-sm">{opt.text}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <Tabs
                value={draftMode}
                onValueChange={(v) => setDraftMode(v as StudioAnswerMode)}
              >
                <TabsList>
                  {allowedModes.includes("text") ? (
                    <TabsTrigger value="text">
                      <TypeIcon className="h-3.5 w-3.5 mr-2" /> Type
                    </TabsTrigger>
                  ) : null}
                  {allowedModes.includes("voice") ? (
                    <TabsTrigger value="voice">
                      <Mic className="h-3.5 w-3.5 mr-2" /> Speak
                    </TabsTrigger>
                  ) : null}
                  {allowedModes.includes("handwriting") ? (
                    <TabsTrigger value="handwriting">
                      <PenLine className="h-3.5 w-3.5 mr-2" /> Write
                    </TabsTrigger>
                  ) : null}
                </TabsList>

                {allowedModes.includes("text") ? (
                  <TabsContent value="text">
                    <Textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder="Compose your response..."
                      className="min-h-[220px] bg-black/40 border-white/10 font-mono text-sm"
                      data-testid="answer-textarea"
                    />
                  </TabsContent>
                ) : null}

                {allowedModes.includes("voice") ? (
                  <TabsContent value="voice" className="space-y-3">
                    <div className="flex items-center gap-3">
                      {!recordingMic ? (
                        <Button
                          type="button"
                          onClick={startDictation}
                          className="bg-amber-500 text-black hover:bg-amber-400"
                        >
                          <Mic className="h-4 w-4 mr-2" /> Start dictation
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={stopDictation}
                          variant="destructive"
                        >
                          <Square className="h-4 w-4 mr-2" /> Stop
                        </Button>
                      )}
                      {recordingMic ? (
                        <span className="flex items-center gap-2 text-xs uppercase tracking-widest text-rose-300">
                          <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                          Recording
                        </span>
                      ) : null}
                      {transcribe.isPending ? (
                        <span className="flex items-center gap-2 text-xs text-amber-300">
                          <Loader2 className="h-3 w-3 animate-spin" /> Transcribing…
                        </span>
                      ) : null}
                    </div>
                    <Textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder="Transcript will appear here — you can edit it."
                      className="min-h-[180px] bg-black/40 border-white/10 font-mono text-sm"
                    />
                  </TabsContent>
                ) : null}

                {allowedModes.includes("handwriting") ? (
                  <TabsContent value="handwriting" className="space-y-3">
                    {/* Toolbar: pen-size slider on first row, action buttons on second row on mobile */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase tracking-widest text-muted-foreground shrink-0">
                          Pen
                        </span>
                        <Slider
                          value={[penSize]}
                          min={1}
                          max={16}
                          step={1}
                          onValueChange={(v) => setPenSize(v[0] ?? 4)}
                          className="flex-1 sm:w-32 sm:flex-none"
                        />
                        <span className="font-mono text-xs text-amber-200 w-5 text-right shrink-0">
                          {penSize}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <GhostButton
                          type="button"
                          onClick={clearCanvas}
                          data-testid="btn-hw-clear"
                        >
                          <Eraser className="h-3.5 w-3.5" /> Clear
                        </GhostButton>
                        <Button
                          type="button"
                          onClick={recogniseHandwriting}
                          disabled={recognising}
                          className="bg-amber-500 text-black hover:bg-amber-400"
                          data-testid="btn-hw-recognise"
                        >
                          {recognising ? (
                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                          ) : (
                            <ScanLine className="h-3.5 w-3.5 mr-2" />
                          )}
                          Recognise
                        </Button>
                      </div>
                    </div>
                    <canvas
                      ref={drawCanvasRef}
                      width={800}
                      height={400}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerLeave={onPointerUp}
                      style={{ touchAction: "none" }}
                      className="w-full bg-yellow-50 rounded-xl border border-amber-200/40 shadow-inner cursor-crosshair"
                      data-testid="hw-canvas"
                    />
                    <Textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder="Recognised text appears here — edit if needed."
                      className="min-h-[120px] bg-black/40 border-white/10 font-mono text-sm"
                      data-testid="hw-textarea"
                    />
                  </TabsContent>
                ) : null}
              </Tabs>
            )}

            {/* FOOTER ACTIONS */}
            <div className="flex items-center justify-between pt-4 border-t border-white/10 flex-wrap gap-3" data-testid="footer-actions">
              <GhostButton
                type="button"
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Prev
              </GhostButton>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={() => persistDraft()}
                  disabled={submitAnswer.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  data-testid="btn-save-answer"
                >
                  {submitAnswer.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-2" />
                  )}
                  Save answer
                </Button>

                {currentIdx < totalQuestions - 1 ? (
                  <GhostButton
                    type="button"
                    onClick={() =>
                      setCurrentIdx((i) => Math.min(totalQuestions - 1, i + 1))
                    }
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </GhostButton>
                ) : (
                  <GoldButton
                    type="button"
                    onClick={onFinish}
                    disabled={finishAttempt.isPending}
                  >
                    {finishAttempt.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Flag className="h-3.5 w-3.5" />
                    )}
                    Finish & submit
                  </GoldButton>
                )}
              </div>
            </div>
          </SpotlightCard>
        </section>
      </div>

      {/* CORNER WIDGETS */}
      {proctoring.webcamSnapshots ? (
        <div data-testid="proctor-cam-widget" className="fixed right-4 z-40 w-40 rounded-lg overflow-hidden border border-amber-500/40 bg-black/80 shadow-xl" style={{ bottom: "calc(6rem + env(safe-area-inset-bottom, 0px))" }}>
          <div className="px-2 py-1 text-[0.55rem] uppercase tracking-widest text-amber-400/80 flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> Proctor cam
          </div>
          <video
            autoPlay
            muted
            playsInline
            ref={(el) => {
              if (el && videoStreamRef.current && !el.srcObject) {
                el.srcObject = videoStreamRef.current;
              }
            }}
            className="w-full h-24 object-cover"
          />
        </div>
      ) : null}

      {proctoring.audioMonitoring ? (
        <div data-testid="audio-monitor-bar" className="fixed left-4 z-40 w-40 rounded-lg border border-amber-500/40 bg-black/80 px-3 py-2 shadow-xl" style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
          <div className="text-[0.55rem] uppercase tracking-widest text-amber-400/80 flex items-center gap-1 mb-1">
            <Mic className="h-3 w-3" /> Audio
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn(
                "h-full transition-all",
                audioLevel > 0.3 ? "bg-rose-400" : "bg-emerald-400",
              )}
              style={{ width: `${Math.min(100, audioLevel * 300)}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* FULLSCREEN OVERLAY */}
      {fsExited && proctoring.lockFullscreen ? (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6">
          <SpotlightCard className="max-w-md w-full p-10 text-center space-y-5">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
            <h2 className="font-display text-2xl text-gold">Return to fullscreen</h2>
            <p className="text-sm text-muted-foreground">
              This assessment requires fullscreen mode. Exiting fullscreen has
              been logged. Please return immediately.
            </p>
            <GoldButton
              onClick={() => {
                (document.documentElement as any)
                  .requestFullscreen?.()
                  .then(() => setFsExited(false))
                  .catch(() => {});
              }}
            >
              <Maximize2 className="h-3.5 w-3.5" /> Re-enter fullscreen
            </GoldButton>
          </SpotlightCard>
        </div>
      ) : null}
    </CinematicShell>
  );
}
