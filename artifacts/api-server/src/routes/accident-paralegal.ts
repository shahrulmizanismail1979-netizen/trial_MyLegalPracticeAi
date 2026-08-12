import { Router, type IRouter, type Request, type Response } from "express";
import { requireAccidentSession } from "../accident/sessionGate";
import { isMasterToken } from "./accident";
import { attachVirtualParalegal } from "../lib/virtualParalegal";

// Floating dashboard virtual paralegal (chat + voice) for MyAccidentAI. Gated
// by requireAccidentSession so the shared AI rate limiter inside always sees an
// authenticated request. requireAccidentSession populates
// res.locals.accidentAccessCodeId, which is the per-subscriber identity.
const paralegalRouter: IRouter = Router();
attachVirtualParalegal({
  router: paralegalRouter,
  portal: "accident",
  portalLabel: "MyAccidentAI",
  focus:
    "Malaysian personal injury and road accident claims — liability, quantum, insurance recovery and running-down actions.",
  getOwnerKey: (req: Request, res: Response) => {
    const id = (res.locals as { accidentAccessCodeId?: number }).accidentAccessCodeId;
    if (typeof id === "number") return String(id);
    // Master-override sessions have no DB code row but are fully authenticated.
    const sessionId: string | undefined = req.cookies?.session_id;
    if (sessionId && isMasterToken(sessionId)) return `master:${sessionId.slice(0, 24)}`;
    return null;
  },
  pathPrefix: "",
});

const router: IRouter = Router();
router.use(
  "/paralegal",
  (req, res, next) => void requireAccidentSession(req, res, next),
  paralegalRouter,
);

export default router;
