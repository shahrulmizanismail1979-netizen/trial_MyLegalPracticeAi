// Minimal staff-only page-review UI (Phase 04). A server-rendered shell
// that loads data from the JSON endpoints in ./extraction.ts. No inline
// document content is embedded server-side; everything is fetched with the
// caller's own credentials, so every access re-runs the rights gate.

export function reviewUiHtml(containerId: number): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Page Review — Container ${containerId}</title>
<meta name="robots" content="noindex, nofollow">
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #f5f5f4; color: #1c1917; }
  header { background: #1c1917; color: #fafaf9; padding: .75rem 1rem; display: flex; gap: 1rem; align-items: baseline; }
  header h1 { font-size: 1rem; margin: 0; }
  main { display: grid; grid-template-columns: 220px 1fr 1fr; gap: 1rem; padding: 1rem; align-items: start; }
  .panel { background: #fff; border: 1px solid #d6d3d1; border-radius: 6px; padding: .75rem; }
  .panel h2 { font-size: .8rem; text-transform: uppercase; letter-spacing: .05em; color: #78716c; margin: 0 0 .5rem; }
  #pages button { display: block; width: 100%; text-align: left; margin-bottom: 2px; padding: .35rem .5rem; border: 1px solid #e7e5e4; background: #fafaf9; border-radius: 4px; cursor: pointer; }
  #pages button.active { background: #1c1917; color: #fff; }
  #pages .warn { color: #b45309; font-weight: 600; }
  pre { white-space: pre-wrap; font-family: ui-monospace, monospace; font-size: .8rem; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 4px; padding: .5rem; max-height: 40vh; overflow: auto; }
  img#page-image { max-width: 100%; border: 1px solid #d6d3d1; }
  .warning { background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: .35rem .5rem; font-size: .8rem; margin-bottom: .25rem; }
  .block { border-left: 3px solid #a8a29e; padding: .25rem .5rem; margin-bottom: .25rem; font-size: .8rem; }
  .block .meta { color: #78716c; font-size: .7rem; }
  .correction { border: 1px solid #e7e5e4; border-radius: 4px; padding: .5rem; margin-bottom: .5rem; font-size: .8rem; }
  textarea { width: 100%; min-height: 8rem; font-family: ui-monospace, monospace; font-size: .8rem; }
  input[type=text] { width: 100%; }
  button.primary { background: #1c1917; color: #fff; border: 0; border-radius: 4px; padding: .5rem 1rem; cursor: pointer; margin-top: .5rem; }
  #status { font-size: .8rem; color: #78716c; }
</style>
</head>
<body>
<header>
  <h1>Page Review — Container ${containerId}</h1>
  <span id="run-status"></span>
</header>
<main>
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
    <input type="text" id="correction-reason" placeholder="Reason for correction">
    <button class="primary" id="submit-correction">Submit correction</button>
    <div id="status"></div>
  </div>
</main>
<script>
const BASE = location.pathname.replace(/\\/containers\\/\\d+\\/review-ui$/, "");
const CONTAINER_ID = ${containerId};
let currentPage = null;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

async function j(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.status);
  return r.json();
}

async function loadPages() {
  const data = await j(BASE + "/containers/" + CONTAINER_ID + "/pages");
  document.getElementById("run-status").textContent =
    "run #" + data.runId + " — " + data.status;
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

loadPages().catch((e) => {
  document.getElementById("pages").textContent = "Failed to load: " + e.message;
});
</script>
</body>
</html>`;
}
