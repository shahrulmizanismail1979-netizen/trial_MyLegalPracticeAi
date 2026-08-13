import {
  pgTable,
  serial,
  integer,
  text,
  doublePrecision,
  boolean,
  jsonb,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const hrProfilesTable = pgTable("firm_hr_profiles", {
  userId:          integer("user_id").primaryKey(),
  icNumber:        text("ic_number"),
  position:        text("position"),
  department:      text("department"),
  employmentType:  text("employment_type").notNull().default("full_time"),
  employmentStart: text("employment_start"),
  employmentEnd:   text("employment_end"),
  salary:          doublePrecision("salary").notNull().default(0),
  epfNumber:       text("epf_number"),
  socsoNumber:     text("socso_number"),
  pcbNumber:       text("pcb_number"),
  bankName:        text("bank_name"),
  bankAccount:     text("bank_account"),
  emergencyName:   text("emergency_name"),
  emergencyPhone:  text("emergency_phone"),
  notes:           text("notes"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hrLeaveEntitlementsTable = pgTable(
  "firm_hr_leave_entitlements",
  {
    id:          serial("id").primaryKey(),
    userId:      integer("user_id").notNull(),
    year:        integer("year").notNull(),
    leaveType:   text("leave_type").notNull(),
    entitlement: doublePrecision("entitlement").notNull().default(0),
    used:        doublePrecision("used").notNull().default(0),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.year, t.leaveType)],
);

export const hrLeaveRequestsTable = pgTable("firm_hr_leave_requests", {
  id:            serial("id").primaryKey(),
  userId:        integer("user_id").notNull(),
  leaveType:     text("leave_type").notNull(),
  startDate:     text("start_date").notNull(),
  endDate:       text("end_date").notNull(),
  daysRequested: doublePrecision("days_requested").notNull(),
  reason:        text("reason"),
  status:        text("status").notNull().default("pending"),
  managerNotes:  text("manager_notes"),
  reviewedBy:    integer("reviewed_by"),
  reviewedAt:    timestamp("reviewed_at", { withTimezone: true }),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hrAttendanceTable = pgTable(
  "firm_hr_attendance",
  {
    id:        serial("id").primaryKey(),
    userId:    integer("user_id").notNull(),
    workDate:  text("work_date").notNull(),
    clockIn:   text("clock_in"),
    clockOut:  text("clock_out"),
    status:    text("status").notNull().default("present"),
    notes:     text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.workDate)],
);

export const hrPayrollRunsTable = pgTable("firm_hr_payroll_runs", {
  id:        serial("id").primaryKey(),
  month:     integer("month").notNull(),
  year:      integer("year").notNull(),
  runBy:     integer("run_by"),
  status:    text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const hrPayslipsTable = pgTable("firm_hr_payslips", {
  id:              serial("id").primaryKey(),
  runId:           integer("run_id").notNull(),
  userId:          integer("user_id").notNull(),
  grossSalary:     doublePrecision("gross_salary").notNull(),
  allowances:      jsonb("allowances").notNull().default([]),
  epfEmployee:     doublePrecision("epf_employee").notNull().default(0),
  epfEmployer:     doublePrecision("epf_employer").notNull().default(0),
  socsoEmployee:   doublePrecision("socso_employee").notNull().default(0),
  socsoEmployer:   doublePrecision("socso_employer").notNull().default(0),
  eisEmployee:     doublePrecision("eis_employee").notNull().default(0),
  eisEmployer:     doublePrecision("eis_employer").notNull().default(0),
  pcb:             doublePrecision("pcb").notNull().default(0),
  otherDeductions: jsonb("other_deductions").notNull().default([]),
  totalDeductions: doublePrecision("total_deductions").notNull(),
  netPay:          doublePrecision("net_pay").notNull(),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
