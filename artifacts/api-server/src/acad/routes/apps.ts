import { Router, type IRouter } from "express";
import { ipAiRateLimit } from "../../lib/aiRateLimit";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { appsTable } from "@workspace/db/acad";
import {
  GetAppParams,
  GetAppResponse,
  ListAppsResponse,
  GenerateStudyGuideParams,
  GenerateStudyGuideBody,
  GenerateStudyGuideResponse,
  GenerateFlashcardsParams,
  GenerateFlashcardsBody,
  GenerateFlashcardsResponse,
} from "../zod";
import {
  generateStudyGuide,
  generateFlashcards,
  type AppContext,
} from "../lib/ai";

const router: IRouter = Router();

function toAppContext(app: typeof appsTable.$inferSelect): AppContext {
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

router.get("/apps", async (_req, res): Promise<void> => {
  const apps = await db.select().from(appsTable).orderBy(appsTable.name);
  res.json(ListAppsResponse.parse(apps));
});

router.get("/apps/:slug", async (req, res): Promise<void> => {
  const params = GetAppParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [app] = await db
    .select()
    .from(appsTable)
    .where(eq(appsTable.slug, params.data.slug));
  if (!app) {
    res.status(404).json({ error: "App not found" });
    return;
  }
  res.json(GetAppResponse.parse(app));
});

router.post("/apps/:slug/study-guide", ipAiRateLimit, async (req, res): Promise<void> => {
  const params = GenerateStudyGuideParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = GenerateStudyGuideBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [app] = await db
    .select()
    .from(appsTable)
    .where(eq(appsTable.slug, params.data.slug));
  if (!app) {
    res.status(404).json({ error: "App not found" });
    return;
  }
  const guide = await generateStudyGuide(toAppContext(app), body.data.focus ?? null);
  res.json(
    GenerateStudyGuideResponse.parse({
      appSlug: app.slug,
      appName: app.name,
      ...guide,
    }),
  );
});

router.post("/apps/:slug/flashcards", ipAiRateLimit, async (req, res): Promise<void> => {
  const params = GenerateFlashcardsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = GenerateFlashcardsBody.safeParse(req.body ?? {});
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [app] = await db
    .select()
    .from(appsTable)
    .where(eq(appsTable.slug, params.data.slug));
  if (!app) {
    res.status(404).json({ error: "App not found" });
    return;
  }
  const cards = await generateFlashcards(toAppContext(app), body.data.count ?? 8);
  res.json(GenerateFlashcardsResponse.parse(cards));
});

export default router;
