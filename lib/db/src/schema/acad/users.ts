import {
  pgTable,
  text,
  integer,
  timestamp,
  uniqueIndex,
  index,
  json,
} from "drizzle-orm/pg-core";

/**
 * Examiner / admin accounts. Candidates do NOT have user rows — they remain
 * passwordless and just type a code + display name to join an exam.
 *
 * `role` is one of:
 *   - "teacher" — owns and manages their own exam templates / sessions.
 *   - "admin"   — superuser. Can manage all users and CRUD any teacher's
 *                 templates and exam attempts.
 *
 * `status`:
 *   - "active"    — can log in.
 *   - "suspended" — login is rejected; admin set this.
 */
export const usersTable = pgTable(
  "acad_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    // Nullable so OAuth-only users (Google / Facebook) can exist without ever
    // having had a local password. Email/password users always get a hash.
    passwordHash: text("password_hash"),
    // Which external identity provider owns this account: null = local
    // (email+password), "google" = Google OAuth, "facebook" = Facebook OAuth.
    oauthProvider: text("oauth_provider"),
    oauthSubject: text("oauth_subject"),
    name: text("name").notNull(),
    role: text("role").notNull().default("teacher"),
    status: text("status").notNull().default("active"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    subscriptionTier: text("subscription_tier").notNull().default("free"),
    subscriptionStatus: text("subscription_status"),
    /**
     * Stripe Checkout session IDs whose license credential has already been
     * issued. One credential per successful checkout. Drives the
     * "show the freshly-issued password ONCE" UX on /billing?status=success.
     */
    // Landing-page team-bundle integration: bundle purchasers log in to
    // MyLawAcad with their cross-portal access code. NULL for normal
    // email/OAuth accounts. maxSeats caps concurrent sessions per code
    // (NULL = no cap); accessCodeExpiresAt mirrors the subscription expiry.
    accessCode: text("access_code"),
    maxSeats: integer("max_seats"),
    accessCodeExpiresAt: timestamp("access_code_expires_at", { withTimezone: true }),
    licenseClaimedSessionIds: json("license_claimed_session_ids")
      .$type<string[]>()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => ({
    // Case-insensitive uniqueness on email so "Alice@x.com" and
    // "alice@x.com" can't both exist.
    emailUniqueCi: uniqueIndex("acad_users_email_lower_unique").on(table.email),
  }),
);

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

/**
 * Backing store for express-session via connect-pg-simple. We declare it in
 * Drizzle so the schema push creates it ahead of time — this avoids
 * connect-pg-simple's runtime "createTableIfMissing" path, which tries to
 * read a `table.sql` file from disk that doesn't survive esbuild bundling.
 *
 * The shape (sid varchar PK, sess json, expire timestamp(6)) and table name
 * (`user_sessions`) must match what connect-pg-simple expects.
 */
export const userSessionsTable = pgTable(
  "acad_user_sessions",
  {
    sid: text("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => ({
    expireIdx: index("acad_IDX_session_expire").on(table.expire),
  }),
);
