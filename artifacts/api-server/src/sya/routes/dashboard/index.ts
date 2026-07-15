import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { provisionsTable, caseLawsTable, causePapersTable, proceduralWorkflowsTable, glossaryTable, legislationTable } from "@workspace/db/sya";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const [provisions] = await db.select({ count: sql<number>`count(*)::int` }).from(provisionsTable);
  const [cases] = await db.select({ count: sql<number>`count(*)::int` }).from(caseLawsTable);
  const [papers] = await db.select({ count: sql<number>`count(*)::int` }).from(causePapersTable);
  const [workflows] = await db.select({ count: sql<number>`count(*)::int` }).from(proceduralWorkflowsTable);
  const [glossary] = await db.select({ count: sql<number>`count(*)::int` }).from(glossaryTable);
  const [legislation] = await db.select({ count: sql<number>`count(*)::int` }).from(legislationTable);

  res.json({
    totalProvisions: provisions.count,
    totalCases: cases.count,
    totalCausePapers: papers.count,
    totalWorkflows: workflows.count,
    totalGlossaryTerms: glossary.count,
    totalLegislation: legislation.count,
  });
});

router.get("/dashboard/case-distribution", async (_req, res): Promise<void> => {
  const result = await db
    .select({
      category: caseLawsTable.category,
      categoryBm: caseLawsTable.categoryBm,
      count: sql<number>`count(*)::int`,
    })
    .from(caseLawsTable)
    .groupBy(caseLawsTable.category, caseLawsTable.categoryBm)
    .orderBy(sql`count(*) DESC`);

  res.json(result);
});

export default router;
