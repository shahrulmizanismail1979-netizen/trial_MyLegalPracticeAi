import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Judgment Research Platform (Phase 00).
// Foundational principle: a source file is a CONTAINER, not automatically a
// case. See docs/DATA_MODEL.md, docs/RIGHTS_MODEL.md, docs/PROCESSING_STATES.md.

// One row per ingested file. Rights gating: every container begins UNREVIEWED.
export const researchSourceContainers = pgTable("research_source_containers", {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  sourceBatch: text("source_batch").notNull(),
  storageKey: text("storage_key"),
  contentSha256: text("content_sha256").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  mimeType: text("mime_type"),
  rightsStatus: text("rights_status").default("UNREVIEWED").notNull(),
  processingState: text("processing_state").default("REGISTERED").notNull(),
  provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Database-backed job queue. Jobs are idempotent (unique idempotency key) and
// resumable. Payloads carry references, never restricted content.
export const researchJobs = pgTable("research_jobs", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  state: text("state").default("queued").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  lastError: text("last_error"),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Append-only audit log: every correction, normalisation, exclusion, merge,
// split, or rights change is a reviewable transformation.
export const researchTransformations = pgTable("research_transformations", {
  id: serial("id").primaryKey(),
  containerId: integer("container_id").references(
    () => researchSourceContainers.id,
  ),
  kind: text("kind").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull(),
  actor: text("actor").default("system").notNull(),
  reviewed: boolean("reviewed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Human review queue: uncertainty is preserved and routed here, never guessed.
export const researchReviewItems = pgTable("research_review_items", {
  id: serial("id").primaryKey(),
  containerId: integer("container_id").references(
    () => researchSourceContainers.id,
  ),
  reason: text("reason").notNull(),
  status: text("status").default("open").notNull(),
  resolution: jsonb("resolution").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const insertResearchSourceContainerSchema = createInsertSchema(
  researchSourceContainers,
).omit({
  id: true,
  rightsStatus: true, // always defaults to UNREVIEWED; never client-supplied
  createdAt: true,
  updatedAt: true,
});

export type ResearchSourceContainer =
  typeof researchSourceContainers.$inferSelect;
export type InsertResearchSourceContainer = z.infer<
  typeof insertResearchSourceContainerSchema
>;
export type ResearchJob = typeof researchJobs.$inferSelect;
export type ResearchTransformation =
  typeof researchTransformations.$inferSelect;
export type ResearchReviewItem = typeof researchReviewItems.$inferSelect;
