import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { litBarCouncilRulings } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const { search, chapter } = req.query;

  let rows;
  if (search && typeof search === "string") {
    rows = await db
      .select()
      .from(litBarCouncilRulings)
      .where(
        sql`lower(${litBarCouncilRulings.title}) like lower(${"%" + search + "%"}) OR lower(${litBarCouncilRulings.ruling}) like lower(${"%" + search + "%"}) OR lower(${litBarCouncilRulings.chapter}) like lower(${"%" + search + "%"})`,
      );
  } else if (chapter && typeof chapter === "string") {
    rows = await db
      .select()
      .from(litBarCouncilRulings)
      .where(eq(litBarCouncilRulings.chapter, chapter));
  } else {
    rows = await db.select().from(litBarCouncilRulings);
  }

  rows.sort((a, b) => a.title.localeCompare(b.title));
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const id = Number((req.params.id as string));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid ruling id" });
    return;
  }
  const [row] = await db
    .select()
    .from(litBarCouncilRulings)
    .where(eq(litBarCouncilRulings.id, id));
  if (!row) {
    res.status(404).json({ error: "Ruling not found" });
    return;
  }
  res.json(row);
});

export default router;
