import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { latestRightsJoin, liveRightsPredicate } from "../research/editorial/liveRights";

const router = Router();

/** Free official Malaysian judgment collections. Links are gateways only: the
 * Library never implies that a linked record is a published LAWYes report. */
export const OFFICIAL_JUDGMENT_COLLECTIONS = [
  { id: "ejudgment", name: "Malaysian Judiciary eJudgment", url: "https://ejudgment.kehakiman.gov.my/", jurisdiction: "Malaysia", access: "free" },
  { id: "sabah-sarawak", name: "e-Kehakiman Sabah and Sarawak", url: "https://ekss-portal.kehakiman.gov.my/", jurisdiction: "Sabah and Sarawak", access: "free" },
  { id: "industrial-court", name: "Industrial Court Full Awards", url: "https://www.mp.gov.my/index.php?option=com_content&view=article&id=33&Itemid=152&lang=en", jurisdiction: "Malaysia", access: "free" },
  { id: "jakess", name: "JAKESS Judgments", url: "https://www.jakess.gov.my/", jurisdiction: "Selangor Syariah", access: "free" },
  { id: "native-court-appeal", name: "Native Court of Appeal", url: "https://nativecourt.sabah.gov.my/", jurisdiction: "Sabah", access: "free" },
  { id: "judiciary-repository", name: "Judiciary Digital Repository", url: "https://library.kehakiman.gov.my/digital/", jurisdiction: "Malaysia", access: "free" },
] as const;

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
        JOIN research_lawyes_reports lr ON lr.judgment_id = rvj.id
        ${latestRightsJoin("rvj.container_id")}
        WHERE lr.state = 'Published'
          AND lr.lawyer_reviewed_at IS NOT NULL
          AND lr.published_at IS NOT NULL
          AND rsc.processing_state = 'SEARCHABLE'
          ${liveRightsPredicate("display")}
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

router.get("/official-collections", (_req, res): void => {
  res.set("Cache-Control", "public, max-age=86400");
  res.json({
    disclaimer: "Official collection gateways are provided for source access. A linked judgment is not a LAWYes published report unless it passes the Library's verification, rights and editorial gates.",
    collections: OFFICIAL_JUDGMENT_COLLECTIONS,
  });
});

export default router;