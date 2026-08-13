-- HR module for MyLawFirmAi
-- Employee HR profiles, leave management, attendance, payroll.

CREATE TABLE IF NOT EXISTS firm_hr_profiles (
  user_id          integer PRIMARY KEY REFERENCES firm_users(id) ON DELETE CASCADE,
  ic_number        text,
  position         text,
  department       text,
  employment_type  text NOT NULL DEFAULT 'full_time',
  employment_start text,
  employment_end   text,
  salary           double precision NOT NULL DEFAULT 0,
  epf_number       text,
  socso_number     text,
  pcb_number       text,
  bank_name        text,
  bank_account     text,
  emergency_name   text,
  emergency_phone  text,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS firm_hr_leave_entitlements (
  id           serial PRIMARY KEY,
  user_id      integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
  year         integer NOT NULL,
  leave_type   text NOT NULL,
  entitlement  double precision NOT NULL DEFAULT 0,
  used         double precision NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, leave_type)
);

CREATE TABLE IF NOT EXISTS firm_hr_leave_requests (
  id             serial PRIMARY KEY,
  user_id        integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
  leave_type     text NOT NULL,
  start_date     text NOT NULL,
  end_date       text NOT NULL,
  days_requested double precision NOT NULL,
  reason         text,
  status         text NOT NULL DEFAULT 'pending',
  manager_notes  text,
  reviewed_by    integer REFERENCES firm_users(id),
  reviewed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS firm_hr_leave_req_user_idx ON firm_hr_leave_requests(user_id);
CREATE INDEX IF NOT EXISTS firm_hr_leave_req_status_idx ON firm_hr_leave_requests(status);

CREATE TABLE IF NOT EXISTS firm_hr_attendance (
  id         serial PRIMARY KEY,
  user_id    integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
  work_date  text NOT NULL,
  clock_in   text,
  clock_out  text,
  status     text NOT NULL DEFAULT 'present',
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, work_date)
);
CREATE INDEX IF NOT EXISTS firm_hr_attendance_user_date_idx ON firm_hr_attendance(user_id, work_date);

CREATE TABLE IF NOT EXISTS firm_hr_payroll_runs (
  id         serial PRIMARY KEY,
  month      integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year       integer NOT NULL,
  run_by     integer REFERENCES firm_users(id),
  status     text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(month, year)
);

CREATE TABLE IF NOT EXISTS firm_hr_payslips (
  id               serial PRIMARY KEY,
  run_id           integer NOT NULL REFERENCES firm_hr_payroll_runs(id) ON DELETE CASCADE,
  user_id          integer NOT NULL REFERENCES firm_users(id) ON DELETE CASCADE,
  gross_salary     double precision NOT NULL,
  allowances       jsonb NOT NULL DEFAULT '[]',
  epf_employee     double precision NOT NULL DEFAULT 0,
  epf_employer     double precision NOT NULL DEFAULT 0,
  socso_employee   double precision NOT NULL DEFAULT 0,
  socso_employer   double precision NOT NULL DEFAULT 0,
  eis_employee     double precision NOT NULL DEFAULT 0,
  eis_employer     double precision NOT NULL DEFAULT 0,
  pcb              double precision NOT NULL DEFAULT 0,
  other_deductions jsonb NOT NULL DEFAULT '[]',
  total_deductions double precision NOT NULL,
  net_pay          double precision NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, user_id)
);
