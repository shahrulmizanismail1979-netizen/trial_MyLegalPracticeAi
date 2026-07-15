import { Router, type IRouter, type Request } from "express";
import { ConfidentialClientApplication } from "@azure/msal-node";
import jwt from "jsonwebtoken";
import { and, eq } from "drizzle-orm";
import { db, microsoftLinks } from "@workspace/db";
import { logger } from "../lib/logger";

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

export async function saveLink(email: string, app: string, accessCode: string): Promise<void> {
  await db
    .insert(microsoftLinks)
    .values({ email: email.toLowerCase(), app, accessCode, active: true })
    .onConflictDoUpdate({
      target: [microsoftLinks.email, microsoftLinks.app],
      set: { accessCode, active: true, lastUsedAt: new Date() },
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
