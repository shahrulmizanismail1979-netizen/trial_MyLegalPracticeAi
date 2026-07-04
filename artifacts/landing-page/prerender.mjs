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

// /contribute is an interactive, noindex form page. SSR of its body carries no
// SEO value (the metadata lives in the static contribute.html template and the
// app client-renders via createRoot). If prerender fails — e.g. a hook that
// relies on browser-only APIs / useSyncExternalStore without a server snapshot —
// fall back to client rendering instead of failing the whole build.
console.log("Prerender: rendering /contribute to string...");
try {
  const contributeHtml = render("/contribute");
  injectInto(resolve(__dirname, "dist/public/contribute.html"), contributeHtml, "/contribute");
} catch (err) {
  console.warn(
    "Prerender: skipping SSR for /contribute (will client-render) —",
    err.message,
  );
}
