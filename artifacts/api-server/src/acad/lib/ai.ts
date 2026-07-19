import { openai } from "@workspace/integrations-openai-ai-server";

const MODEL = "gpt-5.4";
// Fast/cheap model for routine, low-stakes calls (question drafting, hints,
// summaries, narrative copy). Subjective grading still uses the big model
// because grade quality directly affects the candidate's pass/fail outcome.
const MODEL_FAST = "gpt-5-mini";

export type AIQuestionDraft = {
  type:
    | "multiple_choice"
    | "true_false"
    | "fill_blank"
    | "short_answer"
    | "scenario"
    | "matching";
  prompt: string;
  scenario?: string | null;
  options?: string[] | null;
  matchingPairs?: { left: string; right: string }[] | null;
  correctAnswer: string;
  points: number;
};

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
    return null;
  }
}

// LRU cache for chatJson — keyed by (system+user). Cuts repeat AI calls when
// the same question/answer pair is graded again (regrade after model retry,
// candidates submitting identical short answers like "true"/"false").
const CHAT_CACHE = new Map<string, unknown>();
const CHAT_CACHE_MAX = 500;

// In-memory call counters for the admin health page. Reset on process restart.
const AI_USAGE = {
  callsFast: 0,
  callsFull: 0,
  cacheHits: 0,
  failures: 0,
  startedAt: new Date().toISOString(),
};
export function getExamAiUsage() {
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
  // Tuple-safe cache key: JSON.stringify of an array is injective for strings,
  // so different (system, user) pairs cannot collide even if a prompt contains
  // a delimiter-like substring. Include the model so fast/full responses don't
  // shadow each other.
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
                "\n\nIMPORTANT: Your previous response could not be parsed. Reply with VALID JSON only — no prose, no markdown, no code fences.",
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

const MAX_ANSWER_LENGTH = 4000;
export function truncateAnswer(answer: string): string {
  if (answer.length <= MAX_ANSWER_LENGTH) return answer;
  return answer.slice(0, MAX_ANSWER_LENGTH);
}

async function chatText(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: MODEL,
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  return response.choices[0]?.message?.content?.trim() ?? "";
}

export type AppContext = {
  slug: string;
  name: string;
  domain: string;
  tagline: string;
  description: string;
  category: string;
  features: string[];
};

const QUESTION_RULES = `You write exam questions for a SALES-READINESS certification. The candidates are SALESPEOPLE who must demonstrate they know each app's features, contents, and product positioning well enough to demo it and pitch it to lawyers. They are NOT being tested on substantive law.

PURPOSE OF EVERY QUESTION:
Test whether the salesperson can answer a prospective buyer's questions like "What does this app cover?", "Which of your books should I buy for X kind of work?", "Does this app include Y?", "What's the difference between feature A and feature B inside the app?", "Where in the app would I find Z?".

Questions must focus on PRODUCT KNOWLEDGE:
- What the app is (name, domain, category, tagline, target user).
- What the app contains (the features in the list — these are the actual sections/tools/libraries inside the product).
- What each feature is FOR from a practitioner-buyer's perspective (e.g. "drafting cause papers", "calculating quantum", "filling in Form 49", "looking up sample agreements").
- Which app in the family covers a given practice area or task (cross-app positioning is fine if the question is unambiguous given the app under test).
- The value proposition / who would buy this app and why.

DO NOT write questions that test the candidate's substantive legal knowledge. For example, NEVER ask:
- "What is the limitation period under section X of statute Y?"
- "Which provision governs Z?" (as a law question)
- "What are the elements of offence Q?"
- Anything that requires the candidate to actually know the law to answer.
Statutory citations may APPEAR in a question only as labels of CONTENT the app covers — e.g. "Which app in our family includes a guided workflow on Order 14 summary judgment under the Rules of Court 2012?" is fine because the answer ("MyLitAI") is about the product, not about the law.

CRITICAL CORRECTNESS RULES — read carefully:
- The ONLY ground truth about the app is the description, category, and the explicit feature list provided in the user message. Do NOT invent or assume any other facts.
- Every question's correct answer MUST be directly supported by the description or one of the listed features (i.e. provable by pointing at the brief).
- For multiple_choice: exactly ONE option must be unambiguously correct based on the listed features. The other 3 distractors must be plainly false FOR THIS app (e.g. they may name features that belong to a sibling app or are simply not in this app's list). Never include two options that are both defensible.
- For true_false: the statement must be unambiguously TRUE or unambiguously FALSE about this app based on the listed features.
- For fill_blank: the blank must have a single canonical answer drawn directly from the description or features (typically a feature name, app name, category, or domain).
- For short_answer / scenario: the scenario should put the candidate in a SALES situation (e.g. a lawyer asking what the app does, a prospect comparing two books, a demo walkthrough). The model answer must reference the actual feature names from the list verbatim where applicable.
- For matching: pair feature names on the left with what they help the practitioner do, or pair app names with their target practice area. Every "right" side must come from the listed features or description.

Style rules:
- Avoid emojis and markdown.
- Match the requested type and difficulty exactly.
- Use natural, varied phrasing — never start with "Which of the following".
- Do not test trivia about implementation, pricing, internal team, or anything not in the brief.
- Frame questions from a sales / product-knowledge angle, not a legal-academic angle.

Before responding, internally double-check: (a) the correctAnswer is directly supported by the provided feature list or description, and (b) the question tests PRODUCT/FEATURE knowledge a salesperson needs, NOT substantive legal knowledge. If either fails, REWRITE the question. Return JSON only.`;

export async function generateQuestion(
  app: AppContext,
  type: AIQuestionDraft["type"],
  difficulty: "easy" | "medium" | "hard",
  previousPrompts: string[],
): Promise<AIQuestionDraft> {
  const previousList = previousPrompts.length
    ? `\n\nDo NOT repeat or closely paraphrase any of these prior questions:\n- ${previousPrompts.join("\n- ")}`
    : "";

  const typeSpec = (() => {
    switch (type) {
      case "multiple_choice":
        return `JSON shape: { "prompt": string, "options": [string,string,string,string], "correctAnswer": string }
Where correctAnswer is one of the options, copied verbatim.`;
      case "true_false":
        return `JSON shape: { "prompt": string, "correctAnswer": "True" | "False" }`;
      case "fill_blank":
        return `JSON shape: { "prompt": string with one "_____" blank, "correctAnswer": string }
correctAnswer is the short word or phrase that fills the blank.`;
      case "short_answer":
        return `JSON shape: { "prompt": string asking for a 1-2 sentence answer, "correctAnswer": string model answer in 1-2 sentences }`;
      case "scenario":
        return `JSON shape: { "scenario": 2-4 sentence realistic situation involving a user of the app, "prompt": question that requires applying the app's features to this scenario, "correctAnswer": string model answer in 2-3 sentences }`;
      case "matching":
        return `JSON shape: { "prompt": string instruction, "matchingPairs": [{"left": string, "right": string}, ... 4 pairs], "correctAnswer": JSON-string mapping each left -> right, e.g. "{\\"A\\":\\"X\\",\\"B\\":\\"Y\\"}" }
Each left should be a feature/term and right its meaning. Pairs must be plausibly confusable.`;
    }
  })();

  const points = difficulty === "easy" ? 5 : difficulty === "medium" ? 10 : 15;

  // Question drafting is high-volume and low-stakes; cheap model is fine.
  // The dedicated verifier below still runs on the big model.
  const result = await chatJson<Omit<AIQuestionDraft, "type" | "points">>(
    QUESTION_RULES,
    `App under test:
Name: ${app.name}
Domain: ${app.domain}
Tagline: ${app.tagline}
Category: ${app.category}
Description: ${app.description}
Key features:
- ${app.features.join("\n- ")}

Write ONE ${difficulty} difficulty question of type "${type}" about this app.

${typeSpec}${previousList}`,
    { fast: true },
  );

  const draft: AIQuestionDraft = {
    type,
    points,
    prompt: result.prompt,
    scenario: result.scenario ?? null,
    options: result.options ?? null,
    matchingPairs: result.matchingPairs ?? null,
    correctAnswer: result.correctAnswer,
  };

  // Self-verification pass: ask the model to critique its own draft against
  // the feature list and fix the correctAnswer (or rewrite the question) if
  // the draft is unsupported. This dramatically reduces wrong stored answers.
  try {
    const verified = await chatJson<{
      ok: boolean;
      reason?: string;
      fixed?: Partial<AIQuestionDraft>;
    }>(
      `You are a quality reviewer for exam questions about "${app.name}". The ONLY authoritative facts about this app are the description and the listed features. Verify the draft below.
- If the draft's correctAnswer is fully supported by the description/features and (for multiple_choice) is the ONLY correct option among the listed options, reply { "ok": true }.
- If anything is wrong (correctAnswer not in features; ambiguous; multiple correct MCQ options; T/F statement not clearly true/false; fill_blank with multiple plausible answers; matching pairs not from features), reply { "ok": false, "reason": short reason, "fixed": { ...corrected fields only... } }.
The fixed object may contain any of: prompt, options, matchingPairs, scenario, correctAnswer. Keep the same question type. JSON only.`,
      `App: ${app.name}
Description: ${app.description}
Authoritative features:
- ${app.features.join("\n- ")}

Draft (type=${type}):
${JSON.stringify(draft, null, 2)}`,
    );
    if (!verified.ok && verified.fixed) {
      if (verified.fixed.prompt) draft.prompt = verified.fixed.prompt;
      if (verified.fixed.options) draft.options = verified.fixed.options;
      if (verified.fixed.matchingPairs) draft.matchingPairs = verified.fixed.matchingPairs;
      if (verified.fixed.scenario !== undefined) draft.scenario = verified.fixed.scenario;
      if (verified.fixed.correctAnswer) draft.correctAnswer = verified.fixed.correctAnswer;
    }
  } catch {
    // If verification fails, fall back to the original draft — the runtime
    // grader will still re-check against the feature list at grading time.
  }

  return draft;
}

export type GradedCriterion = {
  label: string;
  weight: number; // 0..1, sums to 1 across all criteria for a question
  score: number; // 0..1 — AI's quality rating for this criterion
  comment: string; // 1 short sentence
};

export type GradedAnswer = {
  isCorrect: boolean;
  score: number;
  feedback: string;
  encouragement: string;
  /**
   * Per-criterion breakdown for subjective grading (short_answer, scenario,
   * and the AI fallback path for matching). Empty for objective auto-graded
   * answers where a single accuracy signal is enough.
   */
  criterionScores: GradedCriterion[];
  /**
   * Grader's self-reported confidence (0..1). Low confidence answers should
   * be routed to a human reviewer in future iterations.
   */
  confidence: number;
  /**
   * Private chain-of-thought style justification. Stored for audit and
   * regrade, NOT shown to the candidate.
   */
  reasoning: string;
};

/**
 * Anchored 4-criterion rubric used for short_answer + scenario grading.
 * Weights sum to 1. The server multiplies (sum of weighted criterion scores)
 * by `points` to get the final score — we never trust the model to do the
 * multiplication itself, which historically produced inconsistent totals.
 */
const SUBJECTIVE_RUBRIC: { label: string; weight: number; description: string }[] = [
  {
    label: "Accuracy",
    weight: 0.4,
    description:
      "Are the facts the candidate states actually true about this app per the authoritative feature list? Any false claim about the product hurts this score.",
  },
  {
    label: "Completeness",
    weight: 0.3,
    description:
      "Does the answer cover the main points the question is asking for? Partial coverage gets a mid score; missing the core ask gets a low score.",
  },
  {
    label: "Relevance",
    weight: 0.2,
    description:
      "Does the answer stay on the specific question/scenario asked, or does it drift into unrelated features or generic sales fluff?",
  },
  {
    label: "Clarity",
    weight: 0.1,
    description:
      "Is the answer expressed clearly enough that a prospective buyer would understand the pitch? Penalise only when meaning is obscured.",
  },
];

const LEVEL_ANCHORS = `Score anchors for every criterion (use these EXACT values — do not pick anything in between):
- 0.0 — Absent / wrong / contradicts the feature list.
- 0.25 — Largely off; gestures at the right idea but the substance is wrong or missing.
- 0.5 — Half-credit; one solid point but missing key elements OR partially incorrect.
- 0.75 — Mostly right; the core is correct, minor omission or imprecision.
- 1.0 — Fully correct, on-point, grounded in the feature list.`;

type RawSubjectiveGrade = {
  reasoning: string;
  confidence: number;
  criterionScores: { label: string; score: number; comment: string }[];
  feedback: string;
  encouragement: string;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function combineCriteria(
  raw: RawSubjectiveGrade,
  points: number,
): { criterionScores: GradedCriterion[]; weightedScore: number } {
  // Defensive: AI may omit / mistype `criterionScores` entirely. Treat any
  // non-array as empty so missing-criterion handling kicks in below.
  const rawList = Array.isArray(raw?.criterionScores) ? raw.criterionScores : [];
  const combined: GradedCriterion[] = SUBJECTIVE_RUBRIC.map((c) => {
    const match = rawList.find(
      (r) =>
        r &&
        typeof r.label === "string" &&
        r.label.trim().toLowerCase() === c.label.toLowerCase(),
    );
    return {
      label: c.label,
      weight: c.weight,
      score: clamp01(typeof match?.score === "number" ? match.score : 0),
      comment:
        typeof match?.comment === "string" && match.comment.trim()
          ? match.comment.trim()
          : "No comment provided.",
    };
  });
  const weighted = combined.reduce((sum, c) => sum + c.weight * c.score, 0);
  return { criterionScores: combined, weightedScore: weighted * points };
}

/**
 * Last-resort fallback when the AI grader throws or returns a totally
 * unusable shape. Returns a zero-credit grade with full rubric structure so
 * the candidate still sees per-axis output and the route never 500s.
 */
function gradeFallback(points: number, reason: string): GradedAnswer {
  const criterionScores: GradedCriterion[] = SUBJECTIVE_RUBRIC.map((c) => ({
    label: c.label,
    weight: c.weight,
    score: 0,
    comment: "Not scored — grader unavailable.",
  }));
  return {
    isCorrect: false,
    score: 0,
    feedback:
      "We could not auto-grade this answer. An examiner will review it shortly.",
    encouragement: "Don't worry — keep going.",
    criterionScores,
    confidence: 0,
    reasoning: `Grader fallback: ${reason}`.slice(0, 500),
  };
}

export async function gradeAnswer(
  app: AppContext,
  question: {
    type: AIQuestionDraft["type"];
    prompt: string;
    scenario?: string | null;
    options?: string[] | null;
    matchingPairs?: { left: string; right: string }[] | null;
    correctAnswer: string;
    points: number;
  },
  userAnswer: string,
): Promise<GradedAnswer> {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  const objectiveCorrect = (msg = "Correct. Expected answer matches."): GradedAnswer => ({
    isCorrect: true,
    score: question.points,
    feedback: msg,
    encouragement: "Solid recall. Keep that momentum.",
    criterionScores: [],
    confidence: 1,
    reasoning: "Exact / deterministic match against the stored correct answer.",
  });

  // Fast path: exact match against stored correctAnswer is always correct.
  if (
    question.type === "multiple_choice" ||
    question.type === "true_false" ||
    question.type === "fill_blank"
  ) {
    if (norm(userAnswer) === norm(question.correctAnswer)) {
      return objectiveCorrect(
        `Correct. The expected answer is "${question.correctAnswer}".`,
      );
    }
    // fill_blank: also accept numeric tolerance for numeric expected answers.
    if (question.type === "fill_blank") {
      const expectedNum = Number(question.correctAnswer.replace(/[, ]/g, ""));
      const gotNum = Number(userAnswer.replace(/[, ]/g, ""));
      if (
        Number.isFinite(expectedNum) &&
        Number.isFinite(gotNum) &&
        Math.abs(expectedNum - gotNum) < 1e-6
      ) {
        return objectiveCorrect(
          `Correct. The expected answer is ${question.correctAnswer}.`,
        );
      }
    }
  }

  // For matching, also accept exact JSON-equivalent map.
  if (question.type === "matching") {
    try {
      const expected = JSON.parse(question.correctAnswer);
      const got = JSON.parse(userAnswer);
      if (
        expected &&
        got &&
        Object.keys(expected).length === Object.keys(got).length &&
        Object.keys(expected).every(
          (k) => norm(String(expected[k])) === norm(String(got[k])),
        )
      ) {
        return objectiveCorrect("Correct. All pairs matched.");
      }
    } catch {
      // fall through to AI grader
    }
  }

  // Subjective grading path — short_answer + scenario use the full rubric.
  // MCQ/TF/fill_blank/matching that fell through (wrong / unparseable) get a
  // single-criterion "Accuracy" grade so the candidate still sees per-axis
  // feedback in a uniform shape.
  const isSubjective =
    question.type === "short_answer" || question.type === "scenario";

  if (isSubjective) {
    const matchingNote = "";
    const passFloor = Math.ceil(question.points * 0.7);
    const rubricList = SUBJECTIVE_RUBRIC.map(
      (c) => `- ${c.label} (weight ${c.weight}): ${c.description}`,
    ).join("\n");

    let raw: RawSubjectiveGrade;
    try {
      raw = await chatJson<RawSubjectiveGrade>(
      `You are a strict-but-fair sales-readiness examiner grading a written answer about the app "${app.name}".

GROUND TRUTH: The ONLY authoritative facts about this app are the description and the explicit feature list shown in the user message. The "expected answer" stored with the question is a hint, but it can occasionally be wrong or imprecise. Prefer the feature list if they conflict.

RUBRIC — score EACH of these 4 criteria independently in [0,1] using the anchors below:
${rubricList}

${LEVEL_ANCHORS}

REASONING DISCIPLINE:
1. First write a short private "reasoning" string (1-3 sentences) that walks through the evidence: what the candidate said vs what the feature list supports.
2. Then score each criterion on the anchor scale.
3. Then write 2 short fields for the candidate: "feedback" (1-2 specific sentences grounded in the feature list — name the feature) and "encouragement" (one motivational line).
4. Finally rate your own "confidence" (0..1) — how sure you are about the criterion scores. Use < 0.6 only when the answer is genuinely ambiguous or the feature list does not settle it.

DO NOT compute a total score yourself. The server multiplies your weighted criterion scores by the question's max points. JSON only.${matchingNote}`,
      `App: ${app.name} — ${app.tagline}
Description: ${app.description}
Authoritative feature list:
- ${app.features.join("\n- ")}

Question type: ${question.type}
${question.scenario ? `Scenario: ${question.scenario}\n` : ""}Question: ${question.prompt}
Expected answer (verify against the feature list, do not assume it is perfect): ${question.correctAnswer}

Candidate's answer:
"""${userAnswer}"""

Reply JSON: {
  "reasoning": string,
  "confidence": 0..1,
  "criterionScores": [
    {"label": "Accuracy", "score": 0|0.25|0.5|0.75|1, "comment": short string},
    {"label": "Completeness", "score": 0|0.25|0.5|0.75|1, "comment": short string},
    {"label": "Relevance", "score": 0|0.25|0.5|0.75|1, "comment": short string},
    {"label": "Clarity", "score": 0|0.25|0.5|0.75|1, "comment": short string}
  ],
  "feedback": "1-2 sentence specific feedback to the candidate, grounded in the feature list",
  "encouragement": "one short motivational sentence"
}

Max points for this question: ${question.points}. Pass threshold for THIS question: >= ${passFloor} points.`,
      );
    } catch (err) {
      return gradeFallback(
        question.points,
        err instanceof Error ? err.message : "unknown",
      );
    }

    const { criterionScores, weightedScore } = combineCriteria(raw, question.points);
    const finalScore = Math.round(weightedScore * 100) / 100;
    const isCorrect = finalScore >= passFloor;
    return {
      isCorrect,
      score: finalScore,
      feedback: raw.feedback?.trim() || "Graded.",
      encouragement: raw.encouragement?.trim() || "Keep going.",
      criterionScores,
      confidence: clamp01(raw.confidence ?? 0.75),
      reasoning: raw.reasoning?.trim() || "",
    };
  }

  // AI fallback for non-exact MCQ/TF/fill_blank/matching attempts. Single
  // accuracy axis — the model decides full/partial/no credit, and the server
  // still applies a sanity clamp to [0, points].
  const matchingNote =
    question.type === "matching" && question.matchingPairs
      ? `\nThe expected mapping (left -> right) is: ${question.correctAnswer}`
      : "";

  type ObjectiveFallback = {
    reasoning: string;
    confidence: number;
    accuracy: number; // 0..1
    feedback: string;
    encouragement: string;
  };

  const fb = await chatJson<ObjectiveFallback>(
    `You grade a near-miss objective exam answer about the app "${app.name}".

GROUND TRUTH: The description and explicit feature list below are the only authoritative facts. The stored "expected answer" is a hint but may be imprecise — prefer the feature list if they conflict.

Score a single "accuracy" axis in [0,1] using these anchors:
- 0.0 — Wrong / contradicts the feature list.
- 0.5 — Partially right (e.g. correct app named but wrong feature, or vice versa).
- 1.0 — Equivalent to the expected answer per the feature list, even if worded differently.

The server multiplies accuracy by the question's max points. Do NOT compute a total. JSON only.`,
    `App: ${app.name} — ${app.tagline}
Description: ${app.description}
Authoritative feature list:
- ${app.features.join("\n- ")}

Question type: ${question.type}
${question.scenario ? `Scenario: ${question.scenario}\n` : ""}Question: ${question.prompt}
${question.options ? `Options: ${question.options.join(" | ")}\n` : ""}Expected answer: ${question.correctAnswer}${matchingNote}

Candidate's answer:
"""${userAnswer}"""

Reply JSON: { "reasoning": short string, "confidence": 0..1, "accuracy": 0|0.5|1, "feedback": 1-2 sentence specific feedback, "encouragement": one short motivational line }`,
  );

  const accuracy = clamp01(fb.accuracy ?? 0);
  const finalScore = Math.round(accuracy * question.points * 100) / 100;
  return {
    isCorrect: accuracy >= 0.7,
    score: finalScore,
    feedback: fb.feedback?.trim() || "Graded.",
    encouragement: fb.encouragement?.trim() || "Keep going.",
    criterionScores: [
      {
        label: "Accuracy",
        weight: 1,
        score: accuracy,
        comment: fb.feedback?.trim() || "",
      },
    ],
    confidence: clamp01(fb.confidence ?? 0.7),
    reasoning: fb.reasoning?.trim() || "",
  };
}

export async function generateHint(
  app: AppContext,
  question: { prompt: string; scenario?: string | null; type: string },
): Promise<string> {
  return chatText(
    `You give a single helpful hint for an exam question about ${app.name}. The hint must NOT reveal the answer. 1-2 sentences. No emojis.`,
    `App: ${app.name}
Features:
- ${app.features.join("\n- ")}

${question.scenario ? `Scenario: ${question.scenario}\n` : ""}Question: ${question.prompt}

Give a single nudging hint.`,
  );
}

export async function explainAnswer(
  app: AppContext,
  question: {
    prompt: string;
    scenario?: string | null;
    correctAnswer: string;
    userAnswer?: string | null;
  },
): Promise<{ explanation: string; relatedFeatures: string[] }> {
  return chatJson(
    `You explain exam answers in plain language, in the context of the app "${app.name}". JSON only.`,
    `App features:
- ${app.features.join("\n- ")}

${question.scenario ? `Scenario: ${question.scenario}\n` : ""}Question: ${question.prompt}
Correct answer: ${question.correctAnswer}
${question.userAnswer ? `Candidate's answer: ${question.userAnswer}\n` : ""}
Reply JSON: { "explanation": 3-5 sentence detailed explanation of why the correct answer is correct, "relatedFeatures": array of 2-4 feature names from the list above that are most relevant }`,
    { fast: true },
  );
}

export async function generateStudyGuide(
  app: AppContext,
  focus: string | null,
): Promise<{
  overview: string;
  keyFeatures: string[];
  sections: { heading: string; content: string }[];
  quickQuiz: string[];
}> {
  return chatJson(
    "You write structured SALES-READINESS study guides for our app salespeople — NOT legal study material. The reader needs to learn what the app contains and how to pitch it, not how to practise the underlying law. JSON only. Do NOT use emojis or markdown formatting characters in the content.",
    `App: ${app.name} (${app.domain})
Tagline: ${app.tagline}
Category: ${app.category}
Description: ${app.description}
Features:
- ${app.features.join("\n- ")}
${focus ? `Focus topic: ${focus}` : ""}

Reply JSON:
{
  "overview": 3-4 sentence summary of the app's purpose and audience,
  "keyFeatures": array of 5-8 short feature one-liners,
  "sections": array of 4-6 { "heading": short title, "content": 2-4 sentence study notes },
  "quickQuiz": array of 5 short self-check questions (no answers)
}`,
    { fast: true },
  );
}

export async function generateFlashcards(
  app: AppContext,
  count: number,
): Promise<{ front: string; back: string }[]> {
  const result = await chatJson<{ cards: { front: string; back: string }[] }>(
    // Flashcards: fast model
    "You write flashcards for app certification study. JSON only. Each card front is a short question or term; back is a 1-2 sentence answer. No emojis.",
    `App: ${app.name}
Features:
- ${app.features.join("\n- ")}

Generate ${count} flashcards covering the most important concepts.
Reply JSON: { "cards": [{"front": string, "back": string}, ...] }`,
    { fast: true },
  );
  return result.cards;
}

export type AIExamBlueprint = {
  title: string;
  description: string;
  appSlugs: string[];
  questionTypes: AIQuestionDraft["type"][];
  questionsPerApp: number;
  difficulty: "easy" | "medium" | "hard";
  timeLimitMinutes: number;
  rules: string;
  passThreshold: number;
  rationale: string;
};

export async function generateExamBlueprint(
  prompt: string,
  catalog: { slug: string; name: string; tagline: string; category: string }[],
): Promise<AIExamBlueprint> {
  return chatJson<AIExamBlueprint>(
    // Blueprint draft: fast model
    `You are an expert assessment designer. Given a free-form description of what an examiner wants to test, you produce a complete, well-balanced exam blueprint as JSON.

Selection rules:
- Pick ONLY apps from the provided catalog (use exact slugs).
- 1-6 apps depending on scope; fewer for focused exams, more for comprehensive ones.
- Question type mix should fit the assessment purpose: knowledge checks lean MCQ + true_false; analytical exams lean short_answer + scenario; comprehensive exams use 4-6 types.
- Difficulty: "easy" for onboarding, "medium" for standard certification, "hard" for advanced or stress-test.
- questionsPerApp: 2-4 typical, up to 8 for deep dives.
- timeLimitMinutes: budget ~1.5 min per question for easy/medium MCQ, ~3 min for short/scenario.
- passThreshold: 0.5 for hard, 0.7 default, 0.8 for easy/onboarding.
- Write 2-4 sentences of rules text describing what the candidate should and shouldn't do.
- "rationale" is a 1-2 sentence justification of your design choices.

JSON only.`,
    `Available app catalog (slug — name — category — tagline):
${catalog.map((a) => `- ${a.slug} — ${a.name} — ${a.category} — ${a.tagline}`).join("\n")}

Examiner's brief:
"""${prompt}"""

Reply JSON: { "title": string, "description": 1-2 sentence summary, "appSlugs": [slug,...], "questionTypes": ["multiple_choice"|"true_false"|"fill_blank"|"short_answer"|"scenario"|"matching", ...], "questionsPerApp": int, "difficulty": "easy"|"medium"|"hard", "timeLimitMinutes": int, "rules": multi-line rules text, "passThreshold": 0..1, "rationale": string }`,
    { fast: true },
  );
}

export async function suggestExamRules(
  title: string,
  appNames: string[],
  difficulty: string,
  timeLimitMinutes: number,
): Promise<string> {
  const out = await chatJson<{ rules: string }>(
    // Rules suggestion: fast model
    "You write concise, professional exam rules to display to a candidate before they begin a proctored online exam. Tone: firm, clear, respectful. JSON only. No emojis.",
    `Exam title: ${title}
Topics: ${appNames.join(", ")}
Difficulty: ${difficulty}
Time limit: ${timeLimitMinutes} minutes

Write 5-8 short numbered rules covering: time limit, prohibited tools/devices, fullscreen/tab-switch policy, copy-paste policy, integrity statement, what happens if violations are detected, and that the AI proctor will track behavior. Reply JSON: { "rules": multi-line numbered string with \\n separators }`,
    { fast: true },
  );
  return out.rules;
}

export async function analyzeAttempts(
  template: { title: string; passThreshold: number; appNames: string[] },
  attempts: {
    candidateName: string;
    score: number | null;
    maxScore: number | null;
    accuracy: number;
    flagged: boolean;
    trustScore: number;
    perApp: { appName: string; correct: number; total: number }[];
    wrongPrompts: string[];
  }[],
): Promise<{
  attemptCount: number;
  averageScore: number;
  averageAccuracy: number;
  passRate: number;
  flaggedRate: number;
  hardestApps: string[];
  easiestApps: string[];
  commonMistakes: string[];
  narrative: string;
}> {
  const summary = {
    attemptCount: attempts.length,
    averageScore: 0,
    averageAccuracy: 0,
    passRate: 0,
    flaggedRate: 0,
    hardestApps: [] as string[],
    easiestApps: [] as string[],
    commonMistakes: [] as string[],
    narrative: "",
  };
  if (attempts.length === 0) {
    summary.narrative =
      "No candidates have attempted this exam yet. Share the exam code with your candidates to begin gathering insights.";
    return summary;
  }
  summary.averageScore =
    attempts.reduce((s, a) => s + (a.score ?? 0), 0) / attempts.length;
  summary.averageAccuracy =
    attempts.reduce((s, a) => s + a.accuracy, 0) / attempts.length;
  summary.passRate =
    attempts.filter((a) => a.accuracy >= template.passThreshold).length /
    attempts.length;
  summary.flaggedRate =
    attempts.filter((a) => a.flagged).length / attempts.length;

  // App difficulty
  const appAcc = new Map<string, { correct: number; total: number }>();
  for (const a of attempts) {
    for (const p of a.perApp) {
      const c = appAcc.get(p.appName) ?? { correct: 0, total: 0 };
      c.correct += p.correct;
      c.total += p.total;
      appAcc.set(p.appName, c);
    }
  }
  const appList = Array.from(appAcc.entries()).map(([name, v]) => ({
    name,
    acc: v.total === 0 ? 0 : v.correct / v.total,
  }));
  appList.sort((a, b) => a.acc - b.acc);
  summary.hardestApps = appList.slice(0, 2).map((a) => a.name);
  summary.easiestApps = appList
    .slice(-2)
    .reverse()
    .map((a) => a.name);

  // AI narrative + common mistakes
  try {
    const ai = await chatJson<{ commonMistakes: string[]; narrative: string }>(
      // Cohort narrative: fast model
      "You are an examiner's analytics assistant. Read the per-attempt summary and identify patterns. JSON only. No emojis.",
      `Exam: ${template.title}
Topics: ${template.appNames.join(", ")}
Pass threshold: ${(template.passThreshold * 100).toFixed(0)}%
Aggregate: avgScore=${summary.averageScore.toFixed(1)}, avgAccuracy=${(summary.averageAccuracy * 100).toFixed(0)}%, passRate=${(summary.passRate * 100).toFixed(0)}%, flaggedRate=${(summary.flaggedRate * 100).toFixed(0)}%
Hardest apps: ${summary.hardestApps.join(", ")}
Easiest apps: ${summary.easiestApps.join(", ")}

Sample of frequently-missed prompts:
${attempts
  .slice(0, 20)
  .flatMap((a) => a.wrongPrompts)
  .slice(0, 25)
  .map((p) => `- ${p}`)
  .join("\n")}

Reply JSON: { "commonMistakes": array of 3-5 short bullet phrases summarising recurring mistakes, "narrative": 4-6 sentence executive summary of cohort performance with a recommendation }`,
      { fast: true },
    );
    summary.commonMistakes = ai.commonMistakes;
    summary.narrative = ai.narrative;
  } catch {
    summary.narrative = `Across ${attempts.length} attempt(s), candidates averaged ${(summary.averageAccuracy * 100).toFixed(0)}% accuracy with a ${(summary.passRate * 100).toFixed(0)}% pass rate.`;
  }
  return summary;
}

export async function generateExamSummary(
  session: {
    candidateName: string;
    score: number;
    maxScore: number;
    accuracy: number;
    answeredCount: number;
  },
  perApp: { appName: string; correct: number; total: number; accuracy: number }[],
  questionLog: { appName: string; prompt: string; isCorrect: boolean; userAnswer: string | null }[],
): Promise<{ strengths: string[]; weaknesses: string[]; recommendations: string; verdict: string }> {
  return chatJson(
    "You write a concise post-exam report for a certification candidate. Tone: warm, professional, specific. JSON only. No emojis or markdown.",
    `Candidate: ${session.candidateName}
Final score: ${session.score} / ${session.maxScore} (${(session.accuracy * 100).toFixed(0)}% accuracy)
Per-app breakdown:
${perApp.map((a) => `- ${a.appName}: ${a.correct}/${a.total} (${(a.accuracy * 100).toFixed(0)}%)`).join("\n")}

A sample of the questions and outcomes:
${questionLog
  .slice(0, 30)
  .map(
    (q, i) =>
      `${i + 1}. [${q.appName}] ${q.isCorrect ? "CORRECT" : "WRONG"} — Q: ${q.prompt} | A: ${q.userAnswer ?? "(no answer)"}`,
  )
  .join("\n")}

Reply JSON:
{
  "strengths": 2-4 short bullet phrases of what the candidate clearly knows,
  "weaknesses": 2-4 short bullet phrases of weak areas,
  "recommendations": 3-5 sentence study plan with specific apps and topics to revisit,
  "verdict": one-line overall verdict ending in "PASS" or "FAIL" (PASS if accuracy >= 70%)
}`,
    { fast: true },
  );
}
