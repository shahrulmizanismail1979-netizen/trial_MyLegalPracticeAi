import { sql } from "drizzle-orm";

/** The statuses which can ever support a subscriber-facing LAWYes report. */
export const LIVE_REPORT_RIGHTS_STATUSES = [
  "OFFICIAL_COURT_SOURCE",
  "PUBLIC_OR_OPEN_LICENCE_SOURCE",
  "USER_OWNED_OR_AUTHORISED",
] as const;

export type LiveRightsAction = "display" | "export" | "print";

export interface LiveReportRights {
  rightsStatus: string;
  storagePermitted: boolean | null;
  analysisPermitted: boolean | null;
  studentAccessPermitted: boolean | null;
  expiryDate: Date | null;
  approvedPurposes: string[] | null;
  exportPermitted?: boolean | null;
  printingPermitted?: boolean | null;
}

/** Runtime counterpart of liveRightsPredicate, for write-time withdrawal. */
export function hasLiveReportRights(
  rights: LiveReportRights,
  action: LiveRightsAction = "display",
): boolean {
  return LIVE_REPORT_RIGHTS_STATUSES.includes(rights.rightsStatus as typeof LIVE_REPORT_RIGHTS_STATUSES[number])
    && rights.storagePermitted === true
    && rights.analysisPermitted === true
    && rights.studentAccessPermitted === true
    && (!rights.expiryDate || rights.expiryDate.getTime() > Date.now())
    && (rights.rightsStatus !== "USER_OWNED_OR_AUTHORISED"
      || rights.approvedPurposes?.some((purpose) =>
        ["publication", "public_display"].includes(purpose.toLowerCase()),
      ) === true)
    && (action === "display" || rights.exportPermitted === true)
    && (action !== "print" || rights.printingPermitted === true);
}

/**
 * SQL gate for a current LAWYes rights decision.  Keep this beside the
 * publication policy: a container's denormalised rights_status is not enough
 * to make previously published material visible.
 *
 * Callers must join `latestRightsJoin` before adding this predicate.
 */
export function latestRightsJoin(containerReference: string) {
  return sql`
    JOIN LATERAL (
      SELECT *
      FROM research_rights_records
      WHERE container_id = ${sql.raw(containerReference)}
      ORDER BY id DESC
      LIMIT 1
    ) current_rights ON true
  `;
}

export function liveRightsPredicate(
  action: LiveRightsAction,
  aliases: { container?: string; rights?: string } = {},
) {
  const container = sql.raw(aliases.container ?? "rsc");
  const rights = sql.raw(aliases.rights ?? "current_rights");
  const exportGate = action === "export" || action === "print"
    ? sql`AND ${rights}.export_permitted = true`
    : sql``;
  const printGate = action === "print"
    ? sql`AND ${rights}.printing_permitted = true`
    : sql``;
  return sql`
    AND ${container}.rights_status IN (
      'OFFICIAL_COURT_SOURCE', 'PUBLIC_OR_OPEN_LICENCE_SOURCE',
      'USER_OWNED_OR_AUTHORISED'
    )
    AND ${rights}.status IN (
      'OFFICIAL_COURT_SOURCE', 'PUBLIC_OR_OPEN_LICENCE_SOURCE',
      'USER_OWNED_OR_AUTHORISED'
    )
    AND ${rights}.storage_permitted = true
    AND ${rights}.analysis_permitted = true
    AND ${rights}.student_access_permitted = true
    AND (${rights}.expiry_date IS NULL OR ${rights}.expiry_date > now())
    AND (
      ${rights}.status <> 'USER_OWNED_OR_AUTHORISED'
      OR EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          COALESCE(${rights}.approved_purposes, '[]'::jsonb)
        ) purpose(value)
        WHERE lower(purpose.value) IN ('publication', 'public_display')
      )
    )
    ${exportGate}
    ${printGate}
  `;
}