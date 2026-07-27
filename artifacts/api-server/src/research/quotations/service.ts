// Quotation service (Phase 09).
// CRUD operations for research quotations with integrity enforcement.

import {
  db,
  researchQuotations,
  researchQuotationAlterations,
  researchCaseMetadata,
  researchVerifiedJudgments,
  researchUsers,
} from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { verifyQuotationSelection, detectSourceChange } from "./integrity";
import type { DbClient } from "../domain/types";
import type { MetadataMap } from "./formatter";
import type { MetadataFieldName } from "@workspace/db";

// ── Role helpers ──────────────────────────────────────────────────────────

/** Roles that may create quotations. */
export const QUOTATION_CREATE_ROLES = [
  "owner",
  "administrator",
  "rights_reviewer",
  "legal_reviewer",
  "researcher",
  "lecturer",
  "student",
] as const;

/** Roles that may alter quotations. Same as create roles. */
export const QUOTATION_ALTER_ROLES = QUOTATION_CREATE_ROLES;

/** Roles that may export quotations (everyone except guest). */
export const QUOTATION_EXPORT_ROLES = QUOTATION_CREATE_ROLES;

// ── Errors ────────────────────────────────────────────────────────────────

export class QuotationIntegrityError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "QuotationIntegrityError";
  }
}

export class QuotationNotFoundError extends Error {
  constructor(id: number) {
    super(`Quotation ${id} not found`);
    this.name = "QuotationNotFoundError";
  }
}

// ── Create ────────────────────────────────────────────────────────────────

export interface CreateQuotationInput {
  judgmentId: number;
  selectedText: string;
  charStart: number;
  charEnd: number;
  paragraphIdentifier?: string | null;
  sourcePageId?: number | null;
  userNote?: string | null;
  creatorId: number;
}

export async function createQuotation(
  input: CreateQuotationInput,
  dbc: DbClient = db,
) {
  // 1. Integrity check — hard rejection on any mismatch.
  const integrity = await verifyQuotationSelection(
    {
      judgmentId: input.judgmentId,
      selectedText: input.selectedText,
      charStart: input.charStart,
      charEnd: input.charEnd,
    },
    dbc,
  );

  if (!integrity.ok) {
    throw new QuotationIntegrityError(integrity.code, integrity.message);
  }

  // 2. Resolve denormalized provenance from metadata.
  const meta = await resolveMetadataMap(input.judgmentId, dbc);
  const caseName = scalarMeta(meta, "caseName");
  const citation = scalarMeta(meta, "neutralCitation");
  const court = scalarMeta(meta, "court");
  const judge = scalarMeta(meta, "judges");
  const decisionDate = scalarMeta(meta, "decisionDate");

  // 3. Insert.
  const [row] = await dbc
    .insert(researchQuotations)
    .values({
      judgmentId: input.judgmentId,
      caseName,
      citation,
      court,
      judge,
      decisionDate,
      paragraphIdentifier: input.paragraphIdentifier ?? null,
      sourcePageId: input.sourcePageId ?? null,
      selectedText: input.selectedText,
      charStart: input.charStart,
      charEnd: input.charEnd,
      sourceChecksum: integrity.sourceChecksum,
      creatorId: input.creatorId,
      userNote: input.userNote ?? null,
      kind: "exact",
    })
    .returning();

  return row!;
}

// ── Read ──────────────────────────────────────────────────────────────────

export interface QuotationWithMeta {
  quotation: typeof researchQuotations.$inferSelect;
  alterations: (typeof researchQuotationAlterations.$inferSelect)[];
  sourceChanged: boolean;
}

export async function getQuotation(
  id: number,
  dbc: DbClient = db,
): Promise<QuotationWithMeta> {
  const [quotation] = await dbc
    .select()
    .from(researchQuotations)
    .where(eq(researchQuotations.id, id));

  if (!quotation) throw new QuotationNotFoundError(id);

  const alterations = await dbc
    .select()
    .from(researchQuotationAlterations)
    .where(eq(researchQuotationAlterations.quotationId, id))
    .orderBy(researchQuotationAlterations.positionStart);

  const sourceChanged = await detectSourceChange(
    quotation.judgmentId,
    quotation.sourceChecksum,
    dbc,
  );

  return { quotation, alterations, sourceChanged };
}

// ── List by judgment ──────────────────────────────────────────────────────

export async function listQuotationsForJudgment(
  judgmentId: number,
  dbc: DbClient = db,
) {
  return dbc
    .select()
    .from(researchQuotations)
    .where(eq(researchQuotations.judgmentId, judgmentId))
    .orderBy(desc(researchQuotations.createdAt));
}

// ── List by creator ───────────────────────────────────────────────────────

export async function listQuotationsByCreator(
  creatorId: number,
  dbc: DbClient = db,
) {
  return dbc
    .select()
    .from(researchQuotations)
    .where(eq(researchQuotations.creatorId, creatorId))
    .orderBy(desc(researchQuotations.createdAt));
}

// ── Alteration ────────────────────────────────────────────────────────────

export interface RecordAlterationInput {
  quotationId: number;
  kind: "omission" | "insertion" | "alteration";
  positionStart: number;
  positionEnd: number;
  originalText: string;
  replacementText: string;
  recordedBy: number;
}

export async function recordAlteration(
  input: RecordAlterationInput,
  dbc: DbClient = db,
) {
  const [quotation] = await dbc
    .select()
    .from(researchQuotations)
    .where(eq(researchQuotations.id, input.quotationId));

  if (!quotation) throw new QuotationNotFoundError(input.quotationId);

  // Validate positions are within selectedText bounds
  if (
    input.positionStart < 0 ||
    input.positionEnd > quotation.selectedText.length ||
    input.positionStart > input.positionEnd
  ) {
    throw new QuotationIntegrityError(
      "ALTERATION_OFFSET_OUT_OF_RANGE",
      `Alteration positions [${input.positionStart}, ${input.positionEnd}) are out of range for selectedText length ${quotation.selectedText.length}`,
    );
  }

  // Insert alteration record
  const [alt] = await dbc
    .insert(researchQuotationAlterations)
    .values({
      quotationId: input.quotationId,
      kind: input.kind,
      positionStart: input.positionStart,
      positionEnd: input.positionEnd,
      originalText: input.originalText,
      replacementText: input.replacementText,
      recordedBy: input.recordedBy,
    })
    .returning();

  // Flip quotation kind to "altered" (idempotent update)
  if (quotation.kind === "exact") {
    await dbc
      .update(researchQuotations)
      .set({ kind: "altered" })
      .where(eq(researchQuotations.id, input.quotationId));
  }

  return alt!;
}

// ── Metadata resolution ───────────────────────────────────────────────────

/**
 * Load the best available metadata value for each field for a judgment.
 * "Best" = latest approved row, or if none exists, the latest pending row.
 */
export async function resolveMetadataMap(
  judgmentId: number,
  dbc: DbClient = db,
): Promise<MetadataMap> {
  const rows = await dbc
    .select()
    .from(researchCaseMetadata)
    .where(eq(researchCaseMetadata.judgmentId, judgmentId))
    .orderBy(desc(researchCaseMetadata.id));

  const map: MetadataMap = {};
  const seen = new Set<MetadataFieldName>();

  // First pass: prefer approved rows
  for (const row of rows) {
    if (row.reviewerStatus === "approved" && !seen.has(row.fieldName)) {
      map[row.fieldName] = row.value;
      seen.add(row.fieldName);
    }
  }
  // Second pass: fall back to pending rows for fields not yet seen
  for (const row of rows) {
    if (row.reviewerStatus !== "rejected" && !seen.has(row.fieldName)) {
      map[row.fieldName] = row.value;
      seen.add(row.fieldName);
    }
  }

  return map;
}

/**
 * Resolve a scalar string from the metadata map. Arrays are joined with ", ".
 */
function scalarMeta(map: MetadataMap, field: MetadataFieldName): string | null {
  const v = map[field];
  if (v == null) return null;
  if (Array.isArray(v)) return v.join(", ");
  return v;
}

/**
 * Returns true when the reportCitation field is present AND was approved
 * by an authorised reviewer (i.e. reviewerStatus === "approved"). The
 * approval workflow is separately role-gated so this is a sufficient proxy.
 */
export async function isReportCitationVerified(
  judgmentId: number,
  dbc: DbClient = db,
): Promise<boolean> {
  const rows = await dbc
    .select({
      value: researchCaseMetadata.value,
      reviewerStatus: researchCaseMetadata.reviewerStatus,
    })
    .from(researchCaseMetadata)
    .where(
      and(
        eq(researchCaseMetadata.judgmentId, judgmentId),
        eq(researchCaseMetadata.fieldName, "reportCitation" as MetadataFieldName),
      ),
    )
    .orderBy(desc(researchCaseMetadata.id));

  return rows.some(
    (r) => r.reviewerStatus === "approved" && r.value != null,
  );
}
