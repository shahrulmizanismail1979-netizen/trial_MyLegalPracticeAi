import { Router, type IRouter } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
  firmAccessCodesTable,
  firmWorkspaceCredentialsTable,
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
  clearStaffCookie,
  staffSessionIdentity,
  managerSessionIdentity,
} from "../lib/managerSession";
import { isMasterCode } from "../lib/masterCode";
import { currentFirmWorkspaceId, firmScope, firmValues } from "../lib/workspace";
import { claimSeat, deviceSeatKey, seatLimitMessage } from "../../lib/seatLimits";
import { sendEmail } from "../../lib/mailer";

const router: IRouter = Router();
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again later." },
});
const setupSendLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: () => `firm-manager-setup:${currentFirmWorkspaceId()}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many verification emails requested. Please try again later." },
});
const setupVerifyLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: () => `firm-manager-verify:${currentFirmWorkspaceId()}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Please try again later." },
});
router.post("/auth/staff", loginLimit);
router.post("/auth/manager", loginLimit);
router.post("/auth/manager/setup/send", setupSendLimit);
router.post("/auth/manager/setup/verify", setupVerifyLimit);

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
    clearManagerCookie(res);
    setStaffCookie(res, 0);
    res.json({ ...StaffLoginResponse.parse({ staff: true, manager: false }), workspaceId: 0 });
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

  // Team-bundle seat limit: distinct concurrent devices per code. The staff
  // cookie has no server-side session, so the seat is keyed by a device
  // fingerprint and expires after inactivity.
  if (row.maxSeats != null) {
    const claim = await claimSeat({
      portal: "firm",
      code: row.code,
      maxSeats: row.maxSeats,
      seatKey: deviceSeatKey(req),
    });
    if (!claim.ok) {
      res.status(409).json({ error: seatLimitMessage(claim.maxSeats) });
      return;
    }
  }

  // Switching firms must also discard an old manager identity.
  clearManagerCookie(res);
  setStaffCookie(res, row.id, row.id);
  res.json({ ...StaffLoginResponse.parse({ staff: true, manager: false }), workspaceId: row.id });
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

  const password = parsed.data.passcode;
  const ownerLogin = isMasterCode(password.trim());
  const staffIdentity = staffSessionIdentity(req);
  if (ownerLogin && staffIdentity && staffIdentity.workspaceId !== 0) {
    res.status(409).json({ error: "Sign out of the current firm before using the owner credential." });
    return;
  }
  const workspaceId = ownerLogin ? 0 : staffIdentity?.workspaceId;
  if (workspaceId == null || (!ownerLogin && workspaceId === 0)) {
    res.status(401).json({ error: "Enter this firm's staff access code first." });
    return;
  }

  let credentialVersion: number | undefined;
  if (!ownerLogin) {
    const [credential] = await db
      .select()
      .from(firmWorkspaceCredentialsTable)
      .where(eq(firmWorkspaceCredentialsTable.workspaceId, workspaceId))
      .limit(1);
    if (!credential?.passwordHash) {
      res.status(401).json({ error: "Manager password is not set. Use Set/reset manager password." });
      return;
    }
    if (!(await bcrypt.compare(password, credential.passwordHash))) {
      res.status(401).json({ error: "Incorrect password." });
      return;
    }
    credentialVersion = credential.credentialVersion;
  }

  let [manager] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.role, "manager"), eq(usersTable.activeStatus, true), firmScope(usersTable)))
    .orderBy(asc(usersTable.id))
    .limit(1);

  // Bootstrap: on a fresh install (e.g. production right after first publish)
  // there is no manager row yet. The master code is the owner's credential,
  // so create the first manager account automatically instead of locking the
  // owner out of the portal.
  if (!manager) {
    manager = await db.transaction(async (tx) => {
      // Advisory lock serialises concurrent first-login bootstraps so only
      // one manager row is ever created.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('firm_manager_bootstrap'))`);
      const [existing] = await tx
        .select()
        .from(usersTable)
        .where(and(eq(usersTable.role, "manager"), eq(usersTable.activeStatus, true), firmScope(usersTable)))
        .orderBy(asc(usersTable.id))
        .limit(1);
      if (existing) return existing;
      const [created] = await tx
        .insert(usersTable)
        .values({
          ...firmValues(),
          name: "Managing Partner",
          role: "manager",
          email: "manager@mylawfirmai.local",
          activeStatus: true,
        })
        .returning();
      return created;
    });
  }

  if (!manager) {
    res.status(401).json({ error: "No manager account is available." });
    return;
  }

  // A manager is also a staff member, so issue both cookies. This keeps the
  // staff session alive when the manager later "exits manager mode" (which
  // clears only the manager cookie).
  setManagerCookie(res, manager.id, workspaceId, credentialVersion);
  if (ownerLogin) setStaffCookie(res, 0, 0);
  res.json(
    { ...ManagerLoginResponse.parse({ manager: true, staff: true, user: manager }), workspaceId },
  );
});

function challengeDigest(nonce: string, code: string): string {
  return crypto.createHash("sha256").update(`${nonce}:${code}`).digest("hex");
}

router.post("/auth/manager/setup/send", async (req, res): Promise<void> => {
  const workspaceId = currentFirmWorkspaceId();
  if (workspaceId === 0) {
    res.status(400).json({ error: "The owner account uses the master credential." });
    return;
  }
  const [firm] = await db
    .select({ email: firmAccessCodesTable.customerEmail })
    .from(firmAccessCodesTable)
    .where(eq(firmAccessCodesTable.id, workspaceId))
    .limit(1);
  const email = firm?.email?.trim();
  if (!email) {
    res.status(409).json({ error: "No registered firm email is available. Please contact the account owner." });
    return;
  }
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const nonce = crypto.randomBytes(24).toString("hex");
  const issued = await db
    .insert(firmWorkspaceCredentialsTable)
    .values({
      workspaceId,
      challengeHash: challengeDigest(nonce, code),
      challengeNonce: nonce,
      challengeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      challengeAttempts: 0,
      challengeConsumedAt: null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: firmWorkspaceCredentialsTable.workspaceId,
      set: {
        challengeHash: challengeDigest(nonce, code),
        challengeNonce: nonce,
        challengeExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        challengeAttempts: 0,
        challengeConsumedAt: null,
        updatedAt: new Date(),
      },
      setWhere: sql`${firmWorkspaceCredentialsTable.updatedAt} < now() - interval '1 minute'`,
    })
    .returning({ workspaceId: firmWorkspaceCredentialsTable.workspaceId });
  if (!issued.length) {
    res.status(429).json({ error: "Please wait a minute before requesting another verification code." });
    return;
  }
  const sent = await sendEmail({
    to: email,
    subject: "MyLawFirmAi manager password verification code",
    html: `<p>Your MyLawFirmAi manager verification code is <strong>${code}</strong>.</p><p>It expires in 15 minutes. If you did not request this, ignore this email.</p>`,
  });
  if (!sent) {
    res.status(503).json({ error: "The verification email could not be delivered. Please try again." });
    return;
  }
  res.json({ sent: true });
});

router.post("/auth/manager/setup/verify", async (req, res): Promise<void> => {
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!/^\d{6}$/.test(code) || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    res.status(400).json({ error: "Enter the 6-digit code and a password of at least 12 characters (at most 72 UTF-8 bytes)." });
    return;
  }
  const workspaceId = currentFirmWorkspaceId();
  if (workspaceId === 0) {
    res.status(400).json({ error: "The owner account uses the master credential." });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM firm_workspace_credentials WHERE workspace_id = ${workspaceId} FOR UPDATE`);
    const [credential] = await tx
      .select()
      .from(firmWorkspaceCredentialsTable)
      .where(eq(firmWorkspaceCredentialsTable.workspaceId, workspaceId))
      .limit(1);
    if (!credential?.challengeHash || !credential.challengeNonce) return "missing";
    if (credential.challengeConsumedAt) return "used";
    if (!credential.challengeExpiresAt || credential.challengeExpiresAt.getTime() <= Date.now()) return "expired";
    if (credential.challengeAttempts >= 5) return "attempts";
    const actual = Buffer.from(challengeDigest(credential.challengeNonce, code), "hex");
    const expected = Buffer.from(credential.challengeHash, "hex");
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
      await tx
        .update(firmWorkspaceCredentialsTable)
        .set({ challengeAttempts: credential.challengeAttempts + 1, updatedAt: new Date() })
        .where(eq(firmWorkspaceCredentialsTable.workspaceId, workspaceId));
      return "invalid";
    }
    await tx
      .update(firmWorkspaceCredentialsTable)
      .set({
        passwordHash,
        credentialVersion: credential.credentialVersion + 1,
        challengeConsumedAt: new Date(),
        challengeHash: null,
        challengeNonce: null,
        updatedAt: new Date(),
      })
      .where(eq(firmWorkspaceCredentialsTable.workspaceId, workspaceId));
    return "ok";
  });
  if (result !== "ok") {
    const exhausted = result === "attempts";
    res.status(400).json({
      error: exhausted
        ? "Too many attempts. Request a new verification code."
        : result === "expired"
          ? "The verification code has expired. Request a new code."
          : "The verification code is invalid or already used.",
    });
    return;
  }
  // Password reset invalidates this browser's old manager cookie immediately;
  // credentialVersion invalidates every other outstanding manager cookie.
  clearManagerCookie(res);
  res.json({ updated: true });
});

// "Exit manager mode" — clears only the manager cookie. The staff session (if
// present) survives, so the user stays signed in to the app as staff.
router.post("/auth/logout", async (req, res): Promise<void> => {
  clearManagerCookie(res);
  res.json(
    ManagerLogoutResponse.parse({ manager: false, staff: staffSessionIdentity(req) != null }),
  );
});

router.post("/auth/signout", async (_req, res): Promise<void> => {
  clearManagerCookie(res);
  clearStaffCookie(res);
  res.json({ manager: false, staff: false });
});

router.get("/auth/session", async (req, res): Promise<void> => {
  const staffIdentity = staffSessionIdentity(req);
  const staff = staffIdentity != null;
  const workspaceId = staffIdentity?.workspaceId ?? managerSessionIdentity(req)?.workspaceId;
  const managerId = await requireManagerSession(req);
  if (managerId == null) {
    res.json({ ...GetManagerSessionResponse.parse({ manager: false, staff }), workspaceId });
    return;
  }

  const [manager] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, managerId), firmScope(usersTable)));

  if (!manager) {
    clearManagerCookie(res);
    res.json({ ...GetManagerSessionResponse.parse({ manager: false, staff }), workspaceId });
    return;
  }

  res.json(
    { ...GetManagerSessionResponse.parse({ manager: true, staff: true, user: manager }), workspaceId },
  );
});

export default router;
