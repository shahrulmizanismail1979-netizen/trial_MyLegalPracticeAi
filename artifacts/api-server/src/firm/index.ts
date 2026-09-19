import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, firmAccessCodesTable, isFirmAccessCodeExpired } from "./db";
import {
  staffSessionIdentity,
  managerSessionIdentity,
  hasMixedTenantCookies,
  requireManagerSession,
  clearManagerCookie,
} from "./lib/managerSession";
import { runWithFirmWorkspace } from "./lib/workspace";
import { claimSeat, deviceSeatKey, seatLimitMessage } from "../lib/seatLimits";
import { attachVirtualParalegal } from "../lib/virtualParalegal";
import firmRoutes from "./routes";

/**
 * MyLawFirmAi (firm management portal) — ported from the donor TaskRadar app.
 * Mounted at /api/firm.
 *
 * Session gate — the PRIMARY authentication boundary. Every route requires a
 * valid server-verified session cookie (staff or manager). Staff sessions
 * minted from an access code carry the code's row id, which is re-checked
 * against firm_access_codes on every request so a session cannot outlive a
 * deactivated or expired code (portal expiry rule).
 */
const SESSION_PUBLIC_PATHS = new Set<string>([
  "/auth/staff",
  "/auth/manager",
  "/auth/logout",
  "/auth/signout",
  "/auth/session",
  "/auth/manager/setup/send",
  "/auth/manager/setup/verify",
  "/healthz",
]);

async function sessionGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (req.path === "/auth/staff" || req.path === "/healthz") {
    next();
    return;
  }
  // Recovery must remain possible even when stale cookies disagree.
  if (req.path === "/auth/signout") {
    next();
    return;
  }
  if (hasMixedTenantCookies(req)) {
    res.status(401).json({ error: "Conflicting firm sessions. Please sign in again." });
    return;
  }
  const staffIdentity = staffSessionIdentity(req);
  const managerIdentity = managerSessionIdentity(req);
  const continueInWorkspace = async (workspaceId: number): Promise<void> => {
    await runWithFirmWorkspace(workspaceId, async () => {
      // A password reset or demotion invalidates the manager cookie for every
      // endpoint, including manager-owned paralegal history, not only HR.
      if (managerIdentity && (await requireManagerSession(req)) == null) {
        clearManagerCookie(res);
        res.status(401).json({ error: "Manager session ended. Please sign in again." });
        return;
      }
      next();
    });
  };
  const identity = staffIdentity ?? managerIdentity;
  if (identity) {
    const ownerStaff = staffIdentity?.workspaceId === 0 && staffIdentity.userId === 0;
    const ownerManagerOnly = !staffIdentity && managerIdentity?.workspaceId === 0;
    if (ownerStaff || ownerManagerOnly) {
      await continueInWorkspace(0);
      return;
    }
    const [row] = await db
      .select()
      .from(firmAccessCodesTable)
      .where(eq(firmAccessCodesTable.id, identity.workspaceId));
    if (row && row.isActive && !isFirmAccessCodeExpired(row.expiresAt)) {
      // Refresh this device's seat on every request (keeps active devices
      // inside the 24h TTL); fail closed if the seat is gone and the code's
      // licensed seats are all held by other devices.
      if (row.maxSeats != null) {
        const claim = await claimSeat({
          portal: "firm",
          code: row.code,
          maxSeats: row.maxSeats,
          seatKey: deviceSeatKey(req),
        });
        if (!claim.ok) {
          res.status(401).json({ error: seatLimitMessage(claim.maxSeats) });
          return;
        }
      }
      await continueInWorkspace(identity.workspaceId);
      return;
    }
  }
  if (SESSION_PUBLIC_PATHS.has(req.path) && !staffIdentity && !managerIdentity) {
    // Session/logout report an unauthenticated state; manager/setup endpoints
    // still require a current staff subscription.
    if (req.path === "/auth/session" || req.path === "/auth/logout") {
      next();
      return;
    }
    if (req.path === "/auth/manager") {
      runWithFirmWorkspace(0, next);
      return;
    }
  }
  res.status(401).json({ error: "Authentication required." });
}

const router: IRouter = Router();
router.use((req, res, next) => {
  void sessionGate(req, res, next).catch(next);
});

// Floating dashboard virtual paralegal (chat + voice). Mounted behind the
// sessionGate above so the shared AI rate limiter inside always sees an
// authenticated request. Owner key is the per-login identity: the verified
// manager id, else the staff cookie's access-code row id (0 = master
// sentinel). Fails closed (null) when neither cookie is present/valid.
const paralegalRouter = Router();
attachVirtualParalegal({
  router: paralegalRouter,
  portal: "firm",
  portalLabel: "MyLawFirmAi",
  focus:
    "Law firm practice management — matters, clients, billing, deadlines, staff productivity and firm operations.",
  getOwnerKey: (req) => {
    const manager = managerSessionIdentity(req);
    if (manager) return manager.workspaceId === 0
      ? `mgr:${manager.userId}`
      : `ws:${manager.workspaceId}:mgr:${manager.userId}`;
    const staff = staffSessionIdentity(req);
    if (staff) return staff.workspaceId === 0
      ? "staff:0"
      : `ws:${staff.workspaceId}:staff:${staff.userId}`;
    return null;
  },
  pathPrefix: "",
});
router.use("/paralegal", paralegalRouter);

router.use(firmRoutes);

export default router;
