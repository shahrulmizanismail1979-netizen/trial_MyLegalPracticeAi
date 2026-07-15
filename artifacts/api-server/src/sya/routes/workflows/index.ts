import { Router, type IRouter } from "express";
import { eq, ilike, or, sql, and, type SQL } from "drizzle-orm";
import { db } from "@workspace/db";
import { proceduralWorkflowsTable } from "@workspace/db/sya";
import {
  ListWorkflowsQueryParams,
  GetWorkflowParams,
} from "../../lib/schemas";
import { gateCondition } from "../../lib/gate-filter";

const router: IRouter = Router();

router.get("/workflows", async (req, res): Promise<void> => {
  const params = ListWorkflowsQueryParams.safeParse(req.query);

  const conditions: SQL[] = [];
  const gc = gateCondition(proceduralWorkflowsTable.gates, req.query.gate);
  if (gc) conditions.push(gc);
  if (params.success && params.data.category) {
    conditions.push(eq(proceduralWorkflowsTable.category, params.data.category));
  }
  if (params.success && params.data.search) {
    const search = `%${params.data.search}%`;
    conditions.push(
      or(
        ilike(proceduralWorkflowsTable.titleEn, search),
        ilike(proceduralWorkflowsTable.titleBm, search),
      )!,
    );
  }

  const result =
    conditions.length > 0
      ? await db.select().from(proceduralWorkflowsTable).where(and(...conditions)).orderBy(proceduralWorkflowsTable.order)
      : await db.select().from(proceduralWorkflowsTable).orderBy(proceduralWorkflowsTable.order);

  res.json(result);
});

router.get("/workflows/:id", async (req, res): Promise<void> => {
  const params = GetWorkflowParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const conds: SQL[] = [eq(proceduralWorkflowsTable.id, params.data.id)];
  const gc = gateCondition(proceduralWorkflowsTable.gates, req.query.gate);
  if (gc) conds.push(gc);

  const [workflow] = await db
    .select()
    .from(proceduralWorkflowsTable)
    .where(and(...conds));

  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }

  res.json(workflow);
});

export default router;
