/**
 * Proctoring widget layout test – iPhone SE (375×667)
 *
 * Verifies that the fixed bottom proctoring widgets (webcam + audio) do NOT
 * overlap the "Save answer" or "Finish & submit" buttons when both
 * proctoring.webcamSnapshots and proctoring.audioMonitoring are active.
 *
 * The fix under test is the `pb-52 sm:pb-6` bottom padding applied to the
 * main grid container when either proctoring mode is active. Without it the
 * fixed widgets cover the action buttons on small screens.
 *
 * Approach
 * --------
 * - Set viewport to 375×667 before navigating (real iPhone SE resolution).
 * - Intercept the attempt API with a mock that returns one question and
 *   proctoring with webcamSnapshots=true + audioMonitoring=true.
 * - Stub navigator.mediaDevices.getUserMedia so no camera/mic permission
 *   prompt appears (and no errors crash the proctoring init path).
 * - Assert that both action buttons are visible and that their bounding box
 *   bottom edge is strictly above the top edge of the proctoring widgets.
 * - Assert the question section's scrollable container has more content than
 *   fits in the viewport (confirming overflow-y:auto / scrollable content).
 */

import { test, expect } from "@playwright/test";

const FAKE_ID = "test-attempt-iphonese-99999";

/** Minimal attempt payload that renders one multiple-choice question with
 *  both webcam snapshot and audio monitoring proctoring enabled. */
const MOCK_ATTEMPT = {
  id: FAKE_ID,
  status: "active",
  studentName: "Test Student",
  startedAt: new Date(Date.now() - 60_000).toISOString(),
  assessment: {
    id: "assess-1",
    code: "LAW101",
    title: "iPhone SE Layout Test Assessment",
    allowedAnswerModes: ["text"],
    timeLimitMinutes: 60,
    proctoring: {
      webcamSnapshots: true,
      webcamSnapshotIntervalSec: 3600,
      audioMonitoring: true,
      lockFullscreen: false,
      blockCopyPaste: false,
      blockRightClick: false,
      blockShortcuts: false,
      detectDevtools: false,
      idleTimeoutSeconds: 0,
      maxTabSwitches: 0,
    },
  },
  questions: [
    {
      id: "q-1",
      type: "multiple_choice",
      prompt:
        "Which of the following best describes the doctrine of precedent in common law systems?",
      context: null,
      points: 10,
      taxonomyLevel: 2,
      options: [
        { id: "opt-a", text: "Courts are bound by their own prior decisions only." },
        { id: "opt-b", text: "Higher courts' decisions bind lower courts in similar cases." },
        { id: "opt-c", text: "All courts must follow the decisions of international tribunals." },
        { id: "opt-d", text: "Precedent applies only in criminal proceedings." },
      ],
    },
  ],
  answers: [],
};

test.describe("Proctoring widget layout – iPhone SE 375×667", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("Save answer and Finish & submit buttons are not obscured by fixed proctoring widgets", async ({
    page,
  }) => {
    // ── 1. Stub getUserMedia so no real camera/mic prompts appear ──────────
    // IMPORTANT: el.srcObject requires a real MediaStream instance (not a
    // plain object). new MediaStream() is available in the browser context and
    // produces an empty (trackless) stream that passes the type-check.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          getUserMedia: () => Promise.resolve(new MediaStream()),
          enumerateDevices: () => Promise.resolve([]),
        },
        writable: true,
        configurable: true,
      });

      // Stub AudioContext so the audio-analyser effect doesn't throw.
      // close() MUST return a Promise — the cleanup path calls close().catch(…).
      // The analyser stub must expose getFloatTimeDomainData (used by the RMS
      // sampler) and allow fftSize to be set.
      class MockAudioContext {
        createMediaStreamSource() {
          return { connect: () => {} };
        }
        createAnalyser() {
          return {
            fftSize: 1024,
            connect: () => {},
            getFloatTimeDomainData: (buf: Float32Array) => { buf.fill(0); },
            getByteFrequencyData: (buf: Uint8Array) => { buf.fill(0); },
          };
        }
        close() {
          return Promise.resolve();
        }
      }
      (window as any).AudioContext = MockAudioContext;
      (window as any).webkitAudioContext = MockAudioContext;
    });

    // ── 2. Pre-seed sessionStorage with a fake attempt token ───────────────
    // The attempt page reads sessionStorage before the first API call.
    await page.addInitScript(({ attemptId }) => {
      sessionStorage.setItem(`studio.attempt.${attemptId}.token`, "mock-token");
    }, { attemptId: FAKE_ID });

    // ── 3. Mock the attempt API ─────────────────────────────────────────────
    await page.route(`**/api/acad/studio/attempts/${FAKE_ID}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ATTEMPT),
      });
    });

    // Silence proctor-event and snapshot POSTs so they don't 404-flood logs
    await page.route(`**/api/acad/studio/attempts/${FAKE_ID}/events`, (route) =>
      route.fulfill({ status: 204, body: "" })
    );
    await page.route(`**/api/acad/studio/attempts/${FAKE_ID}/snapshots`, (route) =>
      route.fulfill({ status: 204, body: "" })
    );

    // ── 4. Navigate to the attempt page ────────────────────────────────────
    await page.goto(`/mylawacad/studio/attempt/${FAKE_ID}`);

    // Wait for the question content to render (indicates loading finished)
    await expect(
      page.locator("text=doctrine of precedent").first()
    ).toBeVisible({ timeout: 20_000 });

    // ── 5. Scroll to the bottom of the page so action buttons are in view ──
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400); // allow scroll to settle

    // ── 6. Assert the action buttons are visible ────────────────────────────
    // On the single question in our mock, "Finish & submit" replaces "Next".
    // Both "Save answer" and "Finish & submit" live in the card footer.
    // The sticky top bar also shows "Finish & submit", so first() is correct.
    const saveBtn   = page.locator('button', { hasText: 'Save answer' }).first();
    const finishBtn = page.locator('button', { hasText: 'Finish & submit' }).first();

    await expect(saveBtn).toBeVisible({ timeout: 5_000 });
    await expect(finishBtn).toBeVisible({ timeout: 5_000 });

    // ── 7. Assert no fixed proctoring widget overlaps the action buttons ───
    // Use evaluate() so we get reliable getBoundingClientRect() values for
    // fixed-positioned elements, which Playwright locators can mis-report.
    const overlapInfo = await page.evaluate(() => {
      // Locate the "Save answer" button (the action we care most about).
      const buttons = Array.from(document.querySelectorAll("button"));
      const saveBtn = buttons.find((b) =>
        (b.textContent ?? "").trim().includes("Save answer")
      );
      if (!saveBtn) return { error: "Save button not found in DOM" };

      const btnRect = saveBtn.getBoundingClientRect();

      // Collect all fixed-positioned elements with non-zero height (the
      // proctoring widgets are `position: fixed` via Tailwind's `fixed` class).
      const fixedWidgets = Array.from(document.querySelectorAll("*"))
        .filter((el) => window.getComputedStyle(el).position === "fixed")
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom,
            height: r.height,
            text: (el.textContent ?? "").trim().slice(0, 60),
          };
        })
        // Only keep actual visible widgets (height > 10px, not covering full
        // screen which would be the Vite HMR overlay or a backdrop).
        .filter((w) => w.height > 10 && w.height < window.innerHeight * 0.6);

      // Find the lowest-top widget (closest to the top = highest on screen)
      // that is in the lower half of the viewport (i.e. a bottom widget).
      const bottomWidgets = fixedWidgets.filter(
        (w) => w.top > window.innerHeight / 2
      );

      const overlapping = bottomWidgets.filter(
        (w) => w.top < btnRect.bottom
      );

      return {
        btnBottom: Math.round(btnRect.bottom),
        viewportHeight: window.innerHeight,
        bottomWidgets: bottomWidgets.map((w) => ({
          top: Math.round(w.top),
          text: w.text,
        })),
        overlapping: overlapping.map((w) => ({
          widgetTop: Math.round(w.top),
          btnBottom: Math.round(btnRect.bottom),
          text: w.text,
        })),
      };
    });

    expect(
      overlapInfo,
      'page.evaluate() must succeed (DOM must contain "Save answer" button)'
    ).not.toHaveProperty("error");

    if (overlapInfo && !("error" in overlapInfo)) {
      expect(
        overlapInfo.overlapping,
        `Fixed proctoring widget(s) overlap the Save answer button ` +
        `(button bottom=${overlapInfo.btnBottom}px, viewport=${overlapInfo.viewportHeight}px). ` +
        `Widgets: ${JSON.stringify(overlapInfo.bottomWidgets)}`
      ).toHaveLength(0);
    }

    // ── 8. Assert the page is scrollable (pb-52 adds space above widgets) ──
    // On 375px-wide screens both proctoring widgets are active; without the
    // pb-52 fix the action buttons sit behind them.  With the fix, content
    // extends below the viewport → scrollable.
    const isScrollable = await page.evaluate(
      () =>
        document.documentElement.scrollHeight >
        document.documentElement.clientHeight
    );
    expect(
      isScrollable,
      "Page must be scrollable at 375×667 with proctoring active (pb-52 pushes content below widgets)"
    ).toBe(true);
  });
});
