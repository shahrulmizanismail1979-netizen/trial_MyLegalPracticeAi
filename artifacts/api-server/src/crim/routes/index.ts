// MyCrimAI routes, mounted at /api/crim. Billing is intentionally excluded:
// the landing page owns all Stripe payments; purchased access codes are synced
// into crim_access_codes by the landing provisioning flow.
import { Router, type IRouter } from "express";
import authRouter from "./auth";
import adminRouter from "./admin";
import topicsRouter from "./topics";
import caseLawsRouter from "./caseLaws";
import causePapersRouter from "./causePapers";
import workflowsRouter from "./workflows";
import sampleDocumentsRouter from "./sampleDocuments";
import glossaryRouter from "./glossary";
import costsFeesRouter from "./costsFees";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import voiceRouter from "./voice";
import mattersRouter from "./matters";
import savedWorkRouter from "./savedWork";
import clientsRouter from "./clients";
import { requireAuth } from "../middleware/requireAuth";
import { gateAiTools } from "../middleware/entitlements";
import { ensureCrimMatterTables } from "../lib/ensureMatterTables";
import { aiRateLimit } from "../../lib/aiRateLimit";
import { attachVirtualParalegal } from "../../lib/virtualParalegal";

// Fire-and-forget at boot; requests to the matter routes also await it via
// middleware so a slow boot can't race an early request into a missing table.
void ensureCrimMatterTables().catch(() => {});

const router: IRouter = Router();

router.use(authRouter);
router.use(adminRouter);
router.use(dashboardRouter);

router.use(requireAuth);

// Floating dashboard virtual paralegal (chat + voice). Gated by requireAuth so
// the shared AI rate limiter inside always sees an authenticated request.
const paralegalRouter = Router();
attachVirtualParalegal({
  router: paralegalRouter,
  portal: "crim",
  portalLabel: "MyCrimAI",
  focus:
    "Malaysian criminal law practice — charges, bail, mitigation, trials, appeals and criminal matter management.",
  getOwnerKey: (req, res) => {
    const id = (res.locals.accessCode as { id?: number } | undefined)?.id;
    if (id) return String(id);
    // Master-override sessions have no DB code row but are fully authenticated.
    if ((req.session as { isMaster?: boolean } | undefined)?.isMaster) {
      return `master:${req.sessionID}`;
    }
    return null;
  },
  pathPrefix: "",
});
router.use("/paralegal", requireAuth, paralegalRouter);

router.use(topicsRouter);
router.use(caseLawsRouter);
router.use(causePapersRouter);
router.use(workflowsRouter);
router.use(sampleDocumentsRouter);
router.use(glossaryRouter);
router.use(costsFeesRouter);
const awaitMatterTables: import("express").RequestHandler = (_req, res, next) => {
  ensureCrimMatterTables().then(
    () => next(),
    () => res.status(503).json({ error: "matter storage unavailable" }),
  );
};
router.use("/matters", awaitMatterTables);
router.use("/saved-work", awaitMatterTables);
router.use("/matters", mattersRouter);
router.use("/saved-work", savedWorkRouter);
router.use("/clients", awaitMatterTables, clientsRouter);
router.use(gateAiTools);
router.use(aiRateLimit);
router.use(aiRouter);
router.use(voiceRouter);

export default router;
