import { Router, type IRouter } from "express";
import { and, arrayContains, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, contributionsTable, activityTable, vouchersTable } from "@workspace/db";
import { getUncachableStripeClient } from "../../stripeClient";
import {
  ListContributionsQueryParams,
  ListContributionsResponse,
  GetContributionParams,
  GetContributionResponse,
  UpdateContributionParams,
  UpdateContributionBody,
  UpdateContributionResponse,
  DeleteContributionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/contributions", async (req, res): Promise<void> => {
  const query = ListContributionsQueryParams.safeParse(req.query);
  const conditions = [];

  if (query.success && query.data.status) {
    conditions.push(eq(contributionsTable.status, query.data.status));
  }

  if (query.success && query.data.category) {
    conditions.push(arrayContains(contributionsTable.categories, [query.data.category]));
  }

  if (query.success && query.data.search) {
    const term = `%${query.data.search}%`;
    conditions.push(
      sql`(${or(
        ilike(contributionsTable.title, term),
        ilike(contributionsTable.contributorName, term),
        ilike(contributionsTable.contributorEmail, term),
        ilike(contributionsTable.fileName, term),
      )})`,
    );
  }

  const contributions = await db
    .select()
    .from(contributionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(contributionsTable.createdAt));

  res.json(ListContributionsResponse.parse(contributions));
});

router.get("/contributions/:id", async (req, res): Promise<void> => {
  const params = GetContributionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [contribution] = await db
    .select()
    .from(contributionsTable)
    .where(eq(contributionsTable.id, params.data.id));

  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  res.json(GetContributionResponse.parse(contribution));
});

router.patch("/contributions/:id", async (req, res): Promise<void> => {
  const params = UpdateContributionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateContributionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description;
  if (parsed.data.categories !== undefined)
    updates.categories = parsed.data.categories;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.adminNotes !== undefined)
    updates.adminNotes = parsed.data.adminNotes;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [existing] = await db
    .select()
    .from(contributionsTable)
    .where(eq(contributionsTable.id, params.data.id));

  if (!existing) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  // Contribution credits: first approval earns a single-use "1 free month"
  // promotion code, created in Stripe and mirrored in the vouchers table.
  if (
    parsed.data.status === "approved" &&
    existing.status !== "approved" &&
    !existing.rewardVoucherCode
  ) {
    // Deterministic per contribution so retries reuse the same code and the
    // Stripe idempotency keys below stay consistent across attempts.
    const code = `THANKS-${createHash("sha256")
      .update(`contribution-reward-${existing.id}`)
      .digest("hex")
      .slice(0, 8)
      .toUpperCase()}`;

    // Atomically claim issuance: only one request can set the code while it is
    // still NULL, so concurrent approvals cannot double-issue rewards.
    const [claimed] = await db
      .update(contributionsTable)
      .set({ rewardVoucherCode: code })
      .where(
        and(
          eq(contributionsTable.id, existing.id),
          isNull(contributionsTable.rewardVoucherCode),
        ),
      )
      .returning({ id: contributionsTable.id });

    if (claimed) {
      try {
        const stripe = await getUncachableStripeClient();
        const coupon = await stripe.coupons.create(
          {
            percent_off: 100,
            duration: "once",
            name: "Contribution reward — 1 free month",
            metadata: {
              source: "contribution_reward",
              contributionId: String(existing.id),
            },
          },
          { idempotencyKey: `contrib-reward-coupon-${existing.id}` },
        );
        await stripe.promotionCodes.create(
          {
            promotion: { type: "coupon", coupon: coupon.id },
            code,
            max_redemptions: 1,
            metadata: {
              source: "contribution_reward",
              contributionId: String(existing.id),
              contributorEmail: existing.contributorEmail,
            },
          },
          { idempotencyKey: `contrib-reward-promo-${existing.id}` },
        );
      } catch (err) {
        // Release the claim so a later approval attempt can retry issuance.
        await db
          .update(contributionsTable)
          .set({ rewardVoucherCode: null })
          .where(
            and(
              eq(contributionsTable.id, existing.id),
              eq(contributionsTable.rewardVoucherCode, code),
            ),
          );
        req.log.error(
          { err, contributionId: existing.id },
          "Failed to create reward voucher in Stripe",
        );
        res.status(502).json({
          error:
            "Approval not completed: the reward voucher could not be created in Stripe. Please try again.",
        });
        return;
      }

      await db
        .insert(vouchersTable)
        .values({
          code,
          discountType: "percentage",
          discountValue: "100",
          maxUses: 1,
          appFilter: null,
          validFrom: new Date(),
          validUntil: null,
          isActive: true,
        })
        .onConflictDoNothing({ target: vouchersTable.code });

      await db.insert(activityTable).values({
        type: "voucher_created",
        description: `Reward voucher ${code} (1 free month) issued to ${existing.contributorName} for contribution "${existing.title}"`,
      });
    }
  }

  const [contribution] = await db
    .update(contributionsTable)
    .set(updates)
    .where(eq(contributionsTable.id, params.data.id))
    .returning();

  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  if (parsed.data.status) {
    await db.insert(activityTable).values({
      type: "contribution_status_changed",
      description: `Contribution "${contribution.title}" marked ${parsed.data.status}`,
    });
  }

  res.json(UpdateContributionResponse.parse(contribution));
});

router.delete("/contributions/:id", async (req, res): Promise<void> => {
  const params = DeleteContributionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [contribution] = await db
    .delete(contributionsTable)
    .where(eq(contributionsTable.id, params.data.id))
    .returning();

  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
