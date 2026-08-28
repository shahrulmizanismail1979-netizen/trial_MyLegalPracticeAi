import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/**
 * Production deployments do not automatically run repository migrations.
 * Keep this additive and idempotent so both boot and route-level callers can
 * guarantee the preparation state column exists without changing any rows.
 */
export async function ensureMatterPreparationSchema(): Promise<void> {
  await db.execute(
    sql`ALTER TABLE lit_matters ADD COLUMN IF NOT EXISTS preparation_state jsonb`,
  );
}