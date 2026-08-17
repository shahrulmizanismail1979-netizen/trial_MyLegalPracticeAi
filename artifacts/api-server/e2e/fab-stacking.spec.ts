/**
 * FAB stacking regression test
 *
 * Guards against fixed-position elements colliding with the Amani virtual-
 * paralegal FAB (`aria-label="Open virtual paralegal"`) on a 375 × 812 px
 * mobile viewport.
 *
 * The FAB geometry (from lib/paralegal-widget/src/index.tsx):
 *   position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px
 *
 * Convention (from lib/paralegal-widget/FAB_LAYOUT_CONVENTION.md):
 *   Any other fixed element that could appear in the bottom-right area MUST use
 *   bottom ≥ 96px (Tailwind: bottom-24) so it sits above the FAB's top edge
 *   (80px) plus a 16px safety gap.
 *
 * Why page.setContent() instead of navigating to real portal pages:
 *   The portals require authenticated sessions (lit.sid, crim.sid, sya.sid)
 *   that cannot be minted headlessly in CI.  The fixtures mirror the exact CSS
 *   geometry taken from each portal's source — same computed pixel values that
 *   Tailwind produces — so they are functionally equivalent for layout testing.
 *   See .agents/memory/playwright-e2e-replit.md for the auth constraint.
 *
 * Scenarios:
 *   1. CONFORMING layout — toast uses `bottom: 96px` (bottom-24).  FAB must
 *      NOT intersect any other fixed element.  ✅
 *   2. VIOLATION layout  — a badge uses `bottom: 24px` (bottom-6), which is the
 *      exact pattern the convention forbids.  Intersection check MUST catch it. ✅
 *   3. MyLitAI case-law detail page — toast at bottom-24 right-6 (line 271 of
 *      artifacts/mylitai/src/pages/CaseLaw.tsx) with FAB both present.  ✅
 *   4. MyCrimAI case-law page — toast at bottom-24 right-6 (line 232 of
 *      artifacts/mycrimai/src/pages/workspace/case-law.tsx) plus the
 *      RateLimitWarning banner at bottom-24 left-1/2.  ✅
 *   5. MySyariahAI case-law page — toast at bottom-24 right-6 (line 200 of
 *      artifacts/mysyariahai/src/pages/CaseLawPage.tsx) plus the Toaster
 *      component (fixed top-0 on mobile).  ✅
 */

import { test, expect, Page } from "@playwright/test";

const VIEWPORT = { width: 375, height: 812 };

/** Bounding-rect of every element with position:fixed on the page. */
interface Rect {
  label: string;
  top: number;
  left: number;
  bottom: number;
  right: number;
}

async function getFixedRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const rects: {
      label: string;
      top: number;
      left: number;
      bottom: number;
      right: number;
    }[] = [];

    document.querySelectorAll("*").forEach((el) => {
      const style = window.getComputedStyle(el);
      if (style.position !== "fixed") return;
      const r = el.getBoundingClientRect();
      // Skip zero-size elements (e.g. hidden portals, ::before pseudo-elements
      // that browsers don't expose to querySelectorAll).
      if (r.width === 0 && r.height === 0) return;
      const label =
        el.getAttribute("aria-label") ??
        el.getAttribute("data-testid") ??
        el.tagName.toLowerCase() +
          (el.id ? `#${el.id}` : "") +
          (el.className
            ? `.${String(el.className).trim().split(/\s+/).slice(0, 2).join(".")}`
            : "");
      rects.push({
        label,
        top: r.top,
        left: r.left,
        bottom: r.bottom,
        right: r.right,
      });
    });

    return rects;
  });
}

function intersects(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/** Build a minimal page that mimics a portal with the Amani FAB. */
function buildPage(extraFixedElements: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0e0e0e; color: #f3efe6; font-family: system-ui, sans-serif; min-height: 100vh; }
  </style>
</head>
<body>
  <!-- Page content placeholder -->
  <div style="padding: 24px;">
    <h1>Case Law</h1>
    <p>Search results would appear here.</p>
  </div>

  <!-- Amani FAB — exact geometry from lib/paralegal-widget/src/index.tsx -->
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

  ${extraFixedElements}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Scenario 1 — CONFORMING layout
// The toast uses bottom-24 (96 px) as required by the convention.
// ---------------------------------------------------------------------------
test.describe("FAB stacking — conforming layout (375 × 812)", () => {
  test.use({ viewport: VIEWPORT });

  test("Amani FAB does not intersect a bottom-24 toast", async ({ page }) => {
    const html = buildPage(`
      <!-- Toast at bottom-24 (96 px) — correct per FAB_LAYOUT_CONVENTION.md -->
      <div
        data-testid="toast"
        style="
          position: fixed;
          bottom: 96px;
          right: 24px;
          z-index: 50;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          width: 220px;
        "
      >Citation copied!</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const rects = await getFixedRects(page);
    const fab = rects.find((r) => r.label === "Open virtual paralegal");
    expect(fab, "FAB must be present in the DOM").toBeDefined();

    const others = rects.filter((r) => r.label !== "Open virtual paralegal");
    expect(others.length, "At least one other fixed element must be present").toBeGreaterThan(0);

    const collisions = others.filter((el) => intersects(fab!, el));
    expect(
      collisions,
      `FAB collides with: ${collisions.map((c) => c.label).join(", ")}\n` +
        `FAB rect: top=${fab!.top.toFixed(0)} bottom=${fab!.bottom.toFixed(0)} left=${fab!.left.toFixed(0)} right=${fab!.right.toFixed(0)}\n` +
        collisions
          .map(
            (c) =>
              `  ${c.label}: top=${c.top.toFixed(0)} bottom=${c.bottom.toFixed(0)} left=${c.left.toFixed(0)} right=${c.right.toFixed(0)}`
          )
          .join("\n")
    ).toHaveLength(0);
  });

  test("Amani FAB does not intersect a centered bottom-24 rate-limit banner", async ({
    page,
  }) => {
    // Centered banners are wide enough to reach the FAB at 375 px viewport
    // — they must also respect the 96 px floor (see FAB_LAYOUT_CONVENTION.md §Centered banners).
    const html = buildPage(`
      <!-- Rate-limit banner centred at the bottom — correct placement -->
      <div
        data-testid="rate-limit-banner"
        style="
          position: fixed;
          bottom: 96px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          background: #1a1a2e;
          border: 1px solid #4a4a8a;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 13px;
          width: calc(100% - 2rem);
          max-width: 360px;
        "
      >You have used 90 % of your daily AI quota.</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const rects = await getFixedRects(page);
    const fab = rects.find((r) => r.label === "Open virtual paralegal");
    expect(fab, "FAB must be present in the DOM").toBeDefined();

    const others = rects.filter((r) => r.label !== "Open virtual paralegal");
    const collisions = others.filter((el) => intersects(fab!, el));
    expect(
      collisions,
      `FAB collides with: ${collisions.map((c) => c.label).join(", ")}`
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — VIOLATION layout (detector self-test)
// An element placed at bottom-6 (24 px) overlaps the FAB.
// This test asserts the detector catches it, proving the check is not trivially
// green.
// ---------------------------------------------------------------------------
test.describe("FAB stacking — violation detector self-test (375 × 812)", () => {
  test.use({ viewport: VIEWPORT });

  test("detector catches a bottom-6 element that violates the clearance rule", async ({
    page,
  }) => {
    const html = buildPage(`
      <!-- ❌ Incorrectly positioned at bottom-6 (24 px) — violates convention -->
      <div
        data-testid="bad-badge"
        style="
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 50;
          background: #c0392b;
          color: #fff;
          border-radius: 6px;
          padding: 8px 14px;
          font-size: 13px;
          width: 160px;
        "
      >3 unread alerts</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const rects = await getFixedRects(page);
    const fab = rects.find((r) => r.label === "Open virtual paralegal");
    expect(fab, "FAB must be present in the DOM").toBeDefined();

    const others = rects.filter((r) => r.label !== "Open virtual paralegal");
    const collisions = others.filter((el) => intersects(fab!, el));

    // The bad-badge MUST be detected as a collision — if this assertion fails it
    // means the intersection logic is broken and both passing tests above are
    // giving false confidence.
    expect(
      collisions.length,
      "Detector must catch the bottom-6 element overlapping the FAB"
    ).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — MyLitAI case-law detail page (portal-specific fixture)
//
// Source: artifacts/mylitai/src/pages/CaseLaw.tsx line 271
//   {toast && <div className="fixed bottom-24 right-6 bg-card border border-border
//     rounded-lg px-4 py-3 shadow-xl text-sm flex items-center gap-2 z-50">
//     <Check ... />{toast}</div>}
//
// The portal requires an authenticated lit.sid session that cannot be minted
// headlessly in CI, so we use page.setContent() with the exact computed CSS
// values that Tailwind produces for those classes:
//   bottom-24  → bottom: 96px
//   right-6    → right: 24px
//   z-50       → z-index: 50
//   px-4 py-3  → padding: 12px 16px
// ---------------------------------------------------------------------------
test.describe("FAB stacking — MyLitAI case-law detail page fixture (375 × 812)", () => {
  test.use({ viewport: VIEWPORT });

  test("citation-copied toast (bottom-24 right-6) does not overlap the FAB", async ({
    page,
  }) => {
    // Mirrors the case-law detail view rendered by CaseLaw.tsx when the user
    // clicks "Copy Citation" and the toast state is truthy.
    const html = buildPage(`
      <!-- Sticky header — position: sticky, not fixed; not captured by getFixedRects -->
      <div style="position: sticky; top: 0; z-index: 30; padding: 12px 16px; background: #111;">
        <h1 style="font-size: 18px;">Abdul Rahman v PP [2021] 4 MLJ 100</h1>
      </div>

      <!--
        Toast: exact geometry from CaseLaw.tsx line 271
          className="fixed bottom-24 right-6 … z-50"
          bottom-24 = 96px, right-6 = 24px
      -->
      <div
        data-testid="mylitai-citation-toast"
        style="
          position: fixed;
          bottom: 96px;
          right: 24px;
          z-index: 50;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
          width: auto;
          max-width: 220px;
          white-space: nowrap;
        "
      >✓ Citation copied!</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const rects = await getFixedRects(page);
    const fab = rects.find((r) => r.label === "Open virtual paralegal");
    expect(fab, "FAB must be present in the DOM").toBeDefined();

    const others = rects.filter((r) => r.label !== "Open virtual paralegal");
    expect(others.length, "MyLitAI toast must be present").toBeGreaterThan(0);

    const collisions = others.filter((el) => intersects(fab!, el));
    expect(
      collisions,
      `FAB collides with: ${collisions.map((c) => c.label).join(", ")}\n` +
        `FAB rect: bottom=${fab!.bottom.toFixed(0)}\n` +
        collisions.map((c) => `  ${c.label}: top=${c.top.toFixed(0)} bottom=${c.bottom.toFixed(0)}`).join("\n")
    ).toHaveLength(0);
  });

  test("save-to-matter toast (bottom-24 right-6) does not overlap the FAB", async ({
    page,
  }) => {
    // Mirrors the toast rendered after saveToMatter() succeeds (CaseLaw.tsx line 151).
    const html = buildPage(`
      <div
        data-testid="mylitai-save-toast"
        style="
          position: fixed;
          bottom: 96px;
          right: 24px;
          z-index: 50;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
          white-space: nowrap;
        "
      >✓ Saved to matter file!</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const rects = await getFixedRects(page);
    const fab = rects.find((r) => r.label === "Open virtual paralegal");
    expect(fab, "FAB must be present in the DOM").toBeDefined();

    const others = rects.filter((r) => r.label !== "Open virtual paralegal");
    const collisions = others.filter((el) => intersects(fab!, el));
    expect(
      collisions,
      `FAB collides with: ${collisions.map((c) => c.label).join(", ")}`
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 4 — MyCrimAI case-law page (portal-specific fixture)
//
// Sources:
//   artifacts/mycrimai/src/pages/workspace/case-law.tsx line 232
//     {toast && <div className="fixed bottom-24 right-6 … z-50">…</div>}
//   artifacts/mycrimai/src/components/RateLimitWarning.tsx line 27
//     "fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
//     (centered banner; at 375 px it extends ~359 px from left — must use bottom-24)
//
// Both elements are rendered simultaneously when the user has used 90 %+ of
// their daily quota and then copies a citation.
// ---------------------------------------------------------------------------
test.describe("FAB stacking — MyCrimAI case-law page fixture (375 × 812)", () => {
  test.use({ viewport: VIEWPORT });

  test("citation-copied toast (bottom-24 right-6) does not overlap the FAB", async ({
    page,
  }) => {
    // Mirrors case-law.tsx line 232 — same CSS as MyLitAI.
    const html = buildPage(`
      <div
        data-testid="mycrimai-citation-toast"
        style="
          position: fixed;
          bottom: 96px;
          right: 24px;
          z-index: 50;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        "
      >✓ Citation copied!</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const rects = await getFixedRects(page);
    const fab = rects.find((r) => r.label === "Open virtual paralegal");
    expect(fab, "FAB must be present in the DOM").toBeDefined();

    const others = rects.filter((r) => r.label !== "Open virtual paralegal");
    expect(others.length, "MyCrimAI toast must be present").toBeGreaterThan(0);

    const collisions = others.filter((el) => intersects(fab!, el));
    expect(
      collisions,
      `FAB collides with: ${collisions.map((c) => c.label).join(", ")}`
    ).toHaveLength(0);
  });

  test("rate-limit banner (bottom-24 centered) does not overlap the FAB", async ({
    page,
  }) => {
    // Mirrors RateLimitWarning.tsx line 27.
    // At 375 px a calc(100% - 2rem) / max-w-sm banner reaches ~343 px from the
    // left edge, which would clip the FAB's left side if placed at bottom-6.
    const html = buildPage(`
      <div
        data-testid="mycrimai-rate-limit-banner"
        style="
          position: fixed;
          bottom: 96px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          background: #1a1a2e;
          border: 1px solid #4a4a8a;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 13px;
          width: calc(100% - 2rem);
          max-width: 360px;
        "
      >You have used 90% of your daily AI quota.</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const rects = await getFixedRects(page);
    const fab = rects.find((r) => r.label === "Open virtual paralegal");
    expect(fab, "FAB must be present in the DOM").toBeDefined();

    const others = rects.filter((r) => r.label !== "Open virtual paralegal");
    const collisions = others.filter((el) => intersects(fab!, el));
    expect(
      collisions,
      `FAB collides with: ${collisions.map((c) => c.label).join(", ")}`
    ).toHaveLength(0);
  });

  test("toast + rate-limit banner together do not overlap the FAB", async ({
    page,
  }) => {
    // Worst-case concurrent state: both the citation-copied toast (right-aligned)
    // and the rate-limit banner (centered) are visible simultaneously.
    const html = buildPage(`
      <div
        data-testid="mycrimai-citation-toast"
        style="
          position: fixed;
          bottom: 96px;
          right: 24px;
          z-index: 50;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          white-space: nowrap;
        "
      >✓ Citation copied!</div>

      <div
        data-testid="mycrimai-rate-limit-banner"
        style="
          position: fixed;
          bottom: 96px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          background: #1a1a2e;
          border: 1px solid #4a4a8a;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 13px;
          width: calc(100% - 2rem);
          max-width: 360px;
        "
      >You have used 90% of your daily AI quota.</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const rects = await getFixedRects(page);
    const fab = rects.find((r) => r.label === "Open virtual paralegal");
    expect(fab, "FAB must be present in the DOM").toBeDefined();

    const others = rects.filter((r) => r.label !== "Open virtual paralegal");
    expect(others.length, "Both fixed elements must be present").toBe(2);

    const collisions = others.filter((el) => intersects(fab!, el));
    expect(
      collisions,
      `FAB collides with: ${collisions.map((c) => c.label).join(", ")}`
    ).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Scenario 5 — MySyariahAI case-law page (portal-specific fixture)
//
// Sources:
//   artifacts/mysyariahai/src/pages/CaseLawPage.tsx line 200
//     {toast && <div className="fixed bottom-24 right-6 … z-50">…</div>}
//   artifacts/mysyariahai/src/components/RateLimitWarning.tsx line 27
//     "fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
//   artifacts/mysyariahai/src/components/ui/toast.tsx line 17
//     ToastViewport: "fixed top-0 z-[100] … sm:bottom-0 sm:right-0 sm:top-auto …"
//     At 375 px (< sm breakpoint 640 px) this renders at top-0, not bottom.
// ---------------------------------------------------------------------------
test.describe("FAB stacking — MySyariahAI case-law page fixture (375 × 812)", () => {
  test.use({ viewport: VIEWPORT });

  test("citation-copied toast (bottom-24 right-6) does not overlap the FAB", async ({
    page,
  }) => {
    // Mirrors CaseLawPage.tsx line 200.
    const html = buildPage(`
      <div
        data-testid="mysyariahai-citation-toast"
        style="
          position: fixed;
          bottom: 96px;
          right: 24px;
          z-index: 50;
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 12px 16px;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
        "
      >✓ Citation copied!</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const rects = await getFixedRects(page);
    const fab = rects.find((r) => r.label === "Open virtual paralegal");
    expect(fab, "FAB must be present in the DOM").toBeDefined();

    const others = rects.filter((r) => r.label !== "Open virtual paralegal");
    expect(others.length, "MySyariahAI toast must be present").toBeGreaterThan(0);

    const collisions = others.filter((el) => intersects(fab!, el));
    expect(
      collisions,
      `FAB collides with: ${collisions.map((c) => c.label).join(", ")}`
    ).toHaveLength(0);
  });

  test("Toaster viewport at mobile (fixed top-0) does not overlap the FAB", async ({
    page,
  }) => {
    // The MySyariahAI Toaster uses shadcn/radix ToastViewport:
    //   "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4
    //    sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
    // At 375 px (below the sm:640px breakpoint) it anchors to top-0, placing
    // it well above the FAB's zone. This fixture verifies that remains true.
    const html = buildPage(`
      <!--
        ToastViewport at 375 px: fixed top-0, full width, max-h-screen.
        The active toast appears at the top — no conflict with bottom-mounted FAB.
        z-[100] = 100 (below FAB's 2147483000 but that does not affect geometry).
      -->
      <div
        data-testid="mysyariahai-toast-viewport"
        style="
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          flex-direction: column-reverse;
          max-height: 100vh;
          width: 100%;
          padding: 16px;
          pointer-events: none;
        "
      >
        <div style="
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 6px;
          padding: 16px 32px 16px 24px;
          font-size: 14px;
          pointer-events: auto;
        ">Saved to matter!</div>
      </div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const rects = await getFixedRects(page);
    const fab = rects.find((r) => r.label === "Open virtual paralegal");
    expect(fab, "FAB must be present in the DOM").toBeDefined();

    const others = rects.filter((r) => r.label !== "Open virtual paralegal");
    expect(others.length, "Toaster viewport must be present").toBeGreaterThan(0);

    const collisions = others.filter((el) => intersects(fab!, el));
    expect(
      collisions,
      `FAB collides with: ${collisions.map((c) => c.label).join(", ")}`
    ).toHaveLength(0);
  });

  test("rate-limit banner (bottom-24 centered) does not overlap the FAB", async ({
    page,
  }) => {
    // Mirrors RateLimitWarning.tsx in MySyariahAI (identical geometry to MyCrimAI).
    const html = buildPage(`
      <div
        data-testid="mysyariahai-rate-limit-banner"
        style="
          position: fixed;
          bottom: 96px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 50;
          background: #1a1a2e;
          border: 1px solid #4a4a8a;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 13px;
          width: calc(100% - 2rem);
          max-width: 360px;
        "
      >You have reached your daily AI usage limit.</div>
    `);

    await page.setContent(html, { waitUntil: "domcontentloaded" });

    const rects = await getFixedRects(page);
    const fab = rects.find((r) => r.label === "Open virtual paralegal");
    expect(fab, "FAB must be present in the DOM").toBeDefined();

    const others = rects.filter((r) => r.label !== "Open virtual paralegal");
    const collisions = others.filter((el) => intersects(fab!, el));
    expect(
      collisions,
      `FAB collides with: ${collisions.map((c) => c.label).join(", ")}`
    ).toHaveLength(0);
  });
});
