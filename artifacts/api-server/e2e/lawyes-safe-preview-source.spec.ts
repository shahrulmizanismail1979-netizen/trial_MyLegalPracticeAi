import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const logoPath = fileURLToPath(
  new URL("../../landing-page/public/lawyes-logo.png", import.meta.url),
);
const fixturePath = fileURLToPath(
  new URL("../../landing-page/src/fixtures/lawyes-verified-reports.json", import.meta.url),
);
const verifiedReports = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<
  string,
  { title: string; sourceUrl: string }
>;
const publishedReport = Object.values(verifiedReports)[0];

test("official LAWYes logo matches the approved brand asset", () => {
  const fingerprint = createHash("sha256")
    .update(readFileSync(logoPath))
    .digest("hex");

  expect(
    fingerprint,
    "LAWYes logo fingerprint changed. If this is an intentional official brand update, review the asset and replace the approved SHA-256 value in this test.",
  ).toBe("fc08909524639fadd0966f6820fa6d173a4969409c6f5995ac194369b1d39413");
});

test("LAWYes is the primary root experience and the Safe Preview URL remains compatible", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /how can i assist your practice today/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Search Law & Cases" })).toBeVisible();

  await page.goto("/lawyes-safe-preview");
  await expect(page.getByRole("heading", { name: /how can i assist your practice today/i })).toBeVisible();
});

test("LAWYes defaults to one conversation workspace with progressively disclosed legal tools", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByTestId("lawyes-conversation-canvas")).toHaveCount(1);
  await expect(page.getByTestId("lawyes-instruction-composer")).toHaveCount(1);
  await expect(page.getByTestId("lawyes-instruction-composer")).toBeVisible();

  const rail = page.getByTestId("lawyes-conversation-rail");
  await expect(rail.getByText("Today", { exact: true })).toBeVisible();
  await expect(rail.getByRole("button", { name: "Open current conversation" })).toBeVisible();

  const toolsToggle = page.getByTestId("button-toggle-tools");
  const toolsMenu = page.getByTestId("lawyes-tools-menu");
  await expect(toolsToggle).toHaveAttribute("aria-expanded", "false");
  await expect(toolsMenu).toBeHidden();
  await expect(page.getByTestId("button-sidebar-search")).toBeHidden();

  const quickActions = [
    "Search Law & Cases",
    "Draft a Legal Document",
    "Work on a Matter",
    "Malaysia Practice & State Sources",
  ];
  for (const action of quickActions) {
    const button = page.getByRole("button", { name: action });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  }

  await toolsToggle.click();
  await expect(toolsToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("button-sidebar-search")).toBeVisible();
  await expect(page.getByTestId("button-sidebar-skills")).toBeVisible();
});

test("LAWYes keeps the official logo and approved navy and fresh-green workspace branding", async ({ page }) => {
  await page.goto("/");

  const workspace = page.locator(".safe-preview");
  const desktopLogo = page.getByTestId("lawyes-sidebar-logo");
  const logoButton = page.getByTestId("button-sidebar-home");
  const rail = page.getByTestId("lawyes-conversation-rail");

  await expect(desktopLogo).toBeVisible();
  await expect(desktopLogo).toHaveAttribute("src", /\/lawyes-logo\.png$/);
  await expect(desktopLogo).toHaveAttribute("alt", "LAWYes — Your Legal Work, Solved.");

  const brand = await workspace.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      primary: styles.getPropertyValue("--primary").trim(),
      ring: styles.getPropertyValue("--ring").trim(),
      sidebar: styles.getPropertyValue("--lawyes-sidebar").trim(),
      foreground: styles.getPropertyValue("--foreground").trim(),
    };
  });
  expect(brand).toEqual({
    primary: "163 100% 33%",
    ring: "163 100% 33%",
    sidebar: "222 80% 14%",
    foreground: "222 80% 16%",
  });

  const logoImage = await desktopLogo.evaluate((image: HTMLImageElement) => ({
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  }));
  expect(logoImage).toEqual({ complete: true, naturalWidth: 1384, naturalHeight: 769 });

  const [logoBox, buttonBox, railBox] = await Promise.all([
    desktopLogo.boundingBox(),
    logoButton.boundingBox(),
    rail.boundingBox(),
  ]);
  expect(logoBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  expect(railBox).not.toBeNull();
  expect(logoBox!.x).toBeGreaterThanOrEqual(buttonBox!.x);
  expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(buttonBox!.x + buttonBox!.width);
  expect(logoBox!.y).toBeGreaterThanOrEqual(buttonBox!.y);
  expect(logoBox!.y + logoBox!.height).toBeLessThanOrEqual(buttonBox!.y + buttonBox!.height);
  expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(railBox!.x + railBox!.width);
  await expect(page.getByTestId("button-new-workspace")).toBeVisible();
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
  await expect(page.getByRole("button", { name: "Malaysia Practice & State Sources" })).toBeVisible();

  const instruction = "Find judgment citation authority precedent statute";
  await page.getByRole("textbox", { name: /search judgments, principles/i }).fill(instruction);
  await page.getByRole("textbox", { name: /search judgments, principles/i }).press("Enter");
  await expect(page.getByRole("heading", { name: /\d+ Results?/ })).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveValue(instruction);
});

test("desktop navigation, composer, submit, and quick actions are keyboard reachable and operable", async ({ page }) => {
  await page.goto("/lawyes-safe-preview");

  const toolsToggle = page.getByTestId("button-toggle-tools");
  const collapsedToolLinks = page.locator("#lawyes-tools-menu button");
  await expect(toolsToggle).toHaveAttribute("aria-expanded", "false");
  await expect(collapsedToolLinks).toHaveCount(5);

  await page.getByTestId("button-sidebar-home").focus();
  const collapsedTabStops: string[] = [];
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press("Tab");
    collapsedTabStops.push(await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.testid ?? ""));
  }
  expect(collapsedTabStops).not.toContain("button-sidebar-search");
  expect(collapsedTabStops).not.toContain("button-sidebar-draft");
  expect(collapsedTabStops).not.toContain("button-sidebar-matter");
  expect(collapsedTabStops).not.toContain("button-sidebar-practice");
  expect(collapsedTabStops).not.toContain("button-sidebar-skills");
  expect(collapsedTabStops).toContain("input-lawyes-instruction");

  await toolsToggle.focus();
  await page.keyboard.press(" ");
  await expect(toolsToggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(page.getByTestId("button-sidebar-search")).toBeFocused();

  await page.goto("/lawyes-safe-preview");
  const instruction = page.getByTestId("input-lawyes-instruction");
  await instruction.fill("Prepare a legal document");
  await instruction.focus();
  for (let index = 0; index < 8; index += 1) {
    if (await page.getByTestId("button-submit-instruction").evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("Tab");
  }
  await expect(page.getByTestId("button-submit-instruction")).toBeFocused();

  const quickActionTabStops: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    await page.keyboard.press("Tab");
    quickActionTabStops.push(await page.evaluate(() => (document.activeElement as HTMLElement)?.dataset.testid ?? ""));
  }
  expect(quickActionTabStops).toEqual([
    "button-action-search",
    "button-action-draft",
    "button-action-matter",
  ]);

  const quickActions = ["search", "draft", "matter"];
  for (const action of quickActions) {
    await page.goto("/lawyes-safe-preview");
    const button = page.getByTestId(`button-action-${action}`);
    await button.focus();
    await page.keyboard.press(action === "draft" ? " " : "Enter");
    await expect(page).toHaveURL(new RegExp(`view=${action}`));
  }
});

for (const width of [1280, 390]) {
  test(`simplified homepage preserves navigation and attachments at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "My Matters", exact: true })).toHaveCount(1);
    await expect(page.getByTestId("link-composer-full-workspace")).toHaveCount(0);
    await expect(page.getByTestId("button-composer-files")).toHaveCount(0);
    await expect(page.getByTestId("button-composer-tools")).toHaveCount(0);
    await expect(page.getByTestId("button-action-practice")).toHaveCount(0);
    await expect(page.getByTestId("button-action-matter")).toHaveText("Prepare a matter");
    await expect(page.getByTestId("button-dictate")).toBeVisible();
    const chooser = page.waitForEvent("filechooser");
    await page.getByTestId("button-attach-file").click();
    await (await chooser).setFiles({ name: "navigation-check.txt", mimeType: "text/plain", buffer: Buffer.from("Synthetic attachment check.") });
    await expect(page.getByText("navigation-check.txt", { exact: true })).toBeVisible();
    await expect(page.getByTestId("button-submit-instruction")).toBeEnabled();
    if (width < 768) await page.getByTestId("button-open-sidebar").click();
    await expect(page.getByTestId("link-sidebar-my-matters")).toBeVisible();
    await expect(page.getByTestId("link-sidebar-my-matters")).toHaveAttribute("href", "/lawyes");
    await expect(page.getByTestId("button-new-workspace")).toHaveAttribute("aria-label", "New conversation");
    await page.getByTestId("button-toggle-tools").click();
    await expect(page.getByTestId("button-sidebar-skills")).toBeVisible();
    await page.getByTestId("button-sidebar-practice").click();
    await expect(page).toHaveURL(/view=practice/);
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", width);
  });
}

test("restores valid URL state and safely falls back from an invalid view", async ({ page }) => {
  await page.goto("/lawyes-safe-preview?view=search&q=Maria&jurisdiction=Malaysia&sort=date");
  await expect(page.getByRole("searchbox")).toHaveValue("Maria");
  await expect(page.getByLabel("Jurisdiction")).toHaveValue("Malaysia");
  await expect(page.getByRole("heading", { name: /^\d+ Results?$/ })).toBeVisible();

  await page.goto("/lawyes-safe-preview?view=not-a-view&q=Maria&jurisdiction=nowhere");
  await expect(page.getByRole("heading", { name: /how can i assist your practice today/i })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: /how can i assist your practice today/i })).toBeVisible();
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

  test("keeps the composer and mobile navigation usable without exposing the desktop rail", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("lawyes-conversation-canvas")).toHaveCount(1);
    await expect(page.getByTestId("lawyes-instruction-composer")).toBeVisible();
    await expect(page.getByTestId("button-submit-instruction")).toBeVisible();
    const closedRailBox = await page.getByTestId("lawyes-conversation-rail").boundingBox();
    expect(closedRailBox).not.toBeNull();
    expect(closedRailBox!.x + closedRailBox!.width).toBeLessThanOrEqual(0);
    await expect(page.getByTestId("button-open-sidebar")).toBeVisible();
    await expect(page.getByTestId("button-mobile-home")).toBeVisible();
    await expect(page.getByTestId("button-mobile-search")).toBeVisible();
    await expect(page.getByTestId("button-mobile-draft")).toBeVisible();
    await expect(page.getByTestId("button-mobile-matter")).toBeVisible();

    const mobileLogo = page.getByTestId("lawyes-mobile-logo");
    await expect(mobileLogo).toBeVisible();
    await expect(mobileLogo).toHaveAttribute("src", /\/lawyes-logo\.png$/);
    const [logoBox, openButtonBox, newWorkspaceBox] = await Promise.all([
      mobileLogo.boundingBox(),
      page.getByTestId("button-open-sidebar").boundingBox(),
      page.getByTestId("button-mobile-new-workspace").boundingBox(),
    ]);
    expect(logoBox).not.toBeNull();
    expect(openButtonBox).not.toBeNull();
    expect(newWorkspaceBox).not.toBeNull();
    expect(logoBox!.x).toBeGreaterThanOrEqual(openButtonBox!.x + openButtonBox!.width);
    expect(logoBox!.x + logoBox!.width).toBeLessThanOrEqual(newWorkspaceBox!.x);

    expect(await page.locator("html").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBeTruthy();

    await page.getByTestId("button-open-sidebar").click();
    await expect(page.getByTestId("lawyes-conversation-rail")).toBeVisible();
    await expect(page.getByTestId("button-toggle-tools")).toHaveAttribute("aria-expanded", "false");
    await page.getByTestId("button-close-sidebar").click();
    await expect(page.getByTestId("lawyes-instruction-composer")).toBeVisible();
  });

  test("keeps focus visible and restores it when the mobile rail opens and closes", async ({ page }) => {
    await page.goto("/lawyes-safe-preview");

    const openRail = page.getByTestId("button-open-sidebar");
    await openRail.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("button-close-sidebar")).toBeFocused();

    await page.getByTestId("button-toggle-tools").focus();
    await page.keyboard.press(" ");
    await expect(page.getByTestId("button-toggle-tools")).toHaveAttribute("aria-expanded", "true");

    await page.getByTestId("button-close-sidebar").focus();
    await page.keyboard.press(" ");
    await expect(openRail).toBeFocused();
    await expect(page.getByTestId("lawyes-conversation-rail")).toHaveAttribute("inert", "");

    await page.keyboard.press("Tab");
    await expect(page.getByTestId("button-mobile-new-workspace")).toBeFocused();

    await openRail.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("button-toggle-tools")).toHaveAttribute("aria-expanded", "true");
    await page.getByTestId("button-sidebar-search").focus();
    await page.keyboard.press(" ");
    await expect(page).toHaveURL(/view=search/);
    await expect(openRail).toBeFocused();
    await expect(page.getByTestId("lawyes-conversation-rail")).toHaveAttribute("inert", "");
  });
});
