import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import {
  BASE,
  cleanupFixture,
  createFixture,
  fixtureFor,
  recoverRunForPortal,
  RUN_ID,
  type DownloadFixture,
  type LargeFixture,
} from "./helpers/large-native-download-fixtures";

/**
 * Case Home's document/output rail must let the browser perform a native
 * attachment download. The native Download event is the attachment contract;
 * its URL is checked directly, while a separate cookie-only Node request
 * checks the response headers.
 */

test.setTimeout(180_000);
test.describe.configure({ mode: "parallel" });

const CLEANUP_TIMEOUT_MS = 90_000;
const activeFixtures = new Set<LargeFixture>();

type BlobProbeWindow = Window & {
  __largeNativeDownloadBlobSizes?: number[];
  __largeNativeDownloadObjectUrlBlobSizes?: number[];
};

async function installBlobProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalBlob = window.Blob;
    const probeWindow = window as BlobProbeWindow;
    probeWindow.__largeNativeDownloadBlobSizes = [];
    const recordBlobSize = (size: number) => {
      probeWindow.__largeNativeDownloadBlobSizes!.push(size);
    };
    const observed = new Proxy(originalBlob, {
      construct(target, args, newTarget) {
        const value = Reflect.construct(target, args, newTarget) as Blob;
        recordBlobSize(value.size);
        return value;
      },
    });
    window.Blob = observed;
    probeWindow.__largeNativeDownloadObjectUrlBlobSizes = [];

    const originalResponseBlob = Response.prototype.blob;
    Response.prototype.blob = function () {
      return originalResponseBlob.call(this).then((value) => {
        recordBlobSize(value.size);
        return value;
      });
    };

    const originalXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (body) {
      this.addEventListener("load", () => {
        if (this.responseType === "blob" && this.response instanceof originalBlob) {
          recordBlobSize(this.response.size);
        }
      });
      return originalXhrSend.call(this, body);
    };

    const originalCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = (value: Blob) => {
      probeWindow.__largeNativeDownloadObjectUrlBlobSizes!.push(
        value instanceof originalBlob ? value.size : 0,
      );
      return originalCreateObjectURL.call(URL, value);
    };
  });
}

async function expectNativeDownload(
  page: Page,
  button: ReturnType<Page["getByRole"]>,
  expected: DownloadFixture,
  expectedUrl: string,
): Promise<void> {
  const pageUrlBeforeClick = page.url();
  // Start this wait before click. The native Download event itself proves
  // attachment handling; it does not require a page response event.
  const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
  await button.click();
  const download = await downloadPromise;

  expect(await download.failure()).toBeNull();
  expect(new URL(download.url()).href).toBe(new URL(expectedUrl).href);
  expect(download.suggestedFilename()).toBe(expected.fileName);
  expect(page.url()).toBe(pageUrlBeforeClick);

  const downloadPath = await download.path();
  let downloadedBytes: Buffer;
  if (downloadPath) {
    downloadedBytes = await fs.readFile(downloadPath);
  } else {
    const stream = await download.createReadStream();
    expect(stream, "Playwright should expose downloaded bytes").not.toBeNull();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    downloadedBytes = Buffer.concat(chunks);
  }
  expect(downloadedBytes.length).toBe(expected.bytes.length);
  expect(createHash("sha256").update(downloadedBytes).digest("hex")).toBe(expected.sha256);

  const blobSizes = await page.evaluate(() => {
    const probeWindow = window as BlobProbeWindow;
    return [...(probeWindow.__largeNativeDownloadBlobSizes ?? [])];
  });
  expect(
    blobSizes.some((size) => size >= expected.bytes.length),
    `native download must not create a full-file Blob (observed sizes: ${blobSizes.join(", ")})`,
  ).toBe(false);
  const objectUrlBlobSizes = await page.evaluate(() => {
    const probeWindow = window as BlobProbeWindow;
    return [...(probeWindow.__largeNativeDownloadObjectUrlBlobSizes ?? [])];
  });
  expect(
    objectUrlBlobSizes.some((size) => size >= expected.bytes.length),
    `native download must not use a full-file Blob URL (observed sizes: ${objectUrlBlobSizes.join(", ")})`,
  ).toBe(false);

  // Headers are intentionally checked separately, not captured from the
  // native download. This request carries the browser context cookies only
  // (no Authorization header); response.body() remains a Node-side buffer,
  // never a page Blob or page JavaScript value.
  const headerResponse = await page.request.get(download.url());
  try {
    expect(headerResponse.status()).toBe(200);
    const contractBytes = await headerResponse.body();
    expect(contractBytes.length).toBe(expected.bytes.length);
    const headers = headerResponse.headers();
    expect(headers["content-disposition"]).toMatch(
      new RegExp(
        `^attachment;\\s*filename="${expected.fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"$`,
      ),
    );
    expect(headers["content-type"]).toContain("application/octet-stream");
    expect(headers["cache-control"]).toContain("private");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  } finally {
    await headerResponse.dispose();
  }
}

async function cleanupTrackedFixture(page: Page, fixture: LargeFixture): Promise<void> {
  if (!fixture.cleanupPromise) {
    fixture.cleanupPromise = cleanupFixture(page, fixture)
      .then(() => {
        activeFixtures.delete(fixture);
      })
      .catch((error) => {
        // Keep the fixture registered when storage cleanup fails. Its DB
        // pointers are intentionally retained by cleanupFixture so a retry or
        // LARGE_NATIVE_RECOVER_RUN_ID invocation can converge later.
        fixture.cleanupPromise = undefined;
        throw error;
      });
  }
  await fixture.cleanupPromise;
}

test.afterEach(async ({ page }, testInfo) => {
  const pending = [...activeFixtures].filter((fixture) => fixture.testId === testInfo.testId);
  if (pending.length === 0) return;
  testInfo.setTimeout(testInfo.timeout + CLEANUP_TIMEOUT_MS);
  await Promise.all(pending.map((fixture) => cleanupTrackedFixture(page, fixture)));
});

async function openMatter(page: Page, fixture: LargeFixture): Promise<void> {
  const path =
    fixture.portal === "ccb"
      ? `/myccblitai/workspace/matters/${fixture.matterId}`
      : `/mylitai/app/matters/${fixture.matterId}`;
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  const panel = page.getByLabel(`Case home for matter ${fixture.matterId}`);
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText("Sources")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: `Open source document ${fixture.source.fileName}` }),
  ).toBeVisible();
}

test("CCB large source and saved output use native attachment downloads", async ({ page }, testInfo) => {
  await recoverRunForPortal("ccb");
  const fixture = fixtureFor("ccb");
  fixture.testId = testInfo.testId;
  activeFixtures.add(fixture);
  try {
    await installBlobProbe(page);
    await createFixture(page, fixture);
    await openMatter(page, fixture);
    const panel = page.getByLabel(`Case home for matter ${fixture.matterId}`);
    await expectNativeDownload(
      page,
      panel.getByRole("button", { name: `Open source document ${fixture.source.fileName}` }),
      fixture.source,
      `${BASE}/api/ccb/matters/${fixture.matterId}/case-home/documents/${fixture.documentId}/open?download=1`,
    );
    expect(fixture.output).toBeDefined();
    await expectNativeDownload(
      page,
      panel.getByRole("button", {
        name: `Open saved output Large saved output ${RUN_ID}`,
      }),
      fixture.output!,
      `${BASE}/api/ccb/matters/${fixture.matterId}/case-home/saved-work/${fixture.savedWorkId}/open?download=1`,
    );
  } finally {
    await cleanupTrackedFixture(page, fixture);
  }
});

test("Lit cookie-session large source uses a native attachment download", async ({ page }, testInfo) => {
  await recoverRunForPortal("lit");
  const fixture = fixtureFor("lit");
  fixture.testId = testInfo.testId;
  activeFixtures.add(fixture);
  try {
    await installBlobProbe(page);
    await createFixture(page, fixture);
    await openMatter(page, fixture);
    const panel = page.getByLabel(`Case home for matter ${fixture.matterId}`);
    await expectNativeDownload(
      page,
      panel.getByRole("button", { name: `Open source document ${fixture.source.fileName}` }),
      fixture.source,
      `${BASE}/api/lit/matters/${fixture.matterId}/case-home/documents/${fixture.documentId}/open?download=1`,
    );
  } finally {
    await cleanupTrackedFixture(page, fixture);
  }
});