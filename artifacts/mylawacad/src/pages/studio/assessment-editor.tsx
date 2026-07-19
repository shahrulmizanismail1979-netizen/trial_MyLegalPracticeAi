import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Camera,
  Check,
  Copy,
  Eye,
  FileText,
  Flag,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  Plus,
  RefreshCcw,
  Save,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Telescope,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import {
  CinematicShell,
  GhostButton,
  GoldButton,
  SectionTitle,
  SpotlightCard,
  StudioBackground,
} from "@/components/cinematic-studio";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

import {
  useGetStudioAssessment,
  useUpdateStudioAssessment,
  useCreateStudioAssessment,
  useListStudioMaterials,
  useAddStudioMaterial,
  useDeleteStudioMaterial,
  useStudioResearch,
  useGetStudioTaxonomies,
  useSetStudioRubric,
  useGenerateStudioQuestions,
  useListStudioQuestions,
  useAddStudioQuestion,
  useUpdateStudioQuestion,
  useDeleteStudioQuestion,
  useListStudioAttemptsForAssessment,
  useGetStudioAttempt,
  useGetStudioInsights,
  useListStudioProctorEvents,
  useListStudioProctorSnapshots,
  useListStudioProposals,
  useReviewStudioProposal,
  getListStudioProposalsQueryKey,
  useRegradeStudioAttempt,
  useOverrideStudioAnswerScore,
  getGetStudioAssessmentQueryKey,
  getListStudioMaterialsQueryKey,
  getListStudioQuestionsQueryKey,
  getListStudioAssessmentsQueryKey,
  getListStudioAttemptsForAssessmentQueryKey,
  getGetStudioAttemptQueryKey,
  getGetStudioInsightsQueryKey,
  StudioQuestionType,
  StudioMaterialKind,
  StudioAnswerMode,
  StudioAssessmentStatus,
  StudioTaxonomyKind,
} from "@/lib/api-client";
import type {
  StudioAssessmentDetail,
  StudioRubric,
  StudioRubricCriterion,
  StudioQuestion,
  StudioQuestionOption,
  StudioMaterial,
  StudioProctoringConfig,
  StudioResearchSource,
  StudioAttempt,
  StudioAnswer,
  UpsertStudioQuestionRequest,
} from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

// --------------- Constants ---------------

const QUESTION_TYPES: { value: StudioQuestionType; label: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
  { value: "scenario", label: "Scenario" },
  { value: "essay", label: "Essay" },
];

const ANSWER_MODES: { value: StudioAnswerMode; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "voice", label: "Voice" },
  { value: "handwriting", label: "Handwriting" },
];

type StudioAssessmentFormatValue =
  | "exam"
  | "quiz"
  | "assignment"
  | "project"
  | "presentation"
  | "homework"
  | "practice";

const ASSESSMENT_FORMATS: {
  value: StudioAssessmentFormatValue;
  label: string;
  icon: string;
  description: string;
}[] = [
  { value: "exam", label: "Exam", icon: "🎓", description: "Cinematic, timed, fully proctored — final assessment grade." },
  { value: "quiz", label: "Quiz", icon: "⚡", description: "Short, low-stakes check for recall and quick feedback." },
  { value: "assignment", label: "Assignment", icon: "📝", description: "Take-home work over hours or days, light proctoring." },
  { value: "project", label: "Project", icon: "🛠", description: "Open-ended, multi-stage, manual rubric marking." },
  { value: "presentation", label: "Presentation", icon: "🎤", description: "Voice or handwriting capture, judged on delivery & rubric." },
  { value: "homework", label: "Homework", icon: "📚", description: "Daily practice, multiple attempts, no proctoring." },
  { value: "practice", label: "Practice", icon: "🌱", description: "Self-paced rehearsal — unlimited attempts." },
];

const DEFAULT_PROCTORING: StudioProctoringConfig = {
  lockFullscreen: true,
  blockCopyPaste: true,
  blockRightClick: true,
  blockShortcuts: true,
  detectDevtools: true,
  idleTimeoutSeconds: 120,
  maxTabSwitches: 3,
  autoFlagThreshold: 5,
  webcamSnapshots: true,
  webcamSnapshotIntervalSec: 30,
  faceDetection: true,
  audioMonitoring: false,
  screenRecording: false,
};

const DEFAULT_RUBRIC: StudioRubric = {
  taxonomy: "bloom",
  targetLevels: [2, 3],
  criteria: [],
  notes: null,
};

// --------------- Helpers ---------------

function genId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function statusClasses(status: string) {
  if (status === "open")
    return "border-emerald-500/30 text-emerald-300 bg-emerald-500/10";
  if (status === "draft")
    return "border-amber-500/30 text-amber-300 bg-amber-500/10";
  if (status === "closed")
    return "border-white/10 text-white/60 bg-white/5";
  return "border-white/10 text-white/60 bg-white/5";
}

function severityClasses(sev: string) {
  if (sev === "critical")
    return "border-red-500/40 text-red-300 bg-red-500/10";
  if (sev === "warning")
    return "border-amber-500/40 text-amber-300 bg-amber-500/10";
  return "border-sky-500/40 text-sky-300 bg-sky-500/10";
}

// --------------- Document parsing ---------------

async function parseTxt(file: File): Promise<string> {
  return await file.text();
}

async function parsePdf(file: File): Promise<string> {
  const pdfjs: any = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
    .default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const out: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const txt = tc.items
      .map((it: any) => (typeof it.str === "string" ? it.str : ""))
      .join(" ");
    out.push(txt);
  }
  return out.join("\n\n");
}

async function parseDocx(file: File): Promise<string> {
  const mammoth: any = (await import("mammoth")).default ?? (await import("mammoth"));
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value as string;
}

async function parsePptx(file: File): Promise<string> {
  const JSZipMod: any = (await import("jszip")).default ?? (await import("jszip"));
  const zip = await JSZipMod.loadAsync(await file.arrayBuffer());
  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort();
  const parser = new DOMParser();
  const out: string[] = [];
  for (const name of slideNames) {
    const xml = await zip.files[name].async("string");
    const doc = parser.parseFromString(xml, "application/xml");
    const nodes = doc.getElementsByTagName("a:t");
    const parts: string[] = [];
    for (let i = 0; i < nodes.length; i++) {
      parts.push(nodes[i].textContent ?? "");
    }
    out.push(parts.join(" "));
  }
  return out.join("\n\n");
}

async function parseFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt")) return parseTxt(file);
  if (name.endsWith(".pdf")) return parsePdf(file);
  if (name.endsWith(".docx")) return parseDocx(file);
  if (name.endsWith(".pptx")) return parsePptx(file);
  throw new Error("Unsupported file type. Use .pdf, .docx, .pptx, or .txt");
}

// =============================================================
//                     MAIN PAGE
// =============================================================

export default function AssessmentEditor() {
  const [matchEdit, params] = useRoute("/studio/assessments/:id");
  const routeId =
    matchEdit && params?.id && params.id !== "new" ? params.id : undefined;

  if (!routeId) return <CreateView />;
  return <EditView assessmentId={routeId} />;
}

// =============================================================
//                     CREATE VIEW
// =============================================================

function CreateView() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const create = useCreateStudioAssessment();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [rules, setRules] = useState(
    "Complete the assessment within the time limit. Do not switch tabs or use external resources unless permitted.",
  );
  const [timeLimit, setTimeLimit] = useState(60);
  const [pass, setPass] = useState(0.6);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    create.mutate(
      {
        data: {
          title: title.trim(),
          description: description.trim() || null,
          subject: subject.trim() || null,
          gradeLevel: gradeLevel.trim() || null,
          educatorName: user?.name ?? "Educator",
          timeLimitMinutes: timeLimit,
          passThreshold: pass,
          rules,
          rubric: DEFAULT_RUBRIC,
          allowedAnswerModes: ["text"],
          proctoring: DEFAULT_PROCTORING,
        },
      },
      {
        onSuccess: (created) => {
          qc.invalidateQueries({ queryKey: getListStudioAssessmentsQueryKey() });
          toast.success("Draft created");
          setLocation(`/studio/assessments/${created.id}`);
        },
        onError: (err: any) => {
          toast.error(err?.message ?? "Failed to create assessment");
        },
      },
    );
  };

  return (
    <CinematicShell>
      <StudioBackground />
      <div className="container mx-auto px-6 pt-12 pb-16 relative max-w-3xl">
        <div className="mb-10">
          <div className="text-[0.65rem] uppercase tracking-[0.4em] text-amber-500/80 font-bold">
            Studio · New Assessment
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold leading-[1.1] text-glow-gold text-gold mt-3">
            Compose Your Draft
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg leading-relaxed mt-3">
            Begin with the essentials. Once your draft is created, you can curate
            materials, design rubrics, generate questions, and configure proctoring.
          </p>
        </div>

        <SpotlightCard>
          <form onSubmit={submit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Title">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Linear Algebra · Midterm I"
                  data-testid="input-title"
                />
              </Field>
              <Field label="Subject">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Mathematics"
                />
              </Field>
              <Field label="Grade Level">
                <Input
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  placeholder="Undergraduate · Year 2"
                />
              </Field>
              <Field label="Time Limit (minutes)">
                <Input
                  type="number"
                  min={1}
                  max={480}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value) || 1)}
                />
              </Field>
            </div>

            <Field label="Description">
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief overview of the assessment scope and objectives."
              />
            </Field>

            <Field label="Rules / Instructions">
              <Textarea
                rows={4}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
              />
            </Field>

            <Field
              label={`Pass Threshold · ${Math.round(pass * 100)}%`}
            >
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={[pass]}
                onValueChange={(v) => setPass(v[0] ?? 0)}
              />
            </Field>

            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <Link
                href="/studio/dashboard"
                className="text-xs uppercase tracking-widest text-muted-foreground hover:text-white"
              >
                Cancel
              </Link>
              <GoldButton type="submit" disabled={create.isPending}>
                {create.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                Create Draft
              </GoldButton>
            </div>
          </form>
        </SpotlightCard>
      </div>
    </CinematicShell>
  );
}

// =============================================================
//                     EDIT VIEW
// =============================================================

const VALID_TABS = new Set([
  "basics",
  "materials",
  "research",
  "rubric",
  "questions",
  "proctoring",
  "attempts",
  "insights",
  "proposals",
]);

function readQueryParams(): { tab: string; attempt: string | null } {
  if (typeof window === "undefined") {
    return { tab: "basics", attempt: null };
  }
  const sp = new URLSearchParams(window.location.search);
  const t = sp.get("tab");
  return {
    tab: t && VALID_TABS.has(t) ? t : "basics",
    attempt: sp.get("attempt"),
  };
}

function EditView({ assessmentId }: { assessmentId: string }) {
  const { data, isLoading, isError } = useGetStudioAssessment(assessmentId);
  const initial = useMemo(() => readQueryParams(), []);

  return (
    <CinematicShell>
      <StudioBackground />
      <div className="container mx-auto px-6 pt-10 pb-16 relative">
        {isLoading ? (
          <div className="text-center py-24 text-muted-foreground uppercase tracking-widest text-sm">
            <Loader2 className="w-6 h-6 mx-auto animate-spin mb-4 text-amber-400" />
            Loading assessment…
          </div>
        ) : isError || !data ? (
          <div className="text-center py-24 text-red-400">
            <ShieldAlert className="w-8 h-8 mx-auto mb-3" />
            Assessment unavailable.
          </div>
        ) : (
          <EditorContent
            assessment={data}
            initialTab={initial.tab}
            initialAttemptId={initial.attempt}
          />
        )}
      </div>
    </CinematicShell>
  );
}

function EditorContent({
  assessment,
  initialTab,
  initialAttemptId,
}: {
  assessment: StudioAssessmentDetail;
  initialTab: string;
  initialAttemptId: string | null;
}) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="space-y-8">
      <Header assessment={assessment} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto justify-start gap-1 bg-black/40 border border-white/10 p-1.5 rounded-xl">
          <TabsTrigger value="basics" className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200">
            <FileText className="w-4 h-4" /> Basics
          </TabsTrigger>
          <TabsTrigger value="materials" className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200">
            <BookOpen className="w-4 h-4" /> Materials
          </TabsTrigger>
          <TabsTrigger value="research" className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200">
            <Telescope className="w-4 h-4" /> Research
          </TabsTrigger>
          <TabsTrigger value="rubric" className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200">
            <Layers className="w-4 h-4" /> Rubric
          </TabsTrigger>
          <TabsTrigger value="questions" className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200">
            <ListChecks className="w-4 h-4" /> Questions
          </TabsTrigger>
          <TabsTrigger value="proctoring" className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200">
            <ShieldAlert className="w-4 h-4" /> Proctoring
          </TabsTrigger>
          <TabsTrigger value="attempts" className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200">
            <Users className="w-4 h-4" /> Attempts
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200">
            <BarChart3 className="w-4 h-4" /> Insights
          </TabsTrigger>
          <TabsTrigger value="proposals" className="gap-2 data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-200" data-testid="tab-proposals">
            <Lightbulb className="w-4 h-4" /> Proposals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basics" className="mt-6">
          <BasicsTab assessment={assessment} />
        </TabsContent>
        <TabsContent value="materials" className="mt-6">
          <MaterialsTab assessmentId={assessment.id} />
        </TabsContent>
        <TabsContent value="research" className="mt-6">
          <ResearchTab assessmentId={assessment.id} />
        </TabsContent>
        <TabsContent value="rubric" className="mt-6">
          <RubricTab assessment={assessment} />
        </TabsContent>
        <TabsContent value="questions" className="mt-6">
          <QuestionsTab assessment={assessment} />
        </TabsContent>
        <TabsContent value="proctoring" className="mt-6">
          <ProctoringTab assessment={assessment} />
        </TabsContent>
        <TabsContent value="attempts" className="mt-6">
          <AttemptsTab
            assessmentId={assessment.id}
            initialOpenId={initialAttemptId}
          />
        </TabsContent>
        <TabsContent value="insights" className="mt-6">
          <InsightsTab assessmentId={assessment.id} />
        </TabsContent>
        <TabsContent value="proposals" className="mt-6">
          <ProposalsTab assessmentId={assessment.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProposalsTab({ assessmentId }: { assessmentId: string }) {
  const queryClient = useQueryClient();
  const { data: proposals, isLoading } = useListStudioProposals(assessmentId, {
    query: { queryKey: getListStudioProposalsQueryKey(assessmentId) },
  });
  const reviewMutation = useReviewStudioProposal();

  const review = async (id: string, action: "accept" | "reject") => {
    try {
      await reviewMutation.mutateAsync({
        id,
        data: { action, taxonomyLevel: 2, points: 1 },
      });
      await queryClient.invalidateQueries({
        queryKey: getListStudioProposalsQueryKey(assessmentId),
      });
      if (action === "accept") {
        toast.success("Proposal accepted — question added.");
      } else {
        toast.success("Proposal rejected.");
      }
    } catch (err) {
      toast.error("Could not review proposal");
    }
  };

  if (isLoading) {
    return (
      <SpotlightCard className="p-12 text-center text-muted-foreground uppercase tracking-widest text-sm">
        Loading proposals…
      </SpotlightCard>
    );
  }

  if (!proposals || proposals.length === 0) {
    return (
      <SpotlightCard className="p-12 text-center">
        <Lightbulb className="w-10 h-10 text-purple-400 mx-auto mb-3" />
        <h3 className="font-display text-xl text-gold mb-2">No student proposals yet</h3>
        <p className="text-muted-foreground text-sm">
          When students suggest questions from the join page, they appear here for you to accept or reject.
        </p>
      </SpotlightCard>
    );
  }

  const pending = proposals.filter((p) => p.status === "pending");
  const reviewed = proposals.filter((p) => p.status !== "pending");

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <div className="space-y-3">
          <div className="text-[0.65rem] uppercase tracking-[0.3em] text-amber-400/80 font-bold">
            {pending.length} awaiting review
          </div>
          {pending.map((p) => (
            <SpotlightCard key={p.id} className="p-6 border-purple-500/20" data-testid={`proposal-${p.id}`}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[0.65rem] uppercase tracking-widest text-purple-300/80 font-bold mb-1">
                    Proposed by {p.proposerName}
                    {p.proposerEmail ? ` · ${p.proposerEmail}` : ""}
                  </div>
                  <div className="font-display text-base text-foreground">{p.prompt}</div>
                  {p.rationale && (
                    <div className="text-sm text-muted-foreground italic mt-2 border-l-2 border-purple-500/30 pl-3">
                      {p.rationale}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => review(p.id, "accept")}
                    disabled={reviewMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-gradient-to-br from-emerald-400 to-emerald-600 text-white disabled:opacity-50"
                    data-testid={`accept-${p.id}`}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => review(p.id, "reject")}
                    disabled={reviewMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                    data-testid={`reject-${p.id}`}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </SpotlightCard>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="space-y-3">
          <div className="text-[0.65rem] uppercase tracking-[0.3em] text-muted-foreground font-bold">
            {reviewed.length} reviewed
          </div>
          {reviewed.map((p) => (
            <div
              key={p.id}
              className="flex items-start justify-between gap-3 p-4 rounded-lg border border-white/5 bg-white/[0.02]"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs text-muted-foreground">{p.proposerName}</div>
                <div className="text-sm text-foreground/80 truncate">{p.prompt}</div>
              </div>
              <span
                className={
                  p.status === "accepted"
                    ? "inline-flex items-center px-2.5 py-1 rounded-full text-[0.65rem] uppercase tracking-widest font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                    : "inline-flex items-center px-2.5 py-1 rounded-full text-[0.65rem] uppercase tracking-widest font-bold bg-red-500/10 text-red-300 border border-red-500/30"
                }
              >
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================
//                     HEADER
// =============================================================

function Header({ assessment }: { assessment: StudioAssessmentDetail }) {
  const copyJoinLink = async () => {
    try {
      const url = `${window.location.origin}/studio/join?code=${assessment.code}`;
      await navigator.clipboard.writeText(url);
      toast.success("Join link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-br from-black/80 via-black/60 to-amber-950/20 p-8">
      <div className="flex flex-col lg:flex-row gap-8 items-start justify-between">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="text-[0.65rem] uppercase tracking-[0.4em] text-amber-500/80 font-bold">
            Studio · Authoring
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-[1.1] text-glow-gold text-gold">
            {assessment.title}
          </h1>
          {assessment.description ? (
            <p className="text-muted-foreground max-w-2xl">
              {assessment.description}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3 items-center pt-2">
            <Badge variant="outline" className={`${statusClasses(assessment.status)} uppercase tracking-wider`}>
              {assessment.status}
            </Badge>
            <span className="text-xs text-white/60 uppercase tracking-widest">
              {assessment.educatorName}
            </span>
            {assessment.subject ? (
              <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded">
                {assessment.subject}
              </span>
            ) : null}
            {assessment.gradeLevel ? (
              <span className="text-xs text-white/50 bg-white/5 px-2 py-1 rounded">
                {assessment.gradeLevel}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
            Join Code
          </div>
          <div className="font-mono font-bold text-3xl md:text-4xl tracking-[0.2em] text-amber-200 px-5 py-3 rounded-xl border border-amber-500/30 bg-black/60">
            {assessment.code}
          </div>
          <GhostButton type="button" onClick={copyJoinLink}>
            <Copy className="w-3.5 h-3.5" /> Copy Join Link
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

// =============================================================
//                     BASICS TAB
// =============================================================

function BasicsTab({ assessment }: { assessment: StudioAssessmentDetail }) {
  const qc = useQueryClient();
  const update = useUpdateStudioAssessment();

  const [title, setTitle] = useState(assessment.title);
  const [description, setDescription] = useState(assessment.description ?? "");
  const [subject, setSubject] = useState(assessment.subject ?? "");
  const [gradeLevel, setGradeLevel] = useState(assessment.gradeLevel ?? "");
  const [rules, setRules] = useState(assessment.rules);
  const [timeLimit, setTimeLimit] = useState(assessment.timeLimitMinutes);
  const [pass, setPass] = useState(assessment.passThreshold);
  const [modes, setModes] = useState<StudioAnswerMode[]>(
    assessment.allowedAnswerModes,
  );
  const [status, setStatus] = useState<StudioAssessmentStatus>(
    assessment.status,
  );
  const [fmt, setFmt] = useState<StudioAssessmentFormatValue>(
    (assessment.format as StudioAssessmentFormatValue) ?? "exam",
  );
  const [maxAttempts, setMaxAttempts] = useState<number>(
    Number(assessment.maxAttempts ?? 1),
  );
  const [dueAt, setDueAt] = useState<string>(
    assessment.dueAt
      ? new Date(assessment.dueAt).toISOString().slice(0, 16)
      : "",
  );

  const toggleMode = (m: StudioAnswerMode, on: boolean) => {
    setModes((prev) => {
      const next = on ? [...prev.filter((x) => x !== m), m] : prev.filter((x) => x !== m);
      return next;
    });
  };

  const save = () => {
    if (modes.length === 0) {
      toast.error("Enable at least one answer mode");
      return;
    }
    update.mutate(
      {
        id: assessment.id,
        data: {
          title,
          description: description || null,
          subject: subject || null,
          gradeLevel: gradeLevel || null,
          rules,
          timeLimitMinutes: timeLimit,
          passThreshold: pass,
          allowedAnswerModes: modes,
          status,
          format: fmt,
          maxAttempts,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetStudioAssessmentQueryKey(assessment.id) });
          qc.invalidateQueries({ queryKey: getListStudioAssessmentsQueryKey() });
          toast.success("Saved");
        },
        onError: (err: any) => toast.error(err?.message ?? "Save failed"),
      },
    );
  };

  return (
    <SpotlightCard className="space-y-6">
      <SectionHeader title="Essentials" subtitle="Format, scope, timing, and access controls." />

      <div>
        <Label className="uppercase tracking-widest text-xs text-muted-foreground mb-3 block">
          Assessment Format
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="format-grid">
          {ASSESSMENT_FORMATS.map((f) => {
            const active = fmt === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFmt(f.value)}
                data-testid={`format-${f.value}`}
                className={`text-left p-4 rounded-xl border transition-all ${
                  active
                    ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_20px_-5px_rgba(251,191,36,0.4)]"
                    : "border-white/10 bg-black/30 hover:border-white/30 hover:bg-white/5"
                }`}
              >
                <div className="text-2xl mb-1">{f.icon}</div>
                <div className={`text-sm font-bold uppercase tracking-wider ${active ? "text-amber-200" : "text-white/85"}`}>
                  {f.label}
                </div>
                <div className="text-[0.7rem] text-white/50 mt-1 leading-snug">{f.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Subject">
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="Grade Level">
          <Input value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} />
        </Field>
        <Field label="Time Limit (minutes — 0 means unlimited)">
          <Input
            type="number"
            min={0}
            max={480}
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value) || 0)}
          />
        </Field>
        <Field label="Max Attempts (per student)">
          <Input
            type="number"
            min={1}
            max={99}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Math.max(1, Number(e.target.value) || 1))}
            data-testid="input-max-attempts"
          />
        </Field>
        <Field label="Due (optional)">
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            data-testid="input-due-at"
          />
        </Field>
      </div>

      <Field label="Description">
        <Textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field label="Rules / Instructions">
        <Textarea rows={4} value={rules} onChange={(e) => setRules(e.target.value)} />
      </Field>

      <Field label={`Pass Threshold · ${Math.round(pass * 100)}%`}>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={[pass]}
          onValueChange={(v) => setPass(v[0] ?? 0)}
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label className="uppercase tracking-widest text-xs text-muted-foreground">
            Allowed Answer Modes
          </Label>
          <div className="space-y-2">
            {ANSWER_MODES.map((m) => (
              <div key={m.value} className="flex items-center justify-between p-3 rounded-lg border border-white/5 bg-black/30">
                <span className="text-sm">{m.label}</span>
                <Switch
                  checked={modes.includes(m.value)}
                  onCheckedChange={(v) => toggleMode(m.value, v)}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="uppercase tracking-widest text-xs text-muted-foreground">
            Status
          </Label>
          <Select value={status} onValueChange={(v) => setStatus(v as StudioAssessmentStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Open assessments can be joined by students with the code.
          </p>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-white/5">
        <GoldButton type="button" onClick={save} disabled={update.isPending}>
          {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Basics
        </GoldButton>
      </div>
    </SpotlightCard>
  );
}

// =============================================================
//                     MATERIALS TAB
// =============================================================

function MaterialsTab({ assessmentId }: { assessmentId: string }) {
  const qc = useQueryClient();
  const { data: materials, isLoading } = useListStudioMaterials(assessmentId);
  const add = useAddStudioMaterial();
  const del = useDeleteStudioMaterial();

  const [pTitle, setPTitle] = useState("");
  const [pText, setPText] = useState("");

  const [uploading, setUploading] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListStudioMaterialsQueryKey(assessmentId) });
    qc.invalidateQueries({ queryKey: getGetStudioAssessmentQueryKey(assessmentId) });
  };

  const submitPaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pTitle.trim() || !pText.trim()) {
      toast.error("Title and content are required");
      return;
    }
    add.mutate(
      {
        id: assessmentId,
        data: {
          kind: "pasted",
          title: pTitle.trim(),
          contentText: pText,
        },
      },
      {
        onSuccess: () => {
          toast.success("Material added");
          setPTitle("");
          setPText("");
          invalidate();
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed"),
      },
    );
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const text = await parseFile(file);
      add.mutate(
        {
          id: assessmentId,
          data: {
            kind: "file_text",
            title: file.name,
            contentText: text,
          },
        },
        {
          onSuccess: () => {
            toast.success(`Imported ${file.name}`);
            invalidate();
          },
          onError: (err: any) => toast.error(err?.message ?? "Upload failed"),
          onSettled: () => setUploading(false),
        },
      );
    } catch (err: any) {
      toast.error(err?.message ?? "Could not parse file");
      setUploading(false);
    }
  };

  const onFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await handleFile(files[i]);
    }
    e.target.value = "";
  };

  const removeMaterial = (m: StudioMaterial) => {
    del.mutate(
      { id: m.id },
      {
        onSuccess: () => {
          toast.success("Material removed");
          invalidate();
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed"),
      },
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SpotlightCard>
        <SectionHeader
          title="Paste Source Text"
          subtitle="Inject curriculum text directly into the AI corpus."
        />
        <form onSubmit={submitPaste} className="space-y-4 mt-4">
          <Field label="Title">
            <Input
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
              placeholder="Chapter 3 — Vector Spaces"
            />
          </Field>
          <Field label="Content">
            <Textarea
              rows={8}
              value={pText}
              onChange={(e) => setPText(e.target.value)}
              placeholder="Paste lecture notes, textbook excerpts, or reference text here…"
            />
          </Field>
          <GoldButton type="submit" disabled={add.isPending}>
            {add.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Material
          </GoldButton>
        </form>
      </SpotlightCard>

      <SpotlightCard>
        <SectionHeader
          title="Upload Document"
          subtitle="Parse PDF, DOCX, PPTX, or TXT directly in your browser."
        />
        <div className="mt-4 space-y-4">
          <label className="flex flex-col items-center justify-center gap-3 py-12 px-6 rounded-xl border-2 border-dashed border-amber-500/20 hover:border-amber-500/50 bg-black/30 cursor-pointer transition-colors">
            {uploading ? (
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-amber-400" />
            )}
            <div className="text-sm text-foreground font-semibold">
              {uploading ? "Parsing…" : "Drop or choose a file"}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest">
              .pdf · .docx · .pptx · .txt
            </div>
            <input
              type="file"
              accept=".pdf,.docx,.pptx,.txt"
              multiple
              className="hidden"
              onChange={onFileInput}
              disabled={uploading}
            />
          </label>
        </div>
      </SpotlightCard>

      <div className="lg:col-span-2">
        <SpotlightCard>
          <SectionHeader
            title="Library"
            subtitle={`${materials?.length ?? 0} materials available to AI question generation.`}
          />
          <div className="mt-4 divide-y divide-white/5">
            {isLoading ? (
              <div className="py-8 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 mx-auto animate-spin" />
              </div>
            ) : materials && materials.length > 0 ? (
              materials.map((m) => (
                <div key={m.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="uppercase text-[0.6rem] tracking-wider">
                        {m.kind.replace("_", " ")}
                      </Badge>
                      <span className="font-medium truncate">{m.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.wordCount.toLocaleString()} words ·{" "}
                      {format(new Date(m.createdAt), "MMM d, yyyy")}
                      {m.sourceUrl ? (
                        <>
                          {" · "}
                          <a href={m.sourceUrl} target="_blank" rel="noreferrer" className="underline hover:text-amber-300">
                            Source
                          </a>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeMaterial(m)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No materials yet.
              </div>
            )}
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
}

// =============================================================
//                     RESEARCH TAB
// =============================================================

function ResearchTab({ assessmentId }: { assessmentId: string }) {
  const qc = useQueryClient();
  const research = useStudioResearch();
  const add = useAddStudioMaterial();

  const [topic, setTopic] = useState("");
  const [includeWeb, setIncludeWeb] = useState(true);
  const [includeYouTube, setIncludeYouTube] = useState(true);
  const [includeEbooks, setIncludeEbooks] = useState(true);
  const [count, setCount] = useState(6);
  const [sources, setSources] = useState<StudioResearchSource[]>([]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Topic required");
      return;
    }
    research.mutate(
      {
        id: assessmentId,
        data: {
          topic: topic.trim(),
          includeWeb,
          includeYouTube,
          includeEbooks,
          maxResults: count,
        },
      },
      {
        onSuccess: (res) => {
          setSources(res.sources);
          toast.success(`Found ${res.sources.length} sources`);
        },
        onError: (err: any) => toast.error(err?.message ?? "Research failed"),
      },
    );
  };

  const adoptSource = (s: StudioResearchSource) => {
    add.mutate(
      {
        id: assessmentId,
        data: {
          kind: s.kind,
          title: s.title,
          sourceUrl: s.sourceUrl ?? null,
          author: s.author ?? null,
          contentText: s.contentText,
        },
      },
      {
        onSuccess: () => {
          toast.success("Added to materials");
          qc.invalidateQueries({ queryKey: getListStudioMaterialsQueryKey(assessmentId) });
          qc.invalidateQueries({ queryKey: getGetStudioAssessmentQueryKey(assessmentId) });
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <SpotlightCard>
        <SectionHeader
          title="AI Research Agent"
          subtitle="Discover relevant web pages, videos, and ebooks for your topic."
        />
        <form onSubmit={submit} className="mt-4 space-y-5">
          <Field label="Topic">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Photosynthesis in C4 plants"
            />
          </Field>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ToggleRow label="Web" checked={includeWeb} onChange={setIncludeWeb} />
            <ToggleRow label="YouTube" checked={includeYouTube} onChange={setIncludeYouTube} />
            <ToggleRow label="Ebooks" checked={includeEbooks} onChange={setIncludeEbooks} />
          </div>

          <Field label={`Sources · ${count}`}>
            <Slider
              min={1}
              max={12}
              step={1}
              value={[count]}
              onValueChange={(v) => setCount(v[0] ?? 1)}
            />
          </Field>

          <div className="flex justify-end">
            <GoldButton type="submit" disabled={research.isPending}>
              {research.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Run Research
            </GoldButton>
          </div>
        </form>
      </SpotlightCard>

      {sources.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sources.map((s, i) => (
            <SpotlightCard key={i} className="flex flex-col">
              <div className="flex items-start gap-2 mb-2">
                <Badge variant="outline" className="uppercase text-[0.6rem] tracking-wider">
                  {s.kind}
                </Badge>
                {s.author ? (
                  <span className="text-xs text-muted-foreground">{s.author}</span>
                ) : null}
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{s.title}</h3>
              {s.sourceUrl ? (
                <a
                  href={s.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-amber-300 underline mb-3 break-all"
                >
                  {s.sourceUrl}
                </a>
              ) : null}
              <p className="text-sm text-muted-foreground line-clamp-4 flex-1">
                {s.snippet}
              </p>
              <div className="mt-4">
                <GhostButton type="button" onClick={() => adoptSource(s)} disabled={add.isPending}>
                  <Plus className="w-3.5 h-3.5" /> Add as Material
                </GhostButton>
              </div>
            </SpotlightCard>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// =============================================================
//                     RUBRIC TAB
// =============================================================

function RubricTab({ assessment }: { assessment: StudioAssessmentDetail }) {
  const qc = useQueryClient();
  const { data: taxonomies } = useGetStudioTaxonomies();
  const save = useSetStudioRubric();

  const [taxonomy, setTaxonomy] = useState<StudioTaxonomyKind>(
    assessment.rubric.taxonomy,
  );
  const [targetLevels, setTargetLevels] = useState<number[]>(
    assessment.rubric.targetLevels,
  );
  const [criteria, setCriteria] = useState<StudioRubricCriterion[]>(
    assessment.rubric.criteria,
  );
  const [notes, setNotes] = useState(assessment.rubric.notes ?? "");

  const selectedTax = taxonomies?.find((t) => t.kind === taxonomy);

  const toggleLevel = (lvl: number) => {
    setTargetLevels((prev) =>
      prev.includes(lvl) ? prev.filter((x) => x !== lvl) : [...prev, lvl].sort((a, b) => a - b),
    );
  };

  const addCriterion = () => {
    setCriteria((prev) => [
      ...prev,
      {
        id: genId("crit"),
        label: "New Criterion",
        description: "",
        weight: 1,
        targetLevel: targetLevels[0] ?? 1,
      },
    ]);
  };

  const updateCriterion = (i: number, patch: Partial<StudioRubricCriterion>) => {
    setCriteria((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const removeCriterion = (i: number) => {
    setCriteria((prev) => prev.filter((_, idx) => idx !== i));
  };

  const onSave = () => {
    if (criteria.length === 0) {
      toast.error("Add at least one criterion");
      return;
    }
    if (targetLevels.length === 0) {
      toast.error("Select at least one target level");
      return;
    }
    save.mutate(
      {
        id: assessment.id,
        data: {
          taxonomy,
          targetLevels,
          criteria,
          notes: notes || null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Rubric saved");
          qc.invalidateQueries({ queryKey: getGetStudioAssessmentQueryKey(assessment.id) });
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <SpotlightCard>
        <SectionHeader
          title="Pedagogical Taxonomy"
          subtitle="Choose the framework that anchors your rubric levels."
        />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {taxonomies?.map((t) => (
            <button
              key={t.kind}
              type="button"
              onClick={() => setTaxonomy(t.kind)}
              className={`text-left p-4 rounded-xl border transition-all ${
                taxonomy === t.kind
                  ? "border-amber-500/60 bg-amber-500/10"
                  : "border-white/10 hover:border-white/20 bg-black/30"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-display font-bold text-lg text-foreground">
                  {t.title}
                </div>
                {taxonomy === t.kind ? (
                  <Check className="w-4 h-4 text-amber-400" />
                ) : null}
              </div>
              <div className="text-xs uppercase tracking-widest text-amber-500/80 mb-2">
                {t.subtitle}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-3">
                {t.description}
              </div>
            </button>
          ))}
        </div>
      </SpotlightCard>

      {selectedTax ? (
        <SpotlightCard>
          <SectionHeader
            title="Target Levels"
            subtitle="Select levels your assessment intends to evaluate."
          />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            {selectedTax.levels.map((lvl) => (
              <label
                key={lvl.level}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  targetLevels.includes(lvl.level)
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-white/5 hover:border-white/15 bg-black/30"
                }`}
              >
                <Checkbox
                  checked={targetLevels.includes(lvl.level)}
                  onCheckedChange={() => toggleLevel(lvl.level)}
                />
                <div className="flex-1">
                  <div className="font-semibold text-sm">
                    L{lvl.level} · {lvl.name}
                  </div>
                  <div className="text-xs text-muted-foreground">{lvl.summary}</div>
                </div>
              </label>
            ))}
          </div>
        </SpotlightCard>
      ) : null}

      <SpotlightCard>
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Weighted Criteria"
            subtitle="Define rubric criteria the AI grader will use."
          />
          <GhostButton type="button" onClick={addCriterion}>
            <Plus className="w-3.5 h-3.5" /> Add Criterion
          </GhostButton>
        </div>

        <div className="mt-4 space-y-4">
          {criteria.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No criteria yet. Add one to begin.
            </div>
          ) : (
            criteria.map((c, i) => (
              <div key={c.id} className="p-4 rounded-xl border border-white/10 bg-black/30 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Label</Label>
                    <Input value={c.label} onChange={(e) => updateCriterion(i, { label: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Weight</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={c.weight}
                      onChange={(e) => updateCriterion(i, { weight: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Target Level</Label>
                    <Select
                      value={String(c.targetLevel)}
                      onValueChange={(v) => updateCriterion(i, { targetLevel: Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(selectedTax?.levels ?? []).map((lvl) => (
                          <SelectItem key={lvl.level} value={String(lvl.level)}>
                            L{lvl.level} · {lvl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3 flex items-end justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCriterion(i)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="md:col-span-12">
                    <Label className="text-xs uppercase tracking-widest text-muted-foreground">Description</Label>
                    <Textarea
                      rows={2}
                      value={c.description}
                      onChange={(e) => updateCriterion(i, { description: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 space-y-4">
          <Field label="Notes (optional)">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal grading notes for this rubric…"
            />
          </Field>
        </div>

        <div className="flex justify-end pt-4 border-t border-white/5 mt-4">
          <GoldButton type="button" onClick={onSave} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Rubric
          </GoldButton>
        </div>
      </SpotlightCard>
    </div>
  );
}

// =============================================================
//                     QUESTIONS TAB
// =============================================================

function QuestionsTab({ assessment }: { assessment: StudioAssessmentDetail }) {
  const qc = useQueryClient();
  const { data: questions, isLoading } = useListStudioQuestions(assessment.id);
  const { data: materials } = useListStudioMaterials(assessment.id);
  const generate = useGenerateStudioQuestions();
  const del = useDeleteStudioQuestion();

  const [genMaterialIds, setGenMaterialIds] = useState<string[]>([]);
  const [genTypes, setGenTypes] = useState<StudioQuestionType[]>([
    "multiple_choice",
    "short_answer",
  ]);
  const [genLevels, setGenLevels] = useState<number[]>(
    assessment.rubric.targetLevels,
  );
  const [genCount, setGenCount] = useState(5);
  const [genInstructions, setGenInstructions] = useState("");
  const [editing, setEditing] = useState<StudioQuestion | null>(null);
  const [adding, setAdding] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListStudioQuestionsQueryKey(assessment.id) });
    qc.invalidateQueries({ queryKey: getGetStudioAssessmentQueryKey(assessment.id) });
  };

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  const runGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (genMaterialIds.length === 0) {
      toast.error("Select at least one material");
      return;
    }
    if (genTypes.length === 0) {
      toast.error("Select at least one question type");
      return;
    }
    if (genLevels.length === 0) {
      toast.error("Select at least one target level");
      return;
    }
    generate.mutate(
      {
        id: assessment.id,
        data: {
          materialIds: genMaterialIds,
          types: genTypes,
          targetLevels: genLevels,
          count: genCount,
          instructions: genInstructions.trim() || null,
        },
      },
      {
        onSuccess: (qs) => {
          toast.success(`Generated ${qs.length} questions`);
          invalidate();
        },
        onError: (err: any) => toast.error(err?.message ?? "Generation failed"),
      },
    );
  };

  const removeQuestion = (q: StudioQuestion) => {
    del.mutate(
      { id: q.id },
      {
        onSuccess: () => {
          toast.success("Question removed");
          invalidate();
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <SpotlightCard>
        <SectionHeader
          title="AI Question Generation"
          subtitle="Compose new questions from your materials, taxonomy, and rubric."
        />
        <form onSubmit={runGenerate} className="mt-4 space-y-5">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Materials
            </Label>
            <div className="mt-2 space-y-1 max-h-60 overflow-auto rounded-lg border border-white/10 bg-black/30 p-2">
              {(materials ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground py-3 text-center">
                  No materials yet. Add some on the Materials tab.
                </div>
              ) : (
                (materials ?? []).map((m) => (
                  <label
                    key={m.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-white/5 cursor-pointer"
                  >
                    <Checkbox
                      checked={genMaterialIds.includes(m.id)}
                      onCheckedChange={() => setGenMaterialIds((p) => toggle(p, m.id))}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{m.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.kind} · {m.wordCount.toLocaleString()} words
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Question Types
              </Label>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {QUESTION_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className={`flex items-center gap-2 p-2 rounded border text-sm cursor-pointer ${
                      genTypes.includes(t.value)
                        ? "border-amber-500/40 bg-amber-500/10"
                        : "border-white/10 bg-black/30"
                    }`}
                  >
                    <Checkbox
                      checked={genTypes.includes(t.value)}
                      onCheckedChange={() => setGenTypes((p) => toggle(p, t.value))}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                Target Levels
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {assessment.rubric.targetLevels.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Configure target levels in Rubric first.
                  </span>
                ) : (
                  assessment.rubric.targetLevels.map((lvl) => (
                    <button
                      type="button"
                      key={lvl}
                      onClick={() => setGenLevels((p) => toggle(p, lvl))}
                      className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-wider border ${
                        genLevels.includes(lvl)
                          ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                          : "border-white/10 text-white/60"
                      }`}
                    >
                      L{lvl}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <Field label={`Count · ${genCount}`}>
            <Slider
              min={1}
              max={30}
              step={1}
              value={[genCount]}
              onValueChange={(v) => setGenCount(v[0] ?? 1)}
            />
          </Field>

          <Field label="Instructions (optional)">
            <Textarea
              rows={2}
              value={genInstructions}
              onChange={(e) => setGenInstructions(e.target.value)}
              placeholder="Focus on application of formulas; avoid rote definitions."
            />
          </Field>

          <div className="flex justify-end">
            <GoldButton type="submit" disabled={generate.isPending}>
              {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Questions
            </GoldButton>
          </div>
        </form>
      </SpotlightCard>

      <SpotlightCard>
        <div className="flex items-center justify-between">
          <SectionHeader
            title="Question Bank"
            subtitle={`${questions?.length ?? 0} questions in this assessment.`}
          />
          <GhostButton type="button" onClick={() => setAdding(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Manually
          </GhostButton>
        </div>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="w-5 h-5 mx-auto animate-spin text-amber-400" />
            </div>
          ) : questions && questions.length > 0 ? (
            questions.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-white/10 bg-black/30 hover:border-amber-500/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs text-muted-foreground font-mono">
                        #{idx + 1}
                      </span>
                      <Badge variant="outline" className="uppercase text-[0.6rem] tracking-wider">
                        {q.type.replace("_", " ")}
                      </Badge>
                      <Badge variant="outline" className="text-[0.6rem]">
                        L{q.taxonomyLevel}
                      </Badge>
                      <Badge variant="outline" className="text-[0.6rem]">
                        {q.points} pts
                      </Badge>
                    </div>
                    <div className="text-sm whitespace-pre-wrap">{q.prompt}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditing(q)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(q)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No questions yet.
            </div>
          )}
        </div>
      </SpotlightCard>

      {editing ? (
        <QuestionDialog
          mode="edit"
          assessmentId={assessment.id}
          rubric={assessment.rubric}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={invalidate}
        />
      ) : null}
      {adding ? (
        <QuestionDialog
          mode="add"
          assessmentId={assessment.id}
          rubric={assessment.rubric}
          onClose={() => setAdding(false)}
          onSaved={invalidate}
        />
      ) : null}
    </div>
  );
}

// --------------- Question Dialog ---------------

function QuestionDialog({
  mode,
  assessmentId,
  rubric,
  initial,
  onClose,
  onSaved,
}: {
  mode: "add" | "edit";
  assessmentId: string;
  rubric: StudioRubric;
  initial?: StudioQuestion;
  onClose: () => void;
  onSaved: () => void;
}) {
  const add = useAddStudioQuestion();
  const upd = useUpdateStudioQuestion();

  const [type, setType] = useState<StudioQuestionType>(initial?.type ?? "short_answer");
  const [prompt, setPrompt] = useState(initial?.prompt ?? "");
  const [context, setContext] = useState(initial?.context ?? "");
  const [modelAnswer, setModelAnswer] = useState(initial?.modelAnswer ?? "");
  const [options, setOptions] = useState<StudioQuestionOption[]>(
    initial?.options && initial.options.length > 0
      ? initial.options
      : type === "multiple_choice"
      ? [
          { id: genId("opt"), text: "", isCorrect: false },
          { id: genId("opt"), text: "", isCorrect: false },
        ]
      : [],
  );
  const [criterionIds, setCriterionIds] = useState<string[]>(
    initial?.rubricCriterionIds ?? [],
  );
  const [taxonomyLevel, setTaxonomyLevel] = useState<number>(
    initial?.taxonomyLevel ?? rubric.targetLevels[0] ?? 1,
  );
  const [points, setPoints] = useState<number>(initial?.points ?? 10);

  useEffect(() => {
    if (type === "multiple_choice" && options.length === 0) {
      setOptions([
        { id: genId("opt"), text: "", isCorrect: false },
        { id: genId("opt"), text: "", isCorrect: false },
      ]);
    }
    if (type === "true_false") {
      setOptions([
        {
          id: options.find((o) => o.text === "True")?.id ?? genId("opt"),
          text: "True",
          isCorrect: !!options.find((o) => o.text === "True" && o.isCorrect),
        },
        {
          id: options.find((o) => o.text === "False")?.id ?? genId("opt"),
          text: "False",
          isCorrect: !!options.find((o) => o.text === "False" && o.isCorrect),
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const updateOption = (i: number, patch: Partial<StudioQuestionOption>) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));

  const addOption = () =>
    setOptions((prev) => [...prev, { id: genId("opt"), text: "", isCorrect: false }]);

  const removeOption = (i: number) =>
    setOptions((prev) => prev.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!prompt.trim()) {
      toast.error("Prompt is required");
      return;
    }
    const data: UpsertStudioQuestionRequest = {
      type,
      prompt: prompt.trim(),
      context: context.trim() || null,
      options:
        type === "multiple_choice" || type === "true_false" ? options : [],
      modelAnswer: modelAnswer.trim() || null,
      rubricCriterionIds: criterionIds,
      taxonomyLevel,
      points,
    };
    const onSuccess = () => {
      toast.success(mode === "add" ? "Question added" : "Question updated");
      onSaved();
      onClose();
    };
    const onError = (err: any) => toast.error(err?.message ?? "Failed");
    if (mode === "add") {
      add.mutate({ id: assessmentId, data }, { onSuccess, onError });
    } else if (initial) {
      upd.mutate({ id: initial.id, data }, { onSuccess, onError });
    }
  };

  const pending = add.isPending || upd.isPending;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add Question" : "Edit Question"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Type">
              <Select value={type} onValueChange={(v) => setType(v as StudioQuestionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Taxonomy Level">
              <Input
                type="number"
                min={1}
                value={taxonomyLevel}
                onChange={(e) => setTaxonomyLevel(Number(e.target.value) || 1)}
              />
            </Field>
            <Field label="Points">
              <Input
                type="number"
                min={0}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value) || 0)}
              />
            </Field>
          </div>

          <Field label="Prompt">
            <Textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </Field>

          <Field label="Context (optional)">
            <Textarea
              rows={3}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Reference passage or stimulus to display before the prompt."
            />
          </Field>

          {type === "multiple_choice" || type === "true_false" ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Options
                </Label>
                {type === "multiple_choice" ? (
                  <GhostButton type="button" onClick={addOption}>
                    <Plus className="w-3.5 h-3.5" /> Add
                  </GhostButton>
                ) : null}
              </div>
              <div className="space-y-2">
                {options.map((o, i) => (
                  <div key={o.id} className="flex items-center gap-2 p-2 rounded border border-white/10 bg-black/30">
                    <Checkbox
                      checked={o.isCorrect}
                      onCheckedChange={(v) => updateOption(i, { isCorrect: !!v })}
                    />
                    <Input
                      value={o.text}
                      onChange={(e) => updateOption(i, { text: e.target.value })}
                      placeholder="Option text"
                      disabled={type === "true_false"}
                    />
                    {type === "multiple_choice" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(i)}
                        className="text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <Field label="Model Answer (optional)">
            <Textarea
              rows={3}
              value={modelAnswer}
              onChange={(e) => setModelAnswer(e.target.value)}
              placeholder="Reference answer used to anchor AI grading."
            />
          </Field>

          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Rubric Criteria
            </Label>
            <div className="mt-2 space-y-1.5 max-h-44 overflow-auto rounded border border-white/10 bg-black/30 p-2">
              {rubric.criteria.length === 0 ? (
                <div className="text-xs text-muted-foreground py-2 text-center">
                  No criteria configured. Set them up on the Rubric tab.
                </div>
              ) : (
                rubric.criteria.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-white/5 cursor-pointer"
                  >
                    <Checkbox
                      checked={criterionIds.includes(c.id)}
                      onCheckedChange={(v) =>
                        setCriterionIds((prev) =>
                          v ? [...prev, c.id] : prev.filter((x) => x !== c.id),
                        )
                      }
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{c.label}</div>
                      <div className="text-xs text-muted-foreground">
                        Weight {c.weight} · L{c.targetLevel}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <GhostButton type="button" onClick={onClose}>
            Cancel
          </GhostButton>
          <GoldButton type="button" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </GoldButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================
//                     PROCTORING TAB
// =============================================================

function ProctoringTab({ assessment }: { assessment: StudioAssessmentDetail }) {
  const qc = useQueryClient();
  const update = useUpdateStudioAssessment();
  const [cfg, setCfg] = useState<StudioProctoringConfig>(assessment.proctoring);

  const set = <K extends keyof StudioProctoringConfig>(
    k: K,
    v: StudioProctoringConfig[K],
  ) => setCfg((p) => ({ ...p, [k]: v }));

  const save = () => {
    update.mutate(
      { id: assessment.id, data: { proctoring: cfg } },
      {
        onSuccess: () => {
          toast.success("Proctoring saved");
          qc.invalidateQueries({ queryKey: getGetStudioAssessmentQueryKey(assessment.id) });
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed"),
      },
    );
  };

  return (
    <div className="space-y-6">
      <SpotlightCard>
        <SectionHeader
          title="Browser Lockdown"
          subtitle="Restrict student behaviour during the attempt."
        />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <SwitchRow
            label="Lock Fullscreen"
            description="Prevent exiting fullscreen mode."
            checked={cfg.lockFullscreen}
            onChange={(v) => set("lockFullscreen", v)}
          />
          <SwitchRow
            label="Block Copy / Paste"
            checked={cfg.blockCopyPaste}
            onChange={(v) => set("blockCopyPaste", v)}
          />
          <SwitchRow
            label="Block Right Click"
            checked={cfg.blockRightClick}
            onChange={(v) => set("blockRightClick", v)}
          />
          <SwitchRow
            label="Block Shortcuts"
            checked={cfg.blockShortcuts}
            onChange={(v) => set("blockShortcuts", v)}
          />
          <SwitchRow
            label="Detect DevTools"
            checked={cfg.detectDevtools}
            onChange={(v) => set("detectDevtools", v)}
          />
        </div>
      </SpotlightCard>

      <SpotlightCard>
        <SectionHeader
          title="Behavioural Thresholds"
          subtitle="Auto-flag attempts that breach these limits."
        />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Idle Timeout (sec)">
            <Input
              type="number"
              min={0}
              value={cfg.idleTimeoutSeconds}
              onChange={(e) => set("idleTimeoutSeconds", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Max Tab Switches">
            <Input
              type="number"
              min={0}
              value={cfg.maxTabSwitches}
              onChange={(e) => set("maxTabSwitches", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Auto-flag Threshold">
            <Input
              type="number"
              min={0}
              value={cfg.autoFlagThreshold}
              onChange={(e) => set("autoFlagThreshold", Number(e.target.value) || 0)}
            />
          </Field>
        </div>
      </SpotlightCard>

      <SpotlightCard>
        <SectionHeader
          title="Surveillance"
          subtitle="Capture visual and auditory evidence during the attempt."
        />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <SwitchRow
            label="Webcam Snapshots"
            checked={cfg.webcamSnapshots}
            onChange={(v) => set("webcamSnapshots", v)}
          />
          <Field label="Snapshot Interval (sec)">
            <Input
              type="number"
              min={5}
              value={cfg.webcamSnapshotIntervalSec}
              onChange={(e) => set("webcamSnapshotIntervalSec", Number(e.target.value) || 5)}
            />
          </Field>
          <SwitchRow
            label="Face Detection"
            checked={cfg.faceDetection}
            onChange={(v) => set("faceDetection", v)}
          />
          <SwitchRow
            label="Audio Monitoring"
            checked={cfg.audioMonitoring}
            onChange={(v) => set("audioMonitoring", v)}
          />
          <SwitchRow
            label="Screen Recording"
            checked={cfg.screenRecording}
            onChange={(v) => set("screenRecording", v)}
          />
        </div>

        <div className="flex justify-end pt-6 border-t border-white/5 mt-6">
          <GoldButton type="button" onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Proctoring
          </GoldButton>
        </div>
      </SpotlightCard>
    </div>
  );
}

// =============================================================
//                     ATTEMPTS TAB
// =============================================================

function AttemptsTab({
  assessmentId,
  initialOpenId = null,
}: {
  assessmentId: string;
  initialOpenId?: string | null;
}) {
  const { data: attempts, isLoading } = useListStudioAttemptsForAssessment(assessmentId);
  const [openId, setOpenId] = useState<string | null>(initialOpenId);
  useEffect(() => {
    if (initialOpenId) {
      const el = document.querySelector(
        `[data-attempt-row="${initialOpenId}"]`,
      );
      if (el && "scrollIntoView" in el) {
        (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [initialOpenId, attempts]);

  return (
    <SpotlightCard>
      <SectionHeader
        title="Attempts"
        subtitle="Inspect every cohort attempt with full proctoring evidence."
      />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground border-b border-white/5">
              <th className="py-2 pr-3">Student</th>
              <th className="py-2 pr-3">Started</th>
              <th className="py-2 pr-3">Duration</th>
              <th className="py-2 pr-3">Score</th>
              <th className="py-2 pr-3">Pass</th>
              <th className="py-2 pr-3"><Flag className="w-3 h-3 inline" /></th>
              <th className="py-2 pr-3"><Camera className="w-3 h-3 inline" /></th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center">
                  <Loader2 className="w-5 h-5 mx-auto animate-spin text-amber-400" />
                </td>
              </tr>
            ) : attempts && attempts.length > 0 ? (
              attempts.map((a) => (
                <AttemptRow
                  key={a.id}
                  attempt={a}
                  open={openId === a.id}
                  onToggle={() => setOpenId((cur) => (cur === a.id ? null : a.id))}
                  assessmentId={assessmentId}
                />
              ))
            ) : (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  No attempts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SpotlightCard>
  );
}

function AttemptRow({
  attempt,
  open,
  onToggle,
  assessmentId,
}: {
  attempt: StudioAttempt;
  open: boolean;
  onToggle: () => void;
  assessmentId: string;
}) {
  const dur = attempt.durationSeconds
    ? `${Math.floor(attempt.durationSeconds / 60)}m ${attempt.durationSeconds % 60}s`
    : "—";
  return (
    <>
      <tr
        data-attempt-row={attempt.id}
        onClick={onToggle}
        className={`cursor-pointer hover:bg-white/5 border-b border-white/5 ${
          open ? "bg-amber-500/5" : ""
        }`}
      >
        <td className="py-3 pr-3 font-medium">{attempt.studentName}</td>
        <td className="py-3 pr-3 text-muted-foreground">
          {format(new Date(attempt.startedAt), "MMM d, HH:mm")}
        </td>
        <td className="py-3 pr-3 text-muted-foreground">{dur}</td>
        <td className="py-3 pr-3 font-mono">
          {attempt.score != null ? attempt.score.toFixed(1) : "—"}
        </td>
        <td className="py-3 pr-3">
          {attempt.passed === true ? (
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30" variant="outline">
              Pass
            </Badge>
          ) : attempt.passed === false ? (
            <Badge className="bg-red-500/20 text-red-300 border-red-500/30" variant="outline">
              Fail
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="py-3 pr-3">{attempt.flagCount}</td>
        <td className="py-3 pr-3">{attempt.snapshotCount}</td>
        <td className="py-3 pr-3">
          <Badge variant="outline" className={statusClasses(attempt.status)}>
            {attempt.status}
          </Badge>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={8} className="bg-black/40 border-b border-white/5">
            <AttemptDetail attemptId={attempt.id} assessmentId={assessmentId} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AttemptDetail({
  attemptId,
  assessmentId,
}: {
  attemptId: string;
  assessmentId: string;
}) {
  const qc = useQueryClient();
  const { data, isLoading } = useGetStudioAttempt(attemptId);
  const { data: events } = useListStudioProctorEvents(attemptId);
  const { data: snapshots } = useListStudioProctorSnapshots(attemptId);
  const regrade = useRegradeStudioAttempt();
  const [overriding, setOverriding] = useState<StudioAnswer | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetStudioAttemptQueryKey(attemptId) });
    qc.invalidateQueries({
      queryKey: getListStudioAttemptsForAssessmentQueryKey(assessmentId),
    });
  };

  const onRegrade = () => {
    regrade.mutate(
      { id: attemptId },
      {
        onSuccess: () => {
          toast.success("Re-grade complete");
          invalidate();
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed"),
      },
    );
  };

  if (isLoading || !data) {
    return (
      <div className="py-8 text-center">
        <Loader2 className="w-5 h-5 mx-auto animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="text-foreground font-semibold">{data.studentName}</span>
          {data.studentEmail ? <> · {data.studentEmail}</> : null}
        </div>
        <GhostButton type="button" onClick={onRegrade} disabled={regrade.isPending}>
          {regrade.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          Re-Grade
        </GhostButton>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-amber-500/80 font-bold mb-3">
          Answers
        </div>
        <div className="space-y-3">
          {data.answers.length === 0 ? (
            <div className="text-sm text-muted-foreground">No answers submitted.</div>
          ) : (
            data.answers.map((ans) => {
              const q = data.questions.find((qq) => qq.id === ans.questionId);
              return (
                <div key={ans.id} className="p-4 rounded-lg border border-white/10 bg-black/40">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-sm font-medium flex-1">
                      {q?.prompt ?? "Question"}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {ans.score != null ? ans.score.toFixed(1) : "—"} / {ans.maxScore}
                      </Badge>
                      {ans.manualOverride ? (
                        <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                          Override
                        </Badge>
                      ) : null}
                      <GhostButton type="button" onClick={() => setOverriding(ans)}>
                        Override
                      </GhostButton>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                    {ans.mode}
                  </div>
                  <div className="text-sm whitespace-pre-wrap text-white/80">
                    {ans.responseText || (
                      <span className="italic text-muted-foreground">(no text)</span>
                    )}
                  </div>
                  {ans.aiFeedback ? (
                    <div className="mt-3 pt-3 border-t border-white/5 text-xs text-muted-foreground">
                      <span className="text-amber-300 font-semibold">AI Feedback · </span>
                      {ans.aiFeedback}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-amber-500/80 font-bold mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> Proctor Events
        </div>
        <div className="space-y-1.5 max-h-60 overflow-auto">
          {events && events.length > 0 ? (
            events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 p-2 rounded border border-white/5 bg-black/30">
                <Badge variant="outline" className={severityClasses(ev.severity)}>
                  {ev.severity}
                </Badge>
                <div className="flex-1">
                  <div className="text-sm font-medium">{ev.type}</div>
                  <div className="text-xs text-muted-foreground">{ev.message}</div>
                </div>
                <div className="text-[0.65rem] text-muted-foreground font-mono">
                  {format(new Date(ev.createdAt), "HH:mm:ss")}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No events.</div>
          )}
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-widest text-amber-500/80 font-bold mb-3 flex items-center gap-2">
          <Camera className="w-3.5 h-3.5" /> Snapshots
        </div>
        {snapshots && snapshots.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {snapshots.map((s) => (
              <div key={s.id} className="relative rounded-lg overflow-hidden border border-white/10 bg-black">
                <img src={s.imageDataUrl} alt={`Snapshot ${s.id}`} className="w-full h-32 object-cover" />
                <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/70 text-[0.6rem] text-white/80 flex justify-between">
                  <span>{format(new Date(s.createdAt), "HH:mm:ss")}</span>
                  {s.flagged ? <Flag className="w-3 h-3 text-red-400" /> : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No snapshots.</div>
        )}
      </div>

      {overriding ? (
        <OverrideDialog
          answer={overriding}
          onClose={() => setOverriding(null)}
          onSaved={invalidate}
        />
      ) : null}
    </div>
  );
}

function OverrideDialog({
  answer,
  onClose,
  onSaved,
}: {
  answer: StudioAnswer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const m = useOverrideStudioAnswerScore();
  const [score, setScore] = useState<number>(answer.score ?? 0);
  const [feedback, setFeedback] = useState<string>(answer.aiFeedback ?? "");

  const submit = () => {
    m.mutate(
      { id: answer.id, data: { score, feedback: feedback || null } },
      {
        onSuccess: () => {
          toast.success("Score overridden");
          onSaved();
          onClose();
        },
        onError: (err: any) => toast.error(err?.message ?? "Failed"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override Score</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={`Score (max ${answer.maxScore})`}>
            <Input
              type="number"
              min={0}
              max={answer.maxScore}
              step={0.1}
              value={score}
              onChange={(e) => setScore(Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Feedback">
            <Textarea
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <GhostButton type="button" onClick={onClose}>
            Cancel
          </GhostButton>
          <GoldButton type="button" onClick={submit} disabled={m.isPending}>
            {m.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Override
          </GoldButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================
//                     INSIGHTS TAB
// =============================================================

function InsightsTab({ assessmentId }: { assessmentId: string }) {
  const { data, isLoading, isError, refetch, isFetching } = useGetStudioInsights(assessmentId);

  if (isLoading) {
    return (
      <div className="py-12 text-center">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-400" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Insights unavailable. Run more attempts and re-fetch.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <GhostButton type="button" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          Refresh
        </GhostButton>
      </div>

      <SpotlightCard>
        <SectionHeader title="Cohort Summary" />
        <p className="mt-3 text-foreground/90 leading-relaxed">{data.cohortSummary}</p>
      </SpotlightCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <InsightList
          title="Strengths"
          items={data.strengths}
          icon={<Target className="w-4 h-4" />}
          tone="emerald"
        />
        <InsightList
          title="Gaps"
          items={data.gaps}
          icon={<AlertTriangle className="w-4 h-4" />}
          tone="amber"
        />
        <InsightList
          title="Recommendations"
          items={data.recommendations}
          icon={<Sparkles className="w-4 h-4" />}
          tone="sky"
        />
      </div>

      <SpotlightCard>
        <SectionHeader title="Criterion Breakdown" subtitle="Average performance per rubric criterion." />
        <div className="mt-4 space-y-4">
          {data.criterionBreakdown.length === 0 ? (
            <div className="text-sm text-muted-foreground">No criterion data yet.</div>
          ) : (
            data.criterionBreakdown.map((c) => (
              <div key={c.criterionId}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">{c.criterionLabel}</span>
                  <span className="text-muted-foreground font-mono">
                    {Math.round(c.avgScorePct)}% · {c.attemptsScored} attempts
                  </span>
                </div>
                <Progress value={c.avgScorePct} className="h-2" />
              </div>
            ))
          )}
        </div>
      </SpotlightCard>
    </div>
  );
}

function InsightList({
  title,
  items,
  icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  tone: "emerald" | "amber" | "sky";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
      ? "text-amber-300"
      : "text-sky-300";
  return (
    <SpotlightCard>
      <div className={`text-xs uppercase tracking-widest font-bold mb-3 flex items-center gap-2 ${toneClass}`}>
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">No items.</div>
      ) : (
        <ul className="space-y-2 list-disc list-inside text-sm text-foreground/90">
          {items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
    </SpotlightCard>
  );
}

// =============================================================
//                     SHARED PIECES
// =============================================================

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h3 className="font-display text-xl font-bold text-foreground">{title}</h3>
      {subtitle ? (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-black/30">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-white/10 bg-black/30">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description ? (
          <div className="text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
