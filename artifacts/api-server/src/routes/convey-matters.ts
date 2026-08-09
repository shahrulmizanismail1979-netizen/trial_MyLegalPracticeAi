import { Router, type IRouter, type Request } from "express";
import { conveyMatterFiles } from "@workspace/db";
import { attachUser, requireAuth } from "../middlewares/conveyAuth";
import { createMatterFileRouters } from "../lib/matterFiles";

/**
 * MyConveyLitAI matter files (Task #110): matters map to conveyancing
 * transactions (SPA, tenancy, POA, completion). Owned per convey user.
 */
const { mattersRouter, savedWorkRouter, clientsRouter } = createMatterFileRouters(
  conveyMatterFiles,
  (req: Request) => req.userId ?? undefined,
  "convey",
);

const router: IRouter = Router();
// Scope the auth guard to the matter-file paths. A bare `router.use(...)` would
// apply requireAuth to every /api/* request (this router is mounted without a
// path prefix), locking authenticated convey users out of the other portals.
router.use("/convey/matters", attachUser, requireAuth, mattersRouter);
router.use("/convey/saved-work", attachUser, requireAuth, savedWorkRouter);
router.use("/convey/clients", attachUser, requireAuth, clientsRouter);

export default router;
