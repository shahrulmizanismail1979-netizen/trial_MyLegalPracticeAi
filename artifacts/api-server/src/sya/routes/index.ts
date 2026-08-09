import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import provisionsRouter from "./provisions";
import casesRouter from "./cases";
import causePapersRouter from "./cause-papers";
import workflowsRouter from "./workflows";
import glossaryRouter from "./glossary";
import legislationRouter from "./legislation";
import dashboardRouter from "./dashboard";
import geminiRouter from "./gemini";
import quranicVersesRouter from "./quranic-verses";
import fatwasRouter from "./fatwas";
import analyzerRouter from "./analyzer";
import adminRouter from "./admin";
import smartSearchRouter from "./smart-search";
import caseAnalysisRouter from "./case-analysis";
import documentGeneratorRouter from "./document-generator";
import kitabRouter from "./kitab-analysis";
import legalOpinionRouter from "./legal-opinion";
import complianceCheckRouter from "./compliance-check";
import clientIntakeRouter from "./client-intake";
import tafsirRouter from "./tafsir";
import voiceModeRouter from "./voice-mode";
import billingRouter from "./billing";
import voiceRouter from "./voice";

import practiceDirectionsRouter from "./practice-directions";
import mattersRouter from "./matters";
import clientsRouter from "./clients";
import { tierHasFeature, type FeatureKey } from "../lib/tiers";
import { ensureCodeNotExpired } from "../lib/auth";

const router: IRouter = Router();

// Tier gating: premium features require a sufficient subscription. Access-code
// holders are treated as "firm" so existing internal access is unchanged.
const GATES: Array<{ prefix: string; feature: FeatureKey }> = [
  { prefix: "/kitab", feature: "kitab" },
  { prefix: "/tafsir", feature: "tafsir" },
  { prefix: "/voice-mode", feature: "voiceMode" },
  { prefix: "/analyzer", feature: "aiToolkit" },
  { prefix: "/smart-search", feature: "aiToolkit" },
  { prefix: "/case-analysis", feature: "aiToolkit" },
  { prefix: "/document-generator", feature: "aiToolkit" },
  { prefix: "/legal-opinion", feature: "aiToolkit" },
  { prefix: "/compliance-check", feature: "aiToolkit" },
  { prefix: "/client-intake", feature: "aiToolkit" },
];

router.use(async (req, res, next) => {
  const gate = GATES.find(
    (g) => req.path === g.prefix || req.path.startsWith(g.prefix + "/"),
  );
  if (!gate) {
    next();
    return;
  }
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!(await ensureCodeNotExpired(req, res))) return;
  const tier = req.session.userTier ?? "starter";
  if (!tierHasFeature(tier, gate.feature)) {
    res.status(402).json({
      error: "upgrade_required",
      feature: gate.feature,
      currentTier: tier,
    });
    return;
  }
  next();
});

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(provisionsRouter);
router.use(casesRouter);
router.use(causePapersRouter);
router.use(workflowsRouter);
router.use(glossaryRouter);
router.use(legislationRouter);
router.use(dashboardRouter);
router.use(geminiRouter);
router.use(quranicVersesRouter);
router.use(fatwasRouter);
router.use(analyzerRouter);
router.use(smartSearchRouter);
router.use(caseAnalysisRouter);
router.use(documentGeneratorRouter);
router.use(kitabRouter);
router.use(legalOpinionRouter);
router.use(complianceCheckRouter);
router.use(clientIntakeRouter);
router.use(tafsirRouter);
router.use(voiceModeRouter);
router.use(billingRouter);
router.use(voiceRouter);
router.use(practiceDirectionsRouter);
router.use(mattersRouter);
router.use("/clients", clientsRouter);

export default router;
