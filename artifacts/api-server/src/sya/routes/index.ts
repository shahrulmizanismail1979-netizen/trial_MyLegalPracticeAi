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
import { ensureCodeNotExpired, syaSessionGate, requireAuth } from "../lib/auth";
import { aiRateLimit } from "../../lib/aiRateLimit";
import { attachVirtualParalegal } from "../../lib/virtualParalegal";

const router: IRouter = Router();

// Team-bundle seat limits: every product route re-validates the session's
// code expiry and seat on each request. Auth routes stay ungated so a
// displaced session can still log out or re-login; health stays public.
router.use((req, res, next) => {
  if (req.path.startsWith("/auth") || req.path.startsWith("/health")) {
    next();
    return;
  }
  void syaSessionGate(req, res, next);
});

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

// AI rate limit: per-subscriber guard on all routes that invoke Gemini / OpenAI.
// syaSessionGate already runs above, so req.session.userId is available for keying.
const SYA_AI_PREFIXES = new Set([
  "/gemini", "/smart-search", "/analyzer", "/case-analysis",
  "/document-generator", "/legal-opinion", "/compliance-check",
  "/client-intake", "/kitab", "/tafsir", "/voice-mode", "/voice",
  "/cause-papers",
]);
router.use((req, res, next) => {
  const segment = `/${req.path.split("/")[1] ?? ""}`;
  if (SYA_AI_PREFIXES.has(segment)) {
    // Auth must be confirmed BEFORE the limiter: syaSessionGate lets
    // unauthenticated requests fall through, and the tier GATES above don't
    // cover every AI prefix (e.g. /gemini, /voice, /cause-papers). Without
    // this check unauthenticated POSTs would reach the rate limiter and
    // drain the shared __noauth__ fallback bucket.
    if (!req.session.userId) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    return void aiRateLimit(req, res, next);
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

// Floating dashboard virtual paralegal (chat + voice). Gated by requireAuth so
// the shared AI rate limiter inside always sees an authenticated request
// (syaSessionGate above lets unauthenticated requests fall through).
const paralegalRouter = Router();
attachVirtualParalegal({
  router: paralegalRouter,
  portal: "sya",
  portalLabel: "MySyariahAI",
  focus:
    "Malaysian Syariah law practice — faraid, marriage/divorce (talaq, fasakh), hadhanah, nafkah, harta sepencarian and Syariah court procedure.",
  getOwnerKey: (req) => {
    const id = req.session?.userId;
    return id ? String(id) : null;
  },
  pathPrefix: "",
});
router.use("/paralegal", requireAuth, paralegalRouter);

export default router;
