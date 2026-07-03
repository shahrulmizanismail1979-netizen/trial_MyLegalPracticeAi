import { Router, type IRouter } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, contributionsTable, activityTable } from "@workspace/db";
import {
  ListContributionsQueryParams,
  ListContributionsResponse,
  GetContributionParams,
  GetContributionResponse,
  UpdateContributionParams,
  UpdateContributionBody,
  UpdateContributionResponse,
  DeleteContributionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contributions", async (req, res): Promise<void> => {
  const query = ListContributionsQueryParams.safeParse(req.query);
  const conditions = [];

  if (query.success && query.data.status) {
    conditions.push(eq(contributionsTable.status, query.data.status));
  }

  if (query.success && query.data.category) {
    conditions.push(eq(contributionsTable.category, query.data.category));
  }

  if (query.success && query.data.search) {
    const term = `%${query.data.search}%`;
    conditions.push(
      sql`(${or(
        ilike(contributionsTable.title, term),
        ilike(contributionsTable.contributorName, term),
        ilike(contributionsTable.contributorEmail, term),
        ilike(contributionsTable.fileName, term),
      )})`,
    );
  }

  const contributions = await db
    .select()
    .from(contributionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contributionsTable.createdAt));

  res.json(ListContributionsResponse.parse(contributions));
});

router.get("/contributions/:id", async (req, res): Promise<void> => {
  const params = GetContributionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [contribution] = await db
    .select()
    .from(contributionsTable)
    .where(eq(contributionsTable.id, params.data.id));

  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  res.json(GetContributionResponse.parse(contribution));
});

router.patch("/contributions/:id", async (req, res): Promise<void> => {
  const params = UpdateContributionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateContributionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description;
  if (parsed.data.category !== undefined)
    updates.category = parsed.data.category;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.adminNotes !== undefined)
    updates.adminNotes = parsed.data.adminNotes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [contribution] = await db
    .update(contributionsTable)
    .set(updates)
    .where(eq(contributionsTable.id, params.data.id))
    .returning();

  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  if (parsed.data.status) {
    await db.insert(activityTable).values({
      type: "contribution_status_changed",
      description: `Contribution "${contribution.title}" marked ${parsed.data.status}`,
    });
  }

  res.json(UpdateContributionResponse.parse(contribution));
});

router.delete("/contributions/:id", async (req, res): Promise<void> => {
  const params = DeleteContributionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [contribution] = await db
    .delete(contributionsTable)
    .where(eq(contributionsTable.id, params.data.id))
    .returning();

  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
