import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fixturePath = fileURLToPath(
  new URL("../../landing-page/src/fixtures/lawyes-verified-reports.json", import.meta.url),
);
const verifiedReports = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<
  string,
  { title: string; sourceUrl: string }
>;
const publishedReport = Object.values(verifiedReports)[0];

test("selected LAWYes report links to its report-specific official judgment", async ({ page }) => {
  await page.goto("/lawyes-safe-preview");
  await page.getByRole("button", { name: "Search Law & Cases" }).click();
  await page.getByRole("button", { name: new RegExp(publishedReport.title) }).click();

  const officialJudgment = page.getByRole("link", { name: /open report source/i });
  await expect(officialJudgment).toBeVisible();
  await expect(officialJudgment).toHaveAttribute("href", publishedReport.sourceUrl);
});