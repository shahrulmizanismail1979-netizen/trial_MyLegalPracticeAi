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
 * Why page.setContent() instead of navigating to MyLitAI:
 *   The portal requires an authenticated lit.sid session that cannot be minted
 *   headlessly in CI.  The assertion we care about is pure CSS geometry, so an
 *   isolated HTML fixture is both faster and more reliable.
 *
 * Two scenarios are checked:
 *   1. CONFORMING layout — toast uses `bottom: 96px` (bottom-24).  The FAB must
 *      NOT intersect any other fixed element.  ✅
 *   2. VIOLATION layout  — a badge uses `bottom: 24px` (bottom-6), which is the
 *      exact pattern the convention forbids.  The intersection check MUST catch
 *      it, proving the detector is not a vacuous pass.  ✅ (expected intersection)
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
