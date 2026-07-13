export interface ExportDocxOptions {
  title: string;
  content: string;
  docType?: "land-office" | "firm" | "court" | "agreement";
  refNo?: string;
  parties?: string;
  state?: string;
  district?: string;
  filename?: string;
}

const ENDPOINT = "/api/convey/export-docx";

export async function downloadDocx(opts: ExportDocxOptions): Promise<void> {
  const token = localStorage.getItem("convey_token");
  const res = await fetch(ENDPOINT.startsWith("/") ? ENDPOINT : `/${ENDPOINT}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Export failed (${res.status}): ${text || res.statusText}`);
  }
  const blob = await res.blob();
  const safe = (opts.filename ?? opts.title)
    .replace(/[^\w\d\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 80) || "conveyancing_document";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.docx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

const GDOCS_URL = "https://docs.google.com/document/u/0/";
const GDRIVE_URL = "https://drive.google.com/drive/u/0/my-drive";

export async function downloadAndOpenInGoogleDocs(opts: ExportDocxOptions): Promise<void> {
  // STEP 1 — open the tab SYNCHRONOUSLY in the user-gesture context to bypass popup blockers.
  // We point it at about:blank with a friendly placeholder, then redirect after the download completes.
  const tab = window.open("about:blank", "_blank");
  if (tab && tab.document) {
    try {
      tab.document.title = "Preparing Google Docs…";
      tab.document.body.style.cssText = "background:#0b0b0b;color:#f5e6c8;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px;";
      tab.document.body.innerHTML = `
        <div>
          <h2 style="margin:0 0 12px;">Preparing your Malaysian Land Office document…</h2>
          <p style="opacity:.85;max-width:520px;line-height:1.55">Once the .docx file finishes downloading, this tab will open Google Docs.<br/>Then choose <b>File → Open → Upload</b> and drag the downloaded file in.</p>
          <p style="opacity:.6;margin-top:24px;font-size:13px">If this tab does not redirect automatically, <a href="${GDOCS_URL}" style="color:#facc15">click here</a>.</p>
        </div>`;
    } catch {
      /* cross-origin write may fail in some browsers — safe to ignore */
    }
  }

  // STEP 2 — download the docx (with a minimum dwell time so the placeholder is human-visible)
  let downloadOk = true;
  const startedAt = Date.now();
  try {
    await downloadDocx(opts);
  } catch (err) {
    downloadOk = false;
    if (tab) tab.close();
    throw err;
  }
  const MIN_DWELL_MS = 1500;
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_DWELL_MS) {
    await new Promise((r) => setTimeout(r, MIN_DWELL_MS - elapsed));
  }

  // STEP 3 — redirect the placeholder tab to Google Docs (or Drive as fallback)
  if (tab) {
    try {
      tab.location.href = downloadOk ? GDOCS_URL : GDRIVE_URL;
    } catch {
      try {
        tab.location.replace(GDOCS_URL);
      } catch {
        /* ignore */
      }
    }
  }
}
