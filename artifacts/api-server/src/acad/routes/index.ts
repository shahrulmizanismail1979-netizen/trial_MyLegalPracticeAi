import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import oauthRouter from "./oauth";
import adminRouter from "./admin";
import appsRouter from "./apps";
import templatesRouter from "./templates";
import examsRouter from "./exams";
import studioRouter from "./studio";
import stripeRouter from "./stripe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(oauthRouter);
router.use(adminRouter);
router.use(appsRouter);
// Templates router must be registered before examsRouter so that
// `/exam-templates/by-code/:code` etc. take precedence (no overlap with /exams,
// but kept here for clarity).
router.use(templatesRouter);
router.use(examsRouter);
router.use(studioRouter);
router.use(stripeRouter);

export default router;
