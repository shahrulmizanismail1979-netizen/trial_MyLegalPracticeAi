import { Router, type IRouter, type Response } from "express";
import { ccbMatterFiles } from "@workspace/db";
import { createMatterFileRouters } from "../../lib/matterFiles";
import { resolveMatterTenantId } from "./matterAuth";

/**
 * MyCCBLitAI matter files (Task #110): owned per ccb access code. Mounted
 * behind requirePractitioner, which resolves the token's access code to
 * res.locals.ccbAccessCodeId. Real subscribers own rows under that id.
 *
 * Master/static-code sessions have no per-subscriber row (ccbAccessCodeId is
 * null). Rather than lock them out, resolveMatterTenantId maps each static
 * code onto its own synthetic (inactive, non-loginable) access-code row so
 * they can create and view their own matter files. Isolation for real
 * subscribers is unchanged — the synthetic rows are per-code and separate.
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

// Resolve the owning tenant for this request. For static/master sessions this
// substitutes a synthetic per-code access-code id into res.locals so the owner
// resolver above (and the shared routers) can treat them like a subscriber.
router.use(["/matters", "/saved-work", "/clients"], async (_req, res, next) => {
  try {
    if (typeof res.locals["ccbAccessCodeId"] !== "number") {
      const tenantId = await resolveMatterTenantId(res);
      if (typeof tenantId === "number") {
        res.locals["ccbAccessCodeId"] = tenantId;
      }
    }
  } catch {
    res.status(500).json({ error: "Could not resolve matter tenant" });
    return;
  }
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
