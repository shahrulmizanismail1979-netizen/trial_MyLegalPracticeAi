import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter, { requireLitAuth, litSessionGate } from "./auth";
import { attachVirtualParalegal } from "../../lib/virtualParalegal";
import adminRouter from "./admin";
import theoryRouter from "./theory";
import workflowsRouter from "./workflows";
import formsRouter from "./forms";
import jurisprudenceRouter from "./jurisprudence";
import costsRouter from "./costs";
import compendiumRouter from "./compendium";
import terminologyRouter from "./terminology";
import aiRouter from "./ai";
import geminiRouter from "./gemini";
import uploadsRouter from "./uploads";
import exportsRouter from "./exports";
import savedWorkRouter from "./saved-work";
import billingRouter from "./billing";
import oralRouter from "./oral";
import iracRouter from "./irac";
import mattersRouter from "./matters";
import bankingRecoveryRouter from "./banking-recovery";
import enforcementRouter from "./enforcement";
import bundlesRouter from "./bundles";
import intakeRouter from "./intake";
import appealsRouter from "./appeals";
import affidavitsRouter from "./affidavits";
import practiceDirectionsRouter from "./practice-directions";
import barCouncilRouter from "./bar-council";
import clientsRouter from "./clients";
import lawyesRouter from "./lawyes";
import { aiRateLimit } from "../../lib/aiRateLimit";
import { requireSubscription } from "./billing";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
// Every route below gets per-request revocation/expiry/seat enforcement for
// authenticated code sessions (team-bundle seat limits must cover ALL
// product paths, not just the Gemini routes).
router.use((req, res, next) => void litSessionGate(req, res, next));
router.use("/admin", adminRouter);
router.use("/theory", theoryRouter);
router.use("/workflows", workflowsRouter);
router.use("/forms", formsRouter);
router.use("/jurisprudence", jurisprudenceRouter);
router.use("/costs", costsRouter);
router.use("/compendium", compendiumRouter);
router.use("/terminology", terminologyRouter);
// requireLitAuth runs BEFORE aiRateLimit: litSessionGate lets unauthenticated
// requests fall through (some lit routes are public), so without an explicit
// auth gate here unauthenticated POSTs would reach the rate limiter and drain
// the shared __noauth__ fallback bucket.
const litAuth: import("express").RequestHandler = (req, res, next) =>
  void requireLitAuth(req, res, next);
router.use("/ai", litAuth, aiRateLimit, aiRouter);
router.use("/gemini", litAuth, aiRateLimit, geminiRouter);
router.use("/irac", litAuth, aiRateLimit, iracRouter);
router.use("/banking-recovery", litAuth, aiRateLimit, bankingRecoveryRouter);
router.use(
  "/lawyes",
  litAuth,
  (req, res, next) => void requireSubscription(req, res, next),
  aiRateLimit,
  lawyesRouter,
);
router.use("/uploads", uploadsRouter);
router.use("/exports", exportsRouter);
router.use("/saved-work", savedWorkRouter);
router.use("/billing", billingRouter);
router.use("/oral", oralRouter);
router.use("/matters", mattersRouter);
router.use("/enforcement", enforcementRouter);
router.use("/bundles", bundlesRouter);
router.use("/intake", intakeRouter);
router.use("/appeals", appealsRouter);
router.use("/affidavits", affidavitsRouter);
router.use("/practice-directions", practiceDirectionsRouter);
router.use("/bar-council-rulings", barCouncilRouter);
router.use("/clients", clientsRouter);

// Floating dashboard virtual paralegal (chat + voice). Gated by litAuth so the
// shared AI rate limiter inside always sees an authenticated request.
const paralegalRouter = Router();
attachVirtualParalegal({
  router: paralegalRouter,
  portal: "lit",
  portalLabel: "MyLitAI",
  focus:
    "Malaysian civil litigation practice — pleadings, affidavits, submissions, banking recovery, enforcement, appeals, bundles and matter management.",
  getOwnerKey: (req) => {
    const id = (req.session as { accessCodeId?: number } | undefined)?.accessCodeId;
    return id ? String(id) : null;
  },
  pathPrefix: "",
});
router.use("/paralegal", litAuth, paralegalRouter);

export default router;
