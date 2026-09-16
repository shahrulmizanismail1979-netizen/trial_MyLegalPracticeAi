import { expect, type APIResponse, type Page } from "@playwright/test";
import { createHash, randomBytes } from "node:crypto";
import { pool } from "@workspace/db";
import { ObjectStorageService } from "../../src/lib/objectStorage";

export const BASE = "http://localhost:80";
export const RUN_ID = `large-native-${Date.now()}-${randomBytes(4).toString("hex")}`;
export const LARGE_FIXTURE_BYTES = 8 * 1024 * 1024 + 137;
const storage = new ObjectStorageService();
const RUN_ID_PATTERN = /^large-native-\d{13}-[0-9a-f]{8}$/;

export type PortalKey = "ccb" | "lit";

export type Auth = {
  headers: Record<string, string>;
};

export type DownloadFixture = {
  bytes: Buffer;
  sha256: string;
  fileName: string;
  contentType: string;
};

export type LargeFixture = {
  portal: PortalKey;
  testId?: string;
  code: string;
  codeId?: number;
  matterId?: number;
  documentId?: number;
  savedWorkId?: number;
  matterTitle: string;
  source: DownloadFixture;
  output?: DownloadFixture;
  objectPaths: Set<string>;
  auth?: Auth;
  cleanupPromise?: Promise<void>;
};

export type CleanupReport = {
  objectCount: number;
  rowCount: number;
};

export function makeFixture(label: string, fileName: string, contentType: string): DownloadFixture {
  const seed = createHash("sha256").update(`${RUN_ID}:${label}`).digest();
  const bytes = Buffer.allocUnsafe(LARGE_FIXTURE_BYTES);
  for (let offset = 0; offset < bytes.length; offset += 1) {
    // A varied deterministic payload makes an accidental truncated download
    // visible while avoiding a fixture file checked into the repo.
    bytes[offset] = seed[offset % seed.length] ^ ((offset * 31 + label.length) & 0xff);
  }
  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    fileName,
    contentType,
  };
}

export function fixtureFor(portal: PortalKey): LargeFixture {
  const source = makeFixture(
    `${portal}:source`,
    `large-source-${portal}-${RUN_ID}.bin`,
    "application/octet-stream",
  );
  const output =
    portal === "ccb"
      ? makeFixture(
          `${portal}:saved-output`,
          `large-saved-output-${portal}-${RUN_ID}.txt`,
          "application/octet-stream",
        )
      : undefined;
  return {
    portal,
    code: `${RUN_ID}-${portal}-code`.toUpperCase(),
    matterTitle: `Large native download ${portal} ${RUN_ID}`,
    source,
    output,
    objectPaths: new Set<string>(),
  };
}

async function expectOk(response: APIResponse, label: string): Promise<void> {
  expect(
    response.ok(),
    `${label}: ${response.status()} ${await response.text().catch(() => "<unreadable>")}`,
  ).toBeTruthy();
}

async function retainLitSessionCookie(page: Page, response: APIResponse): Promise<void> {
  if ((await page.context().cookies()).some((cookie) => cookie.name === "lit.sid")) return;
  const encoded = response
    .headers()["set-cookie"]
    ?.split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
    .find((cookie) => cookie.trimStart().startsWith("lit.sid="))
    ?.split(";")[0];
  const separator = encoded?.indexOf("=") ?? -1;
  if (!encoded || separator < 1) {
    throw new Error("Lit login response did not include a session cookie");
  }
  await page.context().addCookies([
    {
      name: encoded.slice(0, separator).trim(),
      value: encoded.slice(separator + 1),
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function authenticate(page: Page, fixture: LargeFixture): Promise<Auth> {
  if (fixture.portal === "ccb") {
    const response = await page.request.post("/api/ccb/auth/verify", {
      data: { code: fixture.code },
    });
    await expectOk(response, "CCB login");
    const body = (await response.json()) as { token?: string };
    expect(body.token, "CCB login should return a bearer token").toBeTruthy();
    await page.addInitScript((token) => {
      localStorage.setItem("myccblitai_access_token", token);
    }, body.token!);
    return { headers: { Authorization: `Bearer ${body.token}` } };
  }

  const response = await page.request.post("/api/lit/auth/login", {
    data: { password: fixture.code },
  });
  await expectOk(response, "Lit login");
  await retainLitSessionCookie(page, response);
  await page.addInitScript(() => {
    localStorage.setItem("mylitai_auth_verified", "true");
  });
  return { headers: {} };
}

async function uploadObject(
  page: Page,
  fixture: LargeFixture,
  path: string,
  bytes: Buffer,
  contentType: string,
  label: string,
): Promise<string> {
  const uploadUrlResponse = await page.request.post(path, {
    headers: fixture.auth?.headers,
  });
  await expectOk(uploadUrlResponse, `${fixture.portal} ${label} upload URL`);
  const upload = (await uploadUrlResponse.json()) as {
    uploadURL?: string;
    objectPath?: string;
  };
  expect(upload.uploadURL, `${label} upload URL should be returned`).toBeTruthy();
  expect(upload.objectPath, `${label} object path should be returned`).toBeTruthy();
  fixture.objectPaths.add(upload.objectPath!);

  const putResponse = await page.request.put(upload.uploadURL!, {
    data: bytes,
    headers: { "content-type": contentType },
  });
  await expectOk(putResponse, `${fixture.portal} ${label} object upload`);
  return upload.objectPath!;
}

export async function createFixture(page: Page, fixture: LargeFixture): Promise<void> {
  const codeResult =
    fixture.portal === "ccb"
      ? await pool.query<{ id: number }>(
          `INSERT INTO ccb_access_codes (code, label, active)
           VALUES ($1, $2, true)
           RETURNING id`,
          [fixture.code, `Large native download ${RUN_ID}`],
        )
      : await pool.query<{ id: number }>(
          `INSERT INTO lit_access_codes
             (code, recipient_name, recipient_email, status, comped_access)
           VALUES ($1, $2, $3, 'active', true)
           RETURNING id`,
          [
            fixture.code,
            `Large native download ${RUN_ID}`,
            `${RUN_ID}-${fixture.portal}@test.invalid`,
          ],
        );
  fixture.codeId = codeResult.rows[0]?.id;
  expect(fixture.codeId, `${fixture.portal} fixture code should be created`).toBeTruthy();

  fixture.auth = await authenticate(page, fixture);

  const matterResult =
    fixture.portal === "ccb"
      ? await pool.query<{ id: number }>(
          `INSERT INTO ccb_matters
             (access_code_id, title, matter_type, reference, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [fixture.codeId, fixture.matterTitle, "Native download", RUN_ID, "Pre-Action"],
        )
      : await pool.query<{ id: number }>(
          `INSERT INTO lit_matters
             (access_code_id, title, matter_type, acting_for, status)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            fixture.codeId,
            fixture.matterTitle,
            "General Civil Litigation",
            "Plaintiff",
            "Pre-Trial",
          ],
        );
  fixture.matterId = matterResult.rows[0]?.id;
  expect(fixture.matterId, `${fixture.portal} fixture matter should be created`).toBeTruthy();

  const mattersPath = fixture.portal === "ccb" ? "/api/ccb/matters" : "/api/lit/matters";
  const sourceObjectPath = await uploadObject(
    page,
    fixture,
    `${mattersPath}/documents/upload-url`,
    fixture.source.bytes,
    fixture.source.contentType,
    "source",
  );
  const documentResponse = await page.request.post(`${mattersPath}/documents/confirm`, {
    headers: fixture.auth.headers,
    data: {
      objectPath: sourceObjectPath,
      fileName: fixture.source.fileName,
      contentType: fixture.source.contentType,
      category: "evidence",
      matterId: fixture.matterId,
    },
  });
  await expectOk(documentResponse, `${fixture.portal} confirm source document`);
  fixture.documentId = ((await documentResponse.json()) as { id?: number }).id;
  expect(fixture.documentId, `${fixture.portal} source document should be created`).toBeTruthy();

  if (fixture.portal === "ccb" && fixture.output) {
    const outputObjectPath = await uploadObject(
      page,
      fixture,
      "/api/ccb/saved-work/upload-url",
      fixture.output.bytes,
      fixture.output.contentType,
      "saved output",
    );
    const savedResponse = await page.request.post("/api/ccb/saved-work", {
      headers: fixture.auth.headers,
      data: {
        matterId: fixture.matterId,
        kind: "large-native-download",
        title: `Large saved output ${RUN_ID}`,
        matter: fixture.matterTitle,
        inputJson: { fixture: RUN_ID, tool: "large-native-download-e2e" },
        objectPath: outputObjectPath,
        fileName: fixture.output.fileName,
        contentType: fixture.output.contentType,
        clientRequestId: `${RUN_ID}-saved-output`,
      },
    });
    await expectOk(savedResponse, "CCB confirm saved output");
    fixture.savedWorkId = ((await savedResponse.json()) as { id?: number }).id;
    expect(fixture.savedWorkId, "CCB saved output should be created").toBeTruthy();
  }
}

function isMissingObjectError(error: unknown): boolean {
  const candidate = error as { code?: string | number; statusCode?: number; message?: string };
  return (
    candidate?.code === 404 ||
    candidate?.code === "404" ||
    candidate?.statusCode === 404 ||
    /not found|no such object|does not exist/i.test(candidate?.message ?? "")
  );
}

async function deleteObject(objectPath: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const file = await storage.getObjectEntityFile(objectPath);
      await file.delete();
      return;
    } catch (error) {
      if (isMissingObjectError(error)) return;
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

export async function cleanupFixture(
  page: Page | undefined,
  fixture: LargeFixture,
): Promise<CleanupReport> {
  const ownerId = fixture.codeId;
  const matterId = fixture.matterId;
  const portal = fixture.portal;
  const matterPath = portal === "ccb" ? "/api/ccb/matters" : "/api/lit/matters";
  const storagePaths = new Set(fixture.objectPaths);

  if (ownerId) {
    const documents = await pool.query<{ object_path: string }>(
      `SELECT object_path FROM case_documents
       WHERE portal = $1 AND owner_key = $2`,
      [portal, String(ownerId)],
    );
    for (const row of documents.rows) storagePaths.add(row.object_path);
    const pending = await pool.query<{ object_path: string }>(
      `SELECT object_path FROM case_pending_uploads
       WHERE portal = $1 AND owner_key = $2`,
      [portal, String(ownerId)],
    );
    for (const row of pending.rows) storagePaths.add(row.object_path);
    if (portal === "ccb") {
      const saved = await pool.query<{ object_path: string | null }>(
        `SELECT object_path FROM ccb_saved_work
         WHERE access_code_id = $1 AND object_path IS NOT NULL`,
        [ownerId],
      );
      for (const row of saved.rows) {
        if (row.object_path) storagePaths.add(row.object_path);
      }
    }
  }

  // Never remove registry rows while an object delete is unresolved. The
  // database path remains the retry registry for the next invocation.
  const storageErrors: unknown[] = [];
  for (const objectPath of storagePaths) {
    try {
      await deleteObject(objectPath);
    } catch (error) {
      storageErrors.push(error);
    }
  }
  if (storageErrors.length > 0) {
    throw new Error(
      `Large native download storage cleanup failed; DB registry was retained for retry: ${storageErrors
        .map((error) => (error instanceof Error ? error.message : String(error)))
        .join("; ")}`,
    );
  }

  const routeErrors: unknown[] = [];
  const attemptRouteDelete = async (operation: () => Promise<APIResponse>) => {
    try {
      const response = await operation();
      if (!response.ok() && response.status() !== 404) {
        routeErrors.push(new Error(`Cleanup route returned HTTP ${response.status()}`));
      }
    } catch (error) {
      routeErrors.push(error);
    }
  };
  if (page && fixture.documentId) {
    await attemptRouteDelete(() =>
      page.request.delete(`${matterPath}/documents/${fixture.documentId}`, {
        headers: fixture.auth?.headers,
        timeout: 10_000,
      }),
    );
  }
  if (page && fixture.savedWorkId) {
    await attemptRouteDelete(() =>
      page.request.delete(`/api/ccb/saved-work/${fixture.savedWorkId}`, {
        headers: fixture.auth?.headers,
        timeout: 10_000,
      }),
    );
  }

  let deletedRows = 0;
  const deleteQuery = async (text: string, values: unknown[]) => {
    const result = await pool.query(text, values);
    deletedRows += result.rowCount ?? 0;
  };
  if (ownerId) {
    await deleteQuery(`DELETE FROM case_documents WHERE portal = $1 AND owner_key = $2`, [
      portal,
      String(ownerId),
    ]);
    await deleteQuery(`DELETE FROM case_pending_uploads WHERE portal = $1 AND owner_key = $2`, [
      portal,
      String(ownerId),
    ]);
    await deleteQuery(`DELETE FROM case_tasks WHERE portal = $1 AND owner_key = $2`, [
      portal,
      String(ownerId),
    ]);
    await deleteQuery(`DELETE FROM case_checklists WHERE portal = $1 AND owner_key = $2`, [
      portal,
      String(ownerId),
    ]);
    await deleteQuery(`DELETE FROM case_events WHERE portal = $1 AND owner_key = $2`, [
      portal,
      String(ownerId),
    ]);
  }
  if (matterId) {
    await deleteQuery(`DELETE FROM case_stage_history WHERE portal = $1 AND matter_id = $2`, [
      portal,
      matterId,
    ]);
    await deleteQuery(`DELETE FROM case_intake_briefing WHERE portal = $1 AND matter_id = $2`, [
      portal,
      matterId,
    ]);
    if (portal === "ccb") {
      await deleteQuery(
        `DELETE FROM ccb_saved_work
         WHERE access_code_id = $1 AND (id = $2 OR matter_id = $3)`,
        [ownerId ?? 0, fixture.savedWorkId ?? 0, matterId],
      );
      await deleteQuery(`DELETE FROM ccb_matters WHERE id = $1`, [matterId]);
    } else {
      await deleteQuery(`DELETE FROM lit_matters WHERE id = $1`, [matterId]);
    }
  }
  if (ownerId) {
    if (portal === "ccb") {
      await deleteQuery(`DELETE FROM ccb_saved_work WHERE access_code_id = $1`, [ownerId]);
      await deleteQuery(`DELETE FROM ccb_access_codes WHERE id = $1`, [ownerId]);
    } else {
      await deleteQuery(`DELETE FROM lit_sessions WHERE sess ->> 'accessCodeId' = $1`, [
        String(ownerId),
      ]);
      await deleteQuery(`DELETE FROM lit_saved_work WHERE access_code_id = $1`, [ownerId]);
      await deleteQuery(`DELETE FROM lit_access_codes WHERE id = $1`, [ownerId]);
    }
  } else {
    const codeTable = portal === "ccb" ? "ccb_access_codes" : "lit_access_codes";
    await deleteQuery(`DELETE FROM ${codeTable} WHERE code = $1`, [fixture.code]);
  }
  if (routeErrors.length > 0) {
    throw new Error(
      `Large native download cleanup route failure(s): ${routeErrors
        .map((error) => (error instanceof Error ? error.message : String(error)))
        .join("; ")}`,
    );
  }
  return { objectCount: storagePaths.size, rowCount: deletedRows };
}

export function recoveryRunId(): string | null {
  const value = process.env.LARGE_NATIVE_RECOVER_RUN_ID;
  if (value === undefined || value === "") return null;
  if (!RUN_ID_PATTERN.test(value)) {
    throw new Error(
      "LARGE_NATIVE_RECOVER_RUN_ID must exactly match large-native-<13-digit-timestamp>-<8 lowercase hex chars>",
    );
  }
  return value;
}

export async function recoverRunForPortal(portal: PortalKey): Promise<void> {
  const runId = recoveryRunId();
  if (!runId) return;
  const code = `${runId}-${portal}-code`.toUpperCase();
  const codeTable = portal === "ccb" ? "ccb_access_codes" : "lit_access_codes";
  const matterTable = portal === "ccb" ? "ccb_matters" : "lit_matters";
  const title = `Large native download ${portal} ${runId}`;
  const codeResult = await pool.query<{ id: number }>(
    `SELECT id FROM ${codeTable} WHERE code = $1`,
    [code],
  );
  if (codeResult.rows.length === 0) {
    console.info(`[large-native-download] recovery ${portal}: exact code not found`);
    return;
  }
  const codeId = codeResult.rows[0].id;
  const matterResult = await pool.query<{ id: number }>(
    `SELECT id FROM ${matterTable} WHERE access_code_id = $1 AND title = $2`,
    [codeId, title],
  );
  const fixture: LargeFixture = {
    portal,
    code,
    codeId,
    matterId: matterResult.rows[0]?.id,
    matterTitle: title,
    source: { bytes: Buffer.alloc(0), sha256: "", fileName: "", contentType: "" },
    objectPaths: new Set<string>(),
  };
  const report = await cleanupFixture(undefined, fixture);
  console.info(
    `[large-native-download] recovery ${portal}: code=${codeId}, matter=${
      fixture.matterId ?? "none"
    }, objects=${report.objectCount}, rows=${report.rowCount}, cleanup complete`,
  );
}