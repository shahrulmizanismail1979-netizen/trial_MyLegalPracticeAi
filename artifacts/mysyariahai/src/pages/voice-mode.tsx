import { aiStreamFetch } from "@/lib/ai-stream-fetch";
import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/language-context";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { consumeSse } from "@/lib/sse";
import { api } from "@/lib/api";
import { tierHasFeature } from "@/lib/tiers";
import { DraftDocument, DraftExportButtons } from "@workspace/draft-export/react";
import UpgradePrompt from "@/components/upgrade-prompt";

const API_BASE = "/api/sya";

type VoiceMode = "submission" | "examination_in_chief" | "cross_examination" | "judge_questioning";

interface ModeMeta {
  id: VoiceMode;
  titleEn: string;
  titleBm: string;
  aiRole: string;
  descEn: string;
  descBm: string;
}

interface Turn {
  role: "user" | "ai";
  text: string;
  ts: number;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function VoiceModePage() {
  const { mode: lang } = useLanguage();
  const { user } = useAuth();
  const t = (en: string, bm: string) => lang === "bm" ? bm : en;
  const speechLang = lang === "bm" ? "ms-MY" : "en-US";

  const canVoiceMode = tierHasFeature(user?.tier, "voiceMode");
  const canElevenLabs = tierHasFeature(user?.tier, "elevenLabs");
  const [useElevenLabs, setUseElevenLabs] = useState(canElevenLabs);
  const elAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [transcribing, setTranscribing] = useState(false);

  const [voiceMode, setVoiceMode] = useState<VoiceMode>("submission");
  const [scenario, setScenario] = useState("");
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [micPrompting, setMicPrompting] = useState(false);

  const recognitionRef = useRef<any>(null);
  const recognitionSessionRef = useRef(0);
  const startRequestRef = useRef(0);
  const errorRef = useRef("");
  const aiAbortRef = useRef<AbortController | null>(null);
  const feedbackAbortRef = useRef<AbortController | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const sttSupported = typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const { data: modes } = useQuery<ModeMeta[]>({
    queryKey: ["voice-modes"],
    queryFn: async () => {
      const r = await aiStreamFetch(`${API_BASE}/voice-mode/modes`, { credentials: "include" });
      return r.json();
    },
  });

  const currentMode = Array.isArray(modes) ? modes.find(m => m.id === voiceMode) : undefined;

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, interim]);

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) window.speechSynthesis.cancel();
    if (elAudioRef.current) {
      elAudioRef.current.pause();
      if (elAudioRef.current.src) URL.revokeObjectURL(elAudioRef.current.src);
      elAudioRef.current = null;
    }
    setSpeaking(false);
  }, [ttsSupported]);

  const speakBrowser = useCallback((text: string) => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = speechLang;
    utter.rate = 0.95;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  }, [ttsSupported, speechLang]);

  const speak = useCallback(async (text: string) => {
    if (!autoSpeak) return;
    // Premium: realistic ElevenLabs voice. Otherwise browser speech synthesis.
    if (useElevenLabs && canElevenLabs) {
      try {
        stopSpeaking();
        setSpeaking(true);
        const res = await api.voice.tts(text);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        elAudioRef.current = audio;
        audio.onended = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
          if (elAudioRef.current === audio) elAudioRef.current = null;
        };
        audio.onerror = () => {
          setSpeaking(false);
          URL.revokeObjectURL(url);
          if (elAudioRef.current === audio) elAudioRef.current = null;
        };
        await audio.play();
      } catch {
        // Fall back to browser voice if ElevenLabs fails.
        speakBrowser(text);
      }
      return;
    }
    speakBrowser(text);
  }, [autoSpeak, useElevenLabs, canElevenLabs, stopSpeaking, speakBrowser]);

  const callAi = useCallback(async (turns: Turn[]) => {
    setThinking(true);
    setError("");
    let aiText = "";
    setTranscript(prev => [...prev, { role: "ai", text: "", ts: Date.now() }]);
    aiAbortRef.current?.abort();
    const controller = new AbortController();
    aiAbortRef.current = controller;
    try {
      const res = await aiStreamFetch(`${API_BASE}/voice-mode/respond`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: voiceMode,
          scenario,
          language: lang === "bm" ? "bm" : "en",
          transcript: turns.map(({ role, text }) => ({ role, text })),
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      await consumeSse(res, {
        signal: controller.signal,
        onEvent: (d) => {
          if (typeof d.content === "string") {
            aiText += d.content;
            setTranscript(prev => {
              const copy = [...prev];
              if (copy.length > 0) {
                copy[copy.length - 1] = { ...copy[copy.length - 1], text: aiText };
              }
              return copy;
            });
          }
        },
        onError: (msg) => setError(msg),
      });
      if (aiText && !controller.signal.aborted) speak(aiText);
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message || "Failed");
    } finally {
      setThinking(false);
    }
  }, [voiceMode, scenario, lang, speak]);

  const submitUserText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const newTurn: Turn = { role: "user", text: trimmed, ts: Date.now() };
    const next = [...transcript, newTurn];
    setTranscript(next);
    setInterim("");
    callAi(next);
  }, [transcript, callAi]);

  const startListening = useCallback(async () => {
    if (!sttSupported) {
      const msg = t(
        "Speech recognition is not available in this browser. Please use Chrome or Edge, or type your turn below.",
        "Pengecaman suara tidak tersedia dalam pelayar ini. Sila gunakan Chrome atau Edge, atau taip giliran anda di bawah."
      );
      errorRef.current = msg;
      setError(msg);
      return;
    }
    errorRef.current = "";
    setError("");
    setNotice("");
    stopSpeaking();

    const requestId = ++startRequestRef.current;

    // Proactively request mic permission so the user gets a clear browser prompt
    // instead of silent failures when start() is called.
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      setMicPrompting(true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(tr => tr.stop());
        // If the user reset/navigated/started a newer request while we were
        // awaiting permission, abandon this start.
        if (requestId !== startRequestRef.current) {
          setMicPrompting(false);
          return;
        }
      } catch (err: any) {
        if (requestId !== startRequestRef.current) {
          setMicPrompting(false);
          return;
        }
        setMicPrompting(false);
        const name = err?.name || "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError(t(
            "Microphone access is blocked. Click the lock icon in your browser's address bar, allow microphone for this site, then press Start Speaking again. (You can also type your turn below.)",
            "Akses mikrofon disekat. Klik ikon kunci di bar alamat pelayar anda, benarkan mikrofon untuk laman ini, kemudian tekan Mula Bercakap sekali lagi. (Anda juga boleh menaip giliran di bawah.)"
          ));
        } else if (name === "NotFoundError") {
          setError(t(
            "No microphone was detected on this device. You can still type your turn below.",
            "Tiada mikrofon dikesan pada peranti ini. Anda masih boleh menaip giliran di bawah."
          ));
        } else {
          setError(t(
            `Could not access the microphone (${name || "unknown error"}). You can still type your turn below.`,
            `Tidak dapat mengakses mikrofon (${name || "ralat tidak diketahui"}). Anda masih boleh menaip giliran di bawah.`
          ));
        }
        return;
      }
      setMicPrompting(false);
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = speechLang;
    rec.continuous = true;
    rec.interimResults = true;
    const sessionId = ++recognitionSessionRef.current;
    let finalText = "";
    let cancelled = false;
    let gotAnyResult = false;
    (rec as any).__cancel = () => { cancelled = true; };
    rec.onresult = (event: any) => {
      if (cancelled || sessionId !== recognitionSessionRef.current) return;
      gotAnyResult = true;
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const r = event.results[i];
        if (r.isFinal) finalText += r[0].transcript + " ";
        else interimText += r[0].transcript;
      }
      setInterim((finalText + interimText).trim());
    };
    const setErrorMsg = (msg: string) => {
      errorRef.current = msg;
      setError(msg);
    };
    rec.onerror = (e: any) => {
      if (sessionId !== recognitionSessionRef.current) return;
      const code = e?.error;
      if (code === "not-allowed" || code === "service-not-allowed") {
        setErrorMsg(t(
          "Microphone access is blocked. Click the lock icon in your browser's address bar, allow microphone for this site, then press Start Speaking again.",
          "Akses mikrofon disekat. Klik ikon kunci di bar alamat pelayar anda, benarkan mikrofon untuk laman ini, kemudian tekan Mula Bercakap sekali lagi."
        ));
      } else if (code === "no-speech") {
        setNotice(t(
          "I didn't catch any speech. Try speaking closer to the mic, or type your turn below.",
          "Saya tidak mengesan apa-apa percakapan. Cuba bercakap lebih dekat dengan mikrofon, atau taip giliran anda di bawah."
        ));
      } else if (code === "audio-capture") {
        setErrorMsg(t(
          "No working microphone found. Check that your microphone is plugged in and not being used by another app.",
          "Tiada mikrofon yang berfungsi ditemui. Pastikan mikrofon anda dipasang dan tidak digunakan oleh aplikasi lain."
        ));
      } else if (code === "network") {
        setErrorMsg(t(
          "Speech recognition needs an internet connection. Please check your connection and try again.",
          "Pengecaman suara memerlukan sambungan internet. Sila semak sambungan anda dan cuba lagi."
        ));
      } else if (code !== "aborted") {
        setErrorMsg(t(
          `Speech recognition issue: ${code || "unknown"}. You can still type your turn below.`,
          `Masalah pengecaman suara: ${code || "tidak diketahui"}. Anda masih boleh menaip giliran di bawah.`
        ));
      }
      setListening(false);
    };
    rec.onend = () => {
      if (sessionId !== recognitionSessionRef.current) return;
      setListening(false);
      if (cancelled) {
        setInterim("");
        return;
      }
      if (finalText.trim()) {
        submitUserText(finalText);
      } else {
        setInterim("");
        // Use the ref so we always read the latest error state, not a stale closure
        if (!gotAnyResult && !errorRef.current) {
          setNotice(prev => prev || t(
            "I didn't catch any speech. Try again, or type your turn below.",
            "Saya tidak mengesan apa-apa percakapan. Cuba sekali lagi, atau taip giliran anda di bawah."
          ));
        }
      }
    };
    recognitionRef.current = rec;
    setListening(true);
    setInterim("");
    try {
      rec.start();
    } catch (e: any) {
      setListening(false);
      setErrorMsg(t(
        `Could not start the microphone: ${e?.message || "unknown error"}. Try refreshing the page, or type your turn below.`,
        `Tidak dapat memulakan mikrofon: ${e?.message || "ralat tidak diketahui"}. Cuba muat semula halaman, atau taip giliran anda di bawah.`
      ));
    }
  }, [sttSupported, speechLang, submitUserText, stopSpeaking, t]);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    try { rec.stop(); } catch {}
  }, []);

  const cancelListening = useCallback(() => {
    // Bump the start request id so any in-flight startListening abandons.
    startRequestRef.current++;
    setMicPrompting(false);
    const rec = recognitionRef.current;
    if (!rec) return;
    (rec as any).__cancel?.();
    recognitionSessionRef.current++;
    try { rec.abort?.() ?? rec.stop(); } catch {}
    recognitionRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const startRecording = useCallback(async () => {
    setError("");
    setNotice("");
    stopSpeaking();
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(t(
        "Audio recording is not available in this browser. Please type your turn below.",
        "Rakaman audio tidak tersedia dalam pelayar ini. Sila taip giliran anda di bawah.",
      ));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        mediaStreamRef.current = null;
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const buf = await blob.arrayBuffer();
          let binary = "";
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          const { text } = await api.voice.stt(base64, blob.type);
          if (text && text.trim()) {
            submitUserText(text);
          } else {
            setNotice(t(
              "I didn't catch any speech. Try again, or type your turn below.",
              "Saya tidak mengesan apa-apa percakapan. Cuba sekali lagi, atau taip giliran anda di bawah.",
            ));
          }
        } catch (e: any) {
          setError(t(
            `Could not transcribe audio: ${e?.message || "error"}. You can type your turn below.`,
            `Tidak dapat menyalin audio: ${e?.message || "ralat"}. Anda boleh menaip giliran anda di bawah.`,
          ));
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      setListening(true);
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(t(
          "Microphone access is blocked. Allow microphone for this site, then try again. (You can also type your turn below.)",
          "Akses mikrofon disekat. Benarkan mikrofon untuk laman ini, kemudian cuba lagi. (Anda juga boleh menaip giliran di bawah.)",
        ));
      } else {
        setError(t(
          `Could not access the microphone (${name || "error"}). You can type your turn below.`,
          `Tidak dapat mengakses mikrofon (${name || "ralat"}). Anda boleh menaip giliran di bawah.`,
        ));
      }
    }
  }, [stopSpeaking, submitUserText, t]);

  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch {}
    }
    mediaRecorderRef.current = null;
    setListening(false);
  }, []);

  const handleMicStart = useElevenLabs && canElevenLabs ? startRecording : startListening;
  const handleMicStop = useElevenLabs && canElevenLabs ? stopRecording : stopListening;

  const [textInput, setTextInput] = useState("");
  const handleTextSubmit = () => {
    if (textInput.trim()) {
      submitUserText(textInput);
      setTextInput("");
    }
  };

  const resetSession = useCallback(() => {
    cancelListening();
    stopSpeaking();
    aiAbortRef.current?.abort();
    feedbackAbortRef.current?.abort();
    setTranscript([]);
    setInterim("");
    setError("");
    setFeedback("");
    setFeedbackError("");
    setShowFeedback(false);
  }, [cancelListening, stopSpeaking]);

  const requestFeedback = useCallback(async () => {
    if (transcript.length < 2) return;
    setShowFeedback(true);
    setFeedback("");
    feedbackAbortRef.current?.abort();
    const controller = new AbortController();
    feedbackAbortRef.current = controller;
    let full = "";
    try {
      const res = await aiStreamFetch(`${API_BASE}/voice-mode/feedback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: voiceMode,
          language: lang === "bm" ? "bm" : "en",
          transcript: transcript.map(({ role, text }) => ({ role, text })),
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await consumeSse(res, {
        signal: controller.signal,
        onEvent: (d) => {
          if (typeof d.content === "string") {
            full += d.content;
            setFeedback(full);
          }
        },
        onError: (msg) => setFeedbackError(msg),
      });
    } catch (e: any) {
      if (e.name !== "AbortError") setFeedbackError(e.message || "Failed to generate feedback");
    }
  }, [transcript, voiceMode, lang]);

  useEffect(() => () => {
    stopSpeaking();
    aiAbortRef.current?.abort();
    feedbackAbortRef.current?.abort();
    recognitionSessionRef.current++;
    try { recognitionRef.current?.abort?.() ?? recognitionRef.current?.stop?.(); } catch {}
    try { mediaRecorderRef.current?.stop?.(); } catch {}
    mediaStreamRef.current?.getTracks().forEach((tr) => tr.stop());
  }, [stopSpeaking]);

  if (!canVoiceMode) {
    return (
      <UpgradePrompt
        requiredTier="professional"
        featureName="Voice Mode — Court Practice"
        featureNameBm="Mod Suara — Latihan Mahkamah"
      />
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="voice-mode-title">
          {t("Voice Mode — Court Practice", "Mod Suara — Latihan Mahkamah")}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t(
            "Two-way voice practice for oral submission and witness examination. Speak to the AI, and the AI responds in voice.",
            "Latihan suara dua hala untuk hujah lisan dan pemeriksaan saksi. Bercakap dengan AI, dan AI akan menjawab dalam suara."
          )}
        </p>
      </div>

      {(!sttSupported || !ttsSupported) && (
        <Card className="mb-4 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 text-sm text-amber-900 dark:text-amber-100">
            {!sttSupported && <p>{t("Your browser does not support speech recognition. Use the text input instead. (Chrome/Edge work best.)", "Pelayar anda tidak menyokong pengecaman suara. Gunakan input teks. (Chrome/Edge paling sesuai.)")}</p>}
            {!ttsSupported && <p>{t("Your browser does not support speech synthesis.", "Pelayar anda tidak menyokong sintesis suara.")}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader><h2 className="font-semibold">{t("Setup", "Persediaan")}</h2></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Practice Mode", "Mod Latihan")}</label>
              <Select value={voiceMode} onValueChange={v => { setVoiceMode(v as VoiceMode); resetSession(); }}>
                <SelectTrigger data-testid="voice-mode-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Array.isArray(modes) ? modes : []).map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {lang === "bm" ? m.titleBm : m.titleEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {currentMode && (
              <div className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-900/50 rounded">
                <p className="font-semibold mb-1">{t("AI plays:", "AI berperanan sebagai:")} {currentMode.aiRole}</p>
                <p>{lang === "bm" ? currentMode.descBm : currentMode.descEn}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1 block">{t("Case Scenario (optional)", "Senario Kes (opsyenal)")}</label>
              <Textarea
                value={scenario}
                onChange={e => setScenario(e.target.value)}
                placeholder={t(
                  "e.g. Hadhanah dispute — child aged 6, mother is non-Muslim revert claimant…",
                  "cth. Pertikaian hadhanah — anak berumur 6 tahun, ibu adalah saudara baru bukan Islam…"
                )}
                className="min-h-24"
                data-testid="voice-mode-scenario"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-speak"
                checked={autoSpeak}
                onChange={e => setAutoSpeak(e.target.checked)}
                className="rounded"
                data-testid="voice-mode-autospeak"
              />
              <label htmlFor="auto-speak" className="text-sm">{t("AI speaks responses aloud", "AI bercakap jawapan dengan kuat")}</label>
            </div>

            {canElevenLabs ? (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-elevenlabs"
                  checked={useElevenLabs}
                  onChange={e => setUseElevenLabs(e.target.checked)}
                  className="rounded"
                  data-testid="voice-mode-elevenlabs"
                />
                <label htmlFor="use-elevenlabs" className="text-sm">
                  {t("Realistic AI voice + transcription (ElevenLabs)", "Suara AI realistik + transkripsi (ElevenLabs)")}
                </label>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  "Upgrade to Premium for realistic ElevenLabs voices and accurate transcription.",
                  "Naik taraf ke Premium untuk suara ElevenLabs realistik dan transkripsi tepat.",
                )}
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={resetSession} data-testid="voice-mode-reset">
                {t("Reset Session", "Set Semula")}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={requestFeedback}
                disabled={transcript.length < 2}
                data-testid="voice-mode-feedback-btn"
              >
                {t("Get Feedback", "Dapatkan Maklum Balas")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 flex flex-col min-h-[600px]">
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="font-semibold">{t("Live Exchange", "Pertukaran Langsung")}</h2>
            <div className="flex gap-2">
              {speaking && <Badge className="bg-emerald-100 text-emerald-700">{t("AI speaking", "AI bercakap")}</Badge>}
              {thinking && <Badge className="bg-amber-100 text-amber-700">{t("AI thinking…", "AI berfikir…")}</Badge>}
              {listening && <Badge className="bg-rose-100 text-rose-700 animate-pulse">{t("Listening", "Mendengar")}</Badge>}
              {transcribing && <Badge className="bg-blue-100 text-blue-700 animate-pulse">{t("Transcribing…", "Menyalin…")}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col gap-3">
            <div className="flex-1 overflow-y-auto max-h-[400px] space-y-3 pr-2" data-testid="voice-mode-transcript">
              {transcript.length === 0 && (
                <p className="text-gray-400 italic text-sm">
                  {t(
                    "Press 'Start Speaking' to begin, or type a turn below. The AI will reply in character.",
                    "Tekan 'Mula Bercakap' untuk mula, atau taip giliran di bawah. AI akan menjawab dalam watak."
                  )}
                </p>
              )}
              {transcript.map((turn, i) => (
                <div key={i} className={`p-3 rounded-lg ${turn.role === "user" ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900" : "bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800"}`}>
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    {turn.role === "user" ? t("Counsel", "Peguam") : currentMode?.aiRole}
                  </p>
                  <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{turn.text || (thinking && i === transcript.length - 1 ? "…" : "")}</p>
                </div>
              ))}
              {listening && interim.trim().length > 0 && (
                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-dashed border-blue-300 dark:border-blue-800" aria-live="polite">
                  <p className="text-xs font-semibold text-gray-500 mb-1">{t("Counsel (live)", "Peguam (langsung)")}</p>
                  <p className="text-gray-700 dark:text-gray-200 italic">{interim}</p>
                </div>
              )}
              {listening && interim.trim().length === 0 && (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-dashed border-rose-300 dark:border-rose-800 text-sm text-rose-800 dark:text-rose-200" role="status" aria-live="polite">
                  {t(
                    "🎙️ Listening… speak clearly into your microphone. Press 'Stop & Send' when you're done.",
                    "🎙️ Mendengar… bercakap dengan jelas ke dalam mikrofon anda. Tekan 'Henti & Hantar' apabila selesai."
                  )}
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {error && (
              <div role="alert" aria-live="assertive" className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded p-2 flex items-start justify-between gap-2" data-testid="voice-mode-error">
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => { errorRef.current = ""; setError(""); }}
                  className="text-xs underline shrink-0"
                  aria-label={t("Dismiss", "Tutup")}
                >
                  {t("Dismiss", "Tutup")}
                </button>
              </div>
            )}
            {notice && !error && (
              <div role="status" aria-live="polite" className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded p-2 flex items-start justify-between gap-2" data-testid="voice-mode-notice">
                <span className="flex-1">{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice("")}
                  className="text-xs underline shrink-0"
                  aria-label={t("Dismiss", "Tutup")}
                >
                  {t("Dismiss", "Tutup")}
                </button>
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <div className="flex gap-2">
                {!listening ? (
                  <Button
                    onClick={handleMicStart}
                    disabled={(!useElevenLabs && !sttSupported) || thinking || micPrompting || transcribing}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-60"
                    data-testid="voice-mode-mic-start"
                  >
                    {micPrompting
                      ? t("Requesting microphone…", "Meminta mikrofon…")
                      : transcribing
                        ? t("Transcribing…", "Menyalin…")
                        : t("🎤 Start Speaking", "🎤 Mula Bercakap")}
                  </Button>
                ) : (
                  <Button
                    onClick={handleMicStop}
                    className="flex-1 bg-gray-700 hover:bg-gray-800 text-white animate-pulse"
                    data-testid="voice-mode-mic-stop"
                  >
                    {t("⏹ Stop & Send", "⏹ Henti & Hantar")}
                  </Button>
                )}
                {speaking && (
                  <Button variant="outline" onClick={stopSpeaking} data-testid="voice-mode-mute">
                    {t("Mute AI", "Senyapkan AI")}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={textInput}
                  onChange={e => setTextInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleTextSubmit(); }}
                  placeholder={t("…or type your turn (Ctrl/Cmd+Enter to send)", "…atau taip giliran anda (Ctrl/Cmd+Enter untuk hantar)")}
                  className="min-h-12 max-h-24"
                  data-testid="voice-mode-text-input"
                />
                <Button onClick={handleTextSubmit} disabled={!textInput.trim() || thinking} data-testid="voice-mode-text-send">
                  {t("Send", "Hantar")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showFeedback && (
        <Card className="mt-6">
          <CardHeader><h2 className="font-semibold">{t("Trainer Feedback", "Maklum Balas Jurulatih")}</h2></CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="voice-mode-feedback-output">
              {feedbackError && <p className="text-sm text-destructive">{feedbackError}</p>}
              {feedback ? <>{!feedbackError && <DraftExportButtons title={t("Trainer Feedback", "Maklum Balas Jurulatih")} content={feedback} hideMarkdown />}<DraftDocument content={feedback} /></> : !feedbackError ? t("Generating feedback…", "Menjana maklum balas…") : null}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
