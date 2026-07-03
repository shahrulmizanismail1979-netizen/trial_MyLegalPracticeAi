import { Router, type IRouter } from "express";
import subscribersRouter from "./subscribers";
import kohortsRouter from "./kohorts";
import pricingRouter from "./pricing";
import vouchersRouter from "./vouchers";
import dashboardRouter from "./dashboard";
import contributionsRouter from "./contributions";

const router: IRouter = Router();

router.use(subscribersRouter);
router.use(kohortsRouter);
router.use(pricingRouter);
router.use(vouchersRouter);
router.use(dashboardRouter);
router.use(contributionsRouter);

export default router;
