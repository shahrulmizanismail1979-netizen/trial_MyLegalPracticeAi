import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { inArray } from "drizzle-orm";
import {
  attachSarawak20Checkout,
  buildSarawak20CheckoutParams,
  cancelSarawak20Enrollment,
  claimSarawak20Reservation,
  consumeSarawak20Reservation,
  ensureSarawak20Price,
  ensureSarawak20ReservationsTable,
  getSarawak20Status,
  releaseSarawak20Reservation,
  SARAWAK20_CAPACITY,
  SARAWAK20_PLANS,
  SARAWAK20_PRICE_MYR_CENTS,
  aasDirectoryHasMatchingCard,
} from "./sarawak20";
import { db, sarawak20ReservationsTable } from "@workspace/db";

const createdIds: string[] = [];

beforeAll(async () => {
  await ensureSarawak20ReservationsTable();
});

afterEach(async () => {
  if (createdIds.length === 0) return;
  await db
    .delete(sarawak20ReservationsTable)
    .where(inArray(sarawak20ReservationsTable.id, [...createdIds]));
  createdIds.length = 0;
});

describe("Project Sarawak 20 capacity ledger", () => {
  it("keeps the firm and chambering cohorts separate", async () => {
    const before = await getSarawak20Status();
    const firmBefore = before.cohorts.find((item) => item.cohort === "firm")!;
    const chamberingBefore = before.cohorts.find(
      (item) => item.cohort === "chambering",
    )!;
    expect(firmBefore.price.amount).toBe(
      firmBefore.currentPlan === "aas_firm"
        ? SARAWAK20_PLANS.aas_firm.amount
        : SARAWAK20_PLANS.firm_founding.amount,
    );
    expect(chamberingBefore.price.amount).toBe(
      SARAWAK20_PLANS.chambering_founding.amount,
    );
    expect(firmBefore.requiresEligibility).toBe(true);
    expect(chamberingBefore.requiresEligibility).toBe(true);

    const claim = await claimSarawak20Reservation("firm", randomUUID());
    expect(claim.kind).toBe("created");
    if (claim.kind !== "created") return;
    createdIds.push(claim.id);

    const after = await getSarawak20Status();
    expect(
      after.cohorts.find((item) => item.cohort === "firm")!.remaining,
    ).toBe(firmBefore.remaining - 1);
    expect(
      after.cohorts.find((item) => item.cohort === "chambering")!.remaining,
    ).toBe(chamberingBefore.remaining);
  });

  it("serializes parallel claims and never allocates beyond 20 places", async () => {
    const baseline = await getSarawak20Status();
    const remaining = baseline.cohorts.find(
      (item) => item.cohort === "firm",
    )!.remaining;
    const claims = await Promise.all(
      Array.from({ length: remaining + 5 }, () =>
        claimSarawak20Reservation("firm", randomUUID()),
      ),
    );
    for (const claim of claims) {
      if (claim.kind === "created") createdIds.push(claim.id);
    }

    expect(claims.filter((claim) => claim.kind === "created")).toHaveLength(
      remaining,
    );
    expect(
      claims.filter((claim) => claim.kind === "eligibility-required"),
    ).toHaveLength(5);

    const full = await getSarawak20Status();
    const firm = full.cohorts.find((item) => item.cohort === "firm")!;
    expect(firm.activePaid + firm.reserved).toBe(SARAWAK20_CAPACITY);
    expect(firm.remaining).toBe(0);
    expect(firm.foundingSoldOut).toBe(true);
    expect(firm.currentPlan).toBe("aas_firm");
    expect(firm.price.amount).toBe(SARAWAK20_PLANS.aas_firm.amount);
    expect(firm.licenses).toBe(3);
    expect(firm.unlimited).toBe(true);
  });

  it("reuses a completed checkout attachment for the same request", async () => {
    const requestId = randomUUID();
    const first = await claimSarawak20Reservation("chambering", requestId);
    expect(first.kind).toBe("created");
    if (first.kind !== "created") return;
    createdIds.push(first.id);

    await attachSarawak20Checkout({
      reservationId: first.id,
      sessionId: `cs_test_${randomUUID()}`,
      url: "https://checkout.stripe.com/test",
    });
    const repeated = await claimSarawak20Reservation("chambering", requestId);
    expect(repeated).toMatchObject({
      kind: "reused",
      id: first.id,
      url: "https://checkout.stripe.com/test",
    });
  });

  it("releases failed/expired checkout claims and cancellation exactly once", async () => {
    const released = await claimSarawak20Reservation(
      "chambering",
      randomUUID(),
    );
    expect(released.kind).toBe("created");
    if (released.kind !== "created") return;
    createdIds.push(released.id);
    await releaseSarawak20Reservation(released.id);
    await releaseSarawak20Reservation(released.id);

    const consumed = await claimSarawak20Reservation(
      "chambering",
      randomUUID(),
    );
    expect(consumed.kind).toBe("created");
    if (consumed.kind !== "created") return;
    createdIds.push(consumed.id);
    const subscriptionId = `sub_test_${randomUUID()}`;
    await expect(
      consumeSarawak20Reservation({
        session: {
          metadata: {
            programme: "sarawak20",
            sarawak20Cohort: "chambering",
            sarawak20ReservationId: consumed.id,
          },
        } as never,
        subscriptionId,
        subscriberId: 1,
      }),
    ).resolves.toBe(true);
    await cancelSarawak20Enrollment(subscriptionId);
    await cancelSarawak20Enrollment(subscriptionId);

    const rows = await db
      .select({
        id: sarawak20ReservationsTable.id,
        status: sarawak20ReservationsTable.status,
      })
      .from(sarawak20ReservationsTable)
      .where(
        inArray(sarawak20ReservationsTable.id, [released.id, consumed.id]),
      );
    expect(rows.find((row) => row.id === released.id)?.status).toBe("released");
    expect(rows.find((row) => row.id === consumed.id)?.status).toBe(
      "cancelled",
    );
  });

  it("refuses a delayed completion when its cohort is already at the hard cap", async () => {
    const delayed = await claimSarawak20Reservation("firm", randomUUID());
    expect(delayed.kind).toBe("created");
    if (delayed.kind !== "created") return;
    createdIds.push(delayed.id);
    await releaseSarawak20Reservation(delayed.id);

    const status = await getSarawak20Status();
    const remaining = status.cohorts.find(
      (item) => item.cohort === "firm",
    )!.remaining;
    const fillers = await Promise.all(
      Array.from({ length: remaining }, () =>
        claimSarawak20Reservation("firm", randomUUID()),
      ),
    );
    for (const filler of fillers) {
      if (filler.kind !== "created") continue;
      createdIds.push(filler.id);
    }

    await expect(
      consumeSarawak20Reservation({
        session: {
          metadata: {
            programme: "sarawak20",
            sarawak20Cohort: "firm",
            sarawak20ReservationId: delayed.id,
          },
        } as never,
        subscriptionId: `sub_test_delayed_${randomUUID()}`,
      }),
    ).resolves.toBe(false);

    const final = await getSarawak20Status();
    const firm = final.cohorts.find((item) => item.cohort === "firm")!;
    expect(firm.activePaid + firm.reserved).toBe(SARAWAK20_CAPACITY);
  });

  it("serializes a delayed completion racing the last new claim", async () => {
    const delayed = await claimSarawak20Reservation("firm", randomUUID());
    expect(delayed.kind).toBe("created");
    if (delayed.kind !== "created") return;
    createdIds.push(delayed.id);
    await releaseSarawak20Reservation(delayed.id);

    const status = await getSarawak20Status();
    const remaining = status.cohorts.find(
      (item) => item.cohort === "firm",
    )!.remaining;
    const fillers = await Promise.all(
      Array.from({ length: Math.max(0, remaining - 1) }, () =>
        claimSarawak20Reservation("firm", randomUUID()),
      ),
    );
    for (const filler of fillers) {
      if (filler.kind === "created") createdIds.push(filler.id);
    }

    const newRequestId = randomUUID();
    const [newClaim, delayedConsumed] = await Promise.all([
      claimSarawak20Reservation("firm", newRequestId),
      consumeSarawak20Reservation({
        session: {
          metadata: {
            programme: "sarawak20",
            sarawak20Cohort: "firm",
            sarawak20ReservationId: delayed.id,
          },
        } as never,
        subscriptionId: `sub_test_delayed_${randomUUID()}`,
      }),
    ]);
    if (newClaim.kind === "created") createdIds.push(newClaim.id);

    expect(Number(newClaim.kind === "created") + Number(delayedConsumed)).toBe(
      1,
    );
    const final = await getSarawak20Status();
    const firm = final.cohorts.find((item) => item.cohort === "firm")!;
    expect(firm.activePaid + firm.reserved).toBe(SARAWAK20_CAPACITY);
  });
});

describe("Project Sarawak 20 Stripe contract", () => {
  it("never writes checkout bearer identifiers into route logs", () => {
    const stripeRouteSource = readFileSync(
      new URL("../routes/stripe.ts", import.meta.url),
      "utf8",
    );
    const sarawakRoute = stripeRouteSource.slice(
      stripeRouteSource.indexOf('router.get("/sarawak20/status"'),
      stripeRouteSource.indexOf("// Public self-service billing handoff"),
    );
    const sessionInfoRoute = stripeRouteSource.slice(
      stripeRouteSource.indexOf('router.get("/session-info"'),
      stripeRouteSource.indexOf("/**", stripeRouteSource.indexOf('router.get("/session-info"')),
    );

    for (const routeSource of [sarawakRoute, sessionInfoRoute]) {
      const logCalls = routeSource.match(/req\.log\.(?:error|warn|info)\([\s\S]*?\);/g) ?? [];
      expect(logCalls.join("\n")).not.toMatch(
        /\b(?:sessionId|session_id|reservationId|accessCode)\b/,
      );
    }
  });

  it("does not accept echoed search input or values from separate directory cards", () => {
    expect(
      aasDirectoryHasMatchingCard(
        `<form><input value="Advocate One"><input value="Firm One"></form>`,
        "Advocate One",
        "Firm One",
      ),
    ).toBe(false);
    expect(
      aasDirectoryHasMatchingCard(
        `<div class="member"><h4>Advocate One</h4><p>Other Firm</p></div>
         <div class="member"><h4>Other Advocate</h4><p>Firm One</p></div>`,
        "Advocate One",
        "Firm One",
      ),
    ).toBe(false);
    expect(
      aasDirectoryHasMatchingCard(
        `<div class="member"><h4>Advocate&nbsp;One</h4><p>Firm &amp; One, Kuching</p></div>`,
        "Advocate One",
        "Firm & One",
      ),
    ).toBe(true);
  });

  it("creates a dedicated RM49 MYR monthly price", async () => {
    const priceCreate = vi.fn().mockResolvedValue({ id: "price_sarawak20" });
    const stripe = {
      products: {
        search: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({ id: "prod_sarawak20" }),
      },
      prices: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: priceCreate,
      },
    };

    await expect(ensureSarawak20Price(stripe as never)).resolves.toBe(
      "price_sarawak20",
    );
    expect(priceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        product: "prod_sarawak20",
        currency: "myr",
        unit_amount: SARAWAK20_PRICE_MYR_CENTS,
        recurring: { interval: "month" },
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );
  });

  it("keeps programme metadata and disables adaptive pricing", () => {
    const params = buildSarawak20CheckoutParams({
      origin: "https://lawyes.example",
      priceId: "price_sarawak20",
      reservationId: "reservation-1",
      cohort: "firm",
      plan: "firm_founding",
      expiresAt: 2_000_000_000,
    });

    expect(params.line_items).toEqual([
      { price: "price_sarawak20", quantity: 1 },
    ]);
    expect(params.adaptive_pricing).toEqual({ enabled: false });
    expect(params.success_url).toContain("/sarawak20/success");
    expect(params.cancel_url).toContain("/sarawak20/?checkout=cancelled");
    expect(params.metadata).toMatchObject({
      tier: "sarawak20",
      programme: "sarawak20",
      cohort: "firm",
      reservationId: "reservation-1",
      plan: "firm_founding",
      licenses: "1",
    });
    expect(params.subscription_data?.metadata).toEqual(params.metadata);
  });

  it("uses RM99 and three seats for the post-cap AAS plan", async () => {
    const priceCreate = vi.fn().mockResolvedValue({ id: "price_sarawak20_aas" });
    const stripe = {
      products: {
        search: vi.fn().mockResolvedValue({ data: [] }),
        create: vi.fn().mockResolvedValue({ id: "prod_sarawak20_aas" }),
      },
      prices: {
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: priceCreate,
      },
    };

    await expect(
      ensureSarawak20Price(stripe as never, "aas_firm"),
    ).resolves.toBe("price_sarawak20_aas");
    expect(priceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: "myr",
        unit_amount: SARAWAK20_PLANS.aas_firm.amount,
        metadata: expect.objectContaining({
          sarawak20_plan: "aas_firm",
          founding_rate_months: "0",
        }),
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String) }),
    );

    const checkout = buildSarawak20CheckoutParams({
      origin: "https://lawyes.example",
      priceId: "price_sarawak20_aas",
      reservationId: "reservation-aas",
      cohort: "firm",
      plan: "aas_firm",
      eligibilityId: "eligibility-aas",
      expiresAt: 2_000_000_000,
    });
    expect(checkout.metadata).toMatchObject({
      plan: "aas_firm",
      licenses: "3",
      foundingRateMonths: "0",
      eligibilityId: "eligibility-aas",
    });
  });
});
