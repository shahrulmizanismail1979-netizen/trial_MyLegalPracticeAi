import { Router, type IRouter } from "express";
import { eq, ilike } from "drizzle-orm";
import { db, glossaryTermsTable } from "@workspace/db";
import { CrimListGlossaryTermsQueryParams, CrimGetGlossaryTermParams, CrimListGlossaryTermsResponse, CrimGetGlossaryTermResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/glossary", async (req, res): Promise<void> => {
  const params = CrimListGlossaryTermsQueryParams.safeParse(req.query);

  const terms = params.success && params.data.letter
    ? await db.select().from(glossaryTermsTable).where(ilike(glossaryTermsTable.term, `${params.data.letter}%`)).orderBy(glossaryTermsTable.term)
    : await db.select().from(glossaryTermsTable).orderBy(glossaryTermsTable.term);

  res.json(CrimListGlossaryTermsResponse.parse(terms));
});

router.get("/glossary/:id", async (req, res): Promise<void> => {
  const params = CrimGetGlossaryTermParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [term] = await db.select().from(glossaryTermsTable).where(eq(glossaryTermsTable.id, params.data.id));

  if (!term) {
    res.status(404).json({ error: "Glossary term not found" });
    return;
  }

  res.json(CrimGetGlossaryTermResponse.parse(term));
});

export default router;
