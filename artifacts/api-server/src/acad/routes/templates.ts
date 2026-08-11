import { db } from "@workspace/db";
import { Router, type IRouter, type Response } from "express";
import { aiRateLimit } from "../../lib/aiRateLimit";
import { eq, desc, and, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  appsTable,
  examTemplatesTable,
  examSessionsTable,
  examQuestionsTable,
  type ExamTemplate,
  type User,
} from "@workspace/db/acad";
import { requireUser, getRouteUser } from "../lib/auth";
import { generateAttemptToken } from "../lib/attempt-token";
import { seedQuestionBank } from "../lib/seedQuestionBank";
import { logger } from "../../lib/logger";
import {
  ListExamTemplatesQueryParams,
  ListExamTemplatesResponse,
  CreateExamTemplateBody,
  GetExamTemplateParams,
  GetExamTemplateResponse,
  UpdateExamTemplateParams,
  UpdateExamTemplateBody,
  UpdateExamTemplateResponse,
  ListTemplateAttemptsParams,
  ListTemplateAttemptsResponse,
  JoinExamTemplateParams,
  JoinExamTemplateBody,
  GetTemplateInsightsParams,
  GetTemplateInsightsResponse,
  GetExamTemplateByCodeParams,
  GetExamTemplateByCodeResponse,
  JoinExamByCodeParams,
  JoinExamByCodeBody,
  GetExamResponse,
  AiBlueprintExamBody,
  AiBlueprintExamResponse,
  AiSuggestRulesBody,
  AiSuggestRulesResponse,
} from "../zod";
import {
  generateExamBlueprint,
  suggestExamRules,
  analyzeAttempts,
} from "../lib/ai";
import { serializeSession } from "./exams";

const router: IRouter = Router();
const auth = requireUser();

/** True if the user can read/write this template (owner or admin). */
function canManageTemplate(tpl: ExamTemplate, user: User): boolean {
  if (user.role === "admin") return true;
  return tpl.creatorUserId === user.id;
}

/** Send 403 + return false if the user can't manage the template. */
function assertCanManage(
  tpl: ExamTemplate,
  user: User,
  res: Response,
): boolean {
  if (canManageTemplate(tpl, user)) return true;
  res.status(403).json({ error: "You don't have access to this template." });
  return false;
}

const VALID_TYPES = new Set([
  "multiple_choice",
  "true_false",
  "fill_blank",
  "short_answer",
  "scenario",
  "matching",
]);

function generateCode(): string {
  // 6-char uppercase alphanumeric, excluding confusing chars (0, O, 1, I)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = generateCode();
    const [existing] = await db
      .select()
      .from(examTemplatesTable)
      .where(eq(examTemplatesTable.code, candidate));
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique exam code");
}

async function attemptCountFor(templateId: string): Promise<number> {
  const sessions = await db
    .select()
    .from(examSessionsTable)
    .where(eq(examSessionsTable.examTemplateId, templateId));
  return sessions.length;
}

function serializeTemplate(t: ExamTemplate, attemptCount: number) {
  return {
    id: t.id,
    code: t.code,
    title: t.title,
    description: t.description,
    examinerName: t.examinerName,
    appSlugs: t.appSlugs,
    questionTypes: t.questionTypes,
    questionsPerApp: t.questionsPerApp,
    totalQuestions: t.totalQuestions,
    difficulty: t.difficulty,
    timeLimitMinutes: t.timeLimitMinutes,
    rules: t.rules,
    passThreshold: t.passThreshold,
    antiCheat: t.antiCheat,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    attemptCount,
  };
}

router.get("/exam-templates", auth, async (req, res): Promise<void> => {
  const params = ListExamTemplatesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Note: the legacy `examiner` query param is intentionally ignored —
  // scoping is now done by the session user. Admins see all templates
  // (including legacy NULL-creator rows); teachers see only their own.
  void params.data.examiner;
  const user = getRouteUser(res);
  const rows = await (user.role === "admin"
    ? db
        .select()
        .from(examTemplatesTable)
        .orderBy(desc(examTemplatesTable.createdAt))
        .limit(200)
    : db
        .select()
        .from(examTemplatesTable)
        .where(eq(examTemplatesTable.creatorUserId, user.id))
        .orderBy(desc(examTemplatesTable.createdAt))
        .limit(200));

  const ids = rows.map((r) => r.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const sessions = await db
      .select({
        templateId: examSessionsTable.examTemplateId,
        id: examSessionsTable.id,
      })
      .from(examSessionsTable)
      .where(inArray(examSessionsTable.examTemplateId, ids));
    for (const s of sessions) {
      if (!s.templateId) continue;
      counts.set(s.templateId, (counts.get(s.templateId) ?? 0) + 1);
    }
  }
  res.json(
    ListExamTemplatesResponse.parse(
      rows.map((r) => serializeTemplate(r, counts.get(r.id) ?? 0)),
    ),
  );
});

router.post("/exam-templates", auth, async (req, res): Promise<void> => {
  const body = CreateExamTemplateBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const user = getRouteUser(res);
  const data = body.data;
  if (data.appSlugs.length === 0) {
    res.status(400).json({ error: "Pick at least one app" });
    return;
  }
  if (data.questionTypes.length === 0) {
    res.status(400).json({ error: "Pick at least one question type" });
    return;
  }
  for (const t of data.questionTypes) {
    if (!VALID_TYPES.has(t)) {
      res.status(400).json({ error: `Invalid question type: ${t}` });
      return;
    }
  }
  const apps = await db.select().from(appsTable);
  const validSlugs = new Set(apps.map((a) => a.slug));
  for (const slug of data.appSlugs) {
    if (!validSlugs.has(slug)) {
      res.status(400).json({ error: `Unknown app slug: ${slug}` });
      return;
    }
  }
  const id = randomUUID();
  const code = await uniqueCode();
  const totalQuestions = data.appSlugs.length * data.questionsPerApp;
  const [tpl] = await db
    .insert(examTemplatesTable)
    .values({
      id,
      code,
      title: data.title,
      description: data.description ?? null,
      // Identity is taken from the session user, not the client. The body's
      // examinerName is accepted for backward compat but ignored.
      examinerName: user.name,
      creatorUserId: user.id,
      appSlugs: data.appSlugs,
      questionTypes: data.questionTypes,
      questionsPerApp: data.questionsPerApp,
      totalQuestions,
      difficulty: data.difficulty,
      timeLimitMinutes: data.timeLimitMinutes,
      rules: data.rules,
      passThreshold: data.passThreshold,
      antiCheat: data.antiCheat,
      status: "open",
    })
    .returning();

  // Fire-and-forget pre-warm of the question bank for the chosen apps so the
  // first candidate doesn't pay the cold-start cost of live AI generation.
  // tryStart is idempotent + capacity-aware; if a seed is already running it
  // just no-ops. We never await it — request returns immediately.
  seedQuestionBank
    .tryStart({ onlyAppSlugs: data.appSlugs, extras: 4 })
    .catch((err: unknown) => {
      logger.warn({ err, templateId: id }, "prewarm question bank failed");
    });

  res.status(201).json(serializeTemplate(tpl, 0));
});

router.get("/exam-templates/ai-blueprint", (_req, res) => {
  res.status(405).json({ error: "POST only" });
});

router.post("/exam-templates/ai-blueprint", auth, aiRateLimit, async (req, res): Promise<void> => {
  const body = AiBlueprintExamBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const apps = await db.select().from(appsTable);
  const blueprint = await generateExamBlueprint(
    body.data.prompt,
    apps.map((a) => ({
      slug: a.slug,
      name: a.name,
      tagline: a.tagline,
      category: a.category,
    })),
  );
  // Defensive: clamp slugs to known
  const validSlugs = new Set(apps.map((a) => a.slug));
  blueprint.appSlugs = blueprint.appSlugs.filter((s) => validSlugs.has(s));
  if (blueprint.appSlugs.length === 0)
    blueprint.appSlugs = apps.slice(0, 3).map((a) => a.slug);
  blueprint.questionTypes = blueprint.questionTypes.filter((t) =>
    VALID_TYPES.has(t),
  );
  if (blueprint.questionTypes.length === 0)
    blueprint.questionTypes = ["multiple_choice", "short_answer"];
  blueprint.questionsPerApp = Math.max(
    1,
    Math.min(20, Math.round(blueprint.questionsPerApp)),
  );
  blueprint.timeLimitMinutes = Math.max(
    1,
    Math.min(240, Math.round(blueprint.timeLimitMinutes)),
  );
  blueprint.passThreshold = Math.max(0, Math.min(1, blueprint.passThreshold));
  res.json(AiBlueprintExamResponse.parse(blueprint));
});

router.post("/exam-templates/ai-rules", auth, aiRateLimit, async (req, res): Promise<void> => {
  const body = AiSuggestRulesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const rules = await suggestExamRules(
    body.data.title,
    body.data.appNames,
    body.data.difficulty,
    body.data.timeLimitMinutes,
  );
  res.json(AiSuggestRulesResponse.parse({ rules }));
});

router.get("/exam-templates/by-code/:code", async (req, res): Promise<void> => {
  const params = GetExamTemplateByCodeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const code = params.data.code.toUpperCase();
  const [tpl] = await db
    .select()
    .from(examTemplatesTable)
    .where(eq(examTemplatesTable.code, code));
  if (!tpl) {
    res.status(404).json({ error: "Exam not found" });
    return;
  }
  if (tpl.status !== "open") {
    res.status(400).json({ error: "This exam is closed" });
    return;
  }
  const apps = await db.select().from(appsTable);
  const appNames = tpl.appSlugs
    .map((s) => apps.find((a) => a.slug === s)?.name ?? s);
  res.json(
    GetExamTemplateByCodeResponse.parse({
      id: tpl.id,
      code: tpl.code,
      title: tpl.title,
      description: tpl.description,
      examinerName: tpl.examinerName,
      appSlugs: tpl.appSlugs,
      appNames,
      questionTypes: tpl.questionTypes,
      totalQuestions: tpl.totalQuestions,
      difficulty: tpl.difficulty,
      timeLimitMinutes: tpl.timeLimitMinutes,
      rules: tpl.rules,
      antiCheat: tpl.antiCheat,
      status: tpl.status,
    }),
  );
});

router.post(
  "/exam-templates/by-code/:code/attempts",
  async (req, res): Promise<void> => {
    const params = JoinExamByCodeParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = JoinExamByCodeBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const code = params.data.code.toUpperCase();
    const [tpl] = await db
      .select()
      .from(examTemplatesTable)
      .where(eq(examTemplatesTable.code, code));
    if (!tpl) {
      res.status(404).json({ error: "Exam not found" });
      return;
    }
    if (tpl.status !== "open") {
      res.status(400).json({ error: "This exam is closed" });
      return;
    }
    const id = randomUUID();
    const [session] = await db
      .insert(examSessionsTable)
      .values({
        id,
        examTemplateId: tpl.id,
        candidateName: body.data.candidateName,
        candidateEmail: body.data.candidateEmail ?? null,
        appSlugs: tpl.appSlugs,
        questionTypes: tpl.questionTypes,
        questionsPerApp: tpl.questionsPerApp,
        totalQuestions: tpl.totalQuestions,
        difficulty: tpl.difficulty,
        timeLimitMinutes: tpl.timeLimitMinutes,
        status: "in_progress",
        answeredCount: 0,
        correctCount: 0,
        trustScore: 100,
        flagged: false,
      })
      .returning();
    res.status(201).json({
      ...GetExamResponse.parse(serializeSession(session)),
      accessToken: generateAttemptToken(session.id),
    });
  },
);

router.get("/exam-templates/:id", auth, async (req, res): Promise<void> => {
  const params = GetExamTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [tpl] = await db
    .select()
    .from(examTemplatesTable)
    .where(eq(examTemplatesTable.id, params.data.id));
  if (!tpl) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  if (!assertCanManage(tpl, getRouteUser(res), res)) return;
  const count = await attemptCountFor(tpl.id);
  res.json(GetExamTemplateResponse.parse(serializeTemplate(tpl, count)));
});

router.patch("/exam-templates/:id", auth, async (req, res): Promise<void> => {
  const params = UpdateExamTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateExamTemplateBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  // Ownership check before letting the update through.
  const [existing] = await db
    .select()
    .from(examTemplatesTable)
    .where(eq(examTemplatesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  if (!assertCanManage(existing, getRouteUser(res), res)) return;
  const updates: Record<string, unknown> = {};
  if (body.data.title) updates.title = body.data.title;
  if (body.data.description !== null && body.data.description !== undefined)
    updates.description = body.data.description;
  if (body.data.rules) updates.rules = body.data.rules;
  if (body.data.status) updates.status = body.data.status;
  const [tpl] = await db
    .update(examTemplatesTable)
    .set(updates)
    .where(eq(examTemplatesTable.id, params.data.id))
    .returning();
  if (!tpl) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  const count = await attemptCountFor(tpl.id);
  res.json(UpdateExamTemplateResponse.parse(serializeTemplate(tpl, count)));
});

router.get("/exam-templates/:id/attempts", auth, async (req, res): Promise<void> => {
  const params = ListTemplateAttemptsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [tpl] = await db
    .select()
    .from(examTemplatesTable)
    .where(eq(examTemplatesTable.id, params.data.id));
  if (!tpl) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  if (!assertCanManage(tpl, getRouteUser(res), res)) return;
  const sessions = await db
    .select()
    .from(examSessionsTable)
    .where(eq(examSessionsTable.examTemplateId, params.data.id))
    .orderBy(desc(examSessionsTable.startedAt));
  res.json(ListTemplateAttemptsResponse.parse(sessions.map(serializeSession)));
});

router.post(
  "/exam-templates/:id/attempts",
  async (req, res): Promise<void> => {
    const params = JoinExamTemplateParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const body = JoinExamTemplateBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const [tpl] = await db
      .select()
      .from(examTemplatesTable)
      .where(eq(examTemplatesTable.id, params.data.id));
    if (!tpl) {
      res.status(404).json({ error: "Template not found" });
      return;
    }
    if (tpl.status !== "open") {
      res.status(400).json({ error: "This exam is closed" });
      return;
    }
    const id = randomUUID();
    const [session] = await db
      .insert(examSessionsTable)
      .values({
        id,
        examTemplateId: tpl.id,
        candidateName: body.data.candidateName,
        candidateEmail: body.data.candidateEmail ?? null,
        appSlugs: tpl.appSlugs,
        questionTypes: tpl.questionTypes,
        questionsPerApp: tpl.questionsPerApp,
        totalQuestions: tpl.totalQuestions,
        difficulty: tpl.difficulty,
        timeLimitMinutes: tpl.timeLimitMinutes,
        status: "in_progress",
        answeredCount: 0,
        correctCount: 0,
        trustScore: 100,
        flagged: false,
      })
      .returning();
    res.status(201).json({
      ...GetExamResponse.parse(serializeSession(session)),
      accessToken: generateAttemptToken(session.id),
    });
  },
);

router.get("/exam-templates/:id/insights", auth, async (req, res): Promise<void> => {
  const params = GetTemplateInsightsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [tpl] = await db
    .select()
    .from(examTemplatesTable)
    .where(eq(examTemplatesTable.id, params.data.id));
  if (!tpl) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  if (!assertCanManage(tpl, getRouteUser(res), res)) return;

  const apps = await db.select().from(appsTable);
  const appNames = tpl.appSlugs.map(
    (s) => apps.find((a) => a.slug === s)?.name ?? s,
  );

  const sessions = await db
    .select()
    .from(examSessionsTable)
    .where(
      and(
        eq(examSessionsTable.examTemplateId, tpl.id),
        eq(examSessionsTable.status, "completed"),
      ),
    );

  if (sessions.length === 0) {
    const insights = await analyzeAttempts(
      { title: tpl.title, passThreshold: tpl.passThreshold, appNames },
      [],
    );
    res.json(GetTemplateInsightsResponse.parse(insights));
    return;
  }

  const sessionIds = sessions.map((s) => s.id);
  const allQuestions = await db
    .select()
    .from(examQuestionsTable)
    .where(inArray(examQuestionsTable.sessionId, sessionIds));

  const attempts = sessions.map((s) => {
    const qs = allQuestions.filter((q) => q.sessionId === s.id);
    const perAppMap = new Map<string, { correct: number; total: number }>();
    for (const q of qs) {
      const cur = perAppMap.get(q.appName) ?? { correct: 0, total: 0 };
      cur.total += 1;
      if (q.isCorrect) cur.correct += 1;
      perAppMap.set(q.appName, cur);
    }
    const accuracy =
      s.maxScore && s.maxScore > 0 ? (s.score ?? 0) / s.maxScore : 0;
    return {
      candidateName: s.candidateName,
      score: s.score,
      maxScore: s.maxScore,
      accuracy,
      flagged: s.flagged,
      trustScore: s.trustScore,
      perApp: Array.from(perAppMap.entries()).map(([appName, v]) => ({
        appName,
        correct: v.correct,
        total: v.total,
      })),
      wrongPrompts: qs
        .filter((q) => q.isCorrect === false)
        .map((q) => `[${q.appName}] ${q.prompt}`),
    };
  });

  const insights = await analyzeAttempts(
    { title: tpl.title, passThreshold: tpl.passThreshold, appNames },
    attempts,
  );
  res.json(GetTemplateInsightsResponse.parse(insights));
});

export default router;
