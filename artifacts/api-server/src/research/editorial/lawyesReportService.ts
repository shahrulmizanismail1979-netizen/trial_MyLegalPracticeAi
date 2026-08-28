import { pool, type LawyesReportState, type RightsStatus } from "@workspace/db";
import { createHash } from "node:crypto";
import { ensureLawyesReportTables } from "./ensureLawyesReportTables";
import { hasLiveReportRights } from "./liveRights";

export const AUTHORISED_REPORT_RIGHTS: readonly RightsStatus[] = [
  "OFFICIAL_COURT_SOURCE",
  "PUBLIC_OR_OPEN_LICENCE_SOURCE",
  "USER_OWNED_OR_AUTHORISED",
];

export interface PublicationGateInput {
  rightsStatus: RightsStatus;
  storagePermitted: boolean | null;
  analysisPermitted: boolean | null;
  studentAccessPermitted: boolean | null;
  expiryDate: Date | null;
  approvedPurposes: string[] | null;
  paragraphCount: number;
  unsupportedMaterialPropositions: number;
  approvedReview: {
    reviewerRole: string;
    reviewerActive: boolean;
    legallyTrained: boolean;
    sourceChecked: boolean;
    pinpointsChecked: boolean;
    missingFieldsChecked: boolean;
  } | null;
}

export interface PublicationGateResult {
  allowed: boolean;
  failures: string[];
}

/** Pure, deny-by-default publication policy used by routes and tests. */
export function evaluatePublicationGate(
  input: PublicationGateInput,
): PublicationGateResult {
  const failures: string[] = [];
  if (!AUTHORISED_REPORT_RIGHTS.includes(input.rightsStatus)) {
    failures.push("SOURCE_RIGHTS_NOT_AUTHORISED");
  }
  if (
    input.storagePermitted !== true ||
    input.analysisPermitted !== true ||
    input.studentAccessPermitted !== true
  ) {
    failures.push("SOURCE_USE_NOT_EXPRESSLY_PERMITTED");
  }
  if (input.expiryDate && input.expiryDate.getTime() <= Date.now()) {
    failures.push("SOURCE_RIGHTS_EXPIRED");
  }
  if (input.rightsStatus === "USER_OWNED_OR_AUTHORISED" &&
    !input.approvedPurposes?.some((purpose) =>
      ["publication", "public_display"].includes(purpose.toLowerCase()),
    )) {
    failures.push("PUBLICATION_NOT_AUTHORISED");
  }
  if (input.paragraphCount < 1) failures.push("VERIFIED_FULL_TEXT_REQUIRED");
  if (input.unsupportedMaterialPropositions > 0) {
    failures.push("MATERIAL_PROPOSITIONS_REQUIRE_PINPOINTS");
  }
  const review = input.approvedReview;
  if (
    !review ||
    review.reviewerRole !== "legal_reviewer" ||
    !review.reviewerActive ||
    !review.legallyTrained
  ) {
    failures.push("LEGALLY_TRAINED_REVIEWER_REQUIRED");
  } else if (
    !review.sourceChecked ||
    !review.pinpointsChecked ||
    !review.missingFieldsChecked
  ) {
    failures.push("REVIEW_CHECKLIST_INCOMPLETE");
  }
  return { allowed: failures.length === 0, failures };
}

export class ReportGateError extends Error {
  constructor(readonly failures: string[]) {
    super(`Report transition denied: ${failures.join(", ")}`);
    this.name = "ReportGateError";
  }
}

type ReportRow = {
  id: number;
  judgment_id: number;
  container_id: number;
  state: LawyesReportState;
  current_revision: number;
  title: string;
};

type QueryClient = { query: typeof pool.query };

/**
 * The sole content-mutation boundary.  It locks the report, rejects edits to a
 * live publication, applies the change and records the resulting complete
 * editorial snapshot in the same transaction.  A content change always
 * invalidates prior legal sign-off.
 */
async function mutateReportContent<T>(
  reportId: number,
  actor: string,
  reason: string,
  mutate: (client: QueryClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<ReportRow>(
      "SELECT * FROM research_lawyes_reports WHERE id=$1 FOR UPDATE",
      [reportId],
    );
    const report = locked.rows[0];
    if (!report) throw Object.assign(new Error("Report not found"), { code: "REPORT_NOT_FOUND" });
    if (report.state === "Published") {
      throw new ReportGateError(["UNPUBLISH_BEFORE_CONTENT_EDIT"]);
    }
    const value = await mutate(client);
    const revision = report.current_revision + 1;
    const updated = await client.query(
      `UPDATE research_lawyes_reports
         SET state='Draft', current_revision=$2, lawyer_reviewed_at=NULL,
             published_at=NULL, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [reportId, revision],
    );
    const snapshot = await client.query<{ snapshot: Record<string, unknown> }>(
      `SELECT jsonb_build_object(
        'report', to_jsonb(r),
        'paragraphs', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.ordinal), '[]'::jsonb) FROM research_lawyes_paragraphs p WHERE p.report_id=r.id),
        'sections', (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.sort_order), '[]'::jsonb) FROM research_lawyes_sections s WHERE s.report_id=r.id),
        'propositions', (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id), '[]'::jsonb) FROM research_lawyes_propositions p WHERE p.report_id=r.id),
        'pinpoints', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.id), '[]'::jsonb) FROM research_lawyes_proposition_pinpoints x JOIN research_lawyes_propositions p ON p.id=x.proposition_id WHERE p.report_id=r.id)
       ) snapshot FROM research_lawyes_reports r WHERE r.id=$1`,
      [reportId],
    );
    await client.query(
      `INSERT INTO research_lawyes_revisions(report_id,revision,from_state,to_state,snapshot,reason,actor)
       VALUES ($1,$2,$3,'Draft',$4,$5,$6)`,
      [reportId, revision, report.state, JSON.stringify(snapshot.rows[0]!.snapshot), reason, actor],
    );
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getLawyesReport(
  reportId: number,
  actor: string,
): Promise<Record<string, unknown>> {
  await ensureLawyesReportTables();
  let reportResult = await pool.query<ReportRow>(
    `SELECT r.*,j.container_id FROM research_lawyes_reports r
     JOIN research_verified_judgments j ON j.id=r.judgment_id WHERE r.id=$1`,
    [reportId],
  );
  let report = reportResult.rows[0];
  if (!report)
    throw Object.assign(new Error("Report not found"), {
      code: "REPORT_NOT_FOUND",
    });
  if (report.state === "Published") {
    const gate = evaluatePublicationGate(await getGateInput(reportId));
    if (!gate.allowed) {
      await transitionLawyesReport(
        reportId,
        "Draft",
        actor,
        `Publication withdrawn automatically: ${gate.failures.join(", ")}`,
      );
      reportResult = await pool.query<ReportRow>(
        `SELECT r.*,j.container_id FROM research_lawyes_reports r
         JOIN research_verified_judgments j ON j.id=r.judgment_id WHERE r.id=$1`,
        [reportId],
      );
      report = reportResult.rows[0]!;
    }
  }
  const [
    paragraphs,
    sections,
    propositions,
    pinpoints,
    assignments,
    reviews,
    revisions,
  ] = await Promise.all([
    pool.query(
      "SELECT * FROM research_lawyes_paragraphs WHERE report_id=$1 ORDER BY ordinal",
      [reportId],
    ),
    pool.query(
      "SELECT * FROM research_lawyes_sections WHERE report_id=$1 ORDER BY sort_order",
      [reportId],
    ),
    pool.query(
      "SELECT * FROM research_lawyes_propositions WHERE report_id=$1 ORDER BY id",
      [reportId],
    ),
    pool.query(
      `SELECT x.* FROM research_lawyes_proposition_pinpoints x
         JOIN research_lawyes_propositions p ON p.id=x.proposition_id
         WHERE p.report_id=$1 ORDER BY x.id`,
      [reportId],
    ),
    pool.query(
      "SELECT * FROM research_lawyes_assignments WHERE report_id=$1 ORDER BY id",
      [reportId],
    ),
    pool.query(
      "SELECT * FROM research_lawyes_reviews WHERE report_id=$1 ORDER BY id",
      [reportId],
    ),
    pool.query(
      "SELECT * FROM research_lawyes_revisions WHERE report_id=$1 ORDER BY revision",
      [reportId],
    ),
  ]);
  return {
    ...report,
    paragraphs: paragraphs.rows,
    sections: sections.rows,
    propositions: propositions.rows,
    pinpoints: pinpoints.rows,
    assignments: assignments.rows,
    reviews: reviews.rows,
    revisions: revisions.rows,
  };
}

async function getGateInput(
  reportId: number,
  client: QueryClient = pool,
): Promise<PublicationGateInput> {
  const result = await client.query<{
    rights_status: RightsStatus;
    storage_permitted: boolean | null;
    analysis_permitted: boolean | null;
    student_access_permitted: boolean | null;
    expiry_date: Date | null;
    approved_purposes: string[] | null;
    paragraph_count: string;
    unsupported_count: string;
    reviewer_role: string | null;
    reviewer_active: boolean | null;
    legally_trained: boolean | null;
    source_checked: boolean | null;
    pinpoints_checked: boolean | null;
    missing_fields_checked: boolean | null;
    reviewed_revision: number | null;
    current_revision: number;
  }>(
    `SELECT c.rights_status, rr.storage_permitted, rr.analysis_permitted,
             rr.student_access_permitted, rr.expiry_date, rr.approved_purposes,
            (SELECT count(*) FROM research_lawyes_paragraphs p WHERE p.report_id=r.id) paragraph_count,
            (SELECT count(*) FROM research_lawyes_propositions p
               WHERE p.report_id=r.id AND p.material
               AND NOT EXISTS (SELECT 1 FROM research_lawyes_proposition_pinpoints x WHERE x.proposition_id=p.id)
            ) unsupported_count,
            u.role reviewer_role, u.active reviewer_active, rv.legally_trained,
            rv.source_checked, rv.pinpoints_checked, rv.missing_fields_checked
       FROM research_lawyes_reports r
       JOIN research_verified_judgments j ON j.id=r.judgment_id
       JOIN research_source_containers c ON c.id=j.container_id
       LEFT JOIN LATERAL (
         SELECT * FROM research_rights_records x WHERE x.container_id=c.id ORDER BY x.id DESC LIMIT 1
       ) rr ON true
       LEFT JOIN LATERAL (
          SELECT * FROM research_lawyes_reviews x
           WHERE x.report_id=r.id AND x.decision='approved'
             AND x.reviewed_revision=r.current_revision ORDER BY x.id DESC LIMIT 1
       ) rv ON true
       LEFT JOIN research_users u ON u.id=rv.reviewer_id
      WHERE r.id=$1`,
    [reportId],
  );
  const row = result.rows[0];
  if (!row)
    throw Object.assign(new Error("Report not found"), {
      code: "REPORT_NOT_FOUND",
    });
  return {
    rightsStatus: row.rights_status,
    storagePermitted: row.storage_permitted,
    analysisPermitted: row.analysis_permitted,
    studentAccessPermitted: row.student_access_permitted,
    expiryDate: row.expiry_date,
    approvedPurposes: row.approved_purposes,
    paragraphCount: Number(row.paragraph_count),
    unsupportedMaterialPropositions: Number(row.unsupported_count),
    approvedReview: row.reviewer_role
      ? {
          reviewerRole: row.reviewer_role,
          reviewerActive: row.reviewer_active === true,
          legallyTrained: row.legally_trained === true,
          sourceChecked: row.source_checked === true,
          pinpointsChecked: row.pinpoints_checked === true,
          missingFieldsChecked: row.missing_fields_checked === true,
        }
      : null,
  };
}

export async function createLawyesReport(input: {
  judgmentId: number;
  title: string;
  sourceUrl: string;
  actor: string;
}): Promise<Record<string, unknown>> {
  await ensureLawyesReportTables();
  const source = await pool.query<{
    container_id: number;
    rights_status: RightsStatus;
    rights_record_id: number | null;
    storage_permitted: boolean | null;
    analysis_permitted: boolean | null;
    student_access_permitted: boolean | null;
    expiry_date: Date | null;
    approved_purposes: string[] | null;
  }>(
    `SELECT j.container_id, c.rights_status,
       rr.id rights_record_id, rr.storage_permitted, rr.analysis_permitted,
        rr.student_access_permitted, rr.expiry_date, rr.approved_purposes
     FROM research_verified_judgments j JOIN research_source_containers c ON c.id=j.container_id
     LEFT JOIN LATERAL (
       SELECT * FROM research_rights_records x WHERE x.container_id=c.id ORDER BY x.id DESC LIMIT 1
     ) rr ON true
     WHERE j.id=$1`,
    [input.judgmentId],
  );
  const verified = source.rows[0];
  if (!verified)
    throw Object.assign(new Error("Verified judgment not found"), {
      code: "JUDGMENT_NOT_FOUND",
    });
  const rightsEligible = verified.rights_record_id !== null && hasLiveReportRights({
    rightsStatus: verified.rights_status,
    storagePermitted: verified.storage_permitted,
    analysisPermitted: verified.analysis_permitted,
    studentAccessPermitted: verified.student_access_permitted,
    expiryDate: verified.expiry_date,
    approvedPurposes: verified.approved_purposes,
  });
  if (!rightsEligible) {
    throw new ReportGateError(["SOURCE_RIGHTS_NOT_AUTHORISED"]);
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO research_lawyes_reports
         (judgment_id,title,source_url,source_verified_at,source_rights_record_id,created_by)
       VALUES ($1,$2,$3,now(),$4,$5)
       ON CONFLICT (judgment_id) DO NOTHING RETURNING *`,
      [input.judgmentId, input.title, input.sourceUrl,
        verified.rights_record_id, input.actor],
    );
    if (!result.rows[0]) {
      const existing = await client.query(
        "SELECT * FROM research_lawyes_reports WHERE judgment_id=$1",
        [input.judgmentId],
      );
      await client.query("COMMIT");
      return existing.rows[0]!;
    }
    const report = result.rows[0]!;
    await client.query(
      `INSERT INTO research_lawyes_revisions(report_id,revision,to_state,snapshot,reason,actor)
       VALUES ($1,1,'Draft',$2,'Report created',$3)`,
      [report.id, JSON.stringify(report), input.actor],
    );
    await client.query("COMMIT");
    return report;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Materialise paragraph text only from the immutable verified extraction. */
export async function materializeVerifiedParagraphs(
  reportId: number,
  actor: string,
): Promise<number> {
  await ensureLawyesReportTables();
  return mutateReportContent(reportId, actor, "Verified source paragraphs materialized", async (client) => {
  const source = await client.query<{ paragraph_identifiers: string[]; raw_text: string }>(
    `SELECT j.paragraph_identifiers, string_agg(pe.raw_text, E'\n' ORDER BY p.ord) raw_text
       FROM research_lawyes_reports r
       JOIN research_verified_judgments j ON j.id=r.judgment_id
       CROSS JOIN LATERAL jsonb_array_elements_text(j.page_refs) WITH ORDINALITY p(page_id,ord)
       JOIN LATERAL (
         SELECT x.raw_text FROM research_page_extractions x
          WHERE x.page_id=p.page_id::integer ORDER BY x.id DESC LIMIT 1
       ) pe ON true
      WHERE r.id=$1 GROUP BY j.id`,
    [reportId],
  );
  const row = source.rows[0];
  if (!row)
    throw Object.assign(new Error("Verified judgment text not found"), {
      code: "JUDGMENT_TEXT_NOT_FOUND",
    });
  const identifiers = row.paragraph_identifiers;
  const positions = identifiers
    .map((key) => ({ key, index: row.raw_text.indexOf(key) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);
  if (positions.length !== identifiers.length || positions.length === 0) {
    throw new ReportGateError(["STABLE_PARAGRAPH_SEGMENTATION_REQUIRED"]);
  }
  let inserted = 0;
  for (let ordinal = 0; ordinal < positions.length; ordinal += 1) {
    const current = positions[ordinal]!;
    const next = positions[ordinal + 1];
    const text = row.raw_text
      .slice(current.index, next?.index ?? row.raw_text.length)
      .trim();
    if (!text) throw new ReportGateError(["EMPTY_SOURCE_PARAGRAPH"]);
    const checksum = createHash("sha256").update(text).digest("hex");
    const result = await client.query(
      `INSERT INTO research_lawyes_paragraphs(report_id,paragraph_key,ordinal,text,source_checksum)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (report_id,paragraph_key) DO NOTHING RETURNING id`,
      [reportId, current.key, ordinal + 1, text, checksum],
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
  });
}

export async function addLawyesReview(
  reportId: number,
  reviewerId: number,
  input: {
    decision: "approved" | "changes_requested";
    sourceChecked: boolean;
    pinpointsChecked: boolean;
    missingFieldsChecked: boolean;
    notes?: string;
  },
): Promise<Record<string, unknown>> {
  await ensureLawyesReportTables();
  const user = await pool.query<{ role: string; active: boolean }>(
    "SELECT role, active FROM research_users WHERE id=$1",
    [reviewerId],
  );
  const legallyTrained =
    user.rows[0]?.role === "legal_reviewer" && user.rows[0]?.active === true;
  if (!legallyTrained)
    throw new ReportGateError(["LEGALLY_TRAINED_REVIEWER_REQUIRED"]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const report = await client.query<{ current_revision: number }>(
      "SELECT current_revision FROM research_lawyes_reports WHERE id=$1 FOR UPDATE",
      [reportId],
    );
    if (!report.rows[0]) {
      throw Object.assign(new Error("Report not found"), { code: "REPORT_NOT_FOUND" });
    }
    const result = await client.query(
      `INSERT INTO research_lawyes_reviews
         (report_id,reviewer_id,decision,legally_trained,source_checked,pinpoints_checked,missing_fields_checked,reviewed_revision,notes)
        VALUES ($1,$2,$3,true,$4,$5,$6,$7,$8) RETURNING *`,
      [reportId, reviewerId, input.decision, input.sourceChecked,
        input.pinpointsChecked, input.missingFieldsChecked,
        report.rows[0].current_revision, input.notes ?? null],
    );
    await client.query("COMMIT");
    return result.rows[0]!;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function assignLawyesReport(input: {
  reportId: number;
  assigneeId: number;
  role: "editor" | "lawyer_reviewer";
  actor: string;
}): Promise<Record<string, unknown>> {
  await ensureLawyesReportTables();
  const assignee = await pool.query<{ role: string; active: boolean }>(
    "SELECT role,active FROM research_users WHERE id=$1",
    [input.assigneeId],
  );
  if (!assignee.rows[0]?.active)
    throw new ReportGateError(["ASSIGNEE_NOT_ACTIVE"]);
  if (
    input.role === "lawyer_reviewer" &&
    assignee.rows[0].role !== "legal_reviewer"
  ) {
    throw new ReportGateError(["LEGALLY_TRAINED_REVIEWER_REQUIRED"]);
  }
  const result = await pool.query(
    `INSERT INTO research_lawyes_assignments(report_id,assignee_id,role,assigned_by)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [input.reportId, input.assigneeId, input.role, input.actor],
  );
  return result.rows[0]!;
}

export async function addLawyesSection(input: {
  reportId: number;
  actor: string;
  kind: string;
  heading: string;
  body: string;
  sortOrder: number;
  propositions: Array<{
    proposition: string;
    material: boolean;
    paragraphIds: number[];
  }>;
}): Promise<Record<string, unknown>> {
  await ensureLawyesReportTables();
  return mutateReportContent(input.reportId, input.actor, "Editorial section added", async (client) => {
    const sectionResult = await client.query(
      `INSERT INTO research_lawyes_sections(report_id,kind,heading,body,sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [input.reportId, input.kind, input.heading, input.body, input.sortOrder],
    );
    const section = sectionResult.rows[0]!;
    for (const proposition of input.propositions) {
      const propResult = await client.query<{ id: number }>(
        `INSERT INTO research_lawyes_propositions(report_id,section_id,proposition,material)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [
          input.reportId,
          section.id,
          proposition.proposition,
          proposition.material,
        ],
      );
      for (const paragraphId of proposition.paragraphIds) {
        const linked = await client.query(
          `INSERT INTO research_lawyes_proposition_pinpoints(proposition_id,paragraph_id)
           SELECT $1,p.id FROM research_lawyes_paragraphs p
            WHERE p.id=$2 AND p.report_id=$3 RETURNING id`,
          [propResult.rows[0]!.id, paragraphId, input.reportId],
        );
        if (!linked.rows[0])
          throw new ReportGateError(["PINPOINT_NOT_IN_REPORT"]);
      }
    }
    return section;
  });
}

export async function transitionLawyesReport(
  reportId: number,
  toState: LawyesReportState,
  actor: string,
  reason: string,
): Promise<Record<string, unknown>> {
  await ensureLawyesReportTables();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // The lock makes the approval/revision gate and the state update one
    // decision: a concurrent content edit cannot invalidate the review between
    // checking it and publishing.
    const currentResult = await client.query<ReportRow>(
      `SELECT r.*, j.container_id FROM research_lawyes_reports r
       JOIN research_verified_judgments j ON j.id=r.judgment_id WHERE r.id=$1 FOR UPDATE`,
      [reportId],
    );
    const current = currentResult.rows[0];
    if (!current) throw Object.assign(new Error("Report not found"), { code: "REPORT_NOT_FOUND" });
    const allowed: Record<LawyesReportState, LawyesReportState[]> = {
      Draft: ["AI-assisted", "Lawyer reviewed"],
      "AI-assisted": ["Draft", "Lawyer reviewed"],
      "Lawyer reviewed": ["Draft", "Published"],
      Published: ["Draft"],
    };
    if (!allowed[current.state].includes(toState)) {
      throw new ReportGateError(["INVALID_STATE_TRANSITION"]);
    }
    if (toState === "Lawyer reviewed" || toState === "Published") {
      const gate = evaluatePublicationGate(await getGateInput(reportId, client));
      if (!gate.allowed) throw new ReportGateError(gate.failures);
    }
    const updated = await client.query(
      `UPDATE research_lawyes_reports SET state=$2,updated_at=now(),
       lawyer_reviewed_at=CASE WHEN $2='Lawyer reviewed' THEN now()
                                WHEN $2='Draft' THEN NULL ELSE lawyer_reviewed_at END,
       published_at=CASE WHEN $2='Published' THEN now() WHEN $2='Draft' THEN NULL ELSE published_at END
     WHERE id=$1 RETURNING *`,
      [reportId, toState],
    );
    await client.query("COMMIT");
    return updated.rows[0]!;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Immediately withdraw published reports when the live source right is lost. */
export async function failClosedReportsForContainer(
  containerId: number,
  actor: string,
): Promise<number> {
  await ensureLawyesReportTables();
  const rights = await pool.query<{
    rights_status: RightsStatus;
    storage_permitted: boolean | null;
    analysis_permitted: boolean | null;
    student_access_permitted: boolean | null;
    expiry_date: Date | null;
    approved_purposes: string[] | null;
  }>(
    `SELECT c.rights_status,rr.storage_permitted,rr.analysis_permitted,rr.student_access_permitted,
            rr.expiry_date,rr.approved_purposes
       FROM research_source_containers c
       LEFT JOIN LATERAL (
         SELECT * FROM research_rights_records x WHERE x.container_id=c.id ORDER BY x.id DESC LIMIT 1
       ) rr ON true WHERE c.id=$1`,
    [containerId],
  );
  const current = rights.rows[0];
  const eligible = current && hasLiveReportRights({
    rightsStatus: current.rights_status,
    storagePermitted: current.storage_permitted,
    analysisPermitted: current.analysis_permitted,
    studentAccessPermitted: current.student_access_permitted,
    expiryDate: current.expiry_date,
    approvedPurposes: current.approved_purposes,
  });
  if (eligible) return 0;
  const reports = await pool.query<{ id: number }>(
    `SELECT r.id FROM research_lawyes_reports r JOIN research_verified_judgments j ON j.id=r.judgment_id
      WHERE j.container_id=$1 AND r.state='Published'`,
    [containerId],
  );
  for (const report of reports.rows) {
    await transitionLawyesReport(
      report.id,
      "Draft",
      actor,
      "Source rights changed; publication withdrawn",
    );
  }
  return reports.rowCount ?? 0;
}
