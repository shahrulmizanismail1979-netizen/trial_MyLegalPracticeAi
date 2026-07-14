import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { litWorkflows } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  const { category } = req.query;
  let workflows;
  if (category && typeof category === "string") {
    workflows = await db.select().from(litWorkflows).where(
      sql`lower(${litWorkflows.category}) = lower(${category})`
    );
  } else {
    workflows = await db.select().from(litWorkflows);
  }
  res.json(workflows);
});

router.get("/:id", async (req, res) => {
  const id = parseInt((req.params.id as string));
  const [workflow] = await db.select().from(litWorkflows).where(eq(litWorkflows.id, id));
  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }
  res.json(workflow);
});

export default router;
