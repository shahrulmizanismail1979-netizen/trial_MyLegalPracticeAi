import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, firmAccessCodesTable, isFirmAccessCodeExpired } from "./db";
import {
  staffSessionCodeId,
  hasManagerCookie,
} from "./lib/managerSession";
import { claimSeat, deviceSeatKey, seatLimitMessage } from "../lib/seatLimits";
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
  "/auth/session",
  "/healthz",
]);

async function sessionGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (SESSION_PUBLIC_PATHS.has(req.path)) {
    next();
    return;
  }
  if (hasManagerCookie(req)) {
    next();
    return;
  }
  const codeId = staffSessionCodeId(req);
  if (codeId != null) {
    if (codeId === 0) {
      // Master-code / manager-granted staff session — no code row to re-check.
      next();
      return;
    }
    const [row] = await db
      .select()
      .from(firmAccessCodesTable)
      .where(eq(firmAccessCodesTable.id, codeId));
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
      next();
      return;
    }
  }
  res.status(401).json({ error: "Authentication required." });
}

const router: IRouter = Router();
router.use((req, res, next) => {
  void sessionGate(req, res, next);
});
router.use(firmRoutes);

export default router;
