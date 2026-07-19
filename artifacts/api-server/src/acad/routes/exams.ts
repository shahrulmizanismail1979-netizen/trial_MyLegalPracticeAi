import { db } from "@workspace/db";
import { Router, type IRouter } from "express";
import { eq, desc, and, asc, inArray, sql, notInArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  appsTable,
  examSessionsTable,
  examQuestionsTable,
  examTemplatesTable,
  proctorEventsTable,
  questionBankTable,
  type ExamSession,
  type ExamQuestion,
  type ExamTemplate,
  type ProctorEvent,
} from "@workspace/db/acad";
import {
  GetExamParams,
  GetExamResponse,
  ListExamsResponse,
  ListExamQuestionsParams,
  ListExamQuestionsResponse,
  GenerateNextQuestionParams,
  GenerateNextQuestionResponse,
  SubmitAnswerParams,
  SubmitAnswerBody,
  SubmitAnswerResponse,
  RequestHintParams,
  RequestHintResponse,
  ExplainQuestionParams,
  ExplainQuestionResponse,
  FinishExamParams,
  FinishExamResponse,
  GetExamSummaryParams,
  GetExamSummaryResponse,
  SubmitProctorEventParams,
  SubmitProctorEventBody,
  SubmitProctorEventResponse,
  ListProctorEventsParams,
  ListProctorEventsResponse,
  GetLeaderboardResponse,
} from "../zod";
import {
  generateQuestion,
  gradeAnswer,
  generateHint,
  explainAnswer,
  generateExamSummary,
  truncateAnswer,
  type AppContext,
  type AIQuestionDraft,
} from "../lib/ai";
import { seedQuestionBank } from "../lib/seedQuestionBank";
import { requireAdminUser, getSessionUser } from "../lib/auth";
import { verifyAttemptToken } from "../lib/attempt-token";

const router: IRouter = Router();

/**
 * Access control for candidate-facing exam-session routes (/exams/:id*).
 * Two ways in, mirroring the studio attempt guard:
 *  1. Any authenticated server user (examiner/admin) — session cookie.
 *  2. The candidate holding the X-Attempt-Token issued when they joined the
 *     exam (HMAC of the session id). Possession of the session UUID alone is
 *     NOT sufficient.
 */
router.use("/exams/:id", async (req, res, next) => {
  const sessionUser = await getSessionUser(req);
  if (sessionUser) return next();
  const token = String(req.headers["x-attempt-token"] ?? "").trim();
  const id = String(req.params.id ?? "");
  if (token && id && verifyAttemptToken(id, token)) return next();
  res.status(401).json({ error: "Attempt token required" });
});

function appCtx(app: typeof appsTable.$inferSelect): AppContext {
  return {
    slug: app.slug,
    name: app.name,
    domain: app.domain,
    tagline: app.tagline,
    description: app.description,
    category: app.category,
    features: app.features,
  };
}

/**
 * Build a degraded AppContext from a stored question row when the original
 * app row no longer exists (e.g. the seed catalog was pruned after the
 * question was generated). Grading can still proceed against the question's
 * stored correctAnswer; AI grading just lacks rich feature context.
 */
function fallbackAppCtxFromQuestion(question: ExamQuestion): AppContext {
  return {
    slug: question.appSlug,
    name: question.appName,
    domain: "",
    tagline: "",
    description: `Legacy reference to ${question.appName}. The full app catalog entry is no longer available; grading uses the stored correct answer as ground truth.`,
    category: "Legacy",
    features: [],
  };
}

async function loadAppCtxForQuestion(question: ExamQuestion): Promise<AppContext> {
  const [app] = await db
    .select()
    .from(appsTable)
    .where(eq(appsTable.slug, question.appSlug));
  return app ? appCtx(app) : fallbackAppCtxFromQuestion(question);
}

export function serializeSession(s: ExamSession) {
  return {
    id: s.id,
    examTemplateId: s.examTemplateId,
    candidateName: s.candidateName,
    candidateEmail: s.candidateEmail,
    appSlugs: s.appSlugs,
    questionsPerApp: s.questionsPerApp,
    totalQuestions: s.totalQuestions,
    questionTypes: s.questionTypes,
    difficulty: s.difficulty,
    timeLimitMinutes: s.timeLimitMinutes,
    status: s.status,
    score: s.score,
    maxScore: s.maxScore,
    answeredCount: s.answeredCount,
    correctCount: s.correctCount,
    trustScore: s.trustScore,
    flagged: s.flagged,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt ? s.completedAt.toISOString() : null,
  };
}

export function serializeQuestion(q: ExamQuestion) {
  return {
    id: q.id,
    sessionId: q.sessionId,
    appSlug: q.appSlug,
    appName: q.appName,
    index: q.index,
    type: q.type,
    difficulty: q.difficulty,
    prompt: q.prompt,
    options: q.options,
    matchingPairs: q.matchingPairs,
    scenario: q.scenario,
    userAnswer: q.userAnswer,
    isCorrect: q.isCorrect,
    score: q.score,
    feedback: q.feedback,
    criterionScores: q.criterionScores ?? [],
    aiConfidence: q.aiConfidence,
    hintUsed: q.hintUsed,
    points: q.points,
    createdAt: q.createdAt.toISOString(),
  };
}

function serializeProctorEvent(e: ProctorEvent) {
  return {
    id: e.id,
    sessionId: e.sessionId,
    kind: e.kind,
    severity: e.severity,
    details: e.details,
    createdAt: e.createdAt.toISOString(),
  };
}

// Admin-only — this lists EVERY candidate's exam session across all
// teachers (names, scores, status). Anyone with the URL could otherwise
// scrape the full candidate roll, so it sits behind the session-based
// admin guard rather than the per-request x-admin-secret header used by
// the question-bank cron endpoints.
router.get("/exams", requireAdminUser(), async (_req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(examSessionsTable)
    .orderBy(desc(examSessionsTable.startedAt))
    .limit(100);
  res.json(ListExamsResponse.parse(sessions.map(serializeSession)));
});

router.get("/exams/:id", async (req, res): Promise<void> => {
  const params = GetExamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [session] = await db
    .select()
    .from(examSessionsTable)
    .where(eq(examSessionsTable.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  res.json(GetExamResponse.parse(serializeSession(session)));
});

router.get("/exams/:id/questions", async (req, res): Promise<void> => {
  const params = ListExamQuestionsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const questions = await db
    .select()
    .from(examQuestionsTable)
    .where(eq(examQuestionsTable.sessionId, params.data.id))
    .orderBy(asc(examQuestionsTable.index));
  res.json(ListExamQuestionsResponse.parse(questions.map(serializeQuestion)));
});

router.post("/exams/:id/next-question", async (req, res): Promise<void> => {
  const params = GenerateNextQuestionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [session] = await db
    .select()
    .from(examSessionsTable)
    .where(eq(examSessionsTable.id, params.data.id));
  if (!session) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  if (session.status !== "in_progress") {
    res.status(400).json({ error: "Exam is not in progress" });
    return;
  }
  const existing = await db
    .select()
    .from(examQuestionsTable)
    .where(eq(examQuestionsTable.sessionId, session.id))
    .orderBy(asc(examQuestionsTable.index));
  if (existing.length >= session.totalQuestions) {
    res.status(400).json({ error: "All questions already generated" });
    return;
  }
  const apps = await db.select().from(appsTable);
  const appBySlug = new Map(apps.map((a) => [a.slug, a]));

  // Tolerate stale slugs in older sessions (apps may have been pruned from
  // the catalog after this session was created). Skip slugs whose app row no
  // longer exists so the candidate can still progress through the remaining
  // valid apps.
  const validSessionSlugs = session.appSlugs.filter((slug) =>
    appBySlug.has(slug),
  );
  if (validSessionSlugs.length === 0) {
    res
      .status(400)
      .json({ error: "No apps in this exam are available anymore" });
    return;
  }

  const counts = new Map<string, number>();
  for (const slug of validSessionSlugs) counts.set(slug, 0);
  for (const q of existing) {
    if (counts.has(q.appSlug)) {
      counts.set(q.appSlug, (counts.get(q.appSlug) ?? 0) + 1);
    }
  }

  let chosenSlug: string | null = null;
  for (const slug of validSessionSlugs) {
    if ((counts.get(slug) ?? 0) < session.questionsPerApp) {
      chosenSlug = slug;
      break;
    }
  }
  if (!chosenSlug) {
    res.status(400).json({ error: "No more questions to generate" });
    return;
  }
  const app = appBySlug.get(chosenSlug);
  if (!app) {
    res.status(400).json({ error: `Unknown app: ${chosenSlug}` });
    return;
  }

  const types = session.questionTypes as AIQuestionDraft["type"][];
  const type = types[existing.length % types.length] ?? "multiple_choice";
  const difficulty = session.difficulty as "easy" | "medium" | "hard";

  const previousPrompts = existing
    .filter((q) => q.appSlug === chosenSlug)
    .map((q) => q.prompt);

  // Try the question bank first. Skip prompts already shown in this session
  // so candidates never see duplicates within one attempt.
  const usedPromptsThisSession = existing.map((q) => q.prompt);
  let draft: AIQuestionDraft | null = null;

  // Tier 1: exact (type + difficulty) match from the bank.
  const tier1 = await db
    .select()
    .from(questionBankTable)
    .where(
      and(
        eq(questionBankTable.appSlug, app.slug),
        eq(questionBankTable.type, type),
        eq(questionBankTable.difficulty, difficulty),
        eq(questionBankTable.active, true),
        usedPromptsThisSession.length > 0
          ? notInArray(questionBankTable.prompt, usedPromptsThisSession)
          : sql`true`,
      ),
    )
    .orderBy(sql`random()`)
    .limit(1);

  // Tier 2: same type, any difficulty (still product-knowledge questions).
  const candidate =
    tier1[0] ??
    (
      await db
        .select()
        .from(questionBankTable)
        .where(
          and(
            eq(questionBankTable.appSlug, app.slug),
            eq(questionBankTable.type, type),
            eq(questionBankTable.active, true),
            usedPromptsThisSession.length > 0
              ? notInArray(questionBankTable.prompt, usedPromptsThisSession)
              : sql`true`,
          ),
        )
        .orderBy(sql`random()`)
        .limit(1)
    )[0];

  // The actual difficulty written into the session — defaults to the session
  // difficulty but a tier-2 bank draw overrides it with the bank row's true
  // difficulty so question metadata, displayed difficulty, and points all
  // stay consistent.
  let effectiveDifficulty: "easy" | "medium" | "hard" = difficulty;
  if (candidate) {
    effectiveDifficulty = candidate.difficulty as "easy" | "medium" | "hard";
    draft = {
      type: candidate.type as AIQuestionDraft["type"],
      points: candidate.points,
      prompt: candidate.prompt,
      scenario: candidate.scenario,
      options: candidate.options,
      matchingPairs: candidate.matchingPairs,
      correctAnswer: candidate.correctAnswer,
    };
  } else {
    // Tier 3: bank exhausted for this app/type — generate live as fallback so
    // exams never block waiting for a human to top up the bank. Pass ALL
    // session prompts (not just same-app) so live questions don't accidentally
    // duplicate a bank-drawn prompt from a sibling app.
    draft = await generateQuestion(
      appCtx(app),
      type,
      difficulty,
      usedPromptsThisSession,
    );
  }

  const qid = randomUUID();
  try {
    const [inserted] = await db
      .insert(examQuestionsTable)
      .values({
        id: qid,
        sessionId: session.id,
        appSlug: app.slug,
        appName: app.name,
        index: existing.length,
        type: draft.type,
        difficulty: effectiveDifficulty,
        prompt: draft.prompt,
        options: draft.options ?? null,
        matchingPairs: draft.matchingPairs ?? null,
        scenario: draft.scenario ?? null,
        correctAnswer: draft.correctAnswer,
        hintUsed: false,
        points: draft.points,
      })
      .returning();
    res.json(GenerateNextQuestionResponse.parse(serializeQuestion(inserted)));
  } catch (err) {
    const latest = await db
      .select()
      .from(examQuestionsTable)
      .where(eq(examQuestionsTable.sessionId, session.id))
      .orderBy(desc(examQuestionsTable.index))
      .limit(1);
    if (latest[0]) {
      res.json(GenerateNextQuestionResponse.parse(serializeQuestion(latest[0])));
      return;
    }
    throw err;
  }
});

router.post(
  "/exams/:id/questions/:questionId/answer",
  async (req, res): Promise<void> => {
    const params = SubmitAnswerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = SubmitAnswerBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [session] = await db
      .select()
      .from(examSessionsTable)
      .where(eq(examSessionsTable.id, params.data.id));
    if (!session) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }
    const [question] = await db
      .select()
      .from(examQuestionsTable)
      .where(
        and(
          eq(examQuestionsTable.id, params.data.questionId),
          eq(examQuestionsTable.sessionId, session.id),
        ),
      );
    if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    if (question.userAnswer !== null) {
      res.status(400).json({ error: "Question already answered" });
      return;
    }
    const ctx = await loadAppCtxForQuestion(question);
    const safeAnswer = truncateAnswer(body.data.answer);
    const graded = await gradeAnswer(
      ctx,
      {
        type: question.type as AIQuestionDraft["type"],
        prompt: question.prompt,
        scenario: question.scenario,
        options: question.options,
        matchingPairs: question.matchingPairs,
        correctAnswer: question.correctAnswer,
        points: question.points,
      },
      safeAnswer,
    );
    const [updatedQ] = await db
      .update(examQuestionsTable)
      .set({
        userAnswer: safeAnswer,
        isCorrect: graded.isCorrect,
        score: graded.score,
        feedback: graded.feedback,
        criterionScores: graded.criterionScores,
        aiConfidence: graded.confidence,
        aiReasoning: graded.reasoning,
      })
      .where(eq(examQuestionsTable.id, question.id))
      .returning();

    await db
      .update(examSessionsTable)
      .set({
        answeredCount: session.answeredCount + 1,
        correctCount: session.correctCount + (graded.isCorrect ? 1 : 0),
      })
      .where(eq(examSessionsTable.id, session.id));

    res.json(
      SubmitAnswerResponse.parse({
        question: serializeQuestion(updatedQ),
        isCorrect: graded.isCorrect,
        score: graded.score,
        maxScore: question.points,
        modelAnswer: question.correctAnswer,
        feedback: graded.feedback,
        encouragement: graded.encouragement,
        criterionScores: graded.criterionScores,
        confidence: graded.confidence,
      }),
    );
  },
);

router.post(
  "/exams/:id/questions/:questionId/hint",
  async (req, res): Promise<void> => {
    const params = RequestHintParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [question] = await db
      .select()
      .from(examQuestionsTable)
      .where(
        and(
          eq(examQuestionsTable.id, params.data.questionId),
          eq(examQuestionsTable.sessionId, params.data.id),
        ),
      );
    if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    let hint = question.hint;
    if (!hint) {
      const ctx = await loadAppCtxForQuestion(question);
      hint = await generateHint(ctx, {
        prompt: question.prompt,
        scenario: question.scenario,
        type: question.type,
      });
      await db
        .update(examQuestionsTable)
        .set({ hint, hintUsed: true })
        .where(eq(examQuestionsTable.id, question.id));
    } else if (!question.hintUsed) {
      await db
        .update(examQuestionsTable)
        .set({ hintUsed: true })
        .where(eq(examQuestionsTable.id, question.id));
    }
    res.json(RequestHintResponse.parse({ hint }));
  },
);

router.post(
  "/exams/:id/questions/:questionId/explain",
  async (req, res): Promise<void> => {
    const params = ExplainQuestionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [question] = await db
      .select()
      .from(examQuestionsTable)
      .where(
        and(
          eq(examQuestionsTable.id, params.data.questionId),
          eq(examQuestionsTable.sessionId, params.data.id),
        ),
      );
    if (!question) {
      res.status(404).json({ error: "Question not found" });
      return;
    }
    let explanation = question.explanation;
    let related: string[] = [];
    if (!explanation) {
      const ctx = await loadAppCtxForQuestion(question);
      const result = await explainAnswer(ctx, {
        prompt: question.prompt,
        scenario: question.scenario,
        correctAnswer: question.correctAnswer,
        userAnswer: question.userAnswer,
      });
      explanation = result.explanation;
      related = result.relatedFeatures;
      await db
        .update(examQuestionsTable)
        .set({ explanation })
        .where(eq(examQuestionsTable.id, question.id));
    } else {
      const ctx = await loadAppCtxForQuestion(question);
      related = ctx.features.slice(0, 3);
    }
    res.json(
      ExplainQuestionResponse.parse({ explanation, relatedFeatures: related }),
    );
  },
);

async function loadTemplateForSession(
  session: ExamSession,
): Promise<ExamTemplate | null> {
  if (!session.examTemplateId) return null;
  const [tpl] = await db
    .select()
    .from(examTemplatesTable)
    .where(eq(examTemplatesTable.id, session.examTemplateId));
  return tpl ?? null;
}

export async function buildSummary(sessionId: string) {
  const [session] = await db
    .select()
    .from(examSessionsTable)
    .where(eq(examSessionsTable.id, sessionId));
  if (!session) return null;
  const questions = await db
    .select()
    .from(examQuestionsTable)
    .where(eq(examQuestionsTable.sessionId, sessionId))
    .orderBy(asc(examQuestionsTable.index));
  const template = await loadTemplateForSession(session);

  const byApp = new Map<
    string,
    { appSlug: string; appName: string; correct: number; total: number }
  >();
  for (const q of questions) {
    const cur = byApp.get(q.appSlug) ?? {
      appSlug: q.appSlug,
      appName: q.appName,
      correct: 0,
      total: 0,
    };
    cur.total += 1;
    if (q.isCorrect) cur.correct += 1;
    byApp.set(q.appSlug, cur);
  }
  const breakdown = Array.from(byApp.values()).map((b) => ({
    ...b,
    accuracy: b.total ? b.correct / b.total : 0,
  }));
  return { session, questions, breakdown, template };
}

router.post("/exams/:id/finish", async (req, res): Promise<void> => {
  const params = FinishExamParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const built = await buildSummary(params.data.id);
  if (!built) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  const { session, questions, breakdown, template } = built;

  const passThreshold = template?.passThreshold ?? 0.7;

  if (session.status === "completed" && session.summary) {
    const stored = session.summary as {
      strengths: string[];
      weaknesses: string[];
      recommendations: string;
      verdict: string;
    };
    const accuracy =
      session.maxScore && session.maxScore > 0
        ? (session.score ?? 0) / session.maxScore
        : 0;
    res.json(
      FinishExamResponse.parse({
        session: serializeSession(session),
        breakdownByApp: breakdown,
        strengths: stored.strengths,
        weaknesses: stored.weaknesses,
        recommendations: stored.recommendations,
        verdict: stored.verdict,
        passed: accuracy >= passThreshold,
      }),
    );
    return;
  }

  const score = questions.reduce((s, q) => s + (q.score ?? 0), 0);
  const maxScore = questions.reduce((s, q) => s + q.points, 0);
  const accuracy = questions.length
    ? questions.filter((q) => q.isCorrect).length / questions.length
    : 0;

  const aiSummary = await generateExamSummary(
    {
      candidateName: session.candidateName,
      score,
      maxScore: maxScore || 1,
      accuracy,
      answeredCount: session.answeredCount,
    },
    breakdown,
    questions.map((q) => ({
      appName: q.appName,
      prompt: q.prompt,
      isCorrect: !!q.isCorrect,
      userAnswer: q.userAnswer,
    })),
  );

  const summaryPayload = {
    breakdownByApp: breakdown,
    strengths: aiSummary.strengths,
    weaknesses: aiSummary.weaknesses,
    recommendations: aiSummary.recommendations,
    verdict: aiSummary.verdict,
  };

  const [updated] = await db
    .update(examSessionsTable)
    .set({
      status: "completed",
      score,
      maxScore,
      completedAt: new Date(),
      summary: summaryPayload,
    })
    .where(eq(examSessionsTable.id, session.id))
    .returning();

  res.json(
    FinishExamResponse.parse({
      session: serializeSession(updated),
      ...summaryPayload,
      passed: accuracy >= passThreshold,
    }),
  );
});

router.get("/exams/:id/summary", async (req, res): Promise<void> => {
  const params = GetExamSummaryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const built = await buildSummary(params.data.id);
  if (!built) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  const { session, breakdown, template } = built;
  const stored = (session.summary ?? null) as null | {
    strengths: string[];
    weaknesses: string[];
    recommendations: string;
    verdict: string;
  };
  const accuracy =
    session.maxScore && session.maxScore > 0
      ? (session.score ?? 0) / session.maxScore
      : 0;
  const passThreshold = template?.passThreshold ?? 0.7;
  res.json(
    GetExamSummaryResponse.parse({
      session: serializeSession(session),
      breakdownByApp: breakdown,
      strengths: stored?.strengths ?? [],
      weaknesses: stored?.weaknesses ?? [],
      recommendations: stored?.recommendations ?? "",
      verdict: stored?.verdict ?? "",
      passed: accuracy >= passThreshold,
    }),
  );
});

router.post(
  "/exams/:id/proctor-report",
  async (req, res): Promise<void> => {
    const params = SubmitProctorEventParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = SubmitProctorEventBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [session] = await db
      .select()
      .from(examSessionsTable)
      .where(eq(examSessionsTable.id, params.data.id));
    if (!session) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }
    if (session.status !== "in_progress") {
      res.status(400).json({ error: "Exam is not in progress" });
      return;
    }
    const template = await loadTemplateForSession(session);
    const flagThreshold = template?.antiCheat?.autoFlagThreshold ?? 50;

    // Default severity per kind, can be overridden by client
    const severityByKind: Record<string, number> = {
      tab_switch: 15,
      window_blur: 5,
      copy_attempt: 10,
      paste_attempt: 12,
      right_click: 3,
      shortcut_block: 8,
      fullscreen_exit: 20,
      fullscreen_enter: 0,
      devtools_suspected: 25,
      idle: 5,
      mouse_leave: 2,
    };
    const severity =
      body.data.severity ??
      severityByKind[body.data.kind] ??
      5;

    const id = randomUUID();
    const [event] = await db
      .insert(proctorEventsTable)
      .values({
        id,
        sessionId: session.id,
        kind: body.data.kind,
        severity,
        details: body.data.details ?? null,
      })
      .returning();

    // Update session trust score and flagged status
    const newTrust = Math.max(0, session.trustScore - severity);
    const flagged =
      session.flagged ||
      newTrust <= flagThreshold ||
      // Auto-flag on high-severity events
      severity >= 20;
    await db
      .update(examSessionsTable)
      .set({ trustScore: newTrust, flagged })
      .where(eq(examSessionsTable.id, session.id));

    res.json(SubmitProctorEventResponse.parse(serializeProctorEvent(event)));
  },
);

router.get("/exams/:id/proctor-events", async (req, res): Promise<void> => {
  const params = ListProctorEventsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const events = await db
    .select()
    .from(proctorEventsTable)
    .where(eq(proctorEventsTable.sessionId, params.data.id))
    .orderBy(asc(proctorEventsTable.createdAt));
  res.json(ListProctorEventsResponse.parse(events.map(serializeProctorEvent)));
});

router.get("/leaderboard", async (_req, res): Promise<void> => {
  const sessions = await db
    .select()
    .from(examSessionsTable)
    .where(eq(examSessionsTable.status, "completed"))
    .orderBy(desc(examSessionsTable.score))
    .limit(20);
  const entries = sessions
    .filter((s) => s.score != null && s.maxScore != null && s.completedAt)
    .map((s) => ({
      candidateName: s.candidateName,
      score: s.score!,
      maxScore: s.maxScore!,
      accuracy: s.maxScore! > 0 ? s.score! / s.maxScore! : 0,
      completedAt: s.completedAt!.toISOString(),
    }));
  res.json(GetLeaderboardResponse.parse(entries));
});

function requireAdmin(
  req: import("express").Request,
  res: import("express").Response,
): boolean {
  const auth = req.header("x-admin-secret");
  if (!process.env.SESSION_SECRET || auth !== process.env.SESSION_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/admin/question-bank/stats", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const rows = await db
    .select({
      appSlug: questionBankTable.appSlug,
      appName: questionBankTable.appName,
      type: questionBankTable.type,
      difficulty: questionBankTable.difficulty,
      count: sql<number>`count(*)::int`,
    })
    .from(questionBankTable)
    .where(eq(questionBankTable.active, true))
    .groupBy(
      questionBankTable.appSlug,
      questionBankTable.appName,
      questionBankTable.type,
      questionBankTable.difficulty,
    );
  const total = rows.reduce((acc, r) => acc + Number(r.count), 0);
  res.json({ total, breakdown: rows });
});

router.post("/admin/question-bank/seed", async (req, res): Promise<void> => {
  if (!requireAdmin(req, res)) return;
  const rawPerApp = req.body?.perApp;
  const rawExtras = req.body?.extras;
  const rawOnly = req.body?.onlyAppSlugs;

  // Validate bounds: per-app max 50 (catalog × per-app would otherwise be
  // unbounded AI spend); extras max 100. Strictly reject malformed values
  // rather than silently falling back to a global default — a global seed
  // can fan out hundreds of AI calls.
  if (rawPerApp !== undefined) {
    if (
      typeof rawPerApp !== "number" ||
      !Number.isInteger(rawPerApp) ||
      rawPerApp < 0 ||
      rawPerApp > 50
    ) {
      res
        .status(400)
        .json({ error: "perApp must be an integer between 0 and 50" });
      return;
    }
  }
  if (rawExtras !== undefined) {
    if (
      typeof rawExtras !== "number" ||
      !Number.isInteger(rawExtras) ||
      rawExtras < 0 ||
      rawExtras > 100
    ) {
      res
        .status(400)
        .json({ error: "extras must be an integer between 0 and 100" });
      return;
    }
  }
  // onlyAppSlugs (optional targeting): if present, must be a non-empty array
  // of valid slugs. Reject malformed payloads instead of silently widening
  // the seed scope to every app in the catalog.
  let onlyAppSlugs: string[] | undefined;
  if (rawOnly !== undefined) {
    if (!Array.isArray(rawOnly)) {
      res
        .status(400)
        .json({ error: "onlyAppSlugs must be an array of slug strings" });
      return;
    }
    const cleaned = rawOnly.filter(
      (s): s is string =>
        typeof s === "string" && /^[a-z0-9_-]{1,64}$/.test(s),
    );
    if (cleaned.length !== rawOnly.length) {
      res.status(400).json({
        error:
          "onlyAppSlugs entries must be lowercase slugs matching /^[a-z0-9_-]{1,64}$/",
      });
      return;
    }
    if (cleaned.length === 0) {
      res
        .status(400)
        .json({ error: "onlyAppSlugs must contain at least one slug" });
      return;
    }
    if (cleaned.length > 50) {
      res
        .status(400)
        .json({ error: "onlyAppSlugs may contain at most 50 entries" });
      return;
    }
    onlyAppSlugs = cleaned;
  }

  const perApp = rawPerApp as number | undefined;
  const extras = rawExtras as number | undefined;

  // Reject (don't queue) if a seed is already in progress with potentially
  // different scope — avoid returning a result that doesn't match the
  // caller's request.
  const accepted = await seedQuestionBank.tryStart({
    perApp,
    extras,
    onlyAppSlugs,
  });
  if (!accepted) {
    res.status(409).json({
      error: "A question bank seed is already in progress; try again shortly",
    });
    return;
  }
  res.json({
    status: "started",
    perApp: perApp ?? null,
    extras: extras ?? null,
    onlyAppSlugs: onlyAppSlugs ?? null,
  });
});

export { inArray };
export default router;
