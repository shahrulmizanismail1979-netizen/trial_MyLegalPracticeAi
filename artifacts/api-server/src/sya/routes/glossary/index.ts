import { Router, type IRouter } from "express";
import { eq, ilike, or, and } from "drizzle-orm";
import { db } from "@workspace/db";
import { glossaryTable } from "@workspace/db/sya";
import {
  ListGlossaryTermsQueryParams,
  GetGlossaryTermParams,
} from "../../lib/schemas";

const router: IRouter = Router();

router.get("/glossary", async (req, res): Promise<void> => {
  const params = ListGlossaryTermsQueryParams.safeParse(req.query);

  const conditions = [];
  if (params.success && params.data.category) {
    conditions.push(eq(glossaryTable.category, params.data.category));
  }
  if (params.success && params.data.letter) {
    conditions.push(ilike(glossaryTable.termEn, `${params.data.letter}%`));
  }
  if (params.success && params.data.search) {
    const search = `%${params.data.search}%`;
    conditions.push(
      or(
        ilike(glossaryTable.termEn, search),
        ilike(glossaryTable.termBm, search),
        ilike(glossaryTable.termArabic, search),
        ilike(glossaryTable.definitionEn, search),
      )!,
    );
  }

  const result =
    conditions.length > 0
      ? await db.select().from(glossaryTable).where(and(...conditions)).orderBy(glossaryTable.termEn)
      : await db.select().from(glossaryTable).orderBy(glossaryTable.termEn);

  res.json(result);
});

router.get("/glossary/:id", async (req, res): Promise<void> => {
  const params = GetGlossaryTermParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [term] = await db
    .select()
    .from(glossaryTable)
    .where(eq(glossaryTable.id, params.data.id));

  if (!term) {
    res.status(404).json({ error: "Glossary term not found" });
    return;
  }

  res.json(term);
});

export default router;
