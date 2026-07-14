import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { litTheoryTopics } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const topics = await db.select().from(litTheoryTopics).orderBy(asc(litTheoryTopics.order));
  res.json(topics);
});

router.get("/:id", async (req, res) => {
  const id = parseInt((req.params.id as string));
  const [topic] = await db.select().from(litTheoryTopics).where(eq(litTheoryTopics.id, id));
  if (!topic) {
    res.status(404).json({ error: "Topic not found" });
    return;
  }
  res.json(topic);
});

export default router;
