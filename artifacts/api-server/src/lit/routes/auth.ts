import { loginRateLimit } from "../../lib/loginRateLimit";
import {
  Router,
  type IRouter,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { db } from "@workspace/db";
import { litAccessCodes } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  litLawyesCredentials,
  litLawyesInvitations,
  litLawyesMembers,
} from "@workspace/db";
import { ensureLawyesMemberSchema } from "../lib/ensureLawyesMemberSchema";
import { claimSeat, releaseSeat, seatLimitMessage } from "../../lib/seatLimits";
import {
  verifyMsTicket,
  getLinkedCode,
  saveLink,
  ssoBindingError,
  codeLoginBindingError,
  maskEmail,
} from "../../microsoft";
import { isMasterAccessCode } from "../../lib/masterAccess";

const router: IRouter = Router();

// Never persist the owner credential itself. This stable synthetic tenant keeps
// owner-created work isolated from every paid subscriber and survives rotation
// of MASTER_ACCESS_CODE.
const MASTER_TENANT_CODE = "MASTER-OVERRIDE-LIT";
const LEGACY_MASTER_EMAIL = "master@mylitai.local";

type LoginResult = { ok: boolean; status: number; body: Record<string, unknown> };

const LAWYES_PERSONAL_CODE = /^LY-[A-Z0-9_-]{20}$/;
async function loginWithCode(req: Request, rawCode: string): Promise<LoginResult> {
  const code = rawCode.trim().toUpperCase();
  await ensureLawyesMemberSchema();

  const lookupHash = createHash("sha256").update(code).digest("hex");
  const [personal] = await db.select({
    credential: litLawyesCredentials,
    member: litLawyesMembers,
  }).from(litLawyesCredentials).innerJoin(
    litLawyesMembers,
    eq(litLawyesCredentials.memberId, litLawyesMembers.id),
  ).where(eq(litLawyesCredentials.codeLookupHash, lookupHash)).limit(1);
  if (personal && await bcrypt.compare(code, personal.credential.codeHash)) {
    if (personal.member.revokedAt) {
      return { ok: false, status: 401, body: { error: "Member access revoked" } };
    }
    const [tenant] = await db.select().from(litAccessCodes).where(and(
      eq(litAccessCodes.id, personal.member.accessCodeId),
      eq(litAccessCodes.status, "active"),
    )).limit(1);
    if (!tenant || (tenant.expiresAt && tenant.expiresAt < new Date())) {
      return { ok: false, status: 401, body: { error: "Invalid or expired access code" } };
    }
    if (tenant.maxSeats != null) {
      const claim = await claimSeat({
        portal: "lit", code: tenant.code, maxSeats: tenant.maxSeats, seatKey: req.sessionID,
      });
      if (!claim.ok) {
        return { ok: false, status: 409, body: { error: seatLimitMessage(claim.maxSeats) } };
      }
    }
    await db.update(litLawyesCredentials).set({ lastUsedAt: new Date() })
      .where(eq(litLawyesCredentials.id, personal.credential.id));
    await db.update(litLawyesInvitations).set({ acceptedAt: new Date() })
      .where(and(
        eq(litLawyesInvitations.memberId, personal.member.id),
        eq(litLawyesInvitations.accessCodeId, tenant.id),
      ));
    const sess = req.session as unknown as Record<string, unknown>;
    delete sess.lawyesGoogleSubject;
    sess.authenticated = true;
    sess.accessCodeId = tenant.id;
    sess.memberId = personal.member.id;
    return { ok: true, status: 200, body: { success: true, message: "Login successful" } };
  }

  if (isMasterAccessCode(rawCode)) {
    // Older deployments persisted the real owner credential as a normal
    // access-code row. Revoke those rows in place; retaining them as audit
    // records is safer than deleting them, and prevents rotation leftovers
    // from remaining usable.
    await db
      .update(litAccessCodes)
      .set({ status: "revoked", compedAccess: false })
      .where(and(
        eq(litAccessCodes.recipientEmail, LEGACY_MASTER_EMAIL),
        sql`${litAccessCodes.code} <> ${MASTER_TENANT_CODE}`,
      ));

    let [master] = await db
      .select()
      .from(litAccessCodes)
      .where(eq(litAccessCodes.code, MASTER_TENANT_CODE))
      .limit(1);

    if (!master) {
      [master] = await db
        .insert(litAccessCodes)
        .values({
          code: MASTER_TENANT_CODE,
          recipientName: "Master Override",
          recipientEmail: "owner-override@mylitai.local",
          status: "active",
          compedAccess: true,
          notes: "Master overriding access — full access without payment.",
        })
        .returning();
    } else if (master.status !== "active" || !master.compedAccess) {
      [master] = await db
        .update(litAccessCodes)
        .set({ status: "active", compedAccess: true, expiresAt: null })
        .where(eq(litAccessCodes.id, master.id))
        .returning();
    }

    await db
      .update(litAccessCodes)
      .set({
        lastUsedAt: new Date(),
        usageCount: master.usageCount + 1,
      })
      .where(eq(litAccessCodes.id, master.id));

    const sess = req.session as unknown as Record<string, unknown>;
    delete sess.lawyesGoogleSubject;
    sess.authenticated = true;
    sess.accessCodeId = master.id;
    delete sess.memberId;

    return { ok: true, status: 200, body: { success: true, message: "Login successful" } };
  }

  const [record] = await db
    .select()
    .from(litAccessCodes)
    .where(sql`upper(${litAccessCodes.code}) = ${code}`)
    .limit(1);

  // The synthetic tenant is for sessions created by the owner flow only; it
  // must never become a subscriber credential. Rows created by the former
  // implementation stored the master secret itself and are revoked in place
  // when encountered, so they cannot remain a backdoor after rotation.
  if (record?.code === MASTER_TENANT_CODE || record?.recipientEmail === LEGACY_MASTER_EMAIL) {
    if (record.recipientEmail === LEGACY_MASTER_EMAIL) {
      await db
        .update(litAccessCodes)
        .set({ status: "revoked", compedAccess: false })
        .where(eq(litAccessCodes.id, record.id));
    }
    return { ok: false, status: 401, body: { error: "Invalid or expired access code" } };
  }
  if (!record || record.status !== "active") {
    return { ok: false, status: 401, body: { error: "Invalid or expired access code" } };
  }

  if (record.expiresAt && record.expiresAt < new Date()) {
    await db
      .update(litAccessCodes)
      .set({ status: "expired" })
      .where(eq(litAccessCodes.id, record.id));
    return { ok: false, status: 401, body: { error: "Invalid or expired access code" } };
  }

  // Team-bundle seat limit: distinct concurrent sessions per code.
  if (record.maxSeats != null) {
    const claim = await claimSeat({
      portal: "lit",
      code: record.code,
      maxSeats: record.maxSeats,
      seatKey: req.sessionID,
    });
    if (!claim.ok) {
      return { ok: false, status: 409, body: { error: seatLimitMessage(claim.maxSeats) } };
    }
  }

  await db
    .update(litAccessCodes)
    .set({
      lastUsedAt: new Date(),
      usageCount: record.usageCount + 1,
    })
    .where(eq(litAccessCodes.id, record.id));

  const sess = req.session as unknown as Record<string, unknown>;
  delete sess.lawyesGoogleSubject;
  sess.authenticated = true;
  sess.accessCodeId = record.id;
  delete sess.memberId;

  return { ok: true, status: 200, body: { success: true, message: "Login successful" } };
}

router.post("/login", loginRateLimit, async (req, res) => {
  const { password } = req.body;

  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Access code is required" });
  }

  try {
    // Personal member credentials never enter the legacy Microsoft binding
    // table, which stores access codes as text.
    const normalized = password.trim().toUpperCase();
    const bindErr = LAWYES_PERSONAL_CODE.test(normalized)
      ? null
      : await codeLoginBindingError(password);
    if (bindErr) {
      return res.status(403).json({ error: bindErr });
    }
    const result = await loginWithCode(req, password);
    return res.status(result.status).json(result.body);
  } catch (err) {
    req.log.error({ err }, "Login error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Microsoft SSO exchange: the portal posts the ticket from /auth/callback here.
// If the Microsoft email is already linked to an access code, log straight in.
// Otherwise the portal collects the access code once and posts it with the
// ticket to create the link.
router.post("/sso", loginRateLimit, async (req, res) => {
  const { ticket, code } = (req.body ?? {}) as { ticket?: string; code?: string };
  if (!ticket || typeof ticket !== "string") {
    return res.status(400).json({ error: "Ticket is required" });
  }

  // Both MyLitAI ("lit") and MyLitAI IRAC ("lit-irac") share this session, so
  // accept tickets issued for either app and keep links scoped per app.
  let app = "lit";
  let email = verifyMsTicket(ticket, "lit");
  if (!email) {
    app = "lit-irac";
    email = verifyMsTicket(ticket, "lit-irac");
  }
  if (!email) {
    return res.status(401).json({ error: "Your Microsoft sign-in expired. Please try again." });
  }

  try {
    await ensureLawyesMemberSchema();
    const providedCode = typeof code === "string" ? code.trim() : "";
    const codeToUse = providedCode || (await getLinkedCode(email, app));
    if (!codeToUse) {
      return res.status(404).json({ needsLink: true });
    }
    if (LAWYES_PERSONAL_CODE.test(codeToUse.toUpperCase())) {
      return res.status(400).json({
        error: "Personal LAWYes codes cannot be linked to Microsoft. Sign in with the personal code instead.",
      });
    }

    const bindErr = await ssoBindingError(email, codeToUse);
    if (bindErr) {
      return res.status(403).json({ error: bindErr });
    }

    if (providedCode && !isMasterAccessCode(providedCode)) {
      const claim = await saveLink(email, app, providedCode.toUpperCase());
      if (!claim.ok) {
        return res.status(403).json({
          error: `This access code is linked to a different Microsoft account (${maskEmail(claim.ownerEmail)}).`,
        });
      }
    }
    const result = await loginWithCode(req, codeToUse);
    return res.status(result.status).json(result.body);
  } catch (err) {
    req.log.error({ err }, "SSO exchange error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/verify", async (req, res) => {
  const sess = req.session as unknown as Record<string, unknown>;
  const authenticated = sess?.authenticated === true;
  const accessCodeId = sess?.accessCodeId as number | undefined;

  if (!authenticated || !accessCodeId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const [record] = await db
      .select()
      .from(litAccessCodes)
      .where(eq(litAccessCodes.id, accessCodeId))
      .limit(1);

    if (!record || record.status !== "active") {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Access code revoked or expired" });
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      await db
        .update(litAccessCodes)
        .set({ status: "expired" })
        .where(eq(litAccessCodes.id, record.id));
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Access code expired" });
    }

    const memberId = sess?.memberId as number | undefined;
    if (memberId) {
      await ensureLawyesMemberSchema();
      const [member] = await db.select({ id: litLawyesMembers.id })
        .from(litLawyesMembers).where(and(
          eq(litLawyesMembers.id, memberId),
          eq(litLawyesMembers.accessCodeId, accessCodeId),
          sql`${litLawyesMembers.revokedAt} IS NULL`,
        )).limit(1);
      if (!member) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "Member access revoked" });
      }
    }

    // Refresh this session's seat so an active session cannot age out of the
    // inactivity TTL, and fail closed if its seat has been lost.
    if (record.maxSeats != null) {
      const claim = await claimSeat({
        portal: "lit",
        code: record.code,
        maxSeats: record.maxSeats,
        seatKey: req.sessionID,
      });
      if (!claim.ok) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: seatLimitMessage(claim.maxSeats) });
      }
    }

    return res.json({ authenticated: true });
  } catch (err) {
    req.log.error({ err }, "Verify error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  void releaseSeat("lit", req.sessionID);
  req.session.destroy(() => {
    res.json({ message: "Logged out successfully" });
  });
});

/**
 * Express middleware that enforces Lit session authentication and binds the
 * caller's access code ID to res.locals.litAccessCodeId for downstream use
 * (Task #21 — subscriber chat isolation).
 *
 * Re-checks the DB on every request (portal-expiry-enforcement: sessions and
 * JWTs may outlive access codes, so expiry must be verified per-request).
 */
export async function requireLitAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sess = req.session as unknown as Record<string, unknown>;
  const authenticated = sess?.authenticated === true;
  const accessCodeId = sess?.accessCodeId as number | undefined;

  if (!authenticated || !accessCodeId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (await validateLitSession(req, res, accessCodeId)) next();
}

/**
 * Router-level gate for ALL lit routes: any request carrying an
 * authenticated code session gets the same per-request revocation/expiry/
 * seat checks as requireLitAuth, no matter which route it hits. Requests
 * without an authenticated session pass through untouched (public routes
 * and per-route auth keep working).
 */
export async function litSessionGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const sess = req.session as unknown as Record<string, unknown>;
  const authenticated = sess?.authenticated === true;
  const accessCodeId = sess?.accessCodeId as number | undefined;
  if (!authenticated || !accessCodeId) {
    next();
    return;
  }
  if (await validateLitSession(req, res, accessCodeId)) next();
}

/**
 * Shared per-request session validation: code must exist, be active and
 * unexpired, and (for capped team-bundle codes) this session must hold a
 * seat — the claim doubles as an activity refresh so active sessions never
 * age out of the inactivity TTL. Sends the error response and returns false
 * on failure.
 */
async function validateLitSession(
  req: Request,
  res: Response,
  accessCodeId: number,
): Promise<boolean> {
  try {
    const [record] = await db
      .select()
      .from(litAccessCodes)
      .where(eq(litAccessCodes.id, accessCodeId))
      .limit(1);

    if (!record || record.status !== "active") {
      req.session.destroy(() => {});
      res.status(401).json({ error: "Access code revoked or expired" });
      return false;
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      await db
        .update(litAccessCodes)
        .set({ status: "expired" })
        .where(eq(litAccessCodes.id, record.id));
      req.session.destroy(() => {});
      res.status(401).json({ error: "Access code expired" });
      return false;
    }

    const memberId = (req.session as unknown as { memberId?: number }).memberId;
    if (memberId) {
      await ensureLawyesMemberSchema();
      const [member] = await db.select().from(litLawyesMembers).where(and(
        eq(litLawyesMembers.id, memberId),
        eq(litLawyesMembers.accessCodeId, accessCodeId),
      )).limit(1);
      if (!member || member.revokedAt) {
        req.session.destroy(() => {});
        res.status(401).json({ error: "Member access revoked" });
        return false;
      }
      res.locals["litMemberId"] = member.id;
      res.locals["litMemberRole"] = member.role;
    }

    // Refresh (or fail-closed re-check) this session's seat on every
    // authenticated request so active devices never age out of the 24h
    // inactivity TTL, and a session whose seat was lost stops working.
    if (record.maxSeats != null) {
      const claim = await claimSeat({
        portal: "lit",
        code: record.code,
        maxSeats: record.maxSeats,
        seatKey: req.sessionID,
      });
      if (!claim.ok) {
        req.session.destroy(() => {});
        res.status(401).json({ error: seatLimitMessage(claim.maxSeats) });
        return false;
      }
    }

    res.locals["litAccessCodeId"] = accessCodeId;
    return true;
  } catch (err) {
    req.log?.error({ err }, "lit session validation failed");
    res.status(500).json({ error: "Internal server error" });
  }
  return false;
}

export default router;
