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

function injectInto(distHtmlPath, renderedHtml, label) {
  const template = readFileSync(distHtmlPath, "utf-8");
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
injectInto(resolve(__dirname, "dist/public/index.html"), homeHtml, "/");

console.log("Prerender: rendering /contribute to string...");
let contributeHtml;
try {
  contributeHtml = render("/contribute");
} catch (err) {
  console.error("Prerender: renderToString failed for /contribute —", err.message);
  process.exit(1);
}
injectInto(resolve(__dirname, "dist/public/contribute.html"), contributeHtml, "/contribute");
