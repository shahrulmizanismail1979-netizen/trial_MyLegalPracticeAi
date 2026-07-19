import { Buffer } from "node:buffer";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  speechToText,
  detectAudioFormat,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";
import { logger } from "../../lib/logger";
import {
  STUDIO_TAXONOMIES,
  getTaxonomy,
  type StudioTaxonomyKind,
} from "./studio-taxonomies";

const MODEL = "gpt-5.4";
const VISION_MODEL = "gpt-5.4";
// Fast/cheap model for routine drafting + low-stakes calls. Subjective grading
// stays on the big model because the grade decides pass/fail.
const MODEL_FAST = "gpt-5-mini";

function tryParseJson<T>(raw: string): T | null {
  if (!raw) return null;
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(stripped.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    const arrStart = stripped.indexOf("[");
    const arrEnd = stripped.lastIndexOf("]");
    if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
      try {
        return JSON.parse(stripped.slice(arrStart, arrEnd + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// LRU cache for chatJson — keyed by (system+user). Speeds up repeat grading
// passes (regrade after a flaky network retry, identical student answers
// across attempts) and saves model calls. Bounded to keep memory steady.
const CHAT_CACHE = new Map<string, unknown>();
const CHAT_CACHE_MAX = 500;

const AI_USAGE = {
  callsFast: 0,
  callsFull: 0,
  cacheHits: 0,
  failures: 0,
  startedAt: new Date().toISOString(),
};
export function getStudioAiUsage() {
  return { ...AI_USAGE, cacheSize: CHAT_CACHE.size };
}
function chatCacheGet<T>(key: string): T | null {
  if (!CHAT_CACHE.has(key)) return null;
  const v = CHAT_CACHE.get(key) as T;
  CHAT_CACHE.delete(key);
  CHAT_CACHE.set(key, v);
  return v;
}
function chatCacheSet(key: string, val: unknown) {
  if (CHAT_CACHE.size >= CHAT_CACHE_MAX) {
    const first = CHAT_CACHE.keys().next().value;
    if (first !== undefined) CHAT_CACHE.delete(first);
  }
  CHAT_CACHE.set(key, val);
}

async function chatJson<T>(
  systemPrompt: string,
  userPrompt: string,
  opts: { fast?: boolean } = {},
): Promise<T> {
  const model = opts.fast ? MODEL_FAST : MODEL;
  // Tuple-safe cache key: JSON.stringify of an array is injective for strings.
  // Include the model so fast/full responses don't shadow each other.
  const cacheKey = JSON.stringify([model, systemPrompt, userPrompt]);
  const hit = chatCacheGet<T>(cacheKey);
  if (hit) {
    AI_USAGE.cacheHits += 1;
    return hit;
  }
  if (opts.fast) AI_USAGE.callsFast += 1;
  else AI_USAGE.callsFull += 1;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await openai.chat.completions.create({
      model,
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            attempt === 0
              ? systemPrompt
              : systemPrompt +
                "\n\nIMPORTANT: Reply with VALID JSON only — no prose, no markdown.",
        },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content ?? "";
    const parsed = tryParseJson<T>(content);
    if (parsed) {
      chatCacheSet(cacheKey, parsed);
      return parsed;
    }
  }
  AI_USAGE.failures += 1;
  throw new Error("Model did not return valid JSON after retry");
}

// ─────────────── Research agent (web/youtube/ebooks) ───────────────

export interface StudioResearchSource {
  kind: "web" | "youtube" | "ebook";
  title: string;
  sourceUrl: string | null;
  author: string | null;
  snippet: string;
  contentText: string;
}

/**
 * Lightweight research agent. We cannot call external services from inside the
 * Replit api-server in a guaranteed way, so we ask the model to draft well-
 * grounded study sources around the topic. This is honest about its nature
 * (synthesised summaries) and leaves slots for educator review.
 */
export async function researchTopic(
  topic: string,
  opts: {
    includeWeb?: boolean;
    includeYouTube?: boolean;
    includeEbooks?: boolean;
    maxResults?: number;
  },
): Promise<StudioResearchSource[]> {
  const max = Math.min(Math.max(opts.maxResults ?? 6, 1), 12);
  const kinds: ("web" | "youtube" | "ebook")[] = [];
  if (opts.includeWeb !== false) kinds.push("web");
  if (opts.includeYouTube !== false) kinds.push("youtube");
  if (opts.includeEbooks !== false) kinds.push("ebook");
  if (kinds.length === 0) kinds.push("web");

  const out = await chatJson<{ sources: StudioResearchSource[] }>(
    `You are a research assistant for educators building assessments. The educator gives you a topic; you produce well-grounded study sources they can review and add as assessment materials. Each source has: kind (one of ${kinds.join(", ")}), title, sourceUrl (best-guess canonical URL or null), author (or null), snippet (1-2 sentence preview), contentText (3-6 paragraphs of substantive teaching content the educator could lift directly into their assessment material). Be intellectually honest — if you are not sure of an exact URL, return null rather than invent. Return ONLY content you are confident is accurate. JSON only.`,
    `Topic: ${topic}\n\nReturn up to ${max} sources distributed across these kinds: ${kinds.join(", ")}.\nReply JSON: { "sources": [{"kind": "web|youtube|ebook", "title": string, "sourceUrl": string|null, "author": string|null, "snippet": string, "contentText": string}, ...] }`,
    { fast: true },
  );
  return (out.sources ?? []).slice(0, max);
}

// ─────────────── Question generation ───────────────

export type StudioQuestionType =
  | "multiple_choice"
  | "true_false"
  | "short_answer"
  | "long_answer"
  | "scenario"
  | "essay";

export interface StudioGeneratedOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface StudioGeneratedQuestion {
  type: StudioQuestionType;
  prompt: string;
  context: string | null;
  options: StudioGeneratedOption[];
  modelAnswer: string | null;
  rubricCriterionIds: string[];
  taxonomyLevel: number;
  points: number;
}

export async function generateStudioQuestions(args: {
  taxonomy: StudioTaxonomyKind;
  rubricCriteria: { id: string; label: string; description: string; targetLevel: number }[];
  materials: { title: string; contentText: string }[];
  types: StudioQuestionType[];
  targetLevels: number[];
  count: number;
  instructions?: string | null;
}): Promise<StudioGeneratedQuestion[]> {
  const tax = getTaxonomy(args.taxonomy);
  const levelSpec = tax.levels
    .map((l) => `Level ${l.level} — ${l.name}: ${l.summary}`)
    .join("\n");
  const matText = args.materials
    .map(
      (m, i) =>
        `--- Material ${i + 1}: ${m.title} ---\n${m.contentText.slice(0, 8000)}`,
    )
    .join("\n\n");
  const criteriaText = args.rubricCriteria
    .map((c) => `${c.id} — ${c.label} (target level ${c.targetLevel}): ${c.description}`)
    .join("\n");

  const out = await chatJson<{ questions: StudioGeneratedQuestion[] }>(
    `You are a senior assessment designer. Write rigorous, level-calibrated questions strictly grounded in the supplied materials and aligned to the supplied rubric criteria using ${tax.title} (${tax.subtitle}).

Quality rules:
- Every question must be answerable from the materials alone.
- Every question must target one of the requested levels and reference the rubric criterion ids it assesses.
- multiple_choice: exactly 4 options, exactly one correct, distractors plausible but defensibly wrong.
- true_false: a single declarative statement.
- short_answer: 1-3 sentence expected answer.
- long_answer / scenario / essay: provide a substantive modelAnswer (4-10 sentences) and a "context" if a scenario is needed.
- No emojis, no markdown.
JSON only.`,
    `Taxonomy: ${tax.title}
Level reference:
${levelSpec}

Rubric criteria available:
${criteriaText}

Requested question types: ${args.types.join(", ")}
Requested target levels: ${args.targetLevels.join(", ")}
Number of questions: ${args.count}
${args.instructions ? `Additional examiner instructions: ${args.instructions}` : ""}

Materials:
${matText}

Reply JSON: {
  "questions": [
    {
      "type": one of [${args.types.map((t) => `"${t}"`).join(", ")}],
      "prompt": string,
      "context": string|null (only for scenario/long_answer/essay if a scene-setter helps; else null),
      "options": [{"id":"a","text":string,"isCorrect":bool}, ...] (4 options for multiple_choice; for true_false provide 2 with ids "true"/"false"; for written answers return []),
      "modelAnswer": string|null (required for short_answer/long_answer/scenario/essay; null for mcq/tf),
      "rubricCriterionIds": [criterion id, ...],
      "taxonomyLevel": int,
      "points": number
    }
  ]
}`,
    { fast: true },
  );
  return (out.questions ?? []).slice(0, args.count);
}

// ─────────────── AI marking (subjective + overall) ───────────────

export interface StudioMarkedAnswer {
  score: number;
  feedback: string;
  criterionScores: { criterionId: string; score: number; comment: string }[];
  /** Grader's self-reported confidence in the criterion scores. 0..1. */
  confidence: number;
  /** Private chain-of-thought for audit. Not shown to students by default. */
  reasoning: string;
}

const STUDIO_LEVEL_ANCHORS = `Score every criterion using these EXACT anchors (do not pick anything in between):
- 0.0 — Absent / wrong / contradicts the materials.
- 0.25 — Largely off; gestures at the right idea but the substance is missing or wrong.
- 0.5 — Half-credit; one solid point but missing key elements OR partially incorrect.
- 0.75 — Mostly right; core is correct, minor omission or imprecision.
- 1.0 — Fully correct, on-point, grounded in the materials and at the target taxonomy level.`;

function studioClamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

export async function markStudioAnswer(args: {
  taxonomy: StudioTaxonomyKind;
  question: {
    type: StudioQuestionType;
    prompt: string;
    context: string | null;
    options: { id: string; text: string; isCorrect: boolean }[];
    modelAnswer: string | null;
    points: number;
    taxonomyLevel: number;
    rubricCriterionIds: string[];
  };
  rubricCriteria: { id: string; label: string; description: string; weight: number; targetLevel: number }[];
  studentAnswer: { mode: "text" | "voice" | "handwriting"; responseText: string; selectedOptionIds: string[] };
}): Promise<StudioMarkedAnswer> {
  const q = args.question;

  // Deterministic grading for objective items.
  if (q.type === "multiple_choice" || q.type === "true_false") {
    const correctIds = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id));
    const picked = new Set(args.studentAnswer.selectedOptionIds);
    const correct =
      picked.size === correctIds.size &&
      Array.from(correctIds).every((id) => picked.has(id));
    return {
      score: correct ? q.points : 0,
      feedback: correct
        ? "Correct."
        : `Incorrect. Expected: ${q.options
            .filter((o) => o.isCorrect)
            .map((o) => o.text)
            .join(" / ")}.`,
      criterionScores: q.rubricCriterionIds.map((id) => ({
        criterionId: id,
        score: correct ? 1 : 0,
        comment: correct ? "Met" : "Not met",
      })),
      confidence: 1,
      reasoning: "Deterministic option-id match.",
    };
  }

  // Use the question's tagged criteria when present; otherwise fall back to
  // ALL rubric criteria so the grader still has a structure to score against.
  let relevantCriteria =
    q.rubricCriterionIds.length > 0
      ? args.rubricCriteria.filter((c) => q.rubricCriterionIds.includes(c.id))
      : args.rubricCriteria;

  // Last-resort synthetic criterion if the educator's rubric is empty AND
  // the question has no tagged criteria. Keeps subjective grading meaningful
  // instead of always returning 0.
  if (relevantCriteria.length === 0) {
    relevantCriteria = [
      {
        id: "__overall__",
        label: "Overall quality",
        description:
          "Holistic judgement: how well does the response answer the prompt at the target taxonomy level?",
        weight: 1,
        targetLevel: q.taxonomyLevel,
      },
    ];
  }

  // Normalised weights — the AI scores each criterion in [0,1], the SERVER
  // computes the final weighted score. We never trust the model to do the
  // multiplication itself. If every criterion in the rubric has zero (or
  // missing) weight, fall back to equal weighting so the answer can still
  // earn credit.
  const positiveWeightSum = relevantCriteria.reduce(
    (s, c) => s + (c.weight > 0 ? c.weight : 0),
    0,
  );
  const useEqual = positiveWeightSum <= 0;
  const equalShare = 1 / relevantCriteria.length;
  const normWeights = new Map(
    relevantCriteria.map((c) => [
      c.id,
      useEqual ? equalShare : (c.weight > 0 ? c.weight : 0) / positiveWeightSum,
    ]),
  );

  const tax = getTaxonomy(args.taxonomy);
  type RawStudioGrade = {
    reasoning: string;
    confidence: number;
    feedback: string;
    criterionScores: { criterionId: string; score: number; comment: string }[];
  };

  let raw: RawStudioGrade;
  try {
    raw = await chatJson<RawStudioGrade>(
    `You are a strict but fair examiner marking a written response against a rubric anchored in ${tax.title} (${tax.subtitle}).

${STUDIO_LEVEL_ANCHORS}

REASONING DISCIPLINE:
1. First write a private "reasoning" string (2-4 sentences) walking through the evidence: what the student claimed vs what the materials and target level require.
2. Then award each criterion an anchor score in [0,1].
3. Then write "feedback" (2-4 sentences, specific and actionable — reference the rubric criteria by label).
4. Finally rate your own "confidence" (0..1). Use < 0.6 when the answer is genuinely ambiguous, the materials don't settle it, or the response is too short to score one or more criteria reliably.

DO NOT compute a final score. The server weights and totals the criterion scores. No emojis. JSON only.`,
    `Question (target level ${q.taxonomyLevel}, max points ${q.points}):
${q.context ? `Context: ${q.context}\n` : ""}Prompt: ${q.prompt}
${q.modelAnswer ? `Model answer (reference, not the only acceptable answer): ${q.modelAnswer}` : ""}

Rubric criteria to score (use the EXACT criterionId strings shown):
${relevantCriteria
  .map(
    (c) =>
      `- criterionId="${c.id}" — ${c.label} (weight ${c.weight}, target level ${c.targetLevel}) — ${c.description}`,
  )
  .join("\n")}

Student response (mode=${args.studentAnswer.mode}):
"""${args.studentAnswer.responseText}"""

Reply JSON: {
  "reasoning": string,
  "confidence": 0..1,
  "feedback": string,
  "criterionScores": [{"criterionId": string (must match one above), "score": 0|0.25|0.5|0.75|1, "comment": short string}, ...]
}`,
    );
  } catch (err) {
    // Hard grader failure — return a structured zero-credit grade so the
    // route can persist a row and the educator can manually mark later.
    return {
      score: 0,
      feedback:
        "We could not auto-grade this response. An educator will review it shortly.",
      criterionScores: relevantCriteria.map((c) => ({
        criterionId: c.id,
        score: 0,
        comment: "Not scored — grader unavailable.",
      })),
      confidence: 0,
      reasoning: `Grader fallback: ${err instanceof Error ? err.message : "unknown"}`.slice(
        0,
        500,
      ),
    };
  }

  // Server-side weighted total. Skip criteria the model didn't return — they
  // count as zero, which is intentional (forces the model to score every
  // listed criterion; missing it costs the student credit).
  const rawList = Array.isArray(raw?.criterionScores) ? raw.criterionScores : [];
  const byId = new Map(
    rawList
      .filter((c) => c && typeof c.criterionId === "string")
      .map((c) => [c.criterionId, c]),
  );
  const finalCriterionScores = relevantCriteria.map((c) => {
    const r = byId.get(c.id);
    return {
      criterionId: c.id,
      score: studioClamp01(typeof r?.score === "number" ? r.score : 0),
      comment:
        typeof r?.comment === "string" && r.comment.trim()
          ? r.comment.trim()
          : "Not scored.",
    };
  });
  const weighted = finalCriterionScores.reduce(
    (s, c) => s + (normWeights.get(c.criterionId) ?? 0) * c.score,
    0,
  );
  const finalScore = Math.round(weighted * q.points * 100) / 100;

  return {
    score: finalScore,
    feedback: raw.feedback?.trim() || "Graded.",
    criterionScores: finalCriterionScores,
    confidence: studioClamp01(raw.confidence ?? 0.75),
    reasoning: raw.reasoning?.trim() || "",
  };
}

export interface StudioOverallNarrative {
  overallNarrative: string;
}

export async function generateOverallNarrative(args: {
  studentName: string;
  taxonomy: StudioTaxonomyKind;
  rubricCriteria: { id: string; label: string }[];
  perQuestion: { prompt: string; score: number; maxScore: number; feedback: string | null }[];
  totalScore: number;
  maxScore: number;
  passed: boolean;
}): Promise<StudioOverallNarrative> {
  const tax = getTaxonomy(args.taxonomy);
  const out = await chatJson<StudioOverallNarrative>(
    `You write a 4-6 sentence overall narrative for a student's assessment performance, framed in the language of ${tax.title}. Be specific (reference patterns across answers), constructive, and direct. No emojis. JSON only.`,
    `Student: ${args.studentName}
Result: ${args.totalScore}/${args.maxScore} (${args.passed ? "passed" : "did not meet threshold"}).

Per-question summary:
${args.perQuestion
  .map(
    (p, i) =>
      `${i + 1}. ${p.prompt.slice(0, 140)} — ${p.score}/${p.maxScore}${p.feedback ? ` — ${p.feedback}` : ""}`,
  )
  .join("\n")}

Reply JSON: { "overallNarrative": string }`,
    { fast: true },
  );
  return out;
}

export interface StudioCohortInsights {
  cohortSummary: string;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export async function analyzeCohort(args: {
  assessmentTitle: string;
  taxonomy: StudioTaxonomyKind;
  rubricCriteria: { id: string; label: string; targetLevel: number }[];
  attempts: {
    studentName: string;
    score: number | null;
    maxScore: number | null;
    passed: boolean | null;
    perCriterion: { criterionId: string; avg: number }[];
  }[];
}): Promise<StudioCohortInsights> {
  if (args.attempts.length === 0) {
    return {
      cohortSummary:
        "No attempts have been submitted yet. Share the assessment code with your students to start gathering insights.",
      strengths: [],
      gaps: [],
      recommendations: [],
    };
  }
  return chatJson<StudioCohortInsights>(
    `You are a data-grounded assessment analyst. Read the cohort summary and produce a concise, actionable analysis using ${getTaxonomy(args.taxonomy).title} terminology. JSON only. No emojis.`,
    `Assessment: ${args.assessmentTitle}
Rubric criteria:
${args.rubricCriteria.map((c) => `- ${c.id} ${c.label} (target ${c.targetLevel})`).join("\n")}

Attempts:
${args.attempts
  .map(
    (a) =>
      `- ${a.studentName}: ${a.score ?? "?"}/${a.maxScore ?? "?"} ${a.passed ? "PASS" : "FAIL"} ${a.perCriterion.map((p) => `${p.criterionId}=${(p.avg * 100).toFixed(0)}%`).join(" ")}`,
  )
  .join("\n")}

Reply JSON: {
  "cohortSummary": 3-5 sentences,
  "strengths": [3-5 short bullet strings],
  "gaps": [3-5 short bullet strings],
  "recommendations": [3-5 short bullet strings]
}`,
  );
}

// ─────────────── Voice + handwriting + proctor vision ───────────────

function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } {
  const m = /^data:([^;,]+);base64,(.*)$/.exec(dataUrl.trim());
  if (!m) throw new Error("Invalid data URL");
  return { mime: m[1] ?? "application/octet-stream", buffer: Buffer.from(m[2] ?? "", "base64") };
}

export async function transcribeAudioDataUrl(dataUrl: string): Promise<string> {
  const { buffer } = dataUrlToBuffer(dataUrl);
  const compatible = await ensureCompatibleFormat(buffer);
  const text = await speechToText(compatible.buffer, compatible.format);
  return (text ?? "").trim();
}

export async function readHandwritingDataUrl(
  dataUrl: string,
): Promise<{ text: string; confidence: number }> {
  const out = await chatJson<{ text: string; confidence: number }>(
    `You are an OCR engine that transcribes handwritten student responses. Read the image and return the verbatim text the student wrote, preserving line breaks. If the image is blank or you cannot read it, return empty string with confidence 0. JSON only.`,
    "",
  ).catch(() => ({ text: "", confidence: 0 }));
  // Fallback: do real vision call.
  try {
    const response = await openai.chat.completions.create({
      model: VISION_MODEL,
      max_completion_tokens: 1500,
      messages: [
        {
          role: "system",
          content:
            "You transcribe handwritten student answers. Return JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Transcribe this handwritten answer verbatim. Reply JSON: { "text": string, "confidence": 0..1 }',
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = tryParseJson<{ text: string; confidence: number }>(
      response.choices[0]?.message?.content ?? "",
    );
    if (parsed) return parsed;
  } catch (err) {
    logger.warn({ err }, "handwriting OCR failed");
  }
  return out;
}

export interface StudioSnapshotAnalysis {
  faceCount: number;
  analysis: string;
  flagged: boolean;
}

export async function analyzeProctorSnapshot(
  dataUrl: string,
): Promise<StudioSnapshotAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: VISION_MODEL,
      max_completion_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "You are an exam proctor reviewing a webcam still. Be concise and objective. JSON only.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Analyze this webcam frame from a student taking an online exam. Reply JSON: { "faceCount": int (people visible), "analysis": 1-2 sentence factual description, "flagged": bool true if anything is suspicious (multiple faces, no face, looking off-screen for long, phone visible, second screen visible) }',
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });
    const parsed = tryParseJson<StudioSnapshotAnalysis>(
      response.choices[0]?.message?.content ?? "",
    );
    if (parsed) return parsed;
  } catch (err) {
    logger.warn({ err }, "proctor snapshot vision failed");
  }
  return { faceCount: 0, analysis: "Snapshot received.", flagged: false };
}

export { STUDIO_TAXONOMIES };
