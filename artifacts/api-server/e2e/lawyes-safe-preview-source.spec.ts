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

test("LAWYes is the primary root experience and the Safe Preview URL remains compatible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /find the law\. draft the document/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search Law & Cases" })).toBeVisible();

  await page.goto("/lawyes-safe-preview");
  await expect(page.getByRole("heading", { name: /find the law\. draft the document/i })).toBeVisible();
});

test("selected LAWYes report links to its report-specific official judgment", async ({ page }) => {
  await page.goto("/lawyes-safe-preview");
  await page.getByRole("button", { name: "Search Law & Cases" }).click();
  await page.getByRole("button", { name: new RegExp(publishedReport.title) }).first().click();

  const officialJudgment = page.getByRole("link", { name: /open report source/i });
  await expect(officialJudgment).toBeVisible();
  await expect(officialJudgment).toHaveAttribute("href", publishedReport.sourceUrl);
});

test("home has four primary actions and hands an Enter instruction to Search", async ({ page }) => {
  await page.goto("/lawyes-safe-preview");

  const primaryActions = page.locator("main button").filter({ has: page.locator("h2") });
  await expect(primaryActions).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Search Law & Cases" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Draft a Legal Document" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Work on a Matter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sarawak Practice Centre" })).toBeVisible();

  const instruction = "Maria";
  await page.getByRole("textbox", { name: /search judgments, principles/i }).fill(instruction);
  await page.getByRole("textbox", { name: /search judgments, principles/i }).press("Enter");
  await expect(page.getByRole("heading", { name: /\d+ Results?/ })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveValue(instruction);
});

test("restores valid URL state and safely falls back from an invalid view", async ({ page }) => {
  await page.goto("/lawyes-safe-preview?view=search&q=Maria&jurisdiction=Malaysia&sort=date");
  await expect(page.getByRole("searchbox")).toHaveValue("Maria");
  await expect(page.getByLabel("Jurisdiction")).toHaveValue("Malaysia");
  await expect(page.getByRole("heading", { name: /^\d+ Results?$/ })).toBeVisible();

  await page.goto("/lawyes-safe-preview?view=not-a-view&q=Maria&jurisdiction=nowhere");
  await expect(page.getByRole("heading", { name: /find the law\. draft the document/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search Law & Cases" })).toBeVisible();

  await page.goto("/lawyes-safe-preview?view=draft&playbook=civil-application&draftStep=3");
  await expect(page.getByRole("button", { name: /generate template/i })).toBeVisible();
  await expect(page.getByText(/practitioner-review template generated/i)).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /generate template/i })).toBeVisible();
  await expect(page.getByText(/practitioner-review template generated/i)).not.toBeVisible();

  await page.goto("/lawyes-safe-preview?view=matter&matterStep=2");
  await expect(page.getByRole("button", { name: /confirm workspace/i })).toBeVisible();
  await expect(page.getByText("Workspace Local Manifest Generated")).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /confirm workspace/i })).toBeVisible();
});

test("Search applies guided filters, resets them, and selects material for a matter", async ({ page }) => {
  await page.goto("/lawyes-safe-preview?view=search");
  await page.getByRole("button", { name: /filters/i }).click();
  await page.getByLabel("Practice Area").selectOption({ label: "Civil" });
  await expect(page.getByRole("heading", { name: /^\d+ Results?$/ })).toBeVisible();

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByLabel("Practice Area")).toHaveValue("");
  await expect(page.getByLabel("Jurisdiction")).toHaveValue("");

  const addMaterial = page.getByRole("button", { name: /add .* to matter/i }).first();
  const addName = await addMaterial.getAttribute("aria-label");
  await addMaterial.click();
  await expect(page.getByRole("button", { name: /remove .* from matter/i }).first()).toBeVisible();
  await expect(page).toHaveURL(/selectedMaterials=/);
  expect(addName).toMatch(/^Add .+ to matter$/);
});

test("Draft blocks incomplete intake and generates a review and source-gap manifest only after completion", async ({ page }) => {
  await page.goto("/lawyes-safe-preview?view=draft");
  await page.getByRole("button", { name: /Civil application \/ affidavit pack/ }).click();
  await expect(page.getByRole("heading", { name: "Civil application / affidavit pack" })).toBeVisible();

  await page.getByRole("button", { name: /generate template/i }).click();
  await expect(page.getByText("Client / matter reference is required")).toBeVisible();
  await expect(page.getByText("All safeguards must be acknowledged")).toBeVisible();
  await expect(page.getByText("Practitioner review strictly required")).not.toBeVisible();

  await page.getByLabel(/client \/ matter reference/i).fill("CLI-2026-08");
  await page.getByLabel(/proposed court \/ registry/i).fill("Kuching Registry");
  await page.getByLabel(/relief or purpose/i).fill("Prepare an editable review outline.");
  for (const checkbox of await page.locator('input[id^="field-safeguards-"]').all()) {
    await checkbox.check({ force: true });
  }
  await page.getByRole("button", { name: /generate template/i }).click();

  await expect(page.getByText("Practitioner review strictly required")).toBeVisible();
  const generated = page.locator("pre");
  await expect(generated).toContainText("SOURCE MANIFEST (VERIFICATION REQUIRED)");
  await expect(generated).toContainText("RISK & UNCERTAINTY MANIFEST");
  await expect(generated).toContainText("[GAP]");
  await expect(generated).toContainText("CLI-2026-08");
});

test("Matter rejects an empty workspace, confirms resolved material, exposes handoffs, and exports locally", async ({ page }) => {
  await page.goto("/lawyes-safe-preview?view=matter");
  await page.getByRole("button", { name: /confirm workspace/i }).click();
  await expect(page.getByText("At least one material must be selected")).toBeVisible();

  await page.goto("/lawyes-safe-preview?view=matter&selectedMaterials=maria-rochele-sarawak");
  await page.getByLabel("Internal Reference").fill("Kuching Land Dispute");
  await page.getByLabel("Client Reference").fill("CLI-2026-08");
  await page.getByLabel("Purpose or Open Questions").fill("Verify current status of caveat.");
  await page.locator('input[type="checkbox"]').check({ force: true });
  await page.getByRole("button", { name: /confirm workspace/i }).click();

  await expect(page.getByText("Workspace Local Manifest Generated")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kuching Land Dispute" })).toBeVisible();
  await expect(page.getByText("REF: CLI-2026-08")).toBeVisible();
  await expect(page.getByText("Verify current status of caveat.")).toBeVisible();
  await expect(page.getByText("Maria Rochele Silva Sarabia v Registrar of Lands and Surveys & Anor")).toBeVisible();
  await expect(page.getByRole("button", { name: /return to search/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /generate draft/i })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "TXT", exact: true }).click();
  await expect((await download).suggestedFilename()).toBe("lawyes-matter-manifest.txt");
});

test("browser Back returns generated Draft and confirmed Matter to their editable steps", async ({ page }) => {
  await page.goto("/lawyes-safe-preview?view=draft");
  await page.getByRole("button", { name: /Civil application \/ affidavit pack/ }).click();
  await page.getByLabel(/client \/ matter reference/i).fill("BACK-1");
  await page.getByLabel(/proposed court \/ registry/i).fill("Kuching Registry");
  await page.getByLabel(/relief or purpose/i).fill("Review outline");
  for (const checkbox of await page.locator('input[id^="field-safeguards-"]').all()) {
    await checkbox.check({ force: true });
  }
  await page.getByRole("button", { name: /generate template/i }).click();
  await expect(page.getByText("Practitioner review strictly required")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: /generate template/i })).toBeVisible();

  await page.goto("/lawyes-safe-preview?view=matter&selectedMaterials=maria-rochele-sarawak");
  await page.getByLabel("Internal Reference").fill("Back Matter");
  await page.getByLabel("Client Reference").fill("BACK-2");
  await page.getByLabel("Purpose or Open Questions").fill("Review the selected record.");
  await page.locator('input[type="checkbox"]').check({ force: true });
  await page.getByRole("button", { name: /confirm workspace/i }).click();
  await expect(page.getByText("Workspace Local Manifest Generated")).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: /confirm workspace/i })).toBeVisible();
  await expect(page.getByLabel("Internal Reference")).toHaveValue("Back Matter");
});

test("Practice Centre lists all six categories and Sources gives verification guidance", async ({ page }) => {
  await page.goto("/lawyes-safe-preview?view=practice");
  const categories = [
    "Civil Litigation",
    "Criminal Litigation",
    "Conveyancing & Land",
    "NCR & Native Law",
    "Probate & Estates",
    "Professional Practice",
  ];
  for (const category of categories) {
    await expect(page.getByRole("button", { name: category })).toBeVisible();
  }

  await page.getByRole("button", { name: "Probate & Estates" }).click();
  await expect(page.getByText(/Status: Verification required/)).toBeVisible();
  await page.getByRole("button", { name: /Category Examples & Source Notes/ }).click();
  await expect(page.getByRole("heading", { name: "Illustrative use examples" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Source notes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Checklists & Decision Trees/ }).click();
  await expect(page.getByText("No category-specific reviewed item in this preview.")).toBeVisible();
  await expect(page.getByText("Civil application readiness")).not.toBeVisible();
  await expect(page.getByText("Criminal hearing preparation")).not.toBeVisible();

  await page.goto("/lawyes-safe-preview?view=verification");
  await expect(page.getByRole("heading", { name: "Sources & Verification" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Required Verification Steps" })).toBeVisible();
  await expect(page.getByText("A practitioner must perform these steps before relying on any material from this source.")).toBeVisible();
  await expect(page.getByText("Check currency, completeness, and provenance before using any material.")).toBeVisible();
});


test("Verification UI action labels accurately reflect source editorial status", async ({ page }) => {
  await page.goto("/lawyes-safe-preview?view=verification");
  await expect(page.getByRole("heading", { name: "Sources & Verification" })).toBeVisible();

  // Test an official source (Sarawak LawNet)
  await page.getByRole("button", { name: "Sarawak LawNet" }).click();
  await expect(page.getByRole("link", { name: "Open official source" })).toBeVisible();

  // Test a public access copy (INSTUN Pintu)
  await page.getByRole("button", { name: "Public judgment copy via INSTUN Pintu" }).click();
  await expect(page.getByRole("link", { name: "Open public access copy" })).toBeVisible();

  // Test a professional association gateway (Advocates Association)
  await page.getByRole("button", { name: "Advocates Association of Sarawak" }).click();
  await expect(page.getByRole("link", { name: "Open source gateway" })).toBeVisible();
});

test.describe("mobile Safe Preview", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("has no horizontal overflow and keeps active content above the bottom navigation", async ({ page }) => {
    await page.goto("/lawyes-safe-preview");
    await expect(page.getByRole("heading", { name: /find the law\. draft the document/i })).toBeVisible();
    expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBeTruthy();

    const notice = page.getByText("Safe Preview Demonstration");
    await notice.scrollIntoViewIfNeeded();
    const noticeBox = await notice.boundingBox();
    const bottomNav = page.locator("nav.fixed.bottom-0");
    const navBox = await bottomNav.boundingBox();
    expect(noticeBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(navBox!.y);
  });
});