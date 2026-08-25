import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

/**
 * A small, public summary of the research corpus. It deliberately distinguishes
 * Drive source documents from verified/indexed/published judgments so customer
 * interfaces never market source-file totals as searchable case law.
 */
router.get("/status", async (_req, res): Promise<void> => {
  const result = await db.execute(sql`
    SELECT
      COALESCE((
        SELECT total_items
        FROM drive_inventory_runs
        WHERE status = 'COMPLETED'
        ORDER BY completed_at DESC NULLS LAST, id DESC
        LIMIT 1
      ), 0)::int AS drive_documents,
      (
        SELECT completed_at
        FROM drive_inventory_runs
        WHERE status = 'COMPLETED'
        ORDER BY completed_at DESC NULLS LAST, id DESC
        LIMIT 1
      ) AS inventory_completed_at,
      (SELECT COUNT(*) FROM research_verified_judgments)::int AS verified_judgments,
      (SELECT COUNT(*) FROM research_search_index)::int AS indexed_judgments,
      (
        SELECT COUNT(DISTINCT rvj.id)
        FROM research_verified_judgments rvj
        JOIN research_source_containers rsc ON rsc.id = rvj.container_id
        JOIN research_search_index si ON si.judgment_id = rvj.id
        JOIN research_headnotes rh ON rh.judgment_id = rvj.id
        WHERE rh.status = 'accepted'
          AND rsc.processing_state = 'SEARCHABLE'
          AND rsc.rights_status IN (
            'OFFICIAL_COURT_SOURCE',
            'PUBLIC_OR_OPEN_LICENCE_SOURCE',
            'USER_OWNED_OR_AUTHORISED'
          )
      )::int AS searchable_judgments
  `);

  const row = result.rows[0] as
    | {
        drive_documents: number;
        verified_judgments: number;
        indexed_judgments: number;
        searchable_judgments: number;
        inventory_completed_at: Date | string | null;
      }
    | undefined;

  res.set("Cache-Control", "public, max-age=60");
  res.json({
    driveDocuments: Number(row?.drive_documents ?? 0),
    verifiedJudgments: Number(row?.verified_judgments ?? 0),
    indexedJudgments: Number(row?.indexed_judgments ?? 0),
    searchableJudgments: Number(row?.searchable_judgments ?? 0),
    inventoryCompletedAt: row?.inventory_completed_at
      ? new Date(row.inventory_completed_at).toISOString()
      : null,
  });
});

export default router;