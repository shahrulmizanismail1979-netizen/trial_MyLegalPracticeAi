import { db } from "@workspace/db";
import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { eq, desc, and, inArray, or } from "drizzle-orm";
import {
  studioAssessmentsTable,
  studioMaterialsTable,
  studioQuestionsTable,
  studioAttemptsTable,
  studioAnswersTable,
  studioProctorEventsTable,
  studioProctorSnapshotsTable,
  studioQuestionProposalsTable,
  type StudioAssessmentRow,
  type StudioRubricJson,
  type StudioProctoringJson,
  type StudioAnswerMode,
  type StudioQuestionRow,
  type StudioAttemptRow,
  type StudioAnswerRow,
  type StudioCriterionScoreJson,
  type StudioQuestionProposalRow,
  type User,
} from "@workspace/db/acad";
import { requireUser, getRouteUser, getSessionUser } from "../lib/auth";
import { generateAttemptToken, verifyAttemptToken } from "../lib/attempt-token";
import {
  awardEducatorXp,
  computeStudentGamification,
  getEducatorXp,
  EDUCATOR_BADGE_TIERS,
  STUDENT_BADGE_TIERS,
  xpForNextLevel,
} from "../lib/studio-gamification";
import {
  STUDIO_TAXONOMIES,
  type StudioTaxonomyKind,
} from "../lib/studio-taxonomies";
import {
  researchTopic,
  generateStudioQuestions,
  markStudioAnswer,
  generateOverallNarrative,
  analyzeCohort,
  transcribeAudioDataUrl,
  readHandwritingDataUrl,
  analyzeProctorSnapshot,
  type StudioQuestionType,
} from "../lib/studio-ai";

const router: IRouter = Router();
const auth = requireUser();

// ─────────────── helpers ───────────────

function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const c = generateCode();
    const [existing] = await db
      .select()
      .from(studioAssessmentsTable)
      .where(eq(studioAssessmentsTable.code, c));
    if (!existing) return c;
  }
  throw new Error("Could not generate a unique studio code");
}

function canManage(a: StudioAssessmentRow, user: User): boolean {
  if (user.role === "admin") return true;
  return a.educatorUserId === user.id;
}

function n(v: string | null | undefined): number {
  if (v == null) return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

async function loadAssessmentForUser(
  id: string,
  res: Response,
): Promise<StudioAssessmentRow | null> {
  const [row] = await db
    .select()
    .from(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Assessment not found" });
    return null;
  }
  const user = getRouteUser(res);
  if (!canManage(row, user)) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return row;
}

const ALLOWED_FORMATS = new Set([
  "exam",
  "quiz",
  "assignment",
  "project",
  "presentation",
  "homework",
  "practice",
]);

function serializeAssessment(
  a: StudioAssessmentRow,
  questionCount = 0,
  attemptCount = 0,
) {
  return {
    id: a.id,
    code: a.code,
    title: a.title,
    description: a.description,
    subject: a.subject,
    gradeLevel: a.gradeLevel,
    educatorName: a.educatorName,
    educatorUserId: a.educatorUserId,
    timeLimitMinutes: a.timeLimitMinutes,
    passThreshold: n(a.passThreshold),
    rules: a.rules,
    status: a.status,
    format: a.format ?? "exam",
    maxAttempts: a.maxAttempts ?? 1,
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    allowedAnswerModes: a.allowedAnswerModes,
    proctoring: a.proctoring,
    createdAt: a.createdAt.toISOString(),
    questionCount,
    attemptCount,
  };
}

function publicAssessment(a: StudioAssessmentRow, questionCount: number) {
  return {
    id: a.id,
    code: a.code,
    title: a.title,
    description: a.description,
    educatorName: a.educatorName,
    subject: a.subject,
    gradeLevel: a.gradeLevel,
    timeLimitMinutes: a.timeLimitMinutes,
    rules: a.rules,
    questionCount,
    format: a.format ?? "exam",
    maxAttempts: a.maxAttempts ?? 1,
    dueAt: a.dueAt ? a.dueAt.toISOString() : null,
    allowedAnswerModes: a.allowedAnswerModes,
    proctoring: a.proctoring,
    status: a.status,
  };
}

function serializeQuestion(q: StudioQuestionRow) {
  return {
    id: q.id,
    assessmentId: q.assessmentId,
    orderIndex: q.orderIndex,
    type: q.type,
    prompt: q.prompt,
    context: q.context,
    options: q.options,
    modelAnswer: q.modelAnswer,
    rubricCriterionIds: q.rubricCriterionIds,
    taxonomyLevel: q.taxonomyLevel,
    points: n(q.points),
    createdAt: q.createdAt.toISOString(),
  };
}

function serializeAttempt(a: StudioAttemptRow) {
  return {
    id: a.id,
    assessmentId: a.assessmentId,
    studentName: a.studentName,
    studentEmail: a.studentEmail,
    topicsHint: a.topicsHint,
    startedAt: a.startedAt.toISOString(),
    finishedAt: a.finishedAt ? a.finishedAt.toISOString() : null,
    durationSeconds: a.durationSeconds,
    score: a.score == null ? null : n(a.score),
    passed: a.passed,
    flagCount: a.flagCount,
    snapshotCount: a.snapshotCount,
    status: a.status,
    xpEarned: a.xpEarned,
    badgesEarned: a.badgesEarned,
  };
}

function serializeProposal(p: StudioQuestionProposalRow) {
  return {
    id: p.id,
    assessmentId: p.assessmentId,
    proposerName: p.proposerName,
    proposerEmail: p.proposerEmail,
    prompt: p.prompt,
    suggestedType: p.suggestedType,
    suggestedDifficulty: p.suggestedDifficulty,
    suggestedRubricCriterionId: p.suggestedRubricCriterionId,
    rationale: p.rationale,
    status: p.status,
    reviewedBy: p.reviewedBy,
    reviewedAt: p.reviewedAt ? p.reviewedAt.toISOString() : null,
    acceptedQuestionId: p.acceptedQuestionId,
    createdAt: p.createdAt.toISOString(),
  };
}

function serializeAnswer(a: StudioAnswerRow) {
  return {
    id: a.id,
    attemptId: a.attemptId,
    questionId: a.questionId,
    mode: a.mode,
    responseText: a.responseText,
    selectedOptionIds: a.selectedOptionIds,
    score: a.score == null ? null : n(a.score),
    maxScore: n(a.maxScore),
    aiFeedback: a.aiFeedback,
    criterionScores: a.criterionScores,
    aiConfidence: a.aiConfidence == null ? null : n(a.aiConfidence),
    manualOverride: a.manualOverride,
    submittedAt: a.submittedAt.toISOString(),
  };
}

async function attemptOpen(id: string): Promise<StudioAttemptRow | null> {
  const [a] = await db
    .select()
    .from(studioAttemptsTable)
    .where(eq(studioAttemptsTable.id, id));
  return a ?? null;
}

/**
 * Verify that the caller is allowed to read/write this attempt.
 *
 * Access is granted when EITHER condition is met:
 *
 * 1. Session user (educator/admin): any authenticated user may access any
 *    attempt.  This is intentionally broader than canManage — educators need
 *    to load attempts they are grading across the platform and admins need
 *    unrestricted visibility.  Restricting to assessment owners only would
 *    break the marking-centre flow where admins review cross-educator work.
 *    This is an explicit policy decision: all authenticated server users are
 *    treated as trusted.
 *
 * 2. Attempt token (unauthenticated student): the caller must supply the
 *    X-Attempt-Token header containing HMAC-SHA256(SESSION_SECRET, attemptId).
 *    This token is issued once at attempt creation and must be stored by the
 *    student.  It scopes read/write access to exactly this attempt.
 *
 * Returns true when access is granted; false after sending a 401 response.
 */
async function checkAttemptAccess(attempt: StudioAttemptRow, req: Request, res: Response): Promise<boolean> {
  const sessionUser = await getSessionUser(req);
  if (sessionUser) return true;
  const token = String(req.headers["x-attempt-token"] ?? "").trim();
  if (token && verifyAttemptToken(attempt.id, token)) return true;
  res.status(401).json({ error: "Attempt token required" });
  return false;
}

async function recomputeAttemptTotals(
  attempt: StudioAttemptRow,
  assessment: StudioAssessmentRow,
): Promise<StudioAttemptRow> {
  const [questions, answers] = await Promise.all([
    db
      .select()
      .from(studioQuestionsTable)
      .where(eq(studioQuestionsTable.assessmentId, assessment.id)),
    db
      .select()
      .from(studioAnswersTable)
      .where(eq(studioAnswersTable.attemptId, attempt.id)),
  ]);
  let total = 0;
  let max = 0;
  for (const q of questions) {
    max += n(q.points);
    const ans = answers.find((x) => x.questionId === q.id);
    if (ans?.score != null) total += n(ans.score);
  }
  const passed = max > 0 && total / max >= n(assessment.passThreshold);
  const [row] = await db
    .update(studioAttemptsTable)
    .set({ score: String(total), maxScore: String(max), passed })
    .where(eq(studioAttemptsTable.id, attempt.id))
    .returning();
  return row!;
}

async function buildAttemptSummary(attempt: StudioAttemptRow) {
  const [a] = await db
    .select()
    .from(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.id, attempt.assessmentId));
  if (!a) throw new Error("Assessment missing");
  const answers = await db
    .select()
    .from(studioAnswersTable)
    .where(eq(studioAnswersTable.attemptId, attempt.id));

  const perCriterion = new Map<string, { score: number; max: number }>();
  for (const ans of answers) {
    for (const cs of ans.criterionScores) {
      const slot = perCriterion.get(cs.criterionId) ?? { score: 0, max: 0 };
      slot.score += cs.score;
      slot.max += 1;
      perCriterion.set(cs.criterionId, slot);
    }
  }
  const criterionTotals = a.rubric.criteria.map((c) => {
    const t = perCriterion.get(c.id) ?? { score: 0, max: 0 };
    return {
      criterionId: c.id,
      criterionLabel: c.label,
      score: t.score,
      maxScore: t.max,
      targetLevel: c.targetLevel,
    };
  });

  return {
    attempt: serializeAttempt(attempt),
    overallScore: attempt.score == null ? 0 : n(attempt.score),
    overallMaxScore: attempt.maxScore == null ? 0 : n(attempt.maxScore),
    passed: attempt.passed === true,
    overallNarrative: attempt.overallNarrative ?? "",
    criterionTotals,
    answers: answers.map(serializeAnswer),
  };
}

// ─────────────── reference: taxonomies ───────────────

router.get("/studio/taxonomies", (_req, res) => {
  res.json(STUDIO_TAXONOMIES);
});

// ─────────────── educator dashboard ───────────────

router.get("/studio/dashboard-stats", auth, async (_req, res) => {
  const user = getRouteUser(res);
  const where =
    user.role === "admin"
      ? undefined
      : eq(studioAssessmentsTable.educatorUserId, user.id);
  const all = await (where
    ? db.select().from(studioAssessmentsTable).where(where)
    : db.select().from(studioAssessmentsTable));

  const ids = all.map((a) => a.id);
  let attempts: StudioAttemptRow[] = [];
  if (ids.length > 0) {
    attempts = await db
      .select()
      .from(studioAttemptsTable)
      .where(inArray(studioAttemptsTable.assessmentId, ids));
  }
  const completed = attempts.filter((a) => a.status === "finished");
  const avgPct =
    completed.length === 0
      ? 0
      : completed.reduce((s, a) => {
          const sc = a.score == null ? 0 : n(a.score);
          const mx = a.maxScore == null ? 0 : n(a.maxScore);
          return mx > 0 ? s + sc / mx : s;
        }, 0) / completed.length;

  const recent = [...all]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 6);
  const qCounts = new Map<string, number>();
  if (recent.length > 0) {
    const qrows = await db
      .select()
      .from(studioQuestionsTable)
      .where(
        inArray(
          studioQuestionsTable.assessmentId,
          recent.map((r) => r.id),
        ),
      );
    for (const q of qrows) {
      qCounts.set(q.assessmentId, (qCounts.get(q.assessmentId) ?? 0) + 1);
    }
  }
  const aCounts = new Map<string, number>();
  for (const a of attempts) {
    aCounts.set(a.assessmentId, (aCounts.get(a.assessmentId) ?? 0) + 1);
  }

  res.json({
    assessmentsTotal: all.length,
    assessmentsOpen: all.filter((a) => a.status === "open").length,
    attemptsTotal: attempts.length,
    attemptsCompleted: completed.length,
    avgScorePct: avgPct,
    recentAssessments: recent.map((a) =>
      serializeAssessment(
        a,
        qCounts.get(a.id) ?? 0,
        aCounts.get(a.id) ?? 0,
      ),
    ),
  });
});

// ─────────────── assessments CRUD ───────────────

router.get("/studio/assessments", auth, async (_req, res) => {
  const user = getRouteUser(res);
  const rows = await (user.role === "admin"
    ? db
        .select()
        .from(studioAssessmentsTable)
        .orderBy(desc(studioAssessmentsTable.createdAt))
    : db
        .select()
        .from(studioAssessmentsTable)
        .where(eq(studioAssessmentsTable.educatorUserId, user.id))
        .orderBy(desc(studioAssessmentsTable.createdAt)));

  const ids = rows.map((r) => r.id);
  const qCounts = new Map<string, number>();
  const aCounts = new Map<string, number>();
  if (ids.length > 0) {
    const qrows = await db
      .select()
      .from(studioQuestionsTable)
      .where(inArray(studioQuestionsTable.assessmentId, ids));
    for (const q of qrows)
      qCounts.set(q.assessmentId, (qCounts.get(q.assessmentId) ?? 0) + 1);
    const arows = await db
      .select()
      .from(studioAttemptsTable)
      .where(inArray(studioAttemptsTable.assessmentId, ids));
    for (const a of arows)
      aCounts.set(a.assessmentId, (aCounts.get(a.assessmentId) ?? 0) + 1);
  }
  res.json(
    rows.map((r) =>
      serializeAssessment(r, qCounts.get(r.id) ?? 0, aCounts.get(r.id) ?? 0),
    ),
  );
});

router.post("/studio/assessments", auth, async (req: Request, res) => {
  const user = getRouteUser(res);
  const body = req.body ?? {};
  if (!body.title || !body.educatorName || !body.rubric || !body.proctoring) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const id = randomUUID();
  const code = await uniqueCode();
  const [row] = await db
    .insert(studioAssessmentsTable)
    .values({
      id,
      code,
      title: String(body.title).slice(0, 200),
      description: body.description ?? null,
      subject: body.subject ?? null,
      gradeLevel: body.gradeLevel ?? null,
      educatorName: String(body.educatorName).slice(0, 200),
      educatorUserId: user.id,
      timeLimitMinutes: Number(body.timeLimitMinutes ?? 45),
      passThreshold: String(Number(body.passThreshold ?? 0.6)),
      rules: String(body.rules ?? ""),
      status: "draft",
      format: ALLOWED_FORMATS.has(String(body.format ?? "exam"))
        ? String(body.format)
        : "exam",
      maxAttempts: Number.isFinite(Number(body.maxAttempts))
        ? Math.max(1, Math.min(99, Math.floor(Number(body.maxAttempts))))
        : 1,
      dueAt:
        body.dueAt && typeof body.dueAt === "string"
          ? new Date(body.dueAt)
          : null,
      allowedAnswerModes: (body.allowedAnswerModes ?? ["text"]) as StudioAnswerMode[],
      rubric: body.rubric as StudioRubricJson,
      proctoring: body.proctoring as StudioProctoringJson,
    })
    .returning();
  await awardEducatorXp(user.id, "assessment_created").catch((err) =>
    req.log.warn({ err }, "xp award failed"),
  );
  res.status(201).json(serializeAssessment(row!, 0, 0));
});

router.get("/studio/assessments/:id", auth, async (req, res) => {
  const a = await loadAssessmentForUser(String(req.params["id"]), res);
  if (!a) return;
  const [questions, materials, attempts] = await Promise.all([
    db
      .select()
      .from(studioQuestionsTable)
      .where(eq(studioQuestionsTable.assessmentId, a.id))
      .orderBy(studioQuestionsTable.orderIndex),
    db
      .select()
      .from(studioMaterialsTable)
      .where(eq(studioMaterialsTable.assessmentId, a.id))
      .orderBy(desc(studioMaterialsTable.createdAt)),
    db
      .select()
      .from(studioAttemptsTable)
      .where(eq(studioAttemptsTable.assessmentId, a.id)),
  ]);
  res.json({
    ...serializeAssessment(a, questions.length, attempts.length),
    rubric: a.rubric,
    questions: questions.map(serializeQuestion),
    materials: materials.map((m) => ({
      id: m.id,
      assessmentId: m.assessmentId,
      kind: m.kind,
      title: m.title,
      sourceUrl: m.sourceUrl,
      author: m.author,
      contentText: m.contentText,
      wordCount: m.wordCount,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

router.patch("/studio/assessments/:id", auth, async (req, res) => {
  const a = await loadAssessmentForUser(String(req.params["id"]), res);
  if (!a) return;
  const b = req.body ?? {};
  const update: Partial<typeof studioAssessmentsTable.$inferInsert> = {};
  if (b.title != null) update.title = String(b.title).slice(0, 200);
  if (b.description !== undefined) update.description = b.description;
  if (b.subject !== undefined) update.subject = b.subject;
  if (b.gradeLevel !== undefined) update.gradeLevel = b.gradeLevel;
  if (b.rules != null) update.rules = String(b.rules);
  if (b.timeLimitMinutes != null)
    update.timeLimitMinutes = Number(b.timeLimitMinutes);
  if (b.passThreshold != null)
    update.passThreshold = String(Number(b.passThreshold));
  if (b.status != null) update.status = String(b.status);
  if (b.format != null) {
    const f = String(b.format);
    if (ALLOWED_FORMATS.has(f)) update.format = f;
  }
  if (b.maxAttempts != null) {
    const n = Number(b.maxAttempts);
    if (Number.isFinite(n)) {
      update.maxAttempts = Math.max(1, Math.min(99, Math.floor(n)));
    }
  }
  if (b.dueAt !== undefined) {
    update.dueAt =
      b.dueAt && typeof b.dueAt === "string" ? new Date(b.dueAt) : null;
  }
  if (b.allowedAnswerModes != null)
    update.allowedAnswerModes = b.allowedAnswerModes;
  if (b.proctoring != null) update.proctoring = b.proctoring;
  if (Object.keys(update).length === 0) {
    res.json(serializeAssessment(a));
    return;
  }
  const [row] = await db
    .update(studioAssessmentsTable)
    .set(update)
    .where(eq(studioAssessmentsTable.id, a.id))
    .returning();
  res.json(serializeAssessment(row!));
});

router.delete("/studio/assessments/:id", auth, async (req, res) => {
  const a = await loadAssessmentForUser(String(req.params["id"]), res);
  if (!a) return;
  await db
    .delete(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.id, a.id));
  res.json({ ok: true });
});

router.put("/studio/assessments/:id/rubric", auth, async (req, res) => {
  const a = await loadAssessmentForUser(String(req.params["id"]), res);
  if (!a) return;
  const rubric = req.body as StudioRubricJson;
  if (!rubric?.taxonomy || !Array.isArray(rubric.criteria)) {
    res.status(400).json({ error: "Invalid rubric" });
    return;
  }
  await db
    .update(studioAssessmentsTable)
    .set({ rubric })
    .where(eq(studioAssessmentsTable.id, a.id));
  res.json({ ok: true });
});

// ─────────────── materials ───────────────

router.get("/studio/assessments/:id/materials", auth, async (req, res) => {
  const a = await loadAssessmentForUser(String(req.params["id"]), res);
  if (!a) return;
  const rows = await db
    .select()
    .from(studioMaterialsTable)
    .where(eq(studioMaterialsTable.assessmentId, a.id))
    .orderBy(desc(studioMaterialsTable.createdAt));
  res.json(
    rows.map((m) => ({
      id: m.id,
      assessmentId: m.assessmentId,
      kind: m.kind,
      title: m.title,
      sourceUrl: m.sourceUrl,
      author: m.author,
      contentText: m.contentText,
      wordCount: m.wordCount,
      createdAt: m.createdAt.toISOString(),
    })),
  );
});

router.post("/studio/assessments/:id/materials", auth, async (req, res) => {
  const a = await loadAssessmentForUser(String(req.params["id"]), res);
  if (!a) return;
  const b = req.body ?? {};
  if (!b.kind || !b.title || !b.contentText) {
    res.status(400).json({ error: "kind, title, contentText required" });
    return;
  }
  const text = String(b.contentText);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const [row] = await db
    .insert(studioMaterialsTable)
    .values({
      id: randomUUID(),
      assessmentId: a.id,
      kind: String(b.kind),
      title: String(b.title).slice(0, 300),
      sourceUrl: b.sourceUrl ?? null,
      author: b.author ?? null,
      contentText: text.slice(0, 200_000),
      wordCount,
    })
    .returning();
  await awardEducatorXp(getRouteUser(res).id, "material_added").catch((err) =>
    req.log.warn({ err }, "xp award failed"),
  );
  res.status(201).json({
    id: row!.id,
    assessmentId: row!.assessmentId,
    kind: row!.kind,
    title: row!.title,
    sourceUrl: row!.sourceUrl,
    author: row!.author,
    contentText: row!.contentText,
    wordCount: row!.wordCount,
    createdAt: row!.createdAt.toISOString(),
  });
});

router.delete("/studio/materials/:id", auth, async (req, res) => {
  const matId = String(req.params["id"]);
  const [m] = await db
    .select()
    .from(studioMaterialsTable)
    .where(eq(studioMaterialsTable.id, matId));
  if (!m) {
    res.status(404).json({ error: "Material not found" });
    return;
  }
  const a = await loadAssessmentForUser(m.assessmentId, res);
  if (!a) return;
  await db.delete(studioMaterialsTable).where(eq(studioMaterialsTable.id, matId));
  res.json({ ok: true });
});

// ─────────────── research agent ───────────────

router.post("/studio/assessments/:id/research", auth, async (req, res) => {
  const a = await loadAssessmentForUser(String(req.params["id"]), res);
  if (!a) return;
  const b = req.body ?? {};
  if (!b.topic) {
    res.status(400).json({ error: "topic required" });
    return;
  }
  try {
    const sources = await researchTopic(String(b.topic), {
      includeWeb: b.includeWeb !== false,
      includeYouTube: b.includeYouTube !== false,
      includeEbooks: b.includeEbooks !== false,
      maxResults: Number(b.maxResults ?? 6),
    });
    res.json({
      topic: String(b.topic),
      sources: sources.map((s) => ({
        kind: s.kind,
        title: s.title,
        sourceUrl: s.sourceUrl,
        author: s.author,
        snippet: s.snippet,
        contentText: s.contentText,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "studio research failed");
    res.status(500).json({ error: "Research failed" });
  }
});

// ─────────────── question generation + CRUD ───────────────

router.post(
  "/studio/assessments/:id/generate-questions",
  auth,
  async (req, res) => {
    const a = await loadAssessmentForUser(String(req.params["id"]), res);
    if (!a) return;
    const b = req.body ?? {};
    const materialIds: string[] = b.materialIds ?? [];
    if (!Array.isArray(materialIds) || materialIds.length === 0) {
      res.status(400).json({ error: "Select at least one material" });
      return;
    }
    const types: StudioQuestionType[] = b.types ?? [];
    const targetLevels: number[] = b.targetLevels ?? [];
    const count = Math.min(Math.max(Number(b.count ?? 5), 1), 30);

    const materials = await db
      .select()
      .from(studioMaterialsTable)
      .where(
        and(
          eq(studioMaterialsTable.assessmentId, a.id),
          inArray(studioMaterialsTable.id, materialIds),
        ),
      );
    if (materials.length === 0) {
      res.status(400).json({ error: "Materials not found" });
      return;
    }

    try {
      const drafts = await generateStudioQuestions({
        taxonomy: a.rubric.taxonomy as StudioTaxonomyKind,
        rubricCriteria: a.rubric.criteria.map((c) => ({
          id: c.id,
          label: c.label,
          description: c.description,
          targetLevel: c.targetLevel,
        })),
        materials: materials.map((m) => ({
          title: m.title,
          contentText: m.contentText,
        })),
        types,
        targetLevels,
        count,
        instructions: b.instructions ?? null,
      });

      const existing = await db
        .select()
        .from(studioQuestionsTable)
        .where(eq(studioQuestionsTable.assessmentId, a.id));
      let order = existing.length;
      const inserted: StudioQuestionRow[] = [];
      for (const d of drafts) {
        const [row] = await db
          .insert(studioQuestionsTable)
          .values({
            id: randomUUID(),
            assessmentId: a.id,
            orderIndex: order++,
            type: d.type,
            prompt: d.prompt,
            context: d.context ?? null,
            options: d.options ?? [],
            modelAnswer: d.modelAnswer ?? null,
            rubricCriterionIds: d.rubricCriterionIds ?? [],
            taxonomyLevel: d.taxonomyLevel ?? 1,
            points: String(d.points ?? 1),
          })
          .returning();
        if (row) inserted.push(row);
      }
      res.json(inserted.map(serializeQuestion));
    } catch (err) {
      req.log.error({ err }, "studio question generation failed");
      res.status(500).json({ error: "Generation failed" });
    }
  },
);

router.get("/studio/assessments/:id/questions", auth, async (req, res) => {
  const a = await loadAssessmentForUser(String(req.params["id"]), res);
  if (!a) return;
  const rows = await db
    .select()
    .from(studioQuestionsTable)
    .where(eq(studioQuestionsTable.assessmentId, a.id))
    .orderBy(studioQuestionsTable.orderIndex);
  res.json(rows.map(serializeQuestion));
});

router.post("/studio/assessments/:id/questions", auth, async (req, res) => {
  const a = await loadAssessmentForUser(String(req.params["id"]), res);
  if (!a) return;
  const b = req.body ?? {};
  const existing = await db
    .select()
    .from(studioQuestionsTable)
    .where(eq(studioQuestionsTable.assessmentId, a.id));
  const [row] = await db
    .insert(studioQuestionsTable)
    .values({
      id: randomUUID(),
      assessmentId: a.id,
      orderIndex: b.orderIndex ?? existing.length,
      type: String(b.type),
      prompt: String(b.prompt),
      context: b.context ?? null,
      options: b.options ?? [],
      modelAnswer: b.modelAnswer ?? null,
      rubricCriterionIds: b.rubricCriterionIds ?? [],
      taxonomyLevel: Number(b.taxonomyLevel ?? 1),
      points: String(Number(b.points ?? 1)),
    })
    .returning();
  await awardEducatorXp(getRouteUser(res).id, "question_created").catch((err) =>
    req.log.warn({ err }, "xp award failed"),
  );
  res.status(201).json(serializeQuestion(row!));
});

async function loadQuestionForUser(
  questionId: string,
  res: Response,
): Promise<{ q: StudioQuestionRow; a: StudioAssessmentRow } | null> {
  const [q] = await db
    .select()
    .from(studioQuestionsTable)
    .where(eq(studioQuestionsTable.id, questionId));
  if (!q) {
    res.status(404).json({ error: "Question not found" });
    return null;
  }
  const a = await loadAssessmentForUser(q.assessmentId, res);
  if (!a) return null;
  return { q, a };
}

router.patch("/studio/questions/:id", auth, async (req, res) => {
  const ctx = await loadQuestionForUser(String(req.params["id"]), res);
  if (!ctx) return;
  const b = req.body ?? {};
  const update: Partial<typeof studioQuestionsTable.$inferInsert> = {};
  if (b.type != null) update.type = String(b.type);
  if (b.prompt != null) update.prompt = String(b.prompt);
  if (b.context !== undefined) update.context = b.context;
  if (b.options != null) update.options = b.options;
  if (b.modelAnswer !== undefined) update.modelAnswer = b.modelAnswer;
  if (b.rubricCriterionIds != null)
    update.rubricCriterionIds = b.rubricCriterionIds;
  if (b.taxonomyLevel != null) update.taxonomyLevel = Number(b.taxonomyLevel);
  if (b.points != null) update.points = String(Number(b.points));
  if (b.orderIndex != null) update.orderIndex = Number(b.orderIndex);
  const [row] = await db
    .update(studioQuestionsTable)
    .set(update)
    .where(eq(studioQuestionsTable.id, ctx.q.id))
    .returning();
  res.json(serializeQuestion(row!));
});

router.delete("/studio/questions/:id", auth, async (req, res) => {
  const ctx = await loadQuestionForUser(String(req.params["id"]), res);
  if (!ctx) return;
  await db
    .delete(studioQuestionsTable)
    .where(eq(studioQuestionsTable.id, ctx.q.id));
  res.json({ ok: true });
});

// ─────────────── educator: attempts + insights ───────────────

router.get("/studio/assessments/:id/attempts", auth, async (req, res) => {
  const a = await loadAssessmentForUser(String(req.params["id"]), res);
  if (!a) return;
  const rows = await db
    .select()
    .from(studioAttemptsTable)
    .where(eq(studioAttemptsTable.assessmentId, a.id))
    .orderBy(desc(studioAttemptsTable.startedAt));
  res.json(rows.map(serializeAttempt));
});

router.get("/studio/assessments/:id/insights", auth, async (req, res) => {
  const a = await loadAssessmentForUser(String(req.params["id"]), res);
  if (!a) return;

  const attempts = await db
    .select()
    .from(studioAttemptsTable)
    .where(eq(studioAttemptsTable.assessmentId, a.id));
  const finished = attempts.filter((x) => x.status === "finished");
  const attemptIds = finished.map((x) => x.id);
  const allAnswers =
    attemptIds.length === 0
      ? []
      : await db
          .select()
          .from(studioAnswersTable)
          .where(inArray(studioAnswersTable.attemptId, attemptIds));

  // Per-criterion aggregation per attempt, then average across attempts.
  const perAttemptCriterion = new Map<string, Map<string, { sum: number; n: number }>>();
  for (const ans of allAnswers) {
    let map = perAttemptCriterion.get(ans.attemptId);
    if (!map) {
      map = new Map();
      perAttemptCriterion.set(ans.attemptId, map);
    }
    for (const cs of ans.criterionScores) {
      const slot = map.get(cs.criterionId) ?? { sum: 0, n: 0 };
      slot.sum += cs.score;
      slot.n += 1;
      map.set(cs.criterionId, slot);
    }
  }

  const criterionTotals = new Map<string, { sum: number; n: number }>();
  for (const map of perAttemptCriterion.values()) {
    for (const [cid, slot] of map) {
      const avg = slot.n === 0 ? 0 : slot.sum / slot.n;
      const t = criterionTotals.get(cid) ?? { sum: 0, n: 0 };
      t.sum += avg;
      t.n += 1;
      criterionTotals.set(cid, t);
    }
  }

  const ai = await analyzeCohort({
    assessmentTitle: a.title,
    taxonomy: a.rubric.taxonomy as StudioTaxonomyKind,
    rubricCriteria: a.rubric.criteria.map((c) => ({
      id: c.id,
      label: c.label,
      targetLevel: c.targetLevel,
    })),
    attempts: finished.map((x) => ({
      studentName: x.studentName,
      score: x.score == null ? null : n(x.score),
      maxScore: x.maxScore == null ? null : n(x.maxScore),
      passed: x.passed,
      perCriterion: Array.from(
        perAttemptCriterion.get(x.id)?.entries() ?? [],
      ).map(([cid, s]) => ({
        criterionId: cid,
        avg: s.n === 0 ? 0 : s.sum / s.n,
      })),
    })),
  });

  const breakdown = a.rubric.criteria.map((c) => {
    const t = criterionTotals.get(c.id);
    return {
      criterionId: c.id,
      criterionLabel: c.label,
      avgScorePct: t && t.n > 0 ? (t.sum / t.n) * 100 : 0,
      attemptsScored: t?.n ?? 0,
    };
  });

  res.json({
    cohortSummary: ai.cohortSummary,
    strengths: ai.strengths,
    gaps: ai.gaps,
    recommendations: ai.recommendations,
    criterionBreakdown: breakdown,
  });
});

// ─────────────── public: join + take ───────────────

router.get("/studio/by-code/:code", async (req, res) => {
  const code = String(String(req.params["code"] ?? "")).toUpperCase();
  const [a] = await db
    .select()
    .from(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.code, code));
  if (!a) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }
  if (a.status !== "open") {
    res.status(403).json({ error: "Assessment is not open" });
    return;
  }
  const qs = await db
    .select()
    .from(studioQuestionsTable)
    .where(eq(studioQuestionsTable.assessmentId, a.id));
  res.json(publicAssessment(a, qs.length));
});

router.post("/studio/by-code/:code/attempts", async (req, res) => {
  const code = String(String(req.params["code"] ?? "")).toUpperCase();
  const b = req.body ?? {};
  if (!b.studentName) {
    res.status(400).json({ error: "studentName required" });
    return;
  }
  const [a] = await db
    .select()
    .from(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.code, code));
  if (!a) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }
  if (a.status !== "open") {
    res.status(403).json({ error: "Assessment is not open" });
    return;
  }
  // Enforce due date
  if (a.dueAt && a.dueAt.getTime() < Date.now()) {
    res.status(403).json({
      error: "This assessment is past its due date",
      code: "PAST_DUE",
      dueAt: a.dueAt.toISOString(),
    });
    return;
  }
  // Enforce max attempts per student (identified by name + optional email)
  const studentName = String(b.studentName).slice(0, 200);
  const studentEmail = b.studentEmail ? String(b.studentEmail).slice(0, 200) : null;
  const limit = a.maxAttempts ?? 1;
  if (limit > 0) {
    const prior = await db
      .select({ id: studioAttemptsTable.id })
      .from(studioAttemptsTable)
      .where(
        and(
          eq(studioAttemptsTable.assessmentId, a.id),
          eq(studioAttemptsTable.studentName, studentName),
          studentEmail
            ? eq(studioAttemptsTable.studentEmail, studentEmail)
            : eq(studioAttemptsTable.studentName, studentName),
        ),
      );
    if (prior.length >= limit) {
      res.status(403).json({
        error: `You've reached the maximum of ${limit} attempt${limit === 1 ? "" : "s"} for this assessment`,
        code: "MAX_ATTEMPTS_REACHED",
        maxAttempts: limit,
        priorCount: prior.length,
      });
      return;
    }
  }
  const id = randomUUID();
  const [row] = await db
    .insert(studioAttemptsTable)
    .values({
      id,
      assessmentId: a.id,
      studentName,
      studentEmail,
      topicsHint: b.topicsHint ? String(b.topicsHint).slice(0, 1000) : null,
      status: "active",
    })
    .returning();
  res.status(201).json({ ...serializeAttempt(row!), accessToken: generateAttemptToken(id) });
});

router.get("/studio/attempts/:id", async (req, res) => {
  const id = String(req.params["id"]);
  const attempt = await attemptOpen(id);
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (!(await checkAttemptAccess(attempt, req, res))) return;
  const [a] = await db
    .select()
    .from(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.id, attempt.assessmentId));
  if (!a) {
    res.status(404).json({ error: "Assessment missing" });
    return;
  }
  const [questions, answers] = await Promise.all([
    db
      .select()
      .from(studioQuestionsTable)
      .where(eq(studioQuestionsTable.assessmentId, a.id))
      .orderBy(studioQuestionsTable.orderIndex),
    db
      .select()
      .from(studioAnswersTable)
      .where(eq(studioAnswersTable.attemptId, attempt.id)),
  ]);

  // Strip isCorrect from options before sending to the student.
  const safeQuestions = questions.map((q) => ({
    ...serializeQuestion(q),
    options: q.options.map((o) => ({
      id: o.id,
      text: o.text,
      isCorrect: false,
    })),
    modelAnswer: null,
  }));

  res.json({
    ...serializeAttempt(attempt),
    assessment: publicAssessment(a, questions.length),
    questions: safeQuestions,
    answers: answers.map(serializeAnswer),
  });
});

router.post("/studio/attempts/:id/answers", async (req, res) => {
  const attempt = await attemptOpen(String(req.params["id"]));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (!(await checkAttemptAccess(attempt, req, res))) return;
  if (attempt.status !== "active") {
    res.status(409).json({ error: "Attempt is not active" });
    return;
  }
  const b = req.body ?? {};
  if (!b.questionId || !b.mode) {
    res.status(400).json({ error: "questionId and mode required" });
    return;
  }
  const [q] = await db
    .select()
    .from(studioQuestionsTable)
    .where(
      and(
        eq(studioQuestionsTable.id, b.questionId),
        eq(studioQuestionsTable.assessmentId, attempt.assessmentId),
      ),
    );
  if (!q) {
    res.status(404).json({ error: "Question not found" });
    return;
  }
  const [a] = await db
    .select()
    .from(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.id, attempt.assessmentId));
  if (!a) {
    res.status(404).json({ error: "Assessment missing" });
    return;
  }

  let marked = {
    score: null as number | null,
    feedback: null as string | null,
    criterionScores: [] as StudioCriterionScoreJson[],
    confidence: null as number | null,
    reasoning: null as string | null,
  };
  try {
    const r = await markStudioAnswer({
      taxonomy: a.rubric.taxonomy as StudioTaxonomyKind,
      question: {
        type: q.type as StudioQuestionType,
        prompt: q.prompt,
        context: q.context,
        options: q.options,
        modelAnswer: q.modelAnswer,
        points: n(q.points),
        taxonomyLevel: q.taxonomyLevel,
        rubricCriterionIds: q.rubricCriterionIds,
      },
      rubricCriteria: a.rubric.criteria,
      studentAnswer: {
        mode: b.mode as StudioAnswerMode,
        responseText: String(b.responseText ?? ""),
        selectedOptionIds: b.selectedOptionIds ?? [],
      },
    });
    marked = {
      score: r.score,
      feedback: r.feedback,
      criterionScores: r.criterionScores,
      confidence: r.confidence,
      reasoning: r.reasoning,
    };
  } catch (err) {
    req.log.warn({ err }, "studio mark failed; storing unscored");
  }

  // Upsert per (attemptId, questionId).
  const [existing] = await db
    .select()
    .from(studioAnswersTable)
    .where(
      and(
        eq(studioAnswersTable.attemptId, attempt.id),
        eq(studioAnswersTable.questionId, q.id),
      ),
    );
  if (existing) {
    const [row] = await db
      .update(studioAnswersTable)
      .set({
        mode: String(b.mode),
        responseText: String(b.responseText ?? ""),
        selectedOptionIds: b.selectedOptionIds ?? [],
        score: marked.score == null ? null : String(marked.score),
        maxScore: String(n(q.points)),
        aiFeedback: marked.feedback,
        criterionScores: marked.criterionScores,
        aiConfidence: marked.confidence == null ? null : String(marked.confidence),
        aiReasoning: marked.reasoning,
        manualOverride: false,
        submittedAt: new Date(),
      })
      .where(eq(studioAnswersTable.id, existing.id))
      .returning();
    res.json(serializeAnswer(row!));
    return;
  }
  const [row] = await db
    .insert(studioAnswersTable)
    .values({
      id: randomUUID(),
      attemptId: attempt.id,
      questionId: q.id,
      mode: String(b.mode),
      responseText: String(b.responseText ?? ""),
      selectedOptionIds: b.selectedOptionIds ?? [],
      score: marked.score == null ? null : String(marked.score),
      maxScore: String(n(q.points)),
      aiFeedback: marked.feedback,
      criterionScores: marked.criterionScores,
      aiConfidence: marked.confidence == null ? null : String(marked.confidence),
      aiReasoning: marked.reasoning,
    })
    .returning();
  res.status(201).json(serializeAnswer(row!));
});

router.post("/studio/attempts/:id/transcribe", async (req, res) => {
  const attempt = await attemptOpen(String(req.params["id"]));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (!(await checkAttemptAccess(attempt, req, res))) return;
  const b = req.body ?? {};
  if (!b.audioDataUrl) {
    res.status(400).json({ error: "audioDataUrl required" });
    return;
  }
  try {
    const text = await transcribeAudioDataUrl(String(b.audioDataUrl));
    res.json({ text });
  } catch (err) {
    req.log.error({ err }, "transcription failed");
    res.status(500).json({ error: "Transcription failed" });
  }
});

router.post("/studio/attempts/:id/read-handwriting", async (req, res) => {
  const attempt = await attemptOpen(String(req.params["id"]));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (!(await checkAttemptAccess(attempt, req, res))) return;
  const b = req.body ?? {};
  if (!b.imageDataUrl) {
    res.status(400).json({ error: "imageDataUrl required" });
    return;
  }
  try {
    const out = await readHandwritingDataUrl(String(b.imageDataUrl));
    res.json(out);
  } catch (err) {
    req.log.error({ err }, "handwriting OCR failed");
    res.status(500).json({ error: "OCR failed" });
  }
});

router.post("/studio/attempts/:id/finish", async (req, res) => {
  const attempt = await attemptOpen(String(req.params["id"]));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (!(await checkAttemptAccess(attempt, req, res))) return;
  const [a] = await db
    .select()
    .from(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.id, attempt.assessmentId));
  if (!a) {
    res.status(404).json({ error: "Assessment missing" });
    return;
  }
  const questions = await db
    .select()
    .from(studioQuestionsTable)
    .where(eq(studioQuestionsTable.assessmentId, a.id));
  const answers = await db
    .select()
    .from(studioAnswersTable)
    .where(eq(studioAnswersTable.attemptId, attempt.id));

  let total = 0;
  let max = 0;
  for (const q of questions) {
    max += n(q.points);
    const ans = answers.find((x) => x.questionId === q.id);
    if (ans?.score != null) total += n(ans.score);
  }
  const passed = max > 0 && total / max >= n(a.passThreshold);

  let narrative = "";
  try {
    const out = await generateOverallNarrative({
      studentName: attempt.studentName,
      taxonomy: a.rubric.taxonomy as StudioTaxonomyKind,
      rubricCriteria: a.rubric.criteria.map((c) => ({
        id: c.id,
        label: c.label,
      })),
      perQuestion: questions.map((q) => {
        const ans = answers.find((x) => x.questionId === q.id);
        return {
          prompt: q.prompt,
          score: ans?.score == null ? 0 : n(ans.score),
          maxScore: n(q.points),
          feedback: ans?.aiFeedback ?? null,
        };
      }),
      totalScore: total,
      maxScore: max,
      passed,
    });
    narrative = out.overallNarrative;
  } catch (err) {
    req.log.warn({ err }, "narrative generation failed");
  }

  const finishedAt = new Date();
  const durationSeconds = Math.round(
    (finishedAt.getTime() - attempt.startedAt.getTime()) / 1000,
  );
  const scorePct = max > 0 ? total / max : 0;
  const { xpEarned, badgesEarned } = computeStudentGamification({
    scorePct,
    passed,
    flagCount: attempt.flagCount,
    durationSeconds,
    timeLimitSeconds: a.timeLimitMinutes * 60,
  });
  const [row] = await db
    .update(studioAttemptsTable)
    .set({
      finishedAt,
      durationSeconds,
      score: String(total),
      maxScore: String(max),
      passed,
      overallNarrative: narrative,
      status: "finished",
      xpEarned,
      badgesEarned,
    })
    .where(eq(studioAttemptsTable.id, attempt.id))
    .returning();
  res.json(await buildAttemptSummary(row!));
});

router.get("/studio/attempts/:id/summary", async (req, res) => {
  const attempt = await attemptOpen(String(req.params["id"]));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (!(await checkAttemptAccess(attempt, req, res))) return;
  try {
    res.json(await buildAttemptSummary(attempt));
  } catch (err) {
    req.log.error({ err }, "summary failed");
    res.status(404).json({ error: "Assessment missing" });
  }
});

// ─────────────── proctoring (public for students) ───────────────

router.post("/studio/attempts/:id/proctor-event", async (req, res) => {
  const attempt = await attemptOpen(String(req.params["id"]));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (!(await checkAttemptAccess(attempt, req, res))) return;
  if (attempt.status !== "active") {
    res.status(409).json({ error: "Attempt is not active" });
    return;
  }
  const b = req.body ?? {};
  if (!b.type || !b.message) {
    res.status(400).json({ error: "type and message required" });
    return;
  }
  const [row] = await db
    .insert(studioProctorEventsTable)
    .values({
      id: randomUUID(),
      attemptId: attempt.id,
      type: String(b.type),
      message: String(b.message),
      severity: String(b.severity ?? "info"),
    })
    .returning();
  if (b.severity === "warning" || b.severity === "critical") {
    await db
      .update(studioAttemptsTable)
      .set({ flagCount: attempt.flagCount + 1 })
      .where(eq(studioAttemptsTable.id, attempt.id));
  }
  res.status(201).json({
    id: row!.id,
    attemptId: row!.attemptId,
    type: row!.type,
    message: row!.message,
    severity: row!.severity,
    createdAt: row!.createdAt.toISOString(),
  });
});

router.post("/studio/attempts/:id/proctor-snapshot", async (req, res) => {
  const attempt = await attemptOpen(String(req.params["id"]));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  if (!(await checkAttemptAccess(attempt, req, res))) return;
  if (attempt.status !== "active") {
    res.status(409).json({ error: "Attempt is not active" });
    return;
  }
  const b = req.body ?? {};
  if (!b.imageDataUrl) {
    res.status(400).json({ error: "imageDataUrl required" });
    return;
  }
  let analysis = { faceCount: 0, analysis: "Snapshot stored.", flagged: false };
  try {
    analysis = await analyzeProctorSnapshot(String(b.imageDataUrl));
  } catch (err) {
    req.log.warn({ err }, "snapshot analysis failed");
  }
  const [row] = await db
    .insert(studioProctorSnapshotsTable)
    .values({
      id: randomUUID(),
      attemptId: attempt.id,
      imageDataUrl: String(b.imageDataUrl),
      faceCount: analysis.faceCount,
      analysis: analysis.analysis,
      flagged: analysis.flagged,
    })
    .returning();
  await db
    .update(studioAttemptsTable)
    .set({
      snapshotCount: attempt.snapshotCount + 1,
      flagCount: attempt.flagCount + (analysis.flagged ? 1 : 0),
    })
    .where(eq(studioAttemptsTable.id, attempt.id));
  res.status(201).json({
    id: row!.id,
    attemptId: row!.attemptId,
    imageDataUrl: row!.imageDataUrl,
    faceCount: row!.faceCount,
    analysis: row!.analysis,
    flagged: row!.flagged,
    createdAt: row!.createdAt.toISOString(),
  });
});

// Educator views of proctor data.
router.get("/studio/attempts/:id/proctor-events", auth, async (req, res) => {
  const attempt = await attemptOpen(String(req.params["id"]));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  const [a] = await db
    .select()
    .from(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.id, attempt.assessmentId));
  if (!a || !canManage(a, getRouteUser(res))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const rows = await db
    .select()
    .from(studioProctorEventsTable)
    .where(eq(studioProctorEventsTable.attemptId, attempt.id))
    .orderBy(desc(studioProctorEventsTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      attemptId: r.attemptId,
      type: r.type,
      message: r.message,
      severity: r.severity,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.get(
  "/studio/attempts/:id/proctor-snapshots",
  auth,
  async (req, res) => {
    const attempt = await attemptOpen(String(req.params["id"]));
    if (!attempt) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }
    const [a] = await db
      .select()
      .from(studioAssessmentsTable)
      .where(eq(studioAssessmentsTable.id, attempt.assessmentId));
    if (!a || !canManage(a, getRouteUser(res))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const rows = await db
      .select()
      .from(studioProctorSnapshotsTable)
      .where(eq(studioProctorSnapshotsTable.attemptId, attempt.id))
      .orderBy(desc(studioProctorSnapshotsTable.createdAt));
    res.json(
      rows.map((r) => ({
        id: r.id,
        attemptId: r.attemptId,
        imageDataUrl: r.imageDataUrl,
        faceCount: r.faceCount,
        analysis: r.analysis,
        flagged: r.flagged,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  },
);

// Educator: regrade and override.
router.post("/studio/attempts/:id/regrade", auth, async (req, res) => {
  const attempt = await attemptOpen(String(req.params["id"]));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  const [a] = await db
    .select()
    .from(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.id, attempt.assessmentId));
  if (!a || !canManage(a, getRouteUser(res))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const questions = await db
    .select()
    .from(studioQuestionsTable)
    .where(eq(studioQuestionsTable.assessmentId, a.id));
  const answers = await db
    .select()
    .from(studioAnswersTable)
    .where(eq(studioAnswersTable.attemptId, attempt.id));

  const toRegrade = answers
    .filter((ans) => !ans.manualOverride)
    .map((ans) => ({ ans, q: questions.find((x) => x.id === ans.questionId) }))
    .filter((p): p is { ans: typeof answers[number]; q: typeof questions[number] } => !!p.q);
  const REGRADE_CONCURRENCY = 5;
  const queue = [...toRegrade];
  async function worker() {
    while (queue.length > 0) {
      const job = queue.shift();
      if (!job) break;
      const { ans, q } = job;
      try {
        const r = await markStudioAnswer({
          taxonomy: a.rubric.taxonomy as StudioTaxonomyKind,
          question: {
            type: q.type as StudioQuestionType,
            prompt: q.prompt,
            context: q.context,
            options: q.options,
            modelAnswer: q.modelAnswer,
            points: n(q.points),
            taxonomyLevel: q.taxonomyLevel,
            rubricCriterionIds: q.rubricCriterionIds,
          },
          rubricCriteria: a.rubric.criteria,
          studentAnswer: {
            mode: ans.mode as StudioAnswerMode,
            responseText: ans.responseText,
            selectedOptionIds: ans.selectedOptionIds,
          },
        });
        await db
          .update(studioAnswersTable)
          .set({
            score: String(r.score),
            aiFeedback: r.feedback,
            criterionScores: r.criterionScores,
            aiConfidence: String(r.confidence),
            aiReasoning: r.reasoning,
          })
          .where(eq(studioAnswersTable.id, ans.id));
      } catch (err) {
        req.log.warn({ err, ansId: ans.id }, "regrade failed for answer");
      }
    }
  }
  await Promise.all(
    Array.from(
      { length: Math.min(REGRADE_CONCURRENCY, toRegrade.length) },
      () => worker(),
    ),
  );

  const updated = await recomputeAttemptTotals(attempt, a);
  res.json(await buildAttemptSummary(updated));
});

router.patch(
  "/studio/answers/:id/override",
  auth,
  async (req, res) => {
    const ansId = String(req.params["id"]);
    const [ans] = await db
      .select()
      .from(studioAnswersTable)
      .where(eq(studioAnswersTable.id, ansId));
    if (!ans) {
      res.status(404).json({ error: "Answer not found" });
      return;
    }
    const attempt = await attemptOpen(ans.attemptId);
    if (!attempt) {
      res.status(404).json({ error: "Attempt not found" });
      return;
    }
    const [a] = await db
      .select()
      .from(studioAssessmentsTable)
      .where(eq(studioAssessmentsTable.id, attempt.assessmentId));
    if (!a || !canManage(a, getRouteUser(res))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const b = req.body ?? {};
    if (b.score == null) {
      res.status(400).json({ error: "score required" });
      return;
    }
    await db
      .update(studioAnswersTable)
      .set({
        score: String(Number(b.score)),
        aiFeedback: b.feedback ?? ans.aiFeedback,
        manualOverride: true,
      })
      .where(eq(studioAnswersTable.id, ansId));
    const updated = await recomputeAttemptTotals(attempt, a);
    res.json(await buildAttemptSummary(updated));
  },
);

// Educator: sign off an attempt (clears it from the marking queue).
router.post("/studio/attempts/:id/sign-off", auth, async (req, res) => {
  const attempt = await attemptOpen(String(req.params["id"]));
  if (!attempt) {
    res.status(404).json({ error: "Attempt not found" });
    return;
  }
  const [a] = await db
    .select()
    .from(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.id, attempt.assessmentId));
  const user = getRouteUser(res);
  if (!a || !canManage(a, user)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const body = req.body ?? {};
  const undo = body.undo === true;
  const note =
    typeof body.note === "string" && body.note.trim().length > 0
      ? body.note.trim().slice(0, 1000)
      : null;
  await db
    .update(studioAttemptsTable)
    .set({
      reviewedAt: undo ? null : new Date(),
      reviewedBy: undo ? null : user.id,
      reviewNote: undo ? null : note,
    })
    .where(eq(studioAttemptsTable.id, attempt.id));
  const updated = await recomputeAttemptTotals(attempt, a);
  res.json(await buildAttemptSummary(updated));
});

// ─────────────── cross-assessment marking queue ───────────────

router.get("/studio/marking-queue", auth, async (req, res) => {
  const user = getRouteUser(res);
  const filter = String(req.query["filter"] ?? "all");

  // Load assessments owned by user (admin sees all)
  const assessments = await (user.role === "admin"
    ? db.select().from(studioAssessmentsTable)
    : db
        .select()
        .from(studioAssessmentsTable)
        .where(eq(studioAssessmentsTable.educatorUserId, user.id)));

  if (assessments.length === 0) {
    res.json([]);
    return;
  }

  const aById = new Map(assessments.map((a) => [a.id, a]));
  const ids = assessments.map((a) => a.id);

  const attempts = await db
    .select()
    .from(studioAttemptsTable)
    .where(inArray(studioAttemptsTable.assessmentId, ids))
    .orderBy(desc(studioAttemptsTable.startedAt));

  if (attempts.length === 0) {
    res.json([]);
    return;
  }

  const attemptIds = attempts.map((at) => at.id);
  const answers = await db
    .select()
    .from(studioAnswersTable)
    .where(inArray(studioAnswersTable.attemptId, attemptIds));

  const counts = new Map<
    string,
    { total: number; manual: number; ungraded: number }
  >();
  for (const ans of answers) {
    const c = counts.get(ans.attemptId) ?? {
      total: 0,
      manual: 0,
      ungraded: 0,
    };
    c.total += 1;
    if (ans.manualOverride) c.manual += 1;
    if (ans.score == null) c.ungraded += 1;
    counts.set(ans.attemptId, c);
  }

  const items = attempts
    .map((at) => {
      const a = aById.get(at.assessmentId);
      if (!a) return null;
      const c = counts.get(at.id) ?? { total: 0, manual: 0, ungraded: 0 };
      // Pending review = finished AND not yet signed-off AND
      // (ungraded answers OR proctor flags). AI-graded clean attempts
      // auto-clear; signing off removes the row regardless of flags.
      const needsReview =
        at.status === "finished" &&
        at.reviewedAt == null &&
        (c.ungraded > 0 || at.flagCount > 0);
      return {
        attemptId: at.id,
        assessmentId: a.id,
        assessmentTitle: a.title,
        assessmentCode: a.code,
        format: a.format ?? "exam",
        studentName: at.studentName,
        studentEmail: at.studentEmail,
        startedAt: at.startedAt.toISOString(),
        finishedAt: at.finishedAt ? at.finishedAt.toISOString() : null,
        status: at.status,
        score: at.score == null ? null : n(at.score),
        maxScore: at.maxScore == null ? null : n(at.maxScore),
        passed: at.passed,
        flagCount: at.flagCount,
        snapshotCount: at.snapshotCount,
        answerCount: c.total,
        manualOverrideCount: c.manual,
        needsReview,
        reviewedAt: at.reviewedAt ? at.reviewedAt.toISOString() : null,
        reviewedBy: at.reviewedBy ?? null,
        reviewNote: at.reviewNote ?? null,
      };
    })
    .filter(Boolean) as Array<{
    status: string;
    flagCount: number;
    manualOverrideCount: number;
    needsReview: boolean;
    reviewedAt: string | null;
  }>;

  let filtered = items;
  if (filter === "pending")
    filtered = items.filter((i) => i.needsReview);
  else if (filter === "flagged")
    filtered = items.filter((i) => i.flagCount > 0);
  else if (filter === "finished")
    filtered = items.filter((i) => i.status === "finished");
  else if (filter === "manual")
    filtered = items.filter((i) => i.manualOverrideCount > 0);

  res.json(filtered);
});

// ─────────────── gamification ───────────────

router.get("/studio/me/gamification", auth, async (_req, res) => {
  const user = getRouteUser(res);
  const row = await getEducatorXp(user.id);
  const badges = EDUCATOR_BADGE_TIERS.map((b) => ({
    id: b.id,
    label: b.label,
    description: b.description,
    earned: row.badges.includes(b.id),
  }));
  res.json({
    userId: row.userId,
    xp: row.xp,
    level: row.level,
    xpForNextLevel: xpForNextLevel(row.level),
    currentStreakDays: row.currentStreakDays,
    longestStreakDays: row.longestStreakDays,
    lastActivityDate: row.lastActivityDate,
    assessmentsCreated: row.assessmentsCreated,
    questionsCreated: row.questionsCreated,
    materialsCreated: row.materialsCreated,
    badges,
  });
});

router.get(
  "/studio/assessments/:id/leaderboard",
  async (req, res) => {
    const id = String(req.params["id"]);
    const [a] = await db
      .select()
      .from(studioAssessmentsTable)
      .where(eq(studioAssessmentsTable.id, id));
    if (!a) {
      res.status(404).json({ error: "Assessment not found" });
      return;
    }
    const rows = await db
      .select()
      .from(studioAttemptsTable)
      .where(
        and(
          eq(studioAttemptsTable.assessmentId, a.id),
          eq(studioAttemptsTable.status, "finished"),
        ),
      );
    const ranked = rows
      .map((r) => {
        const score = r.score == null ? 0 : n(r.score);
        const max = r.maxScore == null ? 0 : n(r.maxScore);
        return {
          studentName: r.studentName,
          score,
          maxScore: max,
          scorePct: max > 0 ? score / max : 0,
          passed: r.passed === true,
          xpEarned: r.xpEarned,
          badgesEarned: r.badgesEarned,
          durationSeconds: r.durationSeconds ?? 0,
          finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
        };
      })
      .sort((a1, b1) => {
        if (b1.scorePct !== a1.scorePct) return b1.scorePct - a1.scorePct;
        return a1.durationSeconds - b1.durationSeconds;
      })
      .slice(0, 50)
      .map((entry, i) => ({ rank: i + 1, ...entry }));
    res.json({
      assessmentId: a.id,
      assessmentTitle: a.title,
      entries: ranked,
    });
  },
);

router.get("/studio/badge-catalog", (_req, res) => {
  res.json({
    educator: EDUCATOR_BADGE_TIERS.map((b) => ({
      id: b.id,
      label: b.label,
      description: b.description,
    })),
    student: STUDENT_BADGE_TIERS.map((b) => ({
      id: b.id,
      label: b.label,
      description: b.description,
    })),
  });
});

// ─────────────── student question proposals (co-curation) ───────────────

router.post("/studio/by-code/:code/proposals", async (req, res) => {
  const code = String(req.params["code"] ?? "").toUpperCase();
  const b = req.body ?? {};
  if (!b.proposerName || !b.prompt) {
    res.status(400).json({ error: "proposerName and prompt required" });
    return;
  }
  const [a] = await db
    .select()
    .from(studioAssessmentsTable)
    .where(eq(studioAssessmentsTable.code, code));
  if (!a) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }
  if (a.status !== "open") {
    res.status(403).json({ error: "Assessment is not open for proposals" });
    return;
  }
  const [row] = await db
    .insert(studioQuestionProposalsTable)
    .values({
      id: randomUUID(),
      assessmentId: a.id,
      proposerName: String(b.proposerName).slice(0, 200),
      proposerEmail: b.proposerEmail ?? null,
      prompt: String(b.prompt).slice(0, 2000),
      suggestedType: String(b.suggestedType ?? "short_answer"),
      suggestedDifficulty: String(b.suggestedDifficulty ?? "medium"),
      suggestedRubricCriterionId: b.suggestedRubricCriterionId ?? null,
      rationale: b.rationale ? String(b.rationale).slice(0, 1000) : null,
      status: "pending",
    })
    .returning();
  res.status(201).json(serializeProposal(row!));
});

router.get(
  "/studio/assessments/:id/proposals",
  auth,
  async (req, res) => {
    const a = await loadAssessmentForUser(String(req.params["id"]), res);
    if (!a) return;
    const rows = await db
      .select()
      .from(studioQuestionProposalsTable)
      .where(eq(studioQuestionProposalsTable.assessmentId, a.id))
      .orderBy(desc(studioQuestionProposalsTable.createdAt));
    res.json(rows.map(serializeProposal));
  },
);

router.patch("/studio/proposals/:id", auth, async (req, res) => {
  const id = String(req.params["id"]);
  const [p] = await db
    .select()
    .from(studioQuestionProposalsTable)
    .where(eq(studioQuestionProposalsTable.id, id));
  if (!p) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }
  const a = await loadAssessmentForUser(p.assessmentId, res);
  if (!a) return;
  const user = getRouteUser(res);
  const b = req.body ?? {};
  const action = String(b.action ?? "");
  if (action !== "accept" && action !== "reject") {
    res.status(400).json({ error: "action must be 'accept' or 'reject'" });
    return;
  }
  if (p.status !== "pending") {
    res
      .status(409)
      .json({ error: `Proposal already ${p.status}` });
    return;
  }

  // Atomically claim the proposal: only proceed if status is still pending.
  const [claimed] = await db
    .update(studioQuestionProposalsTable)
    .set({
      status: action === "accept" ? "accepted" : "rejected",
      reviewedBy: user.id,
      reviewedAt: new Date(),
    })
    .where(
      and(
        eq(studioQuestionProposalsTable.id, p.id),
        eq(studioQuestionProposalsTable.status, "pending"),
      ),
    )
    .returning();
  if (!claimed) {
    res.status(409).json({ error: "Proposal already reviewed" });
    return;
  }

  let acceptedQuestionId: string | null = null;
  if (action === "accept") {
    const existing = await db
      .select()
      .from(studioQuestionsTable)
      .where(eq(studioQuestionsTable.assessmentId, a.id));
    const taxonomyLevel = Number(b.taxonomyLevel ?? 2);
    const points = Number(b.points ?? 1);
    const rubricCriterionIds: string[] =
      Array.isArray(b.rubricCriterionIds) && b.rubricCriterionIds.length > 0
        ? b.rubricCriterionIds
        : p.suggestedRubricCriterionId
          ? [p.suggestedRubricCriterionId]
          : [];
    const [q] = await db
      .insert(studioQuestionsTable)
      .values({
        id: randomUUID(),
        assessmentId: a.id,
        orderIndex: existing.length,
        type: p.suggestedType,
        prompt: p.prompt,
        context: `Proposed by ${p.proposerName}`,
        options: [],
        modelAnswer: null,
        rubricCriterionIds,
        taxonomyLevel,
        points: String(points),
      })
      .returning();
    acceptedQuestionId = q!.id;
    await db
      .update(studioQuestionProposalsTable)
      .set({ acceptedQuestionId })
      .where(eq(studioQuestionProposalsTable.id, p.id));
    await awardEducatorXp(user.id, "question_created").catch((err) =>
      req.log.warn({ err }, "xp award failed"),
    );
  }

  res.json(
    serializeProposal({ ...claimed, acceptedQuestionId }),
  );
});

// ─────────────── educator analytics ───────────────
//
// Cross-assessment performance dashboard. Owner-or-admin scoped. Returns
// per-assessment totals (attempts, pass rate, avg score) plus the 5 weakest
// questions across the educator's catalogue (lowest pass rate, min 3 graded
// answers). Computed in-process — no AI calls — so it's cheap to call often.
router.get("/studio/analytics", auth, async (_req, res) => {
  const user = getRouteUser(res);
  const assessments = await (user.role === "admin"
    ? db.select().from(studioAssessmentsTable)
    : db
        .select()
        .from(studioAssessmentsTable)
        .where(eq(studioAssessmentsTable.educatorUserId, user.id)));
  const aIds = assessments.map((a) => a.id);

  const attempts = aIds.length
    ? await db
        .select()
        .from(studioAttemptsTable)
        .where(inArray(studioAttemptsTable.assessmentId, aIds))
    : [];
  const finishedAttempts = attempts.filter((a) => a.status === "finished");

  const answers = aIds.length
    ? await db
        .select({
          attemptId: studioAnswersTable.attemptId,
          questionId: studioAnswersTable.questionId,
          score: studioAnswersTable.score,
          maxScore: studioAnswersTable.maxScore,
        })
        .from(studioAnswersTable)
        .where(
          inArray(
            studioAnswersTable.attemptId,
            finishedAttempts.map((a) => a.id).length
              ? finishedAttempts.map((a) => a.id)
              : [""],
          ),
        )
    : [];

  const questions = aIds.length
    ? await db
        .select({
          id: studioQuestionsTable.id,
          assessmentId: studioQuestionsTable.assessmentId,
          prompt: studioQuestionsTable.prompt,
          taxonomyLevel: studioQuestionsTable.taxonomyLevel,
        })
        .from(studioQuestionsTable)
        .where(inArray(studioQuestionsTable.assessmentId, aIds))
    : [];

  const n = (v: string | null) => (v == null ? 0 : Number(v));

  // Per-assessment rollup.
  const byAssessment = assessments
    .map((a) => {
      const myAttempts = attempts.filter((at) => at.assessmentId === a.id);
      const myFinished = myAttempts.filter((at) => at.status === "finished");
      const totalScorePct = myFinished
        .map((at) => {
          const max = n(at.maxScore);
          return max > 0 ? (n(at.score) / max) * 100 : 0;
        })
        .reduce((s, v) => s + v, 0);
      const passed = myFinished.filter((at) => at.passed === true).length;
      return {
        assessmentId: a.id,
        assessmentTitle: a.title,
        assessmentCode: a.code,
        format: a.format ?? "exam",
        totalAttempts: myAttempts.length,
        finishedAttempts: myFinished.length,
        averageScorePercent:
          myFinished.length > 0
            ? Math.round((totalScorePct / myFinished.length) * 10) / 10
            : null,
        passRate:
          myFinished.length > 0
            ? Math.round((passed / myFinished.length) * 1000) / 10
            : null,
        flagCount: myAttempts.reduce((s, at) => s + at.flagCount, 0),
        pendingReview: myFinished.filter(
          (at) =>
            at.reviewedAt == null &&
            (at.passed == null || at.flagCount > 0),
        ).length,
      };
    })
    .sort((a, b) => b.totalAttempts - a.totalAttempts);

  // Weakest questions (most missed). Aggregate per questionId.
  const perQ = new Map<
    string,
    { id: string; total: number; correctish: number; sumPct: number }
  >();
  for (const ans of answers) {
    const max = n(ans.maxScore);
    const got = n(ans.score);
    if (max <= 0) continue;
    const pct = (got / max) * 100;
    const row = perQ.get(ans.questionId) ?? {
      id: ans.questionId,
      total: 0,
      correctish: 0,
      sumPct: 0,
    };
    row.total += 1;
    row.sumPct += pct;
    if (pct >= 60) row.correctish += 1;
    perQ.set(ans.questionId, row);
  }
  const qById = new Map(questions.map((q) => [q.id, q]));
  const weakest = [...perQ.values()]
    .filter((r) => r.total >= 3)
    .map((r) => {
      const q = qById.get(r.id);
      const a = q ? assessments.find((x) => x.id === q.assessmentId) : null;
      return {
        questionId: r.id,
        prompt: q?.prompt ?? "(deleted question)",
        assessmentId: a?.id ?? "",
        assessmentTitle: a?.title ?? "(unknown)",
        taxonomyLevel: q?.taxonomyLevel ?? 0,
        attempts: r.total,
        averageScorePercent: Math.round((r.sumPct / r.total) * 10) / 10,
        passRate: Math.round((r.correctish / r.total) * 1000) / 10,
      };
    })
    .sort((a, b) => a.passRate - b.passRate)
    .slice(0, 8);

  const totals = {
    assessments: assessments.length,
    attempts: attempts.length,
    finished: finishedAttempts.length,
    pendingReview: byAssessment.reduce((s, a) => s + a.pendingReview, 0),
    flagged: byAssessment.reduce((s, a) => s + a.flagCount, 0),
    passRate:
      finishedAttempts.length > 0
        ? Math.round(
            (finishedAttempts.filter((a) => a.passed === true).length /
              finishedAttempts.length) *
              1000,
          ) / 10
        : null,
  };

  res.json({ totals, byAssessment, weakestQuestions: weakest });
});

// GET /studio/me/attempts has been removed.
// Cross-educator email-based lookup exposed private student records to any
// caller who knew the email address. Students receive their accessToken when
// they create an attempt and must keep it to access their own results.

export default router;
