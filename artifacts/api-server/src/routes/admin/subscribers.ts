import { Router, type IRouter } from "express";
import { eq, ilike, and, sql } from "drizzle-orm";
import { db, subscribersTable, activityTable, microsoftLinks } from "@workspace/db";
import {
  syncPortalAccessCodes,
  normalizeAppNames,
  generateAccessCode,
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

router.get("/subscribers", async (req, res): Promise<void> => {
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
