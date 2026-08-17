import { Router, type IRouter } from "express";
import { getAlertStatus } from "../../lib/alertStatus";
import { GetAlertStatusResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * GET /admin/alert-status
 *
 * Staff-only endpoint (auth applied at mount time in routes/index.ts).
 * Returns the last recorded Stripe alert delivery attempt for each channel
 * so ops can verify that notification channels are healthy without trawling
 * raw server logs.
 *
 * An empty array means the server has not yet attempted to send any alert
 * since the last restart (e.g. Stripe is in live mode — no alert needed).
 */
router.get("/alert-status", (_req, res): void => {
  const attempts = getAlertStatus();
  res.json(GetAlertStatusResponse.parse(attempts));
});

export default router;
