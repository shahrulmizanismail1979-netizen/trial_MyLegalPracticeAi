import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { db, litAccessCodes, litMatters } from "@workspace/db";
import { eq } from "drizzle-orm";

test.setTimeout(90_000);

const RUN_ID = randomUUID().slice(0, 8);
const ACCESS_CODE = `LAWYES-E2E-${RUN_ID}`.toUpperCase();
const DISCUSSION_TITLE = `Matter discussion ${RUN_ID}`;
let ownerId = 0;
let firstMatterId = 0;
let secondMatterId = 0;

async function retainLitCookie(page: Page, response: APIResponse) {
  const setCookie = response.headers()["set-cookie"];
  const encoded = setCookie
    ?.split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
    .find((cookie) => cookie.trimStart().startsWith("lit.sid="))
    ?.split(";")[0];
  const separator = encoded?.indexOf("=") ?? -1;
  if (!encoded || separator < 1) throw new Error("Lit login did not return a session cookie");
  await page.context().addCookies([{
    name: encoded.slice(0, separator),
    value: encoded.slice(separator + 1),
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

test.beforeAll(async () => {
  const [owner] = await db.insert(litAccessCodes).values({
    code: ACCESS_CODE,
    recipientName: `LAWYes browser ${RUN_ID}`,
    recipientEmail: `lawyes-browser-${RUN_ID}@test.invalid`,
    status: "active",
  }).returning({ id: litAccessCodes.id });
  ownerId = owner.id;
  const matters = await db.insert(litMatters).values([
    { accessCodeId: ownerId, title: `First browser matter ${RUN_ID}` },
    { accessCodeId: ownerId, title: `Second browser matter ${RUN_ID}` },
  ]).returning({ id: litMatters.id });
  firstMatterId = matters[0]!.id;
  secondMatterId = matters[1]!.id;
});

test.afterAll(async () => {
  if (ownerId) await db.delete(litAccessCodes).where(eq(litAccessCodes.id, ownerId));
});

test("a lawyer files and reassigns a discussion, and LAWYes shows only the selected matter", async ({
  page,
}) => {
  const login = await page.request.post("/api/lit/auth/login", {
    data: { password: ACCESS_CODE },
  });
  expect(login.ok()).toBe(true);
  await retainLitCookie(page, login);
  await page.addInitScript(() => {
    localStorage.setItem("mylitai_auth_verified", "true");
  });

  const unlinked = await page.request.post("/api/lit/gemini/litConversations", {
    data: { title: `Unlinked private discussion ${RUN_ID}` },
  });
  expect(unlinked.ok()).toBe(true);

  await page.route(/\/api\/lit\/gemini\/litConversations\/\d+\/litMessages$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body:
        `data: ${JSON.stringify({ content: `Browser-linked answer ${RUN_ID}` })}\n\n` +
        `data: ${JSON.stringify({ done: true })}\n\n`,
    }),
  );

  await page.goto("/mylitai/app/dashboard");
  await page.getByRole("button", { name: /AI Senior Counsel/i }).click();
  await expect(page.getByRole("heading", { name: "AI Senior Counsel" })).toBeVisible();
  await page.getByLabel("File discussion in matter").selectOption(String(firstMatterId));

  const createRequest = page.waitForRequest((request) =>
    request.method() === "POST" &&
    new URL(request.url()).pathname === "/api/lit/gemini/litConversations",
  );
  await page.getByPlaceholder("Ask about procedure, case law, documents...").fill(DISCUSSION_TITLE);
  await page.getByPlaceholder("Ask about procedure, case law, documents...").press("Enter");
  const created = await createRequest;
  expect(created.postDataJSON()).toMatchObject({
    title: DISCUSSION_TITLE,
    matterId: firstMatterId,
  });
  await expect(page.getByText(`Browser-linked answer ${RUN_ID}`)).toBeVisible();

  const list = await page.request.get("/api/lit/gemini/litConversations");
  expect(list.ok()).toBe(true);
  const conversations = await list.json() as Array<{ id: number; title: string; matterId: number | null }>;
  const conversation = conversations.find((item) => item.title === DISCUSSION_TITLE);
  expect(conversation).toMatchObject({ matterId: firstMatterId });

  const linkResponse = page.waitForResponse((response) =>
    response.request().method() === "PATCH" &&
    new URL(response.url()).pathname ===
      `/api/lit/gemini/litConversations/${conversation!.id}/matter`,
  );
  await page.getByLabel("File discussion in matter").selectOption(String(secondMatterId));
  expect((await linkResponse).ok()).toBe(true);
  await expect(page.getByText("Discussion filed to matter")).toBeVisible();

  const firstWorkspace = await page.request.get(
    `/api/lit/lawyes/matters/${firstMatterId}/workspace`,
  );
  const secondWorkspace = await page.request.get(
    `/api/lit/lawyes/matters/${secondMatterId}/workspace`,
  );
  expect(firstWorkspace.ok()).toBe(true);
  expect(secondWorkspace.ok()).toBe(true);
  expect((await firstWorkspace.json()).conversations).toEqual([]);
  expect((await secondWorkspace.json()).conversations).toEqual([
    expect.objectContaining({ id: conversation!.id, title: DISCUSSION_TITLE }),
  ]);

  await page.goto(`/lawyes/${secondMatterId}`);
  // LAWYes matter workspaces expose recent discussions in the matter
  // navigation rail; they do not have the former Discussions tab.
  await expect(page.getByText(DISCUSSION_TITLE)).toBeVisible();
  await expect(page.getByText(`Unlinked private discussion ${RUN_ID}`)).not.toBeVisible();
});