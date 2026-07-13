import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, sampleDocumentsTable } from "@workspace/db";
import { CrimListSampleDocumentsQueryParams, CrimGetSampleDocumentParams, CrimListSampleDocumentsResponse, CrimGetSampleDocumentResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/sample-documents", async (req, res): Promise<void> => {
  const params = CrimListSampleDocumentsQueryParams.safeParse(req.query);

  const docs = params.success && params.data.category
    ? await db.select().from(sampleDocumentsTable).where(eq(sampleDocumentsTable.category, params.data.category)).orderBy(sampleDocumentsTable.title)
    : await db.select().from(sampleDocumentsTable).orderBy(sampleDocumentsTable.title);

  res.json(CrimListSampleDocumentsResponse.parse(docs));
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

  res.json(CrimGetSampleDocumentResponse.parse(doc));
});

export default router;
