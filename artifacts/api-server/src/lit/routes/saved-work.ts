import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { litSavedWork, litMatters, litClients } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireSubscription } from "./billing";

const router: IRouter = Router();

function getAccessCodeId(req: Request): number | undefined {
  const sess = req.session as unknown as Record<string, unknown> | undefined;
  if (!sess || sess.authenticated !== true) return undefined;
  return sess.accessCodeId as number | undefined;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const accessCodeId = getAccessCodeId(req);
  if (!accessCodeId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  (req as unknown as Request & { accessCodeId: number }).accessCodeId = accessCodeId;
  next();
}

router.use(requireAuth);

// Guard against oversized writes degrading the service (a generous cap that
// still comfortably fits a long brief or judgment).
const MAX_CONTENT = 500_000;
const MAX_INPUT_JSON = 200_000;

// List the current user's saved work, newest first. Optional ?kind= filter.
router.get("/", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const { kind } = req.query;
  const where =
    kind && typeof kind === "string"
      ? and(eq(litSavedWork.accessCodeId, accessCodeId), eq(litSavedWork.kind, kind))
      : eq(litSavedWork.accessCodeId, accessCodeId);

  const rows = await db
    .select()
    .from(litSavedWork)
    .where(where)
    .orderBy(desc(litSavedWork.updatedAt));
  res.json(rows);
});

router.get("/:id", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const id = parseInt((req.params.id as string), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .select()
    .from(litSavedWork)
    .where(and(eq(litSavedWork.id, id), eq(litSavedWork.accessCodeId, accessCodeId)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

// Saving a NEW draft is a premium action; reading, editing, exporting and
// deleting one's own existing work stay open to all logged-in users.
router.post("/", requireSubscription, async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const { kind, title, matter, inputJson, content, matterId, clientId } = req.body ?? {};
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
      .select({ id: litMatters.id })
      .from(litMatters)
      .where(
        and(eq(litMatters.id, matterId), eq(litMatters.accessCodeId, accessCodeId)),
      )
      .limit(1);
    if (!owned) {
      res.status(404).json({ error: "matter not found" });
      return;
    }
    linkedMatterId = owned.id;
  }
  // If filing under a vault client, verify the caller owns it too.
  let linkedClientId: number | null = null;
  if (typeof clientId === "number") {
    const [ownedClient] = await db
      .select({ id: litClients.id })
      .from(litClients)
      .where(
        and(eq(litClients.id, clientId), eq(litClients.accessCodeId, accessCodeId)),
      )
      .limit(1);
    if (!ownedClient) {
      res.status(404).json({ error: "client not found" });
      return;
    }
    linkedClientId = ownedClient.id;
  }
  const [row] = await db
    .insert(litSavedWork)
    .values({
      accessCodeId,
      matterId: linkedMatterId,
      clientId: linkedClientId,
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
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const id = parseInt((req.params.id as string), 10);
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
    .update(litSavedWork)
    .set(updates)
    .where(and(eq(litSavedWork.id, id), eq(litSavedWork.accessCodeId, accessCodeId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(row);
});

router.delete("/:id", async (req, res) => {
  const accessCodeId = (req as unknown as Request & { accessCodeId: number }).accessCodeId;
  const id = parseInt((req.params.id as string), 10);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [row] = await db
    .delete(litSavedWork)
    .where(and(eq(litSavedWork.id, id), eq(litSavedWork.accessCodeId, accessCodeId)))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
