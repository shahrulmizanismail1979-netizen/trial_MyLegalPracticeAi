import { test, expect, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import { eq } from "drizzle-orm";
import { db, corpAccessCodes, corpSessions } from "@workspace/db";

/**
 * E2E: MyCorpLegalAI draft completion contract.
 *
 * The browser must only present a streamed legal work product as complete
 * after the terminal completion event. Both the specialist tool page and the
 * shared AI Drafter panel must preserve Markdown structure and keep export
 * controls attached to completed drafts only.
 */

test.setTimeout(60_000);
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:80";

const COMPLETION_DRAFT = `# BOARD RESOLUTION

## Operative Clause
The company approves the proposed transaction on the terms recorded in this resolution.

### Execution
The authorised signatories shall execute the transaction documents.

Signature: [●]

| Requirement | Owner | Deadline |
| --- | --- | --- |
| Board approval | Directors | [●] |
| Execution | Signatories | [●] |`;

const INTERRUPTED_DRAFT = `# INCOMPLETE BOARD RESOLUTION

## Operative Clause
This clause was streamed before the connection stopped.

| Requirement | Owner |
| --- | --- |
| Partial row | [●] |`;

let codeId: number | undefined;
let accessCode = "";

type StreamTerminal = {
  error?: string;
  errorCode?: string;
  done: boolean;
  complete: boolean;
};

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE}/mycorplegalai/login`);
  const accessCodeInput = page.getByPlaceholder("Access Code");
  await accessCodeInput.fill(accessCode);
  await page.getByRole("button", { name: "Authenticate", exact: true }).click();
  await expect(page).toHaveURL(/\/mycorplegalai\/dashboard$/);
  await expect(page.getByText("Practitioner", { exact: true }).first()).toBeVisible();
}

async function expectHtmlTable(page: Page, expectedHeaders: string[]): Promise<void> {
  const table = page.locator("table").last();
  await expect(table).toBeVisible();
  await expect(table.locator("thead th")).toHaveText(expectedHeaders);
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByText(/^\| Requirement \|/)).toHaveCount(0);
}

async function expectExportDownload(page: Page, expectedContent: string): Promise<void> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("button-export-txt").last().click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/\.txt$/);
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exported = await fs.readFile(downloadPath!, "utf8");
  expect(exported).toContain(expectedContent);
}

async function installControlledDraftStream(
  page: Page,
  content: string,
  terminal: StreamTerminal,
): Promise<void> {
  await page.evaluate(({ content, terminal }) => {
    type TestWindow = Window & {
      __releaseCorpDraftStream?: () => void;
    };
    const testWindow = window as TestWindow;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (!url.includes("/api/corp/legal/ai-tools/chat")) {
        return originalFetch(input, init);
      }

      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ content })}\n\n`),
            );
            testWindow.__releaseCorpDraftStream = () => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(terminal)}\n\n`),
              );
              if (terminal.complete) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
              controller.close();
            };
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        },
      );
    };
  }, { content, terminal });
}

async function releaseDraftStream(page: Page): Promise<void> {
  await page.evaluate(() => {
    type TestWindow = Window & {
      __releaseCorpDraftStream?: () => void;
    };
    const release = (window as TestWindow).__releaseCorpDraftStream;
    if (!release) throw new Error("Controlled draft stream was not started");
    release();
  });
}

test.beforeEach(async () => {
  accessCode = `E2EC${randomBytes(7).toString("hex").toUpperCase()}`.slice(0, 20);
  const [created] = await db
    .insert(corpAccessCodes)
    .values({
      code: accessCode,
      label: `Draft completion e2e ${accessCode}`,
      tier: "practitioner",
      isActive: true,
    })
    .returning({ id: corpAccessCodes.id });
  codeId = created.id;
});

test.afterEach(async () => {
  if (codeId === undefined) return;
  // Sessions reference the code with ON DELETE CASCADE, but remove them
  // explicitly so this cleanup remains safe if that schema changes.
  await db.delete(corpSessions).where(eq(corpSessions.accessCodeId, codeId));
  await db.delete(corpAccessCodes).where(eq(corpAccessCodes.id, codeId));
  codeId = undefined;
  accessCode = "";
});

test("completed specialist draft renders legal structure and remains exportable", async ({ page }) => {
  await signIn(page);
  await page.goto(`${BASE}/mycorplegalai/tools/legal-opinion`);

  await installControlledDraftStream(page, COMPLETION_DRAFT, { done: true, complete: true });

  await page.getByPlaceholder("e.g., Board of Directors, ABC Sdn Bhd").fill("ABC Sdn Bhd");
  await page.getByPlaceholder("e.g., Proposed Franchise Arrangement with XYZ Sdn Bhd").fill(
    "Proposed board transaction",
  );
  await page
    .getByPlaceholder(
      "Set out or supplement the relevant factual background, parties involved, transaction details, and key commercial terms...",
    )
    .fill("The board approved the transaction in principle.");
  await page.getByRole("button", { name: "Generate", exact: true }).click();

  await expect(page.getByRole("heading", { name: "BOARD RESOLUTION" })).toBeVisible();
  await expect(page.getByTestId("button-export-txt")).toHaveCount(0);
  await releaseDraftStream(page);
  await expect(page.getByRole("heading", { name: "Operative Clause" })).toBeVisible();
  await expect(page.getByText("Signature: [●]", { exact: true })).toBeVisible();
  await expectHtmlTable(page, ["Requirement", "Owner", "Deadline"]);
  await expect(page.getByTestId("button-export-txt").last()).toBeVisible();
  await expectExportDownload(page, "# BOARD RESOLUTION");
});

test("completed shared AI Drafter response renders legal structure and remains exportable", async ({
  page,
}) => {
  await signIn(page);

  await installControlledDraftStream(page, COMPLETION_DRAFT, { done: true, complete: true });

  await page.getByRole("button", { name: "AI Drafter", exact: true }).click();
  const drafterInput = page.getByPlaceholder("Describe the document you need drafted...");
  await drafterInput.fill("Draft a board resolution approving a transaction.");
  await drafterInput.press("Enter");

  await expect(page.getByRole("heading", { name: "BOARD RESOLUTION" })).toBeVisible();
  await expect(page.getByTestId("button-export-txt")).toHaveCount(0);
  await releaseDraftStream(page);
  await expect(page.getByRole("heading", { name: "Operative Clause" })).toBeVisible();
  await expect(page.getByText("Signature: [●]", { exact: true })).toBeVisible();
  await expectHtmlTable(page, ["Requirement", "Owner", "Deadline"]);
  await expect(page.getByTestId("button-export-txt").last()).toBeVisible();
  await expectExportDownload(page, "# BOARD RESOLUTION");
});

test("interrupted shared AI Drafter response warns and exposes no partial export", async ({ page }) => {
  await signIn(page);

  await installControlledDraftStream(page, INTERRUPTED_DRAFT, {
    error: "The AI response was interrupted. Please try again.",
    errorCode: "STREAM_INTERRUPTED",
    done: true,
    complete: false,
  });

  await page.getByRole("button", { name: "AI Drafter", exact: true }).click();
  const drafterInput = page.getByPlaceholder("Describe the document you need drafted...");
  await drafterInput.fill("Draft a board resolution that will be interrupted.");
  await drafterInput.press("Enter");

  await expect(page.getByRole("heading", { name: "INCOMPLETE BOARD RESOLUTION" })).toBeVisible();
  await expect(page.getByTestId("button-export-txt")).toHaveCount(0);
  await releaseDraftStream(page);
  await expect(page.getByRole("alert")).toContainText(
    "The AI response was interrupted. Please try again.",
  );
  await expect(page.getByRole("heading", { name: "INCOMPLETE BOARD RESOLUTION" })).toHaveCount(0);
  await expect(page.getByTestId("button-export-txt")).toHaveCount(0);
  await expect(page.getByTestId("button-export-word")).toHaveCount(0);
  await expect(page.getByTestId("button-export-pdf")).toHaveCount(0);
});