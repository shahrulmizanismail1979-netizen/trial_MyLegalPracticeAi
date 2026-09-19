-- Explicit tenant discriminator for all MyLawFirmAI data. Existing rows are
-- owner-private and are therefore preserved in workspace 0.
ALTER TABLE IF EXISTS firm_users ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_tasks ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_goals ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_kpis ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_meetings ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_activity ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_assessments ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_attempts ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_collaborators ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_evidence ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_task_notes ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_profiles ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_leave_entitlements ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_leave_requests ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_attendance ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_payroll_runs ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_hr_payslips ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_accounts_office_entries ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_accounts_client_ledgers ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_accounts_client_entries ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS firm_accounts_budgets ADD COLUMN IF NOT EXISTS workspace_id integer NOT NULL DEFAULT 0;

-- Business uniqueness is per workspace, never global.
ALTER TABLE firm_users DROP CONSTRAINT IF EXISTS firm_users_email_unique;
ALTER TABLE firm_task_assessments DROP CONSTRAINT IF EXISTS firm_task_assessments_task_id_unique;
ALTER TABLE firm_task_collaborators DROP CONSTRAINT IF EXISTS firm_task_collaborators_task_id_user_id_unique;
ALTER TABLE firm_hr_leave_entitlements DROP CONSTRAINT IF EXISTS firm_hr_leave_entitlements_user_id_year_leave_type_unique;
ALTER TABLE firm_hr_attendance DROP CONSTRAINT IF EXISTS firm_hr_attendance_user_id_work_date_unique;
ALTER TABLE firm_hr_leave_entitlements DROP CONSTRAINT IF EXISTS firm_hr_leave_entitlements_user_id_year_leave_type_key;
ALTER TABLE firm_hr_attendance DROP CONSTRAINT IF EXISTS firm_hr_attendance_user_id_work_date_key;
ALTER TABLE firm_hr_payroll_runs DROP CONSTRAINT IF EXISTS firm_hr_payroll_runs_month_year_key;
ALTER TABLE firm_hr_payslips DROP CONSTRAINT IF EXISTS firm_hr_payslips_run_id_user_id_key;
ALTER TABLE firm_accounts_budgets DROP CONSTRAINT IF EXISTS firm_accounts_budgets_year_month_category_key;

CREATE UNIQUE INDEX IF NOT EXISTS firm_users_workspace_id_email_unique
  ON firm_users (workspace_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS firm_task_assessments_workspace_id_task_id_unique
  ON firm_task_assessments (workspace_id, task_id);
CREATE UNIQUE INDEX IF NOT EXISTS firm_task_collaborators_workspace_id_task_id_user_id_unique
  ON firm_task_collaborators (workspace_id, task_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS firm_hr_leave_entitlements_workspace_id_user_id_year_leave_type_unique
  ON firm_hr_leave_entitlements (workspace_id, user_id, year, leave_type);
CREATE UNIQUE INDEX IF NOT EXISTS firm_hr_attendance_workspace_id_user_id_work_date_unique
  ON firm_hr_attendance (workspace_id, user_id, work_date);
CREATE UNIQUE INDEX IF NOT EXISTS firm_hr_payroll_runs_workspace_id_month_year_unique
  ON firm_hr_payroll_runs (workspace_id, month, year);
CREATE UNIQUE INDEX IF NOT EXISTS firm_hr_payslips_workspace_id_run_id_user_id_unique
  ON firm_hr_payslips (workspace_id, run_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS firm_accounts_budgets_workspace_id_year_month_category_unique
  ON firm_accounts_budgets (workspace_id, year, month, category);