import { Router, type IRouter } from "express";
import { sql, ilike, or, desc } from "drizzle-orm";
import { db, topicsTable, caseLawsTable, causePapersTable, workflowsTable, sampleDocumentsTable, glossaryTermsTable, costsFeesTable } from "@workspace/db";
import { CrimSearchContentQueryParams, CrimGetRecentActivityQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const [topicsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(topicsTable);
  const [caseLawsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(caseLawsTable);
  const [causePapersCount] = await db.select({ count: sql<number>`count(*)::int` }).from(causePapersTable);
  const [workflowsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(workflowsTable);
  const [sampleDocumentsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(sampleDocumentsTable);
  const [glossaryCount] = await db.select({ count: sql<number>`count(*)::int` }).from(glossaryTermsTable);
  const [costsFeesCount] = await db.select({ count: sql<number>`count(*)::int` }).from(costsFeesTable);

  res.json({
    topicsCount: topicsCount.count,
    caseLawsCount: caseLawsCount.count,
    causePapersCount: causePapersCount.count,
    workflowsCount: workflowsCount.count,
    sampleDocumentsCount: sampleDocumentsCount.count,
    glossaryCount: glossaryCount.count,
    costsFeesCount: costsFeesCount.count,
  });
});

router.get("/search", async (req, res): Promise<void> => {
  const params = CrimSearchContentQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { q, type } = params.data;
  const searchPattern = `%${q}%`;
  const results: Array<{ id: number; type: string; title: string; excerpt: string }> = [];

  if (!type || type === "topics") {
    const topics = await db.select().from(topicsTable).where(or(ilike(topicsTable.title, searchPattern), ilike(topicsTable.description, searchPattern)));
    results.push(...topics.map(t => ({ id: t.id, type: "topic" as const, title: t.title, excerpt: t.description.substring(0, 150) })));
  }

  if (!type || type === "case-laws") {
    const caseLaws = await db.select().from(caseLawsTable).where(or(ilike(caseLawsTable.caseName, searchPattern), ilike(caseLawsTable.summary, searchPattern)));
    results.push(...caseLaws.map(c => ({ id: c.id, type: "case-law" as const, title: c.caseName, excerpt: c.summary.substring(0, 150) })));
  }

  if (!type || type === "cause-papers") {
    const causePapers = await db.select().from(causePapersTable).where(or(ilike(causePapersTable.title, searchPattern), ilike(causePapersTable.description, searchPattern)));
    results.push(...causePapers.map(p => ({ id: p.id, type: "cause-paper" as const, title: p.title, excerpt: p.description.substring(0, 150) })));
  }

  if (!type || type === "workflows") {
    const workflows = await db.select().from(workflowsTable).where(or(ilike(workflowsTable.title, searchPattern), ilike(workflowsTable.description, searchPattern)));
    results.push(...workflows.map(w => ({ id: w.id, type: "workflow" as const, title: w.title, excerpt: w.description.substring(0, 150) })));
  }

  if (!type || type === "sample-documents") {
    const docs = await db.select().from(sampleDocumentsTable).where(or(ilike(sampleDocumentsTable.title, searchPattern), ilike(sampleDocumentsTable.description, searchPattern)));
    results.push(...docs.map(d => ({ id: d.id, type: "sample-document" as const, title: d.title, excerpt: d.description.substring(0, 150) })));
  }

  if (!type || type === "glossary") {
    const terms = await db.select().from(glossaryTermsTable).where(or(ilike(glossaryTermsTable.term, searchPattern), ilike(glossaryTermsTable.definition, searchPattern)));
    results.push(...terms.map(g => ({ id: g.id, type: "glossary" as const, title: g.term, excerpt: g.definition.substring(0, 150) })));
  }

  if (!type || type === "costs-fees") {
    const fees = await db.select().from(costsFeesTable).where(or(ilike(costsFeesTable.title, searchPattern), ilike(costsFeesTable.description, searchPattern)));
    results.push(...fees.map(f => ({ id: f.id, type: "cost-fee" as const, title: f.title, excerpt: f.description.substring(0, 150) })));
  }

  res.json({ results, total: results.length });
});

router.get("/recent-activity", async (req, res): Promise<void> => {
  const params = CrimGetRecentActivityQueryParams.safeParse(req.query);
  const limit = params.success && params.data.limit ? params.data.limit : 10;

  const topics = await db.select({ id: topicsTable.id, title: topicsTable.title, createdAt: topicsTable.createdAt }).from(topicsTable).orderBy(desc(topicsTable.createdAt)).limit(limit);
  const caseLaws = await db.select({ id: caseLawsTable.id, title: caseLawsTable.caseName, createdAt: caseLawsTable.createdAt }).from(caseLawsTable).orderBy(desc(caseLawsTable.createdAt)).limit(limit);
  const causePapers = await db.select({ id: causePapersTable.id, title: causePapersTable.title, createdAt: causePapersTable.createdAt }).from(causePapersTable).orderBy(desc(causePapersTable.createdAt)).limit(limit);

  const all = [
    ...topics.map(t => ({ ...t, type: "topic" as const })),
    ...caseLaws.map(c => ({ ...c, type: "case-law" as const })),
    ...causePapers.map(p => ({ ...p, type: "cause-paper" as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);

  res.json(all);
});

router.get("/categories", async (_req, res): Promise<void> => {
  const topics = await db.select({ category: topicsTable.category }).from(topicsTable);
  const caseLaws = await db.select({ category: caseLawsTable.category }).from(caseLawsTable);
  const causePapers = await db.select({ category: causePapersTable.category }).from(causePapersTable);
  const workflows = await db.select({ category: workflowsTable.category }).from(workflowsTable);
  const docs = await db.select({ category: sampleDocumentsTable.category }).from(sampleDocumentsTable);

  const allCategories = new Set([
    ...topics.map(t => t.category),
    ...caseLaws.map(c => c.category),
    ...causePapers.map(p => p.category),
    ...workflows.map(w => w.category),
    ...docs.map(d => d.category),
  ]);

  const result = Array.from(allCategories).map(name => ({
    name,
    topicsCount: topics.filter(t => t.category === name).length,
    caseLawsCount: caseLaws.filter(c => c.category === name).length,
    causePapersCount: causePapers.filter(p => p.category === name).length,
    workflowsCount: workflows.filter(w => w.category === name).length,
    sampleDocumentsCount: docs.filter(d => d.category === name).length,
  }));

  res.json(result);
});

export default router;
