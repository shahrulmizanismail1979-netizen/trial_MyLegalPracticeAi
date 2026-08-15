import { useState, useRef, useEffect, useCallback } from "react";
import { Users, Send, Loader2, RotateCcw, Bot, User, Settings2, Mic, MicOff, Volume2, VolumeX, Square } from "lucide-react";
import { DraftExportButtons } from "@workspace/draft-export/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownRenderer } from "@/components/ai/markdown-renderer";
import { useAiStream } from "@/lib/use-ai-stream";
import { useVoice } from "@/lib/use-voice";
import { useElevenVoice } from "@/lib/use-eleven-voice";
import { useEntitlements } from "@/lib/entitlements";
import { Sparkles } from "lucide-react";
import { SaveToMatterPanel } from "@/components/save-to-matter-panel";
import { MatterPicker, matterToCaseDetails } from "@/components/MatterPicker";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WITNESS_TYPES = [
  { value: "cooperative", label: "Cooperative Witness", desc: "Truthful, direct, helpful" },
  { value: "hostile", label: "Hostile Witness", desc: "Combative, argumentative, uncooperative" },
  { value: "evasive", label: "Evasive Witness", desc: "Vague, rambling, avoids direct answers" },
  { value: "nervous", label: "Nervous Witness", desc: "Anxious, stammering, easily intimidated" },
  { value: "expert", label: "Expert Witness", desc: "Technical, authoritative, defends methodology" },
  { value: "child", label: "Child Witness", desc: "Simple language, easily confused, emotional" },
  { value: "elderly", label: "Elderly Witness", desc: "Hard of hearing, selective memory, storyteller" },
  { value: "reluctant", label: "Reluctant Witness", desc: "Minimal answers, resentful, hiding something" },
  { value: "liar", label: "Lying Witness", desc: "Coached, inconsistent details, gets agitated when caught" },
  { value: "police-officer", label: "Police Officer / IO", desc: "Formal, procedural, defensive of investigation" },
  { value: "complainant", label: "Complainant / Victim", desc: "Emotional, invested, may exaggerate" },
];

const EXAMINATION_TYPES = [
  { value: "examination-in-chief", label: "Examination-in-Chief", desc: "Your witness — open-ended questions" },
  { value: "cross-examination", label: "Cross-Examination", desc: "Opposing witness — leading questions" },
  { value: "re-examination", label: "Re-Examination", desc: "Clarify after cross — limited scope" },
  { value: "hostile-witness", label: "Hostile Witness Examination", desc: "Your witness declared hostile by court" },
];

export function AiWitnessPracticePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [witnessType, setWitnessType] = useState("");
  const [examinationType, setExaminationType] = useState("");
  const [caseScenario, setCaseScenario] = useState("");
  const [witnessBackground, setWitnessBackground] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const voice = useVoice({ voiceLang: "en-GB", rate: 1.0 });
  const { hasVoice } = useEntitlements();
  const eleven = useElevenVoice({ role: "witness", persona: witnessType });

  const { response, isStreaming, error, stream, reset } = useAiStream({
    onComplete: (fullText) => {
      setMessages((prev) => [...prev, { role: "assistant", content: fullText }]);
      if (hasVoice) {
        eleven.speakIfEnabled(fullText);
      } else {
        voice.speak(fullText);
      }
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, response]);

  const handleStartSession = useCallback(async () => {
    if (!witnessType || !examinationType) return;
    setSessionStarted(true);
    const introMessage = `[Session started. You are the witness. I am the examining lawyer. The examination begins now.]`;
    const initialMessages = [{ role: "user" as const, content: introMessage }];
    setMessages(initialMessages);
    reset();
    await stream("/ai/witness-practice", {
      messages: initialMessages,
      witnessType,
      examinationType,
      caseScenario,
      witnessBackground,
    });
  }, [witnessType, examinationType, caseScenario, witnessBackground, stream, reset]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || isStreaming) return;

    const newMessages = [...messages, { role: "user" as const, content: msg }];
    setMessages(newMessages);
    setInput("");
    reset();

    await stream("/ai/witness-practice", {
      messages: newMessages,
      witnessType,
      examinationType,
      caseScenario,
      witnessBackground,
    });
  }, [input, messages, isStreaming, stream, reset, witnessType, examinationType, caseScenario, witnessBackground]);

  const handleReset = () => {
    setMessages([]);
    setSessionStarted(false);
    reset();
    eleven.stop();
    voice.stopSpeaking();
  };

  const selectedWitness = WITNESS_TYPES.find(w => w.value === witnessType);
  const selectedExam = EXAMINATION_TYPES.find(e => e.value === examinationType);

  const hasWitnessReply = messages.slice(1).some((m) => m.role === "assistant");
  const witnessTranscript = messages
    .slice(1)
    .map((m) => `${m.role === "user" ? "**Counsel:**" : "**Witness:**"}\n\n${m.content}`)
    .join("\n\n---\n\n");
  const witnessTranscriptTitle = `Witness Practice — ${selectedExam?.label ?? "Examination"} (${selectedWitness?.label ?? "Witness"})`;

  if (!sessionStarted) {
    return (
      <div className="space-y-6 pb-8">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-8 w-8 text-primary" />
            Witness Examination Practice
          </h1>
          <p className="text-muted-foreground">
            Practice your examination techniques with realistic AI mock witnesses — 11 personality types (cooperative, hostile, evasive, nervous, expert, child, elderly, reluctant, lying, police IO, complainant) across 4 examination modes. The witness reacts to your technique: good questioning is rewarded, poor technique is exposed.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" /> Session Setup
              </CardTitle>
              <CardDescription>Configure your practice session</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <MatterPicker
                onSelect={(matter) => setCaseScenario(matterToCaseDetails(matter))}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Examination Type</label>
                <Select value={examinationType} onValueChange={setExaminationType}>
                  <SelectTrigger className="bg-background/50" data-testid="select-examination-type">
                    <SelectValue placeholder="Select examination type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EXAMINATION_TYPES.map((et) => (
                      <SelectItem key={et.value} value={et.value}>
                        <div className="flex flex-col">
                          <span>{et.label}</span>
                          <span className="text-xs text-muted-foreground">{et.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Witness Character</label>
                <Select value={witnessType} onValueChange={setWitnessType}>
                  <SelectTrigger className="bg-background/50" data-testid="select-witness-type">
                    <SelectValue placeholder="Select witness character..." />
                  </SelectTrigger>
                  <SelectContent>
                    {WITNESS_TYPES.map((wt) => (
                      <SelectItem key={wt.value} value={wt.value}>
                        <div className="flex flex-col">
                          <span>{wt.label}</span>
                          <span className="text-xs text-muted-foreground">{wt.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Case Scenario (Optional)</label>
                <Textarea
                  value={caseScenario}
                  onChange={(e) => setCaseScenario(e.target.value)}
                  placeholder="e.g., Robbery at a convenience store on 15 March 2024 at 10pm. The witness was the cashier..."
                  className="min-h-[80px] bg-background/50 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Witness Background (Optional)</label>
                <Textarea
                  value={witnessBackground}
                  onChange={(e) => setWitnessBackground(e.target.value)}
                  placeholder="e.g., 35-year-old factory worker, lives near the scene, has known the accused for 5 years..."
                  className="min-h-[80px] bg-background/50 text-sm"
                />
              </div>

              <Button onClick={handleStartSession} disabled={!witnessType || !examinationType} className="w-full" size="lg" data-testid="button-start-witness-session">
                Start Practice Session
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-border/50 bg-card/30">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Witness Characters Available</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {WITNESS_TYPES.map((wt) => (
                    <Badge key={wt.value} variant="secondary" className="text-xs cursor-pointer hover:bg-primary/20" onClick={() => setWitnessType(wt.value)}>
                      {wt.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/30">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Practice Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>- In <strong>Examination-in-Chief</strong>, use open-ended questions. Avoid leading questions.</p>
                <p>- In <strong>Cross-Examination</strong>, use short, leading questions. Control the witness.</p>
                <p>- In <strong>Re-Examination</strong>, only address matters raised in cross-examination.</p>
                <p>- For <strong>Hostile Witnesses</strong>, confront with prior inconsistent statements (s.145 Evidence Act).</p>
                <p>- The AI witness will react realistically — good technique is rewarded, poor technique is punished.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <h1 className="font-serif text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Witness Examination
          </h1>
          <div className="flex gap-2">
            <Badge variant="outline">{selectedExam?.label}</Badge>
            <Badge variant="secondary">{selectedWitness?.label}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasVoice ? (
            <>
              <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                <Sparkles className="h-3 w-3" /> Realistic voice
              </Badge>
              {eleven.isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              <Button
                variant="outline"
                size="sm"
                onClick={eleven.isSpeaking ? eleven.stop : eleven.toggleEnabled}
                title={eleven.enabled ? "Mute realistic voice" : "Unmute realistic voice"}
                data-testid="button-witness-voice-toggle"
              >
                {eleven.isSpeaking ? <Square className="h-4 w-4" /> :
                  eleven.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </>
          ) : voice.supported.tts && (
            <>
              {voice.voices.length > 0 && (
                <Select value={voice.selectedVoiceURI} onValueChange={voice.setSelectedVoiceURI}>
                  <SelectTrigger className="h-9 w-[180px] text-xs" data-testid="select-witness-voice">
                    <SelectValue placeholder="Auto voice" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="">Auto (best match)</SelectItem>
                    {voice.voices.map((v) => (
                      <SelectItem key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={voice.isSpeaking ? voice.stopSpeaking : voice.toggleVoice}
                title={voice.voiceEnabled ? "Mute AI voice" : "Unmute AI voice"}
                data-testid="button-witness-voice-toggle"
              >
                {voice.isSpeaking ? <Square className="h-4 w-4" /> :
                  voice.voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" /> New Session
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto rounded-lg border border-border bg-card/30 p-4 space-y-4">
        {messages.map((msg, i) => {
          if (i === 0 && msg.role === "user") return null;
          return (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-amber-500" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-4 py-3 ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/30 border border-border/50"}`}>
                {msg.role === "user" ? <p>{msg.content}</p> : <MarkdownRenderer content={msg.content} />}
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
        {isStreaming && response && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-amber-500" />
            </div>
            <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted/30 border border-border/50">
              <MarkdownRenderer content={response} />
            </div>
          </div>
        )}
        {isStreaming && !response && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-amber-500" />
            </div>
            <div className="rounded-lg px-4 py-3 bg-muted/30 border border-border/50">
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
            </div>
          </div>
        )}
        {error && (
          <div className="text-center text-destructive text-sm p-3 bg-destructive/10 rounded-lg">{error}</div>
        )}
      </div>

      {!isStreaming && hasWitnessReply && (
        <div className="mt-4 space-y-3">
          <DraftExportButtons
            title={witnessTranscriptTitle}
            content={witnessTranscript}
          />
          <SaveToMatterPanel
            draftTitle={witnessTranscriptTitle}
            draftContent={witnessTranscript}
            kind="witness-practice"
            sourceLabel="Witness Examination Practice"
            inputJson={{ witnessType, examinationType, caseScenario, witnessBackground }}
          />
        </div>
      )}
      {voice.isListening && (
        <div className="text-xs text-amber-500 mt-2 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          Listening… {voice.interim && <em className="text-muted-foreground">"{voice.interim}"</em>}
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2 mt-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={voice.isListening ? "Listening… speak your question" : "Ask your question to the witness... (or use mic)"}
          className="flex-1 bg-background/50"
          disabled={isStreaming}
          data-testid="input-witness-question"
        />
        {voice.supported.stt && (
          <Button
            type="button"
            variant={voice.isListening ? "destructive" : "outline"}
            disabled={isStreaming}
            onClick={() => {
              if (voice.isListening) voice.stopListening();
              else voice.startListening((text) => setInput((cur) => (cur ? cur + " " : "") + text));
            }}
            title={voice.isListening ? "Stop listening" : "Speak your question"}
            data-testid="button-witness-mic"
          >
            {voice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <Button type="submit" disabled={isStreaming || !input.trim()} data-testid="button-send-witness">
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
