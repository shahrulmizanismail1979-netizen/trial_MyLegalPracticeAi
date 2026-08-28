import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { LAWYES_REPORT_STATES, LAWYES_SECTION_KINDS } from "@workspace/db";
import { requireResearchRole } from "../auth";
import {
  addLawyesReview,
  addLawyesSection,
  assignLawyesReport,
  createLawyesReport,
  getLawyesReport,
  materializeVerifiedParagraphs,
  ReportGateError,
  transitionLawyesReport,
} from "../editorial/lawyesReportService";

const router: IRouter = Router();
const editorialRoles = requireResearchRole(
  "owner",
  "administrator",
  "legal_reviewer",
);
// Publication-related actions need an attributable Clerk research identity
// with legal-review authority. Administrators can edit, but cannot sign off or
// publish merely by virtue of an administrative role.
const legalReviewerRole = requireResearchRole("legal_reviewer");

const CreateReportInput = z.object({
  judgmentId: z.number().int().positive(),
  title: z.string().min(1),
  sourceUrl: z.string().url(),
});

router.get("/reports/:id", editorialRoles, async (req, res) => {
  const reportId = Number(req.params.id);
  if (!Number.isInteger(reportId)) {
    res.status(400).json({ error: "Invalid report id" });
    return;
  }
  try {
    res.json(
      await getLawyesReport(
        reportId,
        req.authEmail ?? `role:${req.researchRole}`,
      ),
    );
  } catch (error) {
    if ((error as { code?: string }).code === "REPORT_NOT_FOUND") {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    throw error;
  }
});

router.post("/reports", editorialRoles, async (req, res) => {
  const parsed = CreateReportInput.safeParse(req.body);
  if (!parsed.success)
    return void res.status(400).json({ error: z.treeifyError(parsed.error) });
  try {
    const report = await createLawyesReport({
      ...parsed.data,
      actor: req.authEmail ?? `role:${req.researchRole}`,
    });
    res.status(201).json(report);
  } catch (error) {
    if (error instanceof ReportGateError) {
      res.status(409).json({
        error: "Report source is not eligible",
        failures: error.failures,
      });
      return;
    }
    if ((error as { code?: string }).code === "JUDGMENT_NOT_FOUND") {
      res.status(404).json({ error: "Verified judgment not found" });
      return;
    }
    throw error;
  }
});

const SectionInput = z.object({
  kind: z.enum(LAWYES_SECTION_KINDS),
  heading: z.string().min(1),
  body: z.string(),
  sortOrder: z.number().int().nonnegative(),
  propositions: z
    .array(
      z.object({
        proposition: z.string().min(1),
        material: z.boolean().default(true),
        paragraphIds: z.array(z.number().int().positive()),
      }),
    )
    .default([]),
});

router.post("/reports/:id/sections", editorialRoles, async (req, res) => {
  const reportId = Number(req.params.id);
  const parsed = SectionInput.safeParse(req.body);
  if (!Number.isInteger(reportId) || !parsed.success) {
    res.status(400).json({ error: "Invalid report section" });
    return;
  }
  try {
    res.status(201).json(await addLawyesSection({
      reportId, ...parsed.data, actor: req.authEmail ?? `role:${req.researchRole}`,
    }));
  } catch (error) {
    if (error instanceof ReportGateError) {
      res
        .status(409)
        .json({ error: "Invalid pinpoint", failures: error.failures });
      return;
    }
    throw error;
  }
});

router.post(
  "/reports/:id/paragraphs/materialize",
  editorialRoles,
  async (req, res) => {
    const reportId = Number(req.params.id);
    if (!Number.isInteger(reportId)) {
      res.status(400).json({ error: "Invalid report id" });
      return;
    }
    try {
      res.json({ inserted: await materializeVerifiedParagraphs(
        reportId, req.authEmail ?? `role:${req.researchRole}`,
      ) });
    } catch (error) {
      if (error instanceof ReportGateError) {
        res.status(409).json({
          error: "Paragraph materialisation failed",
          failures: error.failures,
        });
        return;
      }
      if ((error as { code?: string }).code === "JUDGMENT_TEXT_NOT_FOUND") {
        res.status(422).json({ error: "Verified judgment text not found" });
        return;
      }
      throw error;
    }
  },
);

const ReviewInput = z.object({
  reviewerId: z.number().int().positive(),
  decision: z.enum(["approved", "changes_requested"]),
  sourceChecked: z.boolean(),
  pinpointsChecked: z.boolean(),
  missingFieldsChecked: z.boolean(),
  notes: z.string().optional(),
});

router.post("/reports/:id/reviews", legalReviewerRole, async (req, res) => {
  const reportId = Number(req.params.id);
  const parsed = ReviewInput.safeParse(req.body);
  if (!Number.isInteger(reportId) || !parsed.success) {
    res.status(400).json({ error: "Invalid review" });
    return;
  }
  // A caller cannot manufacture another lawyer's sign-off.
  if (req.researchUserId !== parsed.data.reviewerId) {
    res
      .status(403)
      .json({ error: "Reviewer identity does not match authenticated user" });
    return;
  }
  try {
    res
      .status(201)
      .json(
        await addLawyesReview(reportId, parsed.data.reviewerId, parsed.data),
      );
  } catch (error) {
    if (error instanceof ReportGateError) {
      res
        .status(409)
        .json({ error: "Reviewer is not eligible", failures: error.failures });
      return;
    }
    throw error;
  }
});

const AssignmentInput = z.object({
  assigneeId: z.number().int().positive(),
  role: z.enum(["editor", "lawyer_reviewer"]),
});

router.post("/reports/:id/assignments", editorialRoles, async (req, res) => {
  const reportId = Number(req.params.id);
  const parsed = AssignmentInput.safeParse(req.body);
  if (!Number.isInteger(reportId) || !parsed.success) {
    res.status(400).json({ error: "Invalid assignment" });
    return;
  }
  try {
    res.status(201).json(
      await assignLawyesReport({
        reportId,
        ...parsed.data,
        actor: req.authEmail ?? `role:${req.researchRole}`,
      }),
    );
  } catch (error) {
    if (error instanceof ReportGateError) {
      res
        .status(409)
        .json({ error: "Assignee is not eligible", failures: error.failures });
      return;
    }
    throw error;
  }
});

const TransitionInput = z.object({
  toState: z.enum(LAWYES_REPORT_STATES),
  reason: z.string().min(1),
});

router.post("/reports/:id/transitions", editorialRoles, async (req, res) => {
  const reportId = Number(req.params.id);
  const parsed = TransitionInput.safeParse(req.body);
  if (!Number.isInteger(reportId) || !parsed.success) {
    res.status(400).json({ error: "Invalid transition" });
    return;
  }
  if (
    (parsed.data.toState === "Lawyer reviewed" ||
      parsed.data.toState === "Published") &&
    !["owner", "legal_reviewer"].includes(req.researchRole ?? "")
  ) {
    res.status(403).json({
      error: "Legal review and publication require an active Clerk legal reviewer or owner",
    });
    return;
  }
  try {
    res.json(
      await transitionLawyesReport(
        reportId,
        parsed.data.toState,
        req.authEmail ?? `role:${req.researchRole}`,
        parsed.data.reason,
      ),
    );
  } catch (error) {
    if (error instanceof ReportGateError) {
      res
        .status(409)
        .json({ error: "Publication gate failed", failures: error.failures });
      return;
    }
    if ((error as { code?: string }).code === "REPORT_NOT_FOUND") {
      res.status(404).json({ error: "Report not found" });
      return;
    }
    throw error;
  }
});

export default router;
