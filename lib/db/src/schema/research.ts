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
