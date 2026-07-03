import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import storageRouter from "./storage";
import contributionsRouter from "./contributions";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(contributionsRouter);
router.use("/admin", adminRouter);

export default router;
