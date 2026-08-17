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

  test("join page is usable – code input and submit button are fully visible", async ({
    page,
  }) => {
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

    // Wait for the student-details form to appear
    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Test Candidate Mobile");

    // Submit the join form
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Step 2: Attempt page ───────────────────────────────────────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    // Timer badge must be visible in the sticky top bar
    const timerBadge = page.getByTestId("timer-badge");
    await expect(timerBadge).toBeVisible({ timeout: 10_000 });

    const timerBox = await timerBadge.boundingBox();
    expect(timerBox).not.toBeNull();
    // Timer must be within the viewport
    expect(timerBox!.x).toBeGreaterThanOrEqual(0);
    expect(timerBox!.x + timerBox!.width).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 1);

    // ── Step 3: Question pane accessible ──────────────────────────────────
    const questionPane = page.getByTestId("question-pane");
    await expect(questionPane).toBeVisible();

    // Answer textarea must be reachable
    const answerTextarea = page.getByTestId("answer-textarea");
    await expect(answerTextarea).toBeVisible({ timeout: 5_000 });

    // Scroll to the textarea so it is in view
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
    expect(saveBtnBox).not.toBeNull();
    expect(saveBtnBox!.x).toBeGreaterThanOrEqual(0);
    expect(saveBtnBox!.x + saveBtnBox!.width).toBeLessThanOrEqual(IPHONE_VIEWPORT.width + 1);
    expect(saveBtnBox!.y + saveBtnBox!.height).toBeLessThanOrEqual(
      IPHONE_VIEWPORT.height + 10, // 10 px tolerance for sub-pixel rendering
    );

    // Click Save
    await saveBtn.click();
    // Toast confirmation (or at minimum no error toast)
    // The page should not navigate away
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 5_000 });

    // ── Step 6: No proctoring widget overlaps the footer actions ──────────
    const footerActions = page.getByTestId("footer-actions");
    await footerActions.scrollIntoViewIfNeeded();
    const footerBox = await footerActions.boundingBox();
    expect(footerBox).not.toBeNull();

    // Webcam widget (right-4 bottom area) — check it is NOT overlapping the footer
    const webcamWidget = page.locator('.fixed').filter({ has: page.locator('text=Proctor cam') });
    const webcamCount = await webcamWidget.count();
    if (webcamCount > 0) {
      const wcBox = await webcamWidget.first().boundingBox();
      if (wcBox && footerBox) {
        // No vertical overlap between footer actions and webcam widget
        const footerBottom = footerBox!.y + footerBox!.height;
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
    await expect(answerTextarea).toBeVisible({ timeout: 10_000 });
    await answerTextarea.fill("Natural justice encompasses audi alteram partem and nemo judex in causa sua.");

    const saveBtn = page.getByTestId("btn-save-answer");
    await saveBtn.scrollIntoViewIfNeeded();
    await saveBtn.click();

    // ── Step 3: Finish and land on summary ────────────────────────────────
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

  test("timer badge is within the landscape viewport", async ({ page }) => {
    // ── Join ──────────────────────────────────────────────────────────────
    await page.goto("/mylawacad/studio/join");

    const codeInput = page.getByTestId("code-input");
    await codeInput.fill(code);
    await page.getByRole("button", { name: /verify code/i }).click();

    const nameInput = page.getByTestId("name-input");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Landscape Timer Checker");
    await page.getByRole("button", { name: /begin assessment/i }).click();

    // ── Attempt page ──────────────────────────────────────────────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

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
    if (webcamCount > 0) {
      const wcBox = await webcamWidget.first().boundingBox();
      if (wcBox && footerBox) {
        // The webcam widget must not vertically overlap the footer actions area.
        // Either the widget ends above the footer start, or starts below the footer end.
        const footerTop = footerBox.y;
        const footerBottom = footerBox.y + footerBox.height;
        const wcTop = wcBox.y;
        const wcBottom = wcBox.y + wcBox.height;
        const overlaps = wcTop < footerBottom && wcBottom > footerTop;
        expect(
          overlaps,
          `Webcam widget (y=${wcTop}–${wcBottom}) overlaps footer actions (y=${footerTop}–${footerBottom}) in landscape mode`,
        ).toBe(false);
      }
    }

    // ── Finish button (top bar) is accessible in landscape ────────────────
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

    // ── Attempt page ──────────────────────────────────────────────────────
    await expect(page).toHaveURL(/\/studio\/attempt\/[^/]+$/, { timeout: 15_000 });

    // Timer visible in landscape
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
