/**
 * Boot-time DDL for the shared AI case intelligence tables used by all portals:
 *  - case_checklists:      per-matter procedural checklist items (AI-generated + custom)
 *  - case_ai_insights:     cached AI-generated next-steps / summary / risk per matter
 *  - case_time_entries:    time recording entries per matter
 *  - case_clients:         client contacts for non-lit portals (lit uses lit_clients)
 *  - case_stage_history:   audit trail of matter stage/status changes
 *
 * All tables are portal-scoped so a single table serves all 6 portals.
 * Created via direct SQL — NOT drizzle push (rename trap, see memory).
 */
import { pool } from "@workspace/db";
import { logger } from "./logger";

const DDL = `
CREATE TABLE IF NOT EXISTS case_checklists (
  id serial PRIMARY KEY,
  portal text NOT NULL,
  matter_id integer NOT NULL,
  owner_key text NOT NULL,
  item_text text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_checklists_matter ON case_checklists (portal, matter_id);

CREATE TABLE IF NOT EXISTS case_ai_insights (
  id serial PRIMARY KEY,
  portal text NOT NULL,
  matter_id integer NOT NULL,
  next_steps jsonb,
  case_summary text,
  risk_assessment jsonb,
  cached_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_ai_insights_unique ON case_ai_insights (portal, matter_id);

CREATE TABLE IF NOT EXISTS case_time_entries (
  id serial PRIMARY KEY,
  portal text NOT NULL,
  matter_id integer NOT NULL,
  owner_key text NOT NULL,
  description text NOT NULL,
  minutes integer NOT NULL DEFAULT 0,
  rate_usd numeric(10,2),
  entry_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_time_entries_matter ON case_time_entries (portal, matter_id);
-- Additive columns added over time via ALTER TABLE so existing rows get NULL defaults.
-- These must be listed here (not only in ensureBillingTables) so test setups that call
-- ensureCaseIntelligenceTables without ensureBillingTables also have the columns.
ALTER TABLE case_time_entries ADD COLUMN IF NOT EXISTS invoice_id integer;
ALTER TABLE case_time_entries ADD COLUMN IF NOT EXISTS activity_type text;
ALTER TABLE case_time_entries ADD COLUMN IF NOT EXISTS lawyer_level text;
ALTER TABLE case_time_entries ADD COLUMN IF NOT EXISTS lawyer_name text;
ALTER TABLE case_time_entries ADD COLUMN IF NOT EXISTS rate_source text;
-- NOTE: we intentionally do NOT back-fill rate_source for historic rows.
-- Before rate_source was tracked, both rate-card-derived and manually-entered
-- entries wrote only rate_usd; there is no reliable discriminator between them.
-- The UI shows a neutral "legacy rate" badge for any row where rate_source IS NULL
-- and rate_usd IS NOT NULL, so old entries are displayed correctly without mutation.

CREATE TABLE IF NOT EXISTS case_clients (
  id serial PRIMARY KEY,
  portal text NOT NULL,
  owner_key text NOT NULL,
  name text NOT NULL,
  ic_number text,
  company_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_clients_owner ON case_clients (portal, owner_key);

CREATE TABLE IF NOT EXISTS case_stage_history (
  id serial PRIMARY KEY,
  portal text NOT NULL,
  matter_id integer NOT NULL,
  from_stage text,
  to_stage text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_case_stage_history_matter ON case_stage_history (portal, matter_id);

CREATE TABLE IF NOT EXISTS case_intake_briefing (
  id serial PRIMARY KEY,
  portal text NOT NULL,
  matter_id integer NOT NULL,
  parties jsonb,
  key_facts jsonb,
  legal_issues jsonb,
  initial_actions jsonb,
  generated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_case_intake_briefing_unique ON case_intake_briefing (portal, matter_id);
`;

let ensured: Promise<void> | null = null;

export function ensureCaseIntelligenceTables(): Promise<void> {
  if (!ensured) {
    ensured = pool
      .query(DDL)
      .then(() => {
        logger.info("Case intelligence tables ensured");
      })
      .catch((err) => {
        ensured = null;
        logger.error({ err }, "Failed to ensure case intelligence tables");
        throw err;
      });
  }
  return ensured;
}
