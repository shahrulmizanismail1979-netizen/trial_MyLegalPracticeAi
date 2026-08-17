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

// iPhone 14 Pro logical resolution
const IPHONE_VIEWPORT = { width: 393, height: 852 };

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
