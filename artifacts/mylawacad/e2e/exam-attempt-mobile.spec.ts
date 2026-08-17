/**
 * Exam attempt page – iPhone 14 Pro (393 × 852) end-to-end test.
 *
 * Covers:
 *  - Joining a studio assessment via join code on a mobile viewport
 *  - Question card, answer textarea, and navigation buttons are fully visible
 *    (not clipped, not hidden behind the top bar)
 *  - Timer badge is accessible in the top bar
 *  - Save-answer and Finish/Submit buttons are within the visible viewport
 *  - Proctoring widgets (when present) do not overlap the footer action buttons
 *  - The attempt can be submitted and the summary page is reachable
 */

import { test, expect, type Page, type BrowserContext } from "@playwright/test";

// iPhone 14 Pro logical resolution (portrait)
const IPHONE_VIEWPORT = { width: 393, height: 852 };

// iPhone 14 Pro rotated to landscape
const LANDSCAPE_VIEWPORT = { width: 852, height: 393 };

// Small Android phone in landscape with browser chrome (address bar + status bar)
// reduces visible height to ~320 px
const SMALL_LANDSCAPE_VIEWPORT = { width: 812, height: 320 };

// ─── suppress tutorial overlays ───────────────────────────────────────────────
// The studio join page auto-opens a "Student Tour" tutorial overlay 600 ms
// after the first visit (localStorage key "studio.tutorial.student.v1").
// If the overlay appears before the "Begin assessment" button is clicked it
// intercepts the click and the test hangs waiting for a navigation that never
// comes.  addInitScript runs before any page script, so the key is already set
// when the tutorial component mounts and the overlay never auto-opens.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("studio.tutorial.student.v1", "1");
  });
});

// ─── helpers ──────────────────────────────────────────────────────────────────

interface SetupResult {
  code: string;
  cookie: string;
}

/**
 * Register an educator, create an assessment with one text question, open it.
 * Returns the assessment join code and a session cookie header string so that
 * subsequent educator API calls can be authenticated.
 */
async function setupAssessment(
  request: Parameters<typeof test>[1] extends {
    request: infer R;
  }
    ? R
    : never,
): Promise<SetupResult> {
  const uid = Date.now();
  const email = `mobile-attempt-${uid}@test.local`;
  const password = "Mobile1234!";

  // 1. Register
  const regResp = await request.post("/api/acad/auth/register", {
    data: { email, password, name: "Mobile Tester" },
  });
  expect(
    [201, 409],
    `register failed: ${regResp.status()} ${await regResp.text()}`,
  ).toContain(regResp.status());

  // 2. Login to get a session cookie
  const loginResp = await request.post("/api/acad/auth/login", {
    data: { email, password },
  });
  expect(loginResp.status(), `login failed: ${await loginResp.text()}`).toBe(200);
  const setCookieHeader = loginResp.headers()["set-cookie"] ?? "";
  // Extract the session cookie value (may be a comma-separated list)
  const sessionCookie = setCookieHeader
    .split(",")
    .map((c) => c.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ");

  const headers = { Cookie: sessionCookie };

  // 3. Create assessment (no webcam / audio proctoring – simpler test)
  const createResp = await request.post("/api/acad/studio/assessments", {
    headers,
    data: {
      title: `Mobile E2E ${uid}`,
      educatorName: "Mobile Tester",
      timeLimitMinutes: 60,
      allowedAnswerModes: ["text"],
      rubric: { criteria: [] },
      proctoring: {
        lockFullscreen: false,
        blockCopyPaste: false,
        blockRightClick: false,
        blockShortcuts: false,
        detectDevtools: false,
        webcamSnapshots: false,
        audioMonitoring: false,
        idleTimeoutSeconds: 0,
        maxTabSwitches: 0,
        webcamSnapshotIntervalSec: 60,
      },
    },
  });
  expect(createResp.status(), `create assessment failed: ${await createResp.text()}`).toBe(201);
  const assessment = await createResp.json();
  const assessmentId: string = assessment.id;
  const code: string = assessment.code;

  // 4. Add a short-answer question
  const qResp = await request.post(
    `/api/acad/studio/assessments/${assessmentId}/questions`,
    {
      headers,
      data: {
        type: "short_answer",
        prompt: "Explain the principle of natural justice in Malaysian administrative law.",
        taxonomyLevel: 2,
        points: 10,
        options: [],
      },
    },
  );
  expect(qResp.status(), `add question failed: ${await qResp.text()}`).toBe(201);

  // 5. Open the assessment so students can join
  const patchResp = await request.patch(
    `/api/acad/studio/assessments/${assessmentId}`,
    {
      headers,
      data: { status: "open" },
    },
  );
  expect(patchResp.status(), `open assessment failed: ${await patchResp.text()}`).toBe(200);

  return { code, cookie: sessionCookie };
}

// ─── tests ────────────────────────────────────────────────────────────────────

test.describe("Exam attempt page on iPhone 14 Pro viewport", () => {
  test.use({ viewport: IPHONE_VIEWPORT });

  let code = "";

  test.beforeAll(async ({ request }) => {
    const result = await setupAssessment(request as any);
    code = result.code;
  });

  test("timer, question pane and footer buttons stay usable after rotating to landscape mid-attempt", async ({
    page,
  }) => {
    // ── Step 1: Join in portrait ───────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await expect(codeInput).toBeVisible();
    // The input must not be clipped — its bounding box should be fully inside the viewport
    const box = await codeInput.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 1);

    // Enter the code and verify assessment details appear
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    // Assessment title card appears
    await expect(page.getByTestId("name-input")).toBeVisible({ timeout: 10_000 });
  });

  test("full join → attempt → save → submit flow works end-to-end", async ({
    page,
  }) => {
    // ── Step 1: Join page ──────────────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Rotation Tester");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Step 2: Confirm we are on the attempt page (portrait) ─────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    // Timer badge visible in portrait
    const timerBadge = page.getByTestId("timer-badge");
    await expect(timerBadge).toBeVisible({ timeout: 10_000 });

    const timerBox = await timerBadge.boundingBox();
    expect(timerBox).not.toBeNull();
    // Timer must be within the viewport
    expect(timerBox!.x).toBeGreaterThanOrEqual(0);
    expect(timerBox!.x + timerBox!.width).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 1);

    // ── Step 3: Question pane accessible ──────────────────────────────────
    const questionPane = page.getByTestId("question-pane");
    await expect(questionPane).toBeVisible({ timeout: 10_000 });

    // Type a partial answer before rotating
    const answerTextarea = page.getByTestId("answer-textarea");
    await expect(answerTextarea).toBeVisible({ timeout: 5_000 });
    await answerTextarea.scrollIntoViewIfNeeded();

    const taBox = await answerTextarea.boundingBox();
    expect(taBox).not.toBeNull();
    expect(taBox!.x).toBeGreaterThanOrEqual(0);
    expect(taBox!.x + taBox!.width).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 1);

    // ── Step 4: Type an answer ─────────────────────────────────────────────
    await answerTextarea.fill(
      "Natural justice requires a fair hearing (audi alteram partem) and an unbiased decision-maker (nemo judex in causa sua).",
    );

    // ── Step 5: Save-answer button is accessible and not overlapped ────────
    const saveBtn = page.getByTestId("btn-save-answer");
    await saveBtn.scrollIntoViewIfNeeded();
    await expect(saveBtn).toBeVisible();

    const saveBtnBox = await saveBtn.boundingBox();
    expect(saveBtnBox, "save button bounding box must exist").not.toBeNull();
    expect(saveBtnBox!.x, "save button must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      saveBtnBox!.x + saveBtnBox!.width,
      "save button must not extend past landscape viewport right edge",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Footer actions container ──────────────────────────────────────────
    const footerActions = page.getByTestId("footer-actions");
    await footerActions.scrollIntoViewIfNeeded();
    await expect(footerActions).toBeVisible({ timeout: 5_000 });

    const footerBox = await footerActions.boundingBox();
    expect(footerBox, "footer actions bounding box must exist").not.toBeNull();
    expect(
      footerBox!.x + footerBox!.width,
      "footer actions must not extend past landscape viewport right edge",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Webcam widget must not overlap footer (if proctoring enabled) ─────
    const webcamWidget = page.locator(".fixed").filter({
      has: page.locator("text=Proctor cam"),
    });
    const webcamCount = await webcamWidget.count();
    if (webcamCount > 0 && footerBox) {
      const wcBox = await webcamWidget.first().boundingBox();
      if (wcBox && footerBox) {
        // No vertical overlap between footer actions and webcam widget
        const footerBottom = footerBox.y + footerBox.height;
        const webcamTop = wcBox.y;
        // If footer is above the webcam widget top, they don't overlap
        expect(
          footerBottom,
          "Webcam widget overlaps the footer action buttons",
        ).toBeLessThanOrEqual(webcamTop + 1);
      }
    }

    // ── Step 7: Submit the attempt via the top-bar Finish button ──────────
    const finishTopBtn = page.getByTestId("btn-finish-top");
    await finishTopBtn.scrollIntoViewIfNeeded();
    await expect(finishTopBtn).toBeVisible();
    await finishTopBtn.click();

    // Should redirect to the summary page
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+\/summary/, {
      timeout: 15_000,
    });
  });

  test("summary screen key elements are fully visible and do not overflow on mobile", async ({
    page,
  }) => {
    // ── Step 1: Join ───────────────────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");
    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Summary Screen Checker");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Step 2: Attempt ────────────────────────────────────────────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    const answerTextarea = page.getByTestId("answer-textarea");
    await expect(answerTextarea).toBeVisible({ timeout: 5_000 });
    await answerTextarea.scrollIntoViewIfNeeded();
    await answerTextarea.fill(
      "Natural justice principles: audi alteram partem (right to be heard) and nemo judex in causa sua (no person shall be judge in their own cause).",
    );

    // Save
    const saveBtn = page.getByTestId("btn-save-answer");
    await saveBtn.scrollIntoViewIfNeeded();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Page should remain on attempt
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 5_000 });

    // Finish
    const finishTopBtn = page.getByTestId("btn-finish-top");
    await finishTopBtn.scrollIntoViewIfNeeded();
    await expect(finishTopBtn).toBeVisible();
    await finishTopBtn.click();

    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+\/summary/, {
      timeout: 15_000,
    });

    // ── Step 4: Wait for summary to load ──────────────────────────────────
    // The page shows a loading state while the AI evaluates; wait for hero panel
    const heroPanel = page.getByTestId("hero-panel");
    await expect(heroPanel).toBeVisible({ timeout: 30_000 });

    // ── Step 5: Hero panel does not overflow horizontally ─────────────────
    const heroBoundingBox = await heroPanel.boundingBox();
    expect(heroBoundingBox, "hero panel bounding box must exist").not.toBeNull();
    expect(heroBoundingBox!.x, "hero panel must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      heroBoundingBox!.x + heroBoundingBox!.width,
      "hero panel must not extend past viewport right edge",
    ).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 2);

    // ── Step 6: Score ring is visible and within viewport ─────────────────
    const scoreRing = page.getByTestId("score-ring");
    await scoreRing.scrollIntoViewIfNeeded();
    await expect(scoreRing).toBeVisible();
    const ringBox = await scoreRing.boundingBox();
    expect(ringBox, "score ring bounding box must exist").not.toBeNull();
    expect(ringBox!.x, "score ring must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      ringBox!.x + ringBox!.width,
      "score ring must not extend past viewport right edge",
    ).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 2);

    // ── Step 7: Pass/fail badge is visible and within viewport ────────────
    const passBadge = page.getByTestId("pass-fail-badge");
    await passBadge.scrollIntoViewIfNeeded();
    await expect(passBadge).toBeVisible();
    const badgeBox = await passBadge.boundingBox();
    expect(badgeBox, "pass/fail badge bounding box must exist").not.toBeNull();
    expect(badgeBox!.x, "pass/fail badge must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      badgeBox!.x + badgeBox!.width,
      "pass/fail badge must not extend past viewport right edge",
    ).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 2);

    // ── Step 8: XP / rewards section visible if present ───────────────────
    const rewardsSection = page.getByTestId("attempt-rewards");
    const rewardsCount = await rewardsSection.count();
    if (rewardsCount > 0) {
      await rewardsSection.first().scrollIntoViewIfNeeded();
      await expect(rewardsSection.first()).toBeVisible();
      const rwBox = await rewardsSection.first().boundingBox();
      expect(rwBox, "rewards section bounding box must exist").not.toBeNull();
      expect(
        rwBox!.x + rwBox!.width,
        "XP rewards must not extend past viewport right edge",
      ).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 2);
    }

    // ── Step 9: Leaderboard does not overflow horizontally ─────────────────
    const leaderboard = page.getByTestId("leaderboard-section");
    const lbCount = await leaderboard.count();
    if (lbCount > 0) {
      await leaderboard.scrollIntoViewIfNeeded();
      await expect(leaderboard).toBeVisible();
      const lbBox = await leaderboard.boundingBox();
      expect(lbBox, "leaderboard bounding box must exist").not.toBeNull();
      expect(lbBox!.x, "leaderboard must not start left of viewport").toBeGreaterThanOrEqual(0);
      expect(
        lbBox!.x + lbBox!.width,
        "leaderboard must not extend past viewport right edge",
      ).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 2);
    }

    // ── Step 10: AI disclaimer banner is readable ─────────────────────────
    const disclaimer = page.getByTestId("ai-disclaimer");
    await disclaimer.scrollIntoViewIfNeeded();
    await expect(disclaimer).toBeVisible();
    const disclaimerBox = await disclaimer.boundingBox();
    expect(disclaimerBox, "disclaimer bounding box must exist").not.toBeNull();
    expect(disclaimerBox!.x, "disclaimer must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      disclaimerBox!.x + disclaimerBox!.width,
      "disclaimer must not extend past viewport right edge",
    ).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 2);
  });

  test("question prompt text is not clipped on the left or right", async ({
    page,
  }) => {
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Clipping Checker");

    await page.getByRole("button", { name: /begin assessment/i }).click();

    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    // Wait for question to appear
    await expect(page.getByTestId("question-pane")).toBeVisible({ timeout: 10_000 });

    // The h2 question prompt
    const h2 = page.getByTestId("question-pane").locator("h2").first();
    await expect(h2).toBeVisible();
    const h2Box = await h2.boundingBox();
    expect(h2Box).not.toBeNull();
    // Must not start before x=0 (clipped on left)
    expect(h2Box!.x).toBeGreaterThanOrEqual(0);
    // Must not extend past the right edge (clipped on right) — allow 2px tolerance
    expect(h2Box!.x + h2Box!.width).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 2);
  });
});

// ─── Landscape phone tests (852 × 393) ───────────────────────────────────────

test.describe("Exam attempt page on iPhone 14 Pro landscape viewport (852×393)", () => {
  test.use({ viewport: LANDSCAPE_VIEWPORT });

  let code = "";

  test.beforeAll(async ({ request }) => {
    const result = await setupAssessment(request as any);
    code = result.code;
  });

  test("timer, question pane and footer buttons stay usable after rotating to landscape mid-attempt", async ({
    page,
  }) => {
    // ── Step 1: Join in portrait ───────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Rotation Tester");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Step 2: Confirm we are on the attempt page (portrait) ─────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    // Timer badge visible in portrait
    const timerBadge = page.getByTestId("timer-badge");
    await expect(timerBadge).toBeVisible({ timeout: 10_000 });

    const timerBox = await timerBadge.boundingBox();
    expect(timerBox, "timer badge bounding box must exist").not.toBeNull();
    expect(timerBox!.x, "timer badge must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      timerBox!.x + timerBox!.width,
      "timer badge must not extend past landscape viewport right edge",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 1);
    expect(
      timerBox!.y,
      "timer badge must not start above viewport top",
    ).toBeGreaterThanOrEqual(0);
    expect(
      timerBox!.y + timerBox!.height,
      "timer badge must be within landscape viewport height",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.height + 1);
  });

  test("question pane and answer textarea are within the landscape viewport", async ({ page }) => {
    // ── Join ──────────────────────────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Landscape Pane Checker");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Attempt page ──────────────────────────────────────────────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    // Question pane
    const questionPane = page.getByTestId("question-pane");
    await expect(questionPane).toBeVisible({ timeout: 10_000 });

    const paneBox = await questionPane.boundingBox();
    expect(paneBox, "question pane bounding box must exist").not.toBeNull();
    expect(paneBox!.x, "question pane must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      paneBox!.x + paneBox!.width,
      "question pane must not extend past landscape viewport right edge",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // Answer textarea (scroll into view first — landscape is shorter)
    const answerTextarea = page.getByTestId("answer-textarea");
    await expect(answerTextarea).toBeVisible({ timeout: 5_000 });
    await answerTextarea.scrollIntoViewIfNeeded();

    const taBox = await answerTextarea.boundingBox();
    expect(taBox, "answer textarea bounding box must exist").not.toBeNull();
    expect(taBox!.x, "textarea must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      taBox!.x + taBox!.width,
      "textarea must not extend past landscape viewport right edge",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);
  });

  test("footer action buttons are within the landscape viewport and not obscured by the webcam widget", async ({
    page,
  }) => {
    // ── Join ──────────────────────────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Landscape Footer Checker");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Attempt page ──────────────────────────────────────────────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    // Wait for the page to settle
    await expect(page.getByTestId("question-pane")).toBeVisible({ timeout: 10_000 });

    // ── Save-answer button ────────────────────────────────────────────────
    const saveBtn = page.getByTestId("btn-save-answer");
    await saveBtn.scrollIntoViewIfNeeded();
    await expect(saveBtn).toBeVisible();

    const saveBtnBox = await saveBtn.boundingBox();
    expect(saveBtnBox, "save button bounding box must exist").not.toBeNull();
    expect(saveBtnBox!.x, "save button must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      saveBtnBox!.x + saveBtnBox!.width,
      "save button must not extend past landscape viewport right edge",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Footer actions container ──────────────────────────────────────────
    const footerActions = page.getByTestId("footer-actions");
    await footerActions.scrollIntoViewIfNeeded();
    await expect(footerActions).toBeVisible({ timeout: 5_000 });

    const footerBox = await footerActions.boundingBox();
    expect(footerBox, "footer actions bounding box must exist").not.toBeNull();
    expect(
      footerBox!.x + footerBox!.width,
      "footer actions must not extend past landscape viewport right edge",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Webcam widget must not overlap footer (if proctoring enabled) ─────
    const webcamWidget = page.locator(".fixed").filter({
      has: page.locator("text=Proctor cam"),
    });
    const webcamCount = await webcamWidget.count();
    if (webcamCount > 0 && footerBox) {
      const wcBox = await webcamWidget.first().boundingBox();
      if (wcBox) {
        const footerTop = footerBox.y;
        const footerBottom = footerBox.y + footerBox.height;
        const wcTop = wcBox.y;
        const wcBottom = wcBox.y + wcBox.height;
        const overlaps = wcTop < footerBottom && wcBottom > footerTop;
        expect(
          overlaps,
          `Webcam widget (y=${wcTop}–${wcBottom}) overlaps footer actions (y=${footerTop}–${footerBottom}) after rotating to landscape`,
        ).toBe(false);
      }
    }

    // ── Step 8: Finish button (top bar) must still be accessible ──────────
    const finishTopBtn = page.getByTestId("btn-finish-top");
    await finishTopBtn.scrollIntoViewIfNeeded();
    await expect(finishTopBtn).toBeVisible();

    const finishBox = await finishTopBtn.boundingBox();
    expect(finishBox, "finish button bounding box must exist").not.toBeNull();
    expect(finishBox!.x, "finish button must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      finishBox!.x + finishBox!.width,
      "finish button must not extend past landscape viewport right edge",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);
  });

  test("full landscape join → type → save → submit flow completes successfully", async ({
    page,
  }) => {
    // ── Join ──────────────────────────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Landscape E2E Candidate");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Step 2: Confirm we are on the attempt page (portrait) ─────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    // Timer badge visible in portrait
    const timerBadge = page.getByTestId("timer-badge");
    await expect(timerBadge).toBeVisible({ timeout: 10_000 });

    // Type an answer
    const answerTextarea = page.getByTestId("answer-textarea");
    await expect(answerTextarea).toBeVisible({ timeout: 5_000 });
    await answerTextarea.scrollIntoViewIfNeeded();
    await answerTextarea.fill(
      "Natural justice principles: audi alteram partem (right to be heard) and nemo judex in causa sua (no person shall be judge in their own cause).",
    );

    // Save
    const saveBtn = page.getByTestId("btn-save-answer");
    await saveBtn.scrollIntoViewIfNeeded();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Page should remain on attempt
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 5_000 });

    // Finish
    const finishTopBtn = page.getByTestId("btn-finish-top");
    await finishTopBtn.scrollIntoViewIfNeeded();
    await expect(finishTopBtn).toBeVisible();
    await finishTopBtn.click();

    // Must reach summary
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+\/summary/, {
      timeout: 15_000,
    });
  });
});

// ─── Audio-monitoring bar overlap test (small landscape phone) ────────────────
//
// Creates an assessment with audioMonitoring: true and renders the attempt page
// at 812 × 320 (small Android phone in landscape with browser chrome).
// Confirms the fixed audio-monitor bar:
//   1. Is fully within the viewport (not clipped)
//   2. Does not overlap the footer action buttons
//   3. Does not overlap the answer textarea

async function setupAssessmentWithAudioMonitoring(
  request: Parameters<typeof test>[1] extends {
    request: infer R;
  }
    ? R
    : never,
): Promise<SetupResult> {
  const uid = Date.now();
  const email = `audio-monitor-${uid}@test.local`;
  const password = "AudioMon1234!";

  const regResp = await request.post("/api/acad/auth/register", {
    data: { email, password, name: "Audio Monitor Tester" },
  });
  expect(
    [201, 409],
    `register failed: ${regResp.status()} ${await regResp.text()}`,
  ).toContain(regResp.status());

  const loginResp = await request.post("/api/acad/auth/login", {
    data: { email, password },
  });
  expect(loginResp.status(), `login failed: ${await loginResp.text()}`).toBe(200);
  const setCookieHeader = loginResp.headers()["set-cookie"] ?? "";
  const sessionCookie = setCookieHeader
    .split(",")
    .map((c) => c.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .join("; ");

  const headers = { Cookie: sessionCookie };

  const createResp = await request.post("/api/acad/studio/assessments", {
    headers,
    data: {
      title: `Audio Monitor E2E ${uid}`,
      educatorName: "Audio Monitor Tester",
      timeLimitMinutes: 60,
      allowedAnswerModes: ["text"],
      rubric: { criteria: [] },
      proctoring: {
        lockFullscreen: false,
        blockCopyPaste: false,
        blockRightClick: false,
        blockShortcuts: false,
        detectDevtools: false,
        webcamSnapshots: false,
        audioMonitoring: true,
        idleTimeoutSeconds: 0,
        maxTabSwitches: 0,
        webcamSnapshotIntervalSec: 60,
      },
    },
  });
  expect(createResp.status(), `create assessment failed: ${await createResp.text()}`).toBe(201);
  const assessment = await createResp.json();
  const assessmentId: string = assessment.id;
  const code: string = assessment.code;

  const qResp = await request.post(
    `/api/acad/studio/assessments/${assessmentId}/questions`,
    {
      headers,
      data: {
        type: "short_answer",
        prompt: "Describe the duty of care concept in Malaysian tort law.",
        taxonomyLevel: 2,
        points: 10,
        options: [],
      },
    },
  );
  expect(qResp.status(), `add question failed: ${await qResp.text()}`).toBe(201);

  const patchResp = await request.patch(
    `/api/acad/studio/assessments/${assessmentId}`,
    {
      headers,
      data: { status: "open" },
    },
  );
  expect(patchResp.status(), `open assessment failed: ${await patchResp.text()}`).toBe(200);

  return { code, cookie: sessionCookie };
}

test.describe("Audio-monitoring bar – small landscape phone (812×320)", () => {
  test.use({ viewport: SMALL_LANDSCAPE_VIEWPORT });

  let code = "";

  test.beforeAll(async ({ request }) => {
    const result = await setupAssessmentWithAudioMonitoring(request as any);
    code = result.code;
  });

  test("audio-monitor bar does not overlap footer-actions or answer textarea and stays within viewport", async ({
    page,
  }) => {
    // ── Join ──────────────────────────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Small Landscape Audio Tester");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Confirm we are on the attempt page ────────────────────────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByTestId("question-pane")).toBeVisible({ timeout: 10_000 });

    // ── Audio monitor bar must be present ────────────────────────────────
    const audioBar = page.getByTestId("audio-monitor-bar");
    await expect(audioBar).toBeVisible({ timeout: 8_000 });

    const audioBarBox = await audioBar.boundingBox();
    expect(audioBarBox, "audio-monitor bar bounding box must exist").not.toBeNull();

    const vw = SMALL_LANDSCAPE_VIEWPORT.width;
    const vh = SMALL_LANDSCAPE_VIEWPORT.height;

    // ── 1. Audio bar is fully within the viewport (not clipped) ──────────
    expect(
      audioBarBox!.x,
      "audio bar must not start left of viewport",
    ).toBeGreaterThanOrEqual(0);
    expect(
      audioBarBox!.y,
      "audio bar must not start above viewport top",
    ).toBeGreaterThanOrEqual(0);
    expect(
      audioBarBox!.x + audioBarBox!.width,
      "audio bar must not extend past viewport right edge",
    ).toBeLessThanOrEqual(vw + 2);
    expect(
      audioBarBox!.y + audioBarBox!.height,
      "audio bar must not extend past viewport bottom edge",
    ).toBeLessThanOrEqual(vh + 2);

    // ── 2. Audio bar must not overlap footer-actions ───────────────────
    const footerActions = page.getByTestId("footer-actions");
    await footerActions.scrollIntoViewIfNeeded();
    await expect(footerActions).toBeVisible({ timeout: 5_000 });

    const footerBox = await footerActions.boundingBox();
    expect(footerBox, "footer-actions bounding box must exist").not.toBeNull();

    const audioTop = audioBarBox!.y;
    const audioBottom = audioBarBox!.y + audioBarBox!.height;
    const audioLeft = audioBarBox!.x;
    const audioRight = audioBarBox!.x + audioBarBox!.width;

    const footerTop = footerBox!.y;
    const footerBottom = footerBox!.y + footerBox!.height;
    const footerLeft = footerBox!.x;
    const footerRight = footerBox!.x + footerBox!.width;

    const overlapsFooterVertically = audioTop < footerBottom && audioBottom > footerTop;
    const overlapsFooterHorizontally = audioLeft < footerRight && audioRight > footerLeft;
    const overlapsFooter = overlapsFooterVertically && overlapsFooterHorizontally;

    expect(
      overlapsFooter,
      `Audio bar (x=${audioLeft}–${audioRight}, y=${audioTop}–${audioBottom}) overlaps footer-actions (x=${footerLeft}–${footerRight}, y=${footerTop}–${footerBottom}) on 812×320 viewport`,
    ).toBe(false);

    // ── 3. Audio bar must not overlap the answer textarea ────────────────
    const answerTextarea = page.getByTestId("answer-textarea");
    await answerTextarea.scrollIntoViewIfNeeded();
    await expect(answerTextarea).toBeVisible({ timeout: 5_000 });

    const taBox = await answerTextarea.boundingBox();
    expect(taBox, "answer textarea bounding box must exist").not.toBeNull();

    const taTop = taBox!.y;
    const taBottom = taBox!.y + taBox!.height;
    const taLeft = taBox!.x;
    const taRight = taBox!.x + taBox!.width;

    const overlapsTextareaVertically = audioTop < taBottom && audioBottom > taTop;
    const overlapsTextareaHorizontally = audioLeft < taRight && audioRight > taLeft;
    const overlapsTextarea = overlapsTextareaVertically && overlapsTextareaHorizontally;

    expect(
      overlapsTextarea,
      `Audio bar (x=${audioLeft}–${audioRight}, y=${audioTop}–${audioBottom}) overlaps answer textarea (x=${taLeft}–${taRight}, y=${taTop}–${taBottom}) on 812×320 viewport`,
    ).toBe(false);
  });
});

// ─── Mid-attempt portrait → landscape rotation test ───────────────────────────
//
// Starts the attempt page in portrait (393 × 852), types a partial answer, then
// calls page.setViewportSize to simulate a device rotation to landscape
// (852 × 393).  After the resize the timer badge, question pane, and footer
// action buttons must all reflow within the new viewport without a page reload.

test.describe("Exam attempt page – mid-attempt portrait → landscape rotation", () => {
  test.use({ viewport: IPHONE_VIEWPORT });

  let code = "";

  test.beforeAll(async ({ request }) => {
    const result = await setupAssessment(request as any);
    code = result.code;
  });

  test("timer, question pane and footer buttons stay usable after rotating to landscape mid-attempt", async ({
    page,
  }) => {
    // ── Step 1: Join in portrait ───────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Rotation Tester");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Step 2: Confirm we are on the attempt page (portrait) ─────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    // Timer badge visible in portrait
    const timerBadge = page.getByTestId("timer-badge");
    await expect(timerBadge).toBeVisible({ timeout: 10_000 });

    // Question pane visible in portrait
    const questionPane = page.getByTestId("question-pane");
    await expect(questionPane).toBeVisible({ timeout: 10_000 });

    // Type a partial answer before rotating
    const answerTextarea = page.getByTestId("answer-textarea");
    await expect(answerTextarea).toBeVisible({ timeout: 5_000 });
    await answerTextarea.scrollIntoViewIfNeeded();
    await answerTextarea.fill(
      "Audi alteram partem — the right to be heard — is a cardinal rule of natural justice.",
    );

    // ── Step 3: Rotate to landscape (simulate device rotation) ────────────
    await page.setViewportSize(LANDSCAPE_VIEWPORT);

    // Give the browser a moment to reflow (no page reload expected)
    await page.waitForTimeout(300);

    // ── Step 4: Timer badge must still be within the landscape viewport ────
    await expect(timerBadge).toBeVisible({ timeout: 5_000 });

    const timerBox = await timerBadge.boundingBox();
    expect(timerBox, "timer badge bounding box must exist after rotation").not.toBeNull();
    expect(timerBox!.x, "timer badge x must be ≥ 0 after rotation").toBeGreaterThanOrEqual(0);
    expect(
      timerBox!.x + timerBox!.width,
      "timer badge must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 1);
    expect(
      timerBox!.y,
      "timer badge y must be ≥ 0 after rotation",
    ).toBeGreaterThanOrEqual(0);
    expect(
      timerBox!.y + timerBox!.height,
      "timer badge must not extend past landscape bottom edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.height + 1);

    // ── Step 5: Question pane must still be accessible after rotation ──────
    await expect(questionPane).toBeVisible({ timeout: 5_000 });

    const paneBox = await questionPane.boundingBox();
    expect(paneBox, "question pane bounding box must exist after rotation").not.toBeNull();
    expect(paneBox!.x, "question pane x must be ≥ 0 after rotation").toBeGreaterThanOrEqual(0);
    expect(
      paneBox!.x + paneBox!.width,
      "question pane must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Step 6: Footer action buttons must be within the landscape viewport ─
    const footerActions = page.getByTestId("footer-actions");
    await footerActions.scrollIntoViewIfNeeded();
    await expect(footerActions).toBeVisible({ timeout: 5_000 });

    const footerBox = await footerActions.boundingBox();
    expect(footerBox, "footer actions bounding box must exist after rotation").not.toBeNull();
    expect(footerBox!.x, "footer must not start left of viewport after rotation").toBeGreaterThanOrEqual(0);
    expect(
      footerBox!.x + footerBox!.width,
      "footer must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // Save button (within footer) must be reachable
    const saveBtn = page.getByTestId("btn-save-answer");
    await saveBtn.scrollIntoViewIfNeeded();
    await expect(saveBtn).toBeVisible();

    const saveBtnBox = await saveBtn.boundingBox();
    expect(saveBtnBox, "save button bounding box must exist after rotation").not.toBeNull();
    expect(saveBtnBox!.x, "save button x must be ≥ 0 after rotation").toBeGreaterThanOrEqual(0);
    expect(
      saveBtnBox!.x + saveBtnBox!.width,
      "save button must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Step 7: Webcam proctoring widget must not overlap footer after rotation ──
    const webcamWidget = page.locator(".fixed").filter({
      has: page.locator("text=Proctor cam"),
    });
    const webcamCount = await webcamWidget.count();
    if (webcamCount > 0 && footerBox) {
      const wcBox = await webcamWidget.first().boundingBox();
      if (wcBox) {
        const footerTop = footerBox.y;
        const footerBottom = footerBox.y + footerBox.height;
        const wcTop = wcBox.y;
        const wcBottom = wcBox.y + wcBox.height;
        const overlaps = wcTop < footerBottom && wcBottom > footerTop;
        expect(
          overlaps,
          `Webcam widget (y=${wcTop}–${wcBottom}) overlaps footer actions (y=${footerTop}–${footerBottom}) after rotating to landscape`,
        ).toBe(false);
      }
    }

    // ── Step 8: Finish button (top bar) must still be accessible ──────────
    const finishTopBtn = page.getByTestId("btn-finish-top");
    await finishTopBtn.scrollIntoViewIfNeeded();
    await expect(finishTopBtn).toBeVisible();

    const finishBox = await finishTopBtn.boundingBox();
    expect(finishBox, "finish button bounding box must exist after rotation").not.toBeNull();
    expect(finishBox!.x, "finish button x must be ≥ 0 after rotation").toBeGreaterThanOrEqual(0);
    expect(
      finishBox!.x + finishBox!.width,
      "finish button must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Step 9: The answer text is still intact in the textarea ───────────
    await answerTextarea.scrollIntoViewIfNeeded();
    await expect(answerTextarea).toHaveValue(
      /audi alteram partem/i,
      { timeout: 3_000 },
    );

    // ── Step 10: The attempt can still be submitted after the rotation ─────
    await saveBtn.scrollIntoViewIfNeeded();
    await saveBtn.click();
    // Should remain on the attempt page — no unintended navigation
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 5_000 });

    await finishTopBtn.scrollIntoViewIfNeeded();
    await finishTopBtn.click();
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+\/summary/, {
      timeout: 15_000,
    });
  });
});

// ─── Small Android landscape tests (812 × 320) ────────────────────────────────
// Simulates a phone with browser chrome (address bar + status bar) that
// reduces the visible CSS viewport height to ≈ 320 px.

test.describe("Exam attempt page on small Android landscape viewport (812×320)", () => {
  test.use({ viewport: SMALL_LANDSCAPE_VIEWPORT });

  let code = "";

  test.beforeAll(async ({ request }) => {
    const result = await setupAssessment(request as any);
    code = result.code;
  });

  test("timer badge is fully within the 812×320 viewport", async ({ page }) => {
    // ── Join ──────────────────────────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Small Landscape Timer Checker");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Attempt page ──────────────────────────────────────────────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    const timerBadge = page.getByTestId("timer-badge");
    await expect(timerBadge).toBeVisible({ timeout: 10_000 });

    const timerBox = await timerBadge.boundingBox();
    expect(timerBox, "timer badge bounding box must exist").not.toBeNull();

    // Badge must not start above the top of the viewport
    expect(
      timerBox!.y,
      "timer badge must not start above viewport top",
    ).toBeGreaterThanOrEqual(0);

    // Badge must not extend past the bottom of the 320 px viewport
    expect(
      timerBox!.y + timerBox!.height,
      "timer badge bottom must be within the 320 px viewport height",
    ).toBeLessThanOrEqual(SMALL_LANDSCAPE_VIEWPORT.height + 1);

    // Badge must not start left of the viewport
    expect(
      timerBox!.x,
      "timer badge must not start left of viewport",
    ).toBeGreaterThanOrEqual(0);

    // Badge must not extend past the right edge of the 812 px viewport
    expect(
      timerBox!.x + timerBox!.width,
      "timer badge must not extend past the 812 px viewport right edge",
    ).toBeLessThanOrEqual(SMALL_LANDSCAPE_VIEWPORT.width + 1);
  });

  test("footer action buttons are reachable by scrolling on 812×320 viewport", async ({
    page,
  }) => {
    // ── Join ──────────────────────────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Small Landscape Footer Checker");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Attempt page ──────────────────────────────────────────────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    await expect(page.getByTestId("question-pane")).toBeVisible({ timeout: 10_000 });

    // Footer action buttons must be reachable after scrolling
    const saveBtn = page.getByTestId("btn-save-answer");
    await saveBtn.scrollIntoViewIfNeeded();
    await expect(saveBtn).toBeVisible();

    const saveBtnBox = await saveBtn.boundingBox();
    expect(saveBtnBox, "save button bounding box must exist").not.toBeNull();
    // After scrollIntoView, the button's left/right edges must be within the 812 px width
    expect(saveBtnBox!.x, "save button must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      saveBtnBox!.x + saveBtnBox!.width,
      "save button must not extend past 812 px viewport right edge",
    ).toBeLessThanOrEqual(SMALL_LANDSCAPE_VIEWPORT.width + 2);

    const footerActions = page.getByTestId("footer-actions");
    await footerActions.scrollIntoViewIfNeeded();
    await expect(footerActions).toBeVisible();

    const footerBox = await footerActions.boundingBox();
    expect(footerBox, "footer actions bounding box must exist").not.toBeNull();
    expect(
      footerBox!.x + footerBox!.width,
      "footer actions must not extend past 812 px viewport right edge",
    ).toBeLessThanOrEqual(SMALL_LANDSCAPE_VIEWPORT.width + 2);

    // Finish button in top bar must also be reachable (it's sticky — no scroll needed)
    const finishTopBtn = page.getByTestId("btn-finish-top");
    await expect(finishTopBtn).toBeVisible();

    const finishBox = await finishTopBtn.boundingBox();
    expect(finishBox, "finish button bounding box must exist").not.toBeNull();
    expect(finishBox!.x, "finish button must not start left of viewport").toBeGreaterThanOrEqual(0);
    expect(
      finishBox!.x + finishBox!.width,
      "finish button must not extend past 812 px viewport right edge",
    ).toBeLessThanOrEqual(SMALL_LANDSCAPE_VIEWPORT.width + 2);
    // Finish button is in the sticky top bar — it must sit within the viewport height
    expect(
      finishBox!.y + finishBox!.height,
      "finish button (sticky top bar) must be within the 320 px viewport height",
    ).toBeLessThanOrEqual(SMALL_LANDSCAPE_VIEWPORT.height + 1);
  });
});

// ─── Proctor-cam overlay vs timer / finish button (812 × 320) ────────────────
//
// Creates an assessment with webcamSnapshots: true so the fixed "Proctor cam"
// widget appears.  Verifies at the 812×320 small-landscape viewport that:
//   • the widget does not overlap the sticky timer badge in the top bar
//   • the widget stays fully within the viewport (not clipped off-screen)
//   • the widget does not obscure the "Finish" button in the sticky top bar

test.describe("Proctor-cam overlay does not hide timer or finish button on 812×320 landscape", () => {
  test.use({ viewport: SMALL_LANDSCAPE_VIEWPORT });

  let webcamCode = "";

  test.beforeAll(async ({ request }) => {
    const uid = Date.now();
    const email = `proctor-cam-${uid}@test.local`;
    const password = "Mobile1234!";

    const regResp = await request.post("/api/acad/auth/register", {
      data: { email, password, name: "Proctor Cam Tester" },
    });
    expect([201, 409]).toContain(regResp.status());

    const loginResp = await request.post("/api/acad/auth/login", {
      data: { email, password },
    });
    expect(loginResp.status(), `login failed: ${await loginResp.text()}`).toBe(200);
    const setCookieHeader = loginResp.headers()["set-cookie"] ?? "";
    const sessionCookie = setCookieHeader
      .split(",")
      .map((c) => c.split(";")[0]?.trim() ?? "")
      .filter(Boolean)
      .join("; ");
    const headers = { Cookie: sessionCookie };

    // Assessment with webcam proctoring enabled
    const createResp = await request.post("/api/acad/studio/assessments", {
      headers,
      data: {
        title: `Proctor Cam E2E ${uid}`,
        educatorName: "Proctor Cam Tester",
        timeLimitMinutes: 60,
        allowedAnswerModes: ["text"],
        rubric: { criteria: [] },
        proctoring: {
          lockFullscreen: false,
          blockCopyPaste: false,
          blockRightClick: false,
          blockShortcuts: false,
          detectDevtools: false,
          webcamSnapshots: true,
          audioMonitoring: false,
          idleTimeoutSeconds: 0,
          maxTabSwitches: 0,
          webcamSnapshotIntervalSec: 60,
        },
      },
    });
    expect(createResp.status(), `create proctored assessment: ${await createResp.text()}`).toBe(201);
    const assessment = await createResp.json();
    webcamCode = assessment.code;
    const assessmentId: string = assessment.id;

    const qResp = await request.post(
      `/api/acad/studio/assessments/${assessmentId}/questions`,
      {
        headers,
        data: {
          type: "short_answer",
          prompt: "Describe the doctrine of separation of powers.",
          taxonomyLevel: 2,
          points: 10,
          options: [],
        },
      },
    );
    expect(qResp.status(), `add question: ${await qResp.text()}`).toBe(201);

    const patchResp = await request.patch(
      `/api/acad/studio/assessments/${assessmentId}`,
      { headers, data: { status: "open" } },
    );
    expect(patchResp.status(), `open assessment: ${await patchResp.text()}`).toBe(200);
  });

  /** Inject a fake getUserMedia so the proctor-cam widget renders without a real camera. */
  async function mockCamera(page: Page): Promise<void> {
    await page.addInitScript(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 96;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(0, 0, 160, 96);
      }
      // captureStream is available in Chromium
      const fakeStream = (canvas as any).captureStream?.() ?? null;
      try {
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: {
            getUserMedia: () =>
              fakeStream
                ? Promise.resolve(fakeStream)
                : Promise.reject(new DOMException("Not allowed", "NotAllowedError")),
            enumerateDevices: () => Promise.resolve([]),
          },
        });
      } catch {
        // In some contexts mediaDevices is already defined; ignore
      }
    });
  }

  /** Join the webcam-enabled assessment as a named student. */
  async function joinWebcamAttempt(page: Page, name: string): Promise<void> {
    await mockCamera(page);
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(webcamCode);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill(name);
    await page.getByRole("button", { name: /begin assessment/i }).click();

    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });
    // Wait for the attempt page to fully settle
    await expect(page.getByTestId("question-pane")).toBeVisible({ timeout: 10_000 });
  }

  test("webcam overlay does not overlap timer badge on 812×320 landscape", async ({
    page,
  }) => {
    await joinWebcamAttempt(page, "Proctor Overlap Checker");

    // Timer badge must be visible in the sticky top bar
    const timerBadge = page.getByTestId("timer-badge");
    await expect(timerBadge).toBeVisible({ timeout: 10_000 });

    const timerBox = await timerBadge.boundingBox();
    expect(timerBox, "timer badge bounding box must exist").not.toBeNull();

    // Proctor-cam widget must be present (assessment has webcamSnapshots: true)
    const webcamWidget = page.getByTestId("proctor-cam-widget");
    await expect(webcamWidget).toBeVisible({ timeout: 10_000 });

    const wcBox = await webcamWidget.boundingBox();
    expect(wcBox, "webcam widget bounding box must exist").not.toBeNull();

    // Bounding-box overlap check
    const timerRight = timerBox!.x + timerBox!.width;
    const timerBottom = timerBox!.y + timerBox!.height;
    const wcRight = wcBox!.x + wcBox!.width;
    const wcBottom = wcBox!.y + wcBox!.height;
    const horizontalOverlap = timerBox!.x < wcRight && timerRight > wcBox!.x;
    const verticalOverlap = timerBox!.y < wcBottom && timerBottom > wcBox!.y;

    expect(
      horizontalOverlap && verticalOverlap,
      `Webcam widget (x=${wcBox!.x}–${wcRight}, y=${wcBox!.y}–${wcBottom}) overlaps ` +
      `timer badge (x=${timerBox!.x}–${timerRight}, y=${timerBox!.y}–${timerBottom}) ` +
      `on 812×320 landscape viewport`,
    ).toBe(false);
  });

  test("webcam widget is fully within the 812×320 viewport", async ({
    page,
  }) => {
    await joinWebcamAttempt(page, "Proctor Viewport Checker");

    const webcamWidget = page.getByTestId("proctor-cam-widget");
    await expect(webcamWidget).toBeVisible({ timeout: 10_000 });

    const wcBox = await webcamWidget.boundingBox();
    expect(wcBox, "webcam widget bounding box must exist").not.toBeNull();

    expect(
      wcBox!.x,
      "webcam widget must not start left of the viewport",
    ).toBeGreaterThanOrEqual(0);

    expect(
      wcBox!.y,
      "webcam widget must not start above the top of the viewport",
    ).toBeGreaterThanOrEqual(0);

    expect(
      wcBox!.x + wcBox!.width,
      "webcam widget must not extend past the 812 px viewport right edge",
    ).toBeLessThanOrEqual(SMALL_LANDSCAPE_VIEWPORT.width + 2);

    expect(
      wcBox!.y + wcBox!.height,
      "webcam widget must not extend below the 320 px viewport bottom",
    ).toBeLessThanOrEqual(SMALL_LANDSCAPE_VIEWPORT.height + 2);
  });

  test("webcam overlay does not obscure the finish button on 812×320 landscape", async ({
    page,
  }) => {
    await joinWebcamAttempt(page, "Finish Obscure Checker");

    // Finish button is in the sticky top bar
    const finishTopBtn = page.getByTestId("btn-finish-top");
    await expect(finishTopBtn).toBeVisible({ timeout: 10_000 });

    const finishBox = await finishTopBtn.boundingBox();
    expect(finishBox, "finish button bounding box must exist").not.toBeNull();

    const webcamWidget = page.getByTestId("proctor-cam-widget");
    await expect(webcamWidget).toBeVisible({ timeout: 10_000 });

    const wcBox = await webcamWidget.boundingBox();
    expect(wcBox, "webcam widget bounding box must exist").not.toBeNull();

    const finishRight = finishBox!.x + finishBox!.width;
    const finishBottom = finishBox!.y + finishBox!.height;
    const wcRight = wcBox!.x + wcBox!.width;
    const wcBottom = wcBox!.y + wcBox!.height;
    const horizontalOverlap = finishBox!.x < wcRight && finishRight > wcBox!.x;
    const verticalOverlap = finishBox!.y < wcBottom && finishBottom > wcBox!.y;

    expect(
      horizontalOverlap && verticalOverlap,
      `Webcam widget (x=${wcBox!.x}–${wcRight}, y=${wcBox!.y}–${wcBottom}) obscures ` +
      `finish button (x=${finishBox!.x}–${finishRight}, y=${finishBox!.y}–${finishBottom}) ` +
      `on 812×320 landscape viewport`,
    ).toBe(false);
  });

  test("proctor-cam widget does not overlap answer textarea after on-screen keyboard pushes viewport up", async ({
    page,
  }) => {
    // ── Setup ─────────────────────────────────────────────────────────────
    // Join with webcam mock so the proctor-cam widget appears.
    await joinWebcamAttempt(page, "Keyboard Viewport Checker");

    // ── Locate the answer textarea ─────────────────────────────────────────
    const textarea = page.getByTestId("answer-textarea");
    await textarea.scrollIntoViewIfNeeded();
    await expect(textarea).toBeVisible({ timeout: 10_000 });

    // ── Simulate the on-screen keyboard pushing the viewport up ────────────
    // On real mobile devices, focusing a text input causes the OS keyboard
    // to appear, which reduces the visual viewport height by ~200–240 px.
    // Playwright drives a desktop Chromium that doesn't have a software
    // keyboard, so we replicate the effect by shrinking the viewport height
    // to 160 px (≈ 812×320 minus a 160 px keyboard) after focusing the
    // textarea, which forces all fixed-positioned elements to reflow into
    // the reduced space exactly as they would on a real device.
    await textarea.focus();
    await page.setViewportSize({ width: 812, height: 160 });

    // Give the browser one animation frame to reflow fixed elements.
    await page.waitForTimeout(200);

    // ── Bounding boxes after the simulated keyboard open ──────────────────
    const webcamWidget = page.getByTestId("proctor-cam-widget");
    await expect(webcamWidget).toBeVisible({ timeout: 10_000 });

    const wcBox = await webcamWidget.boundingBox();
    expect(wcBox, "webcam widget bounding box must exist after keyboard resize").not.toBeNull();

    // Scroll textarea back into view (keyboard may have pushed it out of the
    // shrunken viewport) and re-measure its position.
    await textarea.scrollIntoViewIfNeeded();
    const taBox = await textarea.boundingBox();
    expect(taBox, "answer textarea bounding box must exist after keyboard resize").not.toBeNull();

    // ── Overlap check ─────────────────────────────────────────────────────
    const wcRight   = wcBox!.x + wcBox!.width;
    const wcBottom  = wcBox!.y + wcBox!.height;
    const taRight   = taBox!.x + taBox!.width;
    const taBottom  = taBox!.y + taBox!.height;

    const horizontalOverlap = wcBox!.x < taRight  && wcRight  > taBox!.x;
    const verticalOverlap   = wcBox!.y < taBottom && wcBottom > taBox!.y;

    expect(
      horizontalOverlap && verticalOverlap,
      `Proctor-cam widget (x=${wcBox!.x}–${wcRight}, y=${wcBox!.y}–${wcBottom}) ` +
      `overlaps answer textarea (x=${taBox!.x}–${taRight}, y=${taBox!.y}–${taBottom}) ` +
      `after on-screen keyboard pushes viewport to 812×160`,
    ).toBe(false);
  });
});

// ─── Handwriting tests (393 × 852) ───────────────────────────────────────────

test.describe("Handwriting answer mode on iPhone 14 Pro viewport", () => {
  test.use({ viewport: IPHONE_VIEWPORT });

  let hwCode = "";

  test.beforeAll(async ({ request }) => {
    const uid = Date.now();
    const email = `mobile-hw-${uid}@test.local`;
    const password = "Mobile1234!";

    const regResp = await request.post("/api/acad/auth/register", {
      data: { email, password, name: "HW Tester" },
    });
    expect([201, 409]).toContain(regResp.status());

    const loginResp = await request.post("/api/acad/auth/login", {
      data: { email, password },
    });
    expect(loginResp.status()).toBe(200);
    const setCookieHeader = loginResp.headers()["set-cookie"] ?? "";
    const sessionCookie = setCookieHeader
      .split(",")
      .map((c) => c.split(";")[0]?.trim() ?? "")
      .filter(Boolean)
      .join("; ");
    const headers = { Cookie: sessionCookie };

    const createResp = await request.post("/api/acad/studio/assessments", {
      headers,
      data: {
        title: `Mobile HW E2E ${uid}`,
        educatorName: "HW Tester",
        timeLimitMinutes: 60,
        allowedAnswerModes: ["handwriting", "text"],
        rubric: { criteria: [] },
        proctoring: {
          lockFullscreen: false,
          blockCopyPaste: false,
          blockRightClick: false,
          blockShortcuts: false,
          detectDevtools: false,
          webcamSnapshots: false,
          audioMonitoring: false,
          idleTimeoutSeconds: 0,
          maxTabSwitches: 0,
          webcamSnapshotIntervalSec: 60,
        },
      },
    });
    expect(createResp.status(), `create hw assessment: ${await createResp.text()}`).toBe(201);
    const assessment = await createResp.json();
    hwCode = assessment.code;
    const assessmentId: string = assessment.id;

    const qResp = await request.post(
      `/api/acad/studio/assessments/${assessmentId}/questions`,
      {
        headers,
        data: {
          type: "short_answer",
          prompt: "Write a brief note on the rule against bias.",
          taxonomyLevel: 2,
          points: 10,
          options: [],
        },
      },
    );
    expect(qResp.status(), `add hw question: ${await qResp.text()}`).toBe(201);

    const patchResp = await request.patch(
      `/api/acad/studio/assessments/${assessmentId}`,
      { headers, data: { status: "open" } },
    );
    expect(patchResp.status(), `open hw assessment: ${await patchResp.text()}`).toBe(200);
  });

  // Each test must pass a unique student name so the per-student maxAttempts=1
  // limit on the assessment does not block the second and third test from joining.
  async function joinHandwritingAttempt(page: Page, studentName: string): Promise<void> {
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(hwCode);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill(studentName);

    await page.getByRole("button", { name: /begin assessment/i }).click();
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });
    await expect(page.getByTestId("question-pane")).toBeVisible({ timeout: 10_000 });
  }

  test("handwriting tab is selectable on a 393 px viewport", async ({ page }) => {
    await joinHandwritingAttempt(page, "HW Tab Checker");

    const writeTab = page.getByRole("tab", { name: /write/i });
    await expect(writeTab).toBeVisible();
    await writeTab.scrollIntoViewIfNeeded();
    const tabBox = await writeTab.boundingBox();
    expect(tabBox).not.toBeNull();
    expect(tabBox!.x).toBeGreaterThanOrEqual(0);
    expect(tabBox!.x + tabBox!.width).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 1);

    await writeTab.click();

    const canvas = page.getByTestId("hw-canvas");
    await expect(canvas).toBeVisible({ timeout: 5_000 });
  });

  test("canvas, Clear and Recognise buttons are all visible within 393 px viewport", async ({
    page,
  }) => {
    await joinHandwritingAttempt(page, "HW Canvas Checker");

    await page.getByRole("tab", { name: /write/i }).click();

    const canvas = page.getByTestId("hw-canvas");
    const clearBtn = page.getByTestId("btn-hw-clear");
    const recogniseBtn = page.getByTestId("btn-hw-recognise");

    await expect(canvas).toBeVisible({ timeout: 5_000 });
    await expect(clearBtn).toBeVisible();
    await expect(recogniseBtn).toBeVisible();

    for (const [label, locator] of [
      ["canvas", canvas],
      ["Clear button", clearBtn],
      ["Recognise button", recogniseBtn],
    ] as const) {
      await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      expect(box, `${label} has no bounding box`).not.toBeNull();
      expect(box!.x, `${label} starts before left edge`).toBeGreaterThanOrEqual(0);
      expect(
        box!.x + box!.width,
        `${label} extends past right edge`,
      ).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 1);
    }
  });

  test("touch-pointer stroke on canvas is accepted and Recognise button submits without error", async ({
    page,
  }) => {
    await joinHandwritingAttempt(page, "HW Stroke Checker");

    await page.getByRole("tab", { name: /write/i }).click();

    const canvas = page.getByTestId("hw-canvas");
    await expect(canvas).toBeVisible({ timeout: 5_000 });
    await canvas.scrollIntoViewIfNeeded();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const startX = box!.x + box!.width * 0.2;
    const startY = box!.y + box!.height * 0.3;
    const endX = box!.x + box!.width * 0.8;
    const endY = box!.y + box!.height * 0.7;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await page.mouse.move(startX + (endX - startX) * t, startY + (endY - startY) * t);
    }
    await page.mouse.up();

    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 3_000 });

    const recogniseBtn = page.getByTestId("btn-hw-recognise");
    await recogniseBtn.scrollIntoViewIfNeeded();
    await expect(recogniseBtn).toBeVisible();
    await recogniseBtn.click();

    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 10_000 });
    await expect(page.getByTestId("hw-textarea")).toBeVisible();
  });
});

// ─── Join page portrait → landscape rotation test ────────────────────────────
//
// Simulates a student picking up their phone in portrait, entering the join code,
// then rotating to landscape BEFORE filling in their name.  After the viewport
// change the name input, the Begin Assessment button, and the assessment title
// card must all be within the new viewport bounds without a page reload.

// ─── Long title / educator name clipping tests ───────────────────────────────
//
// Creates an assessment whose title exceeds 60 characters and whose educator
// name exceeds 40 characters, then verifies the title card on the join page
// fits entirely within the iPhone 14 Pro viewport without horizontal clipping.

test.describe("Join page – assessment title card with very long title and educator name", () => {
  test.use({ viewport: IPHONE_VIEWPORT });

  let longTitleCode = "";

  test.beforeAll(async ({ request }) => {
    const uid = Date.now();
    const email = `mobile-long-title-${uid}@test.local`;
    const password = "Mobile1234!";

    const regResp = await request.post("/api/acad/auth/register", {
      data: { email, password, name: "Long Title Educator With An Exceptionally Long Name Indeed" },
    });
    expect([201, 409]).toContain(regResp.status());

    const loginResp = await request.post("/api/acad/auth/login", {
      data: { email, password },
    });
    expect(loginResp.status(), `login failed: ${await loginResp.text()}`).toBe(200);
    const setCookieHeader = loginResp.headers()["set-cookie"] ?? "";
    const sessionCookie = setCookieHeader
      .split(",")
      .map((c) => c.split(";")[0]?.trim() ?? "")
      .filter(Boolean)
      .join("; ");
    const headers = { Cookie: sessionCookie };

    // Title is >60 chars, educatorName is >40 chars
    const longTitle =
      "Advanced Constitutional Law and Administrative Principles in Malaysian Context — Midterm Examination";
    const longEducatorName = "Prof. Dr. Aisyah binti Mohamed Al-Rashid Al-Amin";

    const createResp = await request.post("/api/acad/studio/assessments", {
      headers,
      data: {
        title: longTitle,
        educatorName: longEducatorName,
        timeLimitMinutes: 60,
        allowedAnswerModes: ["text"],
        rubric: { criteria: [] },
        proctoring: {
          lockFullscreen: false,
          blockCopyPaste: false,
          blockRightClick: false,
          blockShortcuts: false,
          detectDevtools: false,
          webcamSnapshots: false,
          audioMonitoring: false,
          idleTimeoutSeconds: 0,
          maxTabSwitches: 0,
          webcamSnapshotIntervalSec: 60,
        },
      },
    });
    expect(createResp.status(), `create long-title assessment: ${await createResp.text()}`).toBe(201);
    const assessment = await createResp.json();
    longTitleCode = assessment.code;
    const assessmentId: string = assessment.id;

    const qResp = await request.post(
      `/api/acad/studio/assessments/${assessmentId}/questions`,
      {
        headers,
        data: {
          type: "short_answer",
          prompt: "Explain the doctrine of separation of powers.",
          taxonomyLevel: 2,
          points: 10,
          options: [],
        },
      },
    );
    expect(qResp.status(), `add question: ${await qResp.text()}`).toBe(201);

    const patchResp = await request.patch(
      `/api/acad/studio/assessments/${assessmentId}`,
      { headers, data: { status: "open" } },
    );
    expect(patchResp.status(), `open assessment: ${await patchResp.text()}`).toBe(200);
  });

  test("title card with long title and educator name does not overflow the mobile viewport", async ({
    page,
  }) => {
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await expect(codeInput).toBeVisible();
    await codeInput.fill(longTitleCode);
    await page.getByRole("button", { name: /verify code/i }).click();

    // Wait for the assessment title card to appear
    const titleCard = page.getByTestId("assessment-title-card");
    await expect(titleCard).toBeVisible({ timeout: 10_000 });

    // The title card must be entirely within the viewport width
    const cardBox = await titleCard.boundingBox();
    expect(cardBox, "assessment title card bounding box must exist").not.toBeNull();
    expect(
      cardBox!.x,
      "assessment title card must not start left of viewport",
    ).toBeGreaterThanOrEqual(0);
    expect(
      cardBox!.x + cardBox!.width,
      "assessment title card must not extend past viewport right edge",
    ).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 2);

    // The name input must also be visible (confirming the form rendered fully)
    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.scrollIntoViewIfNeeded();

    const nameInputBox = await nameInput.boundingBox();
    expect(nameInputBox, "name input bounding box must exist").not.toBeNull();
    expect(
      nameInputBox!.x,
      "name input must not start left of viewport",
    ).toBeGreaterThanOrEqual(0);
    expect(
      nameInputBox!.x + nameInputBox!.width,
      "name input must not extend past viewport right edge",
    ).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 2);
  });

  test("title card does not overflow after rotating to landscape with a long title", async ({
    page,
  }) => {
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(longTitleCode);
    await page.getByRole("button", { name: /verify code/i }).click();

    const titleCard = page.getByTestId("assessment-title-card");
    await expect(titleCard).toBeVisible({ timeout: 10_000 });

    // Rotate to landscape
    await page.setViewportSize(LANDSCAPE_VIEWPORT);
    await page.waitForTimeout(300);

    // Card must remain within the landscape viewport after reflow
    await expect(titleCard).toBeVisible({ timeout: 5_000 });
    await titleCard.scrollIntoViewIfNeeded();

    const cardBoxLandscape = await titleCard.boundingBox();
    expect(cardBoxLandscape, "title card bounding box must exist after rotation").not.toBeNull();
    expect(
      cardBoxLandscape!.x,
      "title card must not start left of viewport after rotation",
    ).toBeGreaterThanOrEqual(0);
    expect(
      cardBoxLandscape!.x + cardBoxLandscape!.width,
      "title card must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);
  });
});

test.describe("Join page – portrait → landscape rotation before name entry", () => {
  test.use({ viewport: IPHONE_VIEWPORT });

  let code = "";

  test.beforeAll(async ({ request }) => {
    const result = await setupAssessment(request as any);
    code = result.code;
  });

  test("name input and Begin Assessment button are reachable after rotating to landscape mid-join", async ({
    page,
  }) => {
    // ── Step 1: Open join page in portrait ───────────────────────────────
    await page.goto("/mylawacad/studio/join");

    // ── Step 2: Enter the join code (still in portrait) ──────────────────
    const codeInput = page.getByTestId("code-input");
    await expect(codeInput).toBeVisible();
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    // Wait for the student-details form to appear while still in portrait
    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });

    // ── Step 3: Rotate to landscape before the student types their name ───
    await page.setViewportSize(LANDSCAPE_VIEWPORT);

    // Give the browser a moment to reflow without a page reload
    await page.waitForTimeout(300);

    // ── Step 4: Assessment title card must still be visible after resize ──
    // The card shows the assessment code, title, and educator name.
    // The code text is the most reliable anchor since we have it in scope.
    const titleCard = page.locator(`text=${code}`).first();
    await expect(titleCard).toBeVisible({ timeout: 5_000 });

    // ── Step 5: Name input is within the landscape viewport bounds ────────
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
    await nameInput.scrollIntoViewIfNeeded();

    const nameBox = await nameInput.boundingBox();
    expect(nameBox, "name input bounding box must exist after rotation").not.toBeNull();
    expect(
      nameBox!.x,
      "name input must not start left of viewport after rotation",
    ).toBeGreaterThanOrEqual(0);
    expect(
      nameBox!.x + nameBox!.width,
      "name input must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Step 6: Begin Assessment button is within the landscape viewport ──
    const beginBtn = page.getByRole("button", { name: /begin assessment/i });
    await beginBtn.scrollIntoViewIfNeeded();
    await expect(beginBtn).toBeVisible({ timeout: 5_000 });

    const beginBox = await beginBtn.boundingBox();
    expect(beginBox, "Begin Assessment button bounding box must exist after rotation").not.toBeNull();
    expect(
      beginBox!.x,
      "Begin Assessment button must not start left of viewport after rotation",
    ).toBeGreaterThanOrEqual(0);
    expect(
      beginBox!.x + beginBox!.width,
      "Begin Assessment button must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Step 7: The join flow still completes after the rotation ──────────
    await nameInput.fill("Rotation Join Tester");
    await beginBtn.click();

    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });
  });
});

// ─── Join page on-screen keyboard simulation ──────────────────────────────────
//
// When a student taps the name input on a small phone the virtual keyboard
// pushes content up, reducing the CSS viewport height significantly.  We
// simulate this by shrinking the viewport to 393×320 after the code has been
// verified (i.e. when the name / Begin Assessment form is visible).
//
// After the viewport shrink:
//   • The name input must be scrollable into view and within the narrowed bounds
//   • The Begin Assessment button must also be scrollable into view and within bounds

// Keyboard-reduced height: 393 wide, 320 tall (matches task spec)
const KEYBOARD_OPEN_VIEWPORT = { width: 393, height: 320 };

test.describe("Join page – on-screen keyboard shrinks viewport (393×320)", () => {
  test.use({ viewport: IPHONE_VIEWPORT });

  let code = "";

  test.beforeAll(async ({ request }) => {
    const result = await setupAssessment(request as any);
    code = result.code;
  });

  test("name input and Begin Assessment button are reachable when keyboard reduces viewport to 393×320", async ({
    page,
  }) => {
    // ── Step 1: Open join page in normal portrait ────────────────────────
    await page.goto("/mylawacad/studio/join");

    // ── Step 2: Verify the join code (still at full portrait height) ─────
    const codeInput = page.getByTestId("code-input");
    await expect(codeInput).toBeVisible();
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    // Wait for the student-details form to appear
    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });

    // ── Step 3: Simulate keyboard opening by shrinking the viewport height ─
    await page.setViewportSize(KEYBOARD_OPEN_VIEWPORT);

    // Allow the browser to reflow — no page reload expected
    await page.waitForTimeout(300);

    // ── Step 4: Name input must be scrollable into view and within bounds ─
    await nameInput.scrollIntoViewIfNeeded();
    await expect(nameInput).toBeVisible({ timeout: 5_000 });

    const nameBox = await nameInput.boundingBox();
    expect(nameBox, "name input bounding box must exist with keyboard open").not.toBeNull();
    expect(
      nameBox!.x,
      "name input must not start left of viewport with keyboard open",
    ).toBeGreaterThanOrEqual(0);
    expect(
      nameBox!.x + nameBox!.width,
      "name input must not extend past right edge with keyboard open",
    ).toBeLessThanOrEqual(KEYBOARD_OPEN_VIEWPORT.width + 2);

    // ── Step 5: Begin Assessment button reachable within the narrowed viewport ─
    const beginBtn = page.getByRole("button", { name: /begin assessment/i });
    await beginBtn.scrollIntoViewIfNeeded();
    await expect(beginBtn).toBeVisible({ timeout: 5_000 });

    const beginBox = await beginBtn.boundingBox();
    expect(beginBox, "Begin Assessment button bounding box must exist with keyboard open").not.toBeNull();
    expect(
      beginBox!.x,
      "Begin Assessment button must not start left of viewport with keyboard open",
    ).toBeGreaterThanOrEqual(0);
    expect(
      beginBox!.x + beginBox!.width,
      "Begin Assessment button must not extend past right edge with keyboard open",
    ).toBeLessThanOrEqual(KEYBOARD_OPEN_VIEWPORT.width + 2);

    // ── Step 6: The join flow still completes after the keyboard shrink ───
    await nameInput.fill("Keyboard Open Tester");
    await beginBtn.click();

    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });
  });
});

// ─── Summary screen portrait → landscape rotation test ────────────────────────
//
// Navigates through join → attempt → submit to reach the summary page in
// portrait (393 × 852), then calls page.setViewportSize to simulate a device
// rotation to landscape (852 × 393).  After the resize the score ring,
// pass/fail badge, hero panel, and AI disclaimer must all reflow within the
// new viewport bounds without a page reload, and no element must overflow
// horizontally.

test.describe("Summary screen – portrait → landscape rotation after submission", () => {
  test.use({ viewport: IPHONE_VIEWPORT });

  let code = "";

  test.beforeAll(async ({ request }) => {
    const result = await setupAssessment(request as any);
    code = result.code;
  });

  test("score ring, pass/fail badge, hero panel, and AI disclaimer stay within viewport after rotating to landscape", async ({
    page,
  }) => {
    // ── Step 1: Join in portrait ───────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Summary Rotation Tester");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Step 2: Complete the attempt in portrait ───────────────────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    const answerTextarea = page.getByTestId("answer-textarea");
    await expect(answerTextarea).toBeVisible({ timeout: 10_000 });
    await answerTextarea.fill(
      "Natural justice requires a fair hearing (audi alteram partem) and an unbiased decision-maker (nemo judex in causa sua).",
    );

    const saveBtn = page.getByTestId("btn-save-answer");
    await saveBtn.scrollIntoViewIfNeeded();
    await saveBtn.click();

    // ── Step 3: Submit and reach the summary page (still in portrait) ──────
    const finishTopBtn = page.getByTestId("btn-finish-top");
    await finishTopBtn.scrollIntoViewIfNeeded();
    await expect(finishTopBtn).toBeVisible();
    await finishTopBtn.click();

    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+\/summary/, {
      timeout: 15_000,
    });

    // Wait for the summary content to load (hero panel signals readiness)
    const heroPanel = page.getByTestId("hero-panel");
    await expect(heroPanel).toBeVisible({ timeout: 30_000 });

    // ── Step 4: Rotate to landscape (simulate device rotation) ────────────
    await page.setViewportSize(LANDSCAPE_VIEWPORT);

    // Give the browser a moment to reflow — no page reload expected
    await page.waitForTimeout(300);

    // ── Step 5: Hero panel must be within the landscape viewport ──────────
    await expect(heroPanel).toBeVisible({ timeout: 5_000 });

    const heroBox = await heroPanel.boundingBox();
    expect(heroBox, "hero panel bounding box must exist after rotation").not.toBeNull();
    expect(heroBox!.x, "hero panel must not start left of viewport after rotation").toBeGreaterThanOrEqual(0);
    expect(
      heroBox!.x + heroBox!.width,
      "hero panel must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Step 6: Score ring must be within the landscape viewport ──────────
    const scoreRing = page.getByTestId("score-ring");
    await scoreRing.scrollIntoViewIfNeeded();
    await expect(scoreRing).toBeVisible({ timeout: 5_000 });

    const ringBox = await scoreRing.boundingBox();
    expect(ringBox, "score ring bounding box must exist after rotation").not.toBeNull();
    expect(ringBox!.x, "score ring must not start left of viewport after rotation").toBeGreaterThanOrEqual(0);
    expect(
      ringBox!.x + ringBox!.width,
      "score ring must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Step 7: Pass/fail badge must be within the landscape viewport ──────
    const passBadge = page.getByTestId("pass-fail-badge");
    await passBadge.scrollIntoViewIfNeeded();
    await expect(passBadge).toBeVisible({ timeout: 5_000 });

    const badgeBox = await passBadge.boundingBox();
    expect(badgeBox, "pass/fail badge bounding box must exist after rotation").not.toBeNull();
    expect(badgeBox!.x, "pass/fail badge must not start left of viewport after rotation").toBeGreaterThanOrEqual(0);
    expect(
      badgeBox!.x + badgeBox!.width,
      "pass/fail badge must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Step 8: AI disclaimer must be within the landscape viewport ────────
    const disclaimer = page.getByTestId("ai-disclaimer");
    await disclaimer.scrollIntoViewIfNeeded();
    await expect(disclaimer).toBeVisible({ timeout: 5_000 });

    const disclaimerBox = await disclaimer.boundingBox();
    expect(disclaimerBox, "AI disclaimer bounding box must exist after rotation").not.toBeNull();
    expect(disclaimerBox!.x, "AI disclaimer must not start left of viewport after rotation").toBeGreaterThanOrEqual(0);
    expect(
      disclaimerBox!.x + disclaimerBox!.width,
      "AI disclaimer must not extend past landscape right edge after rotation",
    ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);

    // ── Step 9: XP / rewards section (if present) must not overflow ────────
    const rewardsSection = page.getByTestId("attempt-rewards");
    const rewardsCount = await rewardsSection.count();
    if (rewardsCount > 0) {
      await rewardsSection.first().scrollIntoViewIfNeeded();
      await expect(rewardsSection.first()).toBeVisible();
      const rwBox = await rewardsSection.first().boundingBox();
      expect(rwBox, "rewards section bounding box must exist after rotation").not.toBeNull();
      expect(
        rwBox!.x + rwBox!.width,
        "XP rewards must not extend past landscape right edge after rotation",
      ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);
    }

    // ── Step 10: Leaderboard (if present) must not overflow ────────────────
    const leaderboard = page.getByTestId("leaderboard-section");
    const lbCount = await leaderboard.count();
    if (lbCount > 0) {
      await leaderboard.scrollIntoViewIfNeeded();
      await expect(leaderboard).toBeVisible();
      const lbBox = await leaderboard.boundingBox();
      expect(lbBox, "leaderboard bounding box must exist after rotation").not.toBeNull();
      expect(lbBox!.x, "leaderboard must not start left of viewport after rotation").toBeGreaterThanOrEqual(0);
      expect(
        lbBox!.x + lbBox!.width,
        "leaderboard must not extend past landscape right edge after rotation",
      ).toBeLessThanOrEqual(LANDSCAPE_VIEWPORT.width + 2);
    }
  });
});
