import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, workflowsTable } from "@workspace/db";
import { CrimListWorkflowsQueryParams, CrimGetWorkflowParams, CrimListWorkflowsResponse, CrimGetWorkflowResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/workflows", async (req, res): Promise<void> => {
  const params = CrimListWorkflowsQueryParams.safeParse(req.query);

  const workflows = params.success && params.data.category
    ? await db.select().from(workflowsTable).where(eq(workflowsTable.category, params.data.category)).orderBy(workflowsTable.title)
    : await db.select().from(workflowsTable).orderBy(workflowsTable.title);

  res.json(CrimListWorkflowsResponse.parse(workflows));
});

router.get("/workflows/:id", async (req, res): Promise<void> => {
  const params = CrimGetWorkflowParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [workflow] = await db.select().from(workflowsTable).where(eq(workflowsTable.id, params.data.id));

  if (!workflow) {
    res.status(404).json({ error: "Workflow not found" });
    return;
  }

  res.json(CrimGetWorkflowResponse.parse(workflow));
});

export default router;
