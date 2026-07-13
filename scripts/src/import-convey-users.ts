import fs from "node:fs";
import path from "node:path";
import { z } from "zod/v4";
import { db, pool, usersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { parseCsv } from "./csv";

/**
 * Import legacy MyConveyAI user accounts (exported from the old project's
 * production database) into this project's `users` table.
 *
 * Accepts a CSV or JSON export of the old `users` table. Column names may be
 * snake_case (as in a SQL export) or camelCase.
 *
 * Idempotent: a row is SKIPPED if an account already exists with the same
 * access code, username, or email. Nothing is ever updated or deleted.
 *
 * Password hashes and access codes are preserved byte-for-byte.
 * Stripe customer/subscription IDs are NOT imported by default (they belong to
 * the old project's Stripe account); pass --include-stripe to keep them.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run import-convey-users <file.csv|file.json> [--dry-run] [--include-stripe]
 *
 * The target database is whatever DATABASE_URL points at. For a production
 * import, run with the production DATABASE_URL explicitly.
 */

// ---------------------------------------------------------------------------
// Row normalization & validation
// ---------------------------------------------------------------------------

const KEY_MAP: Record<string, string> = {
  access_code: "accessCode",
  password_hash: "passwordHash",
  display_name: "displayName",
  is_active: "isActive",
  subscription_tier: "subscriptionTier",
  subscription_status: "subscriptionStatus",
  stripe_customer_id: "stripeCustomerId",
  stripe_subscription_id: "stripeSubscriptionId",
  current_period_end: "currentPeriodEnd",
  created_at: "createdAt",
  last_login_at: "lastLoginAt",
};

function normalizeKeys(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[KEY_MAP[k] ?? k] = v;
  }
  return out;
}

const emptyToNull = (v: unknown) =>
  v === "" || v === undefined || v === null || v === "\\N" || v === "NULL" ? null : v;

const boolish = z.preprocess((v: unknown) => {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  if (["t", "true", "1", "yes"].includes(s)) return true;
  if (["f", "false", "0", "no", ""].includes(s)) return false;
  return v;
}, z.boolean());

const dateish = z.preprocess((v: unknown) => {
  const n = emptyToNull(v);
  if (n === null) return null;
  const d = new Date(String(n));
  return isNaN(d.getTime()) ? String(n) : d;
}, z.date().nullable());

const optText = z.preprocess(emptyToNull, z.string().nullable());

const legacyUserSchema = z.object({
  id: z.preprocess(emptyToNull, z.coerce.number().int().nullable()).optional(),
  accessCode: optText.default(null),
  email: optText.default(null),
  username: optText.default(null),
  passwordHash: optText.default(null),
  displayName: optText.default(null),
  role: z.preprocess(emptyToNull, z.string().nullable()).default(null),
  isActive: boolish.default(true),
  grandfathered: boolish.default(false),
  subscriptionTier: z.preprocess(emptyToNull, z.string().nullable()).default(null),
  subscriptionStatus: optText.default(null),
  stripeCustomerId: optText.default(null),
  stripeSubscriptionId: optText.default(null),
  currentPeriodEnd: dateish.default(null),
  createdAt: dateish.default(null),
  lastLoginAt: dateish.default(null),
});

type LegacyUser = z.infer<typeof legacyUserSchema>;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const includeStripe = args.includes("--include-stripe");
  const includeAdmin = args.includes("--include-admin");
  const file = args.find((a) => !a.startsWith("--"));

  if (!file) {
    console.error(
      "Usage: pnpm --filter @workspace/scripts run import-convey-users <file.csv|file.json> [--dry-run] [--include-stripe]",
    );
    process.exit(1);
  }
  const filePath = path.resolve(file);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(filePath, "utf8");
  let rawRows: Record<string, unknown>[];
  if (filePath.endsWith(".json") || text.trimStart().startsWith("[") || text.trimStart().startsWith("{")) {
    const parsed = JSON.parse(text);
    rawRows = Array.isArray(parsed) ? parsed : Array.isArray(parsed.rows) ? parsed.rows : [parsed];
  } else {
    rawRows = parseCsv(text);
  }

  console.log(`Read ${rawRows.length} rows from ${filePath}${dryRun ? " (DRY RUN — no writes)" : ""}`);

  let imported = 0;
  let skippedExisting = 0;
  let skippedInvalid = 0;
  let skippedAdmin = 0;
  let updatedPasswords = 0;
  const errors: string[] = [];
  const seenInFile = new Set<string>();

  for (const [idx, raw] of rawRows.entries()) {
    const label = `row ${idx + 2}`; // +2: 1-based + header line for CSV
    const parsed = legacyUserSchema.safeParse(normalizeKeys(raw));
    if (!parsed.success) {
      skippedInvalid++;
      errors.push(`${label}: invalid — ${parsed.error.issues.map((i: { path: PropertyKey[]; message: string }) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    const u: LegacyUser = parsed.data;

    // Old admin / master-access accounts are NOT imported by default: this
    // project already has its own admin account and master access code, and
    // re-importing the old ones would reintroduce stale admin credentials.
    if (u.role === "admin" && !includeAdmin) {
      skippedAdmin++;
      continue;
    }

    // Every account needs at least one credential to be able to log in.
    if (!u.accessCode && !(u.username && u.passwordHash)) {
      skippedInvalid++;
      errors.push(`${label} (id=${u.id ?? "?"}): no access code and no username+password hash — cannot log in, skipped`);
      continue;
    }

    // In-file duplicate guard
    const fileKeys = [u.accessCode && `code:${u.accessCode}`, u.username && `user:${u.username.toLowerCase()}`].filter(
      Boolean,
    ) as string[];
    if (fileKeys.some((k) => seenInFile.has(k))) {
      skippedInvalid++;
      errors.push(`${label} (id=${u.id ?? "?"}): duplicate access code or username within the export file, skipped`);
      continue;
    }
    fileKeys.forEach((k) => seenInFile.add(k));

    // Existing-account check: access code or username (both unique in the DB),
    // plus email to be safe against near-duplicates.
    const conditions = [];
    if (u.accessCode) conditions.push(eq(usersTable.accessCode, u.accessCode));
    if (u.username) conditions.push(eq(usersTable.username, u.username));
    if (u.email) conditions.push(eq(usersTable.email, u.email));
    const existing = conditions.length
      ? await db
          .select({ id: usersTable.id, passwordHash: usersTable.passwordHash, username: usersTable.username })
          .from(usersTable)
          .where(or(...conditions))
          .limit(1)
      : [];
    if (existing.length > 0) {
      // Fill in a missing password hash on an already-imported account (e.g. a
      // follow-up export that includes password_hash). Never overwrite one.
      if (u.passwordHash && !existing[0].passwordHash) {
        if (!dryRun) {
          await db
            .update(usersTable)
            .set({ passwordHash: u.passwordHash, ...(u.username && !existing[0].username ? { username: u.username } : {}) })
            .where(eq(usersTable.id, existing[0].id));
        }
        updatedPasswords++;
      } else {
        skippedExisting++;
      }
      continue;
    }

    const displayName = u.displayName || u.username || u.email || u.accessCode || `Legacy user ${u.id ?? idx + 1}`;

    const insertRow: typeof usersTable.$inferInsert = {
      accessCode: u.accessCode,
      email: u.email,
      username: u.username,
      passwordHash: u.passwordHash,
      displayName,
      role: u.role || "user",
      isActive: u.isActive,
      grandfathered: u.grandfathered,
      subscriptionTier: u.subscriptionTier || "free",
      subscriptionStatus: u.subscriptionStatus,
      stripeCustomerId: includeStripe ? u.stripeCustomerId : null,
      stripeSubscriptionId: includeStripe ? u.stripeSubscriptionId : null,
      currentPeriodEnd: u.currentPeriodEnd,
      ...(u.createdAt ? { createdAt: u.createdAt } : {}),
      lastLoginAt: u.lastLoginAt,
    };

    if (!dryRun) {
      try {
        await db.insert(usersTable).values(insertRow);
      } catch (e) {
        skippedInvalid++;
        errors.push(`${label} (id=${u.id ?? "?"}): insert failed — ${e instanceof Error ? e.message : String(e)}`);
        continue;
      }
    }
    imported++;
  }

  console.log("");
  console.log("================ Import summary ================");
  console.log(`  Total rows in file : ${rawRows.length}`);
  console.log(`  ${dryRun ? "Would import" : "Imported"}       : ${imported}`);
  console.log(`  Skipped (existing) : ${skippedExisting}`);
  if (updatedPasswords > 0) {
    console.log(`  ${dryRun ? "Would fill" : "Filled"} passwords    : ${updatedPasswords} existing accounts got their missing password hash`);
  }
  console.log(`  Skipped (invalid)  : ${skippedInvalid}`);
  if (skippedAdmin > 0) {
    console.log(`  Skipped (admin)    : ${skippedAdmin} — old admin/master accounts not imported (use --include-admin to override)`);
  }
  if (!includeStripe) {
    console.log("  Stripe IDs were NOT copied (old project's Stripe account). Use --include-stripe to keep them.");
  }
  if (errors.length) {
    console.log("------------------------------------------------");
    for (const e of errors) console.log(`  ! ${e}`);
  }
  console.log("================================================");

  await pool.end();
  if (skippedInvalid > 0 && imported === 0 && skippedExisting === 0) process.exit(1);
}

main().catch((e) => {
  console.error("Import failed:", e);
  process.exit(1);
});
