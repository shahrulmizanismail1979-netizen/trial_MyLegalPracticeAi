import { Router, type IRouter } from "express";
import { eq, ilike, or, and, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { fatwaTable } from "@workspace/db/sya";
import { gateCondition } from "../../lib/gate-filter";

const router: IRouter = Router();

router.get("/fatwas", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;

  const conditions: SQL[] = [];

  if (search) {
    const s = `%${search}%`;
    conditions.push(
      or(
        ilike(fatwaTable.titleEn, s),
        ilike(fatwaTable.titleBm, s),
        ilike(fatwaTable.summaryEn, s),
        ilike(fatwaTable.summaryBm, s),
      )!,
    );
  }

  if (category) {
    conditions.push(eq(fatwaTable.category, category));
  }

  const gc = gateCondition(fatwaTable.gates, req.query.gate);
  if (gc) conditions.push(gc);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select()
    .from(fatwaTable)
    .where(whereClause)
    .orderBy(fatwaTable.order);

  res.json(result);
});

router.get("/fatwas/categories", async (req, res): Promise<void> => {
  const gc = gateCondition(fatwaTable.gates, req.query.gate);
  const all = await db.select().from(fatwaTable).where(gc ?? undefined);
  const catMap = new Map<string, { category: string; categoryBm: string; count: number }>();
  for (const f of all) {
    const existing = catMap.get(f.category);
    if (existing) {
      existing.count++;
    } else {
      catMap.set(f.category, { category: f.category, categoryBm: f.categoryBm, count: 1 });
    }
  }
  res.json(Array.from(catMap.values()));
});

router.get("/fatwas/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const conds: SQL[] = [eq(fatwaTable.id, id)];
  const gc = gateCondition(fatwaTable.gates, req.query.gate);
  if (gc) conds.push(gc);

  const [fatwa] = await db
    .select()
    .from(fatwaTable)
    .where(and(...conds));

  if (!fatwa) {
    res.status(404).json({ error: "Fatwa not found" });
    return;
  }

  res.json(fatwa);
});

export default router;
