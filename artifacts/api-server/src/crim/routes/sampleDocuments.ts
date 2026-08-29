import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, sampleDocumentsTable } from "@workspace/db";
import { CrimListSampleDocumentsQueryParams, CrimGetSampleDocumentParams, CrimListSampleDocumentsResponse, CrimGetSampleDocumentResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sample-documents", async (req, res): Promise<void> => {
  const params = CrimListSampleDocumentsQueryParams.safeParse(req.query);

  const conditions = [];
  if (params.success) {
    if (params.data.category) conditions.push(eq(sampleDocumentsTable.category, params.data.category));
    if (params.data.language) conditions.push(eq(sampleDocumentsTable.language, params.data.language));
  }
  const docs = conditions.length
    ? await db.select().from(sampleDocumentsTable).where(and(...conditions)).orderBy(sampleDocumentsTable.title)
    : await db.select().from(sampleDocumentsTable).orderBy(sampleDocumentsTable.title);

  res.json(CrimListSampleDocumentsResponse.parse(docs.map(({ stableKey: _, ...doc }) => ({
    ...doc,
    pairedVersionId: doc.sourceId,
  }))));
});

router.get("/sample-documents/:id", async (req, res): Promise<void> => {
  const params = CrimGetSampleDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db.select().from(sampleDocumentsTable).where(eq(sampleDocumentsTable.id, params.data.id));

  if (!doc) {
    res.status(404).json({ error: "Sample document not found" });
    return;
  }

  const pairedRows = doc.language === "en"
    ? doc.sourceId
      ? await db.select({ id: sampleDocumentsTable.id }).from(sampleDocumentsTable).where(eq(sampleDocumentsTable.id, doc.sourceId))
      : []
    : await db.select({ id: sampleDocumentsTable.id }).from(sampleDocumentsTable).where(and(
      eq(sampleDocumentsTable.sourceId, doc.id),
      eq(sampleDocumentsTable.language, "en"),
    ));
  const [paired] = pairedRows;
  const { stableKey: _, ...publicDoc } = doc;
  res.json(CrimGetSampleDocumentResponse.parse({ ...publicDoc, pairedVersionId: paired?.id ?? null }));
});

export default router;
