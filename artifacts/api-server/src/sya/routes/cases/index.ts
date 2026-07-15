import { Router, type IRouter } from "express";
import { eq, ilike, or, sql, and, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { caseLawsTable } from "@workspace/db/sya";
import {
  ListCasesQueryParams,
  GetCaseParams,
} from "../../lib/schemas";
import { gateCondition } from "../../lib/gate-filter";

const router: IRouter = Router();

router.get("/cases", async (req, res): Promise<void> => {
  const params = ListCasesQueryParams.safeParse(req.query);

  const conditions: SQL[] = [];
  if (params.success && params.data.category) {
    conditions.push(eq(caseLawsTable.category, params.data.category));
  }
  if (params.success && params.data.year) {
    conditions.push(eq(caseLawsTable.year, params.data.year));
  }
  if (params.success && params.data.search) {
    const search = `%${params.data.search}%`;
    conditions.push(
      or(
        ilike(caseLawsTable.caseName, search),
        ilike(caseLawsTable.citation, search),
        ilike(caseLawsTable.factsEn, search),
        ilike(caseLawsTable.factsBm, search),
      )!,
    );
  }
  const gc = gateCondition(caseLawsTable.gates, req.query.gate);
  if (gc) conditions.push(gc);

  const result =
    conditions.length > 0
      ? await db.select().from(caseLawsTable).where(and(...conditions))
      : await db.select().from(caseLawsTable);

  res.json(result);
});

router.get("/cases/categories", async (req, res): Promise<void> => {
  const gc = gateCondition(caseLawsTable.gates, req.query.gate);
  const result = await db
    .select({
      category: caseLawsTable.category,
      categoryBm: caseLawsTable.categoryBm,
      count: sql<number>`count(*)::int`,
    })
    .from(caseLawsTable)
    .where(gc ?? undefined)
    .groupBy(caseLawsTable.category, caseLawsTable.categoryBm);

  res.json(result);
});

router.get("/cases/:id", async (req, res): Promise<void> => {
  const params = GetCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conds: SQL[] = [eq(caseLawsTable.id, params.data.id)];
  const gc = gateCondition(caseLawsTable.gates, req.query.gate);
  if (gc) conds.push(gc);

  const [caseLaw] = await db
    .select()
    .from(caseLawsTable)
    .where(and(...conds));

  if (!caseLaw) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  res.json(caseLaw);
});

export default router;
