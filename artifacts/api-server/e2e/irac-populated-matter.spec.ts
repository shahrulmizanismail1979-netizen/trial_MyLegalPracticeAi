import { expect, test, type APIResponse, type Page } from "@playwright/test";

test.setTimeout(120_000);

const BASE = "http://localhost:80";
const RUN_ID = `irac-fixture-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PATHWAY = "general-civil";

type FixtureIds = {
  matterId?: number;
  taskId?: number;
  outputId?: number;
  documentId?: number;
};

async function expectOk(response: APIResponse, label: string) {
  expect(
    response.ok(),
    `${label}: ${response.status()} ${await response.text().catch(() => "<unreadable>")}`,
  ).toBeTruthy();
}

async function retainLitSessionCookie(page: Page, response: APIResponse) {
  if ((await page.context().cookies()).some((cookie) => cookie.name === "lit.sid")) return;
  const encoded = response
    .headers()["set-cookie"]
    ?.split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
    .find((cookie) => cookie.trimStart().startsWith("lit.sid="))
    ?.split(";")[0];
  const separator = encoded?.indexOf("=") ?? -1;
  if (!encoded || separator < 1) throw new Error("Lit login did not return a lit.sid cookie");
  await page.context().addCookies([
    {
      name: "lit.sid",
      value: encoded.slice(separator + 1),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function authenticate(page: Page) {
  const masterCode = process.env.MASTER_ACCESS_CODE;
  if (!masterCode) throw new Error("MASTER_ACCESS_CODE env var is required");
  const response = await page.request.post("/api/lit/auth/login", {
    data: { password: masterCode },
  });
  await expectOk(response, "Lit login");
  await retainLitSessionCookie(page, response);
  await page.addInitScript(() => localStorage.setItem("mylitai_auth_verified", "true"));
}

async function cleanupFixture(page: Page, fixture: FixtureIds, strict: boolean) {
  const deletions: Array<[number | undefined, string, string]> = [
    [fixture.documentId, `/api/lit/matters/documents/${fixture.documentId}`, "source document"],
    [fixture.outputId, `/api/lit/saved-work/${fixture.outputId}`, "saved output"],
    [
      fixture.taskId,
      `/api/lit/matters/${fixture.matterId}/tasks/${fixture.taskId}`,
      "task",
    ],
    [fixture.matterId, `/api/lit/matters/${fixture.matterId}`, "matter"],
  ];
  for (const [id, path, label] of deletions) {
    if (!id) continue;
    try {
      const response = await page.request.delete(path);
      if (strict) await expectOk(response, `Delete IRAC ${label}`);
    } catch (error) {
      if (strict) throw error;
      console.warn(`Best-effort cleanup failed for IRAC ${label} ${id}`, error);
    }
  }
}

async function createPopulatedIracMatter(page: Page) {
  const matterTitle = `IRAC browser fixture ${RUN_ID}`;
  const taskTitle = `Review pleadings ${RUN_ID}`;
  const outputTitle = `IRAC analysis ${RUN_ID}`;
  const sourceTitle = `Statement of claim ${RUN_ID}.txt`;
  const ids: FixtureIds = {};

  try {
    const matterResponse = await page.request.post("/api/lit/matters", {
      data: {
        title: matterTitle,
        clientName: `Fixture client ${RUN_ID}`,
        plaintiff: "Fixture Plaintiff",
        defendant: "Fixture Defendant",
        matterType: PATHWAY,
        actingFor: "Plaintiff",
        status: "Pre-Trial",
        notes: `Populated through application APIs for ${PATHWAY} browser checks.`,
      },
    });
    await expectOk(matterResponse, "Create IRAC matter");
    ids.matterId = ((await matterResponse.json()) as { id: number }).id;

    const taskResponse = await page.request.post(`/api/lit/matters/${ids.matterId}/tasks`, {
      data: {
        title: taskTitle,
        assignee: "Fixture Lawyer",
        priority: "high",
        status: "open",
        note: "Created by the IRAC browser fixture",
      },
    });
    await expectOk(taskResponse, "Create IRAC task");
    ids.taskId = ((await taskResponse.json()) as { id: number }).id;

    const outputResponse = await page.request.post("/api/lit/saved-work", {
      data: {
        matterId: ids.matterId,
        kind: "irac-analysis",
        title: outputTitle,
        matter: matterTitle,
        inputJson: { tool: "IRAC Analyzer", pathway: PATHWAY },
        content: `Issue, Rule, Application and Conclusion fixture output for ${RUN_ID}.`,
      },
    });
    await expectOk(outputResponse, "Create IRAC saved output");
    ids.outputId = ((await outputResponse.json()) as { id: number }).id;

    const uploadUrlResponse = await page.request.post("/api/lit/matters/documents/upload-url");
    await expectOk(uploadUrlResponse, "Request IRAC source upload URL");
    const upload = (await uploadUrlResponse.json()) as { uploadURL: string; objectPath: string };
    const uploadResponse = await page.request.put(upload.uploadURL, {
      data: Buffer.from(`Source document for ${matterTitle}`),
      headers: { "content-type": "text/plain" },
    });
    await expectOk(uploadResponse, "Upload IRAC source document");

    const documentResponse = await page.request.post("/api/lit/matters/documents/confirm", {
      data: {
        objectPath: upload.objectPath,
        fileName: sourceTitle,
        contentType: "text/plain",
        category: "cause_papers",
        matterId: ids.matterId,
      },
    });
    await expectOk(documentResponse, "Confirm IRAC source document");
    ids.documentId = ((await documentResponse.json()) as { id: number }).id;

    return {
      matterId: ids.matterId,
      taskId: ids.taskId,
      outputId: ids.outputId,
      documentId: ids.documentId,
      matterTitle,
      taskTitle,
      outputTitle,
      sourceTitle,
    };
  } catch (error) {
    await cleanupFixture(page, ids, false);
    throw error;
  }
}

async function assertPopulatedCaseHome(
  page: Page,
  fixture: Awaited<ReturnType<typeof createPopulatedIracMatter>>,
) {
  await page.goto(`${BASE}/mylitai-irac/matters/${fixture.matterId}`);
  const panel = page.getByLabel(`Case home for matter ${fixture.matterId}`);
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByRole("list", { name: "Tasks" }).getByText(fixture.taskTitle, { exact: true })).toBeVisible();
  await expect(panel.getByText(fixture.outputTitle, { exact: true }).last()).toBeVisible();
  await expect(panel.getByText(fixture.sourceTitle, { exact: true }).last()).toBeVisible();
  await expect(panel.getByText("Progress")).toBeVisible();
  await expect(panel.getByText("Outputs")).toBeVisible();
  await expect(panel.getByText("Sources")).toBeVisible();

  const snapshot = await page.request.get(`/api/lit/matters/${fixture.matterId}/case-home`);
  await expectOk(snapshot, "Read populated IRAC Case Home");
  const body = (await snapshot.json()) as {
    matter: { matterType?: string };
    tasks: Array<{ id: number }>;
    savedWork: Array<{ id: number }>;
    documents: Array<{ id: number }>;
  };
  expect(body.matter.matterType).toBe(PATHWAY);
  expect(body.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: fixture.taskId })]));
  expect(body.savedWork).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: fixture.outputId })]),
  );
  expect(body.documents).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: fixture.documentId })]),
  );
}

test("a populated IRAC matter reaches CaseHomePanel on desktop and mobile", async ({ page }) => {
  await authenticate(page);
  const fixture = await createPopulatedIracMatter(page);

  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await assertPopulatedCaseHome(page, fixture);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await assertPopulatedCaseHome(page, fixture);
    const panelOverflow = await page
      .getByLabel(`Case home for matter ${fixture.matterId}`)
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(panelOverflow, "390px IRAC Case Home should not overflow").toBeLessThanOrEqual(1);
  } finally {
    await cleanupFixture(page, fixture, true);
  }
});