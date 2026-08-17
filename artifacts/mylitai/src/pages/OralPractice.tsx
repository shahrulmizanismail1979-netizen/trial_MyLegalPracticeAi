import React, { useEffect, useRef, useState } from 'react';
import { emitRateLimit, readRateLimitRemaining } from '@/lib/rate-limit-bus';
import {
  Mic,
  MicOff,
  Send,
  Loader2,
  Gavel,
  UserCheck,
  Swords,
  Handshake,
  Volume2,
  Square,
  RotateCcw,
  BookmarkPlus,
  Check,
  ArrowLeft,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useSaveWork } from '@/hooks/use-saved-work';
import { usePersistentState } from '@/hooks/use-persistent-state';
import { SubscriptionGate } from '@/components/SubscriptionGate';

type Scenario =
  | 'oral_submission'
  | 'examination_in_chief'
  | 'cross_examination'
  | 'negotiation';

type PersonaRole = 'judge' | 'witness' | 'opposing_counsel';

interface Turn {
  speaker: 'you' | 'them';
  text: string;
}

const SCENARIOS: Record<
  Scenario,
  {
    label: string;
    role: PersonaRole;
    speakerLabel: string;
    icon: typeof Gavel;
    blurb: string;
    youAre: string;
    needsWitness: boolean;
  }
> = {
  oral_submission: {
    label: 'Oral Submission',
    role: 'judge',
    speakerLabel: 'The Court',
    icon: Gavel,
    blurb: 'Make oral submissions before a probing High Court judge who tests your authorities and propositions.',
    youAre: 'Counsel making submissions',
    needsWitness: false,
  },
  examination_in_chief: {
    label: 'Examination-in-Chief',
    role: 'witness',
    speakerLabel: 'Witness',
    icon: UserCheck,
    blurb: 'Lead your own witness through their evidence. The AI plays the witness answering your questions.',
    youAre: 'Counsel calling the witness',
    needsWitness: true,
  },
  cross_examination: {
    label: 'Cross-Examination',
    role: 'witness',
    speakerLabel: 'Witness',
    icon: Swords,
    blurb: 'Cross-examine a guarded, realistic witness. Make them concede — they will not give it up easily.',
    youAre: 'Cross-examining counsel',
    needsWitness: true,
  },
  negotiation: {
    label: 'Settlement Negotiation',
    role: 'opposing_counsel',
    speakerLabel: 'Opposing Counsel',
    icon: Handshake,
    blurb: 'Negotiate a settlement against firm opposing counsel advancing their client’s commercial interests.',
    youAre: 'Counsel for your client',
    needsWitness: false,
  },
};

async function streamRespond(
  body: Record<string, unknown>,
  onChunk: (t: string) => void,
  onError: (m: string) => void,
) {
  const res = await fetch('/api/lit/oral/respond', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 402) {
    onError('A subscription is required.');
    return;
  }
  if (res.status === 429) {
    emitRateLimit(0);
    onError('Too many AI requests. Please try again shortly.');
    return;
  }
  if (!res.ok) {
    onError('Server error.');
    return;
  }
  const rl = readRateLimitRemaining(res);
  if (rl !== null) emitRateLimit(rl);
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  if (!reader) {
    onError('No stream.');
    return;
  }
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const data = JSON.parse(line.slice(6));
        if (data.error) {
          onError(data.error);
          return;
        }
        if (data.done) return;
        if (data.content) onChunk(data.content);
      } catch {
        /* ignore */
      }
    }
  }
}

function OralPracticeInner() {
  const { toast } = useToast();
  const saveWork = useSaveWork();

  const [scenario, setScenario] = usePersistentState<Scenario | null>(
    'oral.scenario',
    null,
  );
  const [caseContext, setCaseContext] = usePersistentState<string>(
    'oral.caseContext',
    '',
  );
  const [userRole, setUserRole] = usePersistentState<string>('oral.userRole', '');
  const [witness, setWitness] = usePersistentState<string>('oral.witness', '');

  const [phase, setPhase] = useState<'setup' | 'live'>('setup');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // True only when the user explicitly presses the stop button. Web Speech
  // still fires `onend` after a stretch of silence even in continuous mode, so
  // we use this flag to auto-restart recognition (keep listening) unless the
  // user actually asked to stop.
  const manualStopRef = useRef(false);
  // Transcript captured from previous recognition sessions in this listening
  // run. Because a fresh recognition instance resets `e.results`, we prepend
  // this so an auto-restart after silence doesn't lose what was already said.
  const committedTranscriptRef = useRef('');

  const cfg = scenario ? SCENARIOS[scenario] : null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      manualStopRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeakingIdx(null);
  };

  const speak = async (text: string, turnIdx: number) => {
    if (!cfg) return;
    stopAudio();
    try {
      const res = await fetch('/api/lit/oral/tts', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, role: cfg.role, scenario }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      setSpeakingIdx(turnIdx);
      audio.onended = () => {
        setSpeakingIdx(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => setSpeakingIdx(null);
      await audio.play().catch(() => setSpeakingIdx(null));
    } catch {
      setSpeakingIdx(null);
    }
  };

  const toggleListening = () => {
    if (listening) {
      // Explicit stop: mark it so onend doesn't auto-restart, then stop.
      manualStopRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({
        title: 'Voice input unavailable',
        description: 'Your browser does not support speech recognition. Please type instead.',
        variant: 'destructive',
      });
      return;
    }

    // Start a fresh listening run: reset the manual-stop flag and seed the
    // committed transcript from whatever is already in the input box.
    manualStopRef.current = false;
    committedTranscriptRef.current = input;

    const buildRecogniser = () => {
      const rec = new SR();
      rec.lang = 'en-GB';
      rec.interimResults = true;
      // Continuous mode keeps the mic open through natural pauses instead of
      // cutting out after ~2-3s of silence. It stops only on manual stop.
      rec.continuous = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onresult = (e: any) => {
        let sessionText = '';
        for (let i = 0; i < e.results.length; i++) {
          sessionText += e.results[i][0].transcript;
        }
        const prefix = committedTranscriptRef.current;
        const joined = prefix && sessionText ? `${prefix} ${sessionText}` : prefix + sessionText;
        setInput(joined);
      };
      rec.onend = () => {
        // The browser ended recognition. If the user did not press stop (e.g.
        // it timed out on silence), commit what we have and restart so the mic
        // stays live until the user actually stops.
        if (manualStopRef.current) {
          setListening(false);
          return;
        }
        setInput((current) => {
          committedTranscriptRef.current = current;
          return current;
        });
        try {
          const next = buildRecogniser();
          next.start();
          recognitionRef.current = next;
        } catch {
          setListening(false);
        }
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rec.onerror = (e: any) => {
        // "no-speech"/"aborted" are benign silence timeouts — let onend restart.
        // Any other error (e.g. not-allowed) genuinely ends the session.
        if (e && (e.error === 'no-speech' || e.error === 'aborted')) return;
        manualStopRef.current = true;
        setListening(false);
      };
      return rec;
    };

    try {
      const rec = buildRecogniser();
      rec.start();
      recognitionRef.current = rec;
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const startSession = () => {
    if (!scenario) return;
    if (!caseContext.trim()) {
      toast({
        title: 'Add the matter facts',
        description: 'Give a short summary of the case so the role-play has context.',
        variant: 'destructive',
      });
      return;
    }
    setTurns([]);
    setInput('');
    setPhase('live');
  };

  const endSession = () => {
    stopAudio();
    // Also stop mic recognition so it doesn't keep running after the session ends
    manualStopRef.current = true;
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
    setPhase('setup');
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !scenario) return;
    if (listening) {
      manualStopRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
    }
    committedTranscriptRef.current = '';
    setInput('');
    const history = turns.map((t) => ({ speaker: t.speaker, text: t.text }));
    setTurns((prev) => [...prev, { speaker: 'you', text }, { speaker: 'them', text: '' }]);
    setBusy(true);
    let acc = '';
    const themIdx = turns.length + 1;
    try {
      await streamRespond(
        { scenario, caseContext, userRole, witness, history, userTurn: text },
        (chunk) => {
          acc += chunk;
          setTurns((prev) => {
            const copy = [...prev];
            copy[themIdx] = { speaker: 'them', text: acc };
            return copy;
          });
        },
        (msg) => {
          acc = acc || `⚠️ ${msg}`;
          setTurns((prev) => {
            const copy = [...prev];
            copy[themIdx] = { speaker: 'them', text: acc };
            return copy;
          });
        },
      );
      if (acc.trim() && !acc.startsWith('⚠️')) {
        speak(acc, themIdx);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!cfg || turns.length === 0) return;
    const transcript = turns
      .map((t) => `${t.speaker === 'you' ? 'YOU' : cfg.speakerLabel.toUpperCase()}: ${t.text}`)
      .join('\n\n');
    const content = `# Oral Advocacy — ${cfg.label}\n\n**Matter:** ${caseContext.trim()}\n\n---\n\n${transcript}`;
    try {
      await saveWork.mutateAsync({
        kind: 'oralpractice',
        title: `Oral Advocacy — ${cfg.label}`,
        matter: caseContext.trim().slice(0, 200) || null,
        content,
      });
      setSaved(true);
      toast({ title: 'Draft saved', description: 'Find this transcript under Saved Drafts on the Matters page.' });
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast({ title: 'Could not save', description: 'Please try again.', variant: 'destructive' });
    }
  };

  // ─── Setup screen ───────────────────────────────────────────────────────────
  if (phase === 'setup') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-foreground flex items-center gap-3">
            <Mic className="h-7 w-7 text-primary" />
            Oral Advocacy
          </h1>
          <p className="mt-2 text-muted-foreground">
            Practise live, voiced advocacy. The AI plays the judge, the witness, or
            opposing counsel — speak or type your turns and hear them respond.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          {(Object.keys(SCENARIOS) as Scenario[]).map((key) => {
            const s = SCENARIOS[key];
            const Icon = s.icon;
            const active = scenario === key;
            return (
              <button
                key={key}
                onClick={() => setScenario(key)}
                className={`text-left rounded-xl border p-5 transition-all ${
                  active
                    ? 'border-primary bg-primary/10 shadow-inner'
                    : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      active ? 'bg-primary/20' : 'bg-secondary'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <span className="font-semibold text-foreground">{s.label}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{s.blurb}</p>
              </button>
            );
          })}
        </div>

        {scenario && (
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <label className="text-sm font-semibold text-foreground">
                Matter facts <span className="text-primary">*</span>
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                A short summary of the case, the issue in dispute, and any key facts.
              </p>
              <Textarea
                value={caseContext}
                onChange={(e) => setCaseContext(e.target.value)}
                placeholder="e.g. Plaintiff bank claims RM2.4m under a facility agreement; defendant guarantor disputes the demand and pleads that the security was discharged…"
                className="min-h-[120px]"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-foreground">Your role</label>
                <p className="text-xs text-muted-foreground mb-2">Defaults to “{cfg?.youAre}”.</p>
                <Input
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  placeholder={cfg?.youAre}
                />
              </div>
              {cfg?.needsWitness && (
                <div>
                  <label className="text-sm font-semibold text-foreground">Witness profile</label>
                  <p className="text-xs text-muted-foreground mb-2">Who is the witness?</p>
                  <Input
                    value={witness}
                    onChange={(e) => setWitness(e.target.value)}
                    placeholder="e.g. Bank officer who handled the facility"
                  />
                </div>
              )}
            </div>

            <Button onClick={startSession} size="lg" className="gap-2">
              <Play className="h-4 w-4" />
              Begin session
            </Button>
          </div>
        )}
      </div>
    );
  }

  // ─── Live session ───────────────────────────────────────────────────────────
  const Icon = cfg!.icon;
  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-7rem)]">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={endSession} title="End session">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground truncate">{cfg!.label}</h2>
            <p className="text-xs text-muted-foreground truncate">
              You are {cfg!.label === 'Oral Submission' ? 'addressing' : 'facing'} {cfg!.speakerLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={saveWork.isPending || turns.length === 0}
            className="h-8 gap-1.5 text-xs"
          >
            {saved ? <Check className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
            {saved ? 'Saved' : 'Save Draft'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              stopAudio();
              setTurns([]);
            }}
            disabled={turns.length === 0}
            className="h-8 gap-1.5 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restart
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-5 space-y-4">
        {turns.length === 0 && (
          <div className="text-center text-muted-foreground text-sm mt-10">
            {cfg!.label === 'Oral Submission'
              ? 'Rise and begin your submission — “May it please the Court…”'
              : cfg!.label === 'Settlement Negotiation'
              ? 'Open the negotiation with your position.'
              : 'Put your first question to the witness.'}
          </div>
        )}
        {turns.map((turn, i) => {
          const isYou = turn.speaker === 'you';
          return (
            <div key={i} className={`flex ${isYou ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  isYou
                    ? 'bg-primary/15 border border-primary/25'
                    : 'bg-card border border-border'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[11px] uppercase tracking-wider font-semibold ${
                      isYou ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {isYou ? 'You' : cfg!.speakerLabel}
                  </span>
                  {!isYou && turn.text && (
                    <button
                      onClick={() => (speakingIdx === i ? stopAudio() : speak(turn.text, i))}
                      className="text-muted-foreground hover:text-primary transition-colors"
                      title={speakingIdx === i ? 'Stop' : 'Play voice'}
                    >
                      {speakingIdx === i ? (
                        <Square className="h-3.5 w-3.5" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {turn.text || (busy && i === turns.length - 1 ? '…' : '')}
                </p>
              </div>
            </div>
          );
        })}
        {busy && turns[turns.length - 1]?.text === '' && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3 bg-card border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-end gap-2">
          <Button
            variant={listening ? 'default' : 'outline'}
            size="icon"
            onClick={toggleListening}
            className={listening ? 'animate-pulse shrink-0' : 'shrink-0'}
            title={listening ? 'Stop listening' : 'Speak'}
          >
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={listening ? 'Listening… speak now' : 'Type or speak your turn…'}
            className="min-h-[48px] max-h-32 resize-none"
          />
          <Button onClick={send} disabled={busy || !input.trim()} size="icon" className="shrink-0">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          Practice simulation only — AI role-play for training, not legal advice. Press Enter to send, Shift+Enter for a new line.
        </p>
      </div>
    </div>
  );
}

export default function OralPractice() {
  return (
    <SubscriptionGate>
      <OralPracticeInner />
    </SubscriptionGate>
  );
}
