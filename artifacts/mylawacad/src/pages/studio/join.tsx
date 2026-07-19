import { useState } from "react";
import { useLocation } from "wouter";
import { setAttemptTokenGetter } from "@/lib/api-client";
import { CinematicShell, SpotlightCard, GoldButton } from "@/components/cinematic-studio";
import {
  useGetStudioAssessmentByCode,
  useJoinStudioAssessment,
  useCreateStudioProposalByCode,
  getGetStudioAssessmentByCodeQueryKey,
} from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Lightbulb, Send, Check, KeyRound, Mic, PenTool, Award, Sparkles } from "lucide-react";
import { Tutorial } from "@/components/tutorial-studio";

export default function Join() {
  const [, setLocation] = useLocation();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topicsHint, setTopicsHint] = useState("");

  const [searchedCode, setSearchedCode] = useState("");

  const { data: assessment, isError } = useGetStudioAssessmentByCode(searchedCode, {
    query: {
      enabled: !!searchedCode,
      retry: false,
      queryKey: getGetStudioAssessmentByCodeQueryKey(searchedCode),
    },
  });

  const joinMutation = useJoinStudioAssessment();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      setSearchedCode(code.trim().toUpperCase());
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessment || !name.trim()) return;

    try {
      const attempt = await joinMutation.mutateAsync({
        code: searchedCode,
        data: {
          studentName: name,
          studentEmail: email || null,
          topicsHint: topicsHint.trim() || null,
        },
      });
      if (attempt.accessToken) {
        sessionStorage.setItem(`studio.attempt.${attempt.id}.token`, attempt.accessToken);
        setAttemptTokenGetter(() => attempt.accessToken ?? null);
      }
      setLocation(`/studio/attempt/${attempt.id}`);
    } catch (err) {
      console.error("Failed to join", err);
    }
  };

  return (
    <CinematicShell showHeader={false} showFooter={false}>
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">

        <div className="absolute inset-0 pointer-events-none grid-pattern opacity-30 mix-blend-overlay"></div>

        <div className="relative z-10 w-full max-w-md space-y-8">
          <div className="text-center space-y-3">
            <h1 className="font-display text-4xl font-bold text-gold">Exam Hall</h1>
            <p className="uppercase tracking-widest text-muted-foreground text-sm">Enter your access code</p>
          </div>

          <SpotlightCard className="p-8">
            {!assessment && (
              <form onSubmit={handleSearch} className="space-y-6">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Assessment Code</label>
                  <Input
                    placeholder="e.g. CS101-MIDTERM"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="bg-black/50 border-white/10 text-center text-2xl uppercase tracking-widest font-mono py-6"
                    maxLength={20}
                    data-testid="code-input"
                  />
                </div>
                {isError && (
                  <div className="text-red-400 text-sm text-center">Assessment not found or closed.</div>
                )}
                <GoldButton type="submit" className="w-full" disabled={!code.trim()}>
                  Verify Code
                </GoldButton>
              </form>
            )}

            {assessment && (
              <form onSubmit={handleJoin} className="space-y-6">
                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10 mb-6">
                  <div className="text-xs uppercase tracking-widest text-amber-500 mb-1">{assessment.code}</div>
                  <div className="font-display font-bold text-xl">{assessment.title}</div>
                  <div className="text-sm text-muted-foreground mt-2">{assessment.educatorName}</div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Full Name</label>
                    <Input
                      placeholder="Jane Doe"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="bg-black/50 border-white/10"
                      required
                      data-testid="name-input"
                    />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Email (Optional)</label>
                    <Input
                      type="email"
                      placeholder="jane@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="bg-black/50 border-white/10"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                      <Lightbulb className="w-3 h-3 text-amber-400" />
                      Topics you want to focus on (optional)
                    </label>
                    <textarea
                      placeholder="e.g. quantum entanglement, derivatives — the AI will weigh these in your feedback."
                      value={topicsHint}
                      onChange={e => setTopicsHint(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                      data-testid="topics-hint-input"
                    />
                  </div>
                </div>

                {joinMutation.isError && (
                  <div className="text-red-400 text-sm text-center">Failed to join assessment.</div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setSearchedCode(""); setCode(""); }}
                    className="px-4 py-2 rounded-xl text-sm border border-white/10 hover:bg-white/5 text-white/60"
                  >
                    Back
                  </button>
                  <GoldButton type="submit" className="flex-1" disabled={!name.trim() || joinMutation.isPending}>
                    {joinMutation.isPending ? "Preparing Exam..." : "Begin Assessment"}
                  </GoldButton>
                </div>
              </form>
            )}
          </SpotlightCard>

          {assessment && (
            <ProposeQuestion code={searchedCode} defaultName={name} defaultEmail={email} />
          )}
        </div>
      </div>

      <Tutorial
        storageKey="studio.tutorial.student.v1"
        title="Student Tour"
        buttonLabel="How it works"
        steps={[
          {
            title: "Enter your access code",
            icon: <KeyRound className="w-6 h-6" />,
            accentClass: "bg-purple-500/10 border-purple-500/30 text-purple-300",
            body: (
              <p>Your educator gave you a short code (e.g. <code className="px-1.5 py-0.5 rounded bg-white/10 text-amber-300">CS101-MIDTERM</code>). Type it above and tap <strong>Verify Code</strong>.</p>
            ),
          },
          {
            title: "Tell the AI what you want to focus on",
            icon: <Sparkles className="w-6 h-6" />,
            accentClass: "bg-amber-500/10 border-amber-500/30 text-amber-300",
            body: (
              <>
                <p>The optional <strong>topics-hint</strong> field is your superpower — type things you want the AI examiner to weigh more heavily in your feedback.</p>
                <p className="text-muted-foreground">Example: <em>"deep learning, gradient descent, chain rule"</em></p>
              </>
            ),
          },
          {
            title: "Answer in any modality",
            icon: <Mic className="w-6 h-6" />,
            accentClass: "bg-blue-500/10 border-blue-500/30 text-blue-300",
            body: (
              <>
                <p>Each question lets you choose: <strong>type</strong>, <strong>speak</strong> (voice dictation <Mic className="inline w-3.5 h-3.5" />), or <strong>handwrite</strong> with your finger or stylus (<PenTool className="inline w-3.5 h-3.5" />).</p>
                <p>Pick what feels natural per question. Your educator chose which modes are allowed.</p>
              </>
            ),
          },
          {
            title: "Cinematic proctoring is real",
            icon: <Lightbulb className="w-6 h-6" />,
            accentClass: "bg-rose-500/10 border-rose-500/30 text-rose-300",
            body: (
              <>
                <p>Depending on the assessment, the proctor may use your webcam, microphone, browser focus, and tab activity.</p>
                <p>Stay focused, keep your face visible, and avoid switching tabs. Suspicious activity is logged.</p>
              </>
            ),
          },
          {
            title: "Co-curate the next exam",
            icon: <Lightbulb className="w-6 h-6" />,
            accentClass: "bg-purple-500/10 border-purple-500/30 text-purple-300",
            body: (
              <>
                <p>After verifying the code, the <strong>"Suggest a question"</strong> card lets you propose questions for the educator to review.</p>
                <p>Accepted proposals become real questions — your fingerprint on the assessment.</p>
              </>
            ),
          },
          {
            title: "Earn XP and badges",
            icon: <Award className="w-6 h-6" />,
            accentClass: "bg-amber-500/10 border-amber-500/30 text-amber-300",
            body: (
              <>
                <p>Finishing earns XP. Score high to unlock <strong>Bronze</strong>, <strong>Silver</strong>, <strong>Gold</strong>, or <strong>Perfectionist</strong> badges.</p>
                <p>Your name appears on the per-assessment <strong>leaderboard</strong> at the end.</p>
              </>
            ),
          },
        ]}
      />
    </CinematicShell>
  );
}

function ProposeQuestion({
  code,
  defaultName,
  defaultEmail,
}: {
  code: string;
  defaultName: string;
  defaultEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [rationale, setRationale] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const proposeMutation = useCreateStudioProposalByCode();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || !defaultName.trim()) return;
    try {
      await proposeMutation.mutateAsync({
        code,
        data: {
          proposerName: defaultName,
          proposerEmail: defaultEmail || null,
          prompt: prompt.trim(),
          rationale: rationale.trim() || null,
          suggestedType: "short_answer",
          suggestedDifficulty: "medium",
        },
      });
      setPrompt("");
      setRationale("");
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 4000);
      setOpen(false);
    } catch (err) {
      console.error("propose failed", err);
    }
  };

  return (
    <SpotlightCard className="p-5 border-purple-500/20" data-testid="propose-card">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-200 text-sm font-semibold hover:bg-purple-500/20 transition-colors"
          data-testid="propose-toggle"
        >
          <Lightbulb className="w-4 h-4" />
          {submitted ? (
            <>
              <Check className="w-4 h-4 text-emerald-300" />
              Thanks — your educator will review it.
            </>
          ) : (
            "Suggest a question for this assessment"
          )}
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <div className="text-[0.65rem] uppercase tracking-[0.3em] text-purple-300/80 font-bold inline-flex items-center gap-1.5">
            <Lightbulb className="w-3 h-3" /> Co-curate this assessment
          </div>
          {!defaultName.trim() && (
            <p className="text-xs text-amber-300">Enter your name above first so the educator knows who proposed it.</p>
          )}
          <textarea
            placeholder="Type a question you'd love to see on this assessment…"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            rows={3}
            maxLength={2000}
            required
            className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"
            data-testid="propose-prompt"
          />
          <textarea
            placeholder="Why is this question interesting? (optional)"
            value={rationale}
            onChange={e => setRationale(e.target.value)}
            rows={2}
            maxLength={1000}
            className="w-full bg-black/50 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50"
            data-testid="propose-rationale"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 rounded-md text-xs border border-white/10 text-white/60 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!prompt.trim() || !defaultName.trim() || proposeMutation.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-bold bg-gradient-to-br from-purple-400 to-purple-600 text-white disabled:opacity-50"
              data-testid="propose-submit"
            >
              <Send className="w-3.5 h-3.5" />
              {proposeMutation.isPending ? "Sending…" : "Send proposal"}
            </button>
          </div>
        </form>
      )}
    </SpotlightCard>
  );
}
