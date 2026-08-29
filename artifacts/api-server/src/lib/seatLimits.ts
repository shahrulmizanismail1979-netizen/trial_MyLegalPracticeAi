// Team-bundle seat-limit enforcement shared by every portal.
//
// A landing-page team bundle (BUNDLE_TIER_CATALOG) grants ONE access code
// with N licensed seats. Each portal counts distinct concurrent
// users/devices ("seats") per code — following the MyAccidentAI maxUsers
// pattern — and rejects logins beyond the licensed count.
//
// A seat is identified by a stable seat key: the express session ID for
// session-based portals (crim/lit/sya), or a device fingerprint (IP +
// user-agent hash) for token/cookie portals (ccb/firm/convey). Seats expire
// after SEAT_TTL_MS of inactivity so abandoned devices free their seat.
// MyAccidentAI keeps its own access_code_usage counter, and MyCorpLegalAI
// enforces via its corp_sessions table; the remaining portals use the shared
// portal_code_seats table here.
import crypto from "node:crypto";
import type { Request } from "express";
import { and, eq, lt, sql } from "drizzle-orm";
import { db, portalCodeSeatsTable } from "@workspace/db";
import { logger } from "./logger";

/** A seat is freed after this long without activity (login or auth check). */
export const SEAT_TTL_MS = 24 * 60 * 60 * 1000;

export type SeatPortal = "crim" | "lit" | "sya" | "ccb" | "firm" | "convey" | "acad";

/**
 * Stable per-device seat key for portals whose auth has no server-side
 * session ID (JWT / signed cookie / opaque token). Approximates a "device"
 * as IP + user-agent, so repeated logins from the same device reuse a seat.
 */
export function deviceSeatKey(req: Request): string {
  const ua = req.headers["user-agent"] ?? "";
  const ip = req.ip ?? "";
  return crypto.createHash("sha256").update(`${ip}|${ua}`).digest("hex").slice(0, 32);
}

function normCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Claim (or refresh) a seat on an access code. Atomic per (portal, code) via
 * an advisory transaction lock so concurrent logins cannot oversubscribe.
 *
 * `maxSeats` null/undefined = no seat limit configured (legacy code) → allow
 * without recording. Returns `{ ok: false }` when all licensed seats are
 * held by other active seat keys.
 */
export async function claimSeat(params: {
  portal: SeatPortal;
  code: string;
  maxSeats: number | null | undefined;
  seatKey: string;
}): Promise<{ ok: true } | { ok: false; maxSeats: number }> {
  const { portal, seatKey } = params;
  const code = normCode(params.code);
  const maxSeats = params.maxSeats;
  if (maxSeats == null) return { ok: true };
  const limit = Math.max(1, maxSeats);
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`seats:${portal}:${code}`}))`,
    );
    const cutoff = new Date(Date.now() - SEAT_TTL_MS);
    // Expire stale seats first so an abandoned device frees its seat.
    await tx
      .delete(portalCodeSeatsTable)
      .where(
        and(
          eq(portalCodeSeatsTable.portal, portal),
          eq(portalCodeSeatsTable.code, code),
          lt(portalCodeSeatsTable.lastSeenAt, cutoff),
        ),
      );
    const existing = await tx
      .select({ id: portalCodeSeatsTable.id, seatKey: portalCodeSeatsTable.seatKey })
      .from(portalCodeSeatsTable)
      .where(
        and(eq(portalCodeSeatsTable.portal, portal), eq(portalCodeSeatsTable.code, code)),
      );
    const mine = existing.find((s) => s.seatKey === seatKey);
    if (mine) {
      await tx
        .update(portalCodeSeatsTable)
        .set({ lastSeenAt: new Date() })
        .where(eq(portalCodeSeatsTable.id, mine.id));
      return { ok: true as const };
    }
    if (existing.length >= limit) {
      return { ok: false as const, maxSeats: limit };
    }
    await tx.insert(portalCodeSeatsTable).values({ portal, code, seatKey });
    return { ok: true as const };
  });
}

/** Free a seat (logout). Seat keys are unique enough per portal to omit the code. */
export async function releaseSeat(portal: SeatPortal, seatKey: string): Promise<void> {
  try {
    await db
      .delete(portalCodeSeatsTable)
      .where(
        and(eq(portalCodeSeatsTable.portal, portal), eq(portalCodeSeatsTable.seatKey, seatKey)),
      );
  } catch (err) {
    logger.error({ err, portal }, "Failed to release portal seat");
  }
}

/**
 * True if this seat key currently holds an active (non-stale) seat on the
 * code. Refreshes last_seen_at as a side effect (keeps active devices alive).
 */
export async function hasActiveSeat(
  portal: SeatPortal,
  code: string,
  seatKey: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - SEAT_TTL_MS);
  const rows = await db
    .update(portalCodeSeatsTable)
    .set({ lastSeenAt: new Date() })
    .where(
      and(
        eq(portalCodeSeatsTable.portal, portal),
        eq(portalCodeSeatsTable.code, normCode(code)),
        eq(portalCodeSeatsTable.seatKey, seatKey),
        sql`${portalCodeSeatsTable.lastSeenAt} >= ${cutoff}`,
      ),
    )
    .returning({ id: portalCodeSeatsTable.id });
  return rows.length > 0;
}

/**
 * Read-only counterpart to hasActiveSeat: true if this seat key currently
 * holds an active (non-stale) seat on the code, WITHOUT refreshing
 * last_seen_at. Used by side-effect-free identity probes (e.g. the persona
 * write authorizer) that must not extend a seat's life or mutate any state.
 */
export async function seatIsActiveReadOnly(
  portal: SeatPortal,
  code: string,
  seatKey: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - SEAT_TTL_MS);
  const rows = await db
    .select({ id: portalCodeSeatsTable.id })
    .from(portalCodeSeatsTable)
    .where(
      and(
        eq(portalCodeSeatsTable.portal, portal),
        eq(portalCodeSeatsTable.code, normCode(code)),
        eq(portalCodeSeatsTable.seatKey, seatKey),
        sql`${portalCodeSeatsTable.lastSeenAt} >= ${cutoff}`,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** User-facing message when a code's licensed seats are all in use. */
export function seatLimitMessage(maxSeats: number): string {
  return `This access code has reached its licensed seat limit (${maxSeats} concurrent user${maxSeats === 1 ? "" : "s"}). Please log out on another device or contact your administrator to add licenses.`;
}

/**
 * Boot-time schema ensure (direct SQL — drizzle push proposes unsafe renames
 * on this DB; see repo memory). Idempotent; runs on every boot so production
 * self-heals on the next publish.
 */
export async function ensureSeatLimitSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS portal_code_seats (
      id serial PRIMARY KEY,
      portal text NOT NULL,
      code text NOT NULL,
      seat_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS portal_code_seats_portal_code_seat_key_uniq
    ON portal_code_seats (portal, code, seat_key)
  `);
  await db.execute(sql`ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS licenses integer`);
  const codeTables = [
    "crim_access_codes",
    "corp_access_codes",
    "lit_access_codes",
    "sya_access_codes",
    "ccb_access_codes",
    "firm_access_codes",
    "users",
  ];
  for (const table of codeTables) {
    await db.execute(
      sql.raw(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS max_seats integer`),
    );
  }
  // MyLawAcad: bundle access codes log in via a dedicated code path; the
  // code + cap live on the acad_users row that provisioning creates.
  await db.execute(sql`ALTER TABLE acad_users ADD COLUMN IF NOT EXISTS access_code text`);
  await db.execute(sql`ALTER TABLE acad_users ADD COLUMN IF NOT EXISTS max_seats integer`);
  await db.execute(
    sql`ALTER TABLE acad_users ADD COLUMN IF NOT EXISTS access_code_expires_at timestamptz`,
  );
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS acad_users_access_code_unique
    ON acad_users (access_code)
  `);
  logger.info("Seat-limit schema ensured");
}
