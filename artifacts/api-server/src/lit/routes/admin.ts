import { logger } from "../../lib/logger";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { litAccessCodes } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { sendAccessCodeEmail } from "../lib/email";
import { generateUniqueAccessCode } from "../lib/accessCodeGen";
import {
  getDefaultProvider,
  setDefaultProvider,
  normalizeProvider,
  openaiConfigured,
} from "../lib/aiProvider";

const router: IRouter = Router();

// Fail-closed: admin login is disabled if ADMIN_PASSWORD is not configured.
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD ?? "").trim();

function adminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["x-admin-password"];
  if (!authHeader || authHeader !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

router.post("/verify", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  return res.status(401).json({ error: "Incorrect admin password" });
});

router.get("/codes", adminAuth, async (_req, res) => {
  try {
    const codes = await db
      .select()
      .from(litAccessCodes)
      .orderBy(desc(litAccessCodes.createdAt));
    return res.json(codes);
  } catch (err) {
    logger.error({ err }, "List codes error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/codes/generate", adminAuth, async (req, res) => {
  const { recipientName, recipientEmail, count, notes, expiresAt } = req.body;

  if (!recipientName || typeof recipientName !== "string" || !recipientName.trim()) {
    return res.status(400).json({ error: "Recipient name is required" });
  }
  if (!recipientEmail || typeof recipientEmail !== "string" || !recipientEmail.includes("@")) {
    return res.status(400).json({ error: "A valid recipient email is required" });
  }

  const qty = Math.min(Math.max(parseInt(count) || 1, 1), 50);
  const expiryDate = expiresAt ? new Date(expiresAt) : undefined;
  const generated: string[] = [];

  try {
    for (let i = 0; i < qty; i++) {
      const code = await generateUniqueAccessCode();
      await db.insert(litAccessCodes).values({
        code,
        recipientName: recipientName.trim(),
        recipientEmail: recipientEmail.trim().toLowerCase(),
        notes: notes?.trim() || null,
        status: "active",
        expiresAt: expiryDate || null,
      });
      generated.push(code);
    }

    const emailResult = await sendAccessCodeEmail(
      recipientName.trim(),
      recipientEmail.trim().toLowerCase(),
      generated,
      expiryDate
    );

    return res.json({
      success: true,
      codes: generated,
      count: generated.length,
      emailSent: emailResult.success,
      emailError: emailResult.error,
    });
  } catch (err) {
    logger.error({ err }, "Generate codes error");
    return res.status(500).json({ error: "Failed to generate codes" });
  }
});

router.post("/codes/revoke", adminAuth, async (req, res) => {
  const { id } = req.body;
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: "Valid code ID is required" });
  }

  try {
    await db
      .update(litAccessCodes)
      .set({ status: "revoked" })
      .where(eq(litAccessCodes.id, parseInt(id)));
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Revoke code error");
    return res.status(500).json({ error: "Failed to revoke code" });
  }
});

router.post("/codes/restore", adminAuth, async (req, res) => {
  const { id } = req.body;
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: "Valid code ID is required" });
  }

  try {
    await db
      .update(litAccessCodes)
      .set({ status: "active" })
      .where(eq(litAccessCodes.id, parseInt(id)));
    return res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Restore code error");
    return res.status(500).json({ error: "Failed to restore code" });
  }
});

// ─── IRAC AI provider selection ───────────────────────────────────────────────
// PUBLIC read: the IRAC client fetches the admin default to resolve which
// provider to send on each request. (Returns Gemini if nothing is stored.)
router.get("/ai-provider", async (_req, res) => {
  try {
    const provider = await getDefaultProvider();
    return res.json({ provider, openaiConfigured: openaiConfigured() });
  } catch (err) {
    logger.error({ err }, "Get AI provider error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Admin-only write: change the IRAC default provider.
router.post("/ai-provider", adminAuth, async (req, res) => {
  const provider = normalizeProvider(req.body?.provider);
  if (provider === "openai" && !openaiConfigured()) {
    return res
      .status(400)
      .json({ error: "OPENAI_API_KEY is not configured on the server" });
  }
  try {
    await setDefaultProvider(provider);
    return res.json({ provider });
  } catch (err) {
    logger.error({ err }, "Set AI provider error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
