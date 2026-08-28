import { pool, type RightsStatus } from "@workspace/db";
import { ensureLawyesReportTables } from "./ensureLawyesReportTables";
import { materializeVerifiedParagraphs } from "./lawyesReportService";
import { hasLiveReportRights } from "./liveRights";

const INTAKE_ACTOR = "lawyes-editorial-intake";
const DEFAULT_LIMIT = 100;

export interface LawyesIntakeCandidate {
  judgmentId: number;
  rightsRecordId: number;
  rightsStatus: RightsStatus;
  storagePermitted: boolean | null;
  analysisPermitted: boolean | null;
  studentAccessPermitted: boolean | null;
  expiryDate: Date | null;
  approvedPurposes: string[] | null;
  title: string;
  sourceUrl: string | null;
  court: string | null;
  sourceName: string;
  hasVerifiedFullText: boolean;
}

export function isEligibleLawyesIntakeSource(candidate: LawyesIntakeCandidate): boolean {
  return hasLiveReportRights({
    rightsStatus: candidate.rightsStatus,
    storagePermitted: candidate.storagePermitted,
    analysisPermitted: candidate.analysisPermitted,
    studentAccessPermitted: candidate.studentAccessPermitted,
    expiryDate: candidate.expiryDate,
    approvedPurposes: candidate.approvedPurposes,
  });
}

/** Lower values are processed first; unmatched indexed records remain eligible. */
export function lawyesIntakePriority(candidate: Pick<LawyesIntakeCandidate, "court" | "sourceName">): number {
  const label = `${candidate.court ?? ""} ${candidate.sourceName}`.toLowerCase();
  if (/(sabah|sarawak).{0,80}high court|high court.{0,80}(sabah|sarawak)/.test(label)) return 0;
  if (/industrial court/.test(label)) return 1;
  if (/jakess/.test(label)) return 2;
  return 3;
}

export function orderLawyesIntake<T extends LawyesIntakeCandidate>(candidates: T[]): T[] {
  return [...candidates].sort(
    (left, right) => lawyesIntakePriority(left) - lawyesIntakePriority(right) || left.judgmentId - right.judgmentId,
  );
}

export type LawyesIntakeDisposition =
  | { kind: "skip" }
  | { kind: "pending_access"; reason: string }
  | { kind: "draft"; state: "Draft" };

/** Pure planning seam: a previously recorded judgment is never re-seeded. */
export function planLawyesIntake(
  candidate: LawyesIntakeCandidate,
  alreadyRecorded: ReadonlySet<number>,
): LawyesIntakeDisposition {
  if (alreadyRecorded.has(candidate.judgmentId) || !isEligibleLawyesIntakeSource(candidate)) {
    return { kind: "skip" };
  }
  if (!candidate.hasVerifiedFullText) {
    return { kind: "pending_access", reason: "Verified full text with stable paragraph identifiers is not available" };
  }
  if (!candidate.sourceUrl?.match(/^https?:\/\//i)) {
    return { kind: "pending_access", reason: "Verified official or authorised source URL is not available" };
  }
  // Intake is deliberately incapable of selecting a publishable state.
  return { kind: "draft", state: "Draft" };
}

type IntakeRow = {
  judgment_id: number;
  rights_record_id: number;
  rights_status: RightsStatus;
  storage_permitted: boolean | null;
  analysis_permitted: boolean | null;
  student_access_permitted: boolean | null;
  expiry_date: Date | null;
  approved_purposes: string[] | null;
  title: string;
  source_url: string | null;
  court: string | null;
  source_name: string;
  has_verified_full_text: boolean;
};

function asCandidate(row: IntakeRow): LawyesIntakeCandidate {
  return {
    judgmentId: row.judgment_id, rightsRecordId: row.rights_record_id,
    rightsStatus: row.rights_status, storagePermitted: row.storage_permitted,
    analysisPermitted: row.analysis_permitted, studentAccessPermitted: row.student_access_permitted,
    expiryDate: row.expiry_date, approvedPurposes: row.approved_purposes, title: row.title,
    sourceUrl: row.source_url, court: row.court, sourceName: row.source_name,
    hasVerifiedFullText: row.has_verified_full_text,
  };
}

const CANDIDATES_SQL = `
 SELECT j.id judgment_id, rr.id rights_record_id, c.rights_status, rr.storage_permitted,
        rr.analysis_permitted, rr.student_access_permitted, rr.expiry_date, rr.approved_purposes,
        COALESCE((SELECT m.value #>> '{}' FROM research_case_metadata m
                    WHERE m.judgment_id=j.id AND m.field_name='caseName'
                      AND m.reviewer_status='approved' ORDER BY m.id DESC LIMIT 1), c.original_name) title,
        COALESCE(c.provenance->>'sourceUrl', c.provenance->>'source_url', c.provenance->>'url') source_url,
        si.court, c.original_name source_name,
        jsonb_array_length(j.paragraph_identifiers) > 0 AND jsonb_array_length(j.page_refs) > 0
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(j.page_refs) page_ref
             WHERE NOT EXISTS (
               SELECT 1 FROM LATERAL (
                 SELECT pe.raw_text FROM research_page_extractions pe
                  WHERE pe.page_id=page_ref::integer ORDER BY pe.id DESC LIMIT 1
               ) latest WHERE nullif(btrim(latest.raw_text),'') IS NOT NULL
             )
          )
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(j.paragraph_identifiers) paragraph_key
             WHERE strpos(COALESCE((
               SELECT string_agg(latest.raw_text, E'\n' ORDER BY page_ref.ord)
                FROM jsonb_array_elements_text(j.page_refs) WITH ORDINALITY page_ref(value, ord)
                JOIN LATERAL (
                  SELECT pe.raw_text FROM research_page_extractions pe
                   WHERE pe.page_id=page_ref.value::integer ORDER BY pe.id DESC LIMIT 1
                ) latest ON true
             ), ''), paragraph_key) = 0
          ) has_verified_full_text
   FROM research_verified_judgments j
   JOIN research_search_index si ON si.judgment_id=j.id
   JOIN research_source_containers c ON c.id=j.container_id
   JOIN LATERAL (SELECT * FROM research_rights_records x
                 WHERE x.container_id=c.id ORDER BY x.id DESC LIMIT 1) rr ON true
   LEFT JOIN research_lawyes_reports r ON r.judgment_id=j.id
   LEFT JOIN research_lawyes_access_records ar ON ar.judgment_id=j.id
  WHERE r.id IS NULL AND ar.id IS NULL
    AND c.rights_status IN ('OFFICIAL_COURT_SOURCE','PUBLIC_OR_OPEN_LICENCE_SOURCE','USER_OWNED_OR_AUTHORISED')
    AND rr.status=c.rights_status AND rr.storage_permitted=true AND rr.analysis_permitted=true
    AND rr.student_access_permitted=true AND (rr.expiry_date IS NULL OR rr.expiry_date > now())
    AND (rr.status <> 'USER_OWNED_OR_AUTHORISED' OR EXISTS (
      SELECT 1
        FROM jsonb_array_elements_text(COALESCE(rr.approved_purposes, '[]'::jsonb)) purpose(value)
       WHERE lower(purpose.value) IN ('publication','public_display')))
`;

export interface LawyesIntakeResult {
  drafted: number;
  pendingAccess: number;
  skipped: number;
}

/**
 * Best-effort intake of indexed, live-rights records. It only creates Draft
 * reports from verified paragraph-addressable source text; all other eligible
 * records are recorded as pending access, and no state transition is made.
 */
export async function seedLawyesEditorialIntake(
  limit = DEFAULT_LIMIT,
  options: { dryRun?: boolean } = {},
): Promise<LawyesIntakeResult> {
  await ensureLawyesReportTables();
  const result = await pool.query<IntakeRow>(CANDIDATES_SQL);
  const candidates = orderLawyesIntake(result.rows.map(asCandidate)).slice(0, limit);
  const outcome: LawyesIntakeResult = { drafted: 0, pendingAccess: 0, skipped: 0 };
  for (const candidate of candidates) {
    const plan = planLawyesIntake(candidate, new Set());
    if (plan.kind === "skip") {
      outcome.skipped += 1;
      continue;
    }
    if (plan.kind === "pending_access") {
      if (options.dryRun) {
        outcome.pendingAccess += 1;
        continue;
      }
      const inserted = await pool.query(
        `INSERT INTO research_lawyes_access_records
          (judgment_id,source_rights_record_id,status,reason,created_by)
         VALUES ($1,$2,'pending_verified_full_text',$3,$4)
         ON CONFLICT (judgment_id) DO NOTHING RETURNING id`,
        [candidate.judgmentId, candidate.rightsRecordId, plan.reason, INTAKE_ACTOR],
      );
      outcome.pendingAccess += inserted.rowCount ?? 0;
      continue;
    }
    if (options.dryRun) {
      outcome.drafted += 1;
      continue;
    }
    const created = await pool.query<{ id: number }>(
      `INSERT INTO research_lawyes_reports
        (judgment_id,state,title,court,source_url,source_verified_at,source_rights_record_id,created_by)
       VALUES ($1,$2,$3,$4,$5,now(),$6,$7)
       ON CONFLICT (judgment_id) DO NOTHING RETURNING id`,
      [candidate.judgmentId, plan.state, candidate.title, candidate.court, candidate.sourceUrl, candidate.rightsRecordId, INTAKE_ACTOR],
    );
    const report = created.rows[0];
    if (!report) {
      outcome.skipped += 1;
      continue;
    }
    await pool.query(
      `INSERT INTO research_lawyes_revisions(report_id,revision,to_state,snapshot,reason,actor)
       VALUES ($1,1,'Draft',jsonb_build_object('intake',true,'state','Draft'),'Initial verified-source intake',$2)`,
      [report.id, INTAKE_ACTOR],
    );
    await materializeVerifiedParagraphs(report.id, INTAKE_ACTOR);
    outcome.drafted += 1;
  }
  return outcome;
}