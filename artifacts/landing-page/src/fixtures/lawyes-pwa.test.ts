import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readProjectFile = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relativePath}`, import.meta.url)), "utf8");

describe("LAWYes PWA source contract", () => {
  it("publishes a manifest using the existing LAWYes logo assets", () => {
    const manifest = JSON.parse(readProjectFile("public/manifest.webmanifest"));

    expect(manifest.name).toContain("LAWYes");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual(
      expect.arrayContaining(["/lawyes-logo.png", "/logo.svg"]),
    );
  });

  it("keeps every API request network-only and precaches only the public shell", () => {
    const serviceWorker = readProjectFile("public/service-worker.js");

    expect(serviceWorker).toContain('url.pathname.startsWith("/api/")');
    expect(serviceWorker).toMatch(/isApiRequest\(url\).*?return;/s);
    expect(serviceWorker).toContain("const STATIC_APP_SHELL");
    expect(serviceWorker).not.toContain("cache.put(");
    expect(serviceWorker).not.toContain("caches.open(CACHE_NAME).then((cache) => cache.put");
  });

  it("wires the prompt-only install action and production-only worker registration", () => {
    const installAction = readProjectFile("src/components/lawyes-install-action.tsx");
    const main = readProjectFile("src/main.tsx");

    expect(installAction).toContain('addEventListener("beforeinstallprompt"');
    expect(installAction).toContain("deferredPrompt.prompt()");
    expect(installAction).toContain('addEventListener("appinstalled"');
    expect(main).toContain("import.meta.env.PROD");
    expect(main).toContain("serviceWorker.register");
  });
});