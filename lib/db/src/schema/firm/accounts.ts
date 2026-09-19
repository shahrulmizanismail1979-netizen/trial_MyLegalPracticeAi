import {
  pgTable,
  serial,
  integer,
  bigint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * All monetary amounts are stored as integer SEN (1 sen = 1/100 RM) to avoid
 * IEEE-754 floating-point precision loss. API routes convert RM→sen on input
 * and sen→RM on output so callers always deal in RM.
 *
 * Overdraft guard: `balanceSen >= amountSen` (exact integer comparison).
 */

// ── Office account entries ─────────────────────────────────────────────────────
export const officeEntriesTable = pgTable("firm_accounts_office_entries", {
  id:          serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().default(0),
  type:        text("type").notNull(),       // "income" | "expense"
  category:    text("category").notNull(),
  description: text("description").notNull(),
  /** Amount in sen (integer). Always positive. */
  amount:      bigint("amount", { mode: "number" }).notNull(),
  entryDate:   text("entry_date").notNull(), // YYYY-MM-DD
  reference:   text("reference"),
  createdBy:   integer("created_by"),        // firm_users.id (manager)
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Client trust ledgers ───────────────────────────────────────────────────────
export const clientLedgersTable = pgTable("firm_accounts_client_ledgers", {
  id:           serial("id").primaryKey(),
  workspaceId:  integer("workspace_id").notNull().default(0),
  clientName:   text("client_name").notNull(),
  matterRef:    text("matter_ref"),
  /** Running balance in sen. Updated atomically in transactions. */
  balance:      bigint("balance", { mode: "number" }).notNull().default(0),
  notes:        text("notes"),
  createdBy:    integer("created_by"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Client trust entries ───────────────────────────────────────────────────────
// Type:
//   deposit            — money received from client
//   disbursement       — payment out on client's behalf (filing fees, etc.)
//   transfer_to_office — billing transfer: bill settled, moved to office a/c
//
// Invariant: after any disbursement or transfer_to_office, ledger.balance >= 0.
// Enforced server-side via SELECT … FOR UPDATE in a transaction.
export const clientEntriesTable = pgTable("firm_accounts_client_entries", {
  id:          serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().default(0),
  ledgerId:    integer("ledger_id").notNull(),
  type:        text("type").notNull(),       // "deposit" | "disbursement" | "transfer_to_office"
  description: text("description").notNull(),
  /** Amount in sen (integer). Always positive. */
  amount:      bigint("amount", { mode: "number" }).notNull(),
  entryDate:   text("entry_date").notNull(), // YYYY-MM-DD
  reference:   text("reference"),
  createdBy:   integer("created_by"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Monthly expense budgets ──────────────────────────────────────────────────
// This table was historically managed by raw SQL in the API. Keeping its
// definition here ensures schema publishing and migrations include it.
export const budgetsTable = pgTable(
  "firm_accounts_budgets",
  {
    id:          serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull().default(0),
    year:        integer("year").notNull(),
    month:       integer("month").notNull(),
    category:    text("category").notNull(),
    budgetSen:   bigint("budget_sen", { mode: "number" }).notNull(),
    createdBy:   integer("created_by"),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.workspaceId, table.year, table.month, table.category),
  ],
);
