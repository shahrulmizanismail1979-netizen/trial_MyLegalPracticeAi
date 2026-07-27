// Phase 11b: Research Workspace service layer.
//
// All functions are scoped to an authenticated research user (integer userId
// from researchUsers.id).  Ownership is always enforced: reading/mutating
// another user's private items is a programming error, not a runtime path.
//
// Container view gates for judgment-linked items are the caller's
// responsibility (routes layer enforces them before calling into this service).

import {
  db,
  researchFolders,
  researchFolderItems,
  researchSavedSearches,
  researchReadingLists,
  researchReadingListItems,
  researchQuotationCollections,
  researchWorkspaceQuotations,
  researchComparisonTables,
  researchAuthoritiesTables,
  researchBookmarks,
  researchAnnotations,
  researchAiPropositions,
  researchAiAnalysisRuns,
  researchAuthorities,
  researchLegislationRefs,
  researchVerifiedJudgments,
  type FolderKind,
  type ResearchRole,
} from "@workspace/db";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DbClient } from "../domain/types";
import { CITATION_GRAPH_DISCLAIMER } from "../authorities/extractor";

// ── Folders ───────────────────────────────────────────────────────────────

export async function createFolder(
  userId: number,
  data: { kind: FolderKind; name: string; description?: string | null },
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .insert(researchFolders)
    .values({ ownerId: userId, kind: data.kind, name: data.name, description: data.description ?? null })
    .returning();
  return row!;
}

export async function listFolders(userId: number, role: ResearchRole | null, dbc: DbClient = db) {
  // Owners see their own folders.  Students also see folders from any user
  // where sharedWithStudents = true.
  if (role === "student") {
    return dbc
      .select()
      .from(researchFolders)
      .where(
        sql`${researchFolders.ownerId} = ${userId} OR ${researchFolders.sharedWithStudents} = true`,
      )
      .orderBy(researchFolders.id);
  }
  return dbc
    .select()
    .from(researchFolders)
    .where(eq(researchFolders.ownerId, userId))
    .orderBy(researchFolders.id);
}

export async function getFolder(folderId: number, dbc: DbClient = db) {
  const [row] = await dbc.select().from(researchFolders).where(eq(researchFolders.id, folderId));
  return row ?? null;
}

export async function deleteFolder(folderId: number, dbc: DbClient = db) {
  await dbc.delete(researchFolderItems).where(eq(researchFolderItems.folderId, folderId));
  await dbc.delete(researchFolders).where(eq(researchFolders.id, folderId));
}

export async function addJudgmentToFolder(
  folderId: number,
  judgmentId: number,
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .insert(researchFolderItems)
    .values({ folderId, judgmentId })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function removeJudgmentFromFolder(
  folderId: number,
  judgmentId: number,
  dbc: DbClient = db,
) {
  await dbc
    .delete(researchFolderItems)
    .where(and(eq(researchFolderItems.folderId, folderId), eq(researchFolderItems.judgmentId, judgmentId)));
}

export async function listFolderItems(folderId: number, dbc: DbClient = db) {
  return dbc
    .select()
    .from(researchFolderItems)
    .where(eq(researchFolderItems.folderId, folderId))
    .orderBy(asc(researchFolderItems.id));
}

// ── Saved searches ────────────────────────────────────────────────────────

export async function createSavedSearch(
  userId: number,
  data: { name: string; query: Record<string, unknown> },
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .insert(researchSavedSearches)
    .values({ ownerId: userId, name: data.name, query: data.query })
    .returning();
  return row!;
}

export async function listSavedSearches(userId: number, dbc: DbClient = db) {
  return dbc
    .select()
    .from(researchSavedSearches)
    .where(eq(researchSavedSearches.ownerId, userId))
    .orderBy(desc(researchSavedSearches.id));
}

export async function deleteSavedSearch(id: number, dbc: DbClient = db) {
  await dbc.delete(researchSavedSearches).where(eq(researchSavedSearches.id, id));
}

// ── Reading lists ─────────────────────────────────────────────────────────

export async function createReadingList(
  userId: number,
  data: { name: string; sharedWithStudents?: boolean },
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .insert(researchReadingLists)
    .values({ ownerId: userId, name: data.name, sharedWithStudents: data.sharedWithStudents ?? false })
    .returning();
  return row!;
}

export async function listReadingLists(userId: number, role: ResearchRole | null, dbc: DbClient = db) {
  if (role === "student") {
    return dbc
      .select()
      .from(researchReadingLists)
      .where(
        sql`${researchReadingLists.ownerId} = ${userId} OR ${researchReadingLists.sharedWithStudents} = true`,
      )
      .orderBy(researchReadingLists.id);
  }
  return dbc
    .select()
    .from(researchReadingLists)
    .where(eq(researchReadingLists.ownerId, userId))
    .orderBy(researchReadingLists.id);
}

export async function getReadingList(listId: number, dbc: DbClient = db) {
  const [row] = await dbc.select().from(researchReadingLists).where(eq(researchReadingLists.id, listId));
  return row ?? null;
}

export async function addJudgmentToList(
  listId: number,
  judgmentId: number,
  position: number,
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .insert(researchReadingListItems)
    .values({ listId, judgmentId, position })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function markItemAsRead(
  listId: number,
  judgmentId: number,
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .update(researchReadingListItems)
    .set({ readAt: new Date() })
    .where(and(eq(researchReadingListItems.listId, listId), eq(researchReadingListItems.judgmentId, judgmentId)))
    .returning();
  return row ?? null;
}

export async function reorderListItem(
  listId: number,
  judgmentId: number,
  newPosition: number,
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .update(researchReadingListItems)
    .set({ position: newPosition })
    .where(and(eq(researchReadingListItems.listId, listId), eq(researchReadingListItems.judgmentId, judgmentId)))
    .returning();
  return row ?? null;
}

export async function listReadingListItems(listId: number, dbc: DbClient = db) {
  return dbc
    .select()
    .from(researchReadingListItems)
    .where(eq(researchReadingListItems.listId, listId))
    .orderBy(asc(researchReadingListItems.position));
}

export async function removeJudgmentFromList(
  listId: number,
  judgmentId: number,
  dbc: DbClient = db,
) {
  await dbc
    .delete(researchReadingListItems)
    .where(and(eq(researchReadingListItems.listId, listId), eq(researchReadingListItems.judgmentId, judgmentId)));
}

// ── Bookmarks (extended with folder) ─────────────────────────────────────

export async function upsertBookmark(
  userId: number,
  judgmentId: number,
  data: { label?: string | null; folderId?: number | null },
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .insert(researchBookmarks)
    .values({ userId, judgmentId, label: data.label ?? null, folderId: data.folderId ?? null })
    .onConflictDoUpdate({
      target: [researchBookmarks.userId, researchBookmarks.judgmentId],
      set: { label: data.label ?? null, folderId: data.folderId ?? null },
    })
    .returning();
  return row!;
}

export async function deleteBookmark(userId: number, judgmentId: number, dbc: DbClient = db) {
  await dbc
    .delete(researchBookmarks)
    .where(and(eq(researchBookmarks.userId, userId), eq(researchBookmarks.judgmentId, judgmentId)));
}

export async function listBookmarks(userId: number, dbc: DbClient = db) {
  return dbc
    .select()
    .from(researchBookmarks)
    .where(eq(researchBookmarks.userId, userId))
    .orderBy(desc(researchBookmarks.id));
}

// ── Annotations (extended with charStart, charEnd, tags, isPublic) ───────

export async function createAnnotation(
  userId: number,
  judgmentId: number,
  data: {
    kind?: "note" | "highlight" | "flag";
    body: string;
    paragraphRef?: string | null;
    charStart?: number | null;
    charEnd?: number | null;
    tags?: string[] | null;
    isPublic?: boolean;
  },
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .insert(researchAnnotations)
    .values({
      userId,
      judgmentId,
      kind: data.kind ?? "note",
      body: data.body,
      paragraphRef: data.paragraphRef ?? null,
      charStart: data.charStart ?? null,
      charEnd: data.charEnd ?? null,
      tags: data.tags ?? null,
      isPublic: data.isPublic ?? false,
    })
    .returning();
  return row!;
}

export async function updateAnnotation(
  annotationId: number,
  userId: number,
  data: Partial<{
    body: string;
    kind: "note" | "highlight" | "flag";
    paragraphRef: string | null;
    charStart: number | null;
    charEnd: number | null;
    tags: string[] | null;
    isPublic: boolean;
  }>,
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .update(researchAnnotations)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(researchAnnotations.id, annotationId), eq(researchAnnotations.userId, userId)))
    .returning();
  return row ?? null;
}

export async function deleteAnnotation(annotationId: number, userId: number, dbc: DbClient = db) {
  await dbc
    .delete(researchAnnotations)
    .where(and(eq(researchAnnotations.id, annotationId), eq(researchAnnotations.userId, userId)));
}

/**
 * List annotations for a judgment.  Non-owners only see is_public = true
 * annotations from other users.
 */
export async function listAnnotations(
  judgmentId: number,
  requestingUserId: number,
  dbc: DbClient = db,
) {
  const rows = await dbc
    .select()
    .from(researchAnnotations)
    .where(eq(researchAnnotations.judgmentId, judgmentId))
    .orderBy(researchAnnotations.id);
  // Filter: own annotations always visible; others only if is_public.
  return rows.filter((r) => r.userId === requestingUserId || r.isPublic);
}

// ── Quotation collections ─────────────────────────────────────────────────

export async function createQuotationCollection(
  userId: number,
  name: string,
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .insert(researchQuotationCollections)
    .values({ ownerId: userId, name })
    .returning();
  return row!;
}

export async function listQuotationCollections(userId: number, dbc: DbClient = db) {
  return dbc
    .select()
    .from(researchQuotationCollections)
    .where(eq(researchQuotationCollections.ownerId, userId))
    .orderBy(researchQuotationCollections.id);
}

export async function saveQuotation(
  collectionId: number,
  data: {
    propositionId: number;
    passageText: string;
    label?: string | null;
    charStart?: number | null;
    charEnd?: number | null;
  },
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .insert(researchWorkspaceQuotations)
    .values({
      collectionId,
      propositionId: data.propositionId,
      passageText: data.passageText,
      label: data.label ?? null,
      charStart: data.charStart ?? null,
      charEnd: data.charEnd ?? null,
    })
    .returning();
  return row!;
}

export async function listQuotations(collectionId: number, dbc: DbClient = db) {
  return dbc
    .select()
    .from(researchWorkspaceQuotations)
    .where(eq(researchWorkspaceQuotations.collectionId, collectionId))
    .orderBy(researchWorkspaceQuotations.id);
}

/** Export collection quotations as plain text (one per line, labelled). */
export async function exportCollectionText(collectionId: number, dbc: DbClient = db) {
  const rows = await listQuotations(collectionId, dbc);
  return rows
    .map((q, i) => {
      const header = q.label ? `[${i + 1}] ${q.label}` : `[${i + 1}]`;
      return `${header}\n${q.passageText}`;
    })
    .join("\n\n");
}

// ── Case-comparison tables ────────────────────────────────────────────────

export const MAX_COMPARISON_JUDGMENTS = 10;

export async function createComparisonTable(
  userId: number,
  data: { name: string; judgmentIds: number[]; fieldNames: string[] },
  dbc: DbClient = db,
) {
  if (data.judgmentIds.length > MAX_COMPARISON_JUDGMENTS) {
    throw new Error(`A comparison table may have at most ${MAX_COMPARISON_JUDGMENTS} judgment columns.`);
  }
  const [row] = await dbc
    .insert(researchComparisonTables)
    .values({ ownerId: userId, name: data.name, judgmentIds: data.judgmentIds, fieldNames: data.fieldNames })
    .returning();
  return row!;
}

export async function updateComparisonTable(
  tableId: number,
  data: Partial<{ name: string; judgmentIds: number[]; fieldNames: string[] }>,
  dbc: DbClient = db,
) {
  if (data.judgmentIds && data.judgmentIds.length > MAX_COMPARISON_JUDGMENTS) {
    throw new Error(`A comparison table may have at most ${MAX_COMPARISON_JUDGMENTS} judgment columns.`);
  }
  const [row] = await dbc
    .update(researchComparisonTables)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(researchComparisonTables.id, tableId))
    .returning();
  return row ?? null;
}

export async function listComparisonTables(userId: number, dbc: DbClient = db) {
  return dbc
    .select()
    .from(researchComparisonTables)
    .where(eq(researchComparisonTables.ownerId, userId))
    .orderBy(researchComparisonTables.id);
}

export async function getComparisonTable(tableId: number, dbc: DbClient = db) {
  const [row] = await dbc
    .select()
    .from(researchComparisonTables)
    .where(eq(researchComparisonTables.id, tableId));
  return row ?? null;
}

export async function deleteComparisonTable(tableId: number, dbc: DbClient = db) {
  await dbc.delete(researchComparisonTables).where(eq(researchComparisonTables.id, tableId));
}

/**
 * Render a comparison grid.
 *
 * Returns:
 *   columns: [{ judgmentId, ... }]
 *   rows: [{ fieldName, cells: [{ judgmentId, content: string[] }] }]
 *
 * Content is sourced from the latest APPROVED run's propositions for each
 * (judgment, fieldName) pair.  Missing combinations produce an empty array.
 */
export async function renderComparisonTable(tableId: number, dbc: DbClient = db) {
  const table = await getComparisonTable(tableId, dbc);
  if (!table) return null;

  const judgmentIds = table.judgmentIds as number[];
  const fieldNames = table.fieldNames as string[];

  if (judgmentIds.length === 0 || fieldNames.length === 0) {
    return { table, columns: [], rows: [] };
  }

  // Find the latest APPROVED run per judgment.
  const runs = await dbc
    .select()
    .from(researchAiAnalysisRuns)
    .where(
      and(
        inArray(researchAiAnalysisRuns.judgmentId, judgmentIds),
        eq(researchAiAnalysisRuns.status, "APPROVED"),
      ),
    )
    .orderBy(desc(researchAiAnalysisRuns.id));

  // Keep only the latest run per judgment.
  const latestRunByJudgment = new Map<number, number>();
  for (const run of runs) {
    if (!latestRunByJudgment.has(run.judgmentId)) {
      latestRunByJudgment.set(run.judgmentId, run.id);
    }
  }

  const runIds = [...latestRunByJudgment.values()];

  // Load propositions for those runs + the requested field names.
  const props =
    runIds.length > 0
      ? await dbc
          .select()
          .from(researchAiPropositions)
          .where(
            and(
              inArray(researchAiPropositions.runId, runIds),
              inArray(researchAiPropositions.fieldName, fieldNames),
            ),
          )
      : [];

  // runId → judgmentId (reverse lookup).
  const runToJudgment = new Map(
    [...latestRunByJudgment.entries()].map(([jid, rid]) => [rid, jid]),
  );

  // Build: fieldName × judgmentId → content[].
  type Cell = { judgmentId: number; content: string[] };
  const grid = new Map<string, Map<number, string[]>>();
  for (const fn of fieldNames) {
    grid.set(fn, new Map(judgmentIds.map((jid) => [jid, []])));
  }
  for (const prop of props) {
    const jid = runToJudgment.get(prop.runId);
    if (jid === undefined) continue;
    const fnMap = grid.get(prop.fieldName);
    if (!fnMap) continue;
    const existing = fnMap.get(jid) ?? [];
    fnMap.set(jid, [...existing, prop.content]);
  }

  const rows = fieldNames.map((fn) => ({
    fieldName: fn,
    cells: judgmentIds.map((jid) => ({
      judgmentId: jid,
      content: grid.get(fn)?.get(jid) ?? [],
    })),
  }));

  const columns = judgmentIds.map((jid) => ({ judgmentId: jid }));

  return { table, columns, rows };
}

// ── Authorities tables ────────────────────────────────────────────────────

export async function createAuthoritiesTable(
  userId: number,
  data: { name: string; judgmentIds: number[] },
  dbc: DbClient = db,
) {
  const [row] = await dbc
    .insert(researchAuthoritiesTables)
    .values({ ownerId: userId, name: data.name, judgmentIds: data.judgmentIds })
    .returning();
  return row!;
}

export async function listAuthoritiesTables(userId: number, dbc: DbClient = db) {
  return dbc
    .select()
    .from(researchAuthoritiesTables)
    .where(eq(researchAuthoritiesTables.ownerId, userId))
    .orderBy(researchAuthoritiesTables.id);
}

export async function getAuthoritiesTable(tableId: number, dbc: DbClient = db) {
  const [row] = await dbc
    .select()
    .from(researchAuthoritiesTables)
    .where(eq(researchAuthoritiesTables.id, tableId));
  return row ?? null;
}

export async function deleteAuthoritiesTable(tableId: number, dbc: DbClient = db) {
  await dbc.delete(researchAuthoritiesTables).where(eq(researchAuthoritiesTables.id, tableId));
}

/**
 * Render an authorities table for a set of judgment IDs.
 * Always includes the collection-limitation disclaimer.
 */
export async function renderAuthoritiesTable(tableId: number, dbc: DbClient = db) {
  const table = await getAuthoritiesTable(tableId, dbc);
  if (!table) return null;

  const judgmentIds = table.judgmentIds as number[];

  if (judgmentIds.length === 0) {
    return {
      table,
      authorities: [],
      legislation: [],
      disclaimer: CITATION_GRAPH_DISCLAIMER,
    };
  }

  const [authorities, legislation] = await Promise.all([
    dbc.select().from(researchAuthorities).where(inArray(researchAuthorities.judgmentId, judgmentIds)).orderBy(researchAuthorities.judgmentId, researchAuthorities.id),
    dbc.select().from(researchLegislationRefs).where(inArray(researchLegislationRefs.judgmentId, judgmentIds)).orderBy(researchLegislationRefs.judgmentId, researchLegislationRefs.id),
  ]);

  return {
    table,
    authorities,
    legislation,
    disclaimer: CITATION_GRAPH_DISCLAIMER,
  };
}
