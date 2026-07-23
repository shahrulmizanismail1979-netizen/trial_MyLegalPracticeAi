import { test, expect } from "@playwright/test";

// Browser smoke tests, running through the shared proxy like real users.
//
// 1. The API server is up and serving (public health endpoint).
// 2. The research module enforces its security model end to end: research
//    routes are staff-only, so an unauthenticated browser must be denied.
//    (See docs/SECURITY_MODEL.md — no public access to research data.)

test("API server health endpoint responds in the browser", async ({
  page,
}) => {
  const response = await page.goto("/api/healthz");
  expect(response, "no response from /api/healthz").not.toBeNull();
  expect(response!.status()).toBe(200);
  const body = JSON.parse(await response!.text()) as { status: string };
  expect(body.status).toBe("ok");
});

test("research API denies unauthenticated browsers (default-deny)", async ({
  page,
}) => {
  const response = await page.goto("/api/research/healthz");
  expect(response, "no response from /api/research/healthz").not.toBeNull();
  expect(response!.status()).toBe(401);
  const body = JSON.parse(await response!.text()) as { error: string };
  expect(body.error).toBe("Unauthorized");
});
