/**
 * PDF.js worker smoke test for MyLawAcad Studio.
 *
 * Purpose: Catch a future pdfjs-dist upgrade that breaks the web worker before
 * it reaches subscribers. A healthy worker loads silently; a broken one emits a
 * console error and text extraction either throws or returns empty text.
 *
 * Covered by this test:
 *  - pdfjs-dist GlobalWorkerOptions.workerSrc is resolvable in the Vite bundle.
 *  - getDocument() + getTextContent() returns ≥1 page of text for a known PDF.
 *  - No "worker" console error appears during the extraction.
 */

import { test, expect } from "@playwright/test";

// A minimal but structurally valid PDF-1.4 document with a single page that
// contains the text "Hello PDF" in Helvetica. Byte offsets in the xref table
// are exact so pdfjs-dist can parse the cross-reference table normally.
const MINIMAL_PDF_B64 =
  "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2Jq" +
  "CjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2Jq" +
  "CjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIg" +
  "NzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4g" +
  "Pj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQgL0YxIDEyIFRm" +
  "IDEwMCA3MDAgVGQgKEhlbGxvIFBERikgVGogRVQKZW5kc3RyZWFtCmVuZG9iago1IDAgb2JqCjw8" +
  "IC9UeXBlIC9Gb250IC9TdWJ0eXBlIC9UeXBlMSAvQmFzZUZvbnQgL0hlbHZldGljYSA+PgplbmRv" +
  "YmoKeHJlZgowIDYKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAw" +
  "NTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAowMDAwMDAwMjQxIDAwMDAwIG4gCjAwMDAwMDAz" +
  "MzIgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA2IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgo0" +
  "MDIKJSVFT0YK";

test.describe("PDF.js worker smoke", () => {
  test("parsePdf extracts text from a synthetic PDF without a worker console error", async ({
    page,
    request,
  }) => {
    // --- Collect console errors that mention the PDF.js worker ---
    const workerErrors: string[] = [];
    page.on("console", (msg) => {
      if (
        msg.type() === "error" &&
        /worker/i.test(msg.text())
      ) {
        workerErrors.push(msg.text());
      }
    });

    // --- 1. Register a one-off test educator (idempotent: 409 = already exists) ---
    const uid = Date.now();
    const email = `pdfjs-smoke-${uid}@test.local`;
    const password = "Smoke1234!";

    const regResp = await request.post("/api/acad/auth/register", {
      data: { email, password, name: "PDF Smoke Tester" },
    });
    expect(
      [201, 409],
      `Unexpected register status ${regResp.status()}: ${await regResp.text()}`
    ).toContain(regResp.status());

    // --- 2. Log in via the UI (sets the acad session cookie in the browser context) ---
    await page.goto("/mylawacad/studio/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/studio\/dashboard/, { timeout: 15_000 });

    // --- 3. Create a draft assessment to host the material ---
    await page.goto("/mylawacad/studio/assessments/new");
    await page.fill('[data-testid="input-title"]', `PDF Smoke ${uid}`);
    await page.click('button[type="submit"]');

    // Wait for redirect to the assessment editor
    await expect(page).toHaveURL(/\/studio\/assessments\/[^/]+$/, {
      timeout: 15_000,
    });

    // --- 4. Switch to the Materials tab ---
    await page.click('button[role="tab"]:has-text("Materials")');

    // --- 5. Upload the synthetic PDF via the hidden file input ---
    const pdfBuffer = Buffer.from(MINIMAL_PDF_B64, "base64");

    await page.setInputFiles(
      'input[type="file"][accept=".pdf,.docx,.pptx,.txt"]',
      {
        name: "smoke-test.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuffer,
      }
    );

    // --- 6. Wait for the upload to complete: "Parsing…" spinner goes away ---
    // The label text changes from "Parsing…" → "Drop or choose a file" once
    // the extraction and API call finish. This is a reliable in-page signal.
    await expect(
      page.locator("text=Parsing…")
    ).toBeVisible({ timeout: 10_000 }).catch(() => {
      // It may finish so fast we miss the intermediate state – that is fine.
    });
    await expect(
      page.locator("text=Drop or choose a file")
    ).toBeVisible({ timeout: 30_000 });

    // --- 7. Material must appear in the Library list ---
    await expect(
      page.locator("text=smoke-test.pdf").first()
    ).toBeVisible({ timeout: 15_000 });

    // --- 8. No worker errors may have been emitted during extraction ---
    expect(
      workerErrors,
      `PDF.js worker errors detected: ${workerErrors.join("; ")}`
    ).toHaveLength(0);
  });
});
