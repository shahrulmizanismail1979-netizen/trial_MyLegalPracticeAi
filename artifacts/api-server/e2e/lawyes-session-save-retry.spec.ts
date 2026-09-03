import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { pool } from "@workspace/db";

test.setTimeout(90_000);
test.describe.configure({ mode: "serial" });

const RUN_ID = `lawyes-browser-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const trackedAccessCodeIds: number[] = [];

async function retainLitSessionCookie(page: Page, response: APIResponse) {
  const setCookie = response.headers()["set-cookie"];
  const encoded = setCookie
    ?.split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
    .find((cookie) => cookie.trimStart().startsWith("lit.sid="))
    ?.split(";")[0];
  const separator = encoded?.indexOf("=") ?? -1;
  if (!encoded || separator < 1) {
    throw new Error("Lit login response did not include a session cookie");
  }
  await page.context().addCookies([{
    name: encoded.slice(0, separator).trim(),
    value: encoded.slice(separator + 1),
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

async function seedLawyesTenant(label: string) {
  const code = `${RUN_ID}-${label}`.toUpperCase();
  const owner = await pool.query<{ id: number }>(
    `INSERT INTO lit_access_codes
       (code, recipient_name, recipient_email, status, comped_access)
     VALUES ($1, $2, $3, 'active', true)
     RETURNING id`,
    [code, `LAWYes browser ${label}`, `${RUN_ID}-${label}@test.invalid`],
  );
  const accessCodeId = owner.rows[0]!.id;
  trackedAccessCodeIds.push(accessCodeId);
  const matter = await pool.query<{ id: number }>(
    `INSERT INTO lit_matters (access_code_id, title, status)
     VALUES ($1, $2, 'open')
     RETURNING id`,
    [accessCodeId, `LAWYes ${label} ${RUN_ID}`],
  );
  return { code, accessCodeId, matterId: matter.rows[0]!.id };
}

async function authenticate(page: Page, code: string) {
  const response = await page.request.post("/api/lit/auth/login", {
    data: { password: code },
  });
  expect(response.ok(), `LAWYes login failed: ${response.status()} ${await response.text()}`)
    .toBeTruthy();
  await retainLitSessionCookie(page, response);
  await page.addInitScript(() => {
    localStorage.setItem("lawyes_auth_verified", "true");
  });
}

async function expectSignIn(page: Page) {
  await expect(page.getByRole("heading", { name: "Practitioner Sign In" })).toBeVisible();
  await expect(page.getByLabel("Access Code")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("lawyes_auth_verified")))
    .toBeNull();
}

test.afterAll(async () => {
  if (!trackedAccessCodeIds.length) return;
  await pool.query(
    `DELETE FROM lit_sessions
      WHERE (sess ->> 'accessCodeId')::int = ANY($1::int[])`,
    [trackedAccessCodeIds],
  );
  await pool.query(
    `DELETE FROM lit_access_codes WHERE id = ANY($1::int[])`,
    [trackedAccessCodeIds],
  );
  const residue = await pool.query(
    `SELECT
       (SELECT count(*)::int FROM lit_access_codes WHERE id = ANY($1::int[])) AS codes,
       (SELECT count(*)::int FROM lit_matters WHERE access_code_id = ANY($1::int[])) AS matters,
       (SELECT count(*)::int FROM lit_saved_work WHERE access_code_id = ANY($1::int[])) AS saved_work`,
    [trackedAccessCodeIds],
  );
  expect(residue.rows[0]).toEqual({ codes: 0, matters: 0, saved_work: 0 });
});

test("a revoked session returns to sign-in when a matter request gets 401", async ({ page }) => {
  const tenant = await seedLawyesTenant("matter-expiry");
  const alternateTitle = `LAWYes alternate matter ${RUN_ID}`;
  const alternateMatter = await pool.query<{ id: number }>(
    `INSERT INTO lit_matters (access_code_id, title, status)
     VALUES ($1, $2, 'open')
     RETURNING id`,
    [tenant.accessCodeId, alternateTitle],
  );
  const alternateMatterId = alternateMatter.rows[0]!.id;
  await authenticate(page, tenant.code);
  await page.goto(`/lawyes/${tenant.matterId}`);
  await expect(page.getByRole("heading", { name: `LAWYes matter-expiry ${RUN_ID}` }))
    .toBeVisible();

  await pool.query("UPDATE lit_access_codes SET status = 'inactive' WHERE id = $1", [
    tenant.accessCodeId,
  ]);
  const matterResponse = page.waitForResponse((response) =>
    response.url().endsWith(`/api/lit/lawyes/matters/${alternateMatterId}/workspace`),
  );
  await page.getByRole("button", { name: alternateTitle }).click();
  expect((await matterResponse).status()).toBe(401);

  await expectSignIn(page);
});

test("a revoked session returns to sign-in when an instruction request gets 401", async ({
  page,
}) => {
  const tenant = await seedLawyesTenant("instruction-expiry");
  await authenticate(page, tenant.code);
  await page.goto(`/lawyes/${tenant.matterId}`);
  await expect(page.getByRole("heading", { name: `LAWYes instruction-expiry ${RUN_ID}` }))
    .toBeVisible();

  await pool.query("UPDATE lit_access_codes SET status = 'inactive' WHERE id = $1", [
    tenant.accessCodeId,
  ]);
  await page.getByPlaceholder("Instruct the assistant...").fill("Prepare a short advice note.");
  await page.getByRole("button").filter({ has: page.locator("svg.lucide-arrow-right") }).click();

  await expectSignIn(page);
});

test("a lost save response retries once without duplicating work and survives reload", async ({
  page,
}) => {
  const tenant = await seedLawyesTenant("save-retry");
  await authenticate(page, tenant.code);
  const instruction = `Prepare retry-safe advice ${RUN_ID}`;
  const savedTitle = `Output: ${instruction.substring(0, 30)}...`;

  await page.route(`**/api/lit/lawyes/matters/${tenant.matterId}/instructions`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        content: `Retry-safe saved output ${RUN_ID}`,
        research: "Deterministic browser-test research",
        citations: [{ title: "Test authority", uri: "https://example.test/authority" }],
        verification: {
          status: "requires_independent_verification",
          verified: false,
          guidance: "Verify against primary sources.",
        },
        capabilities: ["grounded_legal_research", "matter_aware_review_or_drafting"],
      }),
    }));

  let saveAttempts = 0;
  const idempotencyKeys: string[] = [];
  await page.route(`**/api/lit/lawyes/matters/${tenant.matterId}/save`, async (route) => {
    saveAttempts += 1;
    idempotencyKeys.push(route.request().postDataJSON().idempotencyKey);
    if (saveAttempts === 1) {
      const committed = await route.fetch();
      expect(committed.status()).toBe(201);
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto(`/lawyes/${tenant.matterId}`);
  await page.getByPlaceholder("Instruct the assistant...").fill(instruction);
  await page.getByRole("button").filter({ has: page.locator("svg.lucide-arrow-right") }).click();
  await expect(page.getByText("Execution Complete")).toBeVisible();

  await page.getByRole("button", { name: "Save to Matter" }).click();
  await expect(page.locator('[data-state="open"]').getByText("Save Failed", { exact: true }))
    .toBeVisible();
  await page.getByRole("button", { name: "Save to Matter" }).click();
  await expect(page.locator('[data-state="open"]').getByText("Saved to Matter", { exact: true }))
    .toBeVisible();

  expect(saveAttempts).toBe(2);
  expect(idempotencyKeys[0]).toBeTruthy();
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
  const savedRows = await pool.query<{ count: number }>(
    `SELECT count(*)::int AS count
       FROM lit_saved_work
      WHERE access_code_id = $1 AND matter_id = $2 AND title = $3`,
    [tenant.accessCodeId, tenant.matterId, savedTitle],
  );
  expect(savedRows.rows[0]!.count).toBe(1);

  await page.reload();
  await page.getByRole("tab", { name: "LAWYes" }).click();
  await expect(page.getByText(savedTitle)).toBeVisible();
});