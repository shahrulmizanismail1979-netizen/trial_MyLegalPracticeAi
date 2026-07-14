import { Router, type IRouter } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, ccbAccessCodes } from "@workspace/db";

const router: IRouter = Router();

const SECRET = process.env.SESSION_SECRET || "myccblitai-secret-key-2024";

const MASTER_CODE = process.env.MASTER_ACCESS_CODE ?? "";
const ENV_CODES = process.env.CCB_ACCESS_CODES
  ? process.env.CCB_ACCESS_CODES.split(",")
  : ["CCBLIT2024", "MYCCBLIT", "UKM2024", "PRACTITIONER"];

const STATIC_CODES = [MASTER_CODE, ...ENV_CODES]
  .map((c) => c.trim().toUpperCase())
  .filter((c) => c.length > 0);

const VerifyAccessCodeBody = z.object({ code: z.string().min(1) });

router.post("/auth/verify", async (req, res): Promise<void> => {
  const parsed = VerifyAccessCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const code = parsed.data.code.trim().toUpperCase();

  let valid = STATIC_CODES.includes(code);
  let dbCodeId: number | null = null;

  if (!valid) {
    const rows = await db.select().from(ccbAccessCodes).where(eq(ccbAccessCodes.code, code));
    const row = rows[0];
    if (row && row.active) {
      valid = true;
      dbCodeId = row.id;
    }
  }

  if (!valid) {
    res.status(401).json({ error: "Invalid access code" });
    return;
  }

  if (dbCodeId !== null) {
    await db
      .update(ccbAccessCodes)
      .set({ lastUsedAt: new Date() })
      .where(eq(ccbAccessCodes.id, dbCodeId));
  }

  const token = jwt.sign({ role: "practitioner", code }, SECRET, { expiresIn: "7d" });
  res.json({ success: true, token });
});

export default router;
