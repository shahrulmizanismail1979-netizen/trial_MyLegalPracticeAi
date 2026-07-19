import { Router, type IRouter } from "express";

// Billing is disabled for the MyLawAcad integration. The donor app shipped a
// full Stripe integration; here every billing route returns 503 so the rest of
// the app can boot and function without Stripe configured.
const router: IRouter = Router();

router.all("/billing/*splat", (_req, res) => {
  res.status(503).json({ error: "billing_disabled" });
});

export default router;
