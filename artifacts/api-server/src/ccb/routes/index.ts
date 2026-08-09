import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter, { requirePractitioner } from "./auth";
import adminRouter from "./admin";
import toolsRouter from "./tools";
import geminiRouter from "./gemini";
import mattersRouter from "./matters";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(adminRouter);
// Tools + conversations require a valid practitioner token; the guard also
// re-checks the access code (active + not expired) on every request.
router.use(requirePractitioner);
router.use(toolsRouter);
router.use(geminiRouter);
router.use(mattersRouter);

export default router;
