import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subscribersTable, activityTable } from "@workspace/db";
import {
  createBill,
  getBill,
  verifyXSignature,
  isBillplzConfigured,
} from "../lib/billplz";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/billplz/status", (_req, res) => {
  res.json({ configured: isBillplzConfigured() });
});

/**
 * Create a Billplz bill. Creates a pending subscriber record and returns the
 * Billplz hosted payment URL for redirect.
 */
router.post("/billplz/create", async (req, res): Promise<void> => {
  try {
    const { name, email, phone, amount, apps, packageName } = req.body ?? {};

    if (!name || !email || !phone || !amount || !Array.isArray(apps) || apps.length === 0) {
      res.status(400).json({
        error: "name, email, phone, amount and apps are required",
      });
      return;
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      res.status(400).json({ error: "amount must be a positive number (RM)" });
      return;
    }

    const [subscriber] = await db
      .insert(subscribersTable)
      .values({
        name,
        email,
        phone,
        apps,
        paymentStatus: "pending",
        paymentAmount: String(amountNum.toFixed(2)),
        notes: packageName ? `Package: ${packageName}` : null,
      })
      .returning();

    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    const origin = `${proto}://${host}`;

    const bill = await createBill({
      name,
      email,
      mobile: phone,
      amountInCents: Math.round(amountNum * 100),
      description: (packageName || "AI Web Books Subscription").slice(0, 200),
      callbackUrl: `${origin}/api/payments/billplz/webhook`,
      redirectUrl: `${origin}/api/payments/billplz/redirect`,
      reference1Label: "SubscriberID",
      reference1: String(subscriber.id),
      reference2Label: "Apps",
      reference2: apps.join(","),
    });

    await db
      .update(subscribersTable)
      .set({
        notes: `${packageName ? `Package: ${packageName} | ` : ""}Billplz: ${bill.id}`,
      })
      .where(eq(subscribersTable.id, subscriber.id));

    await db.insert(activityTable).values({
      type: "billplz_created",
      description: `Billplz bill ${bill.id} created for ${name} (${email}) — RM${amountNum.toFixed(2)}`,
      metadata: JSON.stringify({ billId: bill.id, amount: amountNum, apps }),
    });

    res.json({ url: bill.url, billId: bill.id, subscriberId: subscriber.id });
  } catch (err) {
    logger.error({ err }, "Failed to create Billplz bill");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/** Server-to-server payment confirmation from Billplz */
router.post("/billplz/webhook", async (req, res): Promise<void> => {
  try {
    const payload = req.body as Record<string, string>;
    const signature = payload["x_signature"];
    if (!signature || !verifyXSignature(payload, signature, "callback")) {
      logger.warn({ payload }, "Billplz webhook signature invalid");
      res.status(400).send("Invalid signature");
      return;
    }

    await handlePaidBill({
      billId: payload["id"],
      paid: payload["paid"] === "true",
      subscriberId: payload["reference_1"],
      paidAt: payload["paid_at"],
      source: "webhook",
    });

    res.status(200).send("OK");
  } catch (err) {
    logger.error({ err }, "Billplz webhook error");
    res.status(500).send("Error");
  }
});

/** Browser redirect after Billplz checkout */
router.get("/billplz/redirect", async (req, res): Promise<void> => {
  try {
    const params = req.query as Record<string, string>;
    const signature = params["billplz[x_signature]"] || params["billplzx_signature"];

    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      const cleanKey = k.replace(/^billplz\[(.+)\]$/, "billplz$1");
      flat[cleanKey] = String(v);
    }

    const valid = signature
      ? verifyXSignature(flat, String(signature), "redirect")
      : false;

    const billId = flat["billplzid"];
    const paid = flat["billplzpaid"] === "true";

    if (valid && billId) {
      try {
        const bill = await getBill(billId);
        await handlePaidBill({
          billId: bill.id,
          paid: bill.paid,
          subscriberId: undefined,
          paidAt: paid ? new Date().toISOString() : undefined,
          source: "redirect",
        });
      } catch (err) {
        logger.warn({ err }, "Failed to refresh bill state on redirect");
      }
    }

    const status = paid ? "success" : "failed";
    res.redirect(`/?payment=${status}&bill=${encodeURIComponent(billId || "")}`);
  } catch (err) {
    logger.error({ err }, "Billplz redirect handler error");
    res.redirect(`/?payment=error`);
  }
});

async function handlePaidBill(opts: {
  billId: string;
  paid: boolean;
  subscriberId?: string;
  paidAt?: string;
  source: "webhook" | "redirect";
}) {
  if (!opts.paid) return;

  const subscriberId = opts.subscriberId ? Number(opts.subscriberId) : NaN;
  if (!Number.isFinite(subscriberId)) {
    logger.warn({ opts }, "No subscriberId on paid Billplz bill");
    return;
  }

  const [existing] = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.id, subscriberId));

  if (!existing) {
    logger.warn({ subscriberId }, "Subscriber not found for paid bill");
    return;
  }
  if (existing.paymentStatus === "confirmed") return;

  const paidDate = opts.paidAt ? new Date(opts.paidAt) : new Date();
  const expiry = new Date(paidDate);
  expiry.setFullYear(expiry.getFullYear() + 3);

  await db
    .update(subscribersTable)
    .set({
      paymentStatus: "confirmed",
      paymentDate: paidDate,
      subscriptionExpiry: expiry,
    })
    .where(eq(subscribersTable.id, subscriberId));

  await db.insert(activityTable).values({
    type: "billplz_paid",
    description: `Billplz bill ${opts.billId} paid by ${existing.name} (${existing.email})`,
    metadata: JSON.stringify({
      billId: opts.billId,
      subscriberId,
      source: opts.source,
    }),
  });
}

export default router;
