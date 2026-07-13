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
import { requireAuth } from "../middleware/requireAuth";
import { gateAiTools } from "../middleware/entitlements";

const router: IRouter = Router();

router.use(authRouter);
router.use(adminRouter);
router.use(dashboardRouter);

router.use(requireAuth);
router.use(topicsRouter);
router.use(caseLawsRouter);
router.use(causePapersRouter);
router.use(workflowsRouter);
router.use(sampleDocumentsRouter);
router.use(glossaryRouter);
router.use(costsFeesRouter);
router.use(gateAiTools);
router.use(aiRouter);
router.use(voiceRouter);

export default router;
