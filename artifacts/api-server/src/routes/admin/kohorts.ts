import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, kohortsTable, activityTable } from "@workspace/db";
import {
  CreateKohortBody,
  UpdateKohortParams,
  UpdateKohortBody,
  UpdateKohortResponse,
  ListKohortsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/kohorts", async (_req, res): Promise<void> => {
  const kohorts = await db
    .select()
    .from(kohortsTable)
    .orderBy(kohortsTable.createdAt);

  res.json(ListKohortsResponse.parse(kohorts));
});

router.post("/kohorts", async (req, res): Promise<void> => {
  const parsed = CreateKohortBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [kohort] = await db
    .insert(kohortsTable)
    .values(parsed.data)
    .returning();

  await db.insert(activityTable).values({
    type: "kohort_updated",
    description: `New kohort created: ${parsed.data.name}`,
  });

  res.status(201).json(UpdateKohortResponse.parse(kohort));
});

router.patch("/kohorts/:id", async (req, res): Promise<void> => {
  const params = UpdateKohortParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateKohortBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [kohort] = await db
    .update(kohortsTable)
    .set(parsed.data)
    .where(eq(kohortsTable.id, params.data.id))
    .returning();

  if (!kohort) {
    res.status(404).json({ error: "Kohort not found" });
    return;
  }

  await db.insert(activityTable).values({
    type: "kohort_updated",
    description: `Kohort updated: ${kohort.name}`,
  });

  res.json(UpdateKohortResponse.parse(kohort));
});

export default router;
