/**
 * MySyariahAI client management: GET/POST/GET:id/PATCH/DELETE via the shared
 * case_clients table (portal = "sya"). Requires sya session auth.
 * Owner key: "{ownerType}:{ownerId}" (dual-key pattern, same as sya matters).
 */
import { Router, type IRouter, type Request } from "express";
import { makeClientsRouter } from "../../lib/caseClients";
import { requireAuth } from "../lib/auth";

const clientsRouter = makeClientsRouter("sya", (req: Request) => {
  const userId = req.session.userId;
  const accountType = req.session.accountType ?? "code";
  if (typeof userId !== "number") return null;
  return `${accountType}:${userId}`;
});

const router: IRouter = Router();
router.use(requireAuth as import("express").RequestHandler);
router.use("/", clientsRouter);

export default router;
