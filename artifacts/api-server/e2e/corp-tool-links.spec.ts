import { expect, test, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, corpAccessCodes, corpSessions } from "@workspace/db";

/**
 * E2E: MyCorpLegalAI catalogue/detail/backend tool ID contract.
 *
 * The catalogue link, detail-page registry, and backend specialist registry
 * all need to keep using the same ID. The backend probe stops at matter
 * validation so this check never calls the AI provider.
 */

test.setTimeout(60_000);
test.describe.configure({ mode: "serial" });

const BASE = "http://localhost:80";
const DRAFTER_ID = "drafter";

let codeId: number | undefined;
let accessCode = "";

async function signIn(page: Page): Promise<string> {
  await page.goto(`${BASE}/mycorplegalai/login`);
  await page.getByPlaceholder("Access Code").fill(accessCode);
  await page.getByRole("button", { name: "Authenticate", exact: true }).click();
  await expect(page).toHaveURL(/\/mycorplegalai\/dashboard$/);
  await expect(
    page.getByText("Practitioner", { exact: true }).first(),
  ).toBeVisible();

  const token = await page.evaluate(() => localStorage.getItem("auth_token"));
  expect(token, "Corporate login must issue a browser auth token").toBeTruthy();
  return token!;
}

async function expectDrafterForm(page: Page): Promise<void> {
  await expect(
    page.getByRole("heading", { name: "AI Corporate Drafter", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^Document to Draft/)).toBeVisible();
  await expect(page.getByText(/^Company \/ Principal/)).toBeVisible();
  await expect(page.getByText(/^Parties and Their Roles/)).toBeVisible();
  await expect(
    page.getByText(/^Key Facts, Terms & Instructions/),
  ).toBeVisible();
  await expect(page.locator("select").first()).toBeVisible();
  await expect(
    page.getByPlaceholder("e.g., ABC Holdings Sdn Bhd"),
  ).toBeVisible();
}

test.beforeEach(async () => {
  accessCode = `E2ET${randomBytes(7).toString("hex").toUpperCase()}`.slice(
    0,
    20,
  );
  const [created] = await db
    .insert(corpAccessCodes)
    .values({
      code: accessCode,
      label: `Tool links e2e ${accessCode}`,
      tier: "practitioner",
      isActive: true,
    })
    .returning({ id: corpAccessCodes.id });
  codeId = created.id;
});

test.afterEach(async () => {
  if (codeId === undefined) return;
  await db.delete(corpSessions).where(eq(corpSessions.accessCodeId, codeId));
  await db.delete(corpAccessCodes).where(eq(corpAccessCodes.id, codeId));
  codeId = undefined;
  accessCode = "";
});

test("drafter catalogue link, direct route, form submission, and backend registry stay aligned", async ({
  page,
}) => {
  const token = await signIn(page);

  // TOOL_SYSTEM_PROMPTS is checked before matter lookup. An invalid matter
  // therefore proves the backend recognises drafter without invoking Gemini.
  const backendProbe = await page.request.post(
    "/api/corp/legal/ai-tools/chat",
    {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tool: DRAFTER_ID,
        message: "Registry-only drafter probe",
        matterId: 0,
      },
    },
  );
  const backendBody = (await backendProbe.json()) as { error?: string };
  expect(
    backendProbe.status(),
    `Backend specialist registry must contain "${DRAFTER_ID}"; expected matter validation, got ${backendBody.error ?? "no error"}`,
  ).toBe(400);
  expect(backendBody.error).toBe("Invalid matter context");

  await page.goto(`${BASE}/mycorplegalai/tools`);
  const drafterLink = page.getByRole("link", { name: /AI Corporate Drafter/ });
  await expect(
    drafterLink,
    `Corporate tools catalogue must expose the canonical "${DRAFTER_ID}" link`,
  ).toHaveCount(1);
  await expect(drafterLink).toHaveAttribute(
    "href",
    /\/mycorplegalai\/tools\/drafter$/,
  );

  await drafterLink.click();
  await expect(page).toHaveURL(/\/mycorplegalai\/tools\/drafter$/);
  await expectDrafterForm(page);

  let submittedTool: unknown;
  await page.route("**/api/corp/legal/ai-tools/chat", async (route) => {
    const body = route.request().postDataJSON() as { tool?: unknown };
    submittedTool = body.tool;
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
      body: [
        `data: ${JSON.stringify({ content: "# DRAFT PREVIEW" })}\n\n`,
        `data: ${JSON.stringify({ done: true, complete: true })}\n\n`,
        "data: [DONE]\n\n",
      ].join(""),
    });
  });

  await page.locator("select").first().selectOption("board-resolution");
  await page
    .getByPlaceholder("e.g., ABC Holdings Sdn Bhd")
    .fill("E2E Holdings Sdn Bhd");
  await page
    .getByPlaceholder(
      "List every party, registration number, address, and role. Identify the party you act for.",
    )
    .fill("E2E Holdings Sdn Bhd, acting for the company.");
  await page
    .getByPlaceholder(
      "Set out the transaction, commercial terms, dates, amounts, approvals, obligations, and any clauses the document must contain.",
    )
    .fill("Approve the allotment of ordinary shares.");

  const chatRequest = page.waitForRequest("**/api/corp/legal/ai-tools/chat");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await chatRequest;
  await expect(
    page.getByRole("heading", { name: "DRAFT PREVIEW", exact: true }),
  ).toBeVisible();
  expect(
    submittedTool,
    `The drafter form must submit the canonical "${DRAFTER_ID}" ID`,
  ).toBe(DRAFTER_ID);

  // Also exercise a fresh navigation to the direct URL so a catalogue fix
  // cannot mask a missing detail-page registry entry.
  await page.goto(`${BASE}/mycorplegalai/tools/${DRAFTER_ID}`);
  await expect(page).toHaveURL(/\/mycorplegalai\/tools\/drafter$/);
  await expectDrafterForm(page);
  await expect(page.getByText("Tool not found.", { exact: true })).toHaveCount(
    0,
  );
});
