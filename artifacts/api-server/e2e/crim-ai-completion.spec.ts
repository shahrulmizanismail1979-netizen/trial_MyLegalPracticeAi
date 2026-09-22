import { expect, test, type Locator, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { eq } from "drizzle-orm";
import {
  crimAccessCodesTable,
  crimMatters,
  crimSavedWork,
  db,
} from "@workspace/db";

/**
 * Bounded browser proof for the MyCrimAI completion contract.
 *
 * Provider traffic is deliberately replaced at the browser boundary. All
 * authentication, matter and saved-work requests still use the real server and
 * database. A stream is complete only after the backend's terminal
 * { done: true, complete: true } event; an EOF without that event must never
 * expose save or export actions.
 */
test.setTimeout(170_000);
test.use({ actionTimeout: 10_000 });
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:80";
const RUN_ID = `crim-completion-${Date.now()}-${randomBytes(4).toString("hex")}`;
const ACCESS_CODE = `E2ECRIM${randomBytes(6).toString("hex").toUpperCase()}`;
const MATTER_TITLE = `PP v Completion Proof ${RUN_ID}`;
const COMPLETE_TEXT = `# COMPLETED CRIMINAL DRAFT

## Submission
This completed work product belongs to ${RUN_ID}.

1. The terminal completion event was received.
2. The draft may now be filed and exported.`;

let codeId: number | undefined;
let matterId: number | undefined;
let savedWorkId: number | undefined;

type ToolProof = {
  name: string;
  path: string;
  endpoint: string;
  submit: (page: Page) => Locator;
  prepare: (page: Page) => Promise<void>;
};

async function chooseFirst(trigger: Locator, page: Page) {
  await trigger.click();
  await page.getByRole("option").first().click();
}

async function fillVisibleTextareas(page: Page) {
  const fields = page.locator("textarea");
  await expect(fields.first()).toBeEditable({ timeout: 10_000 });
  for (let index = 0; index < (await fields.count()); index += 1) {
    const field = fields.nth(index);
    if (await field.isEditable()) {
      await field.fill(`Bounded completion input ${RUN_ID}`);
    }
  }
}

const TOOLS: ToolProof[] = [
  {
    name: "AI Legal Research",
    path: "research",
    endpoint: "/api/crim/ai/legal-research",
    prepare: async (page) =>
      page.getByPlaceholder("Ask about Malaysian criminal law...").fill(`Research ${RUN_ID}`),
    submit: (page) => page.getByTestId("button-send-research"),
  },
  {
    name: "Case Analyzer",
    path: "case-analyzer",
    endpoint: "/api/crim/ai/analyze-case",
    prepare: async (page) =>
      page.getByTestId("textarea-case-facts").fill(`Bounded case facts ${RUN_ID}`),
    submit: (page) => page.getByTestId("button-analyze-case"),
  },
  {
    name: "Charge Sheet Analyzer",
    path: "charge-analyzer",
    endpoint: "/api/crim/ai/analyze-charge",
    prepare: async (page) =>
      page.getByPlaceholder("Paste the charge sheet text here...").fill(`Charge ${RUN_ID}`),
    submit: (page) => page.getByTestId("button-analyze-charge"),
  },
  {
    name: "Cross-Examination Generator",
    path: "cross-examination",
    endpoint: "/api/crim/ai/cross-examination",
    prepare: async (page) =>
      page.getByPlaceholder("Paste the witness statement here...").fill(`Statement ${RUN_ID}`),
    submit: (page) => page.getByTestId("button-generate-questions"),
  },
  {
    name: "Witness Examination Practice",
    path: "witness-practice",
    endpoint: "/api/crim/ai/witness-practice",
    prepare: async (page) => {
      await chooseFirst(page.getByTestId("select-examination-type"), page);
      await chooseFirst(page.getByTestId("select-witness-type"), page);
      await fillVisibleTextareas(page);
    },
    submit: (page) => page.getByTestId("button-start-witness-session"),
  },
  {
    name: "Judge Response Practice",
    path: "judge-practice",
    endpoint: "/api/crim/ai/judge-practice",
    prepare: async (page) => {
      await chooseFirst(page.getByTestId("select-judge-type"), page);
      await fillVisibleTextareas(page);
    },
    submit: (page) => page.getByTestId("button-start-judge-session"),
  },
  {
    name: "Sentencing Predictor",
    path: "sentencing",
    endpoint: "/api/crim/ai/sentencing",
    prepare: async (page) => fillVisibleTextareas(page),
    submit: (page) => page.getByRole("button", { name: "Predict Sentencing Range" }),
  },
  {
    name: "Legal Opinion Writer",
    path: "legal-opinion",
    endpoint: "/api/crim/ai/legal-opinion",
    prepare: async (page) => fillVisibleTextareas(page),
    submit: (page) => page.getByRole("button", { name: "Generate Legal Opinion" }),
  },
  {
    name: "Case Strategy Planner",
    path: "case-strategy",
    endpoint: "/api/crim/ai/case-strategy",
    prepare: async (page) => fillVisibleTextareas(page),
    submit: (page) => page.getByRole("button", { name: "Generate Strategy Plan" }),
  },
  {
    name: "Appeal Grounds Analyzer",
    path: "appeal-grounds",
    endpoint: "/api/crim/ai/appeal-grounds",
    prepare: async (page) => fillVisibleTextareas(page),
    submit: (page) => page.getByRole("button", { name: "Identify Appeal Grounds" }),
  },
];

async function expectNoOutputActions(page: Page) {
  await expect(page.getByTestId("panel-save-to-matter")).toHaveCount(0);
  await expect(page.getByTestId("button-export-txt")).toHaveCount(0);
  await expect(page.getByTestId("button-export-word")).toHaveCount(0);
}

async function expectCompletedActions(page: Page) {
  await expect(page.getByTestId("panel-save-to-matter")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("button-export-txt").last()).toBeVisible();
  await expect(page.getByTestId("button-export-word").last()).toBeVisible();
}

async function expectTxtDownload(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("button-export-txt").last().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.txt$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  expect(await fs.readFile(path!, "utf8")).toContain(`This completed work product belongs to ${RUN_ID}.`);
}

async function expectDocxDownload(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("button-export-word").last().click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = await fs.readFile(path!);
  expect(bytes.length).toBeGreaterThan(500);
  expect(bytes.subarray(0, 2).toString("ascii")).toBe("PK");
}

test.beforeAll(async () => {
  const [code] = await db
    .insert(crimAccessCodesTable)
    .values({
      code: ACCESS_CODE,
      label: `MyCrimAI completion proof ${RUN_ID}`,
      tier: "full",
      isActive: true,
      // A local QA credential, intentionally not a Stripe/customer record.
      createdAt: new Date("2020-01-01T00:00:00.000Z"),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    })
    .returning({ id: crimAccessCodesTable.id });
  codeId = code.id;
});

test.afterAll(async () => {
  // Delete only IDs created by this run, even when an assertion failed midway.
  if (savedWorkId !== undefined) {
    await db.delete(crimSavedWork).where(eq(crimSavedWork.id, savedWorkId));
  }
  if (matterId !== undefined) {
    await db.delete(crimMatters).where(eq(crimMatters.id, matterId));
  }
  if (codeId !== undefined) {
    await db.delete(crimAccessCodesTable).where(eq(crimAccessCodesTable.id, codeId));
  }

  if (savedWorkId !== undefined) {
    expect(await db.select().from(crimSavedWork).where(eq(crimSavedWork.id, savedWorkId))).toEqual([]);
  }
  if (matterId !== undefined) {
    expect(await db.select().from(crimMatters).where(eq(crimMatters.id, matterId))).toEqual([]);
  }
  if (codeId !== undefined) {
    expect(
      await db.select().from(crimAccessCodesTable).where(eq(crimAccessCodesTable.id, codeId)),
    ).toEqual([]);
  }
});

test("all 11 MyCrimAI task pages honor completion, filing, retry and export contracts", async ({
  page,
}) => {
  const login = await page.request.post("/api/crim/auth/verify", {
    data: { accessCode: ACCESS_CODE },
  });
  expect(login.status(), await login.text()).toBe(200);

  const matterResponse = await page.request.post("/api/crim/matters", {
    data: {
      title: MATTER_TITLE,
      fileRef: `E2E/${RUN_ID}`,
      stage: "trial",
      charge: "Bounded completion proof charge",
      accusedName: `E2E Accused ${RUN_ID}`,
      notes: `Created only for ${RUN_ID}`,
    },
  });
  expect(matterResponse.status(), await matterResponse.text()).toBe(201);
  matterId = ((await matterResponse.json()) as { id: number }).id;

  const attempts = new Map<string, number>();
  await page.route("**/api/crim/ai/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const attempt = (attempts.get(path) ?? 0) + 1;
    attempts.set(path, attempt);

    if (path === "/api/crim/ai/draft-document" && attempt === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Deterministic provider unavailable" }),
      });
      return;
    }

    const complete =
      path === "/api/crim/ai/draft-document" ? attempt >= 2 : attempt >= 2;
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: complete
        ? `data: ${JSON.stringify({ content: COMPLETE_TEXT })}\n\n` +
          `data: ${JSON.stringify({ done: true, complete: true })}\n\n`
        : `data: ${JSON.stringify({ content: `# PARTIAL ${RUN_ID}` })}\n\n`,
    });
  });

  // Document Drafter: explicit HTTP error, same-form retry, real persistence,
  // hard reload/reopen, and both actual download formats.
  await page.goto(`${BASE}/mycrimai/workspace/ai/document-drafter`);
  await chooseFirst(page.getByTestId("select-document-type"), page);
  await page.getByTestId("textarea-case-details").fill(`Case details ${RUN_ID}`);
  await page.getByTestId("button-draft-document").click();
  await expect(page.getByText("Deterministic provider unavailable", { exact: true })).toBeVisible();
  await expectNoOutputActions(page);

  await page.getByTestId("button-draft-document").click();
  await expectCompletedActions(page);
  await expectTxtDownload(page);
  await expectDocxDownload(page);

  const savePanel = page.getByTestId("panel-save-to-matter");
  await savePanel.getByTestId("button-existing-matter").click();
  await savePanel.getByTestId("select-existing-matter").click();
  await page.getByRole("option", { name: MATTER_TITLE, exact: true }).click();
  const saveResponsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/crim/saved-work",
  );
  await savePanel.getByTestId("button-file-here").click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status(), await saveResponse.text()).toBe(201);
  savedWorkId = ((await saveResponse.json()) as { id: number }).id;
  await expect(page.getByTestId("panel-saved-to-matter")).toContainText(MATTER_TITLE);

  await page.getByTestId("button-open-matter").click();
  await expect(page).toHaveURL(new RegExp(`/mycrimai/workspace/matters/${matterId}$`));
  await page.reload();
  await page.getByRole("tab", { name: /Documents/ }).click();
  await page.getByTestId(`card-document-${savedWorkId}`).click();
  await expect(page.getByTestId("text-document-content")).toContainText(
    `This completed work product belongs to ${RUN_ID}.`,
  );
  await expectTxtDownload(page);
  await expectDocxDownload(page);

  // Every remaining task page gets both terminal states. No form is silently
  // skipped. Each phase records its own verdict so one defect cannot prevent
  // later forms from being exercised; the proof fails once, after printing the
  // complete tested/blocked table.
  const verdicts: Array<{ tool: string; truncated: string; completed: string }> = [];
  const failures: string[] = [];
  for (const tool of TOOLS) {
    const verdict = { tool: tool.name, truncated: "TESTED", completed: "TESTED" };
    try {
      await test.step(`${tool.name}: truncated EOF blocks output actions`, async () => {
        await page.goto(`${BASE}/mycrimai/workspace/ai/${tool.path}`);
        await tool.prepare(page);
        await expect(tool.submit(page)).toBeEnabled();
        await tool.submit(page).click();
        await expect
          .poll(() => attempts.get(tool.endpoint) ?? 0, { timeout: 10_000 })
          .toBe(1);
        await expectNoOutputActions(page);
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message.split("\n")[0] : String(error);
      verdict.truncated = `BLOCKED/FAILED: ${detail}`;
      failures.push(`${tool.name} truncated EOF: ${detail}`);
    }

    try {
      await test.step(`${tool.name}: terminal event enables output actions`, async () => {
        await page.goto(`${BASE}/mycrimai/workspace/ai/${tool.path}`);
        await tool.prepare(page);
        await expect(tool.submit(page)).toBeEnabled();
        await tool.submit(page).click();
        await expect
          .poll(() => attempts.get(tool.endpoint) ?? 0, { timeout: 10_000 })
          .toBe(2);
        await expectCompletedActions(page);
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message.split("\n")[0] : String(error);
      verdict.completed = `BLOCKED/FAILED: ${detail}`;
      failures.push(`${tool.name} completed stream: ${detail}`);
    }
    verdicts.push(verdict);
  }
  console.table([
    { tool: "Document Drafter", truncated: "HTTP ERROR→RETRY TESTED", completed: "TESTED + FILED/REOPENED/DOWNLOADED" },
    ...verdicts,
  ]);
  expect(failures, `MyCrimAI completion failures:\n${failures.join("\n")}`).toEqual([]);
});