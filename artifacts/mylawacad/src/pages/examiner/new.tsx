import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Sparkles,
  Wand2,
  Save,
  Loader2,
  Trash2,
  CheckCircle2,
  Circle,
  Layers,
} from "lucide-react";
import {
  useListApps,
  useAiBlueprintExam,
  useAiSuggestRules,
  useCreateExamTemplate,
} from "@/lib/api-client";
import {
  CinematicShell,
  PageHeader,
  SpotlightCard,
  VioletButton,
  GoldButton,
  GhostButton,
} from "@/components/cinematic";
import { useAuth } from "@/lib/auth-context";

const QUESTION_TYPES = [
  { id: "multiple_choice", label: "Multiple Choice" },
  { id: "true_false", label: "True / False" },
  { id: "fill_blank", label: "Fill the Blank" },
  { id: "short_answer", label: "Short Answer" },
  { id: "scenario", label: "Scenario" },
  { id: "matching", label: "Matching" },
] as const;

type QuestionType = (typeof QUESTION_TYPES)[number]["id"];

const DEFAULT_ANTI_CHEAT = {
  lockFullscreen: true,
  blockCopyPaste: true,
  blockRightClick: true,
  blockShortcuts: true,
  detectDevtools: true,
  idleTimeoutSeconds: 120,
  maxTabSwitches: 3,
  autoFlagThreshold: 50,
};

export default function ExaminerNew() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const examiner = user?.name ?? "";

  const { data: apps } = useListApps();
  const aiBlueprint = useAiBlueprintExam();
  const aiRules = useAiSuggestRules();
  const createTpl = useCreateExamTemplate();

  // Form state
  const [aiPrompt, setAiPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [appSlugs, setAppSlugs] = useState<string[]>([]);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([
    "multiple_choice",
    "short_answer",
  ]);
  const [questionsPerApp, setQuestionsPerApp] = useState(3);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "medium",
  );
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30);
  const [rules, setRules] = useState(
    "1. Stay in fullscreen for the entire exam.\n2. Do not switch tabs or windows.\n3. Do not use external resources or AI assistants.\n4. The AI proctor logs every action.",
  );
  const [passThreshold, setPassThreshold] = useState(0.7);
  const [antiCheat, setAntiCheat] = useState(DEFAULT_ANTI_CHEAT);

  const [error, setError] = useState<string | null>(null);

  const totalQuestions = appSlugs.length * questionsPerApp;

  const toggleApp = (slug: string) => {
    setAppSlugs((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));
  };
  const toggleType = (t: QuestionType) => {
    setQuestionTypes((s) =>
      s.includes(t) ? s.filter((x) => x !== t) : [...s, t],
    );
  };

  const runBlueprint = async () => {
    if (!aiPrompt.trim()) return;
    setError(null);
    try {
      const bp = await aiBlueprint.mutateAsync({ data: { prompt: aiPrompt } });
      setTitle(bp.title);
      setDescription(bp.description);
      setAppSlugs(bp.appSlugs);
      setQuestionTypes(bp.questionTypes as QuestionType[]);
      setQuestionsPerApp(bp.questionsPerApp);
      setDifficulty(bp.difficulty);
      setTimeLimitMinutes(bp.timeLimitMinutes);
      setRules(bp.rules);
      setPassThreshold(bp.passThreshold);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI blueprint failed");
    }
  };

  const runSuggestRules = async () => {
    if (!title || appSlugs.length === 0) return;
    const appNames = (apps ?? [])
      .filter((a) => appSlugs.includes(a.slug))
      .map((a) => a.name);
    try {
      const r = await aiRules.mutateAsync({
        data: { title, appNames, difficulty, timeLimitMinutes },
      });
      setRules(r.rules);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI rules failed");
    }
  };

  const submit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Give the exam a title.");
      return;
    }
    if (appSlugs.length === 0) {
      setError("Pick at least one app to test.");
      return;
    }
    if (questionTypes.length === 0) {
      setError("Pick at least one question type.");
      return;
    }
    try {
      const tpl = await createTpl.mutateAsync({
        data: {
          title,
          description: description || null,
          examinerName: examiner,
          appSlugs,
          questionTypes,
          questionsPerApp,
          difficulty,
          timeLimitMinutes,
          rules,
          passThreshold,
          antiCheat,
        },
      });
      navigate(`/examiner/templates/${tpl.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create exam");
    }
  };

  return (
    <CinematicShell>
      <PageHeader
        eyebrow="New blueprint"
        title="Compose an exam"
        description="Describe what you want, and the AI lays it down. Then sharpen every dial."
      />

      <section className="container mx-auto px-6 pb-20 grid lg:grid-cols-[1.4fr_1fr] gap-8">
        <div className="space-y-6">
          <SpotlightCard className="!p-7">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="h-5 w-5 text-fuchsia-300" />
              <h2 className="font-display text-2xl font-bold">AI Blueprint Designer</h2>
            </div>
            <p className="text-muted-foreground text-sm mb-5">
              Type the assessment in plain English. The AI proposes a
              well-balanced exam — apps, question mix, time, difficulty and
              rules — fully editable below.
            </p>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              data-testid="textarea-ai-prompt"
              rows={3}
              placeholder="e.g. A 25-minute mid-level certification covering MyLitAI and ThinkTraceAI for new analysts; emphasise scenarios over MCQ."
              className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60"
            />
            <div className="flex justify-end mt-3">
              <VioletButton
                type="button"
                onClick={runBlueprint}
                disabled={!aiPrompt.trim() || aiBlueprint.isPending}
                data-testid="button-ai-blueprint"
              >
                {aiBlueprint.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Drafting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Draft blueprint
                  </>
                )}
              </VioletButton>
            </div>
          </SpotlightCard>

          <SpotlightCard className="!p-7 space-y-5">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-amber-300" />
              <h2 className="font-display text-2xl font-bold">Identity</h2>
            </div>
            <Field label="Title">
              <input
                value={title}
                data-testid="input-title"
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Q3 Compliance Knowledge Check"
                className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60"
              />
            </Field>
            <Field label="Description (optional, shown to candidate)">
              <textarea
                value={description}
                data-testid="textarea-description"
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60"
              />
            </Field>
          </SpotlightCard>

          <SpotlightCard className="!p-7 space-y-5">
            <h2 className="font-display text-2xl font-bold">Apps under test</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {apps?.map((a) => {
                const on = appSlugs.includes(a.slug);
                return (
                  <button
                    key={a.slug}
                    type="button"
                    data-testid={`toggle-app-${a.slug}`}
                    onClick={() => toggleApp(a.slug)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      on
                        ? "border-fuchsia-400/60 bg-fuchsia-500/10"
                        : "border-white/10 hover:border-white/25 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {on ? (
                        <CheckCircle2 className="h-4 w-4 text-fuchsia-300" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold">{a.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.tagline}
                    </div>
                  </button>
                );
              })}
            </div>
          </SpotlightCard>

          <SpotlightCard className="!p-7 space-y-5">
            <h2 className="font-display text-2xl font-bold">Question mix</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {QUESTION_TYPES.map((t) => {
                const on = questionTypes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`toggle-type-${t.id}`}
                    onClick={() => toggleType(t.id)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      on
                        ? "border-amber-400/60 bg-amber-500/10"
                        : "border-white/10 hover:border-white/25 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {on ? (
                        <CheckCircle2 className="h-4 w-4 text-amber-300" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold">{t.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <NumberField
                label="Questions per app"
                value={questionsPerApp}
                onChange={setQuestionsPerApp}
                min={1}
                max={20}
                testId="input-per-app"
              />
              <NumberField
                label="Time limit (min)"
                value={timeLimitMinutes}
                onChange={setTimeLimitMinutes}
                min={1}
                max={240}
                testId="input-time"
              />
              <Field label="Difficulty">
                <select
                  value={difficulty}
                  data-testid="select-difficulty"
                  onChange={(e) =>
                    setDifficulty(e.target.value as "easy" | "medium" | "hard")
                  }
                  className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </Field>
              <NumberField
                label="Pass threshold (%)"
                value={Math.round(passThreshold * 100)}
                onChange={(v) => setPassThreshold(v / 100)}
                min={0}
                max={100}
                testId="input-pass"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Total questions:{" "}
              <span className="text-white font-semibold tabular-nums">
                {totalQuestions}
              </span>
            </div>
          </SpotlightCard>

          <SpotlightCard className="!p-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">
                Rules shown before exam
              </h2>
              <GhostButton
                type="button"
                onClick={runSuggestRules}
                disabled={!title || appSlugs.length === 0 || aiRules.isPending}
                data-testid="button-ai-rules"
              >
                {aiRules.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Drafting…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> AI suggest
                  </>
                )}
              </GhostButton>
            </div>
            <textarea
              value={rules}
              data-testid="textarea-rules"
              onChange={(e) => setRules(e.target.value)}
              rows={6}
              className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60 font-mono text-sm"
            />
          </SpotlightCard>
        </div>

        <div className="space-y-6 lg:sticky lg:top-6 self-start">
          <SpotlightCard className="!p-7 space-y-4">
            <h2 className="font-display text-2xl font-bold">Anti-cheat dials</h2>
            <ToggleRow
              label="Lock fullscreen"
              value={antiCheat.lockFullscreen}
              onChange={(v) => setAntiCheat((a) => ({ ...a, lockFullscreen: v }))}
              testId="toggle-fs"
            />
            <ToggleRow
              label="Block copy / paste"
              value={antiCheat.blockCopyPaste}
              onChange={(v) => setAntiCheat((a) => ({ ...a, blockCopyPaste: v }))}
              testId="toggle-cp"
            />
            <ToggleRow
              label="Block right-click"
              value={antiCheat.blockRightClick}
              onChange={(v) => setAntiCheat((a) => ({ ...a, blockRightClick: v }))}
              testId="toggle-rc"
            />
            <ToggleRow
              label="Block dev shortcuts"
              value={antiCheat.blockShortcuts}
              onChange={(v) => setAntiCheat((a) => ({ ...a, blockShortcuts: v }))}
              testId="toggle-sc"
            />
            <ToggleRow
              label="Devtools detection"
              value={antiCheat.detectDevtools}
              onChange={(v) => setAntiCheat((a) => ({ ...a, detectDevtools: v }))}
              testId="toggle-dt"
            />
            <NumberField
              label="Idle timeout (s)"
              value={antiCheat.idleTimeoutSeconds}
              onChange={(v) =>
                setAntiCheat((a) => ({ ...a, idleTimeoutSeconds: v }))
              }
              min={30}
              max={600}
            />
            <NumberField
              label="Max tab switches before flag"
              value={antiCheat.maxTabSwitches}
              onChange={(v) =>
                setAntiCheat((a) => ({ ...a, maxTabSwitches: v }))
              }
              min={0}
              max={20}
            />
            <NumberField
              label="Trust-score auto-flag (≤)"
              value={antiCheat.autoFlagThreshold}
              onChange={(v) =>
                setAntiCheat((a) => ({ ...a, autoFlagThreshold: v }))
              }
              min={0}
              max={100}
            />
          </SpotlightCard>

          <SpotlightCard className="!p-7 space-y-4">
            <h2 className="font-display text-xl font-bold">Ready?</h2>
            <p className="text-sm text-muted-foreground">
              You'll get a unique 6-character code to share with candidates.
              They cannot change the exam — they can only join, read the rules,
              and perform.
            </p>
            {error ? (
              <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            ) : null}
            <div className="flex gap-3">
              <GoldButton
                type="button"
                onClick={submit}
                disabled={createTpl.isPending}
                data-testid="button-create-template"
              >
                {createTpl.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Publish exam
                  </>
                )}
              </GoldButton>
              <GhostButton
                type="button"
                onClick={() => navigate("/examiner/dashboard")}
              >
                <Trash2 className="h-4 w-4" /> Discard
              </GhostButton>
            </div>
          </SpotlightCard>
        </div>
      </section>
    </CinematicShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  testId,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  testId?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        data-testid={testId}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n))
            onChange(Math.min(max, Math.max(min, Math.round(n))));
        }}
        className="w-full bg-black/40 border border-white/15 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/60"
      />
    </Field>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      data-testid={testId}
      className="w-full flex items-center justify-between py-1.5"
    >
      <span className="text-sm">{label}</span>
      <motion.span
        layout
        className={`relative w-10 h-6 rounded-full transition-colors ${
          value ? "bg-fuchsia-500" : "bg-white/15"
        }`}
      >
        <motion.span
          layout
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow"
          animate={{ left: value ? "1.25rem" : "0.125rem" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </motion.span>
    </button>
  );
}
