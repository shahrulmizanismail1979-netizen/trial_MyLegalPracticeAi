import { expect, test, type Locator } from "@playwright/test";

const BASE = "http://localhost:80";

type Rect = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

async function rect(locator: Locator): Promise<Rect> {
  const box = await locator.boundingBox();
  expect(box, "Expected element to have a bounding box").not.toBeNull();
  return {
    top: box!.y,
    right: box!.x + box!.width,
    bottom: box!.y + box!.height,
    left: box!.x,
  };
}

function overlaps(a: Rect, b: Rect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

test.describe("Amani release regressions", () => {
  test("mobile role guidance remains keyboard accessible without covering hero actions", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    // The bare root is the retained chat-first LAWYes workspace.  Amani's
    // role-guidance trigger belongs to the explicit marketing/apps surface.
    await page.goto(`${BASE}/apps`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();

    const trigger = page.getByRole("button", { name: "Open Amani role guidance" });
    const heroActions = [
      page.getByRole("button", { name: /Secure Your Access/ }),
      page.getByRole("button", { name: "Explore the AI Portals" }),
    ];
    await expect(trigger).toBeVisible();
    for (const action of heroActions) {
      await expect(action).toBeVisible();
      expect(
        overlaps(await rect(trigger), await rect(action)),
        "The mobile Amani role-guidance trigger must not cover a hero CTA",
      ).toBe(false);
    }

    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Amani role guidance" });
    const headerClose = page.getByRole("button", { name: "Close Amani role guidance" }).first();
    await expect(dialog).toBeVisible();
    await expect(headerClose).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Which option should I pick?" })).toBeFocused();
    await expect(dialog.locator(":focus")).toHaveCount(1);

    const input = page.getByRole("textbox", { name: "Ask the AI assistant" });
    await input.focus();
    await page.setViewportSize({ width: 390, height: 500 });
    await expect(input).toBeFocused();
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeInViewport();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.setViewportSize({ width: 390, height: 844 });
    await trigger.click();
    await expect(headerClose).toBeFocused();
    await headerClose.click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await expect(page.getByText("Amani — AI Reception")).toBeAttached();
    await page.getByText("Amani — AI Reception").scrollIntoViewIfNeeded();
    await expect(page.getByText("Amani — AI Reception")).toBeVisible();
  });

  test("MySyariahAI access-code login and civil gate land on persistent app routes", async ({
    page,
  }) => {
    const accessCode = process.env.MASTER_ACCESS_CODE;
    if (!accessCode) throw new Error("MASTER_ACCESS_CODE env var is required");

    await page.goto(`${BASE}/mysyariahai/login`);
    await page.evaluate(() => {
      localStorage.removeItem("mysyariahai.gate");
    });
    await page.reload();

    await page.getByTestId("tab-code").click();
    await page.getByTestId("input-access-code").fill(accessCode);
    await page.getByTestId("button-verify-code").click();

    await expect(page.getByRole("heading", { name: "Select Your Practice Gate" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /Syariah Civil Litigation/ }).click();

    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
      .toBe("/mysyariahai/matters");
    await expect(page.getByText("404")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open virtual paralegal" })).toHaveCount(1);

    await page.goto(`${BASE}/mysyariahai/case-law`);
    await expect
      .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
      .toBe("/mysyariahai/case-law");
    await expect(page.getByText("404")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Open virtual paralegal" })).toHaveCount(1);
  });
});