import {
  pgTable,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Assessment Studio — educator-built assessments with rubrics, AI generation,
 * AI marking, and configurable proctoring. Lives alongside Exam Hall and shares
 * the same `users` table for educator auth.
 */

export type StudioTaxonomy = "bloom" | "miller" | "solo" | "dok";
export type StudioAnswerMode = "text" | "voice" | "handwriting";
export type StudioStatus = "draft" | "open" | "closed";
export type StudioAssessmentFormat =
  | "exam"
  | "quiz"
  | "assignment"
  | "project"
  | "presentation"
  | "homework"
  | "practice";

export interface StudioRubricCriterion {
  id: string;
  label: string;
  description: string;
  weight: number;
  targetLevel: number;
}

export interface StudioRubricJson {
  taxonomy: StudioTaxonomy;
  targetLevels: number[];
  criteria: StudioRubricCriterion[];
  notes?: string | null;
}

export interface StudioProctoringJson {
  lockFullscreen: boolean;
  blockCopyPaste: boolean;
  blockRightClick: boolean;
  blockShortcuts: boolean;
  detectDevtools: boolean;
  idleTimeoutSeconds: number;
  maxTabSwitches: number;
  autoFlagThreshold: number;
  webcamSnapshots: boolean;
  webcamSnapshotIntervalSec: number;
  faceDetection: boolean;
  audioMonitoring: boolean;
  screenRecording: boolean;
}

export interface StudioQuestionOptionJson {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface StudioCriterionScoreJson {
  criterionId: string;
  score: number;
  comment: string;
}

export const studioAssessmentsTable = pgTable(
  "acad_studio_assessments",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    subject: text("subject"),
    gradeLevel: text("grade_level"),
    educatorName: text("educator_name").notNull(),
    educatorUserId: text("educator_user_id"),
    timeLimitMinutes: integer("time_limit_minutes").notNull().default(45),
    passThreshold: numeric("pass_threshold", { precision: 4, scale: 3 })
      .notNull()
      .default("0.6"),
    rules: text("rules").notNull().default(""),
    status: text("status").notNull().default("draft"),
    format: text("format").notNull().default("exam"),
    maxAttempts: integer("max_attempts").notNull().default(1),
    dueAt: timestamp("due_at", { withTimezone: true }),
    allowedAnswerModes: jsonb("allowed_answer_modes")
      .$type<StudioAnswerMode[]>()
      .notNull()
      .default(["text"]),
    rubric: jsonb("rubric").$type<StudioRubricJson>().notNull(),
    proctoring: jsonb("proctoring").$type<StudioProctoringJson>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    codeUniq: uniqueIndex("acad_studio_assessments_code_uniq").on(t.code),
    educatorIdx: index("acad_studio_assessments_educator_idx").on(t.educatorUserId),
  }),
);

export const studioMaterialsTable = pgTable(
  "acad_studio_materials",
  {
    id: text("id").primaryKey(),
    assessmentId: text("assessment_id").notNull(),
    kind: text("kind").notNull(), // pasted | file_text | web | youtube | ebook
    title: text("title").notNull(),
    sourceUrl: text("source_url"),
    author: text("author"),
    contentText: text("content_text").notNull(),
    wordCount: integer("word_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    assessmentIdx: index("acad_studio_materials_assessment_idx").on(t.assessmentId),
  }),
);

export const studioQuestionsTable = pgTable(
  "acad_studio_questions",
  {
    id: text("id").primaryKey(),
    assessmentId: text("assessment_id").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    type: text("type").notNull(),
    prompt: text("prompt").notNull(),
    context: text("context"),
    options: jsonb("options")
      .$type<StudioQuestionOptionJson[]>()
      .notNull()
      .default([]),
    modelAnswer: text("model_answer"),
    rubricCriterionIds: jsonb("rubric_criterion_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    taxonomyLevel: integer("taxonomy_level").notNull().default(1),
    points: numeric("points", { precision: 6, scale: 2 })
      .notNull()
      .default("1"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    assessmentIdx: index("acad_studio_questions_assessment_idx").on(t.assessmentId),
  }),
);

export const studioAttemptsTable = pgTable(
  "acad_studio_attempts",
  {
    id: text("id").primaryKey(),
    assessmentId: text("assessment_id").notNull(),
    studentName: text("student_name").notNull(),
    studentEmail: text("student_email"),
    /** Optional comma/free-form text the student wants the AI to focus on. */
    topicsHint: text("topics_hint"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    score: numeric("score", { precision: 8, scale: 3 }),
    maxScore: numeric("max_score", { precision: 8, scale: 3 }),
    passed: boolean("passed"),
    flagCount: integer("flag_count").notNull().default(0),
    snapshotCount: integer("snapshot_count").notNull().default(0),
    overallNarrative: text("overall_narrative"),
    status: text("status").notNull().default("active"), // active|finished|abandoned
    xpEarned: integer("xp_earned").notNull().default(0),
    badgesEarned: jsonb("badges_earned")
      .$type<string[]>()
      .notNull()
      .default([]),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by"),
    reviewNote: text("review_note"),
  },
  (t) => ({
    assessmentIdx: index("acad_studio_attempts_assessment_idx").on(t.assessmentId),
  }),
);

/**
 * Gamification ledger for educators (one row per user).
 * Updated whenever they create assessments / questions / materials etc.
 */
export const studioEducatorXpTable = pgTable("acad_studio_educator_xp", {
  userId: text("user_id").primaryKey(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  currentStreakDays: integer("current_streak_days").notNull().default(0),
  longestStreakDays: integer("longest_streak_days").notNull().default(0),
  lastActivityDate: text("last_activity_date"), // YYYY-MM-DD (server local)
  badges: jsonb("badges").$type<string[]>().notNull().default([]),
  assessmentsCreated: integer("assessments_created").notNull().default(0),
  questionsCreated: integer("questions_created").notNull().default(0),
  materialsCreated: integer("materials_created").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Student-curated question proposals. Submitted from the public join screen
 * (no login required); educators triage them on the Proposals tab and can
 * accept (creates a real question) or reject.
 */
export const studioQuestionProposalsTable = pgTable(
  "acad_studio_question_proposals",
  {
    id: text("id").primaryKey(),
    assessmentId: text("assessment_id").notNull(),
    proposerName: text("proposer_name").notNull(),
    proposerEmail: text("proposer_email"),
    prompt: text("prompt").notNull(),
    suggestedType: text("suggested_type").notNull().default("short_answer"),
    suggestedDifficulty: text("suggested_difficulty").notNull().default("medium"),
    suggestedRubricCriterionId: text("suggested_rubric_criterion_id"),
    rationale: text("rationale"),
    status: text("status").notNull().default("pending"), // pending|accepted|rejected
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    acceptedQuestionId: text("accepted_question_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    assessmentIdx: index("acad_studio_proposals_assessment_idx").on(t.assessmentId),
  }),
);

export const studioAnswersTable = pgTable(
  "acad_studio_answers",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id").notNull(),
    questionId: text("question_id").notNull(),
    mode: text("mode").notNull().default("text"), // text|voice|handwriting
    responseText: text("response_text").notNull().default(""),
    selectedOptionIds: jsonb("selected_option_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    score: numeric("score", { precision: 6, scale: 2 }),
    maxScore: numeric("max_score", { precision: 6, scale: 2 })
      .notNull()
      .default("1"),
    aiFeedback: text("ai_feedback"),
    criterionScores: jsonb("criterion_scores")
      .$type<StudioCriterionScoreJson[]>()
      .notNull()
      .default([]),
    /** AI grader's self-reported confidence in this grade (0..1). */
    aiConfidence: numeric("ai_confidence", { precision: 4, scale: 3 }),
    /** Private chain-of-thought justification. Audit / regrade / educator-only. */
    aiReasoning: text("ai_reasoning"),
    manualOverride: boolean("manual_override").notNull().default(false),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    attemptIdx: index("acad_studio_answers_attempt_idx").on(t.attemptId),
    attemptQuestionUniq: uniqueIndex("acad_studio_answers_attempt_question_uniq").on(
      t.attemptId,
      t.questionId,
    ),
  }),
);

export const studioProctorEventsTable = pgTable(
  "acad_studio_proctor_events",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id").notNull(),
    type: text("type").notNull(),
    message: text("message").notNull(),
    severity: text("severity").notNull().default("info"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    attemptIdx: index("acad_studio_proctor_events_attempt_idx").on(t.attemptId),
  }),
);

export const studioProctorSnapshotsTable = pgTable(
  "acad_studio_proctor_snapshots",
  {
    id: text("id").primaryKey(),
    attemptId: text("attempt_id").notNull(),
    imageDataUrl: text("image_data_url").notNull(),
    faceCount: integer("face_count").notNull().default(0),
    analysis: text("analysis").notNull().default(""),
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    attemptIdx: index("acad_studio_proctor_snapshots_attempt_idx").on(t.attemptId),
  }),
);

export type StudioAssessmentRow = typeof studioAssessmentsTable.$inferSelect;
export type StudioMaterialRow = typeof studioMaterialsTable.$inferSelect;
export type StudioQuestionRow = typeof studioQuestionsTable.$inferSelect;
export type StudioAttemptRow = typeof studioAttemptsTable.$inferSelect;
export type StudioAnswerRow = typeof studioAnswersTable.$inferSelect;
export type StudioProctorEventRow = typeof studioProctorEventsTable.$inferSelect;
export type StudioProctorSnapshotRow = typeof studioProctorSnapshotsTable.$inferSelect;
export type StudioEducatorXpRow = typeof studioEducatorXpTable.$inferSelect;
export type StudioQuestionProposalRow = typeof studioQuestionProposalsTable.$inferSelect;
