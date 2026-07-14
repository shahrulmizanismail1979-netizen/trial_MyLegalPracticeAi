import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { litPracticeDirections } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const { search, court } = req.query;

  let rows;
  if (search && typeof search === "string") {
    rows = await db
      .select()
      .from(litPracticeDirections)
      .where(
        sql`lower(${litPracticeDirections.title}) like lower(${"%" + search + "%"}) OR lower(${litPracticeDirections.summary}) like lower(${"%" + search + "%"}) OR lower(${litPracticeDirections.refNo}) like lower(${"%" + search + "%"})`,
      );
  } else if (court && typeof court === "string") {
    rows = await db
      .select()
      .from(litPracticeDirections)
      .where(eq(litPracticeDirections.court, court));
  } else {
    rows = await db.select().from(litPracticeDirections);
  }

  rows.sort((a, b) => a.court.localeCompare(b.court) || a.title.localeCompare(b.title));
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const id = Number((req.params.id as string));
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid practice direction id" });
    return;
  }
  const [row] = await db
    .select()
    .from(litPracticeDirections)
    .where(eq(litPracticeDirections.id, id));
  if (!row) {
    res.status(404).json({ error: "Practice direction not found" });
    return;
  }
  res.json(row);
});

export default router;
