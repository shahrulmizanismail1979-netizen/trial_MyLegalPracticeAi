import { Router, type IRouter, type Request, type Response } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { requireAuth, isStaffEmail } from "../middlewares/requireAdmin";

const router: IRouter = Router();

/**
 * GET /auth/me
 *
 * Returns the authenticated user's identity and whether they are an
 * allowlisted staff member. Requires authentication (401 otherwise), but
 * intentionally does NOT require staff so the client can distinguish
 * "signed in but not staff" (show access-denied) from "not signed in".
 */
router.get("/auth/me", requireAuth, async (req: Request, res: Response) => {
  const userId = req.authUserId ?? getAuth(req)?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(userId);
    const primary = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId,
    );
    const email =
      (primary ?? user.emailAddresses[0])?.emailAddress ?? null;

    res.json({
      userId,
      email,
      isStaff: isStaffEmail(email),
    });
  } catch (error) {
    req.log.error({ err: error, userId }, "Failed to load current user");
    res.status(500).json({ error: "Failed to load current user" });
  }
});

export default router;
