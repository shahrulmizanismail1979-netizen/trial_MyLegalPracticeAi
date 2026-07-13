import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, causePapersTable } from "@workspace/db";
import { CrimListCausePapersQueryParams, CrimGetCausePaperParams, CrimListCausePapersResponse, CrimGetCausePaperResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/cause-papers", async (req, res): Promise<void> => {
  const params = CrimListCausePapersQueryParams.safeParse(req.query);
  const conditions = [];

  if (params.success) {
    if (params.data.category) conditions.push(eq(causePapersTable.category, params.data.category));
    if (params.data.court) conditions.push(eq(causePapersTable.court, params.data.court));
  }

  const causePapers = conditions.length > 0
    ? await db.select().from(causePapersTable).where(and(...conditions)).orderBy(causePapersTable.title)
    : await db.select().from(causePapersTable).orderBy(causePapersTable.title);

  res.json(CrimListCausePapersResponse.parse(causePapers));
});

router.get("/cause-papers/:id", async (req, res): Promise<void> => {
  const params = CrimGetCausePaperParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [causePaper] = await db.select().from(causePapersTable).where(eq(causePapersTable.id, params.data.id));

  if (!causePaper) {
    res.status(404).json({ error: "Cause paper not found" });
    return;
  }

  res.json(CrimGetCausePaperResponse.parse(causePaper));
});

export default router;
