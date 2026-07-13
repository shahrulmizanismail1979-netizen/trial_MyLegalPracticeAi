import { Router, type IRouter } from "express";
import { reconcileMissedProvisioning } from "../../lib/provisioning";

const router: IRouter = Router();

// Staff-only (mounted behind requireAuth + requireStaff): re-scan all live
// Stripe subscriptions and provision any subscriber whose checkout webhook
// was missed. Idempotent — already-provisioned subscriptions are skipped.
router.post("/stripe/reconcile", async (req, res) => {
  try {
    const result = await reconcileMissedProvisioning();
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Manual Stripe reconciliation failed");
    res.status(500).json({ error: "Reconciliation failed. Check server logs." });
  }
});

export default router;
