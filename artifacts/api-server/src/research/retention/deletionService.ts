/**
 * Phase 12c — Granular per-layer deletion service.
 *
 * Each layer is an independent unit of deletion. Failures are collected,
 * not propagated — already-completed layers are not rolled back.
 *
 * BACKUP NOTICE: This service never claims that backup copies are deleted.
 * `backupConfirmed` is always `false` in the manifest. Backup deletion
 * must be confirmed separately by the backup operator.
 *
 * ## Layer dependency order (recommended for clean multi-layer requests)
 * 1. ai_output       → deletes propositions + runs + authorities + legislation refs
 * 2. search_index    → deletes search index row
 * 3. verified_judgment → deletes judgment row; transitions container to DELETED
 *                       (requires all FK-blocking rows to be cleared first)
 * 4. case_candidates → deletes candidates + boundaries
 *                       (requires verified_judgment to be deleted first)
 * 5. corrected_text  → deletes page corrections
 * 6. page_text       → deletes extractions (+ corrections/blocks/warnings)
 * 7. ocr_images      → deletes OCR image objects + nullifies storage key column
 * 8. original_file   → deletes original uploaded object + nullifies storage key
 * 9. temp_files      → deletes stored artifacts + their objects
 */

import { randomUUID } from "node:crypto";
import { sql as drizzleSql } from "drizzle-orm";
import {
  db as globalDb,
  researchSourceContainers,
  researchSourcePages,
  researchPageExtractions,
  researchPageBlocks,
  researchPageWarnings,
  researchPageCorrections,
  researchCaseCandidates,
  researchCaseCandidateBoundaries,
  researchVerifiedJudgments,
  researchSearchIndex,
  researchAiAnalysisRuns,
  researchAiPropositions,
  researchAuthorities,
  researchLegislationRefs,
  researchStoredArtifacts,
  researchDeletionManifests,
  researchCaseMetadata,
  researchDuplicateLinks,
  researchAnnotations,
  researchBookmarks,
  researchQuotations,
  researchFolderItems,
  researchReadingListItems,
  researchCandidateCoherenceChecks,
  researchCandidateReviewActions,
  researchCrossFileRelationships,
  researchCrossFileSpanSegments,
  researchVerifiedCases,
} from "@workspace/db";
import { eq, inArray, isNotNull, and, desc } from "drizzle-orm";
import { getAdapters } from "../adapters";
import { transitionContainer } from "../domain/containerStateMachine";
import { emitAuditEvent } from "../domain/audit";
import { AuditAction } from "../domain/auditEvents";
import type { DbClient } from "../domain/types";

// ── Layer kinds ───────────────────────────────────────────────────────────

export const LAYER_KINDS = [
  "original_file",
  "page_text",
  "ocr_images",
  "corrected_text",
  "case_candidates",
  "verified_judgment",
  "search_index",
  "ai_output",
  "temp_files",
] as const;

export type LayerKind = (typeof LAYER_KINDS)[number];

// ── Manifest types ────────────────────────────────────────────────────────

export type LayerResult = {
  layer: LayerKind;
  /** `not_found` when the layer has no data for this container. */
  status: "deleted" | "not_found" | "failed";
  rowsAffected: number;
  objectStorageKeys: string[];
  storageFailures?: string[];
  note?: string;
};

export type DeletionManifest = {
  containerId: number;
  requestedAt: string;
  actor: string;
  layers: LayerResult[];
  /** Always false — backup deletion must be confirmed separately. */
  backupConfirmed: false;
  backupNote: string;
  manifestKey: string;
};

const BACKUP_NOTE =
  "Backup deletion must be confirmed separately by the backup operator.";

// ── Storage deletion helper ───────────────────────────────────────────────

/**
 * Try to delete each key from object storage, returning lists of
 * successfully deleted keys and keys that failed. Never throws.
 */
async function deleteStorageKeys(keys: string[]): Promise<{
  deleted: string[];
  failed: string[];
}> {
  const storage = getAdapters().storage;
  const deleted: string[] = [];
  const failed: string[] = [];
  for (const key of keys) {
    try {
      await storage.remove(key);
      deleted.push(key);
    } catch (err) {
      failed.push(`${key} (${String(err)})`);
    }
  }
  return { deleted, failed };
}

// ── Per-layer handlers ────────────────────────────────────────────────────

/**
 * `original_file`: delete the uploaded object from object storage;
 * nullify the stored-artifact reference on the container row.
 */
async function deleteOriginalFile(
  containerId: number,
  dbc: DbClient,
): Promise<LayerResult> {
  const layer: LayerKind = "original_file";
  try {
    const [container] = await dbc
      .select({ storageKey: researchSourceContainers.storageKey })
      .from(researchSourceContainers)
      .where(eq(researchSourceContainers.id, containerId));
    if (!container?.storageKey) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }
    const key = container.storageKey;
    const { deleted, failed } = await deleteStorageKeys([key]);

    // Always nullify the DB reference regardless of storage outcome.
    await dbc
      .update(researchSourceContainers)
      .set({ storageKey: null })
      .where(eq(researchSourceContainers.id, containerId));

    return {
      layer,
      status: "deleted",
      rowsAffected: 1,
      objectStorageKeys: deleted,
      storageFailures: failed.length > 0 ? failed : undefined,
      note:
        failed.length > 0
          ? `DB reference nullified but object storage deletion failed for: ${failed.join("; ")}`
          : undefined,
    };
  } catch (err) {
    return {
      layer,
      status: "failed",
      rowsAffected: 0,
      objectStorageKeys: [],
      note: String(err),
    };
  }
}

/**
 * `page_text`: delete rows from `research_page_extractions` (and their
 * FK-children: corrections, blocks, warnings) for the container's pages.
 * Extraction runs are preserved as processing-history records.
 */
async function deletePageText(
  containerId: number,
  dbc: DbClient,
): Promise<LayerResult> {
  const layer: LayerKind = "page_text";
  try {
    const pages = await dbc
      .select({ id: researchSourcePages.id })
      .from(researchSourcePages)
      .where(eq(researchSourcePages.containerId, containerId));
    if (pages.length === 0) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }
    const pageIds = pages.map((p) => p.id);

    const extractions = await dbc
      .select({ id: researchPageExtractions.id })
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, pageIds));
    if (extractions.length === 0) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }
    const extractionIds = extractions.map((e) => e.id);

    // Delete FK-children of extractions first.
    await dbc
      .delete(researchPageCorrections)
      .where(inArray(researchPageCorrections.pageExtractionId, extractionIds));
    await dbc
      .delete(researchPageBlocks)
      .where(inArray(researchPageBlocks.pageExtractionId, extractionIds));
    await dbc
      .delete(researchPageWarnings)
      .where(inArray(researchPageWarnings.pageExtractionId, extractionIds));

    const deleted = await dbc
      .delete(researchPageExtractions)
      .where(inArray(researchPageExtractions.id, extractionIds))
      .returning({ id: researchPageExtractions.id });

    return {
      layer,
      status: deleted.length > 0 ? "deleted" : "not_found",
      rowsAffected: deleted.length,
      objectStorageKeys: [],
    };
  } catch (err) {
    return {
      layer,
      status: "failed",
      rowsAffected: 0,
      objectStorageKeys: [],
      note: String(err),
    };
  }
}

/**
 * `ocr_images`: delete OCR intermediate images stored in object storage
 * (the `imageStorageKey` column on page extractions). Nullifies the column.
 */
async function deleteOcrImages(
  containerId: number,
  dbc: DbClient,
): Promise<LayerResult> {
  const layer: LayerKind = "ocr_images";
  try {
    const pages = await dbc
      .select({ id: researchSourcePages.id })
      .from(researchSourcePages)
      .where(eq(researchSourcePages.containerId, containerId));
    if (pages.length === 0) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }
    const pageIds = pages.map((p) => p.id);

    const extractions = await dbc
      .select({
        id: researchPageExtractions.id,
        imageStorageKey: researchPageExtractions.imageStorageKey,
      })
      .from(researchPageExtractions)
      .where(
        and(
          inArray(researchPageExtractions.pageId, pageIds),
          isNotNull(researchPageExtractions.imageStorageKey),
        ),
      );
    if (extractions.length === 0) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }

    const keysToDelete = extractions.map((e) => e.imageStorageKey!);
    const { deleted: deletedKeys, failed } = await deleteStorageKeys(keysToDelete);

    // Always nullify DB references regardless of storage outcome.
    const extractionIds = extractions.map((e) => e.id);
    await dbc
      .update(researchPageExtractions)
      .set({ imageStorageKey: null })
      .where(inArray(researchPageExtractions.id, extractionIds));

    return {
      layer,
      status: "deleted",
      rowsAffected: extractions.length,
      objectStorageKeys: deletedKeys,
      storageFailures: failed.length > 0 ? failed : undefined,
      note:
        failed.length > 0
          ? `DB references nullified but object storage deletion failed for ${failed.length} key(s).`
          : undefined,
    };
  } catch (err) {
    return {
      layer,
      status: "failed",
      rowsAffected: 0,
      objectStorageKeys: [],
      note: String(err),
    };
  }
}

/**
 * `corrected_text`: delete rows from `research_page_corrections`
 * for the container's pages. Raw extractions are preserved.
 */
async function deleteCorrectedText(
  containerId: number,
  dbc: DbClient,
): Promise<LayerResult> {
  const layer: LayerKind = "corrected_text";
  try {
    const pages = await dbc
      .select({ id: researchSourcePages.id })
      .from(researchSourcePages)
      .where(eq(researchSourcePages.containerId, containerId));
    if (pages.length === 0) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }
    const pageIds = pages.map((p) => p.id);

    const extractions = await dbc
      .select({ id: researchPageExtractions.id })
      .from(researchPageExtractions)
      .where(inArray(researchPageExtractions.pageId, pageIds));
    if (extractions.length === 0) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }
    const extractionIds = extractions.map((e) => e.id);

    const deleted = await dbc
      .delete(researchPageCorrections)
      .where(inArray(researchPageCorrections.pageExtractionId, extractionIds))
      .returning({ id: researchPageCorrections.id });

    return {
      layer,
      status: deleted.length > 0 ? "deleted" : "not_found",
      rowsAffected: deleted.length,
      objectStorageKeys: [],
    };
  } catch (err) {
    return {
      layer,
      status: "failed",
      rowsAffected: 0,
      objectStorageKeys: [],
      note: String(err),
    };
  }
}

/**
 * `case_candidates`: delete `research_case_candidates` and ALL of their
 * FK-dependent rows in safe topological order:
 *
 *   cross_file_span_segments → cross_file_relationships →
 *   candidate_coherence_checks → candidate_review_actions →
 *   verified_cases (legacy) → candidate_boundaries → candidates
 *
 * PRE-CONDITION: `verified_judgments` FK to candidates. This handler
 * checks for them and returns `failed` with a precise count if any exist.
 * Use the `verified_judgment` layer first then retry.
 */
async function deleteCaseCandidates(
  containerId: number,
  dbc: DbClient,
): Promise<LayerResult> {
  const layer: LayerKind = "case_candidates";
  try {
    const candidates = await dbc
      .select({ id: researchCaseCandidates.id })
      .from(researchCaseCandidates)
      .where(eq(researchCaseCandidates.containerId, containerId));
    if (candidates.length === 0) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }
    const candidateIds = candidates.map((c) => c.id);

    // ── Pre-condition: verified_judgments must be gone first ────────────
    const [vjRow] = await dbc
      .select({ count: drizzleSql<number>`count(*)::int` })
      .from(researchVerifiedJudgments)
      .where(inArray(researchVerifiedJudgments.candidateId, candidateIds));
    const vjCount = vjRow?.count ?? 0;
    if (vjCount > 0) {
      return {
        layer,
        status: "failed",
        rowsAffected: 0,
        objectStorageKeys: [],
        note: `verified_judgments (${vjCount} row(s)) still reference these candidates. Delete the verified_judgment layer first then retry.`,
      };
    }

    // ── Cascade delete all FK-dependent rows in safe order ──────────────
    let totalAffected = 0;

    // 1. cross_file_span_segments: FK(candidateId) → candidates
    const segDel = await dbc
      .delete(researchCrossFileSpanSegments)
      .where(inArray(researchCrossFileSpanSegments.candidateId, candidateIds))
      .returning({ id: researchCrossFileSpanSegments.id });
    totalAffected += segDel.length;

    // 2. cross_file_relationships: FK(sourceCandidateId) and FK(targetCandidateId)
    //    Both directions must be removed before candidates can be deleted.
    const xfSrcDel = await dbc
      .delete(researchCrossFileRelationships)
      .where(
        inArray(researchCrossFileRelationships.sourceCandidateId, candidateIds),
      )
      .returning({ id: researchCrossFileRelationships.id });
    totalAffected += xfSrcDel.length;
    const xfTgtDel = await dbc
      .delete(researchCrossFileRelationships)
      .where(
        inArray(researchCrossFileRelationships.targetCandidateId, candidateIds),
      )
      .returning({ id: researchCrossFileRelationships.id });
    totalAffected += xfTgtDel.length;

    // 3. candidate_coherence_checks: FK(candidateId)
    const cohDel = await dbc
      .delete(researchCandidateCoherenceChecks)
      .where(
        inArray(researchCandidateCoherenceChecks.candidateId, candidateIds),
      )
      .returning({ id: researchCandidateCoherenceChecks.id });
    totalAffected += cohDel.length;

    // 4. candidate_review_actions: FK(candidateId)
    const revDel = await dbc
      .delete(researchCandidateReviewActions)
      .where(
        inArray(researchCandidateReviewActions.candidateId, candidateIds),
      )
      .returning({ id: researchCandidateReviewActions.id });
    totalAffected += revDel.length;

    // 5. verified_cases (legacy table): FK(candidateId)
    const vcDel = await dbc
      .delete(researchVerifiedCases)
      .where(inArray(researchVerifiedCases.candidateId, candidateIds))
      .returning({ id: researchVerifiedCases.id });
    totalAffected += vcDel.length;

    // 6. candidate_boundaries: FK(candidateId)
    const bndDel = await dbc
      .delete(researchCaseCandidateBoundaries)
      .where(
        inArray(researchCaseCandidateBoundaries.candidateId, candidateIds),
      )
      .returning({ id: researchCaseCandidateBoundaries.id });
    totalAffected += bndDel.length;

    // 7. candidates themselves
    const candDel = await dbc
      .delete(researchCaseCandidates)
      .where(inArray(researchCaseCandidates.id, candidateIds))
      .returning({ id: researchCaseCandidates.id });
    totalAffected += candDel.length;

    return {
      layer,
      status: candDel.length > 0 ? "deleted" : "not_found",
      rowsAffected: totalAffected,
      objectStorageKeys: [],
    };
  } catch (err) {
    return {
      layer,
      status: "failed",
      rowsAffected: 0,
      objectStorageKeys: [],
      note: String(err),
    };
  }
}

/**
 * Count helper — returns 0 on error so pre-condition checks remain safe.
 */
async function countRows(
  dbc: DbClient,
  query: Promise<{ count: number }[]>,
): Promise<number> {
  try {
    const [row] = await query;
    return row?.count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * `verified_judgment`: delete `research_verified_judgments` row and
 * transition the container to DELETED state.
 *
 * DEPENDENCY ENFORCEMENT: Performs explicit pre-condition checks against
 * all tables that FK to verified_judgments. Returns `failed` with a
 * detailed note listing blocking tables if any data remains. Required
 * order: ai_output, search_index first (and clear user-workspace data
 * such as annotations, bookmarks, quotations, folder items, reading list
 * items before requesting this layer).
 */
async function deleteVerifiedJudgment(
  containerId: number,
  actor: string,
  dbc: DbClient,
): Promise<LayerResult> {
  const layer: LayerKind = "verified_judgment";
  try {
    const judgments = await dbc
      .select({ id: researchVerifiedJudgments.id })
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.containerId, containerId));
    if (judgments.length === 0) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }
    const judgmentIds = judgments.map((j) => j.id);

    // ── Pre-condition: check all FK-blocking tables ──────────────────────
    const countFor = (q: Promise<{ count: number }[]>) => countRows(dbc, q);
    const makeCount = (table: any, col: any) =>
      dbc
        .select({ count: drizzleSql<number>`count(*)::int` })
        .from(table)
        .where(inArray(col, judgmentIds));

    const [
      aiRunCount,
      searchIdxCount,
      caseMetaCount,
      dupLinkSrcCount,
      dupLinkTgtCount,
      annotCount,
      bookmarkCount,
      quotationCount,
      folderItemCount,
      readingListItemCount,
    ] = await Promise.all([
      countFor(makeCount(researchAiAnalysisRuns, researchAiAnalysisRuns.judgmentId)),
      countFor(makeCount(researchSearchIndex, researchSearchIndex.judgmentId)),
      countFor(makeCount(researchCaseMetadata, researchCaseMetadata.judgmentId)),
      countFor(makeCount(researchDuplicateLinks, researchDuplicateLinks.sourceJudgmentId)),
      countFor(makeCount(researchDuplicateLinks, researchDuplicateLinks.targetJudgmentId)),
      countFor(makeCount(researchAnnotations, researchAnnotations.judgmentId)),
      countFor(makeCount(researchBookmarks, researchBookmarks.judgmentId)),
      countFor(makeCount(researchQuotations, researchQuotations.judgmentId)),
      countFor(makeCount(researchFolderItems, researchFolderItems.judgmentId)),
      countFor(makeCount(researchReadingListItems, researchReadingListItems.judgmentId)),
    ]);

    const blockers: string[] = [];
    if (aiRunCount > 0)
      blockers.push(`ai_analysis_runs (${aiRunCount} row(s) — delete ai_output layer first)`);
    if (searchIdxCount > 0)
      blockers.push(`search_index (${searchIdxCount} row(s) — delete search_index layer first)`);
    if (caseMetaCount > 0)
      blockers.push(`case_metadata (${caseMetaCount} row(s))`);
    if (dupLinkSrcCount + dupLinkTgtCount > 0)
      blockers.push(`duplicate_links (${dupLinkSrcCount + dupLinkTgtCount} row(s))`);
    if (annotCount > 0)
      blockers.push(`annotations (${annotCount} row(s))`);
    if (bookmarkCount > 0)
      blockers.push(`bookmarks (${bookmarkCount} row(s))`);
    if (quotationCount > 0)
      blockers.push(`quotations (${quotationCount} row(s))`);
    if (folderItemCount > 0)
      blockers.push(`folder_items (${folderItemCount} row(s))`);
    if (readingListItemCount > 0)
      blockers.push(`reading_list_items (${readingListItemCount} row(s))`);

    if (blockers.length > 0) {
      return {
        layer,
        status: "failed",
        rowsAffected: 0,
        objectStorageKeys: [],
        note: `Deletion blocked by FK-dependent data: ${blockers.join(", ")}. Clear those tables first then retry this layer.`,
      };
    }

    // All pre-conditions met — proceed with deletion.
    const deleted = await dbc
      .delete(researchVerifiedJudgments)
      .where(inArray(researchVerifiedJudgments.id, judgmentIds))
      .returning({ id: researchVerifiedJudgments.id });

    // Transition container state to DELETED (best-effort — row deletion has
    // already succeeded; a state-machine failure should not block the response).
    try {
      const [containerRow] = await dbc
        .select({ processingState: researchSourceContainers.processingState })
        .from(researchSourceContainers)
        .where(eq(researchSourceContainers.id, containerId));
      const state = containerRow?.processingState;
      if (state && state !== "DELETED") {
        if (state !== "DELETION_PENDING") {
          await transitionContainer(containerId, "DELETION_PENDING", { actor });
        }
        await transitionContainer(containerId, "DELETED", { actor });
      }
    } catch {
      /* state transition failures do not fail the deletion itself */
    }

    return {
      layer,
      status: deleted.length > 0 ? "deleted" : "not_found",
      rowsAffected: deleted.length,
      objectStorageKeys: [],
    };
  } catch (err) {
    return {
      layer,
      status: "failed",
      rowsAffected: 0,
      objectStorageKeys: [],
      note: String(err),
    };
  }
}

/**
 * `search_index`: delete the full-text search index row for this container.
 */
async function deleteSearchIndex(
  containerId: number,
  dbc: DbClient,
): Promise<LayerResult> {
  const layer: LayerKind = "search_index";
  try {
    const deleted = await dbc
      .delete(researchSearchIndex)
      .where(eq(researchSearchIndex.containerId, containerId))
      .returning({ id: researchSearchIndex.id });
    return {
      layer,
      status: deleted.length > 0 ? "deleted" : "not_found",
      rowsAffected: deleted.length,
      objectStorageKeys: [],
    };
  } catch (err) {
    return {
      layer,
      status: "failed",
      rowsAffected: 0,
      objectStorageKeys: [],
      note: String(err),
    };
  }
}

/**
 * `ai_output`: delete AI analysis runs, propositions, and associated
 * authorities/legislation refs that FK to propositions.
 * Raw output objects in object storage are also deleted.
 */
async function deleteAiOutput(
  containerId: number,
  dbc: DbClient,
): Promise<LayerResult> {
  const layer: LayerKind = "ai_output";
  try {
    const judgments = await dbc
      .select({ id: researchVerifiedJudgments.id })
      .from(researchVerifiedJudgments)
      .where(eq(researchVerifiedJudgments.containerId, containerId));
    if (judgments.length === 0) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }
    const judgmentIds = judgments.map((j) => j.id);

    const runs = await dbc
      .select({
        id: researchAiAnalysisRuns.id,
        rawOutputStorageKey: researchAiAnalysisRuns.rawOutputStorageKey,
      })
      .from(researchAiAnalysisRuns)
      .where(inArray(researchAiAnalysisRuns.judgmentId, judgmentIds));

    if (runs.length === 0) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }

    const runIds = runs.map((r) => r.id);

    const propositions = await dbc
      .select({ id: researchAiPropositions.id })
      .from(researchAiPropositions)
      .where(inArray(researchAiPropositions.runId, runIds));
    const propositionIds = propositions.map((p) => p.id);

    // Delete FK-children of propositions: authorities and legislation refs.
    if (propositionIds.length > 0) {
      await dbc
        .delete(researchAuthorities)
        .where(inArray(researchAuthorities.propositionId, propositionIds));
      await dbc
        .delete(researchLegislationRefs)
        .where(inArray(researchLegislationRefs.propositionId, propositionIds));
    }

    const deletedProps = await dbc
      .delete(researchAiPropositions)
      .where(inArray(researchAiPropositions.runId, runIds))
      .returning({ id: researchAiPropositions.id });

    // Delete raw output objects from storage.
    const rawKeys = runs
      .map((r) => r.rawOutputStorageKey)
      .filter((k): k is string => k !== null);
    const { deleted: deletedKeys, failed: storageFailures } =
      await deleteStorageKeys(rawKeys);

    const deletedRuns = await dbc
      .delete(researchAiAnalysisRuns)
      .where(inArray(researchAiAnalysisRuns.id, runIds))
      .returning({ id: researchAiAnalysisRuns.id });

    return {
      layer,
      status: "deleted",
      rowsAffected: deletedProps.length + deletedRuns.length,
      objectStorageKeys: deletedKeys,
      storageFailures: storageFailures.length > 0 ? storageFailures : undefined,
      note:
        storageFailures.length > 0
          ? `DB rows deleted but raw output storage deletion failed for ${storageFailures.length} key(s).`
          : undefined,
    };
  } catch (err) {
    return {
      layer,
      status: "failed",
      rowsAffected: 0,
      objectStorageKeys: [],
      note: String(err),
    };
  }
}

/**
 * `temp_files`: delete processor-generated stored artifacts and their
 * backing objects in object storage.
 */
async function deleteTempFiles(
  containerId: number,
  dbc: DbClient,
): Promise<LayerResult> {
  const layer: LayerKind = "temp_files";
  try {
    const artifacts = await dbc
      .select({
        id: researchStoredArtifacts.id,
        storageKey: researchStoredArtifacts.storageKey,
      })
      .from(researchStoredArtifacts)
      .where(eq(researchStoredArtifacts.containerId, containerId));

    if (artifacts.length === 0) {
      return { layer, status: "not_found", rowsAffected: 0, objectStorageKeys: [] };
    }

    const allKeys = artifacts.map((a) => a.storageKey);
    const { deleted: deletedKeys, failed: storageFailures } =
      await deleteStorageKeys(allKeys);

    const artifactIds = artifacts.map((a) => a.id);
    const deleted = await dbc
      .delete(researchStoredArtifacts)
      .where(inArray(researchStoredArtifacts.id, artifactIds))
      .returning({ id: researchStoredArtifacts.id });

    return {
      layer,
      status: deleted.length > 0 ? "deleted" : "not_found",
      rowsAffected: deleted.length,
      objectStorageKeys: deletedKeys,
      storageFailures: storageFailures.length > 0 ? storageFailures : undefined,
      note:
        storageFailures.length > 0
          ? `DB rows deleted but object storage deletion failed for ${storageFailures.length} key(s).`
          : undefined,
    };
  } catch (err) {
    return {
      layer,
      status: "failed",
      rowsAffected: 0,
      objectStorageKeys: [],
      note: String(err),
    };
  }
}

// ── Main entry point ──────────────────────────────────────────────────────

/**
 * Delete the requested layers for a container. Returns a deletion manifest.
 * Failures on individual layers are collected; already-completed layers are
 * not rolled back.
 */
export async function deleteContainerLayers(
  containerId: number,
  layers: LayerKind[],
  actor: string,
  dbc: DbClient = globalDb,
): Promise<DeletionManifest> {
  const requestedAt = new Date().toISOString();
  const results: LayerResult[] = [];

  for (const layerKind of layers) {
    let result: LayerResult;
    switch (layerKind) {
      case "original_file":
        result = await deleteOriginalFile(containerId, dbc);
        break;
      case "page_text":
        result = await deletePageText(containerId, dbc);
        break;
      case "ocr_images":
        result = await deleteOcrImages(containerId, dbc);
        break;
      case "corrected_text":
        result = await deleteCorrectedText(containerId, dbc);
        break;
      case "case_candidates":
        result = await deleteCaseCandidates(containerId, dbc);
        break;
      case "verified_judgment":
        result = await deleteVerifiedJudgment(containerId, actor, dbc);
        break;
      case "search_index":
        result = await deleteSearchIndex(containerId, dbc);
        break;
      case "ai_output":
        result = await deleteAiOutput(containerId, dbc);
        break;
      case "temp_files":
        result = await deleteTempFiles(containerId, dbc);
        break;
      default: {
        const exhaustive: never = layerKind;
        result = {
          layer: exhaustive,
          status: "failed",
          rowsAffected: 0,
          objectStorageKeys: [],
          note: `Unknown layer kind: ${String(exhaustive)}`,
        };
      }
    }
    results.push(result);

    // Emit RECORD_DELETED audit event for each successfully deleted layer.
    if (result.status === "deleted") {
      void emitAuditEvent({
        entityType: "container",
        entityId: containerId,
        event: AuditAction.RECORD_DELETED,
        actor,
        detail: { layer: layerKind, rowsAffected: result.rowsAffected },
      });
    }
  }

  // Build the manifest.
  const manifestId = randomUUID();
  const manifestPath = `deletion-manifests/${containerId}/${manifestId}.json`;
  let manifestKey = manifestPath;

  const partialManifest: Omit<DeletionManifest, "manifestKey"> = {
    containerId,
    requestedAt,
    actor,
    layers: results,
    backupConfirmed: false,
    backupNote: BACKUP_NOTE,
  };

  // Store manifest to object storage (best-effort).
  try {
    const storage = getAdapters().storage;
    const resolvedKey = await storage.put(
      manifestPath,
      Buffer.from(
        JSON.stringify({ ...partialManifest, manifestKey: manifestPath }),
      ),
      "application/json",
    );
    manifestKey = resolvedKey;
    // Re-write with the final resolved key now that we have it.
    await storage.put(
      manifestPath,
      Buffer.from(JSON.stringify({ ...partialManifest, manifestKey })),
      "application/json",
    );
  } catch {
    // Storage failure is acceptable — the manifest body is also stored in DB.
  }

  const manifest: DeletionManifest = { ...partialManifest, manifestKey };

  // Insert DB record with the full manifest body as a resilient fallback.
  await dbc.insert(researchDeletionManifests).values({
    containerId,
    requestedAt: new Date(requestedAt),
    actor,
    layersRequested: layers,
    manifestKey,
    manifestBody: manifest as unknown as Record<string, unknown>,
  });

  return manifest;
}

/**
 * Retrieve the most recent deletion manifest JSON for a container.
 * Tries object storage first; falls back to the DB-stored body if storage
 * is unavailable. Returns null only if no manifest record exists at all.
 */
export async function getLatestDeletionManifest(
  containerId: number,
  dbc: DbClient = globalDb,
): Promise<DeletionManifest | null> {
  const [row] = await dbc
    .select()
    .from(researchDeletionManifests)
    .where(eq(researchDeletionManifests.containerId, containerId))
    .orderBy(desc(researchDeletionManifests.createdAt))
    .limit(1);

  if (!row) return null;

  // Try object storage first for the authoritative copy.
  try {
    const storage = getAdapters().storage;
    const bytes = await storage.get(row.manifestKey);
    return JSON.parse(bytes.toString("utf-8")) as DeletionManifest;
  } catch {
    // Fall back to the DB-stored manifest body (resilient against storage faults).
    if (row.manifestBody) {
      return row.manifestBody as unknown as DeletionManifest;
    }
    // DB body missing (pre-migration row): return a synthetic minimal manifest
    // so the history route always returns something meaningful.
    return {
      containerId: row.containerId,
      requestedAt: row.requestedAt.toISOString(),
      actor: row.actor,
      layers: [],
      backupConfirmed: false,
      backupNote: BACKUP_NOTE,
      manifestKey: row.manifestKey,
    };
  }
}
