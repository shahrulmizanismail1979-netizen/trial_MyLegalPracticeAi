import { Router, type IRouter, type Response } from "express";
import { corpMatterFiles } from "@workspace/db";
import { requireSession } from "../lib/requireSession";
import { createMatterFileRouters } from "../../lib/matterFiles";
import { createCorpWorkflowRouter } from "./workflow";

/**
 * MyCorpLegalAI matter files (Task #110): owned per corp access code, which
 * requireSession resolves into res.locals.accessCodeId on every request.
 */
const { mattersRouter, savedWorkRouter, clientsRouter } = createMatterFileRouters(
  corpMatterFiles,
  (_req, res: Response) =>
    typeof res.locals.accessCodeId === "number" ? res.locals.accessCodeId : undefined,
  "corp",
);

const router: IRouter = Router();
router.use("/matters", requireSession, mattersRouter);
router.use("/matters/:matterId/workflow", requireSession, createCorpWorkflowRouter());
router.use("/saved-work", requireSession, savedWorkRouter);
router.use("/clients", requireSession, clientsRouter);

export default router;
