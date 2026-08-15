import { useState, useRef, useEffect, useCallback } from "react";
import { Gavel, Send, Loader2, RotateCcw, Bot, User, Settings2, Mic, MicOff, Volume2, VolumeX, Square } from "lucide-react";
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

const JUDGE_TYPES = [
  { value: "strict-formal", label: "Strict & Formal", desc: "Demands procedure, precise citations, no-nonsense" },
  { value: "impatient", label: "Impatient", desc: "Rushes lawyers, interrupts, time-conscious" },
  { value: "inquisitive", label: "Inquisitive & Academic", desc: "Probing questions, loves legal discourse, Socratic" },
  { value: "sympathetic", label: "Sympathetic", desc: "Patient, understanding, guides struggling lawyers" },
  { value: "hostile-prosecution", label: "Pro-Prosecution Leaning", desc: "Skeptical of defense, challenges defense arguments" },
  { value: "hostile-defense", label: "Pro-Defense Leaning", desc: "Critical of prosecution, questions investigation" },
  { value: "appellate-panel", label: "Appellate Panel (3 Judges)", desc: "Multiple judges with different perspectives" },
  { value: "new-judge", label: "Newly Appointed Judge", desc: "Learning, uncertain, asks basic questions" },
  { value: "senior-judge", label: "Senior High Court Judge", desc: "Experienced, opinionated, tests knowledge" },
];

const PRACTICE_MODES = [
  { value: "bail-application", label: "Bail Application", desc: "Argue for/against bail" },
  { value: "trial-submission", label: "Trial Submission", desc: "Closing arguments at trial" },
  { value: "sentencing-mitigation", label: "Sentencing & Mitigation", desc: "Mitigation plea after conviction" },
  { value: "interlocutory-application", label: "Interlocutory Application", desc: "Pre-trial motions" },
  { value: "appeal-argument", label: "Appeal Argument", desc: "Argue an appeal before appellate court" },
  { value: "objection-ruling", label: "Evidential Objections", desc: "Argue admissibility of evidence" },
  { value: "general", label: "General Practice", desc: "Any type of submission or argument" },
];

export function AiJudgePracticePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [judgeType, setJudgeType] = useState("");
  const [practiceMode, setPracticeMode] = useState("");
  const [scenario, setScenario] = useState("");
  const [sessionStarted, setSessionStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const voice = useVoice({ voiceLang: "en-GB", rate: 0.95, pitch: 0.9 });
  const { hasVoice } = useEntitlements();
  const eleven = useElevenVoice({ role: "judge", persona: judgeType });

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
    if (!judgeType) return;
    setSessionStarted(true);
    const mode = PRACTICE_MODES.find(m => m.value === practiceMode);
    const introMessage = `[Session started. You are the judge. I am the lawyer appearing before you${mode ? ` for a ${mode.label}` : ""}. The court is in session.]`;
    const initialMessages = [{ role: "user" as const, content: introMessage }];
    setMessages(initialMessages);
    reset();
    await stream("/ai/judge-practice", {
      messages: initialMessages,
      judgeType,
      scenario,
      practiceMode: practiceMode || "general",
    });
  }, [judgeType, practiceMode, scenario, stream, reset]);

  const handleSend = useCallback(async () => {
    const msg = input.trim();
    if (!msg || isStreaming) return;

    const newMessages = [...messages, { role: "user" as const, content: msg }];
    setMessages(newMessages);
    setInput("");
    reset();

    await stream("/ai/judge-practice", {
      messages: newMessages,
      judgeType,
      scenario,
      practiceMode: practiceMode || "general",
    });
  }, [input, messages, isStreaming, stream, reset, judgeType, scenario, practiceMode]);

  const handleReset = () => {
    setMessages([]);
    setSessionStarted(false);
    reset();
    eleven.stop();
    voice.stopSpeaking();
  };

  const selectedJudge = JUDGE_TYPES.find(j => j.value === judgeType);
  const selectedMode = PRACTICE_MODES.find(m => m.value === practiceMode);

  const hasJudgeReply = messages.slice(1).some((m) => m.role === "assistant");
  const judgeTranscript = messages
    .slice(1)
    .map((m) => `${m.role === "user" ? "**Counsel:**" : "**Court:**"}\n\n${m.content}`)
    .join("\n\n---\n\n");
  const judgeTranscriptTitle = `Judge Practice — ${selectedMode?.label ?? "Submission"} (${selectedJudge?.label ?? "Judge"})`;

  if (!sessionStarted) {
    return (
      <div className="space-y-6 pb-8">
        <div className="space-y-1">
          <h1 className="font-serif text-3xl font-bold tracking-tight flex items-center gap-2">
            <Gavel className="h-8 w-8 text-primary" />
            Judge Response Practice
          </h1>
          <p className="text-muted-foreground">
            Practice your advocacy skills before 9 AI judge personalities — strict formal, impatient, inquisitive academic, sympathetic, pro-prosecution, pro-defence, appellate panel (3 judges), newly appointed, and senior High Court judge — across 7 courtroom scenarios including bail, trial submissions, mitigation, appeals, and evidential objections
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" /> Session Setup
              </CardTitle>
              <CardDescription>Configure your courtroom practice</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <MatterPicker
                onSelect={(matter) => setScenario(matterToCaseDetails(matter))}
              />

              <div className="space-y-2">
                <label className="text-sm font-medium">Judge Character</label>
                <Select value={judgeType} onValueChange={setJudgeType}>
                  <SelectTrigger className="bg-background/50" data-testid="select-judge-type">
                    <SelectValue placeholder="Select judge character..." />
                  </SelectTrigger>
                  <SelectContent>
                    {JUDGE_TYPES.map((jt) => (
                      <SelectItem key={jt.value} value={jt.value}>
                        <div className="flex flex-col">
                          <span>{jt.label}</span>
                          <span className="text-xs text-muted-foreground">{jt.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Practice Mode</label>
                <Select value={practiceMode} onValueChange={setPracticeMode}>
                  <SelectTrigger className="bg-background/50" data-testid="select-practice-mode">
                    <SelectValue placeholder="Select practice mode..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PRACTICE_MODES.map((pm) => (
                      <SelectItem key={pm.value} value={pm.value}>
                        <div className="flex flex-col">
                          <span>{pm.label}</span>
                          <span className="text-xs text-muted-foreground">{pm.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Case Scenario (Optional)</label>
                <Textarea
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  placeholder="e.g., Accused charged under s.302 Penal Code for murder. He is a 25-year-old first offender. The deceased was his neighbor..."
                  className="min-h-[100px] bg-background/50 text-sm"
                />
              </div>

              <Button onClick={handleStartSession} disabled={!judgeType} className="w-full" size="lg" data-testid="button-start-judge-session">
                Enter the Courtroom
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-border/50 bg-card/30">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Judge Characters Available</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {JUDGE_TYPES.map((jt) => (
                    <Badge key={jt.value} variant="secondary" className="text-xs cursor-pointer hover:bg-primary/20" onClick={() => setJudgeType(jt.value)}>
                      {jt.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/30">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Practice Scenarios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {PRACTICE_MODES.map((pm) => (
                    <Badge key={pm.value} variant="outline" className="text-xs cursor-pointer hover:bg-primary/20" onClick={() => setPracticeMode(pm.value)}>
                      {pm.label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card/30">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Advocacy Tips</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>- Always address the judge as <strong>"Yang Arif"</strong> (High Court) or <strong>"Tuan"</strong> (Sessions/Magistrate).</p>
                <p>- Structure submissions clearly: state the law, apply the facts, conclude.</p>
                <p>- When the judge asks a question, answer it directly before returning to your submission.</p>
                <p>- For bail applications, address flight risk, seriousness of offense, and accused's ties to community.</p>
                <p>- The AI judge will challenge your arguments — stay composed and respond professionally.</p>
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
            <Gavel className="h-6 w-6 text-primary" />
            Courtroom Session
          </h1>
          <div className="flex gap-2">
            <Badge variant="outline">{selectedJudge?.label}</Badge>
            {selectedMode && <Badge variant="secondary">{selectedMode.label}</Badge>}
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
                data-testid="button-judge-voice-toggle"
              >
                {eleven.isSpeaking ? <Square className="h-4 w-4" /> :
                  eleven.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
            </>
          ) : voice.supported.tts && (
            <>
              {voice.voices.length > 0 && (
                <Select value={voice.selectedVoiceURI} onValueChange={voice.setSelectedVoiceURI}>
                  <SelectTrigger className="h-9 w-[180px] text-xs" data-testid="select-judge-voice">
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
                data-testid="button-judge-voice-toggle"
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
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                  <Gavel className="h-4 w-4 text-rose-500" />
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
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
              <Gavel className="h-4 w-4 text-rose-500" />
            </div>
            <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted/30 border border-border/50">
              <MarkdownRenderer content={response} />
            </div>
          </div>
        )}
        {isStreaming && !response && (
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
              <Gavel className="h-4 w-4 text-rose-500" />
            </div>
            <div className="rounded-lg px-4 py-3 bg-muted/30 border border-border/50">
              <Loader2 className="h-5 w-5 animate-spin text-rose-500" />
            </div>
          </div>
        )}
        {error && (
          <div className="text-center text-destructive text-sm p-3 bg-destructive/10 rounded-lg">{error}</div>
        )}
      </div>

      {!isStreaming && hasJudgeReply && (
        <div className="mt-4 space-y-3">
          <DraftExportButtons
            title={judgeTranscriptTitle}
            content={judgeTranscript}
          />
          <SaveToMatterPanel
            draftTitle={judgeTranscriptTitle}
            draftContent={judgeTranscript}
            kind="judge-practice"
            sourceLabel="Judge Response Practice"
            inputJson={{ judgeType, practiceMode, scenario }}
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
          placeholder={voice.isListening ? "Listening… speak your submission" : "Make your submission to the court... (or use mic)"}
          className="flex-1 bg-background/50"
          disabled={isStreaming}
          data-testid="input-judge-submission"
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
            title={voice.isListening ? "Stop listening" : "Speak your submission"}
            data-testid="button-judge-mic"
          >
            {voice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <Button type="submit" disabled={isStreaming || !input.trim()} data-testid="button-send-judge">
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
