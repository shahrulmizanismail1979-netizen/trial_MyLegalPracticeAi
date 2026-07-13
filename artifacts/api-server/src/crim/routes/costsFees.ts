import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, costsFeesTable } from "@workspace/db";
import { CrimListCostsFeesQueryParams, CrimGetCostFeeParams, CrimListCostsFeesResponse, CrimGetCostFeeResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/costs-fees", async (req, res): Promise<void> => {
  const params = CrimListCostsFeesQueryParams.safeParse(req.query);

  const fees = params.success && params.data.category
    ? await db.select().from(costsFeesTable).where(eq(costsFeesTable.category, params.data.category)).orderBy(costsFeesTable.title)
    : await db.select().from(costsFeesTable).orderBy(costsFeesTable.title);

  res.json(CrimListCostsFeesResponse.parse(fees));
});

router.get("/costs-fees/:id", async (req, res): Promise<void> => {
  const params = CrimGetCostFeeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [fee] = await db.select().from(costsFeesTable).where(eq(costsFeesTable.id, params.data.id));

  if (!fee) {
    res.status(404).json({ error: "Cost/fee not found" });
    return;
  }

  res.json(CrimGetCostFeeResponse.parse(fee));
});

export default router;
