import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * E2E: AI Intake Briefing — MySyariahAI + MyCrimAI
 *
 * Verifies the full intake-briefing pipeline end-to-end:
 *   1. A matter is created with a supporting document upload (hasDocuments=true).
 *   2. The "AI briefing in progress" toast fires client-side.
 *   3. The server's background job writes a row to case_intake_briefing
 *      (verified by polling the authenticated GET /:id/intake-briefing endpoint
 *      until it returns 200 with structured data).
 *   4. On the matter-detail page, the IntakeBriefingPanel renders (not null)
 *      and, once expanded, shows "Read-only intake snapshot" — confirming the
 *      persisted briefing is fetched and displayed correctly.
 *
 * /api/shared/uploads/extract is intercepted so no real PDF processing is
 * needed; the extracted text is included in the matter notes, giving Gemini
 * enough context to produce a valid intake briefing.
 *
 * Portals:
 *   • MySyariahAI  — owner scheme: owner_type + owner_id (sya)
 *   • MyCrimAI     — owner scheme: access_code_id        (crim)
 */

test.setTimeout(120_000);

const BASE = "http://localhost:80";

// ── Fake upload payload ───────────────────────────────────────────────────────

// Short, portal-appropriate fake documents — kept brief to avoid Gemini truncation.
const FAKE_EXTRACT_SYA = {
  files: [
    {
      name: "e2e-sya-brief.txt",
      text: "Client Siti binti Ahmad seeks property division after divorce. Parties married 8 years. Joint matrimonial home in Kuala Lumpur. Client is plaintiff.",
      chars: 148,
    },
  ],
};

const FAKE_EXTRACT_CRIM = {
  files: [
    {
      name: "e2e-crim-brief.txt",
      text: "Client Ramesh s/o Kumar charged with drug possession under Section 12 DDA 1952. First court mention in 2 weeks. Client requests bail application.",
      chars: 145,
    },
  ],
};

function fakeSyaFile() {
  return {
    name: "e2e-sya-brief.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(FAKE_EXTRACT_SYA.files[0].text),
  };
}

function fakeCrimFile() {
  return {
    name: "e2e-crim-brief.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(FAKE_EXTRACT_CRIM.files[0].text),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Wait for a toast containing the given substring. Works for both Radix
 * (MySyariahAI) and Sonner (MyCrimAI) toast libraries by polling getByText.
 */
async function waitForToastText(page: Page, substring: string, timeout = 15_000) {
  await page
    .getByText(substring, { exact: false })
    .first()
    .waitFor({ state: "visible", timeout });
}

/**
 * Poll the authenticated intake-briefing API endpoint until it returns HTTP 200
 * (i.e. the background Gemini job has finished writing to case_intake_briefing).
 * Returns the parsed briefing JSON. Throws if the deadline is exceeded.
 */
async function pollIntakeBriefing(
  page: Page,
  url: string,
  maxWaitMs = 70_000,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const res = await page.request.get(url);
    if (res.status() === 200) {
      return (await res.json()) as Record<string, unknown>;
    }
    // 404 = not yet generated; anything else is unexpected but keep polling
    await page.waitForTimeout(3_000);
  }
  throw new Error(`Intake briefing endpoint ${url} did not return 200 within ${maxWaitMs}ms`);
}

// ── MySyariahAI ───────────────────────────────────────────────────────────────

test("MySyariahAI — intake briefing is generated and displayed after document upload", async ({
  page,
}) => {
  const masterCode = process.env.MASTER_ACCESS_CODE;
  if (!masterCode) throw new Error("MASTER_ACCESS_CODE env var is required");

  // ── 1. Set localStorage gate so the practice-gate screen is skipped ───────
  await page.addInitScript(() => {
    localStorage.setItem("mysyariahai.gate", "civil");
  });

  // ── 2. Authenticate (sets httpOnly session cookie in browser context) ──────
  const authRes = await page.request.post(`${BASE}/api/sya/auth/verify`, {
    data: { accessCode: masterCode },
  });
  expect(authRes.ok(), `sya auth: ${authRes.status()} ${await authRes.text()}`).toBeTruthy();

  // ── 3. Intercept file extraction ──────────────────────────────────────────
  await page.route("**/api/shared/uploads/extract", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FAKE_EXTRACT_SYA),
    }),
  );

  // ── 4. Navigate to matters list ───────────────────────────────────────────
  await page.goto(`${BASE}/mysyariahai/matters`);
  await page.waitForLoadState("domcontentloaded");

  // ── 5. Open new-matter dialog ─────────────────────────────────────────────
  const newBtn = page
    .getByTestId("matters-new")
    .or(page.getByTestId("matters-create-first"))
    .first();
  await newBtn.waitFor({ timeout: 20_000 });
  await newBtn.click();

  // ── 6. Fill title ─────────────────────────────────────────────────────────
  const titleInput = page.getByTestId("matter-form-title");
  await titleInput.waitFor({ timeout: 8_000 });
  const matterTitle = `E2E Intake SYA ${Date.now()}`;
  await titleInput.fill(matterTitle);

  // ── 7. Upload fake document ───────────────────────────────────────────────
  const fileInput = page.locator('[role="dialog"] input[type="file"]').first();
  await fileInput.setInputFiles(fakeSyaFile());
  await expect(page.getByText("e2e-sya-brief.txt")).toBeVisible({ timeout: 10_000 });

  // ── 8. Submit and capture matter-creation API response ────────────────────
  const [createRes] = await Promise.all([
    page.waitForResponse(
      (res) => /\/api\/sya\/matters$/.test(res.url()) && res.request().method() === "POST",
      { timeout: 20_000 },
    ),
    page.getByTestId("matter-form-submit").click(),
  ]);
  const createBody = (await createRes.json().catch(() => ({}))) as { id?: number };
  expect(
    createRes.status(),
    `Matter creation failed (${createRes.status()}): ${JSON.stringify(createBody)}`,
  ).toBe(201);
  const matterId = createBody.id!;
  expect(matterId, "API returned no matter ID").toBeTruthy();

  // ── 9. "AI briefing in progress" toast confirms hasDocuments path fired ───
  // MySyariahAI uses bilingual ts(en,bm) so accept either language.
  await waitForToastText(page, "briefing in progress");

  // ── 10. Poll the authenticated intake-briefing endpoint until 200 ─────────
  // This verifies that the background generateAndSaveIntakeBriefing job
  // completed and wrote a row to case_intake_briefing.
  const briefingUrl = `${BASE}/api/sya/matters/${matterId}/intake-briefing`;
  const briefing = await pollIntakeBriefing(page, briefingUrl);

  // Basic shape check — the generated briefing must have at least keyFacts
  expect(Array.isArray(briefing.keyFacts), "briefing.keyFacts should be an array").toBe(true);
  expect(
    (briefing.keyFacts as unknown[]).length,
    "briefing.keyFacts should be non-empty",
  ).toBeGreaterThan(0);

  // ── 11. Navigate to matter detail ─────────────────────────────────────────
  await page.goto(`${BASE}/mysyariahai/matters/${matterId}`);
  await page.waitForLoadState("domcontentloaded");

  // ── 12. IntakeBriefingPanel is rendered (collapsed header visible) ─────────
  // The panel returns null when no briefing exists; its presence means the
  // briefing was fetched successfully from the server.
  const panelHeader = page.getByText("Intake Briefing").first();
  await expect(panelHeader).toBeVisible({ timeout: 15_000 });

  // ── 13. Expand the panel and verify content ───────────────────────────────
  await panelHeader.click();
  // "Read-only intake snapshot" is always rendered in the expanded body.
  await expect(
    page.getByText("Read-only intake snapshot", { exact: false }),
  ).toBeVisible({ timeout: 5_000 });
});

// ── MyCrimAI ──────────────────────────────────────────────────────────────────

test("MyCrimAI — intake briefing is generated and displayed after document upload", async ({
  page,
}) => {
  const masterCode = process.env.MASTER_ACCESS_CODE;
  if (!masterCode) throw new Error("MASTER_ACCESS_CODE env var is required");

  // ── 1. Authenticate ───────────────────────────────────────────────────────
  const authRes = await page.request.post(`${BASE}/api/crim/auth/verify`, {
    data: { accessCode: masterCode },
  });
  expect(authRes.ok(), `crim auth: ${authRes.status()} ${await authRes.text()}`).toBeTruthy();

  // ── 2. Intercept file extraction ──────────────────────────────────────────
  await page.route("**/api/shared/uploads/extract", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(FAKE_EXTRACT_CRIM),
    }),
  );

  // ── 3. Navigate to matters list ───────────────────────────────────────────
  await page.goto(`${BASE}/mycrimai/workspace/matters`);
  await page.waitForLoadState("domcontentloaded");

  // ── 4. Open new-matter dialog ─────────────────────────────────────────────
  const newBtn = page.getByTestId("button-create-matter");
  await newBtn.waitFor({ timeout: 20_000 });
  await newBtn.click();

  // ── 5. Fill title ─────────────────────────────────────────────────────────
  const titleInput = page.getByTestId("input-new-matter-title");
  await titleInput.waitFor({ timeout: 8_000 });
  const matterTitle = `E2E Intake CRIM ${Date.now()}`;
  await titleInput.fill(matterTitle);

  // ── 6. Upload fake document ───────────────────────────────────────────────
  const fileInput = page.locator('[role="dialog"] input[type="file"]').first();
  await fileInput.setInputFiles(fakeCrimFile());
  await expect(page.getByText("e2e-crim-brief.txt")).toBeVisible({ timeout: 10_000 });

  // ── 7. Submit and capture matter-creation API response ────────────────────
  const [createRes] = await Promise.all([
    page.waitForResponse(
      (res) => /\/api\/crim\/matters$/.test(res.url()) && res.request().method() === "POST",
      { timeout: 20_000 },
    ),
    page.getByTestId("button-submit-matter").click(),
  ]);
  const createBody = (await createRes.json().catch(() => ({}))) as { id?: number };
  expect(
    createRes.status(),
    `Matter creation failed (${createRes.status()}): ${JSON.stringify(createBody)}`,
  ).toBe(201);
  const matterId = createBody.id!;
  expect(matterId, "API returned no matter ID").toBeTruthy();

  // ── 8. "AI briefing in progress" toast confirms hasDocuments path fired ───
  await waitForToastText(page, "AI briefing in progress");

  // ── 9. Poll the authenticated intake-briefing endpoint until 200 ─────────
  const briefingUrl = `${BASE}/api/crim/matters/${matterId}/intake-briefing`;
  const briefing = await pollIntakeBriefing(page, briefingUrl);

  expect(Array.isArray(briefing.keyFacts), "briefing.keyFacts should be an array").toBe(true);
  expect(
    (briefing.keyFacts as unknown[]).length,
    "briefing.keyFacts should be non-empty",
  ).toBeGreaterThan(0);

  // ── 10. Navigate to matter detail ─────────────────────────────────────────
  await page.goto(`${BASE}/mycrimai/workspace/matters/${matterId}`);
  await page.waitForLoadState("domcontentloaded");

  // ── 11. IntakeBriefingPanel is rendered (collapsed header visible) ─────────
  const panelHeader = page.getByText("Intake Briefing").first();
  await expect(panelHeader).toBeVisible({ timeout: 15_000 });

  // ── 12. Expand and verify footer text ─────────────────────────────────────
  await panelHeader.click();
  await expect(
    page.getByText("Read-only intake snapshot", { exact: false }),
  ).toBeVisible({ timeout: 5_000 });
});
