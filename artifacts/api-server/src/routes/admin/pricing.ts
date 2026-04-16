import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pricingTable, activityTable } from "@workspace/db";
import {
  CreatePricingBody,
  UpdatePricingParams,
  UpdatePricingBody,
  UpdatePricingResponse,
  DeletePricingParams,
  ListPricingResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/pricing", async (_req, res): Promise<void> => {
  const pricing = await db
    .select()
    .from(pricingTable)
    .orderBy(pricingTable.createdAt);

  res.json(ListPricingResponse.parse(pricing));
});

router.post("/pricing", async (req, res): Promise<void> => {
  const parsed = CreatePricingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pricing] = await db
    .insert(pricingTable)
    .values(parsed.data)
    .returning();

  await db.insert(activityTable).values({
    type: "price_changed",
    description: `New pricing added: ${parsed.data.appName} at RM${parsed.data.standardPrice}`,
  });

  res.status(201).json(UpdatePricingResponse.parse(pricing));
});

router.patch("/pricing/:id", async (req, res): Promise<void> => {
  const params = UpdatePricingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdatePricingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [pricing] = await db
    .update(pricingTable)
    .set(parsed.data)
    .where(eq(pricingTable.id, params.data.id))
    .returning();

  if (!pricing) {
    res.status(404).json({ error: "Pricing entry not found" });
    return;
  }

  await db.insert(activityTable).values({
    type: "price_changed",
    description: `Price updated: ${pricing.appName} to RM${pricing.standardPrice}`,
  });

  res.json(UpdatePricingResponse.parse(pricing));
});

router.delete("/pricing/:id", async (req, res): Promise<void> => {
  const params = DeletePricingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [pricing] = await db
    .delete(pricingTable)
    .where(eq(pricingTable.id, params.data.id))
    .returning();

  if (!pricing) {
    res.status(404).json({ error: "Pricing entry not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
