import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { litLegalCases } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const { tag, search } = req.query;
  let cases;

  if (search && typeof search === "string") {
    cases = await db.select().from(litLegalCases).where(
      sql`lower(${litLegalCases.caseName}) like lower(${"%" + search + "%"}) OR lower(${litLegalCases.facts}) like lower(${"%" + search + "%"})`
    );
  } else if (tag && typeof tag === "string") {
    cases = await db.select().from(litLegalCases).where(
      sql`${litLegalCases.tags}::jsonb @> ${JSON.stringify([tag])}::jsonb`
    );
  } else {
    cases = await db.select().from(litLegalCases);
  }

  res.json(cases);
});

router.get("/:id", async (req, res) => {
  const id = parseInt((req.params.id as string));
  const [legalCase] = await db.select().from(litLegalCases).where(eq(litLegalCases.id, id));
  if (!legalCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  res.json(legalCase);
});

export default router;
