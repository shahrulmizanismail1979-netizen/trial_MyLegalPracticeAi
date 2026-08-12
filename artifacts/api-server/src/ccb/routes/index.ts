import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter, { requirePractitioner } from "./auth";
import adminRouter from "./admin";
import toolsRouter from "./tools";
import geminiRouter from "./gemini";
import mattersRouter from "./matters";
import { attachVirtualParalegal } from "../../lib/virtualParalegal";
import { deviceSeatKey } from "../../lib/seatLimits";
const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
// Tools + conversations require a valid practitioner token; the guard also
// re-checks the access code (active + not expired) on every request.
router.use(requirePractitioner);
router.use(toolsRouter);
router.use(geminiRouter);
router.use(mattersRouter);

// Floating dashboard virtual paralegal (chat + voice). Gated by
// requirePractitioner so the shared AI rate limiter inside always sees an
// authenticated request.
const paralegalRouter = Router();
attachVirtualParalegal({
  router: paralegalRouter,
  portal: "ccb",
  portalLabel: "MyCorpCommBankLitAI",
  focus:
    "Malaysian corporate, commercial and banking litigation — debt recovery, guarantees, shareholder and contractual disputes.",
  getOwnerKey: (req, res) => {
    const id = (res.locals as { ccbAccessCodeId?: number | null }).ccbAccessCodeId;
    if (id != null) return String(id);
    // Master/static codes resolve to null by design, but requirePractitioner
    // has already verified the JWT — key them per-device instead.
    return `static:${deviceSeatKey(req)}`;
  },
  pathPrefix: "",
});
router.use("/paralegal", requirePractitioner, paralegalRouter);

export default router;
