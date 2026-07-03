import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import authRouter from "./auth";
import storageRouter from "./storage";
import contributionsRouter from "./contributions";
import { requireAuth, requireStaff } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(contributionsRouter);
router.use("/admin", requireAuth, requireStaff, adminRouter);

export default router;
