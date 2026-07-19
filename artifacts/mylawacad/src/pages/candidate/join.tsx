import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { KeyRound, Loader2, ShieldAlert, Eye, Trophy, Sparkles } from "lucide-react";
import { Tutorial } from "@/components/tutorial";
import {
  useGetExamTemplateByCode,
  useJoinExamByCode,
  getGetExamTemplateByCodeQueryKey,
  setAttemptTokenGetter,
} from "@/lib/api-client";
import {
  AuroraBackground,
  CinematicShell,
  GoldButton,
  GhostButton,
  FlickerBadge,
} from "@/components/cinematic";

export default function CandidateJoin() {
  const [, navigate] = useLocation();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const upper = code.toUpperCase().replace(/\s+/g, "").slice(0, 6);

  const preview = useGetExamTemplateByCode(upper, {
    query: {
      enabled: upper.length === 6,
      retry: false,
      queryKey: getGetExamTemplateByCodeQueryKey(upper),
    },
  });

  const join = useJoinExamByCode();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (upper.length !== 6) {
      setError("Enter the 6-character exam code.");
      return;
    }
    if (!name.trim()) {
      setError("Enter your name as it should appear on the leaderboard.");
      return;
    }
    try {
      const session = await join.mutateAsync({
        code: upper,
        data: { candidateName: name.trim() },
      });
      const accessToken = (session as { accessToken?: string }).accessToken;
      if (accessToken) {
        sessionStorage.setItem(`exam.session.${session.id}.token`, accessToken);
        setAttemptTokenGetter(() => accessToken);
      }
      navigate(`/exam/${session.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not join this exam");
    }
  };

  return (
    <CinematicShell>
      <section className="relative flex-1 flex items-center justify-center overflow-hidden">
        <AuroraBackground />
        <motion.form
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          onSubmit={submit}
          className="relative z-10 glass-strong rounded-3xl px-10 py-12 w-full max-w-xl space-y-7"
        >
          <FlickerBadge tone="warning">Sealed entry</FlickerBadge>
          <div className="space-y-2">
            <h1 className="font-display text-4xl font-bold leading-tight">
              Enter the <span className="text-aurora">arena</span>
            </h1>
            <p className="text-muted-foreground">
              Type the 6-character exam code your examiner shared. Then state
              your name. Once you proceed, the proctor armours up.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
              Exam code
            </span>
            <input
              autoFocus
              data-testid="input-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              className="w-full bg-black/40 border border-white/15 rounded-xl px-5 py-4 text-2xl font-mono uppercase tracking-[0.5em] text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            />
          </label>

          {preview.data ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-1"
            >
              <div className="text-[0.65rem] uppercase tracking-[0.3em] text-emerald-300">
                Exam found
              </div>
              <div className="font-display text-xl font-bold">
                {preview.data.title}
              </div>
              <div className="text-sm text-muted-foreground">
                {preview.data.totalQuestions} questions ·{" "}
                {preview.data.timeLimitMinutes} min ·{" "}
                <span className="capitalize">{preview.data.difficulty}</span> ·
                examined by {preview.data.examinerName}
              </div>
            </motion.div>
          ) : null}
          {preview.isError && upper.length === 6 ? (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              No exam matches that code, or it has been closed.
            </div>
          ) : null}

          <label className="block space-y-2">
            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
              Your name
            </span>
            <input
              data-testid="input-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="As it should appear on the leaderboard"
              className="w-full bg-black/40 border border-white/15 rounded-xl px-5 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60"
            />
          </label>

          {error ? (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          ) : null}

          <div className="flex gap-3">
            <GoldButton
              type="submit"
              disabled={join.isPending || !preview.data}
              data-testid="button-join"
            >
              {join.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Entering…
                </>
              ) : (
                <>
                  <KeyRound className="h-4 w-4" /> Enter exam
                </>
              )}
            </GoldButton>
            <GhostButton type="button" onClick={() => navigate("/")}>
              Back
            </GhostButton>
          </div>
        </motion.form>
      </section>

      <Tutorial
        storageKey="examhall.tutorial.candidate.v1"
        title="Candidate Tour"
        buttonLabel="How it works"
        steps={[
          {
            title: "You're entering the arena",
            icon: <Sparkles className="w-6 h-6" />,
            body: (
              <p>This is a cinematic, AI-proctored exam. Once you join, the proctor armours up — your camera, audio, and browser activity may all be watched depending on the exam settings.</p>
            ),
          },
          {
            title: "Your 6-character code",
            icon: <KeyRound className="w-6 h-6" />,
            accentClass: "bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300",
            body: (
              <>
                <p>Your examiner shared a 6-character code. Type it above. The arena will preview the exam (title, duration, sections) before you commit.</p>
                <p className="text-muted-foreground">Codes are case-insensitive.</p>
              </>
            ),
          },
          {
            title: "Use your real name",
            icon: <Trophy className="w-6 h-6" />,
            accentClass: "bg-amber-500/10 border-amber-500/30 text-amber-300",
            body: (
              <p>Whatever name you enter shows up on the global <strong>Leaderboard</strong> if you score well. Choose wisely.</p>
            ),
          },
          {
            title: "Stay in the arena",
            icon: <ShieldAlert className="w-6 h-6" />,
            accentClass: "bg-rose-500/10 border-rose-500/30 text-rose-300",
            body: (
              <>
                <p>The proctor uses fullscreen lock, copy/paste blocking, devtools detection, and tab-switch tracking. Each suspicious event drops your <strong>trust score</strong>.</p>
                <p className="text-muted-foreground">A low trust score is visible to your examiner.</p>
              </>
            ),
          },
          {
            title: "Answer with confidence",
            icon: <Eye className="w-6 h-6" />,
            accentClass: "bg-purple-500/10 border-purple-500/30 text-purple-300",
            body: (
              <>
                <p>Answer each question. The timer in the header counts down. Your answers auto-save.</p>
                <p>When you finish, AI grades immediately and your summary screen shows your score, percentile, and trust badge.</p>
              </>
            ),
          },
        ]}
      />
    </CinematicShell>
  );
}
