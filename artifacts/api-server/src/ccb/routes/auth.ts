import { Router, type IRouter, type Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, ccbAccessCodes } from "@workspace/db";
import { verifyMsTicket, getLinkedCode, saveLink } from "../../microsoft";

const router: IRouter = Router();

// Fail closed in production: a predictable JWT signing secret would let
// anyone forge tokens. The dev fallback only exists for local development.
const SECRET = (() => {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "dev-secret-change-me";
})();

const MASTER_CODE = process.env.MASTER_ACCESS_CODE ?? "";
const ENV_CODES = process.env.CCB_ACCESS_CODES
  ? process.env.CCB_ACCESS_CODES.split(",")
  : ["CCBLIT2024", "MYCCBLIT", "UKM2024", "PRACTITIONER"];

const STATIC_CODES = [MASTER_CODE, ...ENV_CODES]
  .map((c) => c.trim().toUpperCase())
  .filter((c) => c.length > 0);

const VerifyAccessCodeBody = z.object({ code: z.string().min(1) });

// Shared by the normal access-code login and the Microsoft SSO exchange.
async function verifyCodeAndIssueToken(res: Response, rawCode: string): Promise<boolean> {
  const code = rawCode.trim().toUpperCase();

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
    return false;
  }

  if (dbCodeId !== null) {
    await db
      .update(ccbAccessCodes)
      .set({ lastUsedAt: new Date() })
      .where(eq(ccbAccessCodes.id, dbCodeId));
  }

  const token = jwt.sign({ role: "practitioner", code }, SECRET, { expiresIn: "7d" });
  res.json({ success: true, token });
  return true;
}

router.post("/auth/verify", async (req, res): Promise<void> => {
  const parsed = VerifyAccessCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await verifyCodeAndIssueToken(res, parsed.data.code);
});

// Microsoft SSO exchange: log in with the access code linked to the Microsoft
// email in the ticket, or link a newly provided code.
router.post("/auth/sso", async (req, res): Promise<void> => {
  const { ticket, code } = (req.body ?? {}) as { ticket?: string; code?: string };
  if (!ticket || typeof ticket !== "string") {
    res.status(400).json({ error: "Ticket is required" });
    return;
  }
  const email = verifyMsTicket(ticket, "ccb");
  if (!email) {
    res.status(401).json({ error: "Your Microsoft sign-in expired. Please try again." });
    return;
  }
  const providedCode = typeof code === "string" ? code.trim() : "";
  const codeToUse = providedCode || (await getLinkedCode(email, "ccb"));
  if (!codeToUse) {
    res.status(404).json({ needsLink: true });
    return;
  }
  const ok = await verifyCodeAndIssueToken(res, codeToUse);
  if (ok && providedCode) {
    await saveLink(email, "ccb", providedCode.toUpperCase());
  }
});

export default router;
