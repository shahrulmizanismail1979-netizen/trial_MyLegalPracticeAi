import { Router, type IRouter } from "express";
import healthRouter from "./health";
import adminRouter from "./admin";
import authRouter from "./auth";
import storageRouter from "./storage";
import contributionsRouter from "./contributions";
import stripeRouter from "./stripe";
import accessRouter from "./access";
import statsRouter from "./stats";
import assistantRouter from "./assistant";
import currencyRouter from "./currency";
import conveyRouter from "./convey";
import conveySubscriptionRouter from "./convey-subscription";
import conveyAdminRouter from "./convey-admin";
import accidentRouter from "./accident";
import accidentAiRouter from "./accident-ai";
import accidentAdminRouter from "./accident-admin";
import crimRouter from "../crim/routes";
import { crimSession } from "../crim/session";
import corpRouter from "../corp/routes";
import litRouter from "../lit/routes";
import { litSession } from "../lit/session";
import { requireAuth, requireStaff } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(contributionsRouter);
router.use(statsRouter);
router.use("/stripe", stripeRouter);
router.use("/access", accessRouter);
router.use("/assistant", assistantRouter);
router.use("/currency", currencyRouter);
router.use("/admin", requireAuth, requireStaff, adminRouter);
// MyConveyLitAI (conveyancing app) routes: /convey/*, /convey-admin/*.
// The convey admin router carries its own password auth (x-admin-token).
router.use(conveyRouter);
router.use(conveySubscriptionRouter);
router.use(conveyAdminRouter);
router.use("/accident", accidentRouter);
router.use("/accident", accidentAiRouter);
router.use("/accident", accidentAdminRouter);
// MyCrimAI (criminal law app): /crim/*. Uses express-session (Postgres-backed),
// scoped to this mount so the rest of the API is unaffected.
router.use("/crim", crimSession, crimRouter);

// MyCorpLegalAI (corporate secretary app): /corp/*. Uses Bearer-token sessions
// stored in corp_sessions — no express-session middleware needed.
router.use("/corp", corpRouter);

// MyLitAI (litigation app): /lit/*. Uses express-session (Postgres-backed),
// scoped to this mount so the rest of the API is unaffected.
router.use("/lit", litSession, litRouter);

export default router;
