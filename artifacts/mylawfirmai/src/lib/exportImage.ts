// Capture any DOM node as a PNG image or a multi-page A4 PDF so every page
// can be shared as a picture/document — e.g. to remind staff on other
// platforms (WhatsApp, email).
//
// Uses html2canvas-pro (rasterises the live DOM; the -pro fork parses Tailwind
// v4's oklch/color-mix output) + jsPDF (wraps slices into A4 pages), both
// imported lazily so they stay out of the initial bundle.

// Resolve a CSS custom property (stored as raw HSL channels, e.g. "240 20% 98%")
// into a usable color string, falling back when it is unset.
function resolveVar(name: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return raw ? `hsl(${raw})` : fallback;
}

interface CaptureOpts {
  /** Explicit pixel height to capture (defaults to full scrollHeight). */
  height?: number;
  /** Device-pixel scale — 2 for retina quality, 1.5 for large pages. */
  scale?: number;
}

async function captureNode(
  node: HTMLElement,
  { height, scale = 2 }: CaptureOpts = {},
): Promise<HTMLCanvasElement> {
  // html2canvas-pro handles oklch/oklab/color-mix that Tailwind v4 emits for
  // every opacity-modified utility class (bg-muted/30, border-border/40, …).
  const html2canvas = (await import("html2canvas-pro")).default;
  return html2canvas(node, {
    scale,
    useCORS: true,
    backgroundColor: resolveVar("--background", "#ffffff"),
    logging: false,
    // Match the rendered layout width.
    windowWidth: node.clientWidth,
    // Explicit height clips the capture; omitting it defaults to scrollHeight.
    ...(height !== undefined ? { height } : {}),
    onclone: (_doc, el) => {
      // Gradient headings use background-clip:text with transparent fill which
      // html2canvas renders invisible — repaint them as solid brand colour.
      const solid = resolveVar("--primary", "#7c3aed");
      el.querySelectorAll<HTMLElement>(".jewel-gradient-text").forEach((e) => {
        e.style.background = "none";
        e.style.webkitTextFillColor = solid;
        e.style.color = solid;
      });
      // Strip anything explicitly marked as not-for-export (e.g. export bar).
      el.querySelectorAll<HTMLElement>("[data-export-hide]").forEach((e) => {
        e.style.display = "none";
      });
    },
  });
}

function triggerDownload(dataUrl: string, filename: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Capture the visible viewport of `node` and download as a crisp PNG.
 * Captures only what is currently visible (clientHeight), giving a clean
 * single-screen image suitable for sharing on WhatsApp / email.
 */
export async function downloadNodePng(
  node: HTMLElement,
  filename: string,
): Promise<void> {
  // Capture only the visible portion — the scrollable viewport height.
  const canvas = await captureNode(node, {
    height: node.clientHeight,
    scale: 2,
  });
  triggerDownload(
    canvas.toDataURL("image/png"),
    filename.endsWith(".png") ? filename : `${filename}.png`,
  );
}

/**
 * Capture the FULL scroll content of `node` and download as a multi-page A4
 * PDF. Each A4 page is rendered from a fresh canvas slice so nothing is
 * cropped or repeated.
 */
export async function downloadNodePdf(
  node: HTMLElement,
  filename: string,
): Promise<void> {
  // Temporarily make overflow visible so html2canvas can see content below
  // the fold, then capture at scale 1.5 (good quality without a huge canvas).
  const savedScroll = node.scrollTop;
  const savedOverflow = node.style.overflow;
  node.scrollTop = 0;
  node.style.overflow = "visible";

  let canvas: HTMLCanvasElement;
  try {
    canvas = await captureNode(node, { scale: 1.5 });
  } finally {
    node.style.overflow = savedOverflow;
    node.scrollTop = savedScroll;
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();   // 210 mm
  const pageH = pdf.internal.pageSize.getHeight();  // 297 mm

  // How many mm per canvas pixel (based on width mapping).
  const mmPerPx = pageW / canvas.width;
  // How tall one A4 page is in canvas pixels.
  const pageHeightPx = Math.round(pageH / mmPerPx);

  const totalPages = Math.ceil(canvas.height / pageHeightPx);
  const bgColor = resolveVar("--background", "#ffffff");

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) pdf.addPage();

    const srcY = i * pageHeightPx;
    const sliceH = Math.min(pageHeightPx, canvas.height - srcY);

    // Draw only this page's slice onto a fresh canvas, padded to full A4
    // height so jsPDF always receives a fixed-size image.
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = pageHeightPx;
    const ctx = slice.getContext("2d")!;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(
      canvas,
      0, srcY, canvas.width, sliceH,   // source rect
      0, 0,   canvas.width, sliceH,    // dest rect (top of slice canvas)
    );

    // Add this slice to the PDF page. sliceHeightMm < pageH on the last page
    // — white space fills the rest automatically.
    const sliceHeightMm = sliceH * mmPerPx;
    pdf.addImage(
      slice.toDataURL("image/jpeg", 0.9),
      "JPEG",
      0, 0,
      pageW, sliceHeightMm,
    );
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
