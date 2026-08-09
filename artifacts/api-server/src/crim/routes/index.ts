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

// Fire-and-forget at boot; requests to the matter routes also await it via
// middleware so a slow boot can't race an early request into a missing table.
void ensureCrimMatterTables().catch(() => {});

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
router.use(aiRouter);
router.use(voiceRouter);

export default router;
