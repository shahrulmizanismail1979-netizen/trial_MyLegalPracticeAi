import { Router, type IRouter } from "express";
import legalRouter from "./legal";
import legalUploadsRouter from "./legal/uploads";
import geminiRouter from "./gemini";
import adminRouter from "./admin";

const router: IRouter = Router();

// Billing routes are intentionally excluded — purchases are handled centrally
// by the AI Web Books landing page, which provisions corp access codes.
router.use(legalRouter);
router.use(legalUploadsRouter);
router.use(geminiRouter);
router.use(adminRouter);

export default router;
