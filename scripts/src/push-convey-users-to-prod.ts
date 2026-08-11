/**
 * Push legacy MyConveyAI user accounts to the LIVE (production) app.
 *
 * Default mode (no file arguments): reads the fully-migrated accounts straight
 * from the DEVELOPMENT database (where the legacy import was verified) and
 * POSTs them to the deployed app's admin import endpoint
 * (/api/convey-admin/import-users). The endpoint applies the same idempotent
 * rules as the local import script: existing accounts are skipped, and a
 * missing password hash is filled but never overwritten.
 *
 * CSV mode (optional): pass the two export CSVs (full users export +
 * password-hash export) to build the payload from files instead.
 *
 * Requirements:
 *   - The live app must be published WITH the import endpoint.
 *   - ADMIN_PASSWORD must be set in the environment (same value as the
 *     deployed app's ADMIN_PASSWORD secret).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run push-convey-users-to-prod [--dry-run]
 *   pnpm --filter @workspace/scripts run push-convey-users-to-prod \
 *     <users.csv> <password_hashes.csv> [--url https://example.com] [--dry-run]
 */

import fs from "node:fs";
import { like } from "drizzle-orm";
import { db, pool, usersTable } from "@workspace/db";
import { parseCsv } from "./csv";

const DEFAULT_URL = "https://mylegalpracticeai.life";

type PayloadRow = Record<string, string>;

function usersFromCsv(files: string[]): {
  users: PayloadRow[];
  skippedAdmin: number;
  skippedEmpty: number;
} {
  const usersRows = parseCsv(fs.readFileSync(files[0], "utf8"));
  const hashRows = files[1] ? parseCsv(fs.readFileSync(files[1], "utf8")) : [];

  const hashById = new Map<string, string>();
  for (const r of hashRows) {
    const id = (r.id ?? "").trim();
    const hash = (r.password_hash ?? "").trim();
    if (id && hash) hashById.set(id, hash);
  }

  let skippedAdmin = 0;
  let skippedEmpty = 0;
  const users: PayloadRow[] = [];
  for (const r of usersRows) {
    const id = (r.id ?? "").trim();
    const username = (r.username ?? "").trim();
    const accessCode = (r.access_code ?? "").trim();
    if (!username && !accessCode) {
      skippedEmpty++;
      continue;
    }
    if ((r.role ?? "").trim() === "admin" || username === "admin") {
      skippedAdmin++;
      continue;
    }
    const row: PayloadRow = { ...r };
    const hash = hashById.get(id);
    if (hash) row.password_hash = hash;
    users.push(row);
  }
  return { users, skippedAdmin, skippedEmpty };
}

async function usersFromDevDb(): Promise<{
  users: PayloadRow[];
  skippedAdmin: number;
  skippedEmpty: number;
}> {
  // Scope to the legacy cohort: all legacy MyConveyAI accounts carry a
  // standard-format access code. This keeps dev-only/test accounts out.
  const rows = await db
    .select()
    .from(usersTable)
    .where(like(usersTable.accessCode, "MYCV-%"));

  let skippedAdmin = 0;
  const users: PayloadRow[] = [];
  for (const r of rows) {
    if (r.role === "admin" || r.username === "admin") {
      skippedAdmin++;
      continue;
    }
    const row: PayloadRow = {};
    if (r.username) row.username = r.username;
    if (r.email) row.email = r.email;
    if (r.displayName) row.display_name = r.displayName;
    if (r.role) row.role = r.role;
    row.is_active = r.isActive ? "t" : "f";
    row.grandfathered = r.grandfathered ? "t" : "f";
    if (r.subscriptionTier) row.subscription_tier = r.subscriptionTier;
    if (r.subscriptionStatus) row.subscription_status = r.subscriptionStatus;
    if (r.accessCode) row.access_code = r.accessCode;
    if (r.passwordHash) row.password_hash = r.passwordHash;
    if (r.createdAt) row.created_at = r.createdAt.toISOString();
    if (r.lastLoginAt) row.last_login_at = r.lastLoginAt.toISOString();
    users.push(row);
  }
  return { users, skippedAdmin, skippedEmpty: 0 };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const urlFlag = args.indexOf("--url");
  const baseUrl = urlFlag !== -1 ? args[urlFlag + 1] : DEFAULT_URL;
  const files = args.filter(
    (a, i) => !a.startsWith("--") && (urlFlag === -1 || i !== urlFlag + 1),
  );

  const adminToken = process.env.ADMIN_PASSWORD;
  if (!dryRun && !adminToken) {
    console.error("ADMIN_PASSWORD is not set in the environment. Aborting.");
    process.exit(1);
  }

  const source = files.length > 0 ? "csv" : "dev database";
  const { users, skippedAdmin, skippedEmpty } =
    files.length > 0 ? usersFromCsv(files) : await usersFromDevDb();

  const withPassword = users.filter((u) => (u.password_hash ?? "").trim() !== "").length;
  console.log(`Source: ${source}`);
  console.log(`Prepared ${users.length} accounts (${withPassword} with hashed credentials).`);
  console.log(`Skipped: ${skippedAdmin} admin rows, ${skippedEmpty} empty rows.`);

  if (dryRun) {
    console.log("DRY RUN — nothing sent to the live app.");
    return;
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/api/convey-admin/import-users`;
  console.log(`Sending to ${endpoint} ...`);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken as string,
    },
    body: JSON.stringify({ users }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Request failed with status ${res.status}: ${body.slice(0, 500)}`);
    process.exit(1);
  }
  const result = JSON.parse(body);
  console.log("================ Live import result ================");
  console.log(`  Total sent          : ${result.total}`);
  console.log(`  Imported (new)      : ${result.imported}`);
  console.log(`  Credentials filled  : ${result.updatedPasswords}`);
  console.log(`  Skipped (existing)  : ${result.skippedExisting}`);
  console.log(`  Skipped (admin)     : ${result.skippedAdmin}`);
  console.log(`  Skipped (invalid)   : ${result.skippedInvalid}`);
  if (Array.isArray(result.errors) && result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`);
    for (const e of result.errors) console.log(`    - ${e}`);
  }
  console.log("====================================================");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
