import { Router, type IRouter } from "express";
import { db, crimSavedWork, crimMatters } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireMatterTenant, tenantOf } from "./matterAuth";

const router: IRouter = Router();

router.use(requireMatterTenant);

// Guard against oversized writes degrading the service.
const MAX_CONTENT = 500_000;
const MAX_INPUT_JSON = 200_000;

router.get("/", async (req, res) => {
  const accessCodeId = tenantOf(req);
  const { kind } = req.query;
  const where =
    kind && typeof kind === "string"
      ? and(eq(crimSavedWork.accessCodeId, accessCodeId), eq(crimSavedWork.kind, kind))
      : eq(crimSavedWork.accessCodeId, accessCodeId);
  const rows = await db
    .select()
    .from(crimSavedWork)
    .where(where)
    .orderBy(desc(crimSavedWork.updatedAt));
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const accessCodeId = tenantOf(req);
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(crimSavedWork)
    .where(and(eq(crimSavedWork.id, id), eq(crimSavedWork.accessCodeId, accessCodeId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.post("/", async (req, res) => {
  const accessCodeId = tenantOf(req);
  const { kind, title, matter, inputJson, content, matterId } = req.body ?? {};
  if (!kind || typeof kind !== "string") {
    res.status(400).json({ error: "kind is required" });
    return;
  }
  if (!title || typeof title !== "string") {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (typeof content === "string" && content.length > MAX_CONTENT) {
    res.status(413).json({ error: "content too large" });
    return;
  }
  if (inputJson != null && JSON.stringify(inputJson).length > MAX_INPUT_JSON) {
    res.status(413).json({ error: "inputJson too large" });
    return;
  }
  // If linking to a matter, verify the caller owns it (no cross-tenant attach).
  let linkedMatterId: number | null = null;
  if (typeof matterId === "number") {
    const [owned] = await db
      .select({ id: crimMatters.id })
      .from(crimMatters)
      .where(and(eq(crimMatters.id, matterId), eq(crimMatters.accessCodeId, accessCodeId)))
      .limit(1);
    if (!owned) {
      res.status(404).json({ error: "matter not found" });
      return;
    }
    linkedMatterId = owned.id;
  }
  const [row] = await db
    .insert(crimSavedWork)
    .values({
      accessCodeId,
      matterId: linkedMatterId,
      kind,
      title: title.slice(0, 300),
      matter: typeof matter === "string" && matter.trim() ? matter.slice(0, 300) : null,
      inputJson: inputJson ?? null,
      content: typeof content === "string" ? content : "",
    })
    .returning();
  res.status(201).json(row);
});

router.patch("/:id", async (req, res) => {
  const accessCodeId = tenantOf(req);
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { title, matter, content, inputJson } = req.body ?? {};
  if (typeof content === "string" && content.length > MAX_CONTENT) {
    res.status(413).json({ error: "content too large" });
    return;
  }
  if (inputJson !== undefined && inputJson != null && JSON.stringify(inputJson).length > MAX_INPUT_JSON) {
    res.status(413).json({ error: "inputJson too large" });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof title === "string") updates.title = title.slice(0, 300);
  if (typeof matter === "string") updates.matter = matter.trim() ? matter.slice(0, 300) : null;
  if (typeof content === "string") updates.content = content;
  if (inputJson !== undefined) updates.inputJson = inputJson;

  const [row] = await db
    .update(crimSavedWork)
    .set(updates)
    .where(and(eq(crimSavedWork.id, id), eq(crimSavedWork.accessCodeId, accessCodeId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const accessCodeId = tenantOf(req);
  const id = parseInt(req.params.id as string, 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .delete(crimSavedWork)
    .where(and(eq(crimSavedWork.id, id), eq(crimSavedWork.accessCodeId, accessCodeId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
