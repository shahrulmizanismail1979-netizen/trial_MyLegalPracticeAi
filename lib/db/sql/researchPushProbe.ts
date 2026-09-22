import { pushSchema } from "drizzle-kit/api";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgSchema,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const PROBED_TABLES = [
  "research_audit_events",
  "research_case_candidates",
  "research_search_index",
  "research_workspace_quotations",
  "research_annotations",
] as const;

/**
 * Produces (but never applies) the raw drizzle-kit push plan for a small set of
 * research tables whose SQL migrations contain safeguards not represented by
 * the Drizzle schema.
 *
 * The caller owns creation and cleanup of the disposable schema. `db` must be
 * a Drizzle PostgreSQL database connected to the database containing it.
 */
export async function probeResearchPush(
  db: any,
  schemaName: string,
): Promise<string[]> {
  if (
    !/^[A-Za-z_][A-Za-z0-9_]*$/.test(schemaName) ||
    schemaName.toLowerCase() === "public" ||
    schemaName.toLowerCase() === "pg_catalog" ||
    schemaName.toLowerCase() === "information_schema" ||
    schemaName.toLowerCase().startsWith("pg_")
  ) {
    throw new Error(
      "probeResearchPush requires a non-system disposable PostgreSQL schema name",
    );
  }

  const research = pgSchema(schemaName);

  // Reference-only declarations are deliberately not exported to pushSchema.
  // They let the selected tables retain their genuine FK names without adding
  // unrelated tables to the diff.
  const sourceContainers = research.table("research_source_containers", {
    id: serial("id").primaryKey(),
  });
  const verifiedJudgments = research.table("research_verified_judgments", {
    id: serial("id").primaryKey(),
  });
  const quotationCollections = research.table(
    "research_quotation_collections",
    {
      id: serial("id").primaryKey(),
    },
  );
  const aiPropositions = research.table("research_ai_propositions", {
    id: serial("id").primaryKey(),
  });
  const users = research.table("research_users", { id: serial("id").primaryKey() });
  const researchAnnotations = research.table("research_annotations", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id).notNull(),
    judgmentId: integer("judgment_id").references(() => verifiedJudgments.id).notNull(),
    paragraphRef: text("paragraph_ref"),
    kind: text("kind").default("note").notNull(),
    body: text("body").notNull(),
    charStart: integer("char_start"),
    charEnd: integer("char_end"),
    tags: jsonb("tags"),
    isPublic: boolean("is_public").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  }, (table) => [
    index("research_annotations_judgment_idx").on(table.judgmentId),
    index("research_annotations_user_idx").on(table.userId),
  ]);

  const researchAuditEvents = research.table(
    "research_audit_events",
    {
      id: serial("id").primaryKey(),
      entityType: text("entity_type").notNull(),
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
    (table) => [
      index("research_audit_events_entity_idx").on(
        table.entityType,
        table.entityId,
      ),
    ],
  );

  const researchCaseCandidates = research.table(
    "research_case_candidates",
    {
      id: serial("id").primaryKey(),
      containerId: integer("container_id")
        .references(() => sourceContainers.id)
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
      runId: integer("run_id"),
      strength: text("strength"),
      pageCount: integer("page_count"),
      reviewStatus: text("review_status").default("review_required"),
      reviewedBy: text("reviewed_by"),
      reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
      startPageId: integer("start_page_id"),
    },
  );

  const researchSearchIndex = research.table(
    "research_search_index",
    {
      id: serial("id").primaryKey(),
      judgmentId: integer("judgment_id")
        .references(() => verifiedJudgments.id)
        .notNull()
        .unique(),
      containerId: integer("container_id")
        .references(() => sourceContainers.id)
        .notNull(),
      documentText: text("document_text").notNull(),
      processorVersion: text("processor_version").notNull(),
      court: text("court"),
      decisionDate: timestamp("decision_date", { withTimezone: true }),
      language: text("language"),
      practiceArea: text("practice_area"),
      indexedAt: timestamp("indexed_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("research_search_index_container_idx").on(table.containerId),
      index("research_search_index_court_idx").on(table.court),
      index("research_search_index_date_idx").on(table.decisionDate),
      index("research_search_index_practice_area_idx").on(table.practiceArea),
    ],
  );

  const researchWorkspaceQuotations = research.table(
    "research_workspace_quotations",
    {
      id: serial("id").primaryKey(),
      // The SQL migration has ON DELETE CASCADE; the application table config
      // does not, which is the discrepancy this probe must leave visible.
      collectionId: integer("collection_id")
        .references(() => quotationCollections.id)
        .notNull(),
      propositionId: integer("proposition_id")
        .references(() => aiPropositions.id)
        .notNull(),
      passageText: text("passage_text").notNull(),
      label: text("label"),
      charStart: integer("char_start"),
      charEnd: integer("char_end"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("research_workspace_quotations_collection_idx").on(
        table.collectionId,
      ),
    ],
  );

  const plan = await pushSchema(
    {
      researchAuditEvents,
      researchCaseCandidates,
      researchSearchIndex,
      researchWorkspaceQuotations,
      researchAnnotations,
    },
    db,
    [schemaName],
    [...PROBED_TABLES],
  );

  return plan.statementsToExecute;
}