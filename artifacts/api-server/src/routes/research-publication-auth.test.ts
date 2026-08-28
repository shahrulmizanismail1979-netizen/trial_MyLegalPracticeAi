import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

const { addReview, transition } = vi.hoisted(() => ({
  addReview: vi.fn(),
  transition: vi.fn(),
}));

vi.mock("../research/editorial/lawyesReportService", () => ({
  addLawyesReview: addReview,
  addLawyesSection: vi.fn(),
  assignLawyesReport: vi.fn(),
  createLawyesReport: vi.fn(),
  getLawyesReport: vi.fn(),
  materializeVerifiedParagraphs: vi.fn(),
  ReportGateError: class ReportGateError extends Error {},
  transitionLawyesReport: transition,
}));

process.env.ADMIN_PASSWORD = "publication-auth-test-password";
const { default: researchAdminRouter } = await import("./research-admin");
const { default: lawyesReportsRouter } = await import("../research/routes/lawyesReports");

function passwordApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser("publication-auth-test-secret"));
  app.use("/api/research-admin", researchAdminRouter);
  return app;
}

function clerkResearchApp(role: string, researchUserId: number) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.researchRole = role as never;
    req.researchUserId = researchUserId;
    req.authEmail = "reviewer@lawyes.invalid";
    next();
  });
  app.use("/api/research", lawyesReportsRouter);
  return app;
}

describe("LAWYes publication authentication boundaries", () => {
  beforeEach(() => {
    addReview.mockReset();
    transition.mockReset();
    addReview.mockResolvedValue({ id: 9, reviewer_id: 42 });
    transition.mockResolvedValue({ id: 7, state: "Published" });
  });

  it("does not let a shared ADMIN_PASSWORD sign off or publish", async () => {
    const agent = request.agent(passwordApp());
    await agent
      .post("/api/research-admin/auth/login")
      .send({ password: "publication-auth-test-password" })
      .expect(200);

    await agent
      .post("/api/research-admin/editorial/reports/7/sign-off")
      .send({ declaration: "Checked" })
      .expect(403);
    await agent
      .post("/api/research-admin/editorial/reports/7/publish")
      .send({})
      .expect(403);

    expect(addReview).not.toHaveBeenCalled();
    expect(transition).not.toHaveBeenCalled();
  });

  it("records the authenticated legal reviewer's own identity", async () => {
    await request(clerkResearchApp("legal_reviewer", 42))
      .post("/api/research/reports/7/reviews")
      .send({
        reviewerId: 42,
        decision: "approved",
        sourceChecked: true,
        pinpointsChecked: true,
        missingFieldsChecked: true,
        notes: "Checked by the authenticated reviewer",
      })
      .expect(201);

    // The immutable review record is keyed by the authenticated research user,
    // not a password-admin configured reviewer or caller-supplied substitute.
    expect(addReview).toHaveBeenCalledWith(
      7,
      42,
      expect.objectContaining({ decision: "approved" }),
    );
  });

  it("rejects a supplied reviewer identity that differs from Clerk identity", async () => {
    await request(clerkResearchApp("legal_reviewer", 42))
      .post("/api/research/reports/7/reviews")
      .send({
        reviewerId: 99,
        decision: "approved",
        sourceChecked: true,
        pinpointsChecked: true,
        missingFieldsChecked: true,
      })
      .expect(403);

    expect(addReview).not.toHaveBeenCalled();
  });

  it("does not let a Clerk administrator publish", async () => {
    await request(clerkResearchApp("administrator", 42))
      .post("/api/research/reports/7/transitions")
      .send({ toState: "Published", reason: "attempt publication" })
      .expect(403);

    expect(transition).not.toHaveBeenCalled();
  });
});