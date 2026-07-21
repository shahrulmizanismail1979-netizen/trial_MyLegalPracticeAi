import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  usersTable,
  firmAccessCodesTable,
  isFirmAccessCodeExpired,
} from "../db";
import {
  ManagerLoginBody,
  ManagerLoginResponse,
  ManagerLogoutResponse,
  GetManagerSessionResponse,
  StaffLoginBody,
  StaffLoginResponse,
} from "../apiZod";
import {
  setManagerCookie,
  clearManagerCookie,
  setStaffCookie,
  requireManagerSession,
  hasValidSession,
} from "../lib/managerSession";
import { isMasterCode } from "../lib/masterCode";

const router: IRouter = Router();

/**
 * Staff login. A staff member enters their portal access code (the same code
 * issued when they subscribe on the AI Web Books landing page and synced into
 * firm_access_codes), or the owner's master code. On success a signed httpOnly
 * staff session cookie is minted — the primary authentication gate for every
 * /api/firm route. For code-based sessions the cookie encodes the access-code
 * row id so the gate can re-check active/expiry status per request.
 */
router.post("/auth/staff", async (req, res): Promise<void> => {
  const parsed = StaffLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const code = parsed.data.passcode.trim();

  if (isMasterCode(code)) {
    setStaffCookie(res, 0);
    res.json(StaffLoginResponse.parse({ staff: true, manager: false }));
    return;
  }

  const [row] = await db
    .select()
    .from(firmAccessCodesTable)
    .where(eq(firmAccessCodesTable.code, code));

  if (!row || !row.isActive || isFirmAccessCodeExpired(row.expiresAt)) {
    res.status(401).json({ error: "Incorrect access code." });
    return;
  }

  setStaffCookie(res, row.id);
  res.json(StaffLoginResponse.parse({ staff: true, manager: false }));
});

/**
 * Manager login — the owner's master access code (MASTER_ACCESS_CODE) is the
 * only manager passcode, consistent with the other portals. Maps onto the
 * first active manager account.
 */
router.post("/auth/manager", async (req, res): Promise<void> => {
  const parsed = ManagerLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (!isMasterCode(parsed.data.passcode.trim())) {
    res.status(401).json({ error: "Incorrect passcode." });
    return;
  }

  let [manager] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.role, "manager"), eq(usersTable.activeStatus, true)))
    .orderBy(asc(usersTable.id))
    .limit(1);

  // Bootstrap: on a fresh install (e.g. production right after first publish)
  // there is no manager row yet. The master code is the owner's credential,
  // so create the first manager account automatically instead of locking the
  // owner out of the portal.
  if (!manager) {
    [manager] = await db
      .insert(usersTable)
      .values({
        name: "Managing Partner",
        role: "manager",
        email: "manager@mylawfirmai.local",
        activeStatus: true,
      })
      .returning();
  }

  if (!manager) {
    res.status(401).json({ error: "No manager account is available." });
    return;
  }

  // A manager is also a staff member, so issue both cookies. This keeps the
  // staff session alive when the manager later "exits manager mode" (which
  // clears only the manager cookie).
  setManagerCookie(res, manager.id);
  setStaffCookie(res, 0);
  res.json(
    ManagerLoginResponse.parse({ manager: true, staff: true, user: manager }),
  );
});

// "Exit manager mode" — clears only the manager cookie. The staff session (if
// present) survives, so the user stays signed in to the app as staff.
router.post("/auth/logout", async (req, res): Promise<void> => {
  clearManagerCookie(res);
  res.json(
    ManagerLogoutResponse.parse({ manager: false, staff: hasValidSession(req) }),
  );
});

router.get("/auth/session", async (req, res): Promise<void> => {
  const staff = hasValidSession(req);
  const managerId = await requireManagerSession(req);
  if (managerId == null) {
    res.json(GetManagerSessionResponse.parse({ manager: false, staff }));
    return;
  }

  const [manager] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, managerId));

  if (!manager) {
    clearManagerCookie(res);
    res.json(GetManagerSessionResponse.parse({ manager: false, staff }));
    return;
  }

  res.json(
    GetManagerSessionResponse.parse({ manager: true, staff: true, user: manager }),
  );
});

export default router;
