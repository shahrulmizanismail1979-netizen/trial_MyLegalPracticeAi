/**
 * Import legacy access codes (exported as CSV from an old standalone app)
 * into this project's per-portal access-code tables via the api-server's
 * /api/legacy-codes/import endpoint.
 *
 * Idempotent: existing codes are never modified; only missing codes are
 * inserted. Re-running is always safe.
 *
 * CSV columns are matched flexibly (case-insensitive):
 *   code                      -> code | access_code | accesscode | password
 *   name                      -> name | recipient | recipient_name | label | customer_name
 *   email                     -> email | recipient_email | customer_email
 *   active                    -> status | active | is_active  (active/true/1/yes = active)
 *   expiry                    -> expires_at | expiry | expires | expiry_date
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run import-legacy-codes -- \
 *     --app lit --file /tmp/mylitai-codes.csv [--prod] [--dry-run]
 *
 *   --app     one of: lit, crim, corp, ccb, sya, accident
 *   --file    path to the CSV export
 *   --prod    send to the live site instead of the local dev server
 *   --dry-run parse + validate only, insert nothing
 *
 * Requires ADMIN_PASSWORD in the environment (same secret as the server).
 */

import fs from "node:fs";
import { parseCsv } from "./csv";

const DEV_URL = "http://localhost:80";
const PROD_URL = "https://mylegalpracticeai.life";
const APPS = ["lit", "crim", "corp", "ccb", "sya", "accident"] as const;

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function pick(row: Record<string, string>, keys: string[]): string {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) lower[k.toLowerCase().trim()] = v;
  for (const k of keys) {
    const v = lower[k];
    if (v !== undefined && v.trim() !== "") return v.trim();
  }
  return "";
}

function parseActive(raw: string): boolean {
  if (raw === "") return true;
  const v = raw.toLowerCase();
  if (["active", "true", "1", "yes", "y", "enabled"].includes(v)) return true;
  if (["inactive", "false", "0", "no", "n", "revoked", "disabled", "expired", "suspended"].includes(v)) return false;
  return true;
}

async function main() {
  const app = getArg("--app");
  const file = getArg("--file");
  const prod = process.argv.includes("--prod");
  const dryRun = process.argv.includes("--dry-run");
  const urlOverride = getArg("--url");
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!app || !(APPS as readonly string[]).includes(app)) {
    console.error(`--app must be one of: ${APPS.join(", ")}`);
    process.exit(1);
  }
  if (!file || !fs.existsSync(file)) {
    console.error("--file must point to an existing CSV file");
    process.exit(1);
  }
  if (!adminPassword) {
    console.error("ADMIN_PASSWORD is not set in the environment");
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const codes = [];
  let skippedNoCode = 0;
  for (const row of rows) {
    const code = pick(row, ["code", "access_code", "accesscode", "access code", "password"]);
    if (!code) {
      skippedNoCode++;
      continue;
    }
    const name = pick(row, ["name", "recipient", "recipient_name", "recipientname", "label", "customer_name", "customer"]);
    const email = pick(row, ["email", "recipient_email", "recipientemail", "customer_email"]);
    const active = parseActive(pick(row, ["status", "active", "is_active", "isactive"]));
    const expiresAt = pick(row, ["expires_at", "expiresat", "expiry", "expires", "expiry_date", "expiration"]);
    codes.push({
      code,
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      active,
      ...(expiresAt ? { expiresAt } : {}),
    });
  }

  console.log(`Parsed ${rows.length} rows: ${codes.length} codes, ${skippedNoCode} skipped (no code).`);
  if (codes.length === 0) {
    console.error("Nothing to import.");
    process.exit(1);
  }

  const base = urlOverride ?? (prod ? PROD_URL : DEV_URL);
  const target = `${base}/api/legacy-codes/import`;
  console.log(`${dryRun ? "[DRY RUN] " : ""}Sending ${codes.length} codes for app "${app}" to ${target}`);

  const res = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminPassword,
    },
    body: JSON.stringify({ app, codes, ...(dryRun ? { dryRun: true } : {}) }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`Import failed (${res.status}): ${body}`);
    process.exit(1);
  }
  console.log(`Result: ${body}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
