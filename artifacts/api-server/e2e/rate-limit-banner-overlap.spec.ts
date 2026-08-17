/**
 * Layout regression test: RateLimitWarning banner must not overlap the
 * CaseLaw toast (formerly at bottom-24, now at bottom-40) or the virtual-
 * paralegal FAB on a 375 × 667 iPhone SE viewport.
 *
 * Background
 * ----------
 * RateLimitWarning (artifacts/mylitai/src/components/RateLimitWarning.tsx,
 *                   artifacts/mycrimai/src/components/RateLimitWarning.tsx)
 *   position: fixed; left: 50%; transform: translateX(-50%);
 *   bottom: calc(6rem + env(safe-area-inset-bottom, 0px));   ← 96 px on iPhone SE
 *   width: calc(100% - 2rem); max-width: 24rem;
 *   padding: 0.75rem 1rem;                                   ← ~52 px rendered height
 *
 * CaseLaw toast (artifacts/mylitai/src/pages/CaseLaw.tsx,
 *                artifacts/mycrimai/src/pages/workspace/case-law.tsx)
 *   BEFORE FIX: fixed bottom-24 right-6   = bottom: 96 px  ← same band as banner!
 *   AFTER FIX:  fixed bottom-40 right-6   = bottom: 160 px ← clear of the banner
 *
 * Virtual paralegal FAB (lib/paralegal-widget/src/index.tsx)
 *   position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px
 *
 * Why page.setContent():
 *   The portals require auth (lit.sid / crim.sid) that cannot be minted
 *   headlessly.  The concern is pure CSS geometry, so a minimal HTML fixture
 *   is both faster and deterministic.
 */

import { test, expect, Page } from "@playwright/test";

// iPhone SE dimensions
const VIEWPORT = { width: 375, height: 667 };

/* ── Geometry helpers ───────────────────────────────────────────────────── */

interface Rect {
  label: string;
  top: number;
  left: number;
  bottom: number;
  right: number;
}

async function getFixedRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const rects: Rect[] = [];
    document.querySelectorAll<Element>("*").forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.position !== "fixed") return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      const label =
        el.getAttribute("data-testid") ??
        el.getAttribute("aria-label") ??
        el.tagName.toLowerCase() + (el.id ? `#${el.id}` : "");
      rects.push({ label, top: r.top, left: r.left, bottom: r.bottom, right: r.right });
    });
    return rects;
  });
}

function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/* ── Shared HTML fixture ────────────────────────────────────────────────── */

/**
 * Builds a minimal page containing:
 *   - RateLimitWarning banner (exact CSS from the component)
 *   - Virtual paralegal FAB (exact CSS from lib/paralegal-widget)
 *   - `extraElements` injected by each test scenario
 */
function buildPage(extraElements: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f0f0f; color: #f3efe6; font-family: system-ui, sans-serif; min-height: 100vh; }
  </style>
</head>
<body>
  <div style="padding: 24px;"><h1>Case Law</h1><p>Case detail view.</p></div>

  <!--
    RateLimitWarning — exact geometry from:
      artifacts/mylitai/src/components/RateLimitWarning.tsx
      artifacts/mycrimai/src/components/RateLimitWarning.tsx

    bottom: calc(6rem + env(safe-area-inset-bottom, 0px))
    Playwright has no safe-area env so env() resolves to 0px → bottom: 96px.

    Tailwind classes reproduced as inline styles:
      fixed left-1/2 -translate-x-1/2 z-50
      max-w-sm w-[calc(100%-2rem)] sm:max-w-md
      px-4 py-3 rounded-lg
  -->
  <div
    data-testid="rate-limit-banner"
    style="
      position: fixed;
      bottom: calc(6rem + env(safe-area-inset-bottom, 0px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 50;
      width: calc(100% - 2rem);
      max-width: 24rem;
      padding: 0.75rem 1rem;
      background: #fef3c7;
      border: 1px solid #fcd34d;
      border-radius: 0.5rem;
      font-size: 0.875rem;
    "
  >⚠ You're approaching your AI request limit — 5 requests left this minute.</div>

  <!--
    Virtual paralegal FAB — exact geometry from lib/paralegal-widget/src/index.tsx
    position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px
  -->
  <button
    aria-label="Open virtual paralegal"
    style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 2147483000;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #8a6d2f;
      border: none;
      cursor: pointer;
    "
  >VP</button>

  ${extraElements}
</body>
</html>`;
}

/* ── Test suite ─────────────────────────────────────────────────────────── */

test.describe("RateLimitWarning banner overlap — iPhone SE (375 × 667)", () => {
  test.use({ viewport: VIEWPORT });

  // ── Scenario 1: CONFORMING — toast at bottom-40 (after fix) ────────────
  test("banner does not overlap CaseLaw toast at bottom-40 (fixed layout)", async ({ page }) => {
    const html = buildPage(`
      <!--
        CaseLaw toast AFTER FIX:
          artifacts/mylitai/src/pages/CaseLaw.tsx  line ~271
          artifacts/mycrimai/src/pages/workspace/case-law.tsx  line ~232
        class="fixed bottom-40 right-6 ..."
        bottom-40 = 10rem = 160px; right-6 = 1.5rem = 24px
      -->
      <div
        data-testid="case-law-toast"
        style="
          position: fixed;
          bottom: 10rem;
          right: 1.5rem;
          z-index: 50;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          white-space: nowrap;
        "
      >✓ Saved to matter file!</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const rects = await getFixedRects(page);

    const banner = rects.find((r) => r.label === "rate-limit-banner");
    const toast  = rects.find((r) => r.label === "case-law-toast");

    expect(banner, "rate-limit-banner must be in the DOM").toBeDefined();
    expect(toast,  "case-law-toast must be in the DOM").toBeDefined();

    const overlap = intersects(banner!, toast!);

    if (overlap) {
      console.error(
        `OVERLAP on 375×667:\n` +
        `  banner top=${banner!.top.toFixed(1)} bottom=${banner!.bottom.toFixed(1)} ` +
                  `left=${banner!.left.toFixed(1)} right=${banner!.right.toFixed(1)}\n` +
        `  toast  top=${toast!.top.toFixed(1)}  bottom=${toast!.bottom.toFixed(1)}  ` +
                  `left=${toast!.left.toFixed(1)}  right=${toast!.right.toFixed(1)}`,
      );
    }

    expect(overlap, "banner must not overlap the case-law toast on iPhone SE").toBe(false);
  });

  // ── Scenario 2: CONFORMING — banner vs. virtual paralegal FAB ──────────
  test("banner does not overlap the virtual paralegal FAB", async ({ page }) => {
    const html = buildPage("<!-- no extra elements needed; FAB is already in fixture -->");

    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const rects = await getFixedRects(page);

    const banner = rects.find((r) => r.label === "rate-limit-banner");
    const fab    = rects.find((r) => r.label === "Open virtual paralegal");

    expect(banner, "rate-limit-banner must be in the DOM").toBeDefined();
    expect(fab,    "virtual paralegal FAB must be in the DOM").toBeDefined();

    const overlap = intersects(banner!, fab!);
    expect(overlap, "banner must not overlap the virtual paralegal FAB on iPhone SE").toBe(false);
  });

  // ── Scenario 3: VIOLATION self-test (toast at old bottom-24) ──────────
  // Proves the intersection detector is not vacuously green.
  // This reproduces the bug BEFORE the fix so the test proves the detector
  // catches it.
  test("detector catches the pre-fix layout: toast at bottom-24 overlaps banner", async ({
    page,
  }) => {
    const html = buildPage(`
      <!--
        INTENTIONAL VIOLATION — reproduces the broken layout before the fix.
        Old CaseLaw toast used: class="fixed bottom-24 right-6 ..."
        bottom-24 = 6rem = 96px — exactly the same bottom as the banner.
      -->
      <div
        data-testid="bad-toast-bottom-24"
        style="
          position: fixed;
          bottom: 6rem;
          right: 1.5rem;
          z-index: 50;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          white-space: nowrap;
        "
      >✓ Saved to matter file!</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });
    const rects = await getFixedRects(page);

    const banner   = rects.find((r) => r.label === "rate-limit-banner");
    const badToast = rects.find((r) => r.label === "bad-toast-bottom-24");

    expect(banner,   "rate-limit-banner must be in the DOM").toBeDefined();
    expect(badToast, "bad toast must be in the DOM").toBeDefined();

    const overlap = intersects(banner!, badToast!);

    // This MUST be true — if it's false the intersection logic is broken and
    // the two passing tests above give false confidence.
    expect(
      overlap,
      "Detector must catch the pre-fix bottom-24 toast overlapping the banner"
    ).toBe(true);
  });
});
