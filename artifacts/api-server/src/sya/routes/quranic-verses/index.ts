import { Router, type IRouter } from "express";
import { eq, ilike, or, and, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { quranicVersesTable } from "@workspace/db/sya";
import { gateCondition } from "../../lib/gate-filter";

const router: IRouter = Router();

router.get("/quranic-verses", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;

  const conditions: SQL[] = [];

  if (search) {
    const s = `%${search}%`;
    conditions.push(
      or(
        ilike(quranicVersesTable.surahName, s),
        ilike(quranicVersesTable.translationEn, s),
        ilike(quranicVersesTable.translationBm, s),
        ilike(quranicVersesTable.relevanceEn, s),
        ilike(quranicVersesTable.relevanceBm, s),
      )!,
    );
  }

  if (category) {
    conditions.push(eq(quranicVersesTable.category, category));
  }

  const gc = gateCondition(quranicVersesTable.gates, req.query.gate);
  if (gc) conditions.push(gc);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select()
    .from(quranicVersesTable)
    .where(whereClause)
    .orderBy(quranicVersesTable.order);

  res.json(result);
});

router.get("/quranic-verses/categories", async (req, res): Promise<void> => {
  const gc = gateCondition(quranicVersesTable.gates, req.query.gate);
  const all = await db.select().from(quranicVersesTable).where(gc ?? undefined);
  const catMap = new Map<string, { category: string; categoryBm: string; count: number }>();
  for (const v of all) {
    const existing = catMap.get(v.category);
    if (existing) {
      existing.count++;
    } else {
      catMap.set(v.category, { category: v.category, categoryBm: v.categoryBm, count: 1 });
    }
  }
  res.json(Array.from(catMap.values()));
});

router.get("/quranic-verses/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [verse] = await db
    .select()
    .from(quranicVersesTable)
    .where(eq(quranicVersesTable.id, id));

  if (!verse) {
    res.status(404).json({ error: "Verse not found" });
    return;
  }

  res.json(verse);
});

export default router;
