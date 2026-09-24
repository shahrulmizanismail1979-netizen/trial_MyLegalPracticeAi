import { portalLoginPaths } from "@workspace/entitlements";

export function portalLoginLinks(apps: readonly string[]): string[] {
  const configured = process.env.LAWYES_PUBLIC_URL?.trim();
  // Published primary installation, never a development/preview-domain fallback.
  let destination: URL;
  try {
    destination = new URL(configured || "https://mylegalpracticeai.life");
  } catch {
    throw new Error("Portal delivery requires a valid HTTPS public origin without credentials");
  }
  if (destination.protocol !== "https:" || destination.username || destination.password) {
    throw new Error("Portal delivery requires a valid HTTPS public origin without credentials");
  }
  return portalLoginPaths(apps).map(path => `${destination.origin}${path}`);
}

export function portalLoginHtml(apps: readonly string[]): string {
  return portalLoginLinks(apps).map(url => {
    const safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    return `<p>Sign in: <a href="${safe}">${safe}</a></p>`;
  }).join("");
}