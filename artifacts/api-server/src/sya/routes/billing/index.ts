import { Router, type IRouter } from "express";

// Billing is disabled for the MySyariahAi portal in this monorepo. The donor
// app's Stripe checkout/webhook/portal flows are intentionally not ported.
// Every billing route returns 503 so callers get a clear, consistent signal.
const router: IRouter = Router();

router.use("/billing", (_req, res) => {
  res.status(503).json({ error: "billing_disabled" });
});

export default router;
