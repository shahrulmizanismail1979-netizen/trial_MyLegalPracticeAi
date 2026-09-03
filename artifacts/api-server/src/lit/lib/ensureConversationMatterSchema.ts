import { pool } from "@workspace/db";
import { logger } from "../../lib/logger";

const DDL = `
ALTER TABLE lit_conversations
  ADD COLUMN IF NOT EXISTS matter_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint constraint_row
      JOIN pg_attribute column_row
        ON column_row.attrelid = constraint_row.conrelid
       AND column_row.attnum = ANY (constraint_row.conkey)
     WHERE constraint_row.conrelid = 'lit_conversations'::regclass
       AND constraint_row.contype = 'f'
       AND column_row.attname = 'matter_id'
  ) THEN
    ALTER TABLE lit_conversations
      ADD CONSTRAINT lit_conversations_matter_id_lit_matters_id_fk
      FOREIGN KEY (matter_id) REFERENCES lit_matters(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS lit_conversations_owner_matter_idx
  ON lit_conversations(access_code_id, matter_id);
`;

let ensured: Promise<void> | null = null;

/**
 * Production deployments do not automatically run repository SQL migrations.
 * Keep this additive, idempotent, and cached so route-level and boot callers
 * can safely share the same in-flight schema repair.
 */
export function ensureConversationMatterSchema(): Promise<void> {
  if (!ensured) {
    ensured = pool
      .query(DDL)
      .then(() => {
        logger.info("Lit conversation matter schema ensured");
      })
      .catch((err) => {
        ensured = null;
        logger.error({ err }, "Failed to ensure lit conversation matter schema");
        throw err;
      });
  }
  return ensured;
}