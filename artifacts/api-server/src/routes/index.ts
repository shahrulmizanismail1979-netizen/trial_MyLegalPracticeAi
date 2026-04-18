import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use("/payments", paymentsRouter);

export default router;
