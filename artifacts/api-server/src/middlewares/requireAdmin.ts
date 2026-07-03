import type { Request, Response, NextFunction } from "express";
import { getAuth, clerkClient } from "@clerk/express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUserId?: string;
      authEmail?: string | null;
    }
  }
}

/**
 * Parse the ADMIN_ALLOWED_EMAILS env var into a lowercased set of allowed
 * staff emails. Fails closed: when unset/empty, nobody is authorized.
 */
function getAllowedEmails(): Set<string> {
  const raw = process.env.ADMIN_ALLOWED_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

export function isStaffEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAllowedEmails().has(email.trim().toLowerCase());
}

/**
 * Resolve the primary email address for an authenticated Clerk user.
 * Returns null when it cannot be determined.
 */
async function resolveUserEmail(userId: string): Promise<string | null> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId,
  );
  return (primary ?? user.emailAddresses[0])?.emailAddress ?? null;
}

/**
 * Require an authenticated Clerk session. Responds 401 when absent.
 * On success, attaches `authUserId` to the request.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.authUserId = userId;
  next();
}

/**
 * Require the authenticated user to be an allowlisted staff member.
 * Responds 401 when unauthenticated, 403 when authenticated but not staff.
 * Must run after `requireAuth` (or a middleware that sets `authUserId`).
 */
export async function requireStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.authUserId ?? getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const email = await resolveUserEmail(userId);
    req.authUserId = userId;
    req.authEmail = email;

    if (!isStaffEmail(email)) {
      req.log.warn({ userId, email }, "Non-staff user denied admin access");
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  } catch (error) {
    req.log.error({ err: error, userId }, "Failed to verify staff access");
    res.status(403).json({ error: "Forbidden" });
  }
}
