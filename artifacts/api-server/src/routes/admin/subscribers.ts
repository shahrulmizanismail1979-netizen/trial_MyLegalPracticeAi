import { Router, type IRouter } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { db, subscribersTable, activityTable, microsoftLinks } from "@workspace/db";
import {
  syncPortalAccessCodes,
  normalizeAppNames,
  generateAccessCode,
  deliverAccessCode,
} from "../../lib/provisioning";
import {
  CreateSubscriberBody,
  GetSubscriberParams,
  GetSubscriberResponse,
  UpdateSubscriberParams,
  UpdateSubscriberBody,
  UpdateSubscriberResponse,
  DeleteSubscriberParams,
  ListSubscribersResponse,
  ListSubscribersQueryParams,
  ConfirmSubscriberParams,
  ConfirmSubscriberResponse,
  RejectSubscriberParams,
  RejectSubscriberResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * Sync each subscriber's payment_amount from the latest PAID Stripe invoice
 * for their subscription. This makes the admin list show exactly what the
 * customer was charged — including promo-code discounts, and trial
 * subscriptions that later converted to paid (which were provisioned as
 * "0.00" at checkout time).
 */
async function refreshPaymentAmountsFromStripe(): Promise<void> {
  await db.execute(sql`
    UPDATE subscribers s
    SET payment_amount = to_char(latest.amount_paid / 100.0, 'FM999999990.00'),
        payment_date = COALESCE(latest.paid_at, s.payment_date)
    FROM (
      SELECT DISTINCT ON (sub_id) sub_id, amount_paid, paid_at
      FROM (
        SELECT
          COALESCE(
            NULLIF(i.subscription, ''),
            i._raw_data->'parent'->'subscription_details'->>'subscription'
          ) AS sub_id,
          i.amount_paid,
          to_timestamp(i.created) AS paid_at,
          i.created
        FROM stripe.invoices i
        WHERE i.status = 'paid' AND i.amount_paid > 0
      ) paid
      WHERE sub_id IS NOT NULL
      ORDER BY sub_id, created DESC
    ) latest
    WHERE s.stripe_subscription_id = latest.sub_id
      AND (
        s.payment_amount IS DISTINCT FROM to_char(latest.amount_paid / 100.0, 'FM999999990.00')
        OR s.payment_date IS DISTINCT FROM latest.paid_at
      )
  `);
}

router.get("/subscribers", async (req, res): Promise<void> => {
  // Best-effort: never let a Stripe-sync hiccup break the admin list.
  try {
    await refreshPaymentAmountsFromStripe();
  } catch (err) {
    req.log.warn({ err }, "Failed to refresh payment amounts from Stripe invoices");
  }

  const query = ListSubscribersQueryParams.safeParse(req.query);
  const conditions = [];

  if (query.success && query.data.status) {
    conditions.push(eq(subscribersTable.paymentStatus, query.data.status));
  }

  if (query.success && query.data.app) {
    conditions.push(sql`${query.data.app} = ANY(${subscribersTable.apps})`);
  }

  if (query.success && query.data.search) {
    const searchTerm = `%${query.data.search}%`;
    conditions.push(
      sql`(${ilike(subscribersTable.name, searchTerm)} OR ${ilike(subscribersTable.email, searchTerm)} OR ${ilike(subscribersTable.phone, searchTerm)})`
    );
  }

  const subscribers = await db
    .select()
    .from(subscribersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(subscribersTable.createdAt);

  res.json(ListSubscribersResponse.parse(subscribers));
});

router.post("/subscribers", async (req, res): Promise<void> => {
  const parsed = CreateSubscriberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [subscriber] = await db
    .insert(subscribersTable)
    .values({
      ...parsed.data,
      apps: normalizeAppNames(parsed.data.apps),
      // Manually added subscribers get a portal access code automatically,
      // just like Stripe checkout purchases do.
      accessCode: generateAccessCode(),
    })
    .returning();

  await db.insert(activityTable).values({
    type: "subscriber_added",
    description: `New subscriber: ${parsed.data.name} for ${parsed.data.apps.join(", ")}`,
  });

  // Make the code usable on every portal in the plan right away.
  if (subscriber && subscriber.paymentStatus === "confirmed") {
    await syncPortalAccessCodes(subscriber);
    // Deliver the access code automatically — same email/SMS flow as Stripe checkouts.
    const trial = subscriber.notes?.toLowerCase().includes("free trial") ?? false;
    deliverAccessCode({
      name: subscriber.name ?? "Subscriber",
      email: subscriber.email,
      phone: subscriber.phone,
      accessCode: subscriber.accessCode!,
      apps: subscriber.apps ?? [],
      tier: subscriber.tier,
      trial,
    });
  }

  res.status(201).json(GetSubscriberResponse.parse(subscriber));
});

router.get("/subscribers/:id", async (req, res): Promise<void> => {
  const params = GetSubscriberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [subscriber] = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.id, params.data.id));

  if (!subscriber) {
    res.status(404).json({ error: "Subscriber not found" });
    return;
  }

  res.json(GetSubscriberResponse.parse(subscriber));
});

router.patch("/subscribers/:id", async (req, res): Promise<void> => {
  const params = UpdateSubscriberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSubscriberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Capture the pre-update status so we can detect a fresh confirmation
  // transition below (idempotency: only deliver once, on the first confirm).
  const [before] = await db
    .select({ paymentStatus: subscribersTable.paymentStatus })
    .from(subscribersTable)
    .where(eq(subscribersTable.id, params.data.id));

  const [subscriber] = await db
    .update(subscribersTable)
    .set(parsed.data.apps ? { ...parsed.data, apps: normalizeAppNames(parsed.data.apps) } : parsed.data)
    .where(eq(subscribersTable.id, params.data.id))
    .returning();

  if (!subscriber) {
    res.status(404).json({ error: "Subscriber not found" });
    return;
  }

  // Keep portal login tables in sync with any code/apps changes.
  if (subscriber.paymentStatus === "confirmed") {
    await syncPortalAccessCodes(subscriber);

    // Deliver the access code automatically when the admin first confirms a
    // manual subscriber — matching the same email/SMS flow as Stripe checkouts.
    // The pre-update status check ensures we only fire once per confirmation,
    // not on every subsequent edit to a confirmed subscriber.
    if (before?.paymentStatus !== "confirmed" && subscriber.accessCode) {
      const trial = subscriber.notes?.toLowerCase().includes("free trial") ?? false;
      deliverAccessCode({
        name: subscriber.name ?? "Subscriber",
        email: subscriber.email,
        phone: subscriber.phone,
        accessCode: subscriber.accessCode,
        apps: subscriber.apps ?? [],
        tier: subscriber.tier,
        trial,
      });
    }
  }

  res.json(UpdateSubscriberResponse.parse(subscriber));
});

router.delete("/subscribers/:id", async (req, res): Promise<void> => {
  const params = DeleteSubscriberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [subscriber] = await db
    .delete(subscribersTable)
    .where(eq(subscribersTable.id, params.data.id))
    .returning();

  if (!subscriber) {
    res.status(404).json({ error: "Subscriber not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/subscribers/:id/confirm", async (req, res): Promise<void> => {
  const params = ConfirmSubscriberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let [subscriber] = await db
    .update(subscribersTable)
    .set({ paymentStatus: "confirmed", paymentDate: new Date() })
    .where(eq(subscribersTable.id, params.data.id))
    .returning();

  if (!subscriber) {
    res.status(404).json({ error: "Subscriber not found" });
    return;
  }

  // Backfill an access code for older manually-added subscribers.
  if (!subscriber.accessCode) {
    [subscriber] = await db
      .update(subscribersTable)
      .set({ accessCode: generateAccessCode() })
      .where(eq(subscribersTable.id, params.data.id))
      .returning();
  }

  if (!subscriber) {
    res.status(404).json({ error: "Subscriber not found" });
    return;
  }

  // Payment is confirmed — activate the code on every portal in the plan.
  await syncPortalAccessCodes(subscriber);

  await db.insert(activityTable).values({
    type: "payment_confirmed",
    description: `Payment confirmed for ${subscriber.name}`,
  });

  res.json(ConfirmSubscriberResponse.parse(subscriber));
});

router.patch("/subscribers/:id/reject", async (req, res): Promise<void> => {
  const params = RejectSubscriberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [subscriber] = await db
    .update(subscribersTable)
    .set({ paymentStatus: "rejected" })
    .where(eq(subscribersTable.id, params.data.id))
    .returning();

  if (!subscriber) {
    res.status(404).json({ error: "Subscriber not found" });
    return;
  }

  await db.insert(activityTable).values({
    type: "payment_rejected",
    description: `Payment rejected for ${subscriber.name}`,
  });

  res.json(RejectSubscriberResponse.parse(subscriber));
});

// Release a subscriber's access code from its Microsoft account binding so the
// plain code works again (the next Microsoft sign-in that links it becomes the
// new owner).
router.patch("/subscribers/:id/unbind-microsoft", async (req, res): Promise<void> => {
  const params = GetSubscriberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [subscriber] = await db
    .select()
    .from(subscribersTable)
    .where(eq(subscribersTable.id, params.data.id))
    .limit(1);

  if (!subscriber) {
    res.status(404).json({ error: "Subscriber not found" });
    return;
  }
  if (!subscriber.accessCode) {
    res.json({ unbound: 0 });
    return;
  }

  const unbound = await db
    .update(microsoftLinks)
    .set({ active: false })
    .where(
      and(
        sql`lower(${microsoftLinks.accessCode}) = lower(${subscriber.accessCode})`,
        eq(microsoftLinks.active, true),
      ),
    )
    .returning({ id: microsoftLinks.id });

  if (unbound.length > 0) {
    await db.insert(activityTable).values({
      type: "microsoft_unbound",
      description: `Microsoft account unbound from access code for ${subscriber.name}`,
    });
  }

  res.json({ unbound: unbound.length });
});

export default router;
