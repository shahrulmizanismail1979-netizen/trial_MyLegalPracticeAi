import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
import { db, corpAccessCodes, corpSessions } from "@workspace/db";
import { eq, desc, and, ne } from "drizzle-orm";
import { ACCESS_TIERS, type AccessTier } from "@workspace/tiers";
import { MASTER_CODE } from "../../lib/access";
import { isAdminCredential } from "../../../lib/masterAccess";

const router: IRouter = Router();

const activeAdminTokens = new Set<string>();

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += "-";
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token || !activeAdminTokens.has(token)) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}

router.post("/admin/login", async (req, res): Promise<void> => {
  const { password } = req.body;
  if (!isAdminCredential(password)) {
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  activeAdminTokens.add(token);
  res.json({ success: true, adminToken: token });
});

router.post("/admin/logout", requireAdmin, async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) activeAdminTokens.delete(token);
  res.json({ success: true });
});

router.get("/admin/codes", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const codes = await db
      .select()
      .from(corpAccessCodes)
      .where(ne(corpAccessCodes.code, MASTER_CODE))
      .orderBy(desc(corpAccessCodes.createdAt));

    const activeSessions = await db
      .select()
      .from(corpSessions)
      .where(eq(corpSessions.isActive, true));

    const codesWithSessions = codes.map((code) => {
      const session = activeSessions.find((s) => s.accessCodeId === code.id);
      return {
        ...code,
        activeSession: session
          ? {
              deviceInfo: session.deviceInfo,
              loggedInAt: session.loggedInAt,
              lastSeenAt: session.lastSeenAt,
            }
          : null,
      };
    });

    res.json({ codes: codesWithSessions });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch codes" });
  }
});

router.post("/admin/codes", requireAdmin, async (req, res): Promise<void> => {
  const { label, tier } = req.body;
  const requestedTier: AccessTier =
    typeof tier === "string" && (ACCESS_TIERS as readonly string[]).includes(tier)
      ? (tier as AccessTier)
      : "legacy_full";
  try {
    const code = generateCode();
    const [created] = await db
      .insert(corpAccessCodes)
      .values({ code, label: label || null, tier: requestedTier })
      .returning();
    res.json({ success: true, code: created });
  } catch (err) {
    res.status(500).json({ error: "Failed to create code" });
  }
});

router.patch("/admin/codes/:id/toggle", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  try {
    const [existing] = await db
      .select()
      .from(corpAccessCodes)
      .where(eq(corpAccessCodes.id, id));
    if (!existing) {
      res.status(404).json({ error: "Code not found" });
      return;
    }
    const [updated] = await db
      .update(corpAccessCodes)
      .set({ isActive: !existing.isActive })
      .where(eq(corpAccessCodes.id, id))
      .returning();

    if (!updated.isActive) {
      await db
        .update(corpSessions)
        .set({ isActive: false })
        .where(eq(corpSessions.accessCodeId, id));
    }

    res.json({ success: true, code: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle code" });
  }
});

router.delete("/admin/codes/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  try {
    await db.delete(corpAccessCodes).where(eq(corpAccessCodes.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete code" });
  }
});

router.post("/admin/codes/:id/kick", requireAdmin, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  try {
    await db
      .update(corpSessions)
      .set({ isActive: false })
      .where(and(eq(corpSessions.accessCodeId, id), eq(corpSessions.isActive, true)));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to kick session" });
  }
});

export default router;
