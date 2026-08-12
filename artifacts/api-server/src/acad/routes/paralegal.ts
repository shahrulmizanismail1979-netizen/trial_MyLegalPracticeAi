import { Router, type IRouter, type Request, type Response } from "express";
import { attachVirtualParalegal } from "../../lib/virtualParalegal";
import { requireUser } from "../lib/auth";
import type { User } from "@workspace/db/acad";

// Floating dashboard virtual paralegal (chat + voice). Gated by requireUser so
// the shared AI rate limiter inside always sees an authenticated request.
const paralegalRouter: IRouter = Router();
attachVirtualParalegal({
  router: paralegalRouter,
  portal: "acad",
  portalLabel: "MyLawAcad",
  focus:
    "Malaysian legal education — exam preparation, IRAC answers, tutorials, lecturing materials and academic legal research.",
  getOwnerKey: (_req: Request, res: Response) => {
    // requireUser has already attached the authenticated user to res.locals.
    const user = res.locals["user"] as User | undefined;
    return user?.id ? String(user.id) : null;
  },
  pathPrefix: "",
});

// Export a router that runs the portal's real auth BEFORE the paralegal routes.
const router: IRouter = Router();
router.use("/paralegal", requireUser(), paralegalRouter);

export default router;
