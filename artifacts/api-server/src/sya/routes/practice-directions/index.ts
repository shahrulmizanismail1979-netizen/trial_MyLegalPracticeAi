import { Router, type IRouter } from "express";
import { eq, ilike, or, and, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { practiceDirectionsTable } from "@workspace/db/sya";
import { gateCondition } from "../../lib/gate-filter";

const router: IRouter = Router();

router.get("/practice-directions", async (req, res): Promise<void> => {
  const search = typeof req.query.search === "string" ? req.query.search : undefined;
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const state = typeof req.query.state === "string" ? req.query.state : undefined;
  const docType = typeof req.query.docType === "string" ? req.query.docType : undefined;

  const conditions: SQL[] = [];

  if (search) {
    const s = `%${search}%`;
    conditions.push(
      or(
        ilike(practiceDirectionsTable.titleEn, s),
        ilike(practiceDirectionsTable.titleBm, s),
        ilike(practiceDirectionsTable.summaryEn, s),
        ilike(practiceDirectionsTable.summaryBm, s),
      )!,
    );
  }

  if (category) {
    conditions.push(eq(practiceDirectionsTable.category, category));
  }

  if (state) {
    conditions.push(eq(practiceDirectionsTable.state, state));
  }

  if (docType) {
    conditions.push(eq(practiceDirectionsTable.docType, docType));
  }

  const gc = gateCondition(practiceDirectionsTable.gates, req.query.gate);
  if (gc) conditions.push(gc);

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const result = await db
    .select()
    .from(practiceDirectionsTable)
    .where(whereClause)
    .orderBy(practiceDirectionsTable.order);

  res.json(result);
});

router.get("/practice-directions/categories", async (req, res): Promise<void> => {
  const gc = gateCondition(practiceDirectionsTable.gates, req.query.gate);
  const all = await db.select().from(practiceDirectionsTable).where(gc ?? undefined);
  const catMap = new Map<string, { category: string; categoryBm: string; count: number }>();
  for (const d of all) {
    const existing = catMap.get(d.category);
    if (existing) {
      existing.count++;
    } else {
      catMap.set(d.category, { category: d.category, categoryBm: d.categoryBm, count: 1 });
    }
  }
  res.json(Array.from(catMap.values()));
});

router.get("/practice-directions/states", async (req, res): Promise<void> => {
  const gc = gateCondition(practiceDirectionsTable.gates, req.query.gate);
  const all = await db.select().from(practiceDirectionsTable).where(gc ?? undefined);
  const states = Array.from(
    new Set(all.map((d) => d.state).filter((s): s is string => Boolean(s))),
  ).sort();
  res.json(states);
});

router.get("/practice-directions/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const conds: SQL[] = [eq(practiceDirectionsTable.id, id)];
  const gc = gateCondition(practiceDirectionsTable.gates, req.query.gate);
  if (gc) conds.push(gc);

  const [direction] = await db
    .select()
    .from(practiceDirectionsTable)
    .where(and(...conds));

  if (!direction) {
    res.status(404).json({ error: "Practice direction not found" });
    return;
  }

  res.json(direction);
});

export default router;
