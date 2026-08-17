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
 * raw server logs.  History is read from the DB and survives server restarts.
 *
 * An empty array means no alert has ever been attempted (e.g. Stripe has not
 * triggered a notification since the DB table was created).
 */
router.get("/alert-status", async (_req, res): Promise<void> => {
  const attempts = await getAlertStatus();
  res.json(GetAlertStatusResponse.parse(attempts));
});

export default router;
