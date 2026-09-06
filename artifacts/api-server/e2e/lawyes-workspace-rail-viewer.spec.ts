import { expect, test, type APIResponse, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool } from "@workspace/db";

test.setTimeout(90_000);
test.describe.configure({ mode: "serial" });

const RUN_ID = randomUUID().slice(0, 8);
const OWNER_CODE = `LAWYES-RAIL-${RUN_ID}`.toUpperCase();
const VIEWER_CODE = `LY-RAIL-VIEWER-${RUN_ID}`.toUpperCase();
const MATTER_TITLE = `Rail regression matter ${RUN_ID}`;
const OUTPUT_TITLE = `Saved output ${RUN_ID}`;
const RESEARCH_TITLE = `Research record ${RUN_ID}`;
const DRAFT_TITLE = `Canonical draft ${RUN_ID}`;
const CANONICAL_TITLE = `Canonical collision ${RUN_ID}.pdf`;
const BUNDLE_TITLE = `Bundle collision ${RUN_ID}.pdf`;
const UPLOAD_TITLE = `Uploaded evidence ${RUN_ID}.pdf`;

let accessCodeId = 0;
let matterId = 0;
let collisionId = 0;

async function retainLitSessionCookie(page: Page, response: APIResponse) {
  const setCookie = response.headers()["set-cookie"];
  const encoded = setCookie
    ?.split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
    .find((cookie) => cookie.trimStart().startsWith("lit.sid="))
    ?.split(";")[0];
  const separator = encoded?.indexOf("=") ?? -1;
  if (!encoded || separator < 1) throw new Error("LAWYes login did not return a session cookie");
  await page.context().addCookies([{
    name: encoded.slice(0, separator).trim(),
    value: encoded.slice(separator + 1),
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);
}

async function authenticateViewer(page: Page) {
  const response = await page.request.post("/api/lit/auth/login", {
    data: { password: VIEWER_CODE },
  });
  expect(response.ok(), `Viewer login failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  await retainLitSessionCookie(page, response);
  await page.addInitScript(() => localStorage.setItem("lawyes_auth_verified", "true"));
}

async function openResource(page: Page, title: string, expectedType: string) {
  const detailResponse = page.waitForResponse((response) => {
    const path = new URL(response.url()).pathname;
    return response.request().method() === "GET"
      && path.includes(`/api/lit/lawyes/matters/${matterId}/resources/${expectedType}/`)
      && !path.endsWith("/file");
  });
  await page.getByRole("button", { name: title, exact: true }).click();
  expect((await detailResponse).ok()).toBe(true);
  const viewer = page.getByTestId("lawyes-resource-viewer");
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(viewer.getByText("Read-only", { exact: true })).toBeVisible();
}

async function closeResource(page: Page) {
  await page.getByTestId("button-close-resource-viewer").click();
  await expect(page.getByTestId("lawyes-resource-viewer")).toHaveCount(0);
}

test.beforeAll(async () => {
  const owner = await pool.query<{ id: number }>(
    `INSERT INTO lit_access_codes
       (code, recipient_name, recipient_email, status, comped_access)
     VALUES ($1, $2, $3, 'active', true)
     RETURNING id`,
    [OWNER_CODE, `Rail owner ${RUN_ID}`, `rail-owner-${RUN_ID}@test.invalid`],
  );
  accessCodeId = owner.rows[0]!.id;
  const matter = await pool.query<{ id: number }>(
    `INSERT INTO lit_matters (access_code_id, title, status)
     VALUES ($1, $2, 'open')
     RETURNING id`,
    [accessCodeId, MATTER_TITLE],
  );
  matterId = matter.rows[0]!.id;

  const member = await pool.query<{ id: number }>(
    `INSERT INTO lit_lawyes_members (access_code_id, name, email, role)
     VALUES ($1, $2, $3, 'viewer')
     RETURNING id`,
    [accessCodeId, `Rail viewer ${RUN_ID}`, `rail-viewer-${RUN_ID}@test.invalid`],
  );
  const viewerHash = await bcrypt.hash(VIEWER_CODE, 4);
  await pool.query(
    `INSERT INTO lit_lawyes_credentials (member_id, code_lookup_hash, code_hash)
     VALUES ($1, $2, $3)`,
    [member.rows[0]!.id, createHash("sha256").update(VIEWER_CODE).digest("hex"), viewerHash],
  );
  await pool.query(
    `INSERT INTO lit_lawyes_matter_grants (access_code_id, matter_id, member_id, role)
     VALUES ($1, $2, $3, 'viewer')`,
    [accessCodeId, matterId, member.rows[0]!.id],
  );

  await pool.query(
    `INSERT INTO lit_saved_work (access_code_id, matter_id, kind, title, content, input_json)
     VALUES
       ($1, $2, 'lawyes-draft', $3, $4, '{"lawyes":true}'::jsonb),
       ($1, $2, 'case-law-research', $5, $6, $7::jsonb)`,
    [
      accessCodeId,
      matterId,
      OUTPUT_TITLE,
      `Read-only saved output ${RUN_ID}`,
      RESEARCH_TITLE,
      `Read-only research ${RUN_ID}`,
      JSON.stringify({ citations: [{ title: "Rail authority", uri: "https://example.test/rail" }] }),
    ],
  );
  const draft = await pool.query<{ id: number }>(
    `INSERT INTO case_drafts
       (portal, owner_key, matter_id, title, content, version_number)
     VALUES ('lit', $1, $2, $3, $4, 1)
     RETURNING id`,
    [String(accessCodeId), matterId, DRAFT_TITLE, `Read-only draft ${RUN_ID}`],
  );
  await pool.query("UPDATE case_drafts SET root_id = id WHERE id = $1", [draft.rows[0]!.id]);

  const nextId = await pool.query<{ id: number }>(
    `SELECT GREATEST(
       COALESCE((SELECT MAX(id) FROM case_documents), 0),
       COALESCE((SELECT MAX(id) FROM lit_bundle_documents), 0)
     ) + 10000 AS id`,
  );
  collisionId = nextId.rows[0]!.id;
  await pool.query(
    `INSERT INTO case_documents
       (id, portal, owner_key, matter_id, object_path, file_name, content_type, category)
     VALUES
       ($1, 'lit', $2, $3, $4, $5, 'application/pdf', 'correspondence'),
       ($1 + 1, 'lit', $2, $3, $6, $7, 'application/pdf', 'evidence')`,
    [
      collisionId,
      String(accessCodeId),
      matterId,
      `/lawyes-e2e/${RUN_ID}/canonical.pdf`,
      CANONICAL_TITLE,
      `/lawyes-e2e/${RUN_ID}/upload.pdf`,
      UPLOAD_TITLE,
    ],
  );
  const bundle = await pool.query<{ id: number }>(
    `INSERT INTO lit_bundles (access_code_id, matter_id, title)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [accessCodeId, matterId, `Collision bundle ${RUN_ID}`],
  );
  await pool.query(
    `INSERT INTO lit_bundle_documents
       (id, bundle_id, access_code_id, title, object_path, file_name, content_type)
     VALUES ($1, $2, $3, $4, $5, $4, 'application/pdf')`,
    [collisionId, bundle.rows[0]!.id, accessCodeId, BUNDLE_TITLE, `/lawyes-e2e/${RUN_ID}/bundle.pdf`],
  );
});

test.afterAll(async () => {
  if (!accessCodeId) return;
  await pool.query(
    `DELETE FROM lit_sessions
      WHERE (sess ->> 'accessCodeId')::int = $1`,
    [accessCodeId],
  );
  await pool.query(
    "DELETE FROM case_documents WHERE portal = 'lit' AND owner_key = $1 AND matter_id = $2",
    [String(accessCodeId), matterId],
  );
  await pool.query(
    "DELETE FROM case_drafts WHERE portal = 'lit' AND owner_key = $1 AND matter_id = $2",
    [String(accessCodeId), matterId],
  );
  await pool.query("DELETE FROM lit_access_codes WHERE id = $1", [accessCodeId]);
});

test("viewer opens every workspace-rail resource without write or export controls", async ({ page }) => {
  await authenticateViewer(page);
  await page.goto(`/lawyes/${matterId}`);
  await expect(page.getByRole("heading", { name: MATTER_TITLE })).toBeVisible();
  await expect(page.getByTestId("status-read-only")).toBeVisible();

  const resources = [
    [OUTPUT_TITLE, "saved-work"],
    [DRAFT_TITLE, "draft"],
    [CANONICAL_TITLE, "case-document"],
    [BUNDLE_TITLE, "bundle-document"],
    [UPLOAD_TITLE, "case-document"],
    [RESEARCH_TITLE, "saved-work"],
  ] as const;
  for (const [title, type] of resources) {
    await openResource(page, title, type);
    await closeResource(page);
  }

  expect(CANONICAL_TITLE).not.toBe(BUNDLE_TITLE);
  const forbidden = /^(confirm|verify|edit|copy|download|replace|export|delete|remove|unlink|save to matter|add evidence source)/i;
  await expect(page.getByRole("button", { name: forbidden })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /export|download/i })).toHaveCount(0);
  await expect(page.getByTestId("button-add-evidence-source")).toHaveCount(0);
  await expect(page.locator('[data-testid^="button-confirm-evidence-"]')).toHaveCount(0);
  await expect(page.getByTestId("input-matter-evidence-source")).toHaveCount(0);
});

for (const responsiveCase of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
] as const) {
  test.describe(`${responsiveCase.name} workspace rail`, () => {
    test.use({ viewport: { width: responsiveCase.width, height: responsiveCase.height } });

    test("detail overlays the workspace and closing it preserves the active matter", async ({ page }) => {
      await authenticateViewer(page);
      await page.goto(`/lawyes/${matterId}`);
      await expect(page.getByRole("heading", { name: MATTER_TITLE })).toBeVisible();
      const activeUrl = page.url();

      await page.getByTestId("button-toggle-matter-context").click();
      const matterContext = page.getByText("Matter Context", { exact: true });
      await expect(matterContext).toBeVisible();
      const railBox = await matterContext.boundingBox();
      await openResource(page, RESEARCH_TITLE, "saved-work");

      const dialogBox = await page.getByRole("dialog", { name: "Resource details" }).boundingBox();
      const viewerBox = await page.getByTestId("lawyes-resource-viewer").boundingBox();
      expect(railBox).not.toBeNull();
      expect(dialogBox).not.toBeNull();
      expect(viewerBox).not.toBeNull();
      expect(dialogBox!.x).toBeLessThan(railBox!.x);
      expect(dialogBox!.x + dialogBox!.width).toBe(responsiveCase.width);
      expect(dialogBox!.y + dialogBox!.height).toBe(responsiveCase.height);
      expect(viewerBox!.width).toBeGreaterThanOrEqual(responsiveCase.width / 2);
      await closeResource(page);

      await expect(page).toHaveURL(activeUrl);
      await expect(page.getByRole("heading", { name: MATTER_TITLE })).toBeVisible();
    });
  });
}