# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: case-home-handoffs.spec.ts >> Accident keeps the Case Home handoff scoped to its matter and artifact
- Location: e2e/case-home-handoffs.spec.ts:812:3

# Error details

```
Error: page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost/myaccidentai/workspace/matters/1039
Call log:
  - navigating to "http://localhost/myaccidentai/workspace/matters/1039", waiting until "load"

```

# Test source

```ts
  675 |     );
  676 |     return;
  677 |   }
  678 | 
  679 |   await page.getByTestId("input-review-clause").fill(`Mock SPA clause ${RUN_ID}`);
  680 |   await page.route(
  681 |     "**/api/convey/review-spa",
  682 |     (route) =>
  683 |       route.fulfill({
  684 |         status: 200,
  685 |         contentType: "application/json",
  686 |         body: JSON.stringify({ review: `Mock conveyancing review ${RUN_ID}` }),
  687 |       }),
  688 |     { times: 1 },
  689 |   );
  690 |   await page.getByRole("button", { name: "Review Clause" }).click();
  691 |   const panel = page.getByText("Save this into a matter file?").locator("..");
  692 |   await expect(panel.locator("select")).toHaveValue(String(matterId), { timeout: 20_000 });
  693 |   await assertFilingRequest(
  694 |     page,
  695 |     "/api/convey/saved-work",
  696 |     matterId,
  697 |     panel.getByRole("button", { name: "File here" }),
  698 |   );
  699 | }
  700 | 
  701 | async function assertDestinationContext(
  702 |   page: Page,
  703 |   portal: PortalFlow,
  704 |   matterId: number,
  705 |   title: string,
  706 | ) {
  707 |   if (portal.key === "acc") {
  708 |     const facts = page.getByTestId("textarea-case-facts");
  709 |     await assertEditableMatterContext(facts, title);
  710 |     await expect(page.getByText(/pre-filled from your matter file/i)).toBeVisible();
  711 |     return;
  712 |   }
  713 | 
  714 |   if (portal.key === "lit") {
  715 |     await expect(page.getByText(new RegExp(`Working in file:\\s*${title}`))).toBeVisible({
  716 |       timeout: 20_000,
  717 |     });
  718 |     await expect(page.getByText(/drafts made here will be filed into this matter/i)).toBeVisible();
  719 |     await page.getByRole("button", { name: "AI Draft This Document" }).first().click();
  720 |     const caseDetails = page.getByLabel("Core Facts & Relief Sought");
  721 |     await assertEditableMatterContext(caseDetails, title);
  722 |     return;
  723 |   }
  724 | 
  725 |   if (portal.key === "lit-irac") {
  726 |     await expect(page.getByText("Matter Context (editable)")).toBeVisible({ timeout: 20_000 });
  727 |     const context = page.locator("textarea:visible").first();
  728 |     await assertEditableMatterContext(context, title);
  729 |     await expect(page.getByText(/filed directly into this matter/i)).toBeVisible();
  730 |     return;
  731 |   }
  732 | 
  733 |   if (portal.key === "crim") {
  734 |     const facts = page.getByTestId("textarea-case-facts");
  735 |     await assertEditableMatterContext(facts, RUN_ID);
  736 |     await expect(page.getByText(title).first()).toBeVisible();
  737 |     return;
  738 |   }
  739 | 
  740 |   if (portal.key === "sya") {
  741 |     const facts = page.getByPlaceholder(/Describe the case facts in detail/i);
  742 |     await assertEditableMatterContext(facts, title);
  743 |     await expect(page.getByText(title).first()).toBeVisible();
  744 |     return;
  745 |   }
  746 | 
  747 |   if (portal.key === "corp") {
  748 |     await expect(page.getByText(/Fields pre-filled from matter/i)).toBeVisible({ timeout: 20_000 });
  749 |     await assertEditableMatterContext(
  750 |       page.getByPlaceholder("e.g., Proposed Franchise Arrangement with XYZ Sdn Bhd"),
  751 |       title,
  752 |     );
  753 |     await expect(page.getByText(title).first()).toBeVisible();
  754 |     return;
  755 |   }
  756 | 
  757 |   if (portal.key === "ccb") {
  758 |     await assertEditableMatterContext(page.getByLabel("Subject Matter"), title);
  759 |     await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
  760 |     return;
  761 |   }
  762 | 
  763 |   const context = page.getByTestId("input-review-context");
  764 |   await assertEditableMatterContext(context, title);
  765 |   await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
  766 |   expect(matterId).toBeGreaterThan(0);
  767 | }
  768 | 
  769 | async function exerciseHandoff(
  770 |   page: Page,
  771 |   portal: PortalFlow,
  772 |   matterId: number,
  773 |   title: string,
  774 | ) {
> 775 |   await page.goto(`${BASE}${portal.detailPath(matterId)}`);
      |              ^ Error: page.goto: net::ERR_HTTP_RESPONSE_CODE_FAILURE at http://localhost/myaccidentai/workspace/matters/1039
  776 |   await page.waitForLoadState("domcontentloaded");
  777 | 
  778 |   const panel = page.getByLabel(`Case home for matter ${matterId}`);
  779 |   await expect(panel).toBeVisible({ timeout: 30_000 });
  780 |   await expect(panel.getByText("Outstanding Tasks")).toBeVisible();
  781 |   await expect(panel.getByText("Latest Activity")).toBeVisible();
  782 | 
  783 |   const action = panel.locator(".ch-action-link");
  784 |   await expect(action).toBeVisible();
  785 |   const href = await action.getAttribute("href");
  786 |   expect(href, `${portal.label} Case Home action should have an href`).toBeTruthy();
  787 |   const target = new URL(href!, BASE);
  788 |   expect(
  789 |     target.pathname.startsWith(`${portal.basePath}/`) || target.pathname === portal.basePath,
  790 |     `${portal.label} action escaped its artifact base path: ${target.pathname}`,
  791 |   ).toBe(true);
  792 |   expect(target.searchParams.get(portal.matterParam)).toBe(String(matterId));
  793 | 
  794 |   await action.click();
  795 |   await expect
  796 |     .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
  797 |     .toMatch(portal.destinationPath);
  798 |   expect(new URL(page.url()).pathname.startsWith(portal.basePath)).toBe(true);
  799 |   if (portal.key !== "convey") {
  800 |     expect(new URL(page.url()).searchParams.get(portal.matterParam)).toBe(String(matterId));
  801 |   }
  802 |   await expect(
  803 |     page.locator(
  804 |       `[data-testid="case-home-handoff-target"][data-matter-id="${matterId}"]`,
  805 |     ).first(),
  806 |   ).toBeVisible({ timeout: 30_000 });
  807 |   await assertDestinationContext(page, portal, matterId, title);
  808 |   await assertActualFilingTarget(page, portal, matterId, title);
  809 | }
  810 | 
  811 | for (const portal of PORTALS) {
  812 |   test(`${portal.label} keeps the Case Home handoff scoped to its matter and artifact`, async ({
  813 |     page,
  814 |   }) => {
  815 |     const masterCode = process.env.MASTER_ACCESS_CODE;
  816 |     if (!masterCode) throw new Error("MASTER_ACCESS_CODE env var is required");
  817 | 
  818 |     if (portal.key === "acc") {
  819 |       await page.setViewportSize({ width: 390, height: 844 });
  820 |     }
  821 | 
  822 |     const headers = await authenticate(page, portal.key, masterCode);
  823 |     const matter = await createMatter(page, portal, headers);
  824 | 
  825 |     try {
  826 |       await exerciseHandoff(page, portal, matter.id, matter.title);
  827 | 
  828 |       if (portal.key === "acc") {
  829 |         await page.goto(`${BASE}${portal.detailPath(matter.id)}`);
  830 |         const panel = page.getByLabel(`Case home for matter ${matter.id}`);
  831 |         await expect(panel).toBeVisible({ timeout: 30_000 });
  832 |         const overflow = await panel.evaluate((element) => ({
  833 |           panel: element.scrollWidth - element.clientWidth,
  834 |           document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  835 |         }));
  836 |         expect(overflow.panel, "390px Case Home panel should not overflow horizontally").toBeLessThanOrEqual(1);
  837 |         expect(overflow.document, "390px page should not overflow horizontally").toBeLessThanOrEqual(1);
  838 |       }
  839 |     } finally {
  840 |       await deleteMatter(page, portal, matter.id, headers);
  841 |     }
  842 |   });
  843 | }
  844 | 
  845 | test("task create, update, and complete activity stays synchronized with the Case Home timeline", async ({
  846 |   page,
  847 | }) => {
  848 |   const masterCode = process.env.MASTER_ACCESS_CODE;
  849 |   if (!masterCode) throw new Error("MASTER_ACCESS_CODE env var is required");
  850 | 
  851 |   const portal = PORTALS.find((candidate) => candidate.key === "acc")!;
  852 |   const headers = await authenticate(page, portal.key, masterCode);
  853 |   const matter = await createMatter(page, portal, headers);
  854 |   let taskId: number | null = null;
  855 |   const taskTitle = `Prepare chronology ${RUN_ID}`;
  856 | 
  857 |   try {
  858 |     await page.goto(`${BASE}${portal.detailPath(matter.id)}`);
  859 |     const panel = page.getByLabel(`Case home for matter ${matter.id}`);
  860 |     await expect(panel).toBeVisible({ timeout: 30_000 });
  861 | 
  862 |     await panel.getByRole("button", { name: "+ New Task" }).click();
  863 |     await panel.getByLabel("Title").fill(taskTitle);
  864 |     await panel.getByLabel("Assignee").fill("E2E Lawyer");
  865 |     await panel.getByLabel("Note").fill("Created by the Case Home browser regression suite");
  866 | 
  867 |     const [createResponse] = await Promise.all([
  868 |       page.waitForResponse(
  869 |         (response) =>
  870 |           response.request().method() === "POST" &&
  871 |           response.url().endsWith(`${portal.apiBase}/${matter.id}/tasks`),
  872 |       ),
  873 |       panel.getByRole("button", { name: "Save Task" }).click(),
  874 |     ]);
  875 |     expect(createResponse.status()).toBe(201);
```