import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const manifest = readFileSync(
  new URL("../artifacts/landing-page/.replit-artifact/artifact.toml", import.meta.url),
  "utf8",
);
const rewrites = [...manifest.matchAll(
  /\[\[services\.production\.rewrites\]\]\s*from\s*=\s*"([^"]+)"\s*to\s*=\s*"([^"]+)"/g,
)].map(([, from, to]) => ({ from, to }));
function destination(path) {
  return rewrites.find(({ from }) => from.endsWith("*")
    ? path.startsWith(from.slice(0, -1))
    : path === from)?.to;
}

test("production serves the application shell for every landing deep link", () => {
  for (const path of [
    "/apps", "/apps/", "/lawyes", "/lawyes/", "/lawyes/example-matter",
    "/lawyes-safe-preview", "/lawyes-safe-preview/", "/sign-in", "/sign-in/", "/sign-up",
    "/staff/sign-in", "/staff/sign-in/verify", "/staff/sign-up",
    "/admin", "/admin/subscribers", "/manage-subscription",
    "/manage-subscription/", "/unsubscribe", "/unsubscribe/",
  ]) {
    assert.equal(destination(path), "/index.html", `${path} must survive a direct request/refresh`);
  }
});

test("contribution SSR and separately owned APIs/portals keep their routing", () => {
  assert.equal(destination("/contribute"), "/contribute.html");
  assert.equal(destination("/contribute/"), "/contribute.html");
  for (const path of [
    "/api/lit/auth/login", "/auth/microsoft/callback",
    "/mylitai/", "/mycrimai/", "/sarawak20/", "/research-admin/",
    "/assets/missing.js",
  ]) {
    assert.equal(destination(path), undefined, `${path} must not be caught by landing rewrites`);
  }
});