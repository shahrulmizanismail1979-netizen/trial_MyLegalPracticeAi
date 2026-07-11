import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscribersTable } from "@workspace/db";

const router: IRouter = Router();

/**
 * Public verification endpoint for the AI portal apps.
 * A portal can check whether an access code issued by mylegalpracticeai.life
 * is valid before letting the user in:
 *
 *   GET /api/access/verify?code=MLPA-XXXXX-XXXXX
 *
 * Returns only non-sensitive subscription facts (no customer PII).
 */
router.get("/verify", async (req, res) => {
  const code = req.query.code;
  if (typeof code !== "string" || code.length < 6 || code.length > 40) {
    res.status(400).json({ valid: false, error: "Invalid code format." });
    return;
  }

  const [subscriber] = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.accessCode, code.trim().toUpperCase()));

  if (!subscriber || subscriber.paymentStatus === "rejected") {
    res.json({ valid: false });
    return;
  }

  const expired =
    subscriber.subscriptionExpiry !== null && subscriber.subscriptionExpiry < new Date();

  res.json({
    valid: subscriber.paymentStatus === "confirmed" && !expired,
    apps: subscriber.apps,
    tier: subscriber.tier,
    status: subscriber.paymentStatus,
  });
});

export default router;
