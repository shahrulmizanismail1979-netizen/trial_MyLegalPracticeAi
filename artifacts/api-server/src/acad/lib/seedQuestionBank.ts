import { db } from "@workspace/db";
import { randomUUID } from "node:crypto";
import {
  appsTable,
  questionBankTable,
  type App,
} from "@workspace/db/acad";
import { and, eq } from "drizzle-orm";
import {
  generateQuestion,
  type AIQuestionDraft,
  type AppContext,
} from "./ai";
import { logger } from "../../lib/logger";

type QType = AIQuestionDraft["type"];
type Difficulty = "easy" | "medium" | "hard";

const TYPE_MIX: { type: QType; difficulty: Difficulty }[] = [
  { type: "multiple_choice", difficulty: "easy" },
  { type: "multiple_choice", difficulty: "medium" },
  { type: "multiple_choice", difficulty: "medium" },
  { type: "multiple_choice", difficulty: "hard" },
  { type: "true_false", difficulty: "easy" },
  { type: "true_false", difficulty: "medium" },
  { type: "fill_blank", difficulty: "medium" },
  { type: "fill_blank", difficulty: "hard" },
  { type: "short_answer", difficulty: "medium" },
  { type: "short_answer", difficulty: "hard" },
  { type: "scenario", difficulty: "medium" },
  { type: "scenario", difficulty: "hard" },
  { type: "matching", difficulty: "medium" },
  { type: "matching", difficulty: "hard" },
];

function appCtx(app: App): AppContext {
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

// In-process mutex so a second admin trigger doesn't interleave with the
// first and over-generate. The seeder is idempotent at the cell level
// (target counts are top-ups), but two concurrent runs against the same
// undertarget cell could each insert their own draft and overshoot.
let seedInFlight: Promise<{ generated: number; total: number }> | null = null;

/**
 * Pre-generate a fixed number of vetted exam-bank questions per app, mixing
 * types and difficulties. Idempotent and additive: skips work for any
 * app/type/difficulty cell that already meets its target count, and tops up
 * the rest. Safe to re-run.
 *
 * Defaults to ~14 questions per app (98 across the 7 books → 100 total when
 * called with `extras: 2`).
 */
type SeedOpts = {
  perApp?: number;
  extras?: number;
  onlyAppSlugs?: string[];
};

/**
 * Run the seeder if no other run is in flight; otherwise await the current
 * one. Useful for callers that just want "the bank is being seeded" semantics
 * (e.g. server startup) and don't care that the in-flight run might have a
 * different scope than what they requested.
 */
export async function seedQuestionBank(
  opts: SeedOpts = {},
): Promise<{ generated: number; total: number }> {
  if (seedInFlight) {
    logger.info("Question bank seed already in progress; awaiting existing run");
    return seedInFlight;
  }
  seedInFlight = runSeed(opts).finally(() => {
    seedInFlight = null;
  });
  return seedInFlight;
}

/**
 * Try to start a seed run with the given options. Returns true if the run was
 * started (and is now executing in the background) or false if a run is
 * already in progress — letting the caller fail fast with 409 instead of
 * silently piggy-backing on a run with a different scope.
 *
 * The kicked-off run is fire-and-forget at the function level; callers can
 * await `seedQuestionBank()` afterwards to observe completion.
 */
seedQuestionBank.tryStart = async function tryStart(
  opts: SeedOpts = {},
): Promise<boolean> {
  if (seedInFlight) return false;
  const run = runSeed(opts).finally(() => {
    seedInFlight = null;
  });
  seedInFlight = run;
  // Swallow rejections so an unhandled promise rejection doesn't crash the
  // process; the run logs its own errors via the singleton logger.
  void run.catch((err) =>
    logger.error({ err }, "Question bank seed run failed"),
  );
  return true;
};

async function runSeed(
  opts: {
    perApp?: number;
    extras?: number;
    onlyAppSlugs?: string[];
  } = {},
): Promise<{ generated: number; total: number }> {
  const perApp = opts.perApp ?? TYPE_MIX.length;
  const extras = opts.extras ?? 0;
  const onlyAppSlugs =
    opts.onlyAppSlugs && opts.onlyAppSlugs.length > 0
      ? new Set(opts.onlyAppSlugs)
      : null;

  const allApps = await db.select().from(appsTable);
  const apps = onlyAppSlugs
    ? allApps.filter((a) => onlyAppSlugs.has(a.slug))
    : allApps;
  if (apps.length === 0) {
    logger.warn(
      { onlyAppSlugs: opts.onlyAppSlugs },
      "No apps to seed for question bank; skipping",
    );
    return { generated: 0, total: 0 };
  }

  let generated = 0;
  for (const app of apps) {
    const slots = TYPE_MIX.slice(0, perApp);

    // Tally what already exists per (type, difficulty) for this app.
    const existing = await db
      .select()
      .from(questionBankTable)
      .where(eq(questionBankTable.appSlug, app.slug));
    const existingCount = new Map<string, number>();
    for (const q of existing) {
      const k = `${q.type}|${q.difficulty}`;
      existingCount.set(k, (existingCount.get(k) ?? 0) + 1);
    }

    // Group target slots into a per-cell count, then top up.
    const targetCount = new Map<string, number>();
    for (const slot of slots) {
      const k = `${slot.type}|${slot.difficulty}`;
      targetCount.set(k, (targetCount.get(k) ?? 0) + 1);
    }

    for (const [cellKey, target] of targetCount) {
      const have = existingCount.get(cellKey) ?? 0;
      const need = Math.max(0, target - have);
      if (need === 0) continue;

      const [type, difficulty] = cellKey.split("|") as [QType, Difficulty];
      const cellExisting = existing
        .filter((q) => q.type === type && q.difficulty === difficulty)
        .map((q) => q.prompt);

      for (let i = 0; i < need; i++) {
        try {
          const draft = await generateQuestion(
            appCtx(app),
            type,
            difficulty,
            cellExisting,
          );
          const id = randomUUID();
          const result = await db
            .insert(questionBankTable)
            .values({
              id,
              appSlug: app.slug,
              appName: app.name,
              type: draft.type,
              difficulty,
              prompt: draft.prompt,
              scenario: draft.scenario ?? null,
              options: draft.options ?? null,
              matchingPairs: draft.matchingPairs ?? null,
              correctAnswer: draft.correctAnswer,
              points: draft.points,
              active: true,
            })
            .onConflictDoNothing({
              target: [
                questionBankTable.appSlug,
                questionBankTable.type,
                questionBankTable.difficulty,
                questionBankTable.prompt,
              ],
            })
            .returning({ id: questionBankTable.id });
          if (result.length > 0) {
            cellExisting.push(draft.prompt);
            generated += 1;
          }
          logger.info(
            { app: app.slug, type, difficulty, generated },
            "Seeded bank question",
          );
        } catch (err) {
          logger.error(
            { err, app: app.slug, type, difficulty },
            "Failed to seed bank question",
          );
        }
      }
    }
  }

  // Optional extras: distribute across apps using extra MCQ-medium fillers.
  for (let i = 0; i < extras; i++) {
    const app = apps[i % apps.length];
    if (!app) break;
    try {
      const cellExisting = (
        await db
          .select()
          .from(questionBankTable)
          .where(
            and(
              eq(questionBankTable.appSlug, app.slug),
              eq(questionBankTable.type, "multiple_choice"),
              eq(questionBankTable.difficulty, "medium"),
            ),
          )
      ).map((q) => q.prompt);
      const draft = await generateQuestion(
        appCtx(app),
        "multiple_choice",
        "medium",
        cellExisting,
      );
      const result = await db
        .insert(questionBankTable)
        .values({
          id: randomUUID(),
          appSlug: app.slug,
          appName: app.name,
          type: draft.type,
          difficulty: "medium",
          prompt: draft.prompt,
          scenario: draft.scenario ?? null,
          options: draft.options ?? null,
          matchingPairs: draft.matchingPairs ?? null,
          correctAnswer: draft.correctAnswer,
          points: draft.points,
          active: true,
        })
        .onConflictDoNothing({
          target: [
            questionBankTable.appSlug,
            questionBankTable.type,
            questionBankTable.difficulty,
            questionBankTable.prompt,
          ],
        })
        .returning({ id: questionBankTable.id });
      if (result.length > 0) generated += 1;
    } catch (err) {
      logger.error({ err, app: app.slug }, "Failed to seed extra bank question");
    }
  }

  const total = (
    await db.select().from(questionBankTable)
  ).length;

  logger.info({ generated, total }, "Question bank seeding complete");
  return { generated, total };
}
