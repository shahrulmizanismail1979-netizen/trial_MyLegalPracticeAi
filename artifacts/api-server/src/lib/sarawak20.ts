import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import type Stripe from "stripe";
import { db, sarawak20ReservationsTable } from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "./logger";

export const SARAWAK20_TIER = "sarawak20";
export const SARAWAK20_PRICE_MYR_CENTS = 4_900;
export const SARAWAK20_FOUNDING_RATE_MONTHS = 12;
export const SARAWAK20_CAPACITY = 20;

export const SARAWAK20_COHORTS = {
  firm: "Law firms & lawyers",
  chambering: "Chambering students",
} as const;

export type Sarawak20Cohort = keyof typeof SARAWAK20_COHORTS;

const RESERVATION_WINDOW_MS = 35 * 60 * 1_000;
const CHECKOUT_WINDOW_SECONDS = 30 * 60;

function cohortLockKey(cohort: Sarawak20Cohort): string {
  return `sarawak20:${cohort}`;
}

export function isSarawak20Cohort(value: unknown): value is Sarawak20Cohort {
  return typeof value === "string" && value in SARAWAK20_COHORTS;
}

/** Ensure the additive ledger migration is present in every runtime database. */
export async function ensureSarawak20ReservationsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sarawak20_reservations (
      id text PRIMARY KEY,
      cohort text NOT NULL CHECK (cohort IN ('firm', 'chambering')),
      request_id text NOT NULL UNIQUE,
      checkout_session_id text UNIQUE,
      checkout_url text,
      subscription_id text UNIQUE,
      subscriber_id integer,
      status text NOT NULL DEFAULT 'creating'
        CHECK (status IN ('creating', 'reserved', 'consumed', 'released', 'expired', 'cancelled')),
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS sarawak20_reservations_capacity_idx
      ON sarawak20_reservations (cohort, status, expires_at)
  `);
  logger.info("Project Sarawak 20 reservation ledger ensured");
}

export async function releaseExpiredSarawak20Reservations(): Promise<void> {
  await db
    .update(sarawak20ReservationsTable)
    .set({ status: "expired" })
    .where(
      and(
        inArray(sarawak20ReservationsTable.status, ["creating", "reserved"]),
        lt(sarawak20ReservationsTable.expiresAt, new Date()),
      ),
    );
}

export async function getSarawak20Status() {
  await releaseExpiredSarawak20Reservations();

  const counts = await db
    .select({
      cohort: sarawak20ReservationsTable.cohort,
      activePaid: sql<number>`count(*) filter (where ${sarawak20ReservationsTable.status} = 'consumed')::int`,
      reserved: sql<number>`count(*) filter (
        where ${sarawak20ReservationsTable.status} in ('creating', 'reserved')
          and ${sarawak20ReservationsTable.expiresAt} > now()
      )::int`,
    })
    .from(sarawak20ReservationsTable)
    .where(
      or(
        eq(sarawak20ReservationsTable.status, "consumed"),
        and(
          inArray(sarawak20ReservationsTable.status, ["creating", "reserved"]),
          sql`${sarawak20ReservationsTable.expiresAt} > now()`,
        ),
      ),
    )
    .groupBy(sarawak20ReservationsTable.cohort);

  const countByCohort = new Map(
    counts.map((row) => [
      row.cohort,
      { activePaid: Number(row.activePaid), reserved: Number(row.reserved) },
    ]),
  );

  return {
    programme: "Project Sarawak 20",
    price: {
      amount: SARAWAK20_PRICE_MYR_CENTS,
      currency: "myr" as const,
      interval: "month" as const,
    },
    foundingRateMonths: SARAWAK20_FOUNDING_RATE_MONTHS,
    cancellableAnytime: true,
    cohorts: (Object.entries(SARAWAK20_COHORTS) as [Sarawak20Cohort, string][]).map(
      ([cohort, label]) => {
        const countsForCohort = countByCohort.get(cohort) ?? {
          activePaid: 0,
          reserved: 0,
        };
        const allocated = countsForCohort.activePaid + countsForCohort.reserved;
        const remaining = Math.max(0, SARAWAK20_CAPACITY - allocated);
        return {
          cohort,
          label,
          capacity: SARAWAK20_CAPACITY,
          ...countsForCohort,
          remaining,
          soldOut: remaining === 0,
        };
      },
    ),
  };
}

export type Sarawak20ReservationClaim =
  | { kind: "created"; id: string; expiresAt: Date }
  | { kind: "reused"; id: string; url: string; expiresAt: Date }
  | { kind: "pending" }
  | { kind: "sold-out" };

export async function claimSarawak20Reservation(
  cohort: Sarawak20Cohort,
  requestId: string,
): Promise<Sarawak20ReservationClaim> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${cohortLockKey(cohort)}))`);

    await tx
      .update(sarawak20ReservationsTable)
      .set({ status: "expired" })
      .where(
        and(
          eq(sarawak20ReservationsTable.cohort, cohort),
          inArray(sarawak20ReservationsTable.status, ["creating", "reserved"]),
          lt(sarawak20ReservationsTable.expiresAt, new Date()),
        ),
      );

    const [existing] = await tx
      .select()
      .from(sarawak20ReservationsTable)
      .where(eq(sarawak20ReservationsTable.requestId, requestId))
      .limit(1);

    if (existing) {
      if (existing.cohort !== cohort) return { kind: "pending" };
      if (
        ["creating", "reserved"].includes(existing.status) &&
        existing.expiresAt.getTime() > Date.now()
      ) {
        return existing.checkoutUrl
          ? {
              kind: "reused",
              id: existing.id,
              url: existing.checkoutUrl,
              expiresAt: existing.expiresAt,
            }
          : { kind: "pending" };
      }
      return { kind: "pending" };
    }

    const countResult = await tx.execute(sql`
      select count(*)::int as allocated
      from ${sarawak20ReservationsTable}
      where ${sarawak20ReservationsTable.cohort} = ${cohort}
        and (
          ${sarawak20ReservationsTable.status} = 'consumed'
          or (
            ${sarawak20ReservationsTable.status} in ('creating', 'reserved')
            and ${sarawak20ReservationsTable.expiresAt} > now()
          )
        )
    `);
    const allocated = Number(
      (countResult.rows[0] as { allocated?: number | string } | undefined)?.allocated ?? 0,
    );
    if (allocated >= SARAWAK20_CAPACITY) return { kind: "sold-out" };

    const id = randomUUID();
    const expiresAt = new Date(Date.now() + RESERVATION_WINDOW_MS);
    await tx.insert(sarawak20ReservationsTable).values({
      id,
      cohort,
      requestId,
      status: "creating",
      expiresAt,
    });
    return { kind: "created", id, expiresAt };
  });
}

export async function attachSarawak20Checkout(params: {
  reservationId: string;
  sessionId: string;
  url: string;
}): Promise<boolean> {
  const rows = await db
    .update(sarawak20ReservationsTable)
    .set({
      checkoutSessionId: params.sessionId,
      checkoutUrl: params.url,
      status: "reserved",
    })
    .where(
      and(
        eq(sarawak20ReservationsTable.id, params.reservationId),
        eq(sarawak20ReservationsTable.status, "creating"),
      ),
    )
    .returning({ id: sarawak20ReservationsTable.id });
  return rows.length === 1;
}

export async function releaseSarawak20Reservation(reservationId: string): Promise<void> {
  await db
    .update(sarawak20ReservationsTable)
    .set({ status: "released" })
    .where(
      and(
        eq(sarawak20ReservationsTable.id, reservationId),
        inArray(sarawak20ReservationsTable.status, ["creating", "reserved"]),
      ),
    );
}

export async function releaseSarawak20ReservationFromSession(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const reservationId = session.metadata?.sarawak20ReservationId;
  if (session.metadata?.programme !== SARAWAK20_TIER || !reservationId) return;
  await releaseSarawak20Reservation(reservationId);
}

export async function consumeSarawak20Reservation(params: {
  session: Stripe.Checkout.Session;
  subscriptionId: string | null;
  subscriberId?: number;
}): Promise<boolean> {
  const reservationId = params.session.metadata?.sarawak20ReservationId;
  const cohort = params.session.metadata?.sarawak20Cohort;
  if (
    params.session.metadata?.programme !== SARAWAK20_TIER ||
    !reservationId ||
    !isSarawak20Cohort(cohort)
  ) {
    return true;
  }

  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${cohortLockKey(cohort)}))`);

    const [reservation] = await tx
      .select()
      .from(sarawak20ReservationsTable)
      .where(
        and(
          eq(sarawak20ReservationsTable.id, reservationId),
          eq(sarawak20ReservationsTable.cohort, cohort),
        ),
      )
      .limit(1);
    if (!reservation || reservation.status === "cancelled") return false;

    if (reservation.status === "consumed") {
      if (
        reservation.subscriptionId &&
        params.subscriptionId &&
        reservation.subscriptionId !== params.subscriptionId
      ) {
        return false;
      }
      await tx
        .update(sarawak20ReservationsTable)
        .set({
          subscriptionId: params.subscriptionId ?? reservation.subscriptionId,
          subscriberId: params.subscriberId ?? reservation.subscriberId,
        })
        .where(eq(sarawak20ReservationsTable.id, reservationId));
      return true;
    }

    if (!["creating", "reserved", "expired", "released"].includes(reservation.status)) {
      return false;
    }

    // A completion webhook can arrive after the short reservation window or
    // after an expiry delivery raced it. Reclaim the paid place only if doing
    // so still keeps this cohort at or below its hard cap.
    const countResult = await tx.execute(sql`
      select count(*)::int as allocated
      from ${sarawak20ReservationsTable}
      where ${sarawak20ReservationsTable.cohort} = ${cohort}
        and ${sarawak20ReservationsTable.id} <> ${reservationId}
        and (
          ${sarawak20ReservationsTable.status} = 'consumed'
          or (
            ${sarawak20ReservationsTable.status} in ('creating', 'reserved')
            and ${sarawak20ReservationsTable.expiresAt} > now()
          )
        )
    `);
    const allocated = Number(
      (countResult.rows[0] as { allocated?: number | string } | undefined)?.allocated ?? 0,
    );
    if (allocated >= SARAWAK20_CAPACITY) return false;

    const updated = await tx
      .update(sarawak20ReservationsTable)
      .set({
        status: "consumed",
        subscriptionId: params.subscriptionId,
        subscriberId: params.subscriberId,
      })
      .where(
        and(
          eq(sarawak20ReservationsTable.id, reservationId),
          eq(sarawak20ReservationsTable.cohort, cohort),
          inArray(sarawak20ReservationsTable.status, ["creating", "reserved", "expired", "released"]),
        ),
      )
      .returning({ id: sarawak20ReservationsTable.id });
    return updated.length === 1;
  });
}

export async function cancelSarawak20Enrollment(subscriptionId: string): Promise<void> {
  await db
    .update(sarawak20ReservationsTable)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(sarawak20ReservationsTable.subscriptionId, subscriptionId),
        eq(sarawak20ReservationsTable.status, "consumed"),
      ),
    );
}

export async function ensureSarawak20Price(
  stripeClient?: Awaited<ReturnType<typeof getUncachableStripeClient>>,
): Promise<string> {
  const stripe = stripeClient ?? (await getUncachableStripeClient());
  const products = await stripe.products.search({
    query: `active:'true' AND metadata['programme']:'${SARAWAK20_TIER}'`,
    limit: 1,
  });

  let productId = products.data[0]?.id;
  if (!productId) {
    const product = await stripe.products.create(
      {
        name: "LAWYes Project Sarawak 20 — Founding Programme",
        description:
          "Founding participation in the Project Sarawak 20 legal AI co-development programme.",
        metadata: {
          programme: SARAWAK20_TIER,
          tier: SARAWAK20_TIER,
          founding_rate_months: String(SARAWAK20_FOUNDING_RATE_MONTHS),
        },
      },
      { idempotencyKey: "lawyes-sarawak20-product-v1" },
    );
    productId = product.id;
  }

  const prices = await stripe.prices.list({ product: productId, active: true, limit: 10 });
  const existing = prices.data.find(
    (price) =>
      price.currency === "myr" &&
      price.unit_amount === SARAWAK20_PRICE_MYR_CENTS &&
      price.recurring?.interval === "month",
  );
  if (existing) return existing.id;

  const price = await stripe.prices.create(
    {
      product: productId,
      currency: "myr",
      unit_amount: SARAWAK20_PRICE_MYR_CENTS,
      recurring: { interval: "month" },
      metadata: {
        programme: SARAWAK20_TIER,
        founding_rate_months: String(SARAWAK20_FOUNDING_RATE_MONTHS),
      },
    },
    { idempotencyKey: `lawyes-sarawak20-price-${SARAWAK20_PRICE_MYR_CENTS}-v1` },
  );
  return price.id;
}

export function sarawak20CheckoutExpiresAt(): number {
  return Math.floor(Date.now() / 1_000) + CHECKOUT_WINDOW_SECONDS;
}

export function buildSarawak20CheckoutParams(params: {
  origin: string;
  priceId: string;
  reservationId: string;
  cohort: Sarawak20Cohort;
  expiresAt: number;
}): Stripe.Checkout.SessionCreateParams {
  const metadata = {
    tier: SARAWAK20_TIER,
    programme: SARAWAK20_TIER,
    sarawak20Cohort: params.cohort,
    sarawak20ReservationId: params.reservationId,
    foundingRateMonths: String(SARAWAK20_FOUNDING_RATE_MONTHS),
    trial: "false",
  };
  return {
    mode: "subscription",
    client_reference_id: params.reservationId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    billing_address_collection: "auto",
    phone_number_collection: { enabled: true },
    adaptive_pricing: { enabled: false },
    payment_method_collection: "always",
    success_url: `${params.origin}/sarawak20/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.origin}/sarawak20/?checkout=cancelled`,
    expires_at: params.expiresAt,
    subscription_data: { metadata },
    metadata,
  };
}