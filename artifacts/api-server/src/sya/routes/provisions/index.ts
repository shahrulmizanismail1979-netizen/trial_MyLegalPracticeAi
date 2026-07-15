import { Router, type IRouter } from "express";
import { eq, ilike, or, sql, and, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { provisionsTable } from "@workspace/db/sya";
import {
  ListProvisionsQueryParams,
  GetProvisionParams,
} from "../../lib/schemas";
import { gateCondition } from "../../lib/gate-filter";

const router: IRouter = Router();

router.get("/provisions", async (req, res): Promise<void> => {
  const params = ListProvisionsQueryParams.safeParse(req.query);

  const conditions: SQL[] = [];
  if (params.success && params.data.category) {
    conditions.push(eq(provisionsTable.category, params.data.category));
  }
  if (params.success && params.data.search) {
    const search = `%${params.data.search}%`;
    conditions.push(
      or(
        ilike(provisionsTable.titleEn, search),
        ilike(provisionsTable.titleBm, search),
        ilike(provisionsTable.overviewEn, search),
        ilike(provisionsTable.overviewBm, search),
      )!,
    );
  }
  const gc = gateCondition(provisionsTable.gates, req.query.gate);
  if (gc) conditions.push(gc);

  const result = conditions.length > 0
    ? await db.select().from(provisionsTable).where(and(...conditions)).orderBy(provisionsTable.order)
    : await db.select().from(provisionsTable).orderBy(provisionsTable.order);

  res.json(result);
});

router.get("/provisions/categories", async (req, res): Promise<void> => {
  const gc = gateCondition(provisionsTable.gates, req.query.gate);
  const result = await db
    .select({
      category: provisionsTable.category,
      categoryBm: provisionsTable.categoryBm,
      count: sql<number>`count(*)::int`,
    })
    .from(provisionsTable)
    .where(gc ?? undefined)
    .groupBy(provisionsTable.category, provisionsTable.categoryBm);

  res.json(result);
});

router.get("/provisions/:id", async (req, res): Promise<void> => {
  const params = GetProvisionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conds: SQL[] = [eq(provisionsTable.id, params.data.id)];
  const gc = gateCondition(provisionsTable.gates, req.query.gate);
  if (gc) conds.push(gc);

  const [provision] = await db
    .select()
    .from(provisionsTable)
    .where(and(...conds));

  if (!provision) {
    res.status(404).json({ error: "Provision not found" });
    return;
  }

  res.json(provision);
});

export default router;
