import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, caseLawsTable } from "@workspace/db";
import { CrimListCaseLawsQueryParams, CrimGetCaseLawParams, CrimListCaseLawsResponse, CrimGetCaseLawResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/case-laws", async (req, res): Promise<void> => {
  const params = CrimListCaseLawsQueryParams.safeParse(req.query);
  const conditions = [];

  if (params.success) {
    if (params.data.category) conditions.push(eq(caseLawsTable.category, params.data.category));
    if (params.data.court) conditions.push(eq(caseLawsTable.court, params.data.court));
  }

  const caseLaws = conditions.length > 0
    ? await db.select().from(caseLawsTable).where(and(...conditions)).orderBy(caseLawsTable.caseName)
    : await db.select().from(caseLawsTable).orderBy(caseLawsTable.caseName);

  res.json(CrimListCaseLawsResponse.parse(caseLaws));
});

router.get("/case-laws/:id", async (req, res): Promise<void> => {
  const params = CrimGetCaseLawParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [caseLaw] = await db.select().from(caseLawsTable).where(eq(caseLawsTable.id, params.data.id));

  if (!caseLaw) {
    res.status(404).json({ error: "Case law not found" });
    return;
  }

  res.json(CrimGetCaseLawResponse.parse(caseLaw));
});

export default router;
