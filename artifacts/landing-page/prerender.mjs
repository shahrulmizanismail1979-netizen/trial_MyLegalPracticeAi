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

console.log("Prerender: rendering / to string...");

const serverEntry = resolve(__dirname, "dist/server/entry-server.js");
const { render } = await import(serverEntry);

let appHtml;
try {
  appHtml = render();
} catch (err) {
  console.error("Prerender: renderToString failed —", err.message);
  process.exit(1);
}

const templatePath = resolve(__dirname, "dist/public/index.html");
const template = readFileSync(templatePath, "utf-8");

const html = template.replace("<!--ssr-outlet-->", appHtml);
writeFileSync(templatePath, html);

console.log("Prerender: / injected into dist/public/index.html");
