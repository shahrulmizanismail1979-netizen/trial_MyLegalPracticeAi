import { Router, type IRouter, type Response } from "express";
import { ccbMatterFiles } from "@workspace/db";
import { createMatterFileRouters } from "../../lib/matterFiles";

/**
 * MyCCBLitAI matter files (Task #110): owned per ccb access code. Mounted
 * behind requirePractitioner, which resolves the token's access code to
 * res.locals.ccbAccessCodeId. Static/master codes resolve to null — they
 * cannot own rows, so matter routes are unavailable to them (403).
 */
const { mattersRouter, savedWorkRouter, clientsRouter } = createMatterFileRouters(
  ccbMatterFiles,
  (_req, res: Response) => {
    const id = res.locals["ccbAccessCodeId"];
    return typeof id === "number" ? id : undefined;
  },
  "ccb",
);

const router: IRouter = Router();

// Give master/static-code sessions a clear error instead of a bare 401.
router.use(["/matters", "/saved-work"], (_req, res, next) => {
  if (typeof res.locals["ccbAccessCodeId"] !== "number") {
    res.status(403).json({ error: "Matter files require a subscriber access code" });
    return;
  }
  next();
});
router.use("/matters", mattersRouter);
router.use("/saved-work", savedWorkRouter);
router.use("/clients", clientsRouter);

export default router;
