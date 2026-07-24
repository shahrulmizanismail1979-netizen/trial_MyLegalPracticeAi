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
  researchCandidateReviewActions,
  researchTransformations,
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

      // Phase 06 append-only audit model: write transformation + review action rows
      // so this endpoint participates in the same audited pipeline as the new actions.
      const actionType =
        parsed.data.decision === "accept" ? "APPROVE" :
        parsed.data.decision === "reject" ? "REJECT" : "MARK_INCOMPLETE";
      const [transformation] = await tx
        .insert(researchTransformations)
        .values({
          containerId: id,
          kind: `candidate.${actionType.toLowerCase()}`,
          detail: { candidateId, decision: parsed.data.decision, reason: parsed.data.reason },
          actor: reviewer,
        })
        .returning({ id: researchTransformations.id });
      if (transformation) {
        await tx.insert(researchCandidateReviewActions).values({
          candidateId,
          actionType,
          actor: reviewer,
          detail: { decision: parsed.data.decision, reason: parsed.data.reason },
          transformationId: transformation.id,
        });
      }

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

// ── Server-rendered segmentation review UI (Phase 06) ─────────────────────
// Exposes all 11 Phase 06 review actions plus coherence checks,
// cross-file relationships, and audit trail.

function segmentationReviewHtml(containerId: number): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Segmentation Review — Container ${containerId}</title>
<meta name="robots" content="noindex, nofollow">
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,sans-serif;margin:0;background:#f5f5f4;color:#1c1917}
  header{background:#1c1917;color:#fafaf9;padding:.75rem 1rem;display:flex;gap:1rem;align-items:baseline}
  header h1{font-size:1rem;margin:0}
  .layout{display:grid;grid-template-columns:260px 1fr;gap:1rem;padding:1rem;align-items:start}
  .panel{background:#fff;border:1px solid #d6d3d1;border-radius:6px;padding:.75rem}
  .panel h2{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:#78716c;margin:.75rem 0 .4rem;border-top:1px solid #f3f4f6;padding-top:.5rem}
  .panel h2:first-child{border-top:none;padding-top:0;margin-top:0}
  .cand-item{border:1px solid #e7e5e4;border-radius:4px;padding:.4rem .5rem;margin-bottom:.3rem;cursor:pointer;font-size:.8rem}
  .cand-item:hover{background:#f5f5f4}
  .cand-item.active{background:#1c1917;color:#fff;border-color:#1c1917}
  .cand-item .meta{font-size:.72rem;opacity:.7}
  .strength-STRONG{color:#15803d;font-weight:700}
  .strength-MODERATE{color:#0369a1;font-weight:600}
  .strength-WEAK{color:#b45309}
  .strength-CONFLICTING{color:#dc2626}
  .signal{border-left:3px solid #a8a29e;padding:.2rem .4rem;margin-bottom:.2rem;font-size:.78rem}
  .signal.positive{border-color:#15803d}
  .signal.negative{border-color:#dc2626;background:#fef2f2}
  .signal .meta{color:#78716c;font-size:.7rem}
  .check-row{display:flex;justify-content:space-between;align-items:center;padding:.2rem 0;border-bottom:1px solid #f3f4f6;font-size:.78rem}
  .check-row:last-child{border-bottom:none}
  .rel-row,.act-row{padding:.25rem .4rem;background:#fafaf9;border:1px solid #e7e5e4;border-radius:3px;margin-bottom:.2rem;font-size:.75rem}
  .act-row{background:#fff}
  .badge{display:inline-block;padding:1px 5px;border-radius:9px;font-size:.68rem;font-weight:600;margin-left:3px}
  .badge.PASS{background:#d1fae5;color:#065f46}
  .badge.FAIL{background:#fee2e2;color:#991b1b}
  .badge.UNCERTAIN{background:#fef3c7;color:#92400e}
  .badge.NOT_APPLICABLE{background:#f3f4f6;color:#6b7280}
  .badge.reviewed,.badge.auto_accepted{background:#d1fae5;color:#065f46}
  .badge.rejected{background:#fee2e2;color:#991b1b}
  .badge.review_required{background:#fef3c7;color:#92400e}
  .actions{display:flex;flex-wrap:wrap;gap:.3rem;margin:.4rem 0}
  button.primary{background:#1c1917;color:#fff;border:0;border-radius:4px;padding:.4rem .8rem;cursor:pointer;font-size:.78rem}
  button.danger{background:#dc2626;color:#fff;border:0;border-radius:4px;padding:.4rem .8rem;cursor:pointer;font-size:.78rem}
  button.secondary{background:#fff;color:#1c1917;border:1px solid #d6d3d1;border-radius:4px;padding:.4rem .8rem;cursor:pointer;font-size:.78rem}
  button.amber{background:#d97706;color:#fff;border:0;border-radius:4px;padding:.4rem .8rem;cursor:pointer;font-size:.78rem}
  .form-box{border:1px solid #d6d3d1;border-radius:4px;padding:.6rem;margin-top:.4rem;background:#fafaf9;font-size:.78rem}
  .form-box label{display:block;margin-bottom:.3rem;color:#57534e}
  .form-box input,.form-box textarea{width:100%;padding:.25rem .4rem;border:1px solid #d6d3d1;border-radius:3px;font-size:.78rem;margin-top:.1rem}
  .form-box textarea{min-height:3rem;font-family:ui-monospace,monospace}
  #status{font-size:.78rem;color:#78716c;margin-top:.3rem;min-height:1rem}
  table.meta-table{font-size:.78rem;width:100%;border-collapse:collapse}
  table.meta-table td:first-child{color:#78716c;padding-right:.5rem;white-space:nowrap}
  .scrollable{max-height:20vh;overflow:auto}
</style>
</head>
<body>
<header>
  <h1>Segmentation Review — Container ${containerId}</h1>
  <span id="run-status" style="font-size:.8rem;opacity:.7"></span>
</header>
<div class="layout">
  <div class="panel">
    <h2>Case Candidates</h2>
    <div id="candidates">Loading…</div>
    <div style="margin-top:.5rem;font-size:.72rem;color:#78716c">Unassigned pages: <span id="unassigned-pages">—</span></div>
  </div>
  <div class="panel" id="detail-panel">
    <div id="detail" style="color:#78716c;font-size:.8rem">Select a candidate from the list.</div>
  </div>
</div>
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
async function post(path, body) {
  return j(BASE + path, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body) });
}

function strengthCls(s) {
  if (!s) return "";
  if (s.includes("STRONG")) return "strength-STRONG";
  if (s.includes("MODERATE")) return "strength-MODERATE";
  if (s.includes("WEAK")) return "strength-WEAK";
  if (s.includes("CONFLICTING")) return "strength-CONFLICTING";
  return "";
}
function badge(v, extra) {
  if (!v) return "";
  return '<span class="badge ' + esc(extra || v) + '">' + esc(v) + '</span>';
}

// ── Candidate list ─────────────────────────────────────────────────────────

async function loadCandidates() {
  const data = await j(BASE + "/containers/" + CONTAINER_ID + "/candidates");
  document.getElementById("run-status").textContent =
    "run #" + (data.runId ?? "—") + " · " + (data.status ?? "—");
  const holder = document.getElementById("candidates");
  holder.innerHTML = "";
  if (!data.candidates || data.candidates.length === 0) {
    holder.innerHTML = "<small>No candidates detected.</small>";
    return;
  }
  for (const c of data.candidates) {
    const div = document.createElement("div");
    div.className = "cand-item";
    div.innerHTML =
      "<div><b>#" + c.candidateId + "</b>" + badge(c.reviewStatus) + "</div>" +
      "<div class='meta " + strengthCls(c.strength) + "'>" + esc(c.strength) + "</div>" +
      "<div class='meta'>Pages " + esc(c.startPage) + "–" + esc(c.endPage) + "</div>";
    div.onclick = () => loadCandidate(c.candidateId, div);
    holder.appendChild(div);
  }
  if (data.candidates.length > 0) {
    const det = await j(BASE + "/containers/" + CONTAINER_ID + "/candidates/" + data.candidates[0].candidateId).catch(() => null);
    if (det) {
      const up = det.unassignedPages ?? [];
      document.getElementById("unassigned-pages").textContent = up.length > 0 ? up.join(", ") : "none";
    }
  }
}

// ── Candidate detail ───────────────────────────────────────────────────────

async function loadCandidate(id, btn) {
  currentCandidate = id;
  document.querySelectorAll(".cand-item").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  document.getElementById("detail").innerHTML = "Loading…";

  const [d, checks, rels, actions] = await Promise.all([
    j(BASE + "/containers/" + CONTAINER_ID + "/candidates/" + id),
    j(BASE + "/candidates/" + id + "/coherence").catch(() => []),
    j(BASE + "/candidates/" + id + "/relationships").catch(() => []),
    j(BASE + "/candidates/" + id + "/review/actions").catch(() => []),
  ]);
  const c = d.candidate;
  const start = d.startBoundary;
  const end = d.endBoundary;
  const posSignals = (d.signals || []).filter((s) => s.scoreContribution >= 0);
  const negSignals = d.conflictingSignals || [];

  // ── metadata ──────────────────────────────────────────────────────────
  let html = "<table class='meta-table'>" +
    "<tr><td>Strength</td><td class='" + strengthCls(c.strength) + "'>" + esc(c.strength) + "</td></tr>" +
    "<tr><td>Status</td><td>" + badge(c.reviewStatus) + "</td></tr>" +
    "<tr><td>Pages</td><td>" + esc(c.pageCount) + "</td></tr>" +
    "<tr><td>Start boundary</td><td>" +
      (start ? "Page " + esc(start.pageId) + " <span class='" + strengthCls(start.strength) + "'>" + esc(start.strength) + "</span> (score " + esc(start.compositeScore) + ")" : "—") +
    "</td></tr><tr><td>End boundary</td><td>" +
      (end ? "Page " + esc(end.pageId) + " <span class='" + strengthCls(end.strength) + "'>" + esc(end.strength) + "</span> (score " + esc(end.compositeScore) + ")" : "—") +
    "</td></tr></table>";

  // ── signals ───────────────────────────────────────────────────────────
  html += "<h2>Positive Signals (" + posSignals.length + ")</h2><div class='scrollable'>";
  html += posSignals.length ? posSignals.map((s) =>
    '<div class="signal positive"><div class="meta">' + esc(s.signalType) + ' (+' + esc(s.scoreContribution) + ') p.' + esc(s.pageId) + '</div>' + esc(s.supportingText) + '</div>'
  ).join("") : "<small>None.</small>";
  html += "</div>";
  html += "<h2>Conflicting Signals (" + negSignals.length + ")</h2><div class='scrollable'>";
  html += negSignals.length ? negSignals.map((s) =>
    '<div class="signal negative"><div class="meta">' + esc(s.signalType) + ' (' + esc(s.scoreContribution) + ') p.' + esc(s.pageId) + '</div>' + esc(s.supportingText) + '</div>'
  ).join("") : "<small>None.</small>";
  html += "</div>";

  // ── coherence checks ──────────────────────────────────────────────────
  html += "<h2>Coherence Checks (" + checks.length + ")</h2><div class='scrollable'>";
  html += checks.length ? checks.map((ch) =>
    '<div class="check-row"><span style="font-family:ui-monospace,monospace;font-size:.72rem">' + esc(ch.checkType) + '</span>' + badge(ch.result) + '</div>'
  ).join("") : "<small>No checks run yet.</small>";
  html += "</div>";

  // ── 11 review actions ─────────────────────────────────────────────────
  html += "<h2>Review Actions (11)</h2>";
  html += "<div class='actions'>" +
    "<button class='primary' onclick='doAction(" + id + ",\"approve\")'>✓ Approve</button>" +
    "<button class='danger' onclick='doAction(" + id + ",\"reject\")'>✗ Reject</button>" +
    "<button class='secondary' onclick='doAction(" + id + ",\"reprocess\")'>↻ Re-validate</button>" +
    "<button class='amber' onclick='doAction(" + id + ",\"mark-non-case\")'>⊘ Not a Case</button>" +
    "<button class='secondary' onclick='doAction(" + id + ",\"mark-incomplete\")'>⚠ Incomplete</button>" +
    "</div>" +
    "<div class='actions'>" +
    "<button class='secondary' onclick='showForm(" + id + ",\"move-boundary\")'>↔ Move Boundary</button>" +
    "<button class='secondary' onclick='showForm(" + id + ",\"split\")'>⊢ Split</button>" +
    "<button class='secondary' onclick='showForm(" + id + ",\"merge\")'>⊔ Merge</button>" +
    "</div>" +
    "<div class='actions'>" +
    "<button class='secondary' onclick='showForm(" + id + ",\"link-continuation\")'>⤵ Link Continuation</button>" +
    "<button class='secondary' onclick='showForm(" + id + ",\"link-duplicate\")'>⊡ Link Duplicate</button>" +
    "<button class='secondary' onclick='showForm(" + id + ",\"link-related\")'>⟷ Link Related</button>" +
    "</div>" +
    "<div id='action-form'></div>" +
    "<div id='status'></div>";

  // ── cross-file relationships ───────────────────────────────────────────
  html += "<h2>Cross-file Relationships (" + rels.length + ")</h2>";
  html += rels.length ? rels.map((r) =>
    '<div class="rel-row"><b>' + esc(r.relationshipType) + '</b> — #' + esc(r.sourceCandidateId) + ' ↔ #' + esc(r.targetCandidateId) + '</div>'
  ).join("") : "<small>No cross-file relationships.</small>";

  // ── audit trail ───────────────────────────────────────────────────────
  html += "<h2>Audit Trail (" + actions.length + ")</h2>";
  html += actions.length ? actions.map((a) =>
    '<div class="act-row"><b>' + esc(a.actionType) + '</b> by ' + esc(a.actor) + ' — <em>' + esc(a.detail?.reason ?? "") + '</em></div>'
  ).join("") : "<small>No review actions yet.</small>";

  document.getElementById("detail").innerHTML = html;
}

// ── Simple actions (reason only) ───────────────────────────────────────────


async function doAction(id, action) {
  const status = document.getElementById("status");
  const reason = prompt("Reason" + (action === "reject" ? " (required)" : "") + ":", "");
  if (action === "reject" && !reason) { status.textContent = "Reason required for rejection."; return; }
  status.textContent = "Saving…";
  try {
    await post("/candidates/" + id + "/review/" + action, { reason: reason || "Reviewer action" });
    status.textContent = action + " recorded. Refreshing…";
    setTimeout(() => { loadCandidates(); loadCandidate(id, null); }, 600);
  } catch (e) {
    status.textContent = "Failed: " + esc(e.message);
  }
}

// ── Forms for actions that need extra fields ───────────────────────────────

function showForm(id, action) {
  const box = document.getElementById("action-form");
  if (!box) return;
  let inner = "<div class='form-box'><b>" + esc(action) + " #" + id + "</b><br>";
  if (action === "move-boundary") {
    inner += "<label>Boundary role:<select id='f-role'><option value='start'>start</option><option value='end'>end</option></select></label>" +
             "<label style='margin-top:.25rem'>New page ID:<input type='number' id='f-page'></label>";
  } else if (action === "split") {
    inner += "<label>Split at page ID:<input type='number' id='f-split-page'></label>";
  } else if (action === "merge") {
    inner += "<label>Target candidate ID:<input type='number' id='f-target'></label>";
  } else if (action === "link-continuation") {
    inner += "<label>Continuation candidate ID:<input type='number' id='f-target'></label>" +
             "<label style='margin-top:.25rem'><input type='checkbox' id='f-confirmed'> Confirmed (not just possible)</label>";
  } else if (action === "link-duplicate") {
    inner += "<label>Duplicate candidate ID:<input type='number' id='f-target'></label>" +
             "<label style='margin-top:.25rem'>Type:<select id='f-type'>" +
             "<option value='POSSIBLE_DUPLICATE'>POSSIBLE_DUPLICATE</option>" +
             "<option value='EXACT_DUPLICATE'>EXACT_DUPLICATE</option>" +
             "<option value='ALTERNATIVE_VERSION'>ALTERNATIVE_VERSION</option>" +
             "<option value='CORRECTED_VERSION'>CORRECTED_VERSION</option>" +
             "</select></label>";
  } else if (action === "link-related") {
    inner += "<label>Related candidate ID:<input type='number' id='f-target'></label>" +
             "<label style='margin-top:.25rem'>Type:<select id='f-type'>" +
             "<option value='RELATED_APPEAL'>RELATED_APPEAL</option>" +
             "<option value='UNRELATED'>UNRELATED</option>" +
             "</select></label>";
  }
  inner += "<label style='margin-top:.25rem'>Reason:<textarea id='f-reason' rows='2'></textarea></label>" +
    "<button class='primary' style='margin-top:.4rem' onclick='submitForm(" + id + ",\"" + action + "\")'>Submit</button>" +
    "<button class='secondary' style='margin-top:.4rem;margin-left:.25rem' onclick='document.getElementById(\"action-form\").innerHTML=\"\"'>Cancel</button>" +
    "</div>";
  box.innerHTML = inner;
}

async function submitForm(id, action) {
  const status = document.getElementById("status");
  const reason = document.getElementById("f-reason")?.value?.trim() || "";
  if (!reason) { status.textContent = "Reason is required."; return; }
  let body = { reason };
  if (action === "move-boundary") {
    const role = document.getElementById("f-role")?.value;
    const pg = parseInt(document.getElementById("f-page")?.value ?? "");
    if (!role || !pg) { status.textContent = "Boundary role and page ID required."; return; }
    body = { ...body, boundaryRole: role, newPageId: pg };
  } else if (action === "split") {
    const pg = parseInt(document.getElementById("f-split-page")?.value ?? "");
    if (!pg) { status.textContent = "Split page ID required."; return; }
    body = { ...body, splitPageId: pg };
  } else if (action === "link-continuation") {
    const tgt = parseInt(document.getElementById("f-target")?.value ?? "");
    if (!tgt) { status.textContent = "Target candidate ID required."; return; }
    const confirmed = document.getElementById("f-confirmed")?.checked ?? false;
    body = { ...body, targetCandidateId: tgt, confirmed };
  } else if (action === "link-duplicate" || action === "link-related") {
    const tgt = parseInt(document.getElementById("f-target")?.value ?? "");
    if (!tgt) { status.textContent = "Target candidate ID required."; return; }
    const type = document.getElementById("f-type")?.value;
    if (!type) { status.textContent = "Type is required."; return; }
    body = { ...body, targetCandidateId: tgt, type };
  } else {
    const tgt = parseInt(document.getElementById("f-target")?.value ?? "");
    if (!tgt) { status.textContent = "Target candidate ID required."; return; }
    body = { ...body, targetCandidateId: tgt };
  }
  status.textContent = "Saving…";
  try {
    const result = await post("/candidates/" + id + "/review/" + action, body);
    status.textContent = action + " successful. " + JSON.stringify(result);
    document.getElementById("action-form").innerHTML = "";
    setTimeout(() => { loadCandidates(); loadCandidate(id, null); }, 700);
  } catch (e) {
    status.textContent = "Failed: " + esc(e.message);
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
