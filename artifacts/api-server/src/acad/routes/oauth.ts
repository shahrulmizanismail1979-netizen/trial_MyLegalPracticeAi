import { Router, type Request, type Response } from "express";
import { randomBytes, randomUUID } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/acad";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router: Router = Router();

declare module "express-session" {
  interface SessionData {
    oauthState?: string;
    oauthProvider?: "google";
    oauthNext?: string;
  }
}

type ProviderId = "google";

interface ProviderSpec {
  id: ProviderId;
  clientIdEnv: string;
  clientSecretEnv: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
  fetchProfile: (
    accessToken: string,
    idToken: string | undefined,
  ) => Promise<{ sub: string; email: string; name: string } | null>;
}

async function fetchGoogleProfile(
  accessToken: string,
): Promise<{ sub: string; email: string; name: string } | null> {
  const r = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  const j = (await r.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!j.sub || !j.email || j.email_verified === false) return null;
  return { sub: j.sub, email: j.email.toLowerCase(), name: j.name ?? j.email };
}

const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  google: {
    id: "google",
    clientIdEnv: "GOOGLE_OAUTH_CLIENT_ID",
    clientSecretEnv: "GOOGLE_OAUTH_CLIENT_SECRET",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    fetchProfile: fetchGoogleProfile,
  },
};

function computeRedirectUri(req: Request, provider: ProviderId): string {
  // Trust proxy is on (see app.ts), so req.protocol and req.get('host') reflect
  // the public-facing origin the browser sees. The api-server is mounted under
  // /api by the artifact proxy, so callbacks live at /api/auth/oauth/...
  const host = req.get("host");
  const proto = req.protocol;
  return `${proto}://${host}/api/acad/auth/oauth/${provider}/callback`;
}

function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  // Only allow same-origin paths; never let an attacker bounce the user to
  // an external URL after login.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

router.get(
  "/auth/oauth/:provider/start",
  async (req: Request, res: Response): Promise<void> => {
    const provider = req.params["provider"] as ProviderId | undefined;
    if (!provider || !(provider in PROVIDERS)) {
      res.status(404).send("Unknown provider");
      return;
    }
    const spec = PROVIDERS[provider];
    const clientId = process.env[spec.clientIdEnv];
    if (!clientId) {
      res
        .status(503)
        .send(
          `${provider} sign-in is not configured yet. Ask the administrator to set ${spec.clientIdEnv}.`,
        );
      return;
    }

    const state = randomBytes(24).toString("hex");
    const next = safeNext(req.query["next"]);
    req.session.oauthState = state;
    req.session.oauthProvider = provider;
    req.session.oauthNext = next;

    const url = new URL(spec.authUrl);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", computeRedirectUri(req, provider));
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", spec.scope);
    url.searchParams.set("state", state);
    if (provider === "google") {
      url.searchParams.set("access_type", "online");
      url.searchParams.set("include_granted_scopes", "true");
      url.searchParams.set("prompt", "select_account");
    }

    res.redirect(url.toString());
  },
);

router.get(
  "/auth/oauth/:provider/callback",
  async (req: Request, res: Response): Promise<void> => {
    const provider = req.params["provider"] as ProviderId | undefined;
    if (!provider || !(provider in PROVIDERS)) {
      res.status(404).send("Unknown provider");
      return;
    }
    const spec = PROVIDERS[provider];

    const stateFromQuery = String(req.query["state"] ?? "");
    const code = String(req.query["code"] ?? "");
    const errorParam = req.query["error"];
    const sessionState = req.session.oauthState;
    const sessionProvider = req.session.oauthProvider;
    const next = safeNext(req.session.oauthNext);

    // Always clear the one-shot OAuth handshake state.
    delete req.session.oauthState;
    delete req.session.oauthProvider;
    delete req.session.oauthNext;

    if (errorParam) {
      res.redirect(
        `/studio/login?oauth_error=${encodeURIComponent(String(errorParam))}`,
      );
      return;
    }
    if (
      !code ||
      !stateFromQuery ||
      !sessionState ||
      sessionState !== stateFromQuery ||
      sessionProvider !== provider
    ) {
      res.redirect("/studio/login?oauth_error=bad_state");
      return;
    }

    const clientId = process.env[spec.clientIdEnv];
    const clientSecret = process.env[spec.clientSecretEnv];
    if (!clientId || !clientSecret) {
      res.redirect("/studio/login?oauth_error=not_configured");
      return;
    }

    let accessToken: string;
    let idToken: string | undefined;
    try {
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: computeRedirectUri(req, provider),
      });
      const tokenResp = await fetch(spec.tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body,
      });
      if (!tokenResp.ok) {
        const text = await tokenResp.text();
        logger.warn(
          { provider, status: tokenResp.status, body: text.slice(0, 200) },
          "oauth token exchange failed",
        );
        res.redirect("/studio/login?oauth_error=token_exchange");
        return;
      }
      const tokenJson = (await tokenResp.json()) as {
        access_token?: string;
        id_token?: string;
      };
      if (!tokenJson.access_token) {
        res.redirect("/studio/login?oauth_error=no_access_token");
        return;
      }
      accessToken = tokenJson.access_token;
      idToken = tokenJson.id_token;
    } catch (err) {
      logger.error({ err, provider }, "oauth token exchange threw");
      res.redirect("/studio/login?oauth_error=network");
      return;
    }

    const profile = await spec.fetchProfile(accessToken, idToken);
    if (!profile) {
      res.redirect("/studio/login?oauth_error=profile_unavailable");
      return;
    }

    // Find-or-create the user. Match first by the stable OAuth subject ID
    // (immune to the user later changing their email at the provider), then
    // fall back to the provider-verified email so an existing email/password
    // user can also sign in with Google using the same address. Google's
    // email_verified is enforced in fetchGoogleProfile, so a matching email is
    // proof of mailbox ownership — this cannot be used to hijack another
    // account.
    const bySubject = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.oauthProvider, provider),
          eq(usersTable.oauthSubject, profile.sub),
        ),
      )
      .limit(1);
    let user = bySubject[0];
    if (!user) {
      const byEmail = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.email, profile.email))
        .limit(1);
      user = byEmail[0];
    }

    if (user && user.status !== "active") {
      res.redirect("/studio/login?oauth_error=suspended");
      return;
    }

    if (!user) {
      const inserted = await db
        .insert(usersTable)
        .values({
          id: randomUUID(),
          email: profile.email,
          name: profile.name,
          passwordHash: null,
          oauthProvider: provider,
          oauthSubject: profile.sub,
          role: "teacher",
          status: "active",
        })
        .returning();
      user = inserted[0]!;
    } else if (!user.oauthProvider) {
      // First time this local user signs in with social — record the link
      // so we can show "uses Google sign-in" hints next time.
      await db
        .update(usersTable)
        .set({ oauthProvider: provider, oauthSubject: profile.sub })
        .where(eq(usersTable.id, user.id));
    }

    await regenerateSession(req);
    req.session.acadUserId = user.id;

    // Stripe sync: if the user has no active paid subscription yet, send them
    // to /billing so they go through the same Stripe purchase flow as
    // email/password users. Otherwise honour their original `next` target.
    const tier = user.subscriptionTier ?? "free";
    const needsPurchase = tier === "free";
    const dest = needsPurchase ? "/billing?welcome=oauth" : next;
    res.redirect(dest);
  },
);

export default router;
