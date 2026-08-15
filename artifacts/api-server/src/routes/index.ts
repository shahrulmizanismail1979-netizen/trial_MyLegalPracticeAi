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
import conveyMattersRouter from "./convey-matters";
import conveyParalegalRouter from "./convey-paralegal";
import legacyCodesRouter from "./legacy-codes";
import accidentRouter from "./accident";
import accidentAiRouter from "./accident-ai";
import accidentAdminRouter from "./accident-admin";
import accidentMattersRouter from "../accident/matters";
import accidentParalegalRouter from "./accident-paralegal";
import crimRouter from "../crim/routes";
import { crimSession } from "../crim/session";
import corpRouter from "../corp/routes";
import litRouter from "../lit/routes";
import { litSession } from "../lit/session";
import ccbRouter from "../ccb/routes";
import syaRouter from "../sya/routes";
import { syaSession } from "../sya/session";
import acadRouter from "../acad/routes";
import firmRouter from "../firm";
import { acadSession } from "../acad/session";
import { requireAuth, requireStaff } from "../middlewares/requireAdmin";
import researchRouter from "../research/routes";
import researchAdminRouter from "./research-admin";
import { buildPersonasRouter } from "../lib/personas";
import sharedUploadsRouter from "./shared-uploads";
import casesRouter from "./cases";
import { requireAnyPortalAuth } from "../middlewares/requireAnyPortalAuth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(sharedUploadsRouter);
router.use(storageRouter);
router.use(contributionsRouter);
router.use(statsRouter);
router.use("/stripe", stripeRouter);
router.use("/access", accessRouter);
router.use("/assistant", assistantRouter);
router.use("/currency", currencyRouter);
// Shared professional-persona layer (persona-first front door, all portals).
router.use("/personas", buildPersonasRouter());
router.use("/admin", requireAuth, requireStaff, adminRouter);
// Judgment Research Platform (Phase 00): staff-only, private by default.
// See docs/SECURITY_MODEL.md — no public access to research data.
router.use("/research", requireAuth, requireStaff, researchRouter);

// Research admin portal — password-gated (ADMIN_PASSWORD), no Clerk required.
router.use("/research-admin", researchAdminRouter);

// Portal-accessible Case Law API: /cases/search, /cases/:id.
// Accepts any active portal session (Lit, Crim, Sya, Acad, CCB JWT, Corp Bearer,
// Convey JWT, Accident session_id, or MASTER_ACCESS_CODE).
// No Clerk required — subscriber-only, approved+headnoted cases only.
router.use("/cases", requireAnyPortalAuth, casesRouter);
// MyConveyLitAI (conveyancing app) routes: /convey/*, /convey-admin/*.
// The convey admin router carries its own password auth (x-admin-token).
router.use(conveyRouter);
router.use(conveySubscriptionRouter);
router.use(conveyAdminRouter);
// MyConveyLitAI matter files (Task #110): /convey/matters, /convey/saved-work.
router.use(conveyMattersRouter);
// Floating dashboard virtual paralegal (chat + voice): /convey/paralegal/*.
// Auth (attachUser + requireAuth) is scoped inside the router so the shared AI
// rate limiter never sees an unauthenticated request.
router.use(conveyParalegalRouter);
// Legacy access-code import (x-admin-token auth): /legacy-codes/import.
router.use(legacyCodesRouter);
router.use("/accident", accidentRouter);
router.use("/accident", accidentAiRouter);
router.use("/accident", accidentAdminRouter);
// MyAccidentAI matter files: /accident/matters, /accident/saved-work. Auth is
// scoped inside the router (requireMatterTenant reads the session_id cookie),
// so this never blocks the other /accident routes.
router.use("/accident", accidentMattersRouter);
// Floating dashboard virtual paralegal (chat + voice): /accident/paralegal/*.
// Auth (requireAccidentSession) is scoped inside the router so the shared AI
// rate limiter never sees an unauthenticated request.
router.use("/accident", accidentParalegalRouter);
// MyCrimAI (criminal law app): /crim/*. Uses express-session (Postgres-backed),
// scoped to this mount so the rest of the API is unaffected.
router.use("/crim", crimSession, crimRouter);

// MyCorpLegalAI (corporate secretary app): /corp/*. Uses Bearer-token sessions
// stored in corp_sessions — no express-session middleware needed.
router.use("/corp", corpRouter);

// MyLitAI (litigation app): /lit/*. Uses express-session (Postgres-backed),
// scoped to this mount so the rest of the API is unaffected.
router.use("/lit", litSession, litRouter);

// MyCorpCommBankLitAI (CCB): /ccb/*. JWT-based auth stored in localStorage.
router.use("/ccb", ccbRouter);

// MySyariahAi (Shariah law app): /sya/*. Uses express-session (Postgres-backed),
// scoped to this mount so the rest of the API is unaffected.
router.use("/sya", syaSession, syaRouter);

// MyLawAcad (legal assessment app): /acad/*. Uses express-session
// (Postgres-backed, acad_user_sessions), scoped to this mount so the rest of
// the API is unaffected.
router.use("/acad", acadSession, acadRouter);

// MyLawFirmAi (firm management portal): /firm/*. Signed httpOnly cookie
// sessions (staff via access code / master, manager via master code) — no
// express-session middleware needed; the router carries its own session gate.
router.use("/firm", firmRouter);

export default router;
