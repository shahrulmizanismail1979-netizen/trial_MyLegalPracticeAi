import { expect, test, type Page } from "@playwright/test";

const AUTHENTICATED_USER = {
  id: "amani-shell-regression-user",
  email: "amani-shell@example.test",
  name: "Amani Shell Test",
  role: "teacher",
  status: "active",
  createdAt: "2025-01-01T00:00:00.000Z",
  lastLoginAt: null,
};

const APP_URL = "http://localhost:80/mylawacad";

async function mockAuthenticatedSession(page: Page) {
  await page.route("**/api/acad/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: AUTHENTICATED_USER }),
    }),
  );
}

test.describe("authenticated Amani shell", () => {
  test("renders one widget on protected areas and none on public pages", async ({
    page,
  }) => {
    await mockAuthenticatedSession(page);

    await page.goto(`${APP_URL}/examiner/dashboard`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: "Open virtual paralegal" }),
    ).toHaveCount(1);

    await page.goto(`${APP_URL}/studio/dashboard`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: "Open virtual paralegal" }),
    ).toHaveCount(1);

    await page.goto(`${APP_URL}/`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: "Open virtual paralegal" }),
    ).toHaveCount(0);
  });
});