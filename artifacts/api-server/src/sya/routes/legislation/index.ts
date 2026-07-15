import { Router, type IRouter } from "express";
import { eq, ilike, or, and, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { legislationTable } from "@workspace/db/sya";
import {
  ListLegislationQueryParams,
  GetLegislationParams,
} from "../../lib/schemas";
import { gateCondition } from "../../lib/gate-filter";

const router: IRouter = Router();

router.get("/legislation", async (req, res): Promise<void> => {
  const params = ListLegislationQueryParams.safeParse(req.query);
  const conditions: SQL[] = [];

  const gc = gateCondition(legislationTable.gates, req.query.gate);
  if (gc) conditions.push(gc);

  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  if (state) conditions.push(eq(legislationTable.state, state));

  if (params.success && params.data.search) {
    const search = `%${params.data.search}%`;
    conditions.push(
      or(
        ilike(legislationTable.titleEn, search),
        ilike(legislationTable.titleBm, search),
        ilike(legislationTable.actNumber, search),
      )!,
    );
  }

  const result = conditions.length > 0
    ? await db.select().from(legislationTable).where(and(...conditions)).orderBy(legislationTable.order)
    : await db.select().from(legislationTable).orderBy(legislationTable.order);
  res.json(result);
});

router.get("/legislation/:id", async (req, res): Promise<void> => {
  const params = GetLegislationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conds: SQL[] = [eq(legislationTable.id, params.data.id)];
  const gc = gateCondition(legislationTable.gates, req.query.gate);
  if (gc) conds.push(gc);

  const [leg] = await db
    .select()
    .from(legislationTable)
    .where(and(...conds));

  if (!leg) {
    res.status(404).json({ error: "Legislation not found" });
    return;
  }

  res.json(leg);
});

export default router;
