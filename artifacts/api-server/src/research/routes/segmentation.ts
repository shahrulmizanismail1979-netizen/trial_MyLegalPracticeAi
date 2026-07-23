import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import {
  db,
  researchSegmentationRuns,
  researchCaseCandidates,
  researchCaseBoundaries,
  researchCaseCandidateBoundaries,
  researchBoundarySignals,
  researchSourcePages,
} from "@workspace/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { requireResearchRole } from "../auth";
import { recordAuditEvent } from "../domain/audit";
import { checkContainerAccess } from "../domain/gates";
import { EntityNotFoundError } from "../domain/types";
import { ProcessorFailure } from "../processing/handlers";
import {
  startSegmentation,
  getLatestSegmentationRun,
  registerSegmentationProcessor,
} from "../segmentation/pipeline";

// Phase 05 web layer: segmentation jobs + candidate review surface.
// Mounted inside the research router (staff gate + research-role resolution
// already applied). Raw signal/boundary records are never overwritten — only
// review_status on candidates is updated.

registerSegmentationProcessor();

const router: IRouter = Router();

async function requireContainerView(
  req: import("express").Request,
  res: import("express").Response,
  containerId: number,
): Promise<boolean> {
  try {
    const { decision } = await checkContainerAccess(
      containerId,
      req.researchRole ?? null,
      "view",
      { actor: req.authEmail ?? undefined },
    );
    if (!decision.allowed) {
      res.status(404).json({ error: "Not found" });
      return false;
    }
    return true;
  } catch (err) {
    if (err instanceof EntityNotFoundError) {
      res.status(404).json({ error: "Not found" });
      return false;
    }
    throw err;
  }
}

// Start a segmentation job (202 Accepted + jobId).
// Container must be TEXT_EXTRACTED or SEGMENTATION_REVIEW_REQUIRED.
router.post(
  "/containers/:id/segmentation",
  requireResearchRole("owner", "administrator", "rights_reviewer"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Invalid container id" });
      return;
    }
    try {
      const { decision } = await checkContainerAccess(
        id,
        req.researchRole ?? null,
        "process",
        { actor: req.authEmail ?? undefined },
      );
      if (!decision.allowed) {
        const { decision: viewDecision } = await checkContainerAccess(
          id,
          req.researchRole ?? null,
          "view",
          { actor: req.authEmail ?? undefined },
        );
        if (!viewDecision.allowed) {
          res.status(404).json({ error: "Not found" });
          return;
        }
        res.status(403).json({ error: "Forbidden", reason: decision.reason });
        return;
      }
      const { jobId } = await startSegmentation(
        id,
        req.authEmail ?? `role:${req.researchRole}`,
      );
      res.status(202).json({ jobId });
    } catch (err) {
      if (err instanceof EntityNotFoundError) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (err instanceof ProcessorFailure) {
        res.status(409).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  },
);

// List all candidates for a container (staff-only: segmentation output is internal).
router.get(
  "/containers/:id/candidates",
  requireResearchRole("owner", "administrator", "rights_reviewer", "legal_reviewer"),
  async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid container id" });
    return;
  }
  if (!(await requireContainerView(req, res, id))) return;

  const run = await getLatestSegmentationRun(id);
  if (!run) {
    res.status(200).json({ runId: null, candidates: [] });
    return;
  }

  const candidates = await db
    .select()
    .from(researchCaseCandidates)
    .where(eq(researchCaseCandidates.runId, run.id))
    .orderBy(asc(researchCaseCandidates.id));

  const result = [];
  for (const c of candidates) {
    const [cb] = await db
      .select()
      .from(researchCaseCandidateBoundaries)
      .where(eq(researchCaseCandidateBoundaries.candidateId, c.id));
    const startBound = cb
      ? await db
          .select()
          .from(researchCaseBoundaries)
          .where(eq(researchCaseBoundaries.id, cb.startBoundaryId))
          .then((rows) => rows[0])
      : null;
    const endBound = cb
      ? await db
          .select()
          .from(researchCaseBoundaries)
          .where(eq(researchCaseBoundaries.id, cb.endBoundaryId))
          .then((rows) => rows[0])
      : null;

    const startPage = startBound
      ? await db
          .select({ pageNumber: researchSourcePages.pageNumber })
          .from(researchSourcePages)
          .where(eq(researchSourcePages.id, startBound.pageId))
          .then((rows) => rows[0])
      : null;
    const endPage = endBound
      ? await db
          .select({ pageNumber: researchSourcePages.pageNumber })
          .from(researchSourcePages)
          .where(eq(researchSourcePages.id, endBound.pageId))
          .then((rows) => rows[0])
      : null;

    result.push({
      candidateId: c.id,
      runId: c.runId,
      strength: c.strength,
      pageCount: c.pageCount,
      reviewStatus: c.reviewStatus,
      reviewedBy: c.reviewedBy,
      reviewedAt: c.reviewedAt,
      startPage: startPage?.pageNumber ?? null,
      endPage: endPage?.pageNumber ?? null,
      startStrength: startBound?.strength ?? null,
      endStrength: endBound?.strength ?? null,
    });
  }

  res.json({ runId: run.id, status: run.status, candidates: result });
});

// Full candidate detail: boundaries, all signals, unassigned pages (staff-only).
router.get(
  "/containers/:id/candidates/:candidateId",
  requireResearchRole("owner", "administrator", "rights_reviewer", "legal_reviewer"),
  async (req, res) => {
  const id = Number(req.params.id);
  const candidateId = Number(req.params.candidateId);
  if (!Number.isInteger(id) || !Number.isInteger(candidateId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  if (!(await requireContainerView(req, res, id))) return;

  const [candidate] = await db
    .select()
    .from(researchCaseCandidates)
    .where(
      and(
        eq(researchCaseCandidates.id, candidateId),
        eq(researchCaseCandidates.containerId, id),
      ),
    );
  if (!candidate) {
    res.status(404).json({ error: "Candidate not found" });
    return;
  }

  const [cb] = await db
    .select()
    .from(researchCaseCandidateBoundaries)
    .where(eq(researchCaseCandidateBoundaries.candidateId, candidateId));

  const [startBound, endBound] = await Promise.all([
    cb
      ? db
          .select()
          .from(researchCaseBoundaries)
          .where(eq(researchCaseBoundaries.id, cb.startBoundaryId))
          .then((rows) => rows[0])
      : Promise.resolve(null),
    cb
      ? db
          .select()
          .from(researchCaseBoundaries)
          .where(eq(researchCaseBoundaries.id, cb.endBoundaryId))
          .then((rows) => rows[0])
      : Promise.resolve(null),
  ]);

  // Fetch all signals for this run
  const run = candidate.runId
    ? await db
        .select()
        .from(researchSegmentationRuns)
        .where(eq(researchSegmentationRuns.id, candidate.runId))
        .then((rows) => rows[0])
    : null;

  const signals =
    run && startBound && endBound
      ? await db
          .select()
          .from(researchBoundarySignals)
          .where(eq(researchBoundarySignals.runId, run.id))
          .orderBy(asc(researchBoundarySignals.id))
      : [];

  const unassignedPages =
    run?.detail && typeof run.detail === "object"
      ? ((run.detail as Record<string, unknown>)["unassigned_pages"] as number[] | undefined) ?? []
      : [];

  const conflictingSignals = signals.filter((s) => s.scoreContribution < 0);

  res.json({
    candidate,
    startBoundary: startBound,
    endBoundary: endBound,
    signals,
    conflictingSignals,
    unassignedPages,
    run,
  });
});

// Server-rendered segmentation review UI (staff-only).
router.get(
  "/containers/:id/segmentation-review",
  requireResearchRole("owner", "administrator", "rights_reviewer", "legal_reviewer"),
  async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid container id" });
    return;
  }
  if (!(await requireContainerView(req, res, id))) return;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store");
  res.send(segmentationReviewHtml(id));
});

// Review decision: accept / reject / flag a candidate.
// Append-only: audit event written; raw signals/boundaries NOT overwritten.
const ReviewBody = z.object({
  decision: z.enum(["accept", "reject", "flag"]),
  reason: z.string().min(1),
});

router.post(
  "/containers/:id/candidates/:candidateId/review",
  requireResearchRole(
    "owner",
    "administrator",
    "rights_reviewer",
    "legal_reviewer",
  ),
  async (req, res) => {
    const id = Number(req.params.id);
    const candidateId = Number(req.params.candidateId);
    if (!Number.isInteger(id) || !Number.isInteger(candidateId)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    if (!(await requireContainerView(req, res, id))) return;

    const parsed = ReviewBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: z.treeifyError(parsed.error) });
      return;
    }

    const [candidate] = await db
      .select()
      .from(researchCaseCandidates)
      .where(
        and(
          eq(researchCaseCandidates.id, candidateId),
          eq(researchCaseCandidates.containerId, id),
        ),
      );
    if (!candidate) {
      res.status(404).json({ error: "Candidate not found" });
      return;
    }

    const reviewer = req.authEmail ?? `role:${req.researchRole}`;
    const newStatus =
      parsed.data.decision === "accept"
        ? "reviewed"
        : parsed.data.decision === "reject"
          ? "rejected"
          : "review_required"; // flag = keep in review

    await db.transaction(async (tx) => {
      await tx
        .update(researchCaseCandidates)
        .set({
          reviewStatus: newStatus,
          reviewedBy: reviewer,
          reviewedAt: new Date(),
        })
        .where(eq(researchCaseCandidates.id, candidateId));

      await recordAuditEvent(tx, {
        entityType: "case_candidate",
        entityId: candidateId,
        event: `review:${parsed.data.decision}`,
        fromState: candidate.reviewStatus ?? "review_required",
        toState: newStatus,
        actor: reviewer,
        detail: {
          containerId: id,
          reason: parsed.data.reason,
          candidateId,
          runId: candidate.runId,
        },
      });
    });

    const [updated] = await db
      .select()
      .from(researchCaseCandidates)
      .where(eq(researchCaseCandidates.id, candidateId));

    res.status(200).json(updated);
  },
);

// ── Server-rendered segmentation review UI ────────────────────────────────

function segmentationReviewHtml(containerId: number): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Segmentation Review — Container ${containerId}</title>
<meta name="robots" content="noindex, nofollow">
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #f5f5f4; color: #1c1917; }
  header { background: #1c1917; color: #fafaf9; padding: .75rem 1rem; display: flex; gap: 1rem; align-items: baseline; }
  header h1 { font-size: 1rem; margin: 0; }
  main { display: grid; grid-template-columns: 280px 1fr; gap: 1rem; padding: 1rem; align-items: start; }
  .panel { background: #fff; border: 1px solid #d6d3d1; border-radius: 6px; padding: .75rem; }
  .panel h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: #78716c; margin: 0 0 .5rem; }
  .candidate { border: 1px solid #e7e5e4; border-radius: 4px; padding: .5rem; margin-bottom: .5rem; cursor: pointer; }
  .candidate:hover { background: #f5f5f4; }
  .candidate.active { background: #1c1917; color: #fff; border-color: #1c1917; }
  .candidate .meta { font-size: .75rem; opacity: .7; }
  .strength-STRONG { color: #15803d; font-weight: 700; }
  .strength-MODERATE { color: #0369a1; font-weight: 600; }
  .strength-WEAK { color: #b45309; }
  .strength-CONFLICTING { color: #dc2626; }
  .signal { border-left: 3px solid #a8a29e; padding: .25rem .5rem; margin-bottom: .25rem; font-size: .8rem; }
  .signal.positive { border-color: #15803d; }
  .signal.negative { border-color: #dc2626; background: #fef2f2; }
  .signal .meta { color: #78716c; font-size: .7rem; }
  pre { white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: .8rem; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 4px; padding: .5rem; max-height: 30vh; overflow: auto; }
  select, textarea, input[type=text] { width: 100%; box-sizing: border-box; }
  textarea { min-height: 4rem; font-family: ui-monospace, monospace; font-size: .8rem; }
  button.primary { background: #1c1917; color: #fff; border: 0; border-radius: 4px; padding: .5rem 1rem; cursor: pointer; margin-top: .5rem; }
  button.danger { background: #dc2626; color: #fff; border: 0; border-radius: 4px; padding: .5rem 1rem; cursor: pointer; margin-top: .5rem; margin-left: .25rem; }
  #status { font-size: .8rem; color: #78716c; margin-top: .5rem; }
  .badge { display: inline-block; padding: .15rem .4rem; border-radius: 3px; font-size: .7rem; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #15803d; }
  .badge-yellow { background: #fef3c7; color: #b45309; }
  .badge-red { background: #fee2e2; color: #dc2626; }
  .badge-blue { background: #dbeafe; color: #1d4ed8; }
</style>
</head>
<body>
<header>
  <h1>Segmentation Review — Container ${containerId}</h1>
  <span id="run-status"></span>
</header>
<main>
  <div class="panel">
    <h2>Case Candidates</h2>
    <div id="candidates">Loading…</div>
    <div style="margin-top:.5rem;font-size:.75rem;color:#78716c">
      Unassigned pages: <span id="unassigned-pages">—</span>
    </div>
  </div>
  <div class="panel" id="detail-panel">
    <h2>Candidate Detail</h2>
    <div id="detail">Select a candidate from the list.</div>
  </div>
</main>
<script>
const BASE = location.pathname.replace(/\\/containers\\/\\d+\\/segmentation-review$/, "");
const CONTAINER_ID = ${containerId};
let currentCandidate = null;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

async function j(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
  return r.json();
}

function strengthClass(s) {
  if (!s) return "";
  if (s.includes("STRONG")) return "strength-STRONG";
  if (s.includes("MODERATE")) return "strength-MODERATE";
  if (s.includes("WEAK")) return "strength-WEAK";
  if (s.includes("CONFLICTING")) return "strength-CONFLICTING";
  return "";
}

function badge(status) {
  if (!status) return "";
  const cls = status === "auto_accepted" || status === "reviewed" ? "badge-green"
    : status === "rejected" ? "badge-red"
    : "badge-yellow";
  return '<span class="badge ' + cls + '">' + esc(status) + "</span>";
}

async function loadCandidates() {
  const data = await j(BASE + "/containers/" + CONTAINER_ID + "/candidates");
  document.getElementById("run-status").textContent =
    "run #" + (data.runId ?? "—") + " — " + (data.status ?? "—");
  const holder = document.getElementById("candidates");
  holder.innerHTML = "";
  if (data.candidates.length === 0) {
    holder.innerHTML = "<small>No candidates detected. Container may contain no judgments.</small>";
    return;
  }
  for (const c of data.candidates) {
    const div = document.createElement("div");
    div.className = "candidate";
    div.innerHTML =
      "<div><b>Candidate #" + c.candidateId + "</b> " + badge(c.reviewStatus) + "</div>" +
      "<div class='meta " + strengthClass(c.strength) + "'>" + esc(c.strength) + "</div>" +
      "<div class='meta'>Pages " + esc(c.startPage) + "–" + esc(c.endPage) +
        " (" + esc(c.pageCount) + " pages)</div>";
    div.onclick = () => loadCandidate(c.candidateId, div);
    holder.appendChild(div);
  }
  // Show unassigned pages from run detail via first candidate's run
  if (data.candidates.length > 0) {
    const det = await j(BASE + "/containers/" + CONTAINER_ID + "/candidates/" + data.candidates[0].candidateId).catch(() => null);
    if (det) {
      const up = det.unassignedPages ?? [];
      document.getElementById("unassigned-pages").textContent = up.length > 0 ? up.join(", ") : "none";
    }
  }
}

async function loadCandidate(id, btn) {
  currentCandidate = id;
  document.querySelectorAll(".candidate").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  const d = await j(BASE + "/containers/" + CONTAINER_ID + "/candidates/" + id);
  const c = d.candidate;
  const start = d.startBoundary;
  const end = d.endBoundary;
  const posSignals = d.signals.filter((s) => s.scoreContribution >= 0);
  const negSignals = d.conflictingSignals;

  document.getElementById("detail").innerHTML =
    "<table style='font-size:.8rem;width:100%;border-collapse:collapse'>" +
    "<tr><td style='color:#78716c'>Strength</td><td class='" + strengthClass(c.strength) + "'>" + esc(c.strength) + "</td></tr>" +
    "<tr><td style='color:#78716c'>Status</td><td>" + badge(c.reviewStatus) + "</td></tr>" +
    "<tr><td style='color:#78716c'>Pages</td><td>" + esc(c.pageCount) + "</td></tr>" +
    "<tr><td style='color:#78716c'>Start boundary</td><td>" +
      (start ? "Page " + esc(start.pageId) + " — <span class='" + strengthClass(start.strength) + "'>" + esc(start.strength) + "</span> (score " + esc(start.compositeScore) + ")" : "—") +
    "</td></tr>" +
    "<tr><td style='color:#78716c'>End boundary</td><td>" +
      (end ? "Page " + esc(end.pageId) + " — <span class='" + strengthClass(end.strength) + "'>" + esc(end.strength) + "</span> (score " + esc(end.compositeScore) + ")" : "—") +
    "</td></tr>" +
    "</table>" +
    "<h2 style='margin-top:1rem'>Positive Signals (" + posSignals.length + ")</h2>" +
    "<div style='max-height:25vh;overflow:auto'>" +
    (posSignals.length ? posSignals.map((s) =>
      '<div class="signal positive"><div class="meta">' + esc(s.signalType) + ' (+' + esc(s.scoreContribution) + ') page ' + esc(s.pageId) + '</div>' +
      esc(s.supportingText) + '</div>'
    ).join("") : "<small>None.</small>") +
    "</div>" +
    "<h2 style='margin-top:.75rem'>Conflicting Signals (" + negSignals.length + ")</h2>" +
    "<div style='max-height:15vh;overflow:auto'>" +
    (negSignals.length ? negSignals.map((s) =>
      '<div class="signal negative"><div class="meta">' + esc(s.signalType) + ' (' + esc(s.scoreContribution) + ') page ' + esc(s.pageId) + '</div>' +
      esc(s.supportingText) + '</div>'
    ).join("") : "<small>None.</small>") +
    "</div>" +
    "<h2 style='margin-top:.75rem'>Review Decision</h2>" +
    (c.reviewedBy ? '<p style="font-size:.8rem">Last reviewed by ' + esc(c.reviewedBy) + ' — ' + esc(c.reviewedAt) + '</p>' : '') +
    "<select id='review-decision'><option value='accept'>Accept</option><option value='reject'>Reject</option><option value='flag'>Flag for further review</option></select>" +
    "<textarea id='review-reason' placeholder='Reason for decision' style='margin-top:.25rem'></textarea>" +
    "<div><button class='primary' onclick='submitReview()'>Submit Decision</button></div>" +
    "<div id='status'></div>";
}

async function submitReview() {
  if (!currentCandidate) return;
  const status = document.getElementById("status");
  status.textContent = "Saving…";
  try {
    await j(BASE + "/containers/" + CONTAINER_ID + "/candidates/" + currentCandidate + "/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision: document.getElementById("review-decision").value,
        reason: document.getElementById("review-reason").value || "(no reason given)",
      }),
    });
    status.textContent = "Decision recorded.";
    await loadCandidates();
  } catch (e) {
    status.textContent = "Failed: " + e.message;
  }
}

loadCandidates().catch((e) => {
  document.getElementById("candidates").textContent = "Failed to load: " + e.message;
});
</script>
</body>
</html>`;
}

export default router;
