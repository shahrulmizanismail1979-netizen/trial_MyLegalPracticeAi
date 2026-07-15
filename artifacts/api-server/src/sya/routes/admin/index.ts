import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { accessCodesTable } from "@workspace/db/sya";
import crypto from "crypto";

const router: IRouter = Router();

function requireAdmin(req: any, res: any, next: any) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  if (req.session.userRole !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

function generateCode(prefix: string, length: number = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = prefix;
  for (let i = 0; i < length; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

router.get("/admin/access-codes", requireAdmin, async (_req, res): Promise<void> => {
  const codes = await db
    .select()
    .from(accessCodesTable)
    .orderBy(desc(accessCodesTable.createdAt));

  res.json(codes);
});

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accessCodesTable);

  const [activeResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accessCodesTable)
    .where(eq(accessCodesTable.isActive, true));

  const [usedResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(accessCodesTable)
    .where(sql`${accessCodesTable.lastUsedAt} IS NOT NULL`);

  const roleCounts = await db
    .select({
      role: accessCodesTable.role,
      count: sql<number>`count(*)::int`,
    })
    .from(accessCodesTable)
    .where(eq(accessCodesTable.isActive, true))
    .groupBy(accessCodesTable.role);

  res.json({
    total: totalResult.count,
    active: activeResult.count,
    used: usedResult.count,
    inactive: totalResult.count - activeResult.count,
    byRole: roleCounts,
  });
});

router.post("/admin/access-codes", requireAdmin, async (req, res): Promise<void> => {
  const { name, role, customCode } = req.body;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "Name is required (minimum 2 characters)" });
    return;
  }

  const validRoles = ["practitioner", "admin", "judge"];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ error: "Role must be one of: practitioner, admin, judge" });
    return;
  }

  let code: string;
  if (customCode && typeof customCode === "string" && customCode.trim().length >= 6) {
    code = customCode.trim().toUpperCase();
  } else {
    const prefixMap: Record<string, string> = {
      practitioner: "SYR-",
      admin: "ADM-",
      judge: "HKM-",
    };
    code = generateCode(prefixMap[role] || "SYR-");
  }

  const existing = await db
    .select({ id: accessCodesTable.id })
    .from(accessCodesTable)
    .where(eq(accessCodesTable.code, code))
    .limit(1);

  if (existing.length > 0) {
    res.status(409).json({ error: "Access code already exists. Try again or use a different custom code." });
    return;
  }

  const [newCode] = await db
    .insert(accessCodesTable)
    .values({
      code,
      name: name.trim(),
      role,
    })
    .returning();

  res.status(201).json(newCode);
});

router.patch("/admin/access-codes/:id/toggle", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [existing] = await db
    .select()
    .from(accessCodesTable)
    .where(eq(accessCodesTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Access code not found" });
    return;
  }

  const [updated] = await db
    .update(accessCodesTable)
    .set({ isActive: !existing.isActive })
    .where(eq(accessCodesTable.id, id))
    .returning();

  res.json(updated);
});

router.delete("/admin/access-codes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  await db
    .delete(accessCodesTable)
    .where(eq(accessCodesTable.id, id));

  res.sendStatus(204);
});

export default router;
