import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  doublePrecision,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Per-criterion AI grading breakdown stored on `exam_questions`. Empty for
 * objective auto-graded answers; populated for short_answer / scenario and
 * for AI-fallback objective grades (single-axis "Accuracy" criterion).
 */
export interface ExamGradedCriterionJson {
  label: string;
  weight: number; // 0..1, sums to 1 across the question's criteria
  score: number; // 0..1
  comment: string;
}

export const examTemplatesTable = pgTable("acad_exam_templates", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  examinerName: text("examiner_name").notNull(),
  // FK to users.id. Nullable for legacy rows created before auth landed —
  // those are visible only to admins.
  creatorUserId: text("creator_user_id"),
  appSlugs: jsonb("app_slugs").$type<string[]>().notNull().default([]),
  questionTypes: jsonb("question_types").$type<string[]>().notNull().default([]),
  questionsPerApp: integer("questions_per_app").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  difficulty: text("difficulty").notNull(),
  timeLimitMinutes: integer("time_limit_minutes").notNull().default(30),
  rules: text("rules").notNull().default(""),
  passThreshold: doublePrecision("pass_threshold").notNull().default(0.7),
  antiCheat: jsonb("anti_cheat")
    .$type<{
      lockFullscreen: boolean;
      blockCopyPaste: boolean;
      blockRightClick: boolean;
      blockShortcuts: boolean;
      detectDevtools: boolean;
      idleTimeoutSeconds: number;
      maxTabSwitches: number;
      autoFlagThreshold: number;
    }>()
    .notNull()
    .default({
      lockFullscreen: true,
      blockCopyPaste: true,
      blockRightClick: true,
      blockShortcuts: true,
      detectDevtools: true,
      idleTimeoutSeconds: 120,
      maxTabSwitches: 3,
      autoFlagThreshold: 50,
    }),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const examSessionsTable = pgTable("acad_exam_sessions", {
  id: text("id").primaryKey(),
  examTemplateId: text("exam_template_id"),
  candidateName: text("candidate_name").notNull(),
  candidateEmail: text("candidate_email"),
  appSlugs: jsonb("app_slugs").$type<string[]>().notNull().default([]),
  questionTypes: jsonb("question_types").$type<string[]>().notNull().default([]),
  questionsPerApp: integer("questions_per_app").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  difficulty: text("difficulty").notNull(),
  timeLimitMinutes: integer("time_limit_minutes").notNull().default(0),
  status: text("status").notNull().default("in_progress"),
  score: doublePrecision("score"),
  maxScore: doublePrecision("max_score"),
  answeredCount: integer("answered_count").notNull().default(0),
  correctCount: integer("correct_count").notNull().default(0),
  trustScore: integer("trust_score").notNull().default(100),
  flagged: boolean("flagged").notNull().default(false),
  startedAt: timestamp("started_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  summary: jsonb("summary"),
});

export const examQuestionsTable = pgTable("acad_exam_questions", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  appSlug: text("app_slug").notNull(),
  appName: text("app_name").notNull(),
  index: integer("index").notNull(),
  type: text("type").notNull(),
  difficulty: text("difficulty").notNull(),
  prompt: text("prompt").notNull(),
  options: jsonb("options").$type<string[] | null>(),
  matchingPairs: jsonb("matching_pairs").$type<
    { left: string; right: string }[] | null
  >(),
  scenario: text("scenario"),
  correctAnswer: text("correct_answer").notNull(),
  userAnswer: text("user_answer"),
  isCorrect: boolean("is_correct"),
  score: doublePrecision("score"),
  feedback: text("feedback"),
  /** Per-criterion grading breakdown (Accuracy / Completeness / Relevance / Clarity). */
  criterionScores: jsonb("criterion_scores")
    .$type<ExamGradedCriterionJson[]>()
    .notNull()
    .default([]),
  /** AI grader's self-reported confidence in this grade (0..1). */
  aiConfidence: doublePrecision("ai_confidence"),
  /** Private chain-of-thought justification for the grade. Audit/regrade only. */
  aiReasoning: text("ai_reasoning"),
  hintUsed: boolean("hint_used").notNull().default(false),
  hint: text("hint"),
  explanation: text("explanation"),
  points: integer("points").notNull().default(10),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  sessionIndexUnique: uniqueIndex("acad_exam_questions_session_index_unique").on(
    table.sessionId,
    table.index,
  ),
}));

/**
 * Reusable, vetted question bank shared across exam sessions.
 * Questions here are pre-generated (and ideally human-reviewed) so live
 * exams can serve a stable pool instead of generating every prompt on the
 * fly. The runtime falls back to live generation when the bank is exhausted
 * for an app/type/difficulty combination.
 */
export const questionBankTable = pgTable(
  "acad_question_bank",
  {
    id: text("id").primaryKey(),
    appSlug: text("app_slug").notNull(),
    appName: text("app_name").notNull(),
    type: text("type").notNull(),
    difficulty: text("difficulty").notNull(),
    prompt: text("prompt").notNull(),
    scenario: text("scenario"),
    options: jsonb("options").$type<string[] | null>(),
    matchingPairs: jsonb("matching_pairs").$type<
      { left: string; right: string }[] | null
    >(),
    correctAnswer: text("correct_answer").notNull(),
    hint: text("hint"),
    explanation: text("explanation"),
    points: integer("points").notNull().default(10),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Prevent the seeder (or a buggy concurrent write) from inserting two
    // identical questions for the same app/type/difficulty cell.
    uniquePromptPerCell: uniqueIndex("acad_question_bank_cell_prompt_unique").on(
      table.appSlug,
      table.type,
      table.difficulty,
      table.prompt,
    ),
  }),
);

export const proctorEventsTable = pgTable("acad_proctor_events", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  kind: text("kind").notNull(),
  severity: integer("severity").notNull().default(5),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ExamTemplate = typeof examTemplatesTable.$inferSelect;
export type InsertExamTemplate = typeof examTemplatesTable.$inferInsert;
export type ExamSession = typeof examSessionsTable.$inferSelect;
export type InsertExamSession = typeof examSessionsTable.$inferInsert;
export type ExamQuestion = typeof examQuestionsTable.$inferSelect;
export type InsertExamQuestion = typeof examQuestionsTable.$inferInsert;
export type ProctorEvent = typeof proctorEventsTable.$inferSelect;
export type InsertProctorEvent = typeof proctorEventsTable.$inferInsert;
export type QuestionBankEntry = typeof questionBankTable.$inferSelect;
export type InsertQuestionBankEntry = typeof questionBankTable.$inferInsert;
