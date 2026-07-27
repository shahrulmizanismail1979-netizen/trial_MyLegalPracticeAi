import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
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

// Phase 05 type constants (forward-declared here for use in researchCaseCandidates below).
export const BOUNDARY_STRENGTHS = [
  "STRONG_BOUNDARY_CANDIDATE",
  "MODERATE_BOUNDARY_CANDIDATE",
  "WEAK_BOUNDARY_CANDIDATE",
  "CONFLICTING_BOUNDARY",
] as const;
export type BoundaryStrength = (typeof BOUNDARY_STRENGTHS)[number];

export const CANDIDATE_REVIEW_STATUSES = [
  "auto_accepted",
  "review_required",
  "reviewed",
  "rejected",
] as const;
export type CandidateReviewStatus = (typeof CANDIDATE_REVIEW_STATUSES)[number];

// Case candidates proposed inside containers (zero/one/many per file).
// Phase 01 anchors provenance; Phase 05 (ADR 0006) adds scoring columns.
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
  // Phase 05 columns (ADR 0006): added via 0007-phase05-segmentation.sql migration
  runId: integer("run_id"), // FK added at migration time after researchSegmentationRuns exists
  strength: text("strength").$type<BoundaryStrength | null>(),
  pageCount: integer("page_count"),
  reviewStatus: text("review_status")
    .$type<CandidateReviewStatus>()
    .default("review_required"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  // Idempotency key (0008-phase05-candidate-idempotency.sql): denormalized start boundary
  // page_id. Combined with (run_id, container_id) gives a partial unique index that
  // lets ON CONFLICT DO NOTHING prevent duplicate candidates on job retry.
  startPageId: integer("start_page_id"),
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

// ── Phase 04: page-level extraction (ADR 0005) ───────────────────────────

// Structured uncertainty vocabulary. Warnings are DATA with coordinates —
// extracted text never contains guessed replacement text.
export const EXTRACTION_WARNING_CODES = [
  "ILLEGIBLE_REGION",
  "LOW_OCR_CONFIDENCE",
  "POSSIBLE_MISSING_TEXT",
  "READING_ORDER_UNCERTAIN",
  "PAGE_ROTATION_UNCERTAIN",
  "LANGUAGE_UNCERTAIN",
] as const;
export type ExtractionWarningCode = (typeof EXTRACTION_WARNING_CODES)[number];
export const extractionWarningCodeSchema = z.enum(EXTRACTION_WARNING_CODES);

export const PAGE_EXTRACTION_MODES = ["NATIVE", "OCR"] as const;
export type PageExtractionMode = (typeof PAGE_EXTRACTION_MODES)[number];

export const PAGE_BLOCK_TYPES = [
  "paragraph",
  "heading",
  "header",
  "footer",
  "footnote",
  "table",
  "page_number",
  "other",
] as const;
export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];

/** Bounding box in page-image pixel coordinates (or PDF points for native). */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  unit: "px" | "pt";
}

// One row per extraction execution of a container. The exact adapter set
// (names + versions) is recorded so an engine swap is fully traceable.
export const researchExtractionRuns = pgTable(
  "research_extraction_runs",
  {
    id: serial("id").primaryKey(),
    containerId: integer("container_id")
      .references(() => researchSourceContainers.id)
      .notNull(),
    jobId: integer("job_id").references(() => researchJobs.id),
    runKey: text("run_key").notNull(),
    processorVersion: text("processor_version").notNull(),
    adapters: jsonb("adapters")
      .$type<Record<string, { name: string; version: string }>>()
      .notNull(),
    sourceChecksum: text("source_checksum").notNull(),
    pageCount: integer("page_count"),
    status: text("status").default("RUNNING").notNull(), // RUNNING | COMPLETE | REVIEW_REQUIRED
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("research_extraction_runs_container_key_uq").on(
      t.containerId,
      t.runKey,
    ),
  ],
);

// The immutable extraction record per page per run. Raw text is never
// edited after insert — corrections are separate append-only versions.
export const researchPageExtractions = pgTable(
  "research_page_extractions",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .references(() => researchExtractionRuns.id)
      .notNull(),
    pageId: integer("page_id")
      .references(() => researchSourcePages.id)
      .notNull(),
    mode: text("mode").$type<PageExtractionMode>().notNull(),
    rawText: text("raw_text").notNull(),
    rawTextSha256: text("raw_text_sha256").notNull(),
    charStart: integer("char_start").notNull(),
    charEnd: integer("char_end").notNull(),
    imageStorageKey: text("image_storage_key"),
    imageSha256: text("image_sha256"),
    ocrMeanConfidence: integer("ocr_mean_confidence"),
    rotationDegrees: integer("rotation_degrees"),
    rotationConfidence: integer("rotation_confidence"),
    languages: jsonb("languages").$type<string[]>().default([]).notNull(),
    isBlank: boolean("is_blank").default(false).notNull(),
    provenance: jsonb("provenance")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_page_extractions_run_page_uq").on(t.runId, t.pageId),
  ],
);

// Detected text blocks with coordinates, reading order, and per-page
// character offsets (provenance down to character ranges).
export const researchPageBlocks = pgTable(
  "research_page_blocks",
  {
    id: serial("id").primaryKey(),
    pageExtractionId: integer("page_extraction_id")
      .references(() => researchPageExtractions.id)
      .notNull(),
    blockIndex: integer("block_index").notNull(),
    blockType: text("block_type").$type<PageBlockType>().notNull(),
    text: text("text").notNull(),
    bbox: jsonb("bbox").$type<BoundingBox | null>(),
    charStart: integer("char_start").notNull(),
    charEnd: integer("char_end").notNull(),
    readingOrder: integer("reading_order").notNull(),
    columnIndex: integer("column_index"),
    font: jsonb("font").$type<Record<string, unknown> | null>(),
    confidence: integer("confidence"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_page_blocks_extraction_index_uq").on(
      t.pageExtractionId,
      t.blockIndex,
    ),
  ],
);

// Structured warnings — uncertainty preserved with source coordinates.
export const researchPageWarnings = pgTable(
  "research_page_warnings",
  {
    id: serial("id").primaryKey(),
    pageExtractionId: integer("page_extraction_id")
      .references(() => researchPageExtractions.id)
      .notNull(),
    code: text("code").$type<ExtractionWarningCode>().notNull(),
    coordinates: jsonb("coordinates").$type<BoundingBox | null>(),
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("research_page_warnings_extraction_idx").on(t.pageExtractionId)],
);

// Append-only reviewer corrections. The raw extraction row is never
// overwritten; each correction stores the raw output it corrected.
export const researchPageCorrections = pgTable(
  "research_page_corrections",
  {
    id: serial("id").primaryKey(),
    pageExtractionId: integer("page_extraction_id")
      .references(() => researchPageExtractions.id)
      .notNull(),
    version: integer("version").notNull(),
    rawOutput: text("raw_output").notNull(),
    correctedText: text("corrected_text").notNull(),
    reviewer: text("reviewer").notNull(),
    reason: text("reason").notNull(),
    processorVersion: text("processor_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_page_corrections_extraction_version_uq").on(
      t.pageExtractionId,
      t.version,
    ),
  ],
);

export type ResearchExtractionRun = typeof researchExtractionRuns.$inferSelect;
export type ResearchPageExtraction =
  typeof researchPageExtractions.$inferSelect;
export type ResearchPageBlock = typeof researchPageBlocks.$inferSelect;
export type ResearchPageWarning = typeof researchPageWarnings.$inferSelect;
export type ResearchPageCorrection =
  typeof researchPageCorrections.$inferSelect;

// ── Phase 05: multi-case segmentation (ADR 0006) ─────────────────────────

export const SIGNAL_TYPES = [
  "NEW_CASE_TITLE",
  "NEW_PARTY_CONFIGURATION",
  "NEUTRAL_CITATION",
  "REPORT_CITATION",
  "COURT_HEADING",
  "PROCEEDING_NUMBER",
  "CORAM_HEADING",
  "JUDGE_HEADING",
  "DECISION_DATE",
  "JUDGMENT_HEADING",
  "PARAGRAPH_RESET",
  "PAGE_NUMBER_RESTART",
  "CLOSING_ORDER",
  "JUDICIAL_SIGNATURE",
  "ABRUPT_METADATA_CHANGE",
  "ABRUPT_SEMANTIC_CHANGE",
  "TYPOGRAPHY_CHANGE",
  "PUBLISHER_DIVIDER",
  "BLANK_DIVIDER_PAGE",
  "REPEATED_TITLE_IN_QUOTATION",
  "ADMINISTRATIVE_MATERIAL",
  "INCOMPLETE_CASE_END",
  "MULTI_PAGE_GAP",
  "PUBLISHER_ATTRIBUTION",
] as const;
export type SignalType = (typeof SIGNAL_TYPES)[number];
export const signalTypeSchema = z.enum(SIGNAL_TYPES);

// One row per container.segment job attempt.
export const researchSegmentationRuns = pgTable(
  "research_segmentation_runs",
  {
    id: serial("id").primaryKey(),
    containerId: integer("container_id")
      .references(() => researchSourceContainers.id)
      .notNull(),
    jobId: integer("job_id").references(() => researchJobs.id),
    runKey: text("run_key").notNull(),
    processorVersion: text("processor_version").notNull(),
    sourceChecksum: text("source_checksum").notNull(),
    status: text("status").default("RUNNING").notNull(), // RUNNING | COMPLETE | REVIEW_REQUIRED
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("research_segmentation_runs_container_key_uq").on(
      t.containerId,
      t.runKey,
    ),
  ],
);

// One row per detected signal instance (provenance at the page/block level).
export const researchBoundarySignals = pgTable(
  "research_boundary_signals",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .references(() => researchSegmentationRuns.id)
      .notNull(),
    pageId: integer("page_id")
      .references(() => researchSourcePages.id)
      .notNull(),
    blockId: integer("block_id"), // nullable; references research_page_blocks(id)
    signalType: text("signal_type").$type<SignalType>().notNull(),
    signalValue: text("signal_value").notNull(),
    supportingText: text("supporting_text").default("").notNull(),
    scoreContribution: integer("score_contribution").notNull(),
    processorVersion: text("processor_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("research_boundary_signals_run_page_idx").on(t.runId, t.pageId),
    uniqueIndex("research_boundary_signals_run_page_type_value_uq").on(
      t.runId,
      t.pageId,
      t.signalType,
      t.signalValue,
    ),
  ],
);

// One row per proposed boundary location (start or end of a case candidate).
export const researchCaseBoundaries = pgTable(
  "research_case_boundaries",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .references(() => researchSegmentationRuns.id)
      .notNull(),
    pageId: integer("page_id")
      .references(() => researchSourcePages.id)
      .notNull(),
    blockId: integer("block_id"), // nullable
    boundaryRole: text("boundary_role").notNull(), // 'start' | 'end'
    strength: text("strength").$type<BoundaryStrength>().notNull(),
    compositeScore: integer("composite_score").notNull(),
    conflictingSignalCount: integer("conflicting_signal_count")
      .default(0)
      .notNull(),
    reviewStatus: text("review_status")
      .$type<CandidateReviewStatus>()
      .default("review_required")
      .notNull(),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_case_boundaries_run_page_role_uq").on(
      t.runId,
      t.pageId,
      t.boundaryRole,
    ),
  ],
);

// Join table: links a candidate to its start and end boundaries.
export const researchCaseCandidateBoundaries = pgTable(
  "research_case_candidate_boundaries",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id")
      .references(() => researchCaseCandidates.id)
      .notNull(),
    startBoundaryId: integer("start_boundary_id")
      .references(() => researchCaseBoundaries.id)
      .notNull(),
    endBoundaryId: integer("end_boundary_id")
      .references(() => researchCaseBoundaries.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_case_candidate_boundaries_candidate_uq").on(
      t.candidateId,
    ),
  ],
);

export type ResearchSegmentationRun =
  typeof researchSegmentationRuns.$inferSelect;
export type ResearchBoundarySignal =
  typeof researchBoundarySignals.$inferSelect;
export type ResearchCaseBoundary = typeof researchCaseBoundaries.$inferSelect;
export type ResearchCaseCandidateBoundary =
  typeof researchCaseCandidateBoundaries.$inferSelect;

// ── Phase 06: validation, human review & cross-file reconstruction (ADR 0007) ──

export const COHERENCE_CHECK_TYPES = [
  "COHERENT_CASE_IDENTITY",
  "COHERENT_COURT",
  "COHERENT_PARTIES",
  "COHERENT_CITATION",
  "COHERENT_JUDGE",
  "COHERENT_NARRATIVE",
  "COHERENT_PARAGRAPHS",
  "COHERENT_DISPUTE",
  "COHERENT_CONCLUSION",
  "NO_MIXED_COURTS",
  "NO_UNRELATED_PARTY_CHANGE",
  "NO_MULTIPLE_DECISIONS",
  "NO_REPEATED_ENDINGS",
  "NO_NEW_PROCEEDING_MID_SPAN",
  "HAS_BEGINNING",
  "HAS_ENDING",
  "SEQUENTIAL_PARAGRAPHS",
  "NO_SOURCE_PAGE_GAP",
] as const;
export type CoherenceCheckType = (typeof COHERENCE_CHECK_TYPES)[number];

export const COHERENCE_RESULTS = ["PASS", "FAIL", "UNCERTAIN", "NOT_APPLICABLE"] as const;
export type CoherenceResultValue = (typeof COHERENCE_RESULTS)[number];

export const REVIEWER_ACTION_TYPES = [
  "MOVE_BOUNDARY",
  "SPLIT",
  "MERGE",
  "MARK_NON_CASE",
  "MARK_INCOMPLETE",
  "APPROVE",
  "REJECT",
  "REQUEST_REPROCESSING",
  "LINK_CONTINUATION",
  "LINK_DUPLICATE",
  "LINK_RELATED",
] as const;
export type ReviewerActionType = (typeof REVIEWER_ACTION_TYPES)[number];

export const CROSS_FILE_RELATIONSHIP_TYPES = [
  "POSSIBLE_CONTINUATION",
  "CONFIRMED_CONTINUATION",
  "POSSIBLE_DUPLICATE",
  "EXACT_DUPLICATE",
  "ALTERNATIVE_VERSION",
  "CORRECTED_VERSION",
  "RELATED_APPEAL",
  "UNRELATED",
] as const;
export type CrossFileRelationshipType =
  (typeof CROSS_FILE_RELATIONSHIP_TYPES)[number];

export const CROSS_FILE_SPAN_STATUSES = ["PROPOSED", "APPROVED", "REJECTED"] as const;
export type CrossFileSpanStatus = (typeof CROSS_FILE_SPAN_STATUSES)[number];

// One row per container.validate job attempt.
export const researchValidationRuns = pgTable(
  "research_validation_runs",
  {
    id: serial("id").primaryKey(),
    containerId: integer("container_id")
      .references(() => researchSourceContainers.id)
      .notNull(),
    jobId: integer("job_id").references(() => researchJobs.id),
    runKey: text("run_key").notNull(),
    processorVersion: text("processor_version").notNull(),
    status: text("status").default("RUNNING").notNull(), // RUNNING | COMPLETE | REVIEW_REQUIRED
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("research_validation_runs_container_key_uq").on(
      t.containerId,
      t.runKey,
    ),
  ],
);

// One row per check per candidate per validation run.
export const researchCandidateCoherenceChecks = pgTable(
  "research_candidate_coherence_checks",
  {
    id: serial("id").primaryKey(),
    validationRunId: integer("validation_run_id")
      .references(() => researchValidationRuns.id)
      .notNull(),
    candidateId: integer("candidate_id")
      .references(() => researchCaseCandidates.id)
      .notNull(),
    checkType: text("check_type").$type<CoherenceCheckType>().notNull(),
    result: text("result").$type<CoherenceResultValue>().notNull(),
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    processorVersion: text("processor_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_candidate_coherence_checks_run_candidate_type_uq").on(
      t.validationRunId,
      t.candidateId,
      t.checkType,
    ),
    index("research_candidate_coherence_checks_candidate_idx").on(t.candidateId),
  ],
);

// Append-only log of all reviewer actions on a candidate.
export const researchCandidateReviewActions = pgTable(
  "research_candidate_review_actions",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id")
      .references(() => researchCaseCandidates.id)
      .notNull(),
    actionType: text("action_type").$type<ReviewerActionType>().notNull(),
    actor: text("actor").notNull(),
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    transformationId: integer("transformation_id").references(
      () => researchTransformations.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("research_candidate_review_actions_candidate_created_idx").on(
      t.candidateId,
      t.createdAt,
    ),
  ],
);

// Declared relationships between candidates across containers.
export const researchCrossFileRelationships = pgTable(
  "research_cross_file_relationships",
  {
    id: serial("id").primaryKey(),
    sourceCandidateId: integer("source_candidate_id")
      .references(() => researchCaseCandidates.id)
      .notNull(),
    targetCandidateId: integer("target_candidate_id")
      .references(() => researchCaseCandidates.id)
      .notNull(),
    relationshipType: text("relationship_type")
      .$type<CrossFileRelationshipType>()
      .notNull(),
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    confirmedBy: text("confirmed_by"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_cross_file_relationships_src_tgt_type_uq").on(
      t.sourceCandidateId,
      t.targetCandidateId,
      t.relationshipType,
    ),
    index("research_cross_file_relationships_source_idx").on(t.sourceCandidateId),
    index("research_cross_file_relationships_target_idx").on(t.targetCandidateId),
  ],
);

// Multi-container span assembly for a single logical case.
export const researchCrossFileSpans = pgTable("research_cross_file_spans", {
  id: serial("id").primaryKey(),
  createdBy: text("created_by").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  status: text("status")
    .$type<CrossFileSpanStatus>()
    .default("PROPOSED")
    .notNull(),
  note: text("note").default("").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Ordered segments of a cross-file span.
export const researchCrossFileSpanSegments = pgTable(
  "research_cross_file_span_segments",
  {
    id: serial("id").primaryKey(),
    spanId: integer("span_id")
      .references(() => researchCrossFileSpans.id)
      .notNull(),
    candidateId: integer("candidate_id")
      .references(() => researchCaseCandidates.id)
      .notNull(),
    segmentOrder: integer("segment_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_cross_file_span_segments_span_candidate_uq").on(
      t.spanId,
      t.candidateId,
    ),
    index("research_cross_file_span_segments_span_order_idx").on(
      t.spanId,
      t.segmentOrder,
    ),
  ],
);

export type ResearchValidationRun =
  typeof researchValidationRuns.$inferSelect;
export type ResearchCandidateCoherenceCheck =
  typeof researchCandidateCoherenceChecks.$inferSelect;
export type ResearchCandidateReviewAction =
  typeof researchCandidateReviewActions.$inferSelect;
export type ResearchCrossFileRelationship =
  typeof researchCrossFileRelationships.$inferSelect;
export type ResearchCrossFileSpan = typeof researchCrossFileSpans.$inferSelect;
export type ResearchCrossFileSpanSegment =
  typeof researchCrossFileSpanSegments.$inferSelect;

// ── Phase 07: Publisher-Content Isolation & Verified Judicial Text (ADR 0008) ──

export const SECTION_CLASSIFICATIONS_DB = [
  "VERIFIED_JUDICIAL_TEXT",
  "PROBABLE_JUDICIAL_TEXT",
  "SUSPECTED_PUBLISHER_EDITORIAL",
  "ADMINISTRATIVE_METADATA",
  "SOURCE_ARTIFACT",
  "UNKNOWN",
  "MANUAL_REVIEW_REQUIRED",
] as const;
export type DbSectionClassification =
  (typeof SECTION_CLASSIFICATIONS_DB)[number];

// One row per classified section within a page. Sections correspond to blocks
// where block data is available, or to whole pages when it is not.
// Unique on (container_id, page_id, section_index) so processor retries are
// safe (ON CONFLICT DO NOTHING).
export const researchPageSections = pgTable(
  "research_page_sections",
  {
    id: serial("id").primaryKey(),
    containerId: integer("container_id")
      .references(() => researchSourceContainers.id)
      .notNull(),
    pageId: integer("page_id")
      .references(() => researchSourcePages.id),
    editorialRunId: integer("editorial_run_id"),
    blockId: integer("block_id"),
    sectionIndex: integer("section_index").notNull(),
    classification: text("classification")
      .$type<DbSectionClassification>()
      .notNull(),
    confidence: doublePrecision("confidence").notNull(),
    supportingEvidence: jsonb("supporting_evidence")
      .$type<string[]>()
      .default([])
      .notNull(),
    detectorVersion: text("detector_version").notNull(),
    // Human reviewer override (set via PATCH /containers/:id/sections/:sectionId)
    reviewerDecision: text("reviewer_decision").$type<DbSectionClassification>(),
    reviewerNote: text("reviewer_note"),
    notes: text("notes"),
    reviewerId: integer("reviewer_id").references(() => researchUsers.id),
    reviewerDecidedAt: timestamp("reviewer_decided_at", { withTimezone: true }),
    // Whether the isolation gate has been applied and this section excluded
    isolationApplied: boolean("isolation_applied").default(false).notNull(),
    // Character-span provenance within the page text (nullable — populated when
    // block-level extraction provides span offsets).
    spanStartChar: integer("span_start_char"),
    spanEndChar: integer("span_end_char"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_page_sections_container_page_idx_uq").on(
      t.containerId,
      t.pageId,
      t.sectionIndex,
    ),
    index("research_page_sections_container_idx").on(t.containerId),
    index("research_page_sections_classification_idx").on(t.classification),
  ],
);

// One row per editorial classification pass. Multiple runs may exist for a
// single container (e.g. after a reviewer triggers re-classification).
export const researchEditorialRuns = pgTable("research_editorial_runs", {
  id: serial("id").primaryKey(),
  containerId: integer("container_id")
    .references(() => researchSourceContainers.id)
    .notNull(),
  jobId: integer("job_id").references(() => researchJobs.id),
  processorVersion: text("processor_version").notNull(),
  sectionCount: integer("section_count").default(0).notNull(),
  uncertainCount: integer("uncertain_count").default(0).notNull(),
  suspectedEditorialCount: integer("suspected_editorial_count").default(0).notNull(),
  criticalWarningCount: integer("critical_warning_count").default(0).notNull(),
  nonCriticalWarningCount: integer("non_critical_warning_count").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// One row per verified judgment. Created only when completeness checks pass
// (no critical warnings) and a human reviewer has approved.
export const researchVerifiedJudgments = pgTable(
  "research_verified_judgments",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id")
      .references(() => researchCaseCandidates.id)
      .notNull()
      .unique(),
    containerId: integer("container_id")
      .references(() => researchSourceContainers.id)
      .notNull(),
    editorialRunId: integer("editorial_run_id").references(
      () => researchEditorialRuns.id,
    ),
    // Ordered page references covering the judicial text
    pageRefs: jsonb("page_refs").$type<number[]>().default([]).notNull(),
    // Paragraph identifiers extracted from the judicial text
    paragraphIdentifiers: jsonb("paragraph_identifiers")
      .$type<string[]>()
      .default([])
      .notNull(),
    // SHA-256 of the concatenated ordered judicial text (for integrity checks)
    textChecksum: text("text_checksum").notNull(),
    // ADR 0008 §6: approved judicial source spans — ordered array of sections
    // that passed the isolation gate, with containerId + span provenance.
    approvedJudicialSpans: jsonb("approved_judicial_spans")
      .$type<Array<{
        sectionId: number;
        containerId: number;
        pageId: number;
        sectionIndex: number;
        classification: string;
        spanStartChar: number | null;
        spanEndChar: number | null;
      }>>()
      .default([])
      .notNull(),
    // ADR 0008 §6: provenance to source containers.
    sourceRefs: jsonb("source_refs")
      .$type<Array<{ containerId: number; contentSha256: string; originalName: string }>>()
      .default([])
      .notNull(),
    // ADR 0008 §6: original source-document page numbers for the judicial span.
    originalPageRefs: jsonb("original_page_refs")
      .$type<number[]>()
      .default([])
      .notNull(),
    // Non-critical warnings (legacy field — kept for backward compat)
    unresolvedWarnings: jsonb("unresolved_warnings")
      .$type<Array<{ code: string; description: string }>>()
      .default([])
      .notNull(),
    // ADR 0008 §6 explicit separation: critical integrity warnings (always []
    // on verified records — 422 blocks non-empty lists; stored to prove check passed)
    criticalIntegrityWarnings: jsonb("critical_integrity_warnings")
      .$type<Array<{ code: string; description: string }>>()
      .default([])
      .notNull(),
    // ADR 0008 §6 explicit separation: non-critical warnings at verification time
    unresolvedNonCriticalWarnings: jsonb("unresolved_non_critical_warnings")
      .$type<Array<{ code: string; description: string }>>()
      .default([])
      .notNull(),
    verifiedBy: text("verified_by").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true })
      .defaultNow()
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
    index("research_verified_judgments_container_idx").on(t.containerId),
  ],
);

export type ResearchPageSection = typeof researchPageSections.$inferSelect;
export type ResearchEditorialRun = typeof researchEditorialRuns.$inferSelect;
export type ResearchVerifiedJudgment =
  typeof researchVerifiedJudgments.$inferSelect;

// ── Phase 08: Search & Research UI (ADR 0009) ─────────────────────────────

export const METADATA_FIELDS = [
  "caseName",
  "neutralCitation",
  "reportCitation",
  "court",
  "registry",
  "proceedingNumber",
  "judges",
  "hearingDate",
  "decisionDate",
  "parties",
  "jurisdiction",
  "proceduralPosture",
  "language",
] as const;
export type MetadataFieldName = (typeof METADATA_FIELDS)[number];

export const METADATA_METHODS = [
  "regex",
  "heuristic",
  /** Extracted from a suspected publisher-supplied headnote or editorial page.
   *  Input boundary: the AI pipeline MUST exclude rows with this method. */
  "publisher_supplied",
] as const;
export type MetadataMethod = (typeof METADATA_METHODS)[number];

export const METADATA_REVIEWER_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type MetadataReviewerStatus =
  (typeof METADATA_REVIEWER_STATUSES)[number];

export const DUPLICATE_LINK_TYPES = [
  "EXACT_DUPLICATE",
  "POSSIBLE_DUPLICATE",
  "ALTERNATIVE_VERSION",
  "POSSIBLE_CONTINUATION",
  "RELATED_APPEAL",
] as const;
export type DuplicateLinkType = (typeof DUPLICATE_LINK_TYPES)[number];

export const DUPLICATE_LINK_REVIEWER_STATUSES = [
  "pending",
  "confirmed",
  "rejected",
] as const;
export type DuplicateLinkReviewerStatus =
  (typeof DUPLICATE_LINK_REVIEWER_STATUSES)[number];

// Extracted case metadata — one row per (judgment_id, field_name, extraction
// attempt). Multiple records per field are allowed (alternative extractions);
// the active record is the latest non-rejected one.
export const researchCaseMetadata = pgTable(
  "research_case_metadata",
  {
    id: serial("id").primaryKey(),
    judgmentId: integer("judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull(),
    containerId: integer("container_id")
      .references(() => researchSourceContainers.id)
      .notNull(),
    fieldName: text("field_name")
      .$type<MetadataFieldName>()
      .notNull(),
    // Extracted value — string for text fields, ISO date string for dates,
    // string[] for lists (judges, parties).
    value: jsonb("value").$type<string | string[] | null>().notNull(),
    // Provenance: source page + character span within page text.
    sourcePageId: integer("source_page_id").references(
      () => researchSourcePages.id,
    ),
    sourceCharStart: integer("source_char_start"),
    sourceCharEnd: integer("source_char_end"),
    confidence: doublePrecision("confidence").notNull(),
    method: text("method").$type<MetadataMethod>().notNull(),
    processorVersion: text("processor_version").notNull(),
    reviewerStatus: text("reviewer_status")
      .$type<MetadataReviewerStatus>()
      .default("pending")
      .notNull(),
    reviewerId: integer("reviewer_id").references(() => researchUsers.id),
    reviewerDecidedAt: timestamp("reviewer_decided_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("research_case_metadata_judgment_idx").on(t.judgmentId),
    index("research_case_metadata_field_idx").on(t.fieldName),
    index("research_case_metadata_container_idx").on(t.containerId),
    uniqueIndex("research_case_metadata_judgment_field_version_uq").on(
      t.judgmentId,
      t.fieldName,
      t.processorVersion,
    ),
  ],
);

// Duplicate / version links between verified judgments. All links require
// human review — no auto-merge is ever performed.
export const researchDuplicateLinks = pgTable(
  "research_duplicate_links",
  {
    id: serial("id").primaryKey(),
    sourceJudgmentId: integer("source_judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull(),
    targetJudgmentId: integer("target_judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull(),
    linkType: text("link_type").$type<DuplicateLinkType>().notNull(),
    // Evidence signals that triggered the link.
    evidence: jsonb("evidence")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    // Similarity score 0–1 (1 = identical).
    similarityScore: doublePrecision("similarity_score").notNull(),
    detectedBy: text("detected_by").notNull(),
    reviewerStatus: text("reviewer_status")
      .$type<DuplicateLinkReviewerStatus>()
      .default("pending")
      .notNull(),
    reviewerId: integer("reviewer_id").references(() => researchUsers.id),
    reviewerDecidedAt: timestamp("reviewer_decided_at", {
      withTimezone: true,
    }),
    reviewerNote: text("reviewer_note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_duplicate_links_pair_uq").on(
      t.sourceJudgmentId,
      t.targetJudgmentId,
    ),
    index("research_duplicate_links_source_idx").on(t.sourceJudgmentId),
    index("research_duplicate_links_target_idx").on(t.targetJudgmentId),
  ],
);

// Per-user annotations on a verified judgment (paragraph-level).
// Phase 11b extended with char offsets, tags, and is_public visibility flag.
export const researchAnnotations = pgTable(
  "research_annotations",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => researchUsers.id)
      .notNull(),
    judgmentId: integer("judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull(),
    // Paragraph reference within the judgment (e.g. "[1]", "para-5").
    paragraphRef: text("paragraph_ref"),
    kind: text("kind")
      .$type<"note" | "highlight" | "flag">()
      .default("note")
      .notNull(),
    body: text("body").notNull(),
    // Phase 11b: character-offset highlight range (null = whole paragraph).
    charStart: integer("char_start"),
    charEnd: integer("char_end"),
    // Phase 11b: free-form tags (array of strings).
    tags: jsonb("tags").$type<string[]>(),
    // Phase 11b: public annotations are visible to all users with view access.
    isPublic: boolean("is_public").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("research_annotations_judgment_idx").on(t.judgmentId),
    index("research_annotations_user_idx").on(t.userId),
  ],
);

// Per-user bookmarks on a verified judgment.
// Phase 11b extended with optional folder association.
export const researchBookmarks = pgTable(
  "research_bookmarks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => researchUsers.id)
      .notNull(),
    judgmentId: integer("judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull(),
    label: text("label"),
    // Phase 11b: optional folder the bookmark belongs to.
    // FK to research_folders added via 0018-phase11b-workspace.sql migration.
    folderId: integer("folder_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_bookmarks_user_judgment_uq").on(
      t.userId,
      t.judgmentId,
    ),
    index("research_bookmarks_user_idx").on(t.userId),
  ],
);

// Full-text search index — one row per verified judgment. Only isolated
// judicial text contributes to the tsvector (isolation gate enforced at
// index time, per ADR 0009 §D3).
export const researchSearchIndex = pgTable(
  "research_search_index",
  {
    id: serial("id").primaryKey(),
    judgmentId: integer("judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull()
      .unique(),
    containerId: integer("container_id")
      .references(() => researchSourceContainers.id)
      .notNull(),
    // tsvector columns (created/maintained by the search-index processor).
    // document — English-stemmed for common law terms.
    // document_ms — simple (unstemmed) for Malay/romanised terms.
    // Stored as text; the DB trigger or processor keeps them updated.
    documentText: text("document_text").notNull(),
    processorVersion: text("processor_version").notNull(),
    // Denormalised metadata for filter predicates.
    court: text("court"),
    decisionDate: timestamp("decision_date", { withTimezone: true }),
    language: text("language"),
    indexedAt: timestamp("indexed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("research_search_index_container_idx").on(t.containerId),
    index("research_search_index_court_idx").on(t.court),
    index("research_search_index_date_idx").on(t.decisionDate),
  ],
);

export type ResearchCaseMetadata = typeof researchCaseMetadata.$inferSelect;
export type ResearchDuplicateLink = typeof researchDuplicateLinks.$inferSelect;
export type ResearchAnnotation = typeof researchAnnotations.$inferSelect;
export type ResearchBookmark = typeof researchBookmarks.$inferSelect;
export type ResearchSearchIndex = typeof researchSearchIndex.$inferSelect;

// ── Phase 09: Exact Quotations & Citation Tools ───────────────────────────

export const QUOTATION_KINDS = ["exact", "altered"] as const;
export type QuotationKind = (typeof QUOTATION_KINDS)[number];

export const QUOTATION_ALTERATION_KINDS = [
  "omission",
  "insertion",
  "alteration",
] as const;
export type QuotationAlterationKind =
  (typeof QUOTATION_ALTERATION_KINDS)[number];

// One row per saved quotation. The selectedText and all provenance fields are
// immutable after creation. The kind flips to "altered" when any alteration
// row is recorded against this quotation.
export const researchQuotations = pgTable(
  "research_quotations",
  {
    id: serial("id").primaryKey(),
    // Parent verified judgment (immutable FK)
    judgmentId: integer("judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull(),
    // ── Denormalized provenance (captured at creation, never updated) ──────
    caseName: text("case_name"),
    citation: text("citation"),           // neutral citation
    court: text("court"),
    judge: text("judge"),                 // may be a comma-joined list
    decisionDate: text("decision_date"),  // ISO string or formatted date
    paragraphIdentifier: text("paragraph_identifier"), // e.g. "[1]"
    sourcePageId: integer("source_page_id").references(
      () => researchSourcePages.id,
    ),
    // ── Selection ─────────────────────────────────────────────────────────
    // The exact selected text (verified byte-for-byte at creation time)
    selectedText: text("selected_text").notNull(),
    // Character offsets into the deterministically reconstructed judicial text
    charStart: integer("char_start").notNull(),
    charEnd: integer("char_end").notNull(),
    // SHA-256 of the full reconstructed judicial text at creation time.
    // On read, the current judicial text checksum is compared to this value;
    // a mismatch is surfaced as sourceChanged: true.
    sourceChecksum: text("source_checksum").notNull(),
    // ── Authorship ────────────────────────────────────────────────────────
    creatorId: integer("creator_id")
      .references(() => researchUsers.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    userNote: text("user_note"),
    // "exact" until any alteration record is appended; then "altered".
    kind: text("kind").$type<QuotationKind>().default("exact").notNull(),
  },
  (t) => [
    index("research_quotations_judgment_idx").on(t.judgmentId),
    index("research_quotations_creator_idx").on(t.creatorId),
  ],
);

// Append-only alteration records. Each row represents one deliberate change
// the researcher made to the original selection text.
// Omissions → shown as […] in rendered output.
// Insertions → shown as [added text] in rendered output.
// The original selectedText on the parent row is never changed.
export const researchQuotationAlterations = pgTable(
  "research_quotation_alterations",
  {
    id: serial("id").primaryKey(),
    quotationId: integer("quotation_id")
      .references(() => researchQuotations.id)
      .notNull(),
    kind: text("kind").$type<QuotationAlterationKind>().notNull(),
    // Character positions within the selectedText of the parent quotation
    positionStart: integer("position_start").notNull(),
    positionEnd: integer("position_end").notNull(),
    originalText: text("original_text").notNull(),
    replacementText: text("replacement_text").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    recordedBy: integer("recorded_by")
      .references(() => researchUsers.id)
      .notNull(),
  },
  (t) => [
    index("research_quotation_alterations_quotation_idx").on(t.quotationId),
  ],
);

export type ResearchQuotation = typeof researchQuotations.$inferSelect;
export type ResearchQuotationAlteration =
  typeof researchQuotationAlterations.$inferSelect;

// ── Phase 10: AI-Generated Headnotes & Case Analysis ─────────────────────

export const AI_PROVIDER_NAMES = ["gemini", "openai"] as const;
export type AiProviderName = (typeof AI_PROVIDER_NAMES)[number];

export const AI_RUN_STATUSES = [
  "DRAFT",
  "REVIEWING",
  "APPROVED",
  "REJECTED",
] as const;
export type AiRunStatus = (typeof AI_RUN_STATUSES)[number];

export const AI_CONFIDENCE_CATEGORIES = [
  "HIGH",
  "MEDIUM",
  "LOW",
  "INSUFFICIENT_EVIDENCE",
] as const;
export type AiConfidenceCategory = (typeof AI_CONFIDENCE_CATEGORIES)[number];

export const AI_UNCERTAINTY_LABELS = [
  "NOT_STATED_IN_VERIFIED_JUDGMENT",
  "INSUFFICIENT_EVIDENCE",
  "LEGAL_CLASSIFICATION_UNCERTAIN",
  "RATIO_OBITER_REVIEW_REQUIRED",
  "HUMAN_REVIEW_REQUIRED",
] as const;
export type AiUncertaintyLabel = (typeof AI_UNCERTAINTY_LABELS)[number];

export const AI_PROPOSITION_REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;
export type AiPropositionReviewStatus =
  (typeof AI_PROPOSITION_REVIEW_STATUSES)[number];

/** Approved AI provider configuration (one row per provider entry).
 *  AI is disabled by default; an administrator must explicitly enable. */
export const researchAiProviders = pgTable("research_ai_providers", {
  id: serial("id").primaryKey(),
  name: text("name").$type<AiProviderName>().notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  modelName: text("model_name").notNull(),
  temperature: doublePrecision("temperature").default(0.2).notNull(),
  maxTokens: integer("max_tokens").default(8192).notNull(),
  promptVersion: text("prompt_version").default("analysis@1").notNull(),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** One generation run per (judgment × prompt version × model version). */
export const researchAiAnalysisRuns = pgTable(
  "research_ai_analysis_runs",
  {
    id: serial("id").primaryKey(),
    judgmentId: integer("judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull(),
    providerId: integer("provider_id")
      .references(() => researchAiProviders.id)
      .notNull(),
    promptVersion: text("prompt_version").notNull(),
    modelVersion: text("model_version").notNull(),
    /** Object-storage key for the raw model response (never DB-stored). */
    rawOutputStorageKey: text("raw_output_storage_key"),
    status: text("status").$type<AiRunStatus>().default("DRAFT").notNull(),
    reviewerEmail: text("reviewer_email"),
    reviewNotes: text("review_notes"),
    /** Summary of evidence validation: counts per field, rejection reasons. */
    evidenceValidationResult: jsonb("evidence_validation_result")
      .$type<Record<string, unknown>>(),
    criticalWarningCount: integer("critical_warning_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [
    index("research_ai_analysis_runs_judgment_idx").on(t.judgmentId),
    index("research_ai_analysis_runs_status_idx").on(t.status),
  ],
);

/** One row per proposition within a run. */
export const researchAiPropositions = pgTable(
  "research_ai_propositions",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id")
      .references(() => researchAiAnalysisRuns.id)
      .notNull(),
    /** UUID supplied by the model (stable identifier for the claim). */
    propositionId: text("proposition_id").notNull(),
    /** Which of the 17 analysis fields this proposition belongs to. */
    fieldName: text("field_name").notNull(),
    content: text("content").notNull(),
    /** Paragraph IDs from the judgment (e.g. ["[1]","[5]"]) — model-supplied. */
    supportingParagraphIds: jsonb("supporting_paragraph_ids")
      .$type<string[]>()
      .default([])
      .notNull(),
    /** Validation results for each passage; see ValidatedPassage in analysis/schema.ts. */
    validatedPassages: jsonb("validated_passages")
      .$type<unknown[]>()
      .default([])
      .notNull(),
    confidenceCategory: text("confidence_category")
      .$type<AiConfidenceCategory>()
      .notNull(),
    uncertaintyLabel: text("uncertainty_label").$type<AiUncertaintyLabel>(),
    reviewStatus: text("review_status")
      .$type<AiPropositionReviewStatus>()
      .default("pending")
      .notNull(),
    reviewerEmail: text("reviewer_email"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("research_ai_propositions_run_idx").on(t.runId),
    uniqueIndex("research_ai_propositions_run_prop_uq").on(
      t.runId,
      t.propositionId,
    ),
  ],
);

export type ResearchAiProvider = typeof researchAiProviders.$inferSelect;
export type ResearchAiAnalysisRun = typeof researchAiAnalysisRuns.$inferSelect;
export type ResearchAiProposition = typeof researchAiPropositions.$inferSelect;

// ── Phase 11a: Authorities & Legislation Extraction ───────────────────────

/** 14 treatment labels + UNCLEAR for uncertain or unsubstantiated treatment. */
export const AUTHORITY_TREATMENTS = [
  "APPLIED",
  "FOLLOWED",
  "APPROVED",
  "ADOPTED",
  "DISTINGUISHED",
  "CONSIDERED",
  "DISCUSSED",
  "EXPLAINED",
  "CRITICISED",
  "DOUBTED",
  "DECLINED_TO_FOLLOW",
  "OVERRULED",
  "REFERRED_TO",
  "UNCLEAR",
] as const;
export type AuthorityTreatment = (typeof AUTHORITY_TREATMENTS)[number];

/** Review lifecycle for each authority record. */
export const AUTHORITY_REVIEW_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
] as const;
export type AuthorityReviewStatus = (typeof AUTHORITY_REVIEW_STATUSES)[number];

/** Modes for how a statutory provision is used. */
export const LEGISLATION_MODES = [
  "applied",
  "interpreted",
  "mentioned",
  "challenged",
  "constitutionality_considered",
] as const;
export type LegislationMode = (typeof LEGISLATION_MODES)[number];

/**
 * One row per cited case extracted from an AI analysis run's casesConsidered
 * propositions.  Idempotent on (run_id, proposition_id).
 */
export const researchAuthorities = pgTable(
  "research_authorities",
  {
    id: serial("id").primaryKey(),
    judgmentId: integer("judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull(),
    runId: integer("run_id")
      .references(() => researchAiAnalysisRuns.id)
      .notNull(),
    propositionId: integer("proposition_id")
      .references(() => researchAiPropositions.id)
      .notNull(),
    caseName: text("case_name").notNull(),
    citation: text("citation"),
    sourceParagraphId: text("source_paragraph_id"),
    treatment: text("treatment").$type<AuthorityTreatment>().notNull(),
    treatmentEvidence: text("treatment_evidence"),
    reviewStatus: text("review_status")
      .$type<AuthorityReviewStatus>()
      .default("pending_review")
      .notNull(),
    reviewerEmail: text("reviewer_email"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_authorities_run_prop_uq").on(t.runId, t.propositionId),
    index("research_authorities_judgment_idx").on(t.judgmentId),
    index("research_authorities_citation_idx").on(t.citation),
  ],
);

/**
 * One row per statutory provision extracted from an AI analysis run's
 * statutesConsidered propositions.  Idempotent on (run_id, proposition_id).
 */
export const researchLegislationRefs = pgTable(
  "research_legislation_refs",
  {
    id: serial("id").primaryKey(),
    judgmentId: integer("judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull(),
    runId: integer("run_id")
      .references(() => researchAiAnalysisRuns.id)
      .notNull(),
    propositionId: integer("proposition_id")
      .references(() => researchAiPropositions.id)
      .notNull(),
    statute: text("statute").notNull(),
    provision: text("provision"),
    jurisdiction: text("jurisdiction"),
    sourceParagraphId: text("source_paragraph_id"),
    mode: text("mode").$type<LegislationMode>().notNull(),
    supportingPassage: text("supporting_passage"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("research_legislation_refs_run_prop_uq").on(t.runId, t.propositionId),
    index("research_legislation_refs_judgment_idx").on(t.judgmentId),
  ],
);

export type ResearchAuthority = typeof researchAuthorities.$inferSelect;
export type ResearchLegislationRef = typeof researchLegislationRefs.$inferSelect;

// ── Phase 11b: Research Workspace ────────────────────────────────────────

export const FOLDER_KINDS = ["research", "course", "matter"] as const;
export type FolderKind = (typeof FOLDER_KINDS)[number];

/** Personal/course/matter folders that organise verified judgments. */
export const researchFolders = pgTable(
  "research_folders",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .references(() => researchUsers.id)
      .notNull(),
    kind: text("kind").$type<FolderKind>().default("research").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    sharedWithStudents: boolean("shared_with_students").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("research_folders_owner_idx").on(t.ownerId),
  ],
);

/** Membership of a judgment in a folder.  Unique per (folder, judgment). */
export const researchFolderItems = pgTable(
  "research_folder_items",
  {
    id: serial("id").primaryKey(),
    folderId: integer("folder_id")
      .references(() => researchFolders.id)
      .notNull(),
    judgmentId: integer("judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("research_folder_items_folder_judgment_uq").on(t.folderId, t.judgmentId),
    index("research_folder_items_folder_idx").on(t.folderId),
    index("research_folder_items_judgment_idx").on(t.judgmentId),
  ],
);

/** A stored search query + filters, private to the owner. */
export const researchSavedSearches = pgTable(
  "research_saved_searches",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .references(() => researchUsers.id)
      .notNull(),
    name: text("name").notNull(),
    /** Serialised search query: { q?: string, court?: string, dateFrom?: string, dateTo?: string, ... } */
    query: jsonb("query").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("research_saved_searches_owner_idx").on(t.ownerId)],
);

/** An ordered list of judgments to read, optionally shared with students. */
export const researchReadingLists = pgTable(
  "research_reading_lists",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .references(() => researchUsers.id)
      .notNull(),
    name: text("name").notNull(),
    sharedWithStudents: boolean("shared_with_students").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("research_reading_lists_owner_idx").on(t.ownerId)],
);

/** One item in a reading list.  Unique per (list, judgment). */
export const researchReadingListItems = pgTable(
  "research_reading_list_items",
  {
    id: serial("id").primaryKey(),
    listId: integer("list_id")
      .references(() => researchReadingLists.id)
      .notNull(),
    judgmentId: integer("judgment_id")
      .references(() => researchVerifiedJudgments.id)
      .notNull(),
    position: integer("position").default(0).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("research_reading_list_items_list_judgment_uq").on(t.listId, t.judgmentId),
    index("research_reading_list_items_list_idx").on(t.listId),
  ],
);

/** Named collection of saved quotation passages. */
export const researchQuotationCollections = pgTable(
  "research_quotation_collections",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .references(() => researchUsers.id)
      .notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("research_quotation_collections_owner_idx").on(t.ownerId)],
);

/** One saved passage extracted from a validated AI proposition. */
export const researchWorkspaceQuotations = pgTable(
  "research_workspace_quotations",
  {
    id: serial("id").primaryKey(),
    collectionId: integer("collection_id")
      .references(() => researchQuotationCollections.id)
      .notNull(),
    propositionId: integer("proposition_id")
      .references(() => researchAiPropositions.id)
      .notNull(),
    passageText: text("passage_text").notNull(),
    label: text("label"),
    charStart: integer("char_start"),
    charEnd: integer("char_end"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("research_workspace_quotations_collection_idx").on(t.collectionId)],
);

/**
 * Case-comparison table: up to 10 judgment columns × N field rows.
 * Field names reference AI analysis proposition fieldName values
 * (e.g. "holdingOnEachIssue", "reasoning").
 */
export const researchComparisonTables = pgTable(
  "research_comparison_tables",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .references(() => researchUsers.id)
      .notNull(),
    name: text("name").notNull(),
    /** Array of judgment IDs (max 10, enforced at the application layer). */
    judgmentIds: jsonb("judgment_ids").$type<number[]>().default([]).notNull(),
    /** AI analysis fieldName strings to include as rows. */
    fieldNames: jsonb("field_names").$type<string[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("research_comparison_tables_owner_idx").on(t.ownerId)],
);

/**
 * User-created authorities table scoped to one or more judgments.
 * Populated on-read from Phase 11a's research_authorities +
 * research_legislation_refs.
 */
export const researchAuthoritiesTables = pgTable(
  "research_authorities_tables",
  {
    id: serial("id").primaryKey(),
    ownerId: integer("owner_id")
      .references(() => researchUsers.id)
      .notNull(),
    name: text("name").notNull(),
    judgmentIds: jsonb("judgment_ids").$type<number[]>().default([]).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("research_authorities_tables_owner_idx").on(t.ownerId)],
);

export type ResearchFolder = typeof researchFolders.$inferSelect;
export type ResearchFolderItem = typeof researchFolderItems.$inferSelect;
export type ResearchSavedSearch = typeof researchSavedSearches.$inferSelect;
export type ResearchReadingList = typeof researchReadingLists.$inferSelect;
export type ResearchReadingListItem = typeof researchReadingListItems.$inferSelect;
export type ResearchQuotationCollection = typeof researchQuotationCollections.$inferSelect;
export type ResearchWorkspaceQuotation = typeof researchWorkspaceQuotations.$inferSelect;
export type ResearchComparisonTable = typeof researchComparisonTables.$inferSelect;
export type ResearchAuthoritiesTable = typeof researchAuthoritiesTables.$inferSelect;
