-- Project Sarawak 20 post-founding AAS plan and eligibility ledger. Additive.
ALTER TABLE sarawak20_reservations
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS eligibility_id text,
  ADD CONSTRAINT sarawak20_reservations_plan_check
    CHECK (plan IN ('legacy', 'firm_founding', 'chambering_founding', 'aas_firm'));

CREATE TABLE IF NOT EXISTS sarawak20_eligibility (
  id text PRIMARY KEY,
  cohort text NOT NULL CHECK (cohort IN ('firm', 'chambering')),
  full_name text NOT NULL,
  firm_name text,
  practice_location text CHECK (practice_location IN ('KUCHING', 'SIBU', 'MIRI', 'BINTULU')),
  advocate_name text,
  pupil_master_name text,
  pupillage_start_date date,
  notice_acknowledgement boolean,
  cms_petition_number text,
  professional_reference text,
  declaration_accepted boolean NOT NULL,
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'not_verified')),
  source text NOT NULL CHECK (source IN ('aas_directory', 'submitted_details')),
  verified_at timestamptz,
  checkout_session_id text,
  subscription_id text,
  subscriber_id integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sarawak20_eligibility_cohort_status_idx
  ON sarawak20_eligibility (cohort, status);
CREATE INDEX IF NOT EXISTS sarawak20_eligibility_cache_idx
  ON sarawak20_eligibility (cohort, advocate_name, firm_name, practice_location, status);
CREATE UNIQUE INDEX IF NOT EXISTS sarawak20_eligibility_verified_aas_cache_unique
  ON sarawak20_eligibility (cohort, advocate_name, firm_name, practice_location)
  WHERE cohort = 'firm' AND status = 'verified' AND source = 'aas_directory';