import { Router, type IRouter, type Request } from "express";
import legalRouter from "./legal";
import legalUploadsRouter from "./legal/uploads";
import geminiRouter from "./gemini";
import adminRouter from "./admin";
import mattersRouter from "./matters";
import { attachVirtualParalegal } from "../../lib/virtualParalegal";
import { requireSession } from "../lib/requireSession";

const router: IRouter = Router();

// Billing routes are intentionally excluded — purchases are handled centrally
// by the AI Web Books landing page, which provisions corp access codes.
router.use(legalRouter);
router.use(legalUploadsRouter);
router.use(geminiRouter);
router.use(adminRouter);
router.use(mattersRouter);

// Floating dashboard virtual paralegal (chat + voice). Gated by requireSession
// so the shared AI rate limiter inside always sees an authenticated request.
const paralegalRouter = Router();
attachVirtualParalegal({
  router: paralegalRouter,
  portal: "corp",
  portalLabel: "MyCorpLegalAI",
  focus:
    "Malaysian in-house corporate legal work — contracts review, company secretarial, compliance, employment and commercial advisory.",
  getOwnerKey: (req: Request, res) => {
    const id = (res.locals as { accessCodeId?: number }).accessCodeId;
    return id ? String(id) : null;
  },
  pathPrefix: "",
});
router.use("/legal/paralegal", requireSession, paralegalRouter);

export default router;
