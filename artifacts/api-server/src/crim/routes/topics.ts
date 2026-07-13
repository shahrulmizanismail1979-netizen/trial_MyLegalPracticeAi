import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, topicsTable } from "@workspace/db";
import { CrimListTopicsQueryParams, CrimGetTopicParams, CrimListTopicsResponse, CrimGetTopicResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/topics", async (req, res): Promise<void> => {
  const params = CrimListTopicsQueryParams.safeParse(req.query);
  const baseQuery = db.select().from(topicsTable).$dynamic();
  const filtered =
    params.success && params.data.category
      ? baseQuery.where(eq(topicsTable.category, params.data.category))
      : baseQuery;
  const topics = await filtered.orderBy(topicsTable.orderIndex);
  res.json(CrimListTopicsResponse.parse(topics));
});

router.get("/topics/:id", async (req, res): Promise<void> => {
  const params = CrimGetTopicParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [topic] = await db.select().from(topicsTable).where(eq(topicsTable.id, params.data.id));

  if (!topic) {
    res.status(404).json({ error: "Topic not found" });
    return;
  }

  res.json(CrimGetTopicResponse.parse(topic));
});

export default router;
