// Staff-only page-review + Phase 06 candidate review UI.
// Renders a server-side HTML shell; all data is fetched client-side using
// the caller's own credentials so every access re-runs the rights gate.

export function reviewUiHtml(containerId: number): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Container Review — ${containerId}</title>
<meta name="robots" content="noindex, nofollow">
<style>
  *{box-sizing:border-box}
  body{font-family:system-ui,sans-serif;margin:0;background:#f5f5f4;color:#1c1917}
  header{background:#1c1917;color:#fafaf9;padding:.75rem 1rem;display:flex;gap:1rem;align-items:baseline}
  header h1{font-size:1rem;margin:0}
  .tabs{display:flex;gap:0;border-bottom:2px solid #d6d3d1;background:#fff;padding:0 1rem}
  .tab{padding:.6rem 1.2rem;cursor:pointer;border:none;background:none;font-size:.85rem;color:#78716c;border-bottom:2px solid transparent;margin-bottom:-2px}
  .tab.active{color:#1c1917;font-weight:600;border-bottom-color:#1c1917}
  .pane{display:none;padding:1rem}
  .pane.active{display:block}
  /* Page review pane */
  .pg-grid{display:grid;grid-template-columns:200px 1fr 1fr;gap:1rem;align-items:start}
  /* Candidate review pane */
  .cand-grid{display:grid;grid-template-columns:220px 1fr;gap:1rem;align-items:start}
  .panel{background:#fff;border:1px solid #d6d3d1;border-radius:6px;padding:.75rem}
  .panel h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;color:#78716c;margin:0 0 .5rem}
  #pages button,.cand-list button{display:block;width:100%;text-align:left;margin-bottom:2px;padding:.35rem .5rem;border:1px solid #e7e5e4;background:#fafaf9;border-radius:4px;cursor:pointer;font-size:.8rem}
  #pages button.active,.cand-list button.active{background:#1c1917;color:#fff}
  .badge{display:inline-block;padding:1px 6px;border-radius:9px;font-size:.7rem;font-weight:600;margin-left:4px}
  .badge.PASS{background:#d1fae5;color:#065f46}
  .badge.FAIL{background:#fee2e2;color:#991b1b}
  .badge.UNCERTAIN{background:#fef3c7;color:#92400e}
  .badge.NOT_APPLICABLE{background:#f3f4f6;color:#6b7280}
  .badge.reviewed{background:#d1fae5;color:#065f46}
  .badge.rejected{background:#fee2e2;color:#991b1b}
  .badge.review_required{background:#fef3c7;color:#92400e}
  .badge.auto_accepted{background:#dbeafe;color:#1e40af}
  pre{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:.8rem;background:#fafaf9;border:1px solid #e7e5e4;border-radius:4px;padding:.5rem;max-height:35vh;overflow:auto}
  img#page-image{max-width:100%;border:1px solid #d6d3d1}
  .warning{background:#fef3c7;border:1px solid #f59e0b;border-radius:4px;padding:.35rem .5rem;font-size:.8rem;margin-bottom:.25rem}
  .block{border-left:3px solid #a8a29e;padding:.25rem .5rem;margin-bottom:.25rem;font-size:.8rem}
  .block .meta{color:#78716c;font-size:.7rem}
  .correction{border:1px solid #e7e5e4;border-radius:4px;padding:.5rem;margin-bottom:.5rem;font-size:.8rem}
  textarea{width:100%;min-height:8rem;font-family:ui-monospace,monospace;font-size:.8rem}
  input[type=text]{width:100%;padding:.3rem .5rem;border:1px solid #d6d3d1;border-radius:4px;font-size:.8rem}
  .actions{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0}
  button.primary{background:#1c1917;color:#fff;border:0;border-radius:4px;padding:.5rem 1rem;cursor:pointer;font-size:.8rem}
  button.danger{background:#dc2626;color:#fff;border:0;border-radius:4px;padding:.5rem 1rem;cursor:pointer;font-size:.8rem}
  button.secondary{background:#fff;color:#1c1917;border:1px solid #d6d3d1;border-radius:4px;padding:.5rem 1rem;cursor:pointer;font-size:.8rem}
  #status,#cand-status{font-size:.8rem;color:#78716c;margin-top:.4rem}
  .check-row{display:flex;justify-content:space-between;align-items:center;padding:.25rem 0;border-bottom:1px solid #f3f4f6;font-size:.8rem}
  .check-row:last-child{border-bottom:none}
  .check-name{font-family:ui-monospace,monospace;font-size:.75rem;color:#44403c}
  .rel-row{padding:.3rem .5rem;background:#fafaf9;border:1px solid #e7e5e4;border-radius:4px;margin-bottom:.25rem;font-size:.8rem}
  .action-row{padding:.3rem .5rem;border-bottom:1px solid #f3f4f6;font-size:.75rem;color:#57534e}
</style>
</head>
<body>
<header>
  <h1>Container ${containerId} — Review UI</h1>
  <span id="run-status"></span>
</header>

<div class="tabs">
  <button class="tab active" onclick="switchTab('pages')">Page Review</button>
  <button class="tab" onclick="switchTab('candidates')">Candidates &amp; Coherence</button>
  <button class="tab" onclick="switchTab('spans')">Cross-file Spans</button>
  <button class="tab" onclick="switchTab('audit')">Audit Trail</button>
</div>

<!-- ═══ PAGE REVIEW PANE ═════════════════════════════════════════════════ -->
<div id="pane-pages" class="pane active">
  <div class="pg-grid">
    <div class="panel">
      <h2>Pages</h2>
      <div id="pages">Loading…</div>
    </div>
    <div class="panel">
      <h2>Original page</h2>
      <div id="image-holder">Select a page.</div>
      <h2 style="margin-top:1rem">Extracted text (raw, immutable)</h2>
      <pre id="raw-text"></pre>
      <h2>Warnings</h2>
      <div id="warnings"></div>
    </div>
    <div class="panel">
      <h2>Detected blocks</h2>
      <div id="blocks" style="max-height:30vh;overflow:auto"></div>
      <h2 style="margin-top:1rem">Correction history</h2>
      <div id="corrections"></div>
      <h2>New correction (appends a version — raw output is preserved)</h2>
      <textarea id="corrected-text" placeholder="Corrected page text"></textarea>
      <input type="text" id="correction-reason" placeholder="Reason for correction" style="margin-top:.3rem">
      <button class="primary" id="submit-correction" style="margin-top:.5rem">Submit correction</button>
      <div id="status"></div>
    </div>
  </div>
</div>

<!-- ═══ CANDIDATES & COHERENCE PANE ════════════════════════════════════ -->
<div id="pane-candidates" class="pane">
  <div class="cand-grid">
    <div class="panel">
      <h2>Candidates</h2>
      <div class="cand-list" id="cand-list">Loading…</div>
    </div>
    <div class="panel" id="cand-detail-panel">
      <p style="color:#78716c;font-size:.85rem">Select a candidate to review.</p>
    </div>
  </div>
</div>

<!-- ═══ CROSS-FILE SPANS PANE ══════════════════════════════════════════ -->
<div id="pane-spans" class="pane">
  <div class="cand-grid">
    <div class="panel">
      <h2>Cross-file Spans</h2>
      <div id="spans-list">Loading…</div>
    </div>
    <div class="panel" id="span-detail-panel">
      <p style="color:#78716c;font-size:.85rem">Select a span to review.</p>
    </div>
  </div>
</div>

<!-- ═══ AUDIT TRAIL PANE ═══════════════════════════════════════════════ -->
<div id="pane-audit" class="pane">
  <div class="panel">
    <h2>Audit Trail</h2>
    <div style="display:flex;gap:.5rem;margin-bottom:.75rem;align-items:center">
      <label style="font-size:.8rem">Filter by stage:
        <select id="audit-stage-filter" style="margin-left:.25rem;padding:.2rem .4rem;font-size:.8rem;border:1px solid #d6d3d1;border-radius:4px" onchange="loadAudit()">
          <option value="">All stages</option>
          <option value="upload">Upload</option>
          <option value="rights">Rights</option>
          <option value="extraction">Extraction</option>
          <option value="segmentation">Segmentation</option>
          <option value="verification">Verification</option>
          <option value="search">Search</option>
          <option value="export">Export</option>
        </select>
      </label>
    </div>
    <div id="audit-events" style="max-height:65vh;overflow:auto">Loading…</div>
  </div>
</div>

<script>
const BASE = location.pathname.replace(/\\/containers\\/\\d+\\/review-ui$/, "");
const CONTAINER_ID = ${containerId};
let currentPage = null;
let currentCandidateId = null;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

async function j(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
  return r.json();
}

// ── Tab switching ──────────────────────────────────────────────────────────

const TAB_NAMES = ["pages", "candidates", "spans", "audit"];
function switchTab(name) {
  document.querySelectorAll(".tab").forEach((t, i) => {
    t.classList.toggle("active", TAB_NAMES[i] === name);
  });
  for (const n of TAB_NAMES) {
    const pane = document.getElementById("pane-" + n);
    if (pane) pane.classList.toggle("active", n === name);
  }
  if (name === "candidates" && document.getElementById("cand-list").textContent === "Loading…") {
    loadCandidates();
  }
  if (name === "spans" && document.getElementById("spans-list").textContent === "Loading…") {
    loadSpans();
  }
  if (name === "audit" && document.getElementById("audit-events").textContent === "Loading…") {
    loadAudit();
  }
}

// ── Page review ────────────────────────────────────────────────────────────

async function loadPages() {
  const data = await j(BASE + "/containers/" + CONTAINER_ID + "/pages");
  document.getElementById("run-status").textContent = "run #" + data.runId + " — " + data.status;
  const holder = document.getElementById("pages");
  holder.innerHTML = "";
  for (const p of data.pages) {
    const b = document.createElement("button");
    b.innerHTML = "p." + p.pageNumber + " <small>" + p.mode +
      (p.ocrMeanConfidence !== null ? " " + p.ocrMeanConfidence + "%" : "") +
      (p.isBlank ? " blank" : "") + "</small>";
    b.dataset.id = p.pageExtractionId;
    b.onclick = () => loadPage(p.pageExtractionId, b);
    holder.appendChild(b);
  }
  if (data.pages.length === 0) holder.textContent = "No pages extracted.";
}

async function loadPage(id, btn) {
  currentPage = id;
  document.querySelectorAll("#pages button").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  const d = await j(BASE + "/pages/" + id);
  document.getElementById("raw-text").textContent = d.extraction.rawText;
  const img = document.getElementById("image-holder");
  if (d.extraction.imageStorageKey) {
    img.innerHTML = '<img id="page-image" src="' + BASE + "/pages/" + id + '/image" alt="page image">';
  } else {
    img.textContent = "Native-text page (no stored image).";
  }
  document.getElementById("warnings").innerHTML = d.warnings.length
    ? d.warnings.map((w) => '<div class="warning" data-code="' + esc(w.code) + '"><b>' + esc(w.code) + "</b> " + esc(JSON.stringify(w.detail)) + "</div>").join("")
    : "<small>No warnings.</small>";
  document.getElementById("blocks").innerHTML = d.blocks.map((b) =>
    '<div class="block"><div class="meta">#' + b.readingOrder + " " + esc(b.blockType) +
    (b.columnIndex !== null ? " col " + b.columnIndex : "") +
    " [" + b.charStart + "–" + b.charEnd + "]</div>" + esc(b.text) + "</div>").join("") || "<small>No blocks.</small>";
  renderCorrections(d.corrections);
  document.getElementById("corrected-text").value = d.extraction.rawText;
}

function renderCorrections(list) {
  document.getElementById("corrections").innerHTML = list.length
    ? list.map((c) => '<div class="correction"><b>v' + c.version + "</b> by " + esc(c.reviewer) +
        " — " + esc(c.reason) + "<br><small>" + esc(c.createdAt) + " (" + esc(c.processorVersion) + ")</small><pre>" +
        esc(c.correctedText) + "</pre></div>").join("")
    : "<small>No corrections yet.</small>";
}

document.getElementById("submit-correction").onclick = async () => {
  if (!currentPage) return;
  const status = document.getElementById("status");
  status.textContent = "Saving…";
  try {
    await j(BASE + "/pages/" + currentPage + "/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        correctedText: document.getElementById("corrected-text").value,
        reason: document.getElementById("correction-reason").value,
      }),
    });
    status.textContent = "Correction saved.";
    const d = await j(BASE + "/pages/" + currentPage);
    renderCorrections(d.corrections);
  } catch (e) {
    status.textContent = "Failed: " + e.message;
  }
};

// ── Candidate & coherence review ──────────────────────────────────────────

async function loadCandidates() {
  const list = document.getElementById("cand-list");
  try {
    // Use the segmentation endpoint to list candidates for this container
    const data = await j(BASE + "/containers/" + CONTAINER_ID + "/candidates").catch(() => null);
    const candidates = Array.isArray(data) ? data : (data?.candidates ?? []);
    list.innerHTML = "";
    if (candidates.length === 0) {
      list.textContent = "No candidates found.";
      return;
    }
    for (const c of candidates) {
      const b = document.createElement("button");
      const statusBadge = '<span class="badge ' + esc(c.reviewStatus ?? "review_required") + '">' + esc(c.reviewStatus ?? "?") + "</span>";
      b.innerHTML = "#" + c.candidateId + statusBadge + "<br><small>" + esc(c.strength ?? "—") + "</small>";
      b.onclick = () => loadCandidate(c.candidateId, b);
      list.appendChild(b);
    }
  } catch (e) {
    list.textContent = "Failed to load candidates: " + e.message;
  }
}

async function loadCandidate(id, btn) {
  currentCandidateId = id;
  document.querySelectorAll(".cand-list button").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  const panel = document.getElementById("cand-detail-panel");
  panel.innerHTML = "Loading…";

  try {
    const [checks, rels, actions, passagesData] = await Promise.all([
      j(BASE + "/candidates/" + id + "/coherence").catch(() => []),
      j(BASE + "/candidates/" + id + "/relationships").catch(() => []),
      j(BASE + "/candidates/" + id + "/review/actions").catch(() => []),
      j(BASE + "/containers/" + CONTAINER_ID + "/candidates/" + id + "/analysis-passages").catch(() => ({ passages: [] })),
    ]);
    const autoPassages = (passagesData?.passages ?? []).slice(0, 20);

    const checkRows = checks.length
      ? checks.map((c) =>
          '<div class="check-row"><span class="check-name">' + esc(c.checkType) + '</span>' +
          '<span class="badge ' + esc(c.result) + '">' + esc(c.result) + '</span></div>'
        ).join("")
      : "<small>No coherence checks recorded yet.</small>";

    const relRows = rels.length
      ? rels.map((r) =>
          '<div class="rel-row"><b>' + esc(r.relationshipType) + '</b> ' +
          '← cand #' + esc(r.sourceCandidateId) + ' → cand #' + esc(r.targetCandidateId) + '</div>'
        ).join("")
      : "<small>No cross-file relationships.</small>";

    const actionRows = actions.length
      ? actions.map((a) =>
          '<div class="action-row"><b>' + esc(a.actionType) + '</b> by ' + esc(a.actor) +
          ' <small>' + esc(a.createdAt) + '</small></div>'
        ).join("")
      : "<small>No review actions yet.</small>";

    panel.innerHTML = \`
      <h2>Candidate #\${id} — Coherence Checks</h2>
      <div>\${checkRows}</div>

      <h2 style="margin-top:1rem">Review Actions</h2>
      <div class="actions">
        <button class="primary" onclick="reviewAction(\${id},'approve')">✓ Approve</button>
        <button class="danger" onclick="reviewAction(\${id},'reject')">✗ Reject</button>
        <button class="secondary" onclick="reviewAction(\${id},'reprocess')">↻ Re-validate</button>
        <button class="secondary" onclick="showSplitForm(\${id})">⊢ Split</button>
        <button class="secondary" onclick="showMergeForm(\${id})">⊔ Merge</button>
      </div>
      <div id="cand-action-form"></div>
      <div id="cand-status"></div>

      <h2 style="margin-top:1rem">Quotation Integrity Check</h2>
      \${autoPassages.length > 0
        ? '<p style="font-size:.8rem;color:#78716c;margin:0 0 .5rem">' +
          '<b>' + autoPassages.length + ' passage' + (autoPassages.length === 1 ? '' : 's') + ' pre-loaded from AI analysis.</b> ' +
          'Results are shown below. You may also replace or add passages (10–500 chars each, one per line) from an ' +
          '<b>independent source</b> (e.g. a published law report) and re-check.</p>'
        : '<p style="font-size:.8rem;color:#78716c;margin:0 0 .5rem">' +
          'Paste one or more passages (10–500 chars each, one per line) from an ' +
          '<b>independent source</b> (e.g. a published law report or court record). ' +
          'The system will verify each passage appears verbatim in the OCR extraction.</p>'
      }
      <textarea id="quot-passages" rows="5" style="width:100%;font-size:.8rem;font-family:monospace;box-sizing:border-box"
        placeholder="Paste passages to verify here, one per line…"></textarea>
      <button class="secondary" style="margin-top:.4rem" onclick="runQuotCheck(\${id})">Check passages in OCR source</button>
      <div id="quot-results"></div>

      <h2 style="margin-top:1rem">Cross-file Relationships</h2>
      <div>\${relRows}</div>

      <h2 style="margin-top:1rem">Audit Trail</h2>
      <div>\${actionRows}</div>
    \`;

    // Auto-fire the quotation check when the analysis pipeline has already
    // validated passages for this candidate (>= 1 passage found).
    if (autoPassages.length > 0) {
      const ta = document.getElementById("quot-passages");
      if (ta) ta.value = autoPassages.join("\n");
      runQuotCheck(id);
    }
  } catch (e) {
    panel.innerHTML = "Failed to load: " + esc(e.message);
  }
}

async function reviewAction(id, action) {
  const status = document.getElementById("cand-status");
  if (!status) return;
  const reasonNeeded = action === "reject";
  const reason = reasonNeeded ? prompt("Reason for rejection (required):") : "";
  if (reasonNeeded && !reason) return;
  status.textContent = "Saving…";
  try {
    await j(BASE + "/candidates/" + id + "/review/" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason || "Reviewer action from UI" }),
    });
    status.textContent = action + " successful. Refreshing…";
    setTimeout(() => loadCandidates(), 600);
  } catch (e) {
    status.textContent = "Failed: " + esc(e.message);
  }
}

function showSplitForm(id) {
  const form = document.getElementById("cand-action-form");
  if (!form) return;
  form.innerHTML = \`
    <div style="border:1px solid #d6d3d1;border-radius:4px;padding:.75rem;margin-top:.5rem;background:#fafaf9">
      <b>Split candidate #\${id}</b><br>
      <label style="font-size:.8rem">Split at page ID: <input type="number" id="split-page-id" style="width:100px"></label><br>
      <label style="font-size:.8rem">Reason: <input type="text" id="split-reason" style="width:100%"></label><br>
      <button class="primary" style="margin-top:.4rem" onclick="doSplit(\${id})">Execute Split</button>
    </div>
  \`;
}

async function doSplit(id) {
  const status = document.getElementById("cand-status");
  const splitPageId = parseInt(document.getElementById("split-page-id")?.value ?? "");
  const reason = document.getElementById("split-reason")?.value ?? "";
  if (!splitPageId || !reason) { if (status) status.textContent = "Split page ID and reason are required."; return; }
  if (status) status.textContent = "Splitting…";
  try {
    const result = await j(BASE + "/candidates/" + id + "/review/split", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ splitPageId, reason }),
    });
    if (status) status.textContent = "Split successful. New IDs: " + JSON.stringify(result.newCandidateIds) + ". Refreshing…";
    document.getElementById("cand-action-form").innerHTML = "";
    setTimeout(() => loadCandidates(), 800);
  } catch (e) {
    if (status) status.textContent = "Split failed: " + esc(e.message);
  }
}

function showMergeForm(id) {
  const form = document.getElementById("cand-action-form");
  if (!form) return;
  form.innerHTML = \`
    <div style="border:1px solid #d6d3d1;border-radius:4px;padding:.75rem;margin-top:.5rem;background:#fafaf9">
      <b>Merge candidate #\${id} with another</b><br>
      <label style="font-size:.8rem">Target candidate ID: <input type="number" id="merge-target-id" style="width:100px"></label><br>
      <label style="font-size:.8rem">Reason: <input type="text" id="merge-reason" style="width:100%"></label><br>
      <button class="primary" style="margin-top:.4rem" onclick="doMerge(\${id})">Execute Merge</button>
    </div>
  \`;
}

async function doMerge(id) {
  const status = document.getElementById("cand-status");
  const targetCandidateId = parseInt(document.getElementById("merge-target-id")?.value ?? "");
  const reason = document.getElementById("merge-reason")?.value ?? "";
  if (!targetCandidateId || !reason) { if (status) status.textContent = "Target candidate ID and reason are required."; return; }
  if (status) status.textContent = "Merging…";
  try {
    const result = await j(BASE + "/candidates/" + id + "/review/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetCandidateId, reason }),
    });
    if (status) status.textContent = "Merge successful. Merged ID: " + result.mergedCandidateId + ". Refreshing…";
    document.getElementById("cand-action-form").innerHTML = "";
    setTimeout(() => loadCandidates(), 800);
  } catch (e) {
    if (status) status.textContent = "Merge failed: " + esc(e.message);
  }
}

// ── Quotation integrity check ─────────────────────────────────────────────

async function runQuotCheck(candidateId) {
  const results = document.getElementById("quot-results");
  if (!results) return;
  const raw = (document.getElementById("quot-passages")?.value ?? "").trim();
  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l.length >= 10 && l.length <= 500);
  if (lines.length === 0) {
    results.innerHTML = '<span style="color:#ef4444">Paste at least one passage (10–500 chars) to check.</span>';
    return;
  }
  results.textContent = "Checking…";
  try {
    const data = await j(BASE + "/containers/" + CONTAINER_ID + "/quotation-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId, quotesToVerify: lines }),
    });
    results.innerHTML = (data.quotes ?? []).map((q) =>
      '<div class="action-row">' +
      (q.foundInSource
        ? '<span style="color:#22c55e">✓</span>'
        : '<span style="color:#ef4444">✗</span>') +
      " <code style=\"font-size:.75rem\">" + esc(q.text.slice(0, 120)) + (q.text.length > 120 ? "…" : "") + "</code></div>"
    ).join("") + '<div style="font-size:.8rem;color:#78716c;margin-top:.25rem">' + esc(data.integrityNote ?? "") + "</div>";
  } catch (e) {
    results.innerHTML = '<span style="color:#ef4444">Check failed: ' + esc(e.message) + "</span>";
  }
}

// ── Cross-file spans ──────────────────────────────────────────────────────

async function loadSpans() {
  const list = document.getElementById("spans-list");
  if (!list) return;
  try {
    const data = await j(BASE + "/cross-file-spans").catch(() => ({ spans: [] }));
    const spans = Array.isArray(data) ? data : (data?.spans ?? []);
    // Show all spans — fine-grained filtering is available via the detail panel.
    list.innerHTML = "";
    if (spans.length === 0) {
      list.textContent = "No cross-file spans found.";
      return;
    }
    for (const s of spans) {
      const b = document.createElement("button");
      b.innerHTML = "Span #" + s.id + ' <span class="badge ' + esc(String(s.status ?? "PROPOSED")) + '">' +
        esc(String(s.status ?? "PROPOSED")) + "</span>" +
        "<br><small>" + (s.candidateIds ?? []).length + " candidate(s)</small>";
      b.onclick = () => loadSpan(s.id, b);
      list.appendChild(b);
    }
  } catch (e) {
    list.textContent = "Failed to load spans: " + esc(e.message);
  }
}

async function loadSpan(id, btn) {
  document.querySelectorAll("#spans-list button").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  const panel = document.getElementById("span-detail-panel");
  if (!panel) return;
  panel.innerHTML = "Loading…";
  try {
    const data = await j(BASE + "/cross-file-spans/" + id);
    const span = data.span ?? data;
    const candidateIds = data.candidateIds ?? [];
    panel.innerHTML = \`
      <h2>Cross-file Span #\${id}</h2>
      <div class="check-row"><span>Status</span><span class="badge \${esc(span.status)}">\${esc(span.status)}</span></div>
      <div class="check-row"><span>Candidates</span><span>\${esc(candidateIds.join(", ") || "none")}</span></div>
      \${span.note ? '<p style="font-size:.8rem;margin:.5rem 0"><b>Note:</b> ' + esc(span.note) + "</p>" : ""}
      \${span.status === "PROPOSED" ? \`
      <div class="actions" style="margin-top:.75rem">
        <button class="primary" onclick="spanAction(\${id},'approve')">✓ Approve Split</button>
        <button class="danger" onclick="spanAction(\${id},'reject')">✗ Reject Split</button>
      </div>
      \` : '<p style="font-size:.8rem;color:#78716c;margin-top:.5rem">Span is <b>' + esc(span.status) + '</b> — no further action available.</p>'}
      <div id="span-status" style="font-size:.8rem;color:#78716c;margin-top:.4rem"></div>
    \`;
  } catch (e) {
    panel.innerHTML = "Failed to load span: " + esc(e.message);
  }
}

async function spanAction(id, action) {
  const status = document.getElementById("span-status");
  const reason = action === "reject" ? prompt("Reason for rejection (required):") : "Approved via review UI";
  if (action === "reject" && !reason) return;
  if (status) status.textContent = "Saving…";
  try {
    await j(BASE + "/cross-file-spans/" + id + "/" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (status) status.textContent = action + " successful. Refreshing…";
    setTimeout(() => loadSpans(), 600);
  } catch (e) {
    if (status) status.textContent = "Failed: " + esc(e.message);
  }
}

// ── Audit trail ───────────────────────────────────────────────────────────

async function loadAudit() {
  const el = document.getElementById("audit-events");
  if (!el) return;
  el.textContent = "Loading…";
  const stageEl = document.getElementById("audit-stage-filter");
  const stage = stageEl && "value" in stageEl ? stageEl.value : "";
  try {
    const url = BASE + "/containers/" + CONTAINER_ID + "/audit" +
      (stage ? "?stage=" + encodeURIComponent(stage) : "");
    const data = await j(url);
    const events = data.events ?? [];
    if (events.length === 0) {
      el.textContent = "No audit events" + (stage ? " for stage: " + stage : "") + ".";
      return;
    }
    el.innerHTML = events.map((e) =>
      '<div class="action-row"><b>' + esc(e.event) + '</b>' +
      (e.fromState ? " <span style=\\"color:#78716c\\">" + esc(e.fromState) + " → " + esc(e.toState) + "</span>" : "") +
      " by " + esc(e.actor) +
      " <small style=\\"color:#a8a29e\\">" + esc(new Date(e.createdAt).toLocaleString()) + "</small>" +
      "</div>"
    ).join("");
  } catch (e) {
    el.textContent = "Failed to load audit trail: " + esc(e.message);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────

loadPages().catch((e) => {
  document.getElementById("pages").textContent = "Failed to load: " + e.message;
});
</script>
</body>
</html>`;
}
