/**
 * MyCrimAI client management: GET/POST/GET:id/PATCH/DELETE via the shared
 * case_clients table (portal = "crim"). Requires crim session auth.
 */
import { Router, type IRouter } from "express";
import { makeClientsRouter } from "../../lib/caseClients";
import { requireMatterTenant, tenantOf } from "./matterAuth";

const clientsRouter = makeClientsRouter("crim", (req, _res) => {
  // requireMatterTenant runs before this; tenantOf is safe to call.
  try {
    const id = tenantOf(req);
    return String(id);
  } catch {
    return null;
  }
});

const router: IRouter = Router();
router.use(requireMatterTenant);
router.use("/", clientsRouter);

export default router;
