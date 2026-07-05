import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const CONTRIBUTION_CATEGORIES = [
  "Litigation",
  "Syariah",
  "Corporate Secretary",
  "Conveyancing",
  "Criminal",
  "Corporate/Commercial/Banking",
  "Accident & Personal Injury",
  "General/Other",
] as const;

export const CONTRIBUTION_STATUSES = ["pending", "approved", "rejected"] as const;

export const EXTRACTION_STATUSES = [
  "pending",
  "extracted",
  "unsupported",
  "failed",
] as const;

export const contributionsTable = pgTable("contributions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  contributorName: text("contributor_name").notNull(),
  contributorEmail: text("contributor_email").notNull(),
  contributorPhone: text("contributor_phone"),
  fileName: text("file_name").notNull(),
  objectPath: text("object_path").notNull(),
  fileSize: integer("file_size"),
  contentType: text("content_type"),
  extractedText: text("extracted_text"),
  extractionStatus: text("extraction_status").notNull().default("pending"),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  rewardVoucherCode: text("reward_voucher_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertContributionSchema = createInsertSchema(contributionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertContribution = z.infer<typeof insertContributionSchema>;
export type Contribution = typeof contributionsTable.$inferSelect;
