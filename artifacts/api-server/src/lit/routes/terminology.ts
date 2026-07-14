import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { litGlossaryTerms } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const { search, letter } = req.query;

  let terms;
  if (search && typeof search === "string") {
    terms = await db.select().from(litGlossaryTerms).where(
      sql`lower(${litGlossaryTerms.term}) like lower(${"%" + search + "%"}) OR lower(${litGlossaryTerms.definition}) like lower(${"%" + search + "%"})`
    );
  } else if (letter && typeof letter === "string") {
    terms = await db.select().from(litGlossaryTerms).where(
      sql`lower(left(${litGlossaryTerms.term}, 1)) = lower(${letter})`
    );
  } else {
    terms = await db.select().from(litGlossaryTerms);
  }

  // Sort alphabetically
  terms.sort((a, b) => a.term.localeCompare(b.term));
  res.json(terms);
});

router.get("/:id", async (req, res) => {
  const id = parseInt((req.params.id as string));
  const [term] = await db.select().from(litGlossaryTerms).where(eq(litGlossaryTerms.id, id));
  if (!term) {
    res.status(404).json({ error: "Term not found" });
    return;
  }
  res.json(term);
});

export default router;
