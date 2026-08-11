import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/acad";
import { eq, sql } from "drizzle-orm";
import { claimSeat } from "../../lib/seatLimits";
import type { User } from "@workspace/db/acad";

const BCRYPT_COST = 10;

export type SafeUser = Omit<User, "passwordHash">;

export function toSafeUser(u: User): SafeUser {
  // Strip the password hash before sending to clients.
  const { passwordHash: _ignored, ...rest } = u;
  return rest;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * express-session stores arbitrary data on `req.session`. We only ever store
 * the user id so we can re-fetch the row (and pick up role/status changes
 * made by an admin) on every request.
 */
declare module "express-session" {
  interface SessionData {
    acadUserId?: string;
  }
}

function destroySessionAsync(req: Request): Promise<void> {
  return new Promise((resolve) => {
    if (!req.session) {
      resolve();
      return;
    }
    req.session.destroy(() => resolve());
  });
}

/** Look up the current user from the session. Returns null if no session, no
 * matching row, or the account has been suspended/deleted. In the suspended
 * and deleted cases we also destroy the session so the stale cookie can't be
 * silently re-used if the account is later reactivated. */
export async function getSessionUser(req: Request): Promise<User | null> {
  const userId = req.session?.acadUserId;
  if (!userId) return null;
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  const user = rows[0];
  if (!user) {
    await destroySessionAsync(req);
    return null;
  }
  if (user.status !== "active") {
    await destroySessionAsync(req);
    return null;
  }
  // Landing-page bundle accounts: re-check code expiry and (for capped
  // team bundles) refresh this session's seat on every request. Fails
  // CLOSED — a lost seat or a seat-registry error ends the session, so the
  // licensed cap can never be exceeded or bypassed during an outage.
  if (user.accessCode) {
    if (user.accessCodeExpiresAt && user.accessCodeExpiresAt < new Date()) {
      await destroySessionAsync(req);
      return null;
    }
    if (user.maxSeats != null) {
      try {
        const claim = await claimSeat({
          portal: "acad",
          code: user.accessCode,
          maxSeats: user.maxSeats,
          seatKey: req.sessionID,
        });
        if (!claim.ok) {
          await destroySessionAsync(req);
          return null;
        }
      } catch {
        return null;
      }
    }
  }
  return user;
}

/** Express middleware: any logged-in user. Attaches user to `res.locals`. */
export function requireUser() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    res.locals["user"] = user;
    next();
  };
}

/** teacher OR admin (anyone with a valid account). Same as requireUser today
 * because candidates have no account, but kept as a separate helper so the
 * intent is explicit at call sites. */
export const requireTeacher = requireUser;

/** admin-only. */
export function requireAdminUser() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (user.role !== "admin") {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    res.locals["user"] = user;
    next();
  };
}

/** Read the user already attached by `requireUser` / `requireAdminUser`. */
export function getRouteUser(res: Response): User {
  const user = res.locals["user"] as User | undefined;
  if (!user) {
    throw new Error(
      "getRouteUser called without requireUser middleware on the route",
    );
  }
  return user;
}

/** Count users to know whether we're bootstrapping the first admin. */
export async function userCount(): Promise<number> {
  const r = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(usersTable);
  return r[0]?.c ?? 0;
}
