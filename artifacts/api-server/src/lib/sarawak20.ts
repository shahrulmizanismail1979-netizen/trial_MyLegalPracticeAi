import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import type Stripe from "stripe";
import {
  db,
  sarawak20EligibilityTable,
  sarawak20ReservationsTable,
} from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { logger } from "./logger";

export const SARAWAK20_TIER = "sarawak20";
export const SARAWAK20_PRICE_MYR_CENTS = 4_900; // legacy/chambering founding
export const SARAWAK20_PLANS = {
  firm_founding: { amount: 6_900, licenses: 1, capped: true },
  chambering_founding: { amount: 4_900, licenses: 1, capped: true },
  aas_firm: { amount: 9_900, licenses: 3, capped: false },
  legacy: { amount: 4_900, licenses: 1, capped: true },
} as const;
export type Sarawak20Plan = keyof typeof SARAWAK20_PLANS;
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
      plan text NOT NULL DEFAULT 'legacy',
      eligibility_id text,
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
    CREATE TABLE IF NOT EXISTS sarawak20_eligibility (
      id text PRIMARY KEY, cohort text NOT NULL CHECK (cohort IN ('firm', 'chambering')),
      full_name text NOT NULL, firm_name text, practice_location text, advocate_name text,
      pupil_master_name text, pupillage_start_date date, notice_acknowledgement boolean,
      cms_petition_number text, professional_reference text, declaration_accepted boolean NOT NULL,
      status text NOT NULL DEFAULT 'verified', source text NOT NULL, verified_at timestamptz,
      checkout_session_id text, subscription_id text, subscriber_id integer,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(
    sql`ALTER TABLE sarawak20_reservations ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'legacy'`,
  );
  await db.execute(
    sql`ALTER TABLE sarawak20_reservations ADD COLUMN IF NOT EXISTS eligibility_id text`,
  );
  // Development databases may have briefly received the pre-release text
  // version of these columns. Normalize them before the typed Drizzle writes
  // below so boot-time schema repair remains additive and safe.
  await db.execute(sql`
    ALTER TABLE sarawak20_eligibility
      ALTER COLUMN declaration_accepted TYPE boolean
        USING declaration_accepted::boolean,
      ALTER COLUMN notice_acknowledgement TYPE boolean
        USING notice_acknowledgement::boolean
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS sarawak20_eligibility_cache_idx ON sarawak20_eligibility (cohort, advocate_name, firm_name, practice_location, status)`,
  );
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS sarawak20_eligibility_verified_aas_cache_unique
      ON sarawak20_eligibility (cohort, advocate_name, firm_name, practice_location)
      WHERE cohort = 'firm' AND status = 'verified' AND source = 'aas_directory'`,
  );
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
      activePaid: sql<number>`count(*) filter (where ${sarawak20ReservationsTable.status} = 'consumed' and ${sarawak20ReservationsTable.plan} <> 'aas_firm')::int`,
      reserved: sql<number>`count(*) filter (
         where ${sarawak20ReservationsTable.status} in ('creating', 'reserved') and ${sarawak20ReservationsTable.plan} <> 'aas_firm'
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
  const [aasHistory] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sarawak20ReservationsTable)
    .where(eq(sarawak20ReservationsTable.plan, "aas_firm"));
  const aasOfferEstablished = Number(aasHistory?.count ?? 0) > 0;

  return {
    programme: "Project Sarawak 20",
    price: {
      amount: SARAWAK20_PRICE_MYR_CENTS,
      currency: "myr" as const,
      interval: "month" as const,
    },
    foundingRateMonths: SARAWAK20_FOUNDING_RATE_MONTHS,
    cancellableAnytime: true,
    cohorts: (
      Object.entries(SARAWAK20_COHORTS) as [Sarawak20Cohort, string][]
    ).map(([cohort, label]) => {
      const countsForCohort = countByCohort.get(cohort) ?? {
        activePaid: 0,
        reserved: 0,
      };
      const allocated = countsForCohort.activePaid + countsForCohort.reserved;
      const remaining = Math.max(0, SARAWAK20_CAPACITY - allocated);
      const foundingSoldOut =
        cohort === "firm"
          ? remaining === 0 || aasOfferEstablished
          : remaining === 0;
      const currentPlan: Sarawak20Plan =
        cohort === "firm" && foundingSoldOut
          ? "aas_firm"
          : cohort === "firm"
            ? "firm_founding"
            : "chambering_founding";
      const offer = SARAWAK20_PLANS[currentPlan];
      return {
        cohort,
        label,
        capacity: SARAWAK20_CAPACITY,
        ...countsForCohort,
        remaining,
        soldOut: cohort === "chambering" && foundingSoldOut,
        foundingSoldOut,
        currentPlan,
        price: {
          amount: offer.amount,
          currency: "myr" as const,
          interval: "month" as const,
        },
        licenses: offer.licenses,
        unlimited: !offer.capped,
        requiresEligibility: currentPlan === "aas_firm",
      };
    }),
  };
}

export type Sarawak20ReservationClaim =
  | {
      kind: "created";
      id: string;
      plan: Sarawak20Plan;
      eligibilityId: string | null;
      expiresAt: Date;
    }
  | { kind: "reused"; id: string; url: string; expiresAt: Date }
  | { kind: "pending" }
  | { kind: "sold-out" }
  | { kind: "eligibility-required" };

export async function claimSarawak20Reservation(
  cohort: Sarawak20Cohort,
  requestId: string,
  eligibilityId?: string,
): Promise<Sarawak20ReservationClaim> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${cohortLockKey(cohort)}))`,
    );

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
        and ${sarawak20ReservationsTable.plan} <> 'aas_firm' and (
          ${sarawak20ReservationsTable.status} = 'consumed'
          or (
            ${sarawak20ReservationsTable.status} in ('creating', 'reserved')
            and ${sarawak20ReservationsTable.expiresAt} > now()
          )
        )
    `);
    const allocated = Number(
      (countResult.rows[0] as { allocated?: number | string } | undefined)
        ?.allocated ?? 0,
    );
    const [eligibility] = await tx
      .select()
      .from(sarawak20EligibilityTable)
      .where(
        and(
          eq(sarawak20EligibilityTable.id, eligibilityId ?? ""),
          eq(sarawak20EligibilityTable.cohort, cohort),
          eq(sarawak20EligibilityTable.status, "verified"),
        ),
      )
      .limit(1);
    const [aasHistory] = await tx
      .select({ id: sarawak20ReservationsTable.id })
      .from(sarawak20ReservationsTable)
      .where(eq(sarawak20ReservationsTable.plan, "aas_firm"))
      .limit(1);
    const plan: Sarawak20Plan =
      cohort === "firm" && (allocated >= SARAWAK20_CAPACITY || !!aasHistory)
        ? "aas_firm"
        : cohort === "firm"
          ? "firm_founding"
          : "chambering_founding";
    if (cohort === "chambering" && allocated >= SARAWAK20_CAPACITY)
      return { kind: "sold-out" };
    // The public checkout requires an eligibility id. Retaining this internal
    // legacy path keeps historical reservation callers and rows operable.
    if (eligibilityId && !eligibility) return { kind: "eligibility-required" };
    if (plan === "aas_firm") {
      if (!eligibilityId) return { kind: "eligibility-required" };
      if (!eligibility || eligibility.source !== "aas_directory")
        return { kind: "eligibility-required" };
    }

    const id = randomUUID();
    const expiresAt = new Date(Date.now() + RESERVATION_WINDOW_MS);
    await tx.insert(sarawak20ReservationsTable).values({
      id,
      cohort,
      plan,
      eligibilityId: eligibilityId ?? null,
      requestId,
      status: "creating",
      expiresAt,
    });
    return {
      kind: "created",
      id,
      plan,
      eligibilityId: eligibilityId ?? null,
      expiresAt,
    };
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
  if (rows.length === 1) {
    await db
      .update(sarawak20EligibilityTable)
      .set({ checkoutSessionId: params.sessionId })
      .where(
        sql`${sarawak20EligibilityTable.id} = (
          select eligibility_id from sarawak20_reservations
          where id = ${params.reservationId}
        )`,
      );
  }
  return rows.length === 1;
}

export async function releaseSarawak20Reservation(
  reservationId: string,
): Promise<void> {
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
  const reservationId =
    session.metadata?.reservationId ?? session.metadata?.sarawak20ReservationId;
  if (session.metadata?.programme !== SARAWAK20_TIER || !reservationId) return;
  await releaseSarawak20Reservation(reservationId);
}

export async function consumeSarawak20Reservation(params: {
  session: Stripe.Checkout.Session;
  subscriptionId: string | null;
  subscriberId?: number;
}): Promise<boolean> {
  const reservationId =
    params.session.metadata?.reservationId ??
    params.session.metadata?.sarawak20ReservationId;
  const cohort =
    params.session.metadata?.cohort ?? params.session.metadata?.sarawak20Cohort;
  if (
    params.session.metadata?.programme !== SARAWAK20_TIER ||
    !reservationId ||
    !isSarawak20Cohort(cohort)
  ) {
    return true;
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${cohortLockKey(cohort)}))`,
    );

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
    if (
      !reservation ||
      reservation.status === "cancelled" ||
      (params.session.metadata?.plan &&
        params.session.metadata.plan !== reservation.plan) ||
      (params.session.metadata?.eligibilityId &&
        (reservation.eligibilityId ?? "") !==
          params.session.metadata.eligibilityId)
    )
      return false;

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

    if (
      !["creating", "reserved", "expired", "released"].includes(
        reservation.status,
      )
    ) {
      return false;
    }

    // A completion webhook can arrive after the short reservation window or
    // after an expiry delivery raced it. Reclaim the paid place only if doing
    // so still keeps this cohort at or below its hard cap.
    if (reservation.plan === "aas_firm") {
      await tx
        .update(sarawak20ReservationsTable)
        .set({
          status: "consumed",
          subscriptionId: params.subscriptionId,
          subscriberId: params.subscriberId,
        })
        .where(eq(sarawak20ReservationsTable.id, reservationId));
      if (reservation.eligibilityId)
        await tx
          .update(sarawak20EligibilityTable)
          .set({
            subscriptionId: params.subscriptionId,
            subscriberId: params.subscriberId,
          })
          .where(eq(sarawak20EligibilityTable.id, reservation.eligibilityId));
      return true;
    }
    const countResult = await tx.execute(sql`
      select count(*)::int as allocated
      from ${sarawak20ReservationsTable}
      where ${sarawak20ReservationsTable.cohort} = ${cohort}
        and ${sarawak20ReservationsTable.id} <> ${reservationId}
        and ${sarawak20ReservationsTable.plan} <> 'aas_firm'
        and (
          ${sarawak20ReservationsTable.status} = 'consumed'
          or (
            ${sarawak20ReservationsTable.status} in ('creating', 'reserved')
            and ${sarawak20ReservationsTable.expiresAt} > now()
          )
        )
    `);
    const allocated = Number(
      (countResult.rows[0] as { allocated?: number | string } | undefined)
        ?.allocated ?? 0,
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
          inArray(sarawak20ReservationsTable.status, [
            "creating",
            "reserved",
            "expired",
            "released",
          ]),
        ),
      )
      .returning({ id: sarawak20ReservationsTable.id });
    return updated.length === 1;
  });
}

function normalizeDirectoryValue(value: string): string {
  return value
    .replace(
      /&#x([0-9a-f]+);|&#(\d+);|&nbsp;|&amp;|&quot;|&apos;|&#39;/gi,
      (_match, hex, decimal) => {
        if (hex) return String.fromCodePoint(Number.parseInt(hex, 16));
        if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
        return _match.toLowerCase() === "&amp;"
          ? "&"
          : _match.toLowerCase() === "&quot;"
            ? '"'
            : _match.toLowerCase() === "&apos;" || _match === "&#39;"
              ? "'"
              : " ";
      },
    )
    .replace(/[‘’`]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/<[^>]*>/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");
}
export function aasDirectoryHasMatchingCard(
  html: string,
  advocate: string,
  firm: string,
): boolean {
  const expectedAdvocate = normalizeDirectoryValue(advocate);
  const expectedFirm = normalizeDirectoryValue(firm);
  if (!expectedAdvocate || !expectedFirm) return false;
  // Deliberately inspect only a result card's heading and its following firm
  // paragraph: the directory echoes submitted search values outside cards.
  const cardPattern = /<h4\b[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4\b|$)/gi;
  for (const match of html.matchAll(cardPattern)) {
    if (normalizeDirectoryValue(match[1]) !== expectedAdvocate) continue;
    const firmParagraph = match[2].match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1];
    if (!firmParagraph) continue;
    const actualFirm = normalizeDirectoryValue(firmParagraph);
    if (
      actualFirm === expectedFirm ||
      ["kuching", "sibu", "miri", "bintulu"].some(
        (location) => actualFirm === `${expectedFirm} ${location}`,
      )
    ) {
      return true;
    }
  }
  return false;
}

export class Sarawak20EligibilityError extends Error {
  constructor(public readonly code: "not-verified" | "service-unavailable") {
    super(code);
  }
}

export async function createSarawak20Eligibility(input: {
  cohort: Sarawak20Cohort;
  fullName: string;
  firmName?: string;
  practiceLocation?: string;
  advocateName?: string;
  pupilMasterName?: string;
  pupillageStartDate?: string;
  noticeAcknowledgement?: boolean;
  cmsPetitionNumber?: string;
  professionalReference?: string;
  declarationAccepted: true;
}) {
  let source: "aas_directory" | "submitted_details" = "submitted_details";
  const fullName = input.fullName.trim();
  const firmName = input.firmName
    ? normalizeDirectoryValue(input.firmName)
    : null;
  const advocateName = input.advocateName
    ? normalizeDirectoryValue(input.advocateName)
    : null;
  const practiceLocation = input.practiceLocation?.trim().toUpperCase() ?? null;
  if (input.cohort === "firm") {
    const [cached] = await db
      .select({ id: sarawak20EligibilityTable.id })
      .from(sarawak20EligibilityTable)
      .where(
        and(
          eq(sarawak20EligibilityTable.cohort, "firm"),
          eq(sarawak20EligibilityTable.advocateName, advocateName ?? ""),
          eq(sarawak20EligibilityTable.firmName, firmName ?? ""),
          eq(
            sarawak20EligibilityTable.practiceLocation,
            practiceLocation ?? "",
          ),
          eq(sarawak20EligibilityTable.status, "verified"),
          eq(sarawak20EligibilityTable.source, "aas_directory"),
        ),
      )
      .limit(1);
    if (cached) {
      return {
        eligibilityId: cached.id,
        status: "verified" as const,
        source: "aas_directory" as const,
        message: "Your AAS directory eligibility is verified.",
      };
    }
    try {
      const response = await fetch(
        "https://www.sarawakadvocates.com.my/directory/",
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            search: input.advocateName ?? "",
            location: practiceLocation ?? "",
            service: "ADVOCATE",
            gender: "ALL",
          }),
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (!response.ok) throw new Error("directory unavailable");
      if (
        !aasDirectoryHasMatchingCard(
          await response.text(),
          input.advocateName ?? "",
          input.firmName ?? "",
        )
      ) {
        throw new Sarawak20EligibilityError("not-verified");
      }
      source = "aas_directory";
    } catch (error) {
      if (error instanceof Sarawak20EligibilityError) throw error;
      throw new Sarawak20EligibilityError("service-unavailable");
    }
  }
  const id = randomUUID();
  const [inserted] = await db
    .insert(sarawak20EligibilityTable)
    .values({
      id,
      cohort: input.cohort,
      fullName,
      firmName,
      practiceLocation,
      advocateName,
      pupilMasterName: input.pupilMasterName ?? null,
      pupillageStartDate: input.pupillageStartDate ?? null,
      noticeAcknowledgement: input.noticeAcknowledgement ?? null,
      cmsPetitionNumber: input.cmsPetitionNumber ?? null,
      professionalReference: input.professionalReference ?? null,
      declarationAccepted: true,
      status: "verified",
      source,
      verifiedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: sarawak20EligibilityTable.id });
  const eligibilityId =
    inserted?.id ??
    (
      await db
        .select({ id: sarawak20EligibilityTable.id })
        .from(sarawak20EligibilityTable)
        .where(
          and(
            eq(sarawak20EligibilityTable.cohort, "firm"),
            eq(sarawak20EligibilityTable.advocateName, advocateName ?? ""),
            eq(sarawak20EligibilityTable.firmName, firmName ?? ""),
            eq(
              sarawak20EligibilityTable.practiceLocation,
              practiceLocation ?? "",
            ),
            eq(sarawak20EligibilityTable.status, "verified"),
            eq(sarawak20EligibilityTable.source, "aas_directory"),
          ),
        )
        .limit(1)
    )[0]?.id;
  if (!eligibilityId) throw new Error("Could not store verified eligibility");
  return {
    eligibilityId,
    status: "verified" as const,
    source,
    message:
      source === "aas_directory"
        ? "Your AAS directory eligibility is verified."
        : "Your Notice of Pupillage details have been recorded.",
  };
}

export async function cancelSarawak20Enrollment(
  subscriptionId: string,
): Promise<void> {
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
  plan: Sarawak20Plan = "chambering_founding",
): Promise<string> {
  const stripe = stripeClient ?? (await getUncachableStripeClient());
  const foundingRateMonths =
    plan === "aas_firm" ? 0 : SARAWAK20_FOUNDING_RATE_MONTHS;
  const products = await stripe.products.search({
    query: `active:'true' AND metadata['sarawak20_plan']:'${plan}'`,
    limit: 1,
  });

  let productId = products.data[0]?.id;
  if (!productId) {
    const product = await stripe.products.create(
      {
        name:
          plan === "aas_firm"
            ? "LAWYes Project Sarawak 20 — AAS Firm Access"
            : `LAWYes Project Sarawak 20 — ${plan}`,
        description:
          plan === "aas_firm"
            ? "AAS firm access for three licensed users across LAWYes portals."
            : "Founding participation in the Project Sarawak 20 legal AI co-development programme.",
        metadata: {
          programme: SARAWAK20_TIER,
          tier: SARAWAK20_TIER,
          sarawak20_plan: plan,
          founding_rate_months: String(foundingRateMonths),
        },
      },
      { idempotencyKey: `lawyes-sarawak20-product-${plan}-v1` },
    );
    productId = product.id;
  }

  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 10,
  });
  const existing = prices.data.find(
    (price) =>
      price.currency === "myr" &&
      price.unit_amount === SARAWAK20_PLANS[plan].amount &&
      price.recurring?.interval === "month",
  );
  if (existing) return existing.id;

  const price = await stripe.prices.create(
    {
      product: productId,
      currency: "myr",
      unit_amount: SARAWAK20_PLANS[plan].amount,
      recurring: { interval: "month" },
      metadata: {
        programme: SARAWAK20_TIER,
        sarawak20_plan: plan,
        founding_rate_months: String(foundingRateMonths),
      },
    },
    {
      idempotencyKey: `lawyes-sarawak20-price-${plan}-${SARAWAK20_PLANS[plan].amount}-v1`,
    },
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
  plan?: Sarawak20Plan;
  eligibilityId?: string | null;
  expiresAt: number;
}): Stripe.Checkout.SessionCreateParams {
  const metadata = {
    tier: SARAWAK20_TIER,
    programme: SARAWAK20_TIER,
    cohort: params.cohort,
    reservationId: params.reservationId,
    plan:
      params.plan ??
      (params.cohort === "firm" ? "firm_founding" : "chambering_founding"),
    eligibilityId: params.eligibilityId ?? "",
    licenses: String(
      SARAWAK20_PLANS[
        params.plan ??
          (params.cohort === "firm" ? "firm_founding" : "chambering_founding")
      ].licenses,
    ),
    foundingRateMonths: String(
      (params.plan ??
        (params.cohort === "firm"
          ? "firm_founding"
          : "chambering_founding")) === "aas_firm"
        ? 0
        : SARAWAK20_FOUNDING_RATE_MONTHS,
    ),
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
