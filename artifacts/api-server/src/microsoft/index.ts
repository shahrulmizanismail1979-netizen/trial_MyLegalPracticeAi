import { Router, type IRouter, type Request } from "express";
import { ConfidentialClientApplication } from "@azure/msal-node";
import jwt from "jsonwebtoken";
import { and, eq, sql as sqlOp } from "drizzle-orm";
import { db, microsoftLinks } from "@workspace/db";
import { logger } from "../lib/logger";
import { isMasterAccessCode } from "../lib/masterAccess";

// Fail closed in production: a predictable signing secret would let anyone
// forge SSO tickets.
const SECRET = (() => {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  return "dev-secret-change-me";
})();

const SCOPES = ["openid", "profile", "email", "User.Read"];
const TICKET_TTL = "10m";

// Where each portal's login page lives — the callback redirects here with a ticket.
export const APP_LOGIN_PATHS: Record<string, string> = {
  lit: "/mylitai/login",
  "lit-irac": "/mylitai-irac/",
  crim: "/mycrimai/login",
  corp: "/mycorplegalai/login",
  accident: "/myaccidentai/login",
  convey: "/myconveylitai/login",
  ccb: "/myccblitai/access",
  sya: "/mysyariahai/",
};

let msalClient: ConfidentialClientApplication | null = null;
function getMsal(): ConfidentialClientApplication | null {
  if (msalClient) return msalClient;
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  msalClient = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: "https://login.microsoftonline.com/common",
    },
  });
  return msalClient;
}

function baseUrl(req: Request): string {
  // Behind the Replit shared proxy; trust proxy is enabled in app.ts so
  // req.protocol reflects x-forwarded-proto.
  return `${req.protocol}://${req.get("host")}`;
}

// ---- Ticket helpers (used by the per-app SSO exchange routes) ----

export function signMsTicket(email: string, app: string): string {
  return jwt.sign({ typ: "ms_ticket", email, app }, SECRET, { expiresIn: TICKET_TTL });
}

export function verifyMsTicket(ticket: string, app: string): string | null {
  try {
    const decoded = jwt.verify(ticket, SECRET) as {
      typ?: string;
      email?: string;
      app?: string;
    };
    if (decoded.typ !== "ms_ticket" || decoded.app !== app) return null;
    return typeof decoded.email === "string" ? decoded.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export async function getLinkedCode(email: string, app: string): Promise<string | null> {
  const [link] = await db
    .select()
    .from(microsoftLinks)
    .where(
      and(
        eq(microsoftLinks.email, email.toLowerCase()),
        eq(microsoftLinks.app, app),
        eq(microsoftLinks.active, true),
      ),
    )
    .limit(1);
  if (!link) return null;
  void db
    .update(microsoftLinks)
    .set({ lastUsedAt: new Date() })
    .where(eq(microsoftLinks.id, link.id))
    .catch((err) => logger.error({ err }, "Failed to bump microsoft_links.last_used_at"));
  return link.accessCode;
}

/**
 * Returns the Microsoft email that "owns" an access code, or null if the code
 * is unbound. Ownership is global across apps: the first Microsoft account to
 * link a code claims it everywhere (the same MLPA code is synced to every
 * portal). The master code is never bound.
 */
export async function getCodeOwnerEmail(accessCode: string): Promise<string | null> {
  const code = accessCode.trim();
  if (!code) return null;
  if (isMasterAccessCode(code)) return null;
  const [link] = await db
    .select({ email: microsoftLinks.email })
    .from(microsoftLinks)
    .where(
      and(
        sqlOp`lower(${microsoftLinks.accessCode}) = lower(${code})`,
        eq(microsoftLinks.active, true),
      ),
    )
    .limit(1);
  return link ? link.email.toLowerCase() : null;
}

/**
 * For SSO logins: null if this Microsoft email may use the code, otherwise a
 * user-facing error message (the code belongs to a different Microsoft
 * account).
 */
export async function ssoBindingError(email: string, accessCode: string): Promise<string | null> {
  const owner = await getCodeOwnerEmail(accessCode);
  if (owner && owner !== email.toLowerCase()) {
    return `This access code is linked to a different Microsoft account (${maskEmail(owner)}).`;
  }
  return null;
}

/**
 * For plain access-code logins: once a code has been linked to a Microsoft
 * account, only that account may use it — the code alone is no longer enough.
 */
export async function codeLoginBindingError(accessCode: string): Promise<string | null> {
  const owner = await getCodeOwnerEmail(accessCode);
  if (owner) {
    return `This access code is linked to a Microsoft account (${maskEmail(owner)}). Please use "Sign in with Microsoft".`;
  }
  return null;
}

/**
 * Masked hint for the owning email, safe to show on a login error, e.g.
 * "a•••@contoso.com".
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "•••";
  return `${(local ?? "").slice(0, 1)}•••@${domain}`;
}

/**
 * Links a Microsoft email to an access code. Fails (returns the current
 * owner's email) when the code is already bound to a different Microsoft
 * account — a code belongs exclusively to the first email that links it.
 */
export async function saveLink(
  email: string,
  app: string,
  accessCode: string,
): Promise<{ ok: true } | { ok: false; ownerEmail: string }> {
  // The owner override is an operator credential, never a subscriber identity.
  // Do not persist it in the Microsoft binding table.
  if (isMasterAccessCode(accessCode)) return { ok: true };
  const normalized = email.toLowerCase();
  return db.transaction(async (tx) => {
    // Serialize competing claims on the same code: two users racing to link
    // an unbound code would otherwise both pass the ownership check.
    await tx.execute(
      sqlOp`SELECT pg_advisory_xact_lock(hashtext('ms_code_claim:' || lower(${accessCode.trim()})))`,
    );
    const [link] = await tx
      .select({ email: microsoftLinks.email })
      .from(microsoftLinks)
      .where(
        and(
          sqlOp`lower(${microsoftLinks.accessCode}) = lower(${accessCode.trim()})`,
          eq(microsoftLinks.active, true),
        ),
      )
      .limit(1);
    const owner = link ? link.email.toLowerCase() : null;
    if (owner && owner !== normalized) {
      return { ok: false as const, ownerEmail: owner };
    }
    await tx
      .insert(microsoftLinks)
      .values({ email: normalized, app, accessCode, active: true })
      .onConflictDoUpdate({
        target: [microsoftLinks.email, microsoftLinks.app],
        set: { accessCode, active: true, lastUsedAt: new Date() },
      });
    return { ok: true as const };
  });
}

// ---- OAuth routes (mounted at /auth) ----

const router: IRouter = Router();

// Step 1: portal sends the user here; we bounce them to the Microsoft login page.
router.get("/microsoft/login", async (req, res) => {
  const app = String(req.query.app ?? "");
  if (!APP_LOGIN_PATHS[app]) {
    res.status(400).send("Unknown app");
    return;
  }
  const msal = getMsal();
  if (!msal) {
    res.status(503).send("Microsoft sign-in is not configured");
    return;
  }
  try {
    const state = jwt.sign({ typ: "ms_state", app }, SECRET, { expiresIn: "15m" });
    const url = await msal.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: `${baseUrl(req)}/auth/callback`,
      state,
      // Always show the Microsoft account picker so users can switch to a
      // different Microsoft account after logging out of a portal.
      prompt: "select_account",
    });
    res.redirect(url);
  } catch (err) {
    req.log.error({ err }, "Failed to build Microsoft auth URL");
    res.status(500).send("Microsoft sign-in failed to start");
  }
});

// Step 2: Microsoft redirects back here with a code.
router.get("/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";

  let app = "";
  try {
    const state = jwt.verify(stateRaw, SECRET) as { typ?: string; app?: string };
    if (state.typ === "ms_state" && typeof state.app === "string") app = state.app;
  } catch {
    // fallthrough — handled below
  }

  const loginPath = APP_LOGIN_PATHS[app];
  if (!loginPath) {
    res.status(400).send("Invalid sign-in state. Please start again from the app's login page.");
    return;
  }

  const fail = (reason: string) => {
    res.redirect(`${loginPath}?ms_error=${encodeURIComponent(reason)}`);
  };

  if (typeof req.query.error === "string") {
    fail(String(req.query.error_description ?? req.query.error));
    return;
  }
  if (!code) {
    fail("Missing authorization code");
    return;
  }
  const msal = getMsal();
  if (!msal) {
    fail("Microsoft sign-in is not configured");
    return;
  }

  try {
    const result = await msal.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: `${baseUrl(req)}/auth/callback`,
    });
    const email = result.account?.username?.toLowerCase();
    if (!email) {
      fail("Microsoft did not return an email address");
      return;
    }

    const linkedCode = await getLinkedCode(email, app);
    const ticket = signMsTicket(email, app);
    const params = new URLSearchParams({
      ms_ticket: ticket,
      ms_linked: linkedCode ? "1" : "0",
      ms_email: email,
    });
    res.redirect(`${loginPath}?${params.toString()}`);
  } catch (err) {
    req.log.error({ err }, "Microsoft token exchange failed");
    fail("Microsoft sign-in failed. Please try again.");
  }
});

export default router;
