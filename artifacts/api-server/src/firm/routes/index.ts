import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import tasksRouter from "./tasks";
import insightsRouter from "./insights";
import goalsRouter from "./goals";
import meetingsRouter from "./meetings";
import voiceRouter from "./voice";
import ingestRouter from "./ingest";
import storageRouter from "./storage";
import recognitionRouter from "./recognition";
import hrRouter from "./hr";
import accountsRouter from "./accounts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(tasksRouter);
router.use(insightsRouter);
router.use(goalsRouter);
router.use(meetingsRouter);
router.use(voiceRouter);
router.use(ingestRouter);
router.use(storageRouter);
router.use(recognitionRouter);
router.use(hrRouter);
router.use(accountsRouter);

export default router;
