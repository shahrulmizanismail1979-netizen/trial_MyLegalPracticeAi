import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Judgment Research Platform (Phase 01).
// Foundational principle: a source file is a CONTAINER, not automatically a
// case. See docs/DATA_MODEL.md, docs/RIGHTS_MODEL.md, docs/PROCESSING_STATES.md.
//
// Container states (20) and job states (8) are enforced by the state machines
// in artifacts/api-server/src/research/domain — never write states directly.

export const CONTAINER_STATES = [
  "UPLOADED",
  "QUARANTINED",
  "RIGHTS_REVIEW_REQUIRED",
  "RIGHTS_APPROVED",
  "INVENTORY_PENDING",
  "INVENTORIED",
  "EXTRACTION_PENDING",
  "TEXT_EXTRACTED",
  "OCR_REVIEW_REQUIRED",
  "SEGMENTATION_PENDING",
  "SEGMENTATION_PROPOSED",
  "SEGMENTATION_REVIEW_REQUIRED",
  "EDITORIAL_REVIEW_PENDING",
  "EDITORIAL_REVIEW_REQUIRED",
  "JUDGMENT_VERIFICATION_PENDING",
  "VERIFIED",
  "SEARCHABLE",
  "PROCESSING_BLOCKED",
  "DELETION_PENDING",
  "DELETED",
] as const;
export type ContainerState = (typeof CONTAINER_STATES)[number];
export const containerStateSchema = z.enum(CONTAINER_STATES);

// 13-status rights vocabulary (Phase 02, ADR 0003). Containers always start
// UNREVIEWED; changes happen only through the rights-review workflow.
export const RIGHTS_STATUSES = [
  "UNREVIEWED",
  "COMMERCIAL_SOURCE_REVIEW_REQUIRED",
  "PRIVATE_PROCESSING_APPROVED",
  "OFFICIAL_COURT_SOURCE",
  "PUBLIC_OR_OPEN_LICENCE_SOURCE",
  "USER_OWNED_OR_AUTHORISED",
  "DISPLAY_RESTRICTED",
  "ANALYSIS_RESTRICTED",
  "EXTERNAL_AI_RESTRICTED",
  "EXPORT_RESTRICTED",
  "DO_NOT_PROCESS",
  "DO_NOT_RETAIN",
  "MANUAL_LEGAL_REVIEW_REQUIRED",
] as const;
export type RightsStatus = (typeof RIGHTS_STATUSES)[number];
export const rightsStatusSchema = z.enum(RIGHTS_STATUSES);

// 8-role model (Phase 02, ADR 0003). Exactly one role per research user.
export const RESEARCH_ROLES = [
  "owner",
  "administrator",
  "rights_reviewer",
  "legal_reviewer",
  "researcher",
  "lecturer",
  "student",
  "guest",
] as const;
export type ResearchRole = (typeof RESEARCH_ROLES)[number];
export const researchRoleSchema = z.enum(RESEARCH_ROLES);

export const JOB_STATES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED_RETRYABLE",
  "FAILED_PERMANENT",
  "CANCELLED",
  "REVIEW_REQUIRED",
  "BLOCKED_BY_RIGHTS",
] as const;
export type JobState = (typeof JOB_STATES)[number];
export const jobStateSchema = z.enum(JOB_STATES);

// Structured failure reason recorded on failed jobs — never a bare string.
export const jobFailureReasonSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
  detail: z.record(z.string(), z.unknown()).optional(),
});
export type JobFailureReason = z.infer<typeof jobFailureReasonSchema>;

// Staff users of the research platform (reviewers/admins). Distinct from
// portal subscribers; access to the module is additionally staff-gated at the
// web layer.
export const researchUsers = pgTable("research_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").$type<ResearchRole>().default("guest").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// One row per ingested file. Rights gating: every container begins UNREVIEWED.
export const researchSourceContainers = pgTable(
  "research_source_containers",
  {
  id: serial("id").primaryKey(),
  originalName: text("original_name").notNull(),
  sourceBatch: text("source_batch").notNull(),
  storageKey: text("storage_key"),
  contentSha256: text("content_sha256").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  mimeType: text("mime_type"),
  rightsStatus: text("rights_status")
    .$type<RightsStatus>()
    .default("UNREVIEWED")
    .notNull(),
  processingState: text("processing_state")
    .$type<ContainerState>()
    .default("UPLOADED")
    .notNull(),
  provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  },
  (t) => [
    // Race-safe SHA-256 dedup: concurrent ingest jobs cannot both register
    // the same bytes (ADR 0004).
    uniqueIndex("research_source_containers_content_sha256_uq").on(
      t.contentSha256,
    ),
  ],
);

// Physical pages of a container (populated by later extraction phases; the
// entity exists now so provenance can reference page identity from day one).
export const researchSourcePages = pgTable(
  "research_source_pages",
  {
    id: serial("id").primaryKey(),
    containerId: integer("container_id")
      .references(() => researchSourceContainers.id)
      .notNull(),
    pageNumber: integer("page_number").notNull(),
    contentSha256: text("content_sha256"),
    notes: text("notes"),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_source_pages_container_page_uq").on(
      t.containerId,
      t.pageNumber,
    ),
  ],
);

// Database-backed job queue. Jobs are idempotent (unique idempotency key) and
// resumable. Payloads carry references, never restricted content.
export const researchJobs = pgTable("research_jobs", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  state: text("state").$type<JobState>().default("QUEUED").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  maxAttempts: integer("max_attempts").default(3).notNull(),
  processorVersion: text("processor_version").default("unversioned").notNull(),
  failureReason: jsonb("failure_reason").$type<JobFailureReason>(),
  lastError: text("last_error"),
  sourceChecksum: text("source_checksum"),
  outputChecksum: text("output_checksum"),
  provenance: jsonb("provenance")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Case candidates proposed inside containers (zero/one/many per file).
// Segmentation itself is a later phase; the entity anchors provenance now.
export const researchCaseCandidates = pgTable("research_case_candidates", {
  id: serial("id").primaryKey(),
  containerId: integer("container_id")
    .references(() => researchSourceContainers.id)
    .notNull(),
  spans: jsonb("spans").$type<unknown[]>().default([]).notNull(),
  status: text("status").default("proposed").notNull(),
  proposedBy: text("proposed_by").default("system").notNull(),
  detail: jsonb("detail")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Human-verified cases. Verification is always a human act with provenance.
export const researchVerifiedCases = pgTable("research_verified_cases", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id")
    .references(() => researchCaseCandidates.id)
    .notNull(),
  title: text("title"),
  citation: text("citation"),
  verifiedBy: text("verified_by").notNull(),
  provenance: jsonb("provenance")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Append-only history of rights decisions for a container. The container's
// rights_status column mirrors the latest record.
// Since Phase 02 (ADR 0003) each formal decision carries the full 17-field
// rights capture. Legacy rows keep NULLs in the new columns.
export const researchRightsRecords = pgTable("research_rights_records", {
  id: serial("id").primaryKey(),
  containerId: integer("container_id")
    .references(() => researchSourceContainers.id)
    .notNull(),
  status: text("status").$type<RightsStatus>().notNull(),
  decidedBy: text("decided_by").notNull(),
  reason: text("reason").notNull(),
  // 17-field rights capture (Phase 02):
  source: text("source"), // 1. where the material came from
  dateObtained: timestamp("date_obtained", { withTimezone: true }), // 2
  declaredSourceType: text("declared_source_type"), // 3
  licenceReference: text("licence_reference"), // 4
  approvedUsers: jsonb("approved_users").$type<string[]>(), // 5
  approvedPurposes: jsonb("approved_purposes").$type<string[]>(), // 6
  storagePermitted: boolean("storage_permitted"), // 7
  analysisPermitted: boolean("analysis_permitted"), // 8
  externalProcessingPermitted: boolean("external_processing_permitted"), // 9
  studentAccessPermitted: boolean("student_access_permitted"), // 10
  printingPermitted: boolean("printing_permitted"), // 11
  exportPermitted: boolean("export_permitted"), // 12
  retentionPeriod: text("retention_period"), // 13
  expiryDate: timestamp("expiry_date", { withTimezone: true }), // 14
  reviewer: text("reviewer"), // 15
  reviewDate: timestamp("review_date", { withTimezone: true }), // 16
  notes: text("notes"), // 17
  detail: jsonb("detail")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
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
  kind: text("kind").default("general").notNull(),
  assignedTo: integer("assigned_to").references(() => researchUsers.id),
  reason: text("reason").notNull(),
  status: text("status").default("open").notNull(),
  resolution: jsonb("resolution").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// Automatic, atomic audit trail: every container/job state change writes a
// row here in the same transaction as the change itself.
export const researchAuditEvents = pgTable(
  "research_audit_events",
  {
    id: serial("id").primaryKey(),
    entityType: text("entity_type").notNull(), // container | job | ...
    entityId: integer("entity_id").notNull(),
    event: text("event").notNull(),
    fromState: text("from_state"),
    toState: text("to_state"),
    actor: text("actor").default("system").notNull(),
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("research_audit_events_entity_idx").on(t.entityType, t.entityId),
  ],
);

// Outputs produced by processors. The unique (produced_by_key, kind) pair is
// what makes re-execution with the same idempotency key a no-op.
export const researchStoredArtifacts = pgTable(
  "research_stored_artifacts",
  {
    id: serial("id").primaryKey(),
    containerId: integer("container_id").references(
      () => researchSourceContainers.id,
    ),
    jobId: integer("job_id").references(() => researchJobs.id),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    contentSha256: text("content_sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    producedByKey: text("produced_by_key").notNull(),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_stored_artifacts_key_kind_uq").on(
      t.producedByKey,
      t.kind,
    ),
  ],
);

// ── Phase 03: ingestion (ADR 0004) ───────────────────────────────────────

// Batch-item states. Dead-lettering lives HERE, not on the job machine (the
// 8-state job machine is golden-pinned). DEAD_LETTER → PENDING is retry;
// CANCELLED → PENDING is restart.
export const BATCH_ITEM_STATES = [
  "PENDING",
  "INGESTED",
  "DUPLICATE",
  "REJECTED",
  "DEAD_LETTER",
  "CANCELLED",
] as const;
export type BatchItemState = (typeof BATCH_ITEM_STATES)[number];
export const batchItemStateSchema = z.enum(BATCH_ITEM_STATES);

// Diagnostic inventory labels (ADR 0004). Diagnostic only — never findings.
export const INVENTORY_LABELS = [
  "EMPTY_OR_INVALID",
  "SINGLE_CASE_POSSIBLE",
  "MULTI_CASE_POSSIBLE",
  "MIXED_CONTENT_POSSIBLE",
  "OCR_REQUIRED",
  "MANUAL_INSPECTION_REQUIRED",
] as const;
export type InventoryLabel = (typeof INVENTORY_LABELS)[number];
export const inventoryLabelSchema = z.enum(INVENTORY_LABELS);

// One upload submission (single file, multiple files, or ZIP archive).
export const researchUploadBatches = pgTable("research_upload_batches", {
  id: serial("id").primaryKey(),
  declaredSource: text("declared_source").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  status: text("status").default("ACTIVE").notNull(), // ACTIVE | CANCELLED
  totalItems: integer("total_items").default(0).notNull(),
  provenance: jsonb("provenance")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// One logical file inside a batch (a ZIP expands into many items). Item
// state changes are guarded + audited (see data/uploads.ts).
export const researchUploadBatchItems = pgTable(
  "research_upload_batch_items",
  {
    id: serial("id").primaryKey(),
    batchId: integer("batch_id")
      .references(() => researchUploadBatches.id)
      .notNull(),
    originalPath: text("original_path").notNull(),
    state: text("state").$type<BatchItemState>().default("PENDING").notNull(),
    containerId: integer("container_id").references(
      () => researchSourceContainers.id,
    ),
    duplicateOfContainerId: integer("duplicate_of_container_id").references(
      () => researchSourceContainers.id,
    ),
    jobId: integer("job_id").references(() => researchJobs.id),
    contentSha256: text("content_sha256"),
    sizeBytes: integer("size_bytes"),
    mimeType: text("mime_type"),
    stagingKey: text("staging_key"),
    errorReport: jsonb("error_report").$type<JobFailureReason>(),
    retryCount: integer("retry_count").default(0).notNull(),
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("research_upload_batch_items_batch_idx").on(t.batchId)],
);

// Non-destructive inventory diagnostics per container. One row per
// (container, job) — re-executed jobs never duplicate results.
export const researchContainerInventories = pgTable(
  "research_container_inventories",
  {
    id: serial("id").primaryKey(),
    containerId: integer("container_id")
      .references(() => researchSourceContainers.id)
      .notNull(),
    jobId: integer("job_id").references(() => researchJobs.id),
    label: text("label").$type<InventoryLabel>().notNull(),
    fileType: text("file_type").notNull(),
    pageCount: integer("page_count"),
    textCharCount: integer("text_char_count").default(0).notNull(),
    blankPageCount: integer("blank_page_count"),
    damagedPageCount: integer("damaged_page_count"),
    ocrProbable: boolean("ocr_probable").default(false).notNull(),
    caseTitleRegionCount: integer("case_title_region_count")
      .default(0)
      .notNull(),
    repeatedLines: jsonb("repeated_lines")
      .$type<string[]>()
      .default([])
      .notNull(),
    commercialMarkers: jsonb("commercial_markers")
      .$type<string[]>()
      .default([])
      .notNull(),
    multiCasePossible: boolean("multi_case_possible").default(false).notNull(),
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_container_inventories_container_job_uq").on(
      t.containerId,
      t.jobId,
    ),
  ],
);

export type ResearchUploadBatch = typeof researchUploadBatches.$inferSelect;
export type ResearchUploadBatchItem =
  typeof researchUploadBatchItems.$inferSelect;
export type ResearchContainerInventory =
  typeof researchContainerInventories.$inferSelect;

export const insertResearchSourceContainerSchema = createInsertSchema(
  researchSourceContainers,
).omit({
  id: true,
  rightsStatus: true, // always defaults to UNREVIEWED; never client-supplied
  processingState: true, // always starts UPLOADED; changed via the state machine
  createdAt: true,
  updatedAt: true,
});

export const insertResearchUserSchema = createInsertSchema(researchUsers).omit({
  id: true,
  createdAt: true,
});
export const insertResearchSourcePageSchema = createInsertSchema(
  researchSourcePages,
).omit({ id: true, createdAt: true });
export const insertResearchCaseCandidateSchema = createInsertSchema(
  researchCaseCandidates,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertResearchVerifiedCaseSchema = createInsertSchema(
  researchVerifiedCases,
).omit({ id: true, verifiedAt: true });
export const insertResearchRightsRecordSchema = createInsertSchema(
  researchRightsRecords,
).omit({ id: true, createdAt: true });
export const insertResearchStoredArtifactSchema = createInsertSchema(
  researchStoredArtifacts,
).omit({ id: true, createdAt: true });

export type ResearchUser = typeof researchUsers.$inferSelect;
export type InsertResearchUser = z.infer<typeof insertResearchUserSchema>;
export type ResearchSourceContainer =
  typeof researchSourceContainers.$inferSelect;
export type InsertResearchSourceContainer = z.infer<
  typeof insertResearchSourceContainerSchema
>;
export type ResearchSourcePage = typeof researchSourcePages.$inferSelect;
export type ResearchJob = typeof researchJobs.$inferSelect;
export type ResearchCaseCandidate = typeof researchCaseCandidates.$inferSelect;
export type ResearchVerifiedCase = typeof researchVerifiedCases.$inferSelect;
export type ResearchRightsRecord = typeof researchRightsRecords.$inferSelect;
export type ResearchTransformation =
  typeof researchTransformations.$inferSelect;
export type ResearchReviewItem = typeof researchReviewItems.$inferSelect;
export type ResearchAuditEvent = typeof researchAuditEvents.$inferSelect;
export type ResearchStoredArtifact =
  typeof researchStoredArtifacts.$inferSelect;
