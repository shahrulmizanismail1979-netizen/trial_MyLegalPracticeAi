import { build } from "vite";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log("Prerender: building SSR bundle...");

await build({
  configFile: resolve(__dirname, "vite.ssr.config.ts"),
  logLevel: "warn",
});

const serverEntry = resolve(__dirname, "dist/server/entry-server.js");
const { render } = await import(serverEntry);

function injectInto(distHtmlPath, renderedHtml, label, expectedRoute) {
  const template = readFileSync(distHtmlPath, "utf-8");
  const marker = `data-ssr-path="${expectedRoute}"`;
  if (!template.includes(marker)) {
    throw new Error(`Prerender: ${distHtmlPath} is missing ${marker}`);
  }
  const html = template.replace("<!--ssr-outlet-->", renderedHtml);
  writeFileSync(distHtmlPath, html);
  console.log(`Prerender: ${label} injected into ${distHtmlPath}`);
}

console.log("Prerender: rendering / to string...");
let homeHtml;
try {
  homeHtml = render("/");
} catch (err) {
  console.error("Prerender: renderToString failed for / —", err.message);
  process.exit(1);
}
injectInto(resolve(__dirname, "dist/public/index.html"), homeHtml, "/", "/");

// /contribute is an interactive, noindex form page. The HTML shell contains a
// <noscript> static fallback (heading, copy, and a home link) so non-JS crawlers
// always see meaningful content even when SSR is skipped. If prerender fails —
// e.g. a hook that relies on browser-only APIs without a server snapshot — fall
// back to client rendering; the <noscript> body covers crawler visibility.
console.log("Prerender: rendering /contribute to string...");
try {
  const contributeHtml = render("/contribute");
    injectInto(
      resolve(__dirname, "dist/public/contribute.html"),
      contributeHtml,
      "/contribute",
      "/contribute",
    );
} catch (err) {
  console.warn(
    "Prerender: skipping SSR for /contribute (noscript fallback covers crawlers) —",
    err.message,
  );
}
