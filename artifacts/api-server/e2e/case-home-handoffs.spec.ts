import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { pool } from "@workspace/db";

/**
 * Cross-portal Case Home regression suite.
 *
 * The suite deliberately exercises each real practitioner artifact through the
 * shared localhost:80 proxy. Matter records are created through the same
 * authenticated browser context used by the page, then removed at the end of
 * each flow.
 */

test.setTimeout(120_000);
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:80";
const RUN_ID = `case-home-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const EDIT_MARKER = `Edited in browser ${RUN_ID}`;
let cachedLitSessionValue: string | null = null;
const trackedSharedMatterRefs: Array<{ portal: string; matterId: number }> = [];

type PortalKey =
  | "acc"
  | "lit"
  | "lit-irac"
  | "crim"
  | "sya"
  | "corp"
  | "ccb"
  | "convey";

type PortalFlow = {
  key: PortalKey;
  label: string;
  basePath: string;
  apiBase: string;
  detailPath: (matterId: number) => string;
  destinationPath: RegExp;
  matterParam: "matter" | "matterId";
  matterBody: Record<string, unknown>;
};

const PORTALS: PortalFlow[] = [
  {
    key: "acc",
    label: "Accident",
    basePath: "/myaccidentai",
    apiBase: "/api/accident/matters",
    detailPath: (id) => `/myaccidentai/workspace/matters/${id}`,
    destinationPath: /^\/myaccidentai\/workspace$/,
    matterParam: "matterId",
    matterBody: {
      matterType: "running-down",
      actingFor: "Plaintiff",
      plaintiff: "E2E Plaintiff",
    },
  },
  {
    key: "lit",
    label: "Litigation",
    basePath: "/mylitai",
    apiBase: "/api/lit/matters",
    detailPath: (id) => `/mylitai/app/matters/${id}`,
    destinationPath: /^\/mylitai\/app\/practice\/writ-action$/,
    matterParam: "matter",
    matterBody: { matterType: "writ-action", actingFor: "Plaintiff" },
  },
  {
    key: "lit-irac",
    label: "Litigation IRAC",
    basePath: "/mylitai-irac",
    apiBase: "/api/lit/matters",
    detailPath: (id) => `/mylitai-irac/matters/${id}`,
    destinationPath: /^\/mylitai-irac\/analyzer$/,
    matterParam: "matter",
    matterBody: { matterType: "writ-action", actingFor: "Plaintiff" },
  },
  {
    key: "crim",
    label: "Criminal",
    basePath: "/mycrimai",
    apiBase: "/api/crim/matters",
    detailPath: (id) => `/mycrimai/workspace/matters/${id}`,
    destinationPath: /^\/mycrimai\/workspace\/ai\/case-analyzer$/,
    matterParam: "matterId",
    matterBody: { stage: "trial", charge: "E2E charge", accusedName: "E2E Accused" },
  },
  {
    key: "sya",
    label: "Syariah",
    basePath: "/mysyariahai",
    apiBase: "/api/sya/matters",
    detailPath: (id) => `/mysyariahai/matters/${id}`,
    destinationPath: /^\/mysyariahai\/case-analysis$/,
    matterParam: "matterId",
    matterBody: { matterType: "cerai", plaintiff: "E2E Plaintiff" },
  },
  {
    key: "corp",
    label: "Corporate Legal",
    basePath: "/mycorplegalai",
    apiBase: "/api/corp/matters",
    detailPath: (id) => `/mycorplegalai/matters/${id}`,
    destinationPath: /^\/mycorplegalai\/tools\/legal-opinion$/,
    matterParam: "matterId",
    matterBody: { matterType: "Corporate Finance", reference: `CORP-${RUN_ID}` },
  },
  {
    key: "ccb",
    label: "CCB Litigation",
    basePath: "/myccblitai",
    apiBase: "/api/ccb/matters",
    detailPath: (id) => `/myccblitai/workspace/matters/${id}`,
    destinationPath: /^\/myccblitai\/workspace\/tool\/legal-opinion$/,
    matterParam: "matter",
    matterBody: { matterType: "Banking Litigation", reference: `CCB-${RUN_ID}` },
  },
  {
    key: "convey",
    label: "Conveyancing",
    basePath: "/myconveylitai",
    apiBase: "/api/convey/matters",
    detailPath: (id) => `/myconveylitai/matters/${id}`,
    destinationPath: /^\/myconveylitai\/dashboard$/,
    matterParam: "matter",
    matterBody: { matterType: "SPA", status: "open", reference: `CON-${RUN_ID}` },
  },
];

function bodyText(response: Awaited<ReturnType<APIRequestContext["post"]>>) {
  return response.text().catch(() => "<unreadable response>");
}

async function expectOk(
  response: Awaited<ReturnType<APIRequestContext["post"]>>,
  label: string,
) {
  expect(response.ok(), `${label}: ${response.status()} ${await bodyText(response)}`).toBeTruthy();
}

async function retainLocalHttpSessionCookie(
  page: Page,
  response: Awaited<ReturnType<APIRequestContext["post"]>>,
  cookieName: string,
) {
  if ((await page.context().cookies()).some((cookie) => cookie.name === cookieName)) return;
  const setCookie = response.headers()["set-cookie"];
  const encoded = setCookie
    ?.split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
    .find((cookie) => cookie.trimStart().startsWith(`${cookieName}=`))
    ?.split(";")[0];
  const separator = encoded?.indexOf("=") ?? -1;
  if (!encoded || separator < 1) {
    throw new Error(`${cookieName} was not retained and was missing from the login response`);
  }
  await page.context().addCookies([
    {
      name: encoded.slice(0, separator).trim(),
      value: encoded.slice(separator + 1),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function authenticate(
  page: Page,
  portal: PortalKey,
  code: string,
): Promise<Record<string, string>> {
  if (portal === "acc") {
    const response = await page.request.post("/api/accident/auth/verify-code", {
      data: { code },
    });
    await expectOk(response, "Accident login");
    return {};
  }

  if (portal === "lit" || portal === "lit-irac") {
    if (cachedLitSessionValue) {
      await page.context().addCookies([
        {
          name: "lit.sid",
          value: cachedLitSessionValue,
          domain: "localhost",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      await page.addInitScript(() => {
        localStorage.setItem("mylitai_auth_verified", "true");
      });
      return {};
    }
    const response = await page.request.post("/api/lit/auth/login", {
      data: { password: code },
    });
    await expectOk(response, "Lit login");
    // The Lit cookie is SameSite=None. Chromium intentionally drops that
    // cookie on this suite's plain-http localhost proxy unless it is Secure.
    // Keep the server-issued signed value but make the test-only jar Lax.
    await retainLocalHttpSessionCookie(page, response, "lit.sid");
    cachedLitSessionValue =
      (await page.context().cookies()).find((cookie) => cookie.name === "lit.sid")?.value ?? null;
    expect(cachedLitSessionValue, "Lit login should leave a reusable session cookie").toBeTruthy();
    await page.addInitScript(() => {
      localStorage.setItem("mylitai_auth_verified", "true");
    });
    return {};
  }

  if (portal === "crim") {
    const response = await page.request.post("/api/crim/auth/verify", {
      data: { accessCode: code },
    });
    await expectOk(response, "Criminal login");
    return {};
  }

  if (portal === "sya") {
    const response = await page.request.post("/api/sya/auth/verify", {
      data: { accessCode: code },
    });
    await expectOk(response, "Syariah login");
    await page.addInitScript(() => {
      localStorage.setItem("mysyariahai.gate", "civil");
    });
    return {};
  }

  if (portal === "corp") {
    const response = await page.request.post("/api/corp/legal/verify-password", {
      data: { password: code },
    });
    await expectOk(response, "Corporate login");
    const body = (await response.json()) as { success?: boolean; token?: string };
    expect(body.success).toBe(true);
    expect(body.token).toBeTruthy();
    await page.addInitScript((token) => {
      localStorage.setItem("auth_token", token);
    }, body.token!);
    return { Authorization: `Bearer ${body.token}` };
  }

  if (portal === "ccb") {
    const response = await page.request.post("/api/ccb/auth/verify", {
      data: { code },
    });
    await expectOk(response, "CCB login");
    const body = (await response.json()) as { success?: boolean; token?: string };
    expect(body.success).toBe(true);
    expect(body.token).toBeTruthy();
    await page.addInitScript((token) => {
      localStorage.setItem("myccblitai_access_token", token);
    }, body.token!);
    return { Authorization: `Bearer ${body.token}` };
  }

  const response = await page.request.post("/api/convey/auth", {
    data: { accessCode: code },
  });
  await expectOk(response, "Conveyancing login");
  const body = (await response.json()) as { success?: boolean; token?: string };
  expect(body.success).toBe(true);
  expect(body.token).toBeTruthy();
  await page.addInitScript((token) => {
    localStorage.setItem("convey_token", token);
    localStorage.setItem("convey_auth", "true");
  }, body.token!);
  return { Authorization: `Bearer ${body.token}` };
}

async function createMatter(
  page: Page,
  portal: PortalFlow,
  headers: Record<string, string>,
): Promise<{ id: number; title: string }> {
  const title = `E2E ${portal.label} Case Home ${RUN_ID}`;
  const response = await page.request.post(portal.apiBase, {
    headers,
    data: {
      title,
      clientName: `E2E Client ${RUN_ID}`,
      notes: `Editable Case Home context ${RUN_ID}`,
      ...portal.matterBody,
    },
  });
  await expectOk(response, `${portal.label} create matter`);
  const body = (await response.json()) as { id?: number };
  expect(body.id, `${portal.label} create response should include id`).toBeTruthy();
  trackedSharedMatterRefs.push({
    portal: portal.key === "lit-irac" ? "lit" : portal.key,
    matterId: body.id!,
  });
  return { id: body.id!, title };
}

async function deleteMatter(
  page: Page,
  portal: PortalFlow,
  matterId: number,
  headers: Record<string, string>,
) {
  const response = await page.request.delete(`${portal.apiBase}/${matterId}`, { headers });
  await expectOk(response, `${portal.label} delete matter ${matterId}`);
}

async function drainTrackedCaseHomeRows() {
  const refsByPortal = new Map<string, Set<number>>();
  for (const { portal, matterId } of trackedSharedMatterRefs) {
    const ids = refsByPortal.get(portal) ?? new Set<number>();
    ids.add(matterId);
    refsByPortal.set(portal, ids);
  }
  if (refsByPortal.size === 0) return;

  const deadline = Date.now() + 45_000;
  let zeroRounds = 0;
  while (Date.now() < deadline) {
    let remaining = 0;
    for (const [portal, matterIds] of refsByPortal) {
      const ids = [...matterIds];
      await pool.query(
        `DELETE FROM case_tasks WHERE portal = $1 AND matter_id = ANY($2::int[])`,
        [portal, ids],
      );
      await pool.query(
        `DELETE FROM case_events WHERE portal = $1 AND matter_id = ANY($2::int[])`,
        [portal, ids],
      );
      await pool.query(
        `DELETE FROM case_checklists WHERE portal = $1 AND matter_id = ANY($2::int[])`,
        [portal, ids],
      );
      const residue = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM (
           SELECT 1 FROM case_tasks WHERE portal = $1 AND matter_id = ANY($2::int[])
           UNION ALL
           SELECT 1 FROM case_events WHERE portal = $1 AND matter_id = ANY($2::int[])
           UNION ALL
           SELECT 1 FROM case_checklists WHERE portal = $1 AND matter_id = ANY($2::int[])
         ) AS leftovers`,
        [portal, ids],
      );
      remaining += Number(residue.rows[0]?.count ?? 0);
    }

    zeroRounds = remaining === 0 ? zeroRounds + 1 : 0;
    if (zeroRounds >= 12) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Case Home cleanup did not converge before the 45-second deadline");
}

async function assertRowsGone(table: string, ids: number[]) {
  if (ids.length === 0) return;
  const result = await pool.query(`SELECT id FROM ${table} WHERE id = ANY($1::int[])`, [ids]);
  expect(result.rows, `${table} cleanup residue`).toEqual([]);
}

async function expectTaskInTimeline(
  page: Page,
  portal: PortalFlow,
  matterId: number,
  headers: Record<string, string>,
  taskId: number,
  status: string,
) {
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`${portal.apiBase}/${matterId}/case-home`, {
          headers,
        });
        if (!response.ok()) return `HTTP ${response.status()}`;
        const body = (await response.json()) as {
          timeline?: Array<{ source?: string; meta?: { status?: string } }>;
        };
        return body.timeline?.find((entry) => entry.source === `task:${taskId}`)?.meta?.status;
      },
      { timeout: 15_000 },
    )
    .toBe(status);
}

async function expectEditable(locator: Locator) {
  await expect(locator).toBeVisible({ timeout: 20_000 });
  await expect(locator).toBeEditable();
}

async function assertEditableMatterContext(locator: Locator, expectedContext: string) {
  await expectEditable(locator);
  const initialValue = await locator.inputValue();
  expect(initialValue).toContain(expectedContext);
  const editedValue = `${initialValue} ${EDIT_MARKER}`;
  await locator.fill(editedValue);
  await expect(locator).toHaveValue(editedValue);
}

async function assertFilingRequest(
  page: Page,
  apiPath: string,
  matterId: number,
  submit: Locator,
  matterIdInBody = true,
) {
  await page.route(
    `**${apiPath}`,
    async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: 999_999,
          matterId,
          title: `Mock filed work ${RUN_ID}`,
          kind: "analysis",
          content: "Mock content",
        }),
      });
    },
    { times: 1 },
  );
  const requestPromise = page.waitForRequest(
    (request) =>
      request.method() === "POST" && new URL(request.url()).pathname === apiPath,
  );
  await expect(submit).toBeEnabled({ timeout: 20_000 });
  await submit.click();
  const request = await requestPromise;
  if (matterIdInBody) {
    expect(request.postDataJSON()).toEqual(expect.objectContaining({ matterId }));
  }
  expect(new URL(request.url()).pathname).toBe(apiPath);
}

async function assertActualFilingTarget(
  page: Page,
  portal: PortalFlow,
  matterId: number,
  title: string,
) {
  if (portal.key === "acc") {
    await page.route(
      "**/api/accident/ai/analyze-case",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ analysis: `Mock accident analysis ${RUN_ID}` }),
        }),
      { times: 1 },
    );
    await page.getByTestId("button-analyze").click();
    const panel = page.getByTestId("panel-save-to-matter");
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByTestId("select-existing-matter")).toContainText(title);
    await assertFilingRequest(
      page,
      "/api/accident/saved-work",
      matterId,
      panel.getByTestId("button-file-here"),
    );
    return;
  }

  if (portal.key === "lit") {
    await page.route(
      /\/api\/lit\/forms\/\d+\/draft$/,
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body:
            `data: ${JSON.stringify({ content: `Mock litigation draft ${RUN_ID}` })}\n\n` +
            `data: ${JSON.stringify({ done: true })}\n\n`,
        }),
      { times: 1 },
    );
    await page.getByRole("button", { name: "Generate Draft" }).click();
    await expect(page.getByText("Draft complete")).toBeVisible({ timeout: 20_000 });
    const panel = page.getByText("Save this draft into a matter file?").locator("..");
    await expect(panel.locator("select")).toHaveValue(String(matterId));
    await assertFilingRequest(
      page,
      "/api/lit/saved-work",
      matterId,
      panel.getByRole("button", { name: "File draft here" }),
    );
    return;
  }

  if (portal.key === "lit-irac") {
    await page.route(
      "**/api/lit/irac/extract",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            caseId: `irac-${RUN_ID}`,
            pathway: "general-civil",
            files: [{ name: "case-home.txt", size: 64, type: "text/plain" }],
            totalChars: 64,
            documentCount: 1,
          }),
        }),
      { times: 1 },
    );
    await page.route(
      "**/api/lit/irac/analyze",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body:
            `data: ${JSON.stringify({ content: `Mock IRAC analysis ${RUN_ID}` })}\n\n` +
            `data: ${JSON.stringify({ done: true })}\n\n`,
        }),
      { times: 1 },
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: "case-home.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(`IRAC facts ${RUN_ID}`),
    });
    const fileButton = page.getByRole("button", { name: /^File into / });
    await expect(fileButton).toBeVisible({ timeout: 20_000 });
    await expect(fileButton).toContainText(title.slice(0, 20));
    await assertFilingRequest(page, "/api/lit/saved-work", matterId, fileButton);
    return;
  }

  if (portal.key === "crim") {
    await page.route(
      "**/api/crim/ai/analyze-case",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body:
            `data: ${JSON.stringify({ content: `Mock criminal analysis ${RUN_ID}` })}\n\n` +
            `data: ${JSON.stringify({ done: true })}\n\n`,
        }),
      { times: 1 },
    );
    await page.getByTestId("button-analyze-case").click();
    const panel = page.getByTestId("panel-save-to-matter");
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByTestId("select-existing-matter")).toContainText(title);
    await assertFilingRequest(
      page,
      "/api/crim/saved-work",
      matterId,
      panel.getByTestId("button-file-here"),
    );
    return;
  }

  if (portal.key === "sya") {
    const mockResult = {
      strengthAssessment: { overall: "Strong", score: 8, reasoning: "Mock result" },
      caseClassification: {
        primaryArea: "Family",
        subCategory: "General",
        jurisdiction: "Malaysia",
      },
      predictedOutcomes: [],
      precedentCases: [],
      strategicAdvice: {
        strengths: [],
        weaknesses: [],
        recommendations: [],
        evidenceNeeded: [],
      },
    };
    await page.route(
      "**/api/sya/case-analysis/predict",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body: `data: ${JSON.stringify({ content: JSON.stringify(mockResult) })}\n\n`,
        }),
      { times: 1 },
    );
    await page.getByRole("button", { name: "Analyze Case" }).click();
    const panel = page.getByTestId("save-to-matter-panel");
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByTestId("save-to-matter-select")).toContainText(title);
    await assertFilingRequest(
      page,
      `/api/sya/matters/${matterId}/work`,
      matterId,
      panel.getByTestId("save-to-matter-file"),
      false,
    );
    return;
  }

  if (portal.key === "corp") {
    await page
      .getByPlaceholder(
        "Set out or supplement the relevant factual background, parties involved, transaction details, and key commercial terms...",
      )
      .fill(`Mock corporate facts ${RUN_ID}`);
    await page.route(
      "**/api/corp/legal/ai-tools/chat",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body:
            `data: ${JSON.stringify({ content: `Mock corporate opinion ${RUN_ID}` })}\n\n` +
            "data: [DONE]\n\n",
        }),
      { times: 1 },
    );
    await page.getByRole("button", { name: "Generate", exact: true }).click();
    const panel = page.getByText("Save this draft into a matter file?").locator("..");
    await expect(panel.locator("select")).toHaveValue(String(matterId), { timeout: 20_000 });
    await assertFilingRequest(
      page,
      "/api/corp/saved-work",
      matterId,
      panel.getByRole("button", { name: "File draft here" }),
    );
    return;
  }

  if (portal.key === "ccb") {
    const requiredFields = page.locator(
      '[data-testid^="input-"]:visible, [data-testid^="select-"]:visible',
    );
    for (let index = 0; index < (await requiredFields.count()); index += 1) {
      const field = requiredFields.nth(index);
      if ((await field.inputValue()) === "") {
        if ((await field.evaluate((element) => element.tagName)) === "SELECT") {
          await field.selectOption({ index: 1 });
        } else {
          await field.fill(`Mock CCB detail ${RUN_ID}`);
        }
      }
    }
    await page.route(
      "**/api/ccb/tools/generate",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/event-stream",
          body:
            `data: ${JSON.stringify({ content: `Mock CCB opinion ${RUN_ID}` })}\n\n` +
            "data: [DONE]\n\n",
        }),
      { times: 1 },
    );
    await page.getByTestId("button-generate").click();
    const panel = page.getByText("Save this draft into a matter file?").locator("..");
    await expect(panel.locator("select")).toHaveValue(String(matterId), { timeout: 20_000 });
    await assertFilingRequest(
      page,
      "/api/ccb/saved-work",
      matterId,
      panel.getByRole("button", { name: "File draft here" }),
    );
    return;
  }

  await page.getByTestId("input-review-clause").fill(`Mock SPA clause ${RUN_ID}`);
  await page.route(
    "**/api/convey/review-spa",
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ review: `Mock conveyancing review ${RUN_ID}` }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Review Clause" }).click();
  const panel = page.getByText("Save this into a matter file?").locator("..");
  await expect(panel.locator("select")).toHaveValue(String(matterId), { timeout: 20_000 });
  await assertFilingRequest(
    page,
    "/api/convey/saved-work",
    matterId,
    panel.getByRole("button", { name: "File here" }),
  );
}

async function assertDestinationContext(
  page: Page,
  portal: PortalFlow,
  matterId: number,
  title: string,
) {
  if (portal.key === "acc") {
    const facts = page.getByTestId("textarea-case-facts");
    await assertEditableMatterContext(facts, title);
    await expect(page.getByText(/pre-filled from your matter file/i)).toBeVisible();
    return;
  }

  if (portal.key === "lit") {
    await expect(page.getByText(new RegExp(`Working in file:\\s*${title}`))).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/drafts made here will be filed into this matter/i)).toBeVisible();
    await page.getByRole("button", { name: "AI Draft This Document" }).first().click();
    const caseDetails = page.getByLabel("Core Facts & Relief Sought");
    await assertEditableMatterContext(caseDetails, title);
    return;
  }

  if (portal.key === "lit-irac") {
    await expect(page.getByText("Matter Context (editable)")).toBeVisible({ timeout: 20_000 });
    const context = page.locator("textarea:visible").first();
    await assertEditableMatterContext(context, title);
    await expect(page.getByText(/filed directly into this matter/i)).toBeVisible();
    return;
  }

  if (portal.key === "crim") {
    const facts = page.getByTestId("textarea-case-facts");
    await assertEditableMatterContext(facts, RUN_ID);
    await expect(page.getByText(title).first()).toBeVisible();
    return;
  }

  if (portal.key === "sya") {
    const facts = page.getByPlaceholder(/Describe the case facts in detail/i);
    await assertEditableMatterContext(facts, title);
    await expect(page.getByText(title).first()).toBeVisible();
    return;
  }

  if (portal.key === "corp") {
    await expect(page.getByText(/Fields pre-filled from matter/i)).toBeVisible({ timeout: 20_000 });
    await assertEditableMatterContext(
      page.getByPlaceholder("e.g., Proposed Franchise Arrangement with XYZ Sdn Bhd"),
      title,
    );
    await expect(page.getByText(title).first()).toBeVisible();
    return;
  }

  if (portal.key === "ccb") {
    await assertEditableMatterContext(page.getByLabel("Subject Matter"), title);
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
    return;
  }

  const context = page.getByTestId("input-review-context");
  await assertEditableMatterContext(context, title);
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
  expect(matterId).toBeGreaterThan(0);
}

async function exerciseHandoff(
  page: Page,
  portal: PortalFlow,
  matterId: number,
  title: string,
) {
  await page.goto(`${BASE}${portal.detailPath(matterId)}`);
  await page.waitForLoadState("domcontentloaded");

  const panel = page.getByLabel(`Case home for matter ${matterId}`);
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText("Outstanding Tasks")).toBeVisible();
  await expect(panel.getByText("Latest Activity")).toBeVisible();

  const action = panel.locator(".ch-action-link");
  await expect(action).toBeVisible();
  const href = await action.getAttribute("href");
  expect(href, `${portal.label} Case Home action should have an href`).toBeTruthy();
  const target = new URL(href!, BASE);
  expect(
    target.pathname.startsWith(`${portal.basePath}/`) || target.pathname === portal.basePath,
    `${portal.label} action escaped its artifact base path: ${target.pathname}`,
  ).toBe(true);
  expect(target.searchParams.get(portal.matterParam)).toBe(String(matterId));

  await action.click();
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
    .toMatch(portal.destinationPath);
  expect(new URL(page.url()).pathname.startsWith(portal.basePath)).toBe(true);
  if (portal.key !== "convey") {
    expect(new URL(page.url()).searchParams.get(portal.matterParam)).toBe(String(matterId));
  }
  await expect(
    page.locator(
      `[data-testid="case-home-handoff-target"][data-matter-id="${matterId}"]`,
    ).first(),
  ).toBeVisible({ timeout: 30_000 });
  await assertDestinationContext(page, portal, matterId, title);
  await assertActualFilingTarget(page, portal, matterId, title);
}

for (const portal of PORTALS) {
  test(`${portal.label} keeps the Case Home handoff scoped to its matter and artifact`, async ({
    page,
  }) => {
    const masterCode = process.env.MASTER_ACCESS_CODE;
    if (!masterCode) throw new Error("MASTER_ACCESS_CODE env var is required");

    if (portal.key === "acc") {
      await page.setViewportSize({ width: 390, height: 844 });
    }

    const headers = await authenticate(page, portal.key, masterCode);
    const matter = await createMatter(page, portal, headers);

    try {
      await exerciseHandoff(page, portal, matter.id, matter.title);

      if (portal.key === "acc") {
        await page.goto(`${BASE}${portal.detailPath(matter.id)}`);
        const panel = page.getByLabel(`Case home for matter ${matter.id}`);
        await expect(panel).toBeVisible({ timeout: 30_000 });
        const overflow = await panel.evaluate((element) => ({
          panel: element.scrollWidth - element.clientWidth,
          document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
        expect(overflow.panel, "390px Case Home panel should not overflow horizontally").toBeLessThanOrEqual(1);
        expect(overflow.document, "390px page should not overflow horizontally").toBeLessThanOrEqual(1);
      }
    } finally {
      await deleteMatter(page, portal, matter.id, headers);
    }
  });
}

test("MyLitAI matter deep links survive a hard reload and reload saved preparation", async ({
  page,
}) => {
  const masterCode = process.env.MASTER_ACCESS_CODE;
  if (!masterCode) throw new Error("MASTER_ACCESS_CODE env var is required");

  const portal = PORTALS.find((candidate) => candidate.key === "lit")!;
  const headers = await authenticate(page, portal.key, masterCode);
  const matter = await createMatter(page, portal, headers);
  const preparation = `Reloaded preparation ${RUN_ID}`;

  try {
    await page.goto(`${BASE}${portal.detailPath(matter.id)}`);
    await expect(page.getByText(matter.title).first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("tab", { name: /preparation/i }).click();
    const issues = page.getByTestId("input-matter-issues");
    await expect(issues).toBeVisible({ timeout: 30_000 });
    await issues.fill(preparation);
    const [saveResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "PATCH" &&
          response.url().endsWith(`/api/lit/matters/${matter.id}/preparation`),
      ),
      issues.blur(),
    ]);
    expect(saveResponse.ok()).toBe(true);

    await page.reload();
    await expect(page.getByText(matter.title).first()).toBeVisible({ timeout: 30_000 });
    await page.getByRole("tab", { name: /preparation/i }).click();
    await expect(page.getByTestId("input-matter-issues")).toHaveValue(preparation, {
      timeout: 30_000,
    });
  } finally {
    await deleteMatter(page, portal, matter.id, headers);
  }
});

test("task create, update, and complete activity stays synchronized with the Case Home timeline", async ({
  page,
}) => {
  const masterCode = process.env.MASTER_ACCESS_CODE;
  if (!masterCode) throw new Error("MASTER_ACCESS_CODE env var is required");

  const portal = PORTALS.find((candidate) => candidate.key === "acc")!;
  const headers = await authenticate(page, portal.key, masterCode);
  const matter = await createMatter(page, portal, headers);
  let taskId: number | null = null;
  const taskTitle = `Prepare chronology ${RUN_ID}`;

  try {
    await page.goto(`${BASE}${portal.detailPath(matter.id)}`);
    const panel = page.getByLabel(`Case home for matter ${matter.id}`);
    await expect(panel).toBeVisible({ timeout: 30_000 });

    await panel.getByRole("button", { name: "+ New Task" }).click();
    await panel.getByLabel("Title").fill(taskTitle);
    await panel.getByLabel("Assignee").fill("E2E Lawyer");
    await panel.getByLabel("Note").fill("Created by the Case Home browser regression suite");

    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().endsWith(`${portal.apiBase}/${matter.id}/tasks`),
      ),
      panel.getByRole("button", { name: "Save Task" }).click(),
    ]);
    expect(createResponse.status()).toBe(201);
    taskId = ((await createResponse.json()) as { id: number }).id;

    const taskList = panel.getByRole("list", { name: "Tasks" });
    const timeline = panel.getByRole("list", { name: "Case timeline (newest first)" });
    await expect(taskList.getByText(taskTitle)).toBeVisible();
    await expect(timeline.getByText(`Task: ${taskTitle}`)).toBeVisible();
    await expectTaskInTimeline(page, portal, matter.id, headers, taskId, "open");

    const taskRow = taskList.getByText(taskTitle).locator("..").locator("..");
    await taskRow.getByRole("button", { name: "Edit task" }).click();
    await taskRow.getByLabel("Status").selectOption("in_progress");
    await taskRow.getByLabel("Assignee").fill("E2E Senior Lawyer");
    await taskRow.getByRole("button", { name: "Save" }).click();
    await expect(taskRow.getByText("In Progress")).toBeVisible();
    await expect(taskRow.getByText("E2E Senior Lawyer")).toBeVisible();
    await expect(timeline.getByText(`Task: ${taskTitle}`)).toBeVisible();
    await expectTaskInTimeline(page, portal, matter.id, headers, taskId, "in_progress");

    await taskRow.getByRole("checkbox", { name: `Mark "${taskTitle}" done` }).click();
    await expectTaskInTimeline(page, portal, matter.id, headers, taskId, "done");
    await expect(taskRow.getByText("Done")).toBeVisible();
    await expect(timeline.getByText(`Task: ${taskTitle}`)).toBeVisible();
  } finally {
    if (taskId) {
      const response = await page.request.delete(
        `${portal.apiBase}/${matter.id}/tasks/${taskId}`,
        { headers },
      );
      await expectOk(response, `Accident delete task ${taskId}`);
    }
    await deleteMatter(page, portal, matter.id, headers);
  }
});

const isolationCodes = {
  accA: `E2E-${RUN_ID}-ACC-A`.toUpperCase(),
  accB: `E2E-${RUN_ID}-ACC-B`.toUpperCase(),
  ccbA: `E2E-${RUN_ID}-CCB-A`.toUpperCase(),
  ccbB: `E2E-${RUN_ID}-CCB-B`.toUpperCase(),
};
const isolationCodeIds = { acc: [] as number[], ccb: [] as number[] };
const isolationMatterIds = { acc: [] as number[], ccb: [] as number[] };

test.beforeAll(async () => {
  const resetToken = process.env.SESSION_SECRET;
  if (!resetToken) throw new Error("SESSION_SECRET env var is required");
  const resetResponse = await fetch(`${BASE}/api/internal/e2e/login-rate-limit/reset`, {
    method: "POST",
    headers: { "x-case-home-e2e-token": resetToken },
  });
  if (!resetResponse.ok) {
    throw new Error(`Unable to reset the E2E login limiter (${resetResponse.status})`);
  }

  const acc = await pool.query<{ id: number }>(
    `INSERT INTO access_codes (code, label, max_users)
     VALUES ($1, $2, 5), ($3, $4, 5)
     RETURNING id`,
    [isolationCodes.accA, `Case Home A ${RUN_ID}`, isolationCodes.accB, `Case Home B ${RUN_ID}`],
  );
  isolationCodeIds.acc.push(...acc.rows.map((row) => row.id));

  const ccb = await pool.query<{ id: number }>(
    `INSERT INTO ccb_access_codes (code, label, active)
     VALUES ($1, $2, true), ($3, $4, true)
     RETURNING id`,
    [isolationCodes.ccbA, `Case Home A ${RUN_ID}`, isolationCodes.ccbB, `Case Home B ${RUN_ID}`],
  );
  isolationCodeIds.ccb.push(...ccb.rows.map((row) => row.id));
});

test.afterAll(async () => {
  if (isolationMatterIds.acc.length) {
    const deleted = await pool.query<{ id: number }>(
      `DELETE FROM acc_matters WHERE id = ANY($1::int[]) RETURNING id`,
      [isolationMatterIds.acc],
    );
    expect(deleted.rows.map((row) => row.id).sort((a, b) => a - b)).toEqual(
      [...isolationMatterIds.acc].sort((a, b) => a - b),
    );
  }
  if (isolationMatterIds.ccb.length) {
    const deleted = await pool.query<{ id: number }>(
      `DELETE FROM ccb_matters WHERE id = ANY($1::int[]) RETURNING id`,
      [isolationMatterIds.ccb],
    );
    expect(deleted.rows.map((row) => row.id).sort((a, b) => a - b)).toEqual(
      [...isolationMatterIds.ccb].sort((a, b) => a - b),
    );
  }

  // Fire-and-forget task/timeline and checklist writers can finish after their
  // originating request. Repeated scoped deletion must remain empty for a
  // quiet window, so teardown converges instead of guessing with one sleep.
  await drainTrackedCaseHomeRows();

  if (isolationCodeIds.acc.length) {
    await pool.query(`DELETE FROM access_code_usage WHERE access_code_id = ANY($1::int[])`, [
      isolationCodeIds.acc,
    ]);
    const deleted = await pool.query<{ id: number }>(
      `DELETE FROM access_codes WHERE id = ANY($1::int[]) RETURNING id`,
      [isolationCodeIds.acc],
    );
    expect(deleted.rows.map((row) => row.id).sort((a, b) => a - b)).toEqual(
      [...isolationCodeIds.acc].sort((a, b) => a - b),
    );
  }
  if (isolationCodeIds.ccb.length) {
    const deleted = await pool.query<{ id: number }>(
      `DELETE FROM ccb_access_codes WHERE id = ANY($1::int[]) RETURNING id`,
      [isolationCodeIds.ccb],
    );
    expect(deleted.rows.map((row) => row.id).sort((a, b) => a - b)).toEqual(
      [...isolationCodeIds.ccb].sort((a, b) => a - b),
    );
  }

  await assertRowsGone("acc_matters", isolationMatterIds.acc);
  await assertRowsGone("ccb_matters", isolationMatterIds.ccb);
  await assertRowsGone("access_codes", isolationCodeIds.acc);
  await assertRowsGone("ccb_access_codes", isolationCodeIds.ccb);
});

async function assertSecondTenantCannotReadOrMutate(
  owner: Page,
  other: Page,
  portal: PortalFlow,
  ownerHeaders: Record<string, string>,
  otherHeaders: Record<string, string>,
) {
  const matter = await createMatter(owner, portal, ownerHeaders);
  isolationMatterIds[portal.key as "acc" | "ccb"].push(matter.id);

  const createTask = await owner.request.post(`${portal.apiBase}/${matter.id}/tasks`, {
    headers: ownerHeaders,
    data: { title: `Private task ${RUN_ID}` },
  });
  await expectOk(createTask, `${portal.label} owner creates private task`);
  const taskId = ((await createTask.json()) as { id: number }).id;

  const foreignHome = await other.request.get(`${portal.apiBase}/${matter.id}/case-home`, {
    headers: otherHeaders,
  });
  expect(foreignHome.status()).toBe(404);

  const foreignCreate = await other.request.post(`${portal.apiBase}/${matter.id}/tasks`, {
    headers: otherHeaders,
    data: { title: `Injected task ${RUN_ID}` },
  });
  expect(foreignCreate.status()).toBe(404);

  const foreignPatch = await other.request.patch(
    `${portal.apiBase}/${matter.id}/tasks/${taskId}`,
    {
      headers: otherHeaders,
      data: { status: "done", title: `Tampered ${RUN_ID}` },
    },
  );
  expect(foreignPatch.status()).toBe(404);

  await other.goto(`${BASE}${portal.detailPath(matter.id)}`);
  await other.waitForLoadState("domcontentloaded");
  await expect(other.getByLabel(`Case home for matter ${matter.id}`)).toHaveCount(0);
  await expect(other.getByText(/could not be found|not found/i).first()).toBeVisible({
    timeout: 20_000,
  });

  const ownerHome = await owner.request.get(`${portal.apiBase}/${matter.id}/case-home`, {
    headers: ownerHeaders,
  });
  await expectOk(ownerHome, `${portal.label} owner reloads private Case Home`);
  const ownerBody = (await ownerHome.json()) as {
    tasks?: Array<{ id: number; title: string; status: string }>;
  };
  expect(ownerBody.tasks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: taskId, title: `Private task ${RUN_ID}`, status: "open" }),
    ]),
  );
  expect(ownerBody.tasks?.some((task) => task.title === `Injected task ${RUN_ID}`)).toBe(false);
}

test("a second Accident subscriber cannot read or mutate the first subscriber's Case Home", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const otherContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const other = await otherContext.newPage();
  try {
    const ownerHeaders = await authenticate(owner, "acc", isolationCodes.accA);
    const otherHeaders = await authenticate(other, "acc", isolationCodes.accB);
    await assertSecondTenantCannotReadOrMutate(
      owner,
      other,
      PORTALS.find((portal) => portal.key === "acc")!,
      ownerHeaders,
      otherHeaders,
    );
  } finally {
    await ownerContext.close();
    await otherContext.close();
  }
});

test("a second CCB subscriber cannot read or mutate the first subscriber's Case Home", async ({
  browser,
}) => {
  const ownerContext = await browser.newContext();
  const otherContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  const other = await otherContext.newPage();
  try {
    const ownerHeaders = await authenticate(owner, "ccb", isolationCodes.ccbA);
    const otherHeaders = await authenticate(other, "ccb", isolationCodes.ccbB);
    await assertSecondTenantCannotReadOrMutate(
      owner,
      other,
      PORTALS.find((portal) => portal.key === "ccb")!,
      ownerHeaders,
      otherHeaders,
    );
  } finally {
    await ownerContext.close();
    await otherContext.close();
  }
});