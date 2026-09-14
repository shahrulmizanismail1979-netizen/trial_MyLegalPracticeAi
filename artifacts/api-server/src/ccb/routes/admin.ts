import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db, ccbAccessCodes } from "@workspace/db";
import { logger } from "../../lib/logger";
import { isAdminCredential } from "../../lib/masterAccess";

const router: IRouter = Router();

const SECRET = process.env.SESSION_SECRET || "myccblitai-secret-key-2024";

function requireAdmin(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const payload = jwt.verify(token, SECRET) as { role?: string };
    if (payload.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

router.post("/admin/login", async (req, res): Promise<void> => {
  const body = z.object({ password: z.string() }).safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "password required" });
    return;
  }
  if (!isAdminCredential(body.data.password)) {
    logger.warn({ req }, "CCB admin login failed");
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  const token = jwt.sign({ role: "admin" }, SECRET, { expiresIn: "8h" });
  res.json({ token });
});

router.get("/admin/codes", requireAdmin, async (_req, res): Promise<void> => {
  const codes = await db.select().from(ccbAccessCodes).orderBy(desc(ccbAccessCodes.createdAt));
  res.json({ codes });
});

router.post("/admin/codes", requireAdmin, async (req, res): Promise<void> => {
  const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
  let code = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateCode();
    const existing = await db.select().from(ccbAccessCodes).where(eq(ccbAccessCodes.code, code));
    if (existing.length === 0) break;
  }
  const [inserted] = await db
    .insert(ccbAccessCodes)
    .values({ code, label: label || null, active: true })
    .returning();
  res.json({ code: inserted });
});

router.patch("/admin/codes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const active = Boolean(req.body?.active);
  const [updated] = await db
    .update(ccbAccessCodes)
    .set({ active })
    .where(eq(ccbAccessCodes.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ code: updated });
});

router.delete("/admin/codes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(ccbAccessCodes).where(eq(ccbAccessCodes.id, id));
  res.json({ success: true });
});

export default router;
