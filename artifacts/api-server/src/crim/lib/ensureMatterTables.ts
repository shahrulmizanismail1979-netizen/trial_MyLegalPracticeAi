// Boot-time schema ensure for the MyCrimAI matter-file tables.
//
// The monorepo deliberately avoids `drizzle-kit push` for new tables (it
// proposes destructive renames of unrelated tables), so — following the same
// pattern as the crim session table and the upload-ownership registry — the
// tables are created idempotently at startup. This guarantees production gets
// the schema on its next publish without a manual migration step.
import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";

const DDL = `
CREATE TABLE IF NOT EXISTS "crim_matters" (
  "id" serial PRIMARY KEY,
  "access_code_id" integer NOT NULL REFERENCES "crim_access_codes"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "file_ref" text,
  "client_name" text,
  "accused_name" text,
  "charge" text,
  "court" text,
  "case_no" text,
  "stage" text,
  "workflow_id" integer,
  "status" text NOT NULL DEFAULT 'open',
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "crim_matter_deadlines" (
  "id" serial PRIMARY KEY,
  "matter_id" integer NOT NULL REFERENCES "crim_matters"("id") ON DELETE CASCADE,
  "access_code_id" integer NOT NULL REFERENCES "crim_access_codes"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "due_date" timestamptz NOT NULL,
  "category" text NOT NULL DEFAULT 'custom',
  "status" text NOT NULL DEFAULT 'pending',
  "basis" text,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "crim_saved_work" (
  "id" serial PRIMARY KEY,
  "access_code_id" integer NOT NULL REFERENCES "crim_access_codes"("id") ON DELETE CASCADE,
  "matter_id" integer,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "matter" text,
  "input_json" jsonb,
  "content" text NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_crim_matters_access_code" ON "crim_matters" ("access_code_id");
CREATE INDEX IF NOT EXISTS "idx_crim_matter_deadlines_matter" ON "crim_matter_deadlines" ("matter_id");
CREATE INDEX IF NOT EXISTS "idx_crim_matter_deadlines_access_code" ON "crim_matter_deadlines" ("access_code_id");
CREATE INDEX IF NOT EXISTS "idx_crim_saved_work_access_code" ON "crim_saved_work" ("access_code_id");
`;

let ensured: Promise<void> | null = null;

export function ensureCrimMatterTables(): Promise<void> {
  if (!ensured) {
    ensured = pool
      .query(DDL)
      .then(() => {
        logger.info("crim matter tables ensured");
      })
      .catch((err) => {
        ensured = null; // allow retry on next call
        logger.error({ err }, "Failed to ensure crim matter tables");
        throw err;
      });
  }
  return ensured;
}
