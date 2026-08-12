import { Router, type IRouter, type Request } from "express";
import { attachUser, requireAuth } from "../middlewares/conveyAuth";
import { attachVirtualParalegal } from "../lib/virtualParalegal";

// Floating dashboard virtual paralegal (chat + voice) for MyConveyLitAI. Gated
// by attachUser + requireAuth so the shared AI rate limiter inside always sees
// an authenticated request. attachUser populates req.userId, which is the
// per-login subscriber identity for convey.
const paralegalRouter: IRouter = Router();
attachVirtualParalegal({
  router: paralegalRouter,
  portal: "convey",
  portalLabel: "MyConveyLitAI",
  focus:
    "Malaysian conveyancing litigation — SPA disputes, caveats, specific performance, strata and land office procedure.",
  getOwnerKey: (req: Request) => {
    const id = req.userId;
    return typeof id === "number" ? String(id) : null;
  },
  pathPrefix: "",
});

const router: IRouter = Router();
// Scope the auth guard to the paralegal paths. A bare `router.use(...)` would
// apply requireAuth to every /api/* request (this router is mounted without a
// path prefix), locking out the other portals.
router.use("/convey/paralegal", attachUser, requireAuth, paralegalRouter);

export default router;
