import express, { type Express } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { restoreMatterDownload } from "./lib/matterDownloadHandoff";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import microsoftRouter from "./microsoft";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { handleStripeEventForProvisioning } from "./lib/provisioning";
import { handleConveyStripeEvent } from "./lib/conveyStripe";
import { attachUser } from "./middlewares/conveyAuth";
import { resetLoginRateLimitForE2e } from "./lib/loginRateLimit";
import { invalidateCatalogPriceCache } from "./routes/stripe";
import { portalSignInSignalObserver } from "./lib/portalSignInSignals";

const app: Express = express();

// The API server sits behind the Replit shared reverse proxy — trust the
// first proxy hop so req.ip reflects the real client (used for rate limiting).
app.set("trust proxy", 1);

// Stripe webhook must be registered BEFORE express.json() so it receives the
// raw request body (a Buffer) required for signature verification.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature" });
      return;
    }

    // Peek at event type so we can log context on errors. Safe to do before
    // signature verification — we only use it for logging.
    let eventType: string | undefined;
    try {
      eventType = (JSON.parse((req.body as Buffer).toString("utf-8")) as { type?: string }).type;
    } catch { /* ignore — processWebhook will reject malformed bodies */ }

    const sig = Array.isArray(signature) ? signature[0] : signature;

    // ── Step 1: stripe-replit-sync DB sync (signature-verified) ──────────────
    // Swallow only the specific NOT NULL constraint error (pg error code 23502)
    // that stripe-replit-sync produces for `invoice.upcoming` events.  Stripe
    // sends these before every billing cycle; the "upcoming invoice" object has
    // id=null (it is a preview, not a real invoice), which violates the NOT NULL
    // constraint on stripe.invoices.  We cannot store it, but we must return 200
    // so Stripe stops retrying and does not mark our endpoint as failing — which
    // would block delivery of checkout.session.completed and other critical events.
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
    } catch (syncErr: unknown) {
      const pgCode = (syncErr as { code?: string }).code;
      if (pgCode === "23502") {
        // NOT NULL violation — almost always the upcoming-invoice null-id issue.
        // Log and fall through so provisioning still runs and we return 200.
        logger.warn(
          { eventType, pgCode },
          "Stripe sync skipped: upcoming invoice has null id (not-null constraint); ignoring",
        );
      } else {
        // Any other sync error (bad signature, unexpected schema issue, etc.)
        // is real — return 400 so Stripe retries the event later.
        logger.error({ err: syncErr, eventType }, "Stripe webhook sync error");
        res.status(400).json({ error: "Webhook processing error" });
        return;
      }
    }

    if (
      eventType === "price.created" ||
      eventType === "price.updated" ||
      eventType === "price.deleted" ||
      eventType === "product.created" ||
      eventType === "product.updated" ||
      eventType === "product.deleted"
    ) {
      invalidateCatalogPriceCache();
    }

    // ── Step 2: subscriber provisioning & Convey side-effects ─────────────────
    // Subscription lifecycle events must finish before we acknowledge delivery:
    // if cancellation deactivation fails, a 500 tells Stripe to retry instead of
    // leaving a cancelled customer with active portal access indefinitely.
    const isSubscriptionLifecycleEvent =
      eventType === "customer.subscription.created" ||
      eventType === "customer.subscription.updated" ||
      eventType === "customer.subscription.deleted" ||
      eventType === "checkout.session.expired";

    if (isSubscriptionLifecycleEvent) {
      try {
        await Promise.all([
          handleStripeEventForProvisioning(req.body as Buffer),
          handleConveyStripeEvent(req.body as Buffer),
        ]);
      } catch (err) {
        logger.error({ err, eventType }, "Stripe subscription side-effects failed");
        res.status(500).json({ error: "Subscription processing error" });
        return;
      }
    } else {
      // Checkout provisioning has its own retry/backoff and reconciliation safety
      // net. Keep it off the webhook response path so Stripe is acknowledged
      // promptly while customers receive access as soon as possible.
      void handleStripeEventForProvisioning(req.body as Buffer).catch((err) => {
        logger.error({ err }, "Stripe provisioning hook failed");
      });
      void handleConveyStripeEvent(req.body as Buffer).catch((err) => {
        logger.error({ err }, "Convey Stripe hook failed");
      });
    }

    res.status(200).json({ received: true });
  },
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Security headers — applied to every response from the API server.
// Clerk proxy and Stripe webhook responses also benefit.
app.use(
  helmet({
    // Content-Security-Policy tuned for the portal stack:
    //
    //  • script-src  — same-origin bundles + Clerk's CDN (npm.clerk.com serves
    //                  ClerkJS; *.clerk.accounts.dev is the FAPI host used in
    //                  dev instances).  'unsafe-inline' is required because
    //                  Vite injects a small inline modulepreload polyfill script
    //                  at build time; without it the entire SPA fails to boot.
    //                  'unsafe-eval' is required in development (Vite HMR) and
    //                  by some Clerk internals.  blob: covers dynamic workers
    //                  that some portal AI tools spin up.
    //
    //  • worker-src  — PDF.js and Clerk create workers from blob: URLs.
    //
    //  • style-src   — 'unsafe-inline' is required by React component libraries
    //                  (emotion / MUI / Tailwind JIT) that inject <style> tags
    //                  at runtime and by Clerk's embedded UI.
    //
    //  • img-src     — data: for PDF canvas thumbnails; blob: for object-URL
    //                  previews; https: for any remote images in AI outputs.
    //
    //  • connect-src — Clerk FAPI (*.clerk.accounts.dev), our own API (/api/*),
    //                  and WebSocket for Vite HMR in development (ws://).
    //
    //  • font-src    — data: covers base64-embedded fonts in some PDF outputs.
    //
    //  • media-src   — blob: for audio/video playback from object-URL previews
    //                  (MySyariahAI voice mode, MyLawFirmAI recordings).
    //
    //  • frame-src   — same-origin only (Clerk's hosted sign-in modal uses an
    //                  iframe to accounts.clerk.dev).
    //
    //  • object-src / base-uri — locked down entirely.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://npm.clerk.com",
          "https://*.clerk.accounts.dev",
          "blob:",
        ],
        workerSrc: ["'self'", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "https://npm.clerk.com",
          "https://*.clerk.accounts.dev",
          "https://api.clerk.dev",
          "wss:",
          "ws:",
        ],
        fontSrc: ["'self'", "data:"],
        mediaSrc: ["'self'", "blob:"],
        frameSrc: [
          "'self'",
          "https://*.clerk.accounts.dev",
          "https://accounts.clerk.dev",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    // HSTS: 1 year, include subdomains. Only meaningful in production (HTTPS).
    strictTransportSecurity:
      process.env.NODE_ENV === "production"
        ? { maxAge: 31_536_000, includeSubDomains: true }
        : false,
    // Prevent browsers from MIME-sniffing responses.
    noSniff: true,
    // Block clickjacking.
    frameguard: { action: "sameorigin" },
    // Do not send a Referer header when navigating to external sites.
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    // Disable browser-side XSS auditor (deprecated in modern browsers, causes issues).
    xssFilter: false,
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// CORS: never reflect arbitrary origins while credentials are enabled — that
// lets any website make cookie-authenticated requests to this API. All portals
// are served same-origin via path routing, so we only need to allow our own
// dev/prod domains (plus any explicitly configured extras).
const corsAllowedHosts = new Set(
  [
    ...(process.env.REPLIT_DOMAINS?.split(",") ?? []),
    process.env.REPLIT_DEV_DOMAIN,
    ...(process.env.CORS_EXTRA_ORIGINS?.split(",") ?? []),
  ]
    .map((d) => d?.trim())
    .filter((d): d is string => !!d)
    .map((d) => d.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase()),
);
app.use(
  cors({
    credentials: true,
    // Let browser frontends read the draft-8 rate-limit headers on AI
    // responses (used for the "requests left" warning banner). Same-origin
    // requests can always read them; this covers allowed cross-origin dev setups.
    exposedHeaders: ["RateLimit", "RateLimit-Policy"],
    origin(origin, callback) {
      // Same-origin requests and non-browser clients send no Origin header.
      if (!origin) return callback(null, true);
      try {
        const { hostname } = new URL(origin);
        const host = hostname.toLowerCase();
        const allowed =
          corsAllowedHosts.has(host) ||
          host === "localhost" ||
          host === "127.0.0.1";
        return callback(null, allowed);
      } catch {
        return callback(null, false);
      }
    },
  }),
);
// MyLawFirmAi posts base64-encoded meeting audio / screenshots as JSON; the
// default ~100kb limit rejects realistic uploads, so raise it for that mount
// only (this parser runs first and the global one below then no-ops).
app.use("/api/firm", express.json({ limit: "30mb" }));
app.use("/api/firm", express.urlencoded({ extended: true, limit: "30mb" }));
// MySyalitAI voice mode and MyLawAcad studio post base64-encoded recordings /
// handwriting images as JSON; raise their limits the same way.
app.use("/api/sya/voice", express.json({ limit: "30mb" }));
app.use("/api/acad/studio", express.json({ limit: "30mb" }));
// MyLitAI drafters accept long case facts plus extracted text from uploaded
// supporting documents (agreements, demand letters, prior orders) inlined into
// the request body, and saved-work stores generated drafts. The default ~100kb
// limit rejects realistic payloads on those endpoints. Raise the limit ONLY for
// those heavy litigation routes — every other /api/lit route (notably the
// unauthenticated auth endpoints) keeps the default ~100kb limit so they are
// not turned into a large-payload DoS surface. These prefix-scoped parsers run
// before the global one below and short-circuit it for matching requests.
const litHeavyJson = express.json({ limit: "30mb" });
const LIT_HEAVY_PREFIXES = [
  "/api/lit/forms",            // POST /:id/draft
  "/api/lit/ai",              // POST /draft-document(-sync), briefs, analysis
  "/api/lit/gemini",
  "/api/lit/irac",            // POST /draft
  "/api/lit/banking-recovery", // POST /draft
  "/api/lit/enforcement",     // POST /draft-document
  "/api/lit/appeals",         // POST /draft
  "/api/lit/affidavits",      // POST /draft
  "/api/lit/saved-work",      // stores generated draft content
  "/api/lit/exports",         // docx/pdf export of generated content
];
for (const prefix of LIT_HEAVY_PREFIXES) {
  app.use(prefix, litHeavyJson);
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET ?? "dev-cookie-secret"));
app.use(restoreMatterDownload);
// Passive only: observes exact sign-in routes after body parsing, then records
// recognized outcomes after the response. It neither authenticates nor limits.
app.use(portalSignInSignalObserver);

if (process.env.NODE_ENV !== "production") {
  app.post("/api/internal/e2e/login-rate-limit/reset", (req, res) => {
    const candidate = req.header("x-case-home-e2e-token");
    if (!resetLoginRateLimitForE2e(candidate)) {
      res.sendStatus(404);
      return;
    }
    res.sendStatus(204);
  });
}

// Resolve the publishable key from the incoming request host so the same
// server can serve multiple Clerk custom domains. Falls back to
// CLERK_PUBLISHABLE_KEY when the host doesn't map to a custom domain.
app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

// Parse the MyConveyLitAI Bearer token (if any) and attach the live user record.
app.use(attachUser);

// Microsoft Entra ID SSO (shared across all portals). Lives at /auth so the
// registered Azure redirect URI https://<domain>/auth/callback resolves here.
app.use("/auth", microsoftRouter);

app.use("/api", router);

export default app;
