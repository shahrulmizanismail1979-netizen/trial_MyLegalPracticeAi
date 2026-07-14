import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Loader2,
  CircleAlert,
  Send,
  Volume2,
  RotateCcw,
  Play,
  Gavel,
  Scale,
  Swords,
  Handshake,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  runOralRespond,
  oralTts,
  type OralScenario,
  type OralTurn,
} from "@/lib/irac-api";

const selectCls =
  "flex h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--gold))]";

const SCENARIOS: {
  id: OralScenario;
  icon: React.ElementType;
  needsWitness: boolean;
}[] = [
  { id: "oral_submission", icon: Gavel, needsWitness: false },
  { id: "examination_in_chief", icon: Scale, needsWitness: true },
  { id: "cross_examination", icon: Swords, needsWitness: true },
  { id: "negotiation", icon: Handshake, needsWitness: false },
];

// Minimal typing for the (vendor-prefixed) Web Speech API.
type SpeechRec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function getSpeechRecognition(): SpeechRec | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export default function OralPractice() {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<"setup" | "live">("setup");
  const [scenario, setScenario] = useState<OralScenario>("oral_submission");
  const [caseContext, setCaseContext] = useState("");
  const [userRole, setUserRole] = useState("");
  const [witness, setWitness] = useState("");

  const [turns, setTurns] = useState<OralTurn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [ttsBusy, setTtsBusy] = useState<number | null>(null);

  const recRef = useRef<SpeechRec | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<{ cancel: () => void } | null>(null);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.src) {
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current.removeAttribute("src");
      }
    }
  };

  const meta = SCENARIOS.find((s) => s.id === scenario)!;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    return () => {
      recRef.current?.stop();
      streamRef.current?.cancel();
      stopAudio();
    };
  }, []);

  const speak = async (text: string, idx: number) => {
    setTtsBusy(idx);
    try {
      const blob = await oralTts(text, scenario);
      const url = URL.createObjectURL(blob);
      if (!audioRef.current) audioRef.current = new Audio();
      stopAudio();
      audioRef.current.src = url;
      await audioRef.current.play();
    } catch {
      /* voice is best-effort; the text turn is already shown */
    } finally {
      setTtsBusy(null);
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || streaming) return;
    setErr(null);
    const history = [...turns];
    const next = [...turns, { speaker: "me" as const, text }];
    setTurns([...next, { speaker: "them" as const, text: "" }]);
    setInput("");
    setStreaming(true);
    const themIdx = next.length;
    let acc = "";

    streamRef.current = runOralRespond(
      {
        scenario,
        caseContext,
        userRole,
        witness,
        history,
        userTurn: text,
      },
      {
        onContent: (c) => {
          acc += c;
          setTurns((prev) => {
            const copy = [...prev];
            copy[themIdx] = { speaker: "them", text: acc };
            return copy;
          });
        },
        onDone: () => {
          setStreaming(false);
          streamRef.current = null;
          if (acc.trim()) void speak(acc, themIdx);
        },
        onError: (m) => {
          setStreaming(false);
          streamRef.current = null;
          setErr(m);
          setTurns((prev) => prev.filter((_, i) => i !== themIdx || prev[i].text));
        },
      },
    );
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = getSpeechRecognition();
    if (!rec) {
      setErr(t("oral.noMic"));
      return;
    }
    rec.lang = "en-MY";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
      setInput(txt);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const reset = () => {
    recRef.current?.stop();
    streamRef.current?.cancel();
    streamRef.current = null;
    stopAudio();
    setStreaming(false);
    setListening(false);
    setTtsBusy(null);
    setTurns([]);
    setInput("");
    setErr(null);
    setPhase("setup");
  };

  if (phase === "setup") {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10 w-full">
        <div className="mb-8">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-gradient-gold">
            {t("oral.title")}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">{t("oral.desc")}</p>
          <div className="rule-gold mt-4" />
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <Label>{t("oral.scenario")}</Label>
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                {SCENARIOS.map((s) => {
                  const active = scenario === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setScenario(s.id)}
                      className={`flex items-center gap-2 px-3 py-3 rounded-md border text-sm text-left transition-colors ${
                        active
                          ? "border-[hsl(var(--gold-bright))] bg-[hsl(var(--gold)/0.08)] text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-[hsl(var(--gold)/0.4)]"
                      }`}
                    >
                      <s.icon className="h-4 w-4 shrink-0 text-primary" />
                      {t(`oral.sc.${s.id}`)}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t(`oral.scDesc.${scenario}`)}</p>
            </div>

            <div>
              <Label>{t("oral.caseContext")}</Label>
              <Textarea
                className="mt-1"
                rows={4}
                placeholder={t("oral.caseContextHint")}
                value={caseContext}
                onChange={(e) => setCaseContext(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("oral.userRole")}</Label>
              <Input
                className="mt-1"
                placeholder={t("oral.userRoleHint")}
                value={userRole}
                onChange={(e) => setUserRole(e.target.value)}
              />
            </div>
            {meta.needsWitness && (
              <div>
                <Label>{t("oral.witness")}</Label>
                <Input
                  className="mt-1"
                  placeholder={t("oral.witnessHint")}
                  value={witness}
                  onChange={(e) => setWitness(e.target.value)}
                />
              </div>
            )}

            <Button onClick={() => setPhase("live")} className="w-full gap-2">
              <Play className="h-4 w-4" /> {t("oral.start")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 w-full flex flex-col" style={{ minHeight: "70vh" }}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl font-bold text-gradient-gold">
            {t(`oral.sc.${scenario}`)}
          </h1>
          <p className="text-xs text-muted-foreground">{t("oral.liveHint")}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
          <RotateCcw className="h-4 w-4" /> {t("oral.restart")}
        </Button>
      </div>
      <div className="rule-gold mb-4" />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1"
        style={{ maxHeight: "55vh" }}
      >
        {turns.length === 0 && (
          <div className="text-center text-muted-foreground py-12 text-sm">
            {t("oral.openingPrompt")}
          </div>
        )}
        {turns.map((turn, i) => {
          const mine = turn.speaker === "me";
          return (
            <div key={i} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                  mine
                    ? "bg-[hsl(var(--gold)/0.12)] border border-[hsl(var(--gold)/0.3)] text-foreground"
                    : "bg-card border border-border text-foreground/90"
                }`}
              >
                {!mine && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {t(`oral.persona.${scenario}`)}
                    </span>
                    {turn.text && (
                      <button
                        onClick={() => speak(turn.text, i)}
                        disabled={ttsBusy !== null}
                        className="text-muted-foreground hover:text-foreground"
                        title={t("oral.replay")}
                      >
                        {ttsBusy === i ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {turn.text || (streaming && !mine ? "…" : "")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {err && (
        <div className="flex items-center gap-2 text-sm text-destructive mb-2">
          <CircleAlert className="h-4 w-4" />
          {err}
        </div>
      )}

      <div className="flex items-end gap-2">
        <Button
          variant={listening ? "default" : "outline"}
          size="icon"
          className="shrink-0 h-11 w-11"
          onClick={toggleMic}
          title={t("oral.mic")}
        >
          {listening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </Button>
        <Textarea
          className="flex-1 min-h-[44px] max-h-32"
          rows={1}
          placeholder={t("oral.inputHint")}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button onClick={send} disabled={streaming || !input.trim()} className="shrink-0 h-11 gap-2">
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t("oral.send")}
        </Button>
      </div>
    </div>
  );
}
