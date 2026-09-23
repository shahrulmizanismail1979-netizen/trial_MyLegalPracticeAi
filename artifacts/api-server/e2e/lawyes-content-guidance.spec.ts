import { expect, test } from "@playwright/test";

test("expanded public portal guide renders and opens without runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/apps#help");
  await expect(page.getByRole("heading", { name: "Prepare the input. Review the result." })).toBeVisible();
  const guides = page.locator("#help details[data-testid]");
  await expect(guides).toHaveCount(9);
  await guides.first().locator("summary").click();
  await expect(guides.first()).toHaveAttribute("open", "");
  expect(errors).toEqual([]);
});

for (const width of [1280, 390]) {
  test(`expanded legal guidance keeps source limits and navigation at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?view=verification");
    const guides = page.getByTestId("legal-reference-guide");
    await expect(guides).toBeVisible();
    await expect(guides).toContainText("not official court forms");
    const sections = guides.locator("details");
    expect(await sections.count()).toBeGreaterThanOrEqual(12);

    for (let index = 0; index < await sections.count(); index++) {
      const section = sections.nth(index);
      await section.locator("summary").click();
      await expect(section).toHaveAttribute("open", "");
      await expect(section.getByRole("heading", { name: "Before you draft", exact: true })).toBeVisible();
      await expect(section.getByRole("heading", { name: "Review before use", exact: true })).toBeVisible();
      const sources = section.locator("article");
      expect(await sources.count()).toBeGreaterThan(0);
      for (let sourceIndex = 0; sourceIndex < await sources.count(); sourceIndex++) {
        const source = sources.nth(sourceIndex);
        await expect(source).toContainText("Verification limit:");
        await expect(source.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
        await expect(source.getByRole("link")).toHaveAttribute("href", /^https:\/\//);
        await expect(source.getByRole("link")).toHaveAttribute("rel", "noopener noreferrer");
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await section.locator("summary").click();
    }

    await page.getByRole("button", { name: "Back to Home", exact: true }).click();
    await expect(page.getByTestId("input-lawyes-instruction")).toBeVisible();
    await expect(page.getByTestId("button-attach-file")).toBeVisible();
    await expect(page.getByTestId("button-dictate")).toBeVisible();
    await expect(page.getByTestId("button-action-search")).toBeVisible();
    await expect(page.getByTestId("button-action-draft")).toBeVisible();
    await expect(page.getByTestId("button-action-matter")).toBeVisible();
    await expect(page.getByTestId("button-composer-tools")).toHaveCount(0);
  });
}