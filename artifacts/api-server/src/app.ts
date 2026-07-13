import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { handleStripeEventForProvisioning } from "./lib/provisioning";
import { handleConveyStripeEvent } from "./lib/conveyStripe";
import { attachUser } from "./middlewares/conveyAuth";

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
    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      // Signature verified by processWebhook above — safe to act on the payload.
      // Auto-provision subscribers (access code + emails) on completed checkouts.
      void handleStripeEventForProvisioning(req.body as Buffer).catch((err) => {
        logger.error({ err }, "Stripe provisioning hook failed");
      });
      // Mirror subscription state onto MyConveyLitAI user records.
      void handleConveyStripeEvent(req.body as Buffer).catch((err) => {
        logger.error({ err }, "Convey Stripe hook failed");
      });
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error({ err: error }, "Stripe webhook processing error");
      res.status(400).json({ error: "Webhook processing error" });
    }
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

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

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

app.use("/api", router);

export default app;
