import { Router, type IRouter, type Response } from "express";
import { corpMatterFiles } from "@workspace/db";
import { requireSession } from "../lib/requireSession";
import { createMatterFileRouters } from "../../lib/matterFiles";

/**
 * MyCorpLegalAI matter files (Task #110): owned per corp access code, which
 * requireSession resolves into res.locals.accessCodeId on every request.
 */
const { mattersRouter, savedWorkRouter } = createMatterFileRouters(
  corpMatterFiles,
  (_req, res: Response) =>
    typeof res.locals.accessCodeId === "number" ? res.locals.accessCodeId : undefined,
);

const router: IRouter = Router();
router.use("/matters", requireSession, mattersRouter);
router.use("/saved-work", requireSession, savedWorkRouter);

export default router;
