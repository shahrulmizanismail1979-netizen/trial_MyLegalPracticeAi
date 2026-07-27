// Phase 10: AI input boundary builder.
//
// CRITICAL RULE: only these four categories of information may enter the
// AI prompt. Nothing else — ever.
//   1. Verified judicial text (reconstructed from page extractions).
//   2. Approved case metadata (approved rows only, allowed fields only).
//   3. The approved generation schema description.
//   4. Administrator-approved model settings (passed as prompt framing only).
//
// Excluded categories are logged with explicit reasons so administrators can
// audit what was excluded and why.

import {
  db,
  researchCaseMetadata,
  researchVerifiedJudgments,
  METADATA_FIELDS,
} from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import type { DbClient } from "../domain/types";
import { reconstructJudicialText } from "../quotations/integrity";
import { OUTPUT_JSON_SCHEMA_DESCRIPTION } from "./schema";

/** A metadata field that was excluded from the AI input, with a reason. */
export interface ExcludedField {
  fieldName: string;
  method: string;
  reviewerStatus: string;
  reason: "publisher_supplied" | "not_approved" | "field_not_in_allowlist";
}

export interface AnalysisInput {
  /** The assembled prompt string, ready to send to the model. */
  prompt: string;
  /** Fields successfully included in the prompt. */
  includedFields: string[];
  /** Fields excluded and the reason for exclusion (audit log). */
  excludedFields: ExcludedField[];
  /** SHA-256 checksum of the judicial text used (for provenance). */
  judicialTextChecksum: string;
  /** Length of the judicial text in characters. */
  judicialTextLength: number;
}

/**
 * Build the AI analysis prompt for a verified judgment.
 *
 * The boundary contract (enforced structurally, not by instruction):
 * - Only metadata with `reviewerStatus === "approved"` is included.
 * - Metadata with `method === "publisher_supplied"` is ALWAYS excluded,
 *   regardless of reviewer status.
 * - Only the 13 METADATA_FIELDS are eligible; no other fields can leak in.
 * - The judicial text comes only from `reconstructJudicialText`.
 * - No raw page content from non-judicial-text sections is ever included.
 */
export async function buildAnalysisInput(
  judgmentId: number,
  dbc: DbClient = db,
): Promise<AnalysisInput | null> {
  // 1. Reconstruct verified judicial text.
  const reconstruction = await reconstructJudicialText(judgmentId, dbc);
  if (!reconstruction) return null;

  const { text: judicialText, checksum: judicialTextChecksum } = reconstruction;

  // 2. Load ALL metadata rows for this judgment (we will apply the boundary
  //    filter below and log every exclusion).
  const allMetadata = await dbc
    .select()
    .from(researchCaseMetadata)
    .where(eq(researchCaseMetadata.judgmentId, judgmentId))
    .orderBy(desc(researchCaseMetadata.id));

  const includedFields: string[] = [];
  const excludedFields: ExcludedField[] = [];
  const includedValues: Record<string, string> = {};
  const seen = new Set<string>();

  for (const row of allMetadata) {
    // Gate 1: field must be in the allowed 13-field list.
    if (!(METADATA_FIELDS as readonly string[]).includes(row.fieldName)) {
      excludedFields.push({
        fieldName: row.fieldName,
        method: row.method,
        reviewerStatus: row.reviewerStatus,
        reason: "field_not_in_allowlist",
      });
      continue;
    }

    // Gate 2: publisher-supplied metadata is never allowed into the AI input.
    if (row.method === "publisher_supplied") {
      excludedFields.push({
        fieldName: row.fieldName,
        method: row.method,
        reviewerStatus: row.reviewerStatus,
        reason: "publisher_supplied",
      });
      continue;
    }

    // Gate 3: only approved metadata rows (no pending/rejected rows).
    if (row.reviewerStatus !== "approved") {
      excludedFields.push({
        fieldName: row.fieldName,
        method: row.method,
        reviewerStatus: row.reviewerStatus,
        reason: "not_approved",
      });
      continue;
    }

    // Take the first approved row per field (desc id → latest first).
    if (seen.has(row.fieldName)) continue;
    seen.add(row.fieldName);

    const valueStr = Array.isArray(row.value)
      ? row.value.join(", ")
      : (row.value ?? "");

    includedValues[row.fieldName] = valueStr;
    includedFields.push(row.fieldName);
  }

  // 3. Assemble the prompt.
  const metadataSection =
    Object.keys(includedValues).length > 0
      ? Object.entries(includedValues)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : "(No approved metadata available)";

  const prompt = `You are a legal research assistant. Analyse the following verified judgment and produce structured research aids.

DISCLAIMER: You are analysing verified judicial text only. Do not use any external knowledge, publisher headnotes, or editorial summaries. Everything you state must be supported by the text provided.

=== APPROVED CASE METADATA ===
${metadataSection}

=== VERIFIED JUDICIAL TEXT ===
${judicialText}

=== INSTRUCTIONS ===
${OUTPUT_JSON_SCHEMA_DESCRIPTION}

=== MANDATORY DISCLAIMER ===
Your output is an AI-GENERATED RESEARCH AID — NOT PART OF THE JUDGMENT — VERIFY AGAINST THE JUDICIAL TEXT.`;

  return {
    prompt,
    includedFields,
    excludedFields,
    judicialTextChecksum,
    judicialTextLength: judicialText.length,
  };
}
